const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const Backup = require('../models/Backup');
const Settings = require('../models/Settings');

const ALGORITHM = 'aes-256-cbc';

const getSetting = async (key) => {
    const s = await Settings.findOne({ where: { key } });
    return s ? s.value : null;
};

const getEncryptionKey = async () => {
    const key = await getSetting('backup_encryption_key');
    if (!key) return null;
    return crypto.scryptSync(key, 'salt', 32);
};

/**
 * Перевіряє цілісність та відновлюваність бекапу.
 * Для SQLite: розпаковує, розшифровує та перевіряє структуру бази через sqlite3 driver.
 * Для Postgres: перевіряє читабельність та успішність розшифрування/декомпресії.
 *
 * @param {string|number} backupId — ID запису у базі даних
 * @returns {{ ok: boolean, error?: string, filename: string }}
 */
async function checkBackupIntegrity(backupId) {
    const backup = await Backup.findByPk(backupId);
    if (!backup) {
        throw new Error(`Backup #${backupId} not found`);
    }

    const { path: filePath, filename } = backup;

    if (!fs.existsSync(filePath)) {
        return { ok: false, filename, error: 'File not found on disk' };
    }

    // Postgres SQL backups
    if (filename.endsWith('.sql') || filename.endsWith('.sql.gz') || filename.endsWith('.sql.enc') || filename.endsWith('.sql.gz.enc')) {
        try {
            let readStream = fs.createReadStream(filePath);
            if (filename.endsWith('.enc')) {
                const key = await getEncryptionKey();
                if (!key) return { ok: false, filename, error: 'Decryption key missing in settings' };
                
                const fd = fs.openSync(filePath, 'r');
                const iv = Buffer.alloc(16);
                fs.readSync(fd, iv, 0, 16, 0);
                fs.closeSync(fd);

                const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
                readStream = fs.createReadStream(filePath, { start: 16 }).pipe(decipher);
            }

            if (filename.includes('.gz')) {
                const zlib = require('zlib');
                readStream = readStream.pipe(zlib.createGunzip());
            }

            // Consume stream to verify no decryption/decompression errors
            await new Promise((resolve, reject) => {
                readStream.on('data', () => {});
                readStream.on('end', resolve);
                readStream.on('error', reject);
            });

            return { ok: true, filename };
        } catch (err) {
            return { ok: false, filename, error: `Decryption/Decompression failed: ${err.message}` };
        }
    }

    // SQLite backups (tar format)
    const tempDir = path.join(__dirname, `../temp_integrity_\${backupId}`);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempTarPath = path.join(tempDir, 'temp.tar');

    try {
        // 1. Decrypt & Decompress to temp.tar
        let readStream = fs.createReadStream(filePath);

        if (filename.endsWith('.enc')) {
            const key = await getEncryptionKey();
            if (!key) {
                return { ok: false, filename, error: 'Decryption key missing in settings' };
            }
            
            const fd = fs.openSync(filePath, 'r');
            const iv = Buffer.alloc(16);
            fs.readSync(fd, iv, 0, 16, 0);
            fs.closeSync(fd);

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            readStream = fs.createReadStream(filePath, { start: 16 }).pipe(decipher);
        }

        if (filename.includes('.gz')) {
            const zlib = require('zlib');
            readStream = readStream.pipe(zlib.createGunzip());
        }

        const writeStream = fs.createWriteStream(tempTarPath);
        readStream.pipe(writeStream);

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            readStream.on('error', reject);
        });

        // 2. Extract tarball to tempDir
        const { execFile } = require('child_process');
        const { promisify } = require('util');
        const execFileAsync = promisify(execFile);

        await execFileAsync('tar', ['-xf', tempTarPath, '-C', tempDir], { timeout: 30000 });

        // 3. Find the SQLite file in extracted files
        function findSqliteFile(dir) {
            const list = fs.readdirSync(dir);
            for (const file of list) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    const res = findSqliteFile(fullPath);
                    if (res) return res;
                } else if (file === 'database.sqlite' || file.endsWith('.sqlite')) {
                    return fullPath;
                }
            }
            return null;
        }

        const extractedDbPath = findSqliteFile(tempDir);
        if (!extractedDbPath) {
            return { ok: false, filename, error: 'No SQLite database file found inside the backup archive' };
        }

        // 4. Validate SQLite DB using node sqlite3 driver
        const dbVerification = await new Promise((resolve) => {
            const db = new sqlite3.Database(extractedDbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    resolve({ ok: false, error: `Failed to open SQLite database: \${err.message}` });
                } else {
                    db.get('PRAGMA integrity_check;', (integrityErr, row) => {
                        if (integrityErr) {
                            db.close();
                            resolve({ ok: false, error: `Integrity check query failed: \${integrityErr.message}` });
                        } else if (row.integrity_check !== 'ok') {
                            db.close();
                            resolve({ ok: false, error: `SQLite PRAGMA integrity check failed: \dots \${row.integrity_check}` });
                        } else {
                            db.get("SELECT name FROM sqlite_master WHERE type='table' AND (name='workflow_entity' OR name='workflow');", (tableErr, tableRow) => {
                                db.close();
                                if (tableErr) {
                                    resolve({ ok: false, error: `Schema validation query failed: \dots \${tableErr.message}` });
                                } else if (!tableRow) {
                                    resolve({ ok: false, error: 'Database does not contain expected n8n schema tables (workflow_entity or workflow)' });
                                } else {
                                    resolve({ ok: true });
                                }
                            });
                        }
                    });
                }
            });
        });

        if (!dbVerification.ok) {
            return { ok: false, filename, error: dbVerification.error };
        }

        return { ok: true, filename };

    } catch (err) {
        return {
            ok: false,
            filename,
            error: err.message || 'Verification failed'
        };
    } finally {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (_) {}
    }
}

module.exports = { checkBackupIntegrity };
