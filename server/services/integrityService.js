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
/**
 * Внутрішня функція перевірки структури та підрахунку даних бекапу
 */
async function runIntegrityVerification(backup) {
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

            // Потоковий аналіз SQL-дампу для перевірки наявності реальних даних без перевантаження оперативної пам'яті
            const readline = require('readline');
            const rl = readline.createInterface({
                input: readStream,
                crlfDelay: Infinity
            });

            let inWorkflowCopy = false;
            let inCredentialsCopy = false;
            let workflowCount = 0;
            let credentialsCount = 0;

            for await (const line of rl) {
                // Перевіряємо початок блоку COPY або INSERT для воркфлоу
                if (/^COPY\s+("?public"?\.)?"?workflow(_entity)?"?\s+/i.test(line)) {
                    inWorkflowCopy = true;
                    continue;
                } else if (/^INSERT\s+INTO\s+("?public"?\.)?"?workflow(_entity)?"?\s+/i.test(line)) {
                    workflowCount++;
                    continue;
                }

                // Перевіряємо початок блоку COPY або INSERT для облікових даних
                if (/^COPY\s+("?public"?\.)?"?credentials(_entity)?"?\s+/i.test(line)) {
                    inCredentialsCopy = true;
                    continue;
                } else if (/^INSERT\s+INTO\s+("?public"?\.)?"?credentials(_entity)?"?\s+/i.test(line)) {
                    credentialsCount++;
                    continue;
                }

                // Закінчення блоку COPY в pg_dump
                if (line === '\\.') {
                    inWorkflowCopy = false;
                    inCredentialsCopy = false;
                    continue;
                }

                if (inWorkflowCopy && line.trim()) {
                    workflowCount++;
                }

                if (inCredentialsCopy && line.trim()) {
                    credentialsCount++;
                }
            }

            if (workflowCount === 0) {
                return {
                    ok: false,
                    filename,
                    error: 'Empty backup: 0 workflows found in PostgreSQL dump',
                    stats: { workflows: 0, credentials: credentialsCount }
                };
            }

            return {
                ok: true,
                filename,
                stats: { workflows: workflowCount, credentials: credentialsCount }
            };
        } catch (err) {
            return { ok: false, filename, error: `Decryption/Decompression failed: ${err.message}` };
        }
    }

    // SQLite backups (tar format)
    const tempDir = path.join(__dirname, `../temp_integrity_${backupId}`);
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

        // 4. Validate SQLite DB using node sqlite3 driver and verify non-trivial row counts
        const dbVerification = await new Promise((resolve) => {
            const db = new sqlite3.Database(extractedDbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    resolve({ ok: false, error: `Failed to open SQLite database: ${err.message}` });
                } else {
                    db.get('PRAGMA integrity_check;', (integrityErr, row) => {
                        if (integrityErr) {
                            db.close();
                            resolve({ ok: false, error: `Integrity check query failed: ${integrityErr.message}` });
                        } else if (row.integrity_check !== 'ok') {
                            db.close();
                            resolve({ ok: false, error: `SQLite PRAGMA integrity check failed: ${row.integrity_check}` });
                        } else {
                            // Перевіряємо наявність таблиці воркфлоу
                            db.get("SELECT name FROM sqlite_master WHERE type='table' AND (name='workflow_entity' OR name='workflow');", (tableErr, tableRow) => {
                                if (tableErr) {
                                    db.close();
                                    resolve({ ok: false, error: `Schema validation query failed: ${tableErr.message}` });
                                } else if (!tableRow) {
                                    db.close();
                                    resolve({ ok: false, error: 'Database does not contain expected n8n schema tables (workflow_entity or workflow)' });
                                } else {
                                    const workflowTable = tableRow.name;
                                    
                                    // Перевіряємо таблицю креденшелів
                                    db.get("SELECT name FROM sqlite_master WHERE type='table' AND (name='credentials_entity' OR name='credentials');", (credTableErr, credTableRow) => {
                                        const credsTable = credTableRow ? credTableRow.name : null;

                                        // Рахуємо кількість воркфлоу
                                        db.get(`SELECT COUNT(*) AS count FROM "${workflowTable}";`, (wfCountErr, wfRow) => {
                                            if (wfCountErr) {
                                                db.close();
                                                resolve({ ok: false, error: `Failed to count workflows: ${wfCountErr.message}` });
                                                return;
                                            }

                                            const workflowCount = wfRow ? (wfRow.count || 0) : 0;

                                            const finishCheck = (credentialsCount) => {
                                                db.close();
                                                if (workflowCount === 0) {
                                                    resolve({
                                                        ok: false,
                                                        error: 'Empty backup: 0 workflows found in database',
                                                        stats: { workflows: 0, credentials: credentialsCount }
                                                    });
                                                } else {
                                                    resolve({
                                                        ok: true,
                                                        stats: { workflows: workflowCount, credentials: credentialsCount }
                                                    });
                                                }
                                            };

                                            if (credsTable) {
                                                db.get(`SELECT COUNT(*) AS count FROM "${credsTable}";`, (cErr, cRow) => {
                                                    const credentialsCount = (!cErr && cRow) ? (cRow.count || 0) : 0;
                                                    finishCheck(credentialsCount);
                                                });
                                            } else {
                                                finishCheck(0);
                                            }
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });

        if (!dbVerification.ok) {
            return { ok: false, filename, error: dbVerification.error, stats: dbVerification.stats };
        }

        return { ok: true, filename, stats: dbVerification.stats };

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

/**
 * Перевіряє цілісність та відновлюваність бекапу і автоматично зберігає результат у базі даних.
 *
 * @param {string|number} backupId — ID запису у базі даних
 * @returns {{ ok: boolean, error?: string, filename: string, stats?: object }}
 */
async function checkBackupIntegrity(backupId) {
    const backup = await Backup.findByPk(backupId);
    if (!backup) {
        throw new Error(`Backup #${backupId} not found`);
    }

    const result = await runIntegrityVerification(backup);

    // Автоматично оновлюємо статус перевірки в БД
    try {
        await backup.update({
            integrityStatus: result.ok ? 'ok' : 'corrupt',
            integrityDetails: JSON.stringify(result.stats || (result.error ? { error: result.error } : {})),
            integrityCheckedAt: new Date()
        });
    } catch (dbErr) {
        console.error('Failed to save integrity status to database:', dbErr);
    }

    return result;
}

module.exports = { checkBackupIntegrity };
