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
            let latestUpdate = null;
            let copyWorkflowUpdatedColIdx = -1;

            for await (const line of rl) {
                // Перевіряємо початок блоку COPY для воркфлоу та визначаємо індекс колонки updatedAt
                const copyMatch = line.match(/^COPY\s+("?public"?\.)?"?workflow(_entity)?"?\s*(?:\((.*?)\))?\s+FROM\s+stdin/i);
                if (copyMatch) {
                    inWorkflowCopy = true;
                    // Якщо в COPY вказано перелік колонок, шукаємо позицію updatedAt або createdAt
                    if (copyMatch[3]) {
                        const cols = copyMatch[3].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                        const uIdx = cols.indexOf('updatedAt');
                        const cIdx = cols.indexOf('createdAt');
                        copyWorkflowUpdatedColIdx = uIdx !== -1 ? uIdx : cIdx;
                    } else {
                        copyWorkflowUpdatedColIdx = -1;
                    }
                    continue;
                } else if (/^INSERT\s+INTO\s+("?public"?\.)?"?workflow(_entity)?"?\s+/i.test(line)) {
                    workflowCount++;
                    // Шукаємо дату в рядку INSERT через регулярний вираз для перевірки свіжості
                    const dateMatch = line.match(/\b(20\d\d-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/);
                    if (dateMatch) {
                        const d = new Date(dateMatch[1]);
                        if (!isNaN(d.getTime()) && (!latestUpdate || d > latestUpdate)) {
                            latestUpdate = d;
                        }
                    }
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

                    // Витягуємо дату оновлення воркфлоу для Freshness Heuristic
                    if (copyWorkflowUpdatedColIdx !== -1) {
                        const parts = line.split('\t');
                        const rawDate = parts[copyWorkflowUpdatedColIdx];
                        if (rawDate && rawDate !== '\\N') {
                            const d = new Date(rawDate);
                            if (!isNaN(d.getTime()) && (!latestUpdate || d > latestUpdate)) {
                                latestUpdate = d;
                            }
                        }
                    } else {
                        // Якщо список колонок не був вказаний у заголовку COPY, шукаємо ISO-дату в рядку
                        const dateMatch = line.match(/\b(20\d\d-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/);
                        if (dateMatch) {
                            const d = new Date(dateMatch[1]);
                            if (!isNaN(d.getTime()) && (!latestUpdate || d > latestUpdate)) {
                                latestUpdate = d;
                            }
                        }
                    }
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
                    stats: { workflows: 0, credentials: credentialsCount, latestUpdate: null }
                };
            }

            return {
                ok: true,
                filename,
                stats: {
                    workflows: workflowCount,
                    credentials: credentialsCount,
                    latestUpdate: latestUpdate ? latestUpdate.toISOString() : null
                }
            };
        } catch (err) {
            return { ok: false, filename, error: `Decryption/Decompression failed: ${err.message}` };
        }
    }

    // SQLite backups (tar format)
    const tempDir = path.join(__dirname, `../temp_integrity_${backup.id || Date.now()}`);
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

        // 4. Validate SQLite DB using node sqlite3 driver and verify non-trivial row counts & freshness
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

                                    // Отримуємо список колонок у таблиці воркфлоу для пошуку дати модифікації (updatedAt або createdAt)
                                    db.all(`PRAGMA table_info("${workflowTable}");`, (pragmaErr, columns) => {
                                        const colNames = (!pragmaErr && columns) ? columns.map(c => c.name) : [];
                                        const dateCol = colNames.includes('updatedAt') ? 'updatedAt' : (colNames.includes('createdAt') ? 'createdAt' : null);
                                        const dateSelect = dateCol ? `, MAX("${dateCol}") AS latest_update` : '';

                                        // Перевіряємо таблицю креденшелів
                                        db.get("SELECT name FROM sqlite_master WHERE type='table' AND (name='credentials_entity' OR name='credentials');", (credTableErr, credTableRow) => {
                                            const credsTable = credTableRow ? credTableRow.name : null;

                                            // Рахуємо кількість воркфлоу та визначаємо найновішу дату оновлення
                                            db.get(`SELECT COUNT(*) AS count ${dateSelect} FROM "${workflowTable}";`, (wfCountErr, wfRow) => {
                                                if (wfCountErr) {
                                                    db.close();
                                                    resolve({ ok: false, error: `Failed to count workflows: ${wfCountErr.message}` });
                                                    return;
                                                }

                                                const workflowCount = wfRow ? (wfRow.count || 0) : 0;
                                                const latestUpdateRaw = wfRow && wfRow.latest_update ? wfRow.latest_update : null;

                                                const finishCheck = (credentialsCount) => {
                                                    db.close();
                                                    if (workflowCount === 0) {
                                                        resolve({
                                                            ok: false,
                                                            error: 'Empty backup: 0 workflows found in database',
                                                            stats: { workflows: 0, credentials: credentialsCount, latestUpdate: null }
                                                        });
                                                    } else {
                                                        resolve({
                                                            ok: true,
                                                            stats: {
                                                                workflows: workflowCount,
                                                                credentials: credentialsCount,
                                                                latestUpdate: latestUpdateRaw ? new Date(latestUpdateRaw).toISOString() : null
                                                            }
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
 * Перевіряє цілісність та відновлюваність бекапу, виконує евристичні перевірки (свіжість та дельта-аномалії)
 * і зберігає детальний результат у базі даних.
 *
 * @param {string|number} backupId — ID запису у базі даних
 * @returns {{ ok: boolean, status: string, error?: string, filename: string, stats?: object, warnings?: string[] }}
 */
async function checkBackupIntegrity(backupId) {
    const backup = await Backup.findByPk(backupId);
    if (!backup) {
        throw new Error(`Backup #${backupId} not found`);
    }

    const result = await runIntegrityVerification(backup);
    const warnings = [];

    if (result.ok && result.stats) {
        // 1. Freshness Heuristic Check (Перевірка актуальності даних у базі)
        // Захист від бекапу неактивної/покинутої БД після міграції
        if (result.stats.latestUpdate) {
            try {
                const stalenessDaysSetting = await getSetting('integrity_staleness_days');
                const stalenessThresholdDays = parseInt(stalenessDaysSetting || '30', 10);
                const backupDate = backup.createdAt ? new Date(backup.createdAt) : new Date();
                const updateDate = new Date(result.stats.latestUpdate);
                const diffMs = backupDate.getTime() - updateDate.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                // Якщо останнє редагування було давніше за поріг (за замовчуванням 30 днів)
                if (diffDays > stalenessThresholdDays) {
                    const dateFormatted = updateDate.toISOString().split('T')[0];
                    warnings.push(`Database appears stale: latest workflow change was ${diffDays} days ago (${dateFormatted})`);
                }
            } catch (err) {
                console.error('Error during freshness check:', err);
            }
        }

        // 2. Delta Anomaly Guard (Контроль аномального спаду сутностей)
        // Захист від прихованої втрати даних або проблем із правами доступу при експорті
        try {
            const dropPercentSetting = await getSetting('integrity_drop_percent');
            const dropThresholdPercent = parseInt(dropPercentSetting || '30', 10);
            const { Op } = require('sequelize');

            // Шукаємо попередній успішний або попереджений бекап для порівняння кількості
            const previousBackup = await Backup.findOne({
                where: {
                    id: { [Op.ne]: backup.id },
                    integrityStatus: { [Op.in]: ['ok', 'warning'] }
                },
                order: [['createdAt', 'DESC']]
            });

            if (previousBackup && previousBackup.integrityDetails) {
                try {
                    const prevStats = JSON.parse(previousBackup.integrityDetails);
                    const curWf = result.stats.workflows || 0;
                    const prevWf = prevStats.workflows;

                    // Якщо попередня кількість була значущою (>= 5) і зафіксовано відчутний спад
                    if (typeof prevWf === 'number' && prevWf >= 5 && curWf < prevWf) {
                        const dropWf = Math.round(((prevWf - curWf) / prevWf) * 100);
                        if (dropWf >= dropThresholdPercent) {
                            warnings.push(`Significant workflow drop: ${prevWf} → ${curWf} (-${dropWf}%)`);
                        }
                    }

                    const curCreds = result.stats.credentials || 0;
                    const prevCreds = prevStats.credentials;

                    if (typeof prevCreds === 'number' && prevCreds >= 5 && curCreds < prevCreds) {
                        const dropCreds = Math.round(((prevCreds - curCreds) / prevCreds) * 100);
                        if (dropCreds >= dropThresholdPercent) {
                            warnings.push(`Significant credentials drop: ${prevCreds} → ${curCreds} (-${dropCreds}%)`);
                        }
                    }
                } catch (_) {}
            }
        } catch (err) {
            console.error('Error during delta anomaly check:', err);
        }

        result.stats.warnings = warnings;
    }

    // Визначаємо фінальний статус: якщо є попередження евристики — статус стає 'warning'
    const finalStatus = !result.ok ? 'corrupt' : (warnings.length > 0 ? 'warning' : 'ok');
    result.status = finalStatus;
    result.warnings = warnings;

    // Автоматично оновлюємо статус перевірки в БД
    try {
        await backup.update({
            integrityStatus: finalStatus,
            integrityDetails: JSON.stringify(result.stats || (result.error ? { error: result.error } : {})),
            integrityCheckedAt: new Date()
        });
    } catch (dbErr) {
        console.error('Failed to save integrity status to database:', dbErr);
    }

    return result;
}

module.exports = { checkBackupIntegrity };
