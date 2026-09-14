const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const Docker = require('dockerode');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Writable } = require('stream');

const docker = new Docker();
const WorkflowSnapshot = require('../models/WorkflowSnapshot');
const Settings = require('../models/Settings');
const Log = require('../models/Log');
const { notifyWebhook } = require('./notificationService');

// Директорія для збереження снапшотів процесів
const SNAPSHOTS_DIR = path.join(__dirname, '../../backups/snapshots');
const ALGORITHM = 'aes-256-cbc';

/**
 * Запис логів у базу даних із низькою кардинальністю повідомлень для стабільності та зручного аудиту
 */
const logMessage = async (level, message) => {
    try {
        await Log.create({ level, message });
        console.log(`[SNAPSHOT-${level.toUpperCase()}] ${message}`);
    } catch (error) {
        console.error('Failed to log snapshot message:', error);
    }
};

/**
 * Отримання значення налаштування за ключем
 */
const getSetting = async (key) => {
    const s = await Settings.findOne({ where: { key } });
    return s ? s.value : null;
};

/**
 * Отримання 32-байтного ключа для шифрування AES-256
 */
const getEncryptionKey = async () => {
    const key = await getSetting('backup_encryption_key');
    if (!key) return null;
    return crypto.scryptSync(key, 'salt', 32);
};

/**
 * Безпечне виконання команди всередині Docker-контейнера через stdin/stdout без протікання shell-символів.
 * Використовує demuxStream для гарантованого відокремлення stdout від stderr.
 */
const executeInContainer = async (containerName, cmd, stdinData = null, env = []) => {
    const container = docker.getContainer(containerName);
    const exec = await container.exec({
        Cmd: cmd,
        Env: env,
        AttachStdin: stdinData !== null,
        AttachStdout: true,
        AttachStderr: true
    });

    const stream = await exec.start({
        hijack: stdinData !== null,
        stdin: stdinData !== null
    });

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const outStream = new Writable({
            write(chunk, encoding, callback) {
                stdout += chunk.toString();
                callback();
            }
        });

        const errStream = new Writable({
            write(chunk, encoding, callback) {
                stderr += chunk.toString();
                callback();
            }
        });

        docker.modem.demuxStream(stream, outStream, errStream);

        if (stdinData !== null) {
            stream.write(stdinData);
            stream.end();
        }

        stream.on('end', async () => {
            try {
                const inspect = await exec.inspect();
                if (inspect.ExitCode !== 0) {
                    return reject(new Error(stderr.trim() || stdout.trim() || `Command failed with code ${inspect.ExitCode}`));
                }
                resolve(stdout);
            } catch (inspectError) {
                reject(inspectError);
            }
        });

        stream.on('error', reject);
    });
};

/**
 * Визначає назви таблиць у базі n8n (сумісність між новими версіями n8n та застарілими схемами)
 */
const detectTableNames = async (dbType, containerName, dbPath, postgresConfig) => {
    if (dbType === 'postgres') {
        const { dbUser, dbName, dbPassword } = postgresConfig;
        const env = dbPassword ? [`PGPASSWORD=${dbPassword}`] : [];
        const sql = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('workflow_entity', 'workflow', 'credentials_entity', 'credentials');
        `;
        const res = await executeInContainer(containerName, ['psql', '-U', dbUser, '-d', dbName, '-t', '-A', '-c', sql], null, env);
        const tables = res.split('\n').map(t => t.trim()).filter(Boolean);
        return {
            workflowTable: tables.includes('workflow_entity') ? 'workflow_entity' : 'workflow',
            credentialsTable: tables.includes('credentials_entity') ? 'credentials_entity' : 'credentials'
        };
    } else {
        // SQLite
        const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workflow_entity', 'workflow', 'credentials_entity', 'credentials');`;
        const res = await executeInContainer(containerName, ['sqlite3', dbPath, sql]);
        const tables = res.split('\n').map(t => t.trim()).filter(Boolean);
        return {
            workflowTable: tables.includes('workflow_entity') ? 'workflow_entity' : 'workflow',
            credentialsTable: tables.includes('credentials_entity') ? 'credentials_entity' : 'credentials'
        };
    }
};

/**
 * Отримує наживо актуальний перелік робочих процесів безпосередньо з робочої бази n8n.
 * Разом із кількістю вузлів, статусом активності та кількістю вже створених снапшотів.
 */
const getLiveWorkflows = async () => {
    const dbType = (await getSetting('db_type')) || 'sqlite';
    const n8nContainer = (await getSetting('n8n_container_name')) || 'n8n';
    const containerName = dbType === 'postgres'
        ? ((await getSetting('db_container_name')) || n8nContainer)
        : n8nContainer;

    const dbPath = (await getSetting('db_path')) || '/home/node/.n8n/database.sqlite';
    const postgresConfig = {
        dbUser: (await getSetting('db_user')) || 'n8n',
        dbPassword: (await getSetting('db_password')) || '',
        dbName: (await getSetting('db_name')) || 'n8n'
    };

    const { workflowTable } = await detectTableNames(dbType, containerName, dbPath, postgresConfig);

    let rawWorkflows = [];

    if (dbType === 'postgres') {
        const env = postgresConfig.dbPassword ? [`PGPASSWORD=${postgresConfig.dbPassword}`] : [];
        // Формуємо запит із перетворенням на чистий JSON у PostgreSQL
        const sql = `
            SELECT json_agg(t) FROM (
                SELECT id, name, active, "createdAt", "updatedAt", nodes
                FROM "${workflowTable}"
                ORDER BY "updatedAt" DESC
            ) t;
        `;
        const res = await executeInContainer(containerName, ['psql', '-U', postgresConfig.dbUser, '-d', postgresConfig.dbName, '-t', '-A', '-c', sql], null, env);
        if (res && res.trim()) {
            try {
                rawWorkflows = JSON.parse(res.trim());
            } catch (err) {
                await logMessage('warn', `Failed to parse PostgreSQL live workflows JSON: ${err.message}`);
            }
        }
    } else {
        // SQLite: витягуємо дані через потокове читання або SQL-вираз
        const sql = `SELECT id, name, active, createdAt, updatedAt, nodes FROM "${workflowTable}" ORDER BY updatedAt DESC;`;
        // Використовуємо передачу скрипту через stdin у sqlite3 для надійного отримання великих об'єктів
        const res = await executeInContainer(containerName, ['sqlite3', '-json', dbPath], sql);
        if (res && res.trim()) {
            try {
                rawWorkflows = JSON.parse(res.trim());
            } catch (err) {
                await logMessage('warn', `Failed to parse SQLite live workflows JSON: ${err.message}`);
            }
        }
    }

    if (!Array.isArray(rawWorkflows)) {
        rawWorkflows = [];
    }

    // Підраховуємо кількість збережених снапшотів для кожного воркфлоу
    const snapshotCounts = await WorkflowSnapshot.findAll({
        attributes: [
            'workflowId',
            [WorkflowSnapshot.sequelize.fn('COUNT', WorkflowSnapshot.sequelize.col('id')), 'count']
        ],
        group: ['workflowId'],
        raw: true
    });
    const countMap = {};
    for (const item of snapshotCounts) {
        countMap[item.workflowId] = parseInt(item.count, 10) || 0;
    }

    // Форматуємо результат для фронтенду
    return rawWorkflows.map(wf => {
        let parsedNodes = [];
        try {
            parsedNodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || []);
        } catch (_) {
            parsedNodes = [];
        }

        // Збираємо перелік типів облікових даних, що використовуються в процесі
        const credentialTypes = new Set();
        if (Array.isArray(parsedNodes)) {
            for (const node of parsedNodes) {
                if (node.credentials && typeof node.credentials === 'object') {
                    for (const type of Object.keys(node.credentials)) {
                        credentialTypes.add(type);
                    }
                }
            }
        }

        return {
            id: String(wf.id),
            name: wf.name || 'Untitled Workflow',
            active: wf.active === 1 || wf.active === true || wf.active === 'true',
            createdAt: wf.createdAt || wf.created_at,
            updatedAt: wf.updatedAt || wf.updated_at,
            nodesCount: parsedNodes.length,
            credentialTypes: Array.from(credentialTypes),
            snapshotsCount: countMap[String(wf.id)] || 0
        };
    });
};

/**
 * Створення гранулярного снапшоту конкретного робочого процесу разом із пов'язаними обліковими даними.
 */
const createSnapshot = async (workflowId, options = {}) => {
    const { type = 'manual', note = '' } = options;

    if (!fs.existsSync(SNAPSHOTS_DIR)) {
        fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }

    const dbType = (await getSetting('db_type')) || 'sqlite';
    const n8nContainer = (await getSetting('n8n_container_name')) || 'n8n';
    const containerName = dbType === 'postgres'
        ? ((await getSetting('db_container_name')) || n8nContainer)
        : n8nContainer;

    const dbPath = (await getSetting('db_path')) || '/home/node/.n8n/database.sqlite';
    const postgresConfig = {
        dbUser: (await getSetting('db_user')) || 'n8n',
        dbPassword: (await getSetting('db_password')) || '',
        dbName: (await getSetting('db_name')) || 'n8n'
    };

    const { workflowTable, credentialsTable } = await detectTableNames(dbType, containerName, dbPath, postgresConfig);

    await logMessage('info', `Starting snapshot for workflow ${workflowId} (${type})...`);

    // 1. Отримуємо дані воркфлоу з бази n8n
    let workflowRecord = null;
    if (dbType === 'postgres') {
        const env = postgresConfig.dbPassword ? [`PGPASSWORD=${postgresConfig.dbPassword}`] : [];
        const sql = `
            SELECT row_to_json(t) FROM (
                SELECT * FROM "${workflowTable}" WHERE id = '${workflowId.replace(/'/g, "''")}'
            ) t;
        `;
        const res = await executeInContainer(containerName, ['psql', '-U', postgresConfig.dbUser, '-d', postgresConfig.dbName, '-t', '-A', '-c', sql], null, env);
        if (res && res.trim()) {
            try {
                workflowRecord = JSON.parse(res.trim());
            } catch (e) {
                throw new Error(`Failed to parse workflow record from PostgreSQL: ${e.message}`);
            }
        }
    } else {
        const sql = `SELECT * FROM "${workflowTable}" WHERE id = '${workflowId.replace(/'/g, "''")}';`;
        const res = await executeInContainer(containerName, ['sqlite3', '-json', dbPath], sql);
        if (res && res.trim()) {
            try {
                const list = JSON.parse(res.trim());
                workflowRecord = list[0] || null;
            } catch (e) {
                throw new Error(`Failed to parse workflow record from SQLite: ${e.message}`);
            }
        }
    }

    if (!workflowRecord) {
        throw new Error(`Workflow with ID '${workflowId}' not found in n8n database`);
    }

    // 2. Аналізуємо ноди для пошуку пов'язаних облікових даних
    let nodes = [];
    try {
        nodes = typeof workflowRecord.nodes === 'string' ? JSON.parse(workflowRecord.nodes) : (workflowRecord.nodes || []);
    } catch (_) {
        nodes = [];
    }

    const credentialIds = new Set();
    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (node.credentials && typeof node.credentials === 'object') {
                for (const credObj of Object.values(node.credentials)) {
                    if (credObj && credObj.id) {
                        credentialIds.add(String(credObj.id));
                    }
                }
            }
        }
    }

    // 3. Витягуємо пов'язані креденшели
    let credentials = [];
    if (credentialIds.size > 0) {
        const idsList = Array.from(credentialIds).map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        if (dbType === 'postgres') {
            const env = postgresConfig.dbPassword ? [`PGPASSWORD=${postgresConfig.dbPassword}`] : [];
            const sql = `
                SELECT json_agg(t) FROM (
                    SELECT * FROM "${credentialsTable}" WHERE id IN (${idsList})
                ) t;
            `;
            const res = await executeInContainer(containerName, ['psql', '-U', postgresConfig.dbUser, '-d', postgresConfig.dbName, '-t', '-A', '-c', sql], null, env);
            if (res && res.trim() && res.trim() !== 'null') {
                try {
                    credentials = JSON.parse(res.trim()) || [];
                } catch (_) {}
            }
        } else {
            const sql = `SELECT * FROM "${credentialsTable}" WHERE id IN (${idsList});`;
            const res = await executeInContainer(containerName, ['sqlite3', '-json', dbPath], sql);
            if (res && res.trim()) {
                try {
                    credentials = JSON.parse(res.trim()) || [];
                } catch (_) {}
            }
        }
    }

    const credentialsSummary = credentials.map(c => ({
        id: String(c.id),
        name: c.name,
        type: c.type
    }));

    // 4. Формуємо маніфест та файли пакету
    const manifest = {
        manifestVersion: '1.0',
        createdAt: new Date().toISOString(),
        workflowId: String(workflowRecord.id),
        workflowName: workflowRecord.name,
        active: Boolean(workflowRecord.active),
        nodesCount: nodes.length,
        credentialsCount: credentials.length,
        credentials: credentialsSummary,
        environment: {
            dbType,
            backupManagerVersion: '1.6.0'
        },
        note: note || null
    };

    // Безпечне ім'я файлу (підтримка кирилиці, видалення заборонених символів)
    const safeName = (workflowRecord.name || 'workflow')
        .replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ_\-]/g, '_')
        .substring(0, 40);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const useEncryption = (await getSetting('backup_encryption')) === 'true';

    let filename = `snapshot-${safeName}-${workflowId}-${timestamp}.n8n-snapshot`;
    if (useEncryption) {
        filename += '.enc';
    }
    const filepath = path.join(SNAPSHOTS_DIR, filename);

    // 5. Пакуємо у ZIP-архів за допомогою archiver
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Підготовка потоку запису (з шифруванням або без)
    const outputStream = fs.createWriteStream(filepath);
    let pipeline = archive;

    if (useEncryption) {
        const key = await getEncryptionKey();
        if (!key) {
            throw new Error('Encryption is enabled but backup_encryption_key is not set in settings');
        }
        const iv = crypto.randomBytes(16);
        outputStream.write(iv);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        pipeline = archive.pipe(cipher);
    }

    pipeline.pipe(outputStream);

    // Додаємо файли в архів
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(workflowRecord, null, 2), { name: 'workflow.json' });
    archive.append(JSON.stringify(credentials, null, 2), { name: 'credentials.json' });

    await archive.finalize();

    await new Promise((resolve, reject) => {
        outputStream.on('finish', resolve);
        outputStream.on('error', reject);
    });

    const fileStats = fs.statSync(filepath);

    // 6. Створюємо запис у базі даних
    const snapshot = await WorkflowSnapshot.create({
        workflowId: String(workflowRecord.id),
        workflowName: workflowRecord.name || 'Untitled Workflow',
        filename,
        path: filepath,
        size: fileStats.size,
        type,
        storageLocation: 'local',
        nodesCount: nodes.length,
        credentialsCount: credentials.length,
        credentialsSummary: JSON.stringify(credentialsSummary),
        note: note || null
    });

    await logMessage('info', `Workflow snapshot created: ${filename} (${(fileStats.size / 1024).toFixed(1)} KB, ${credentials.length} credentials)`);

    // 7. Вивантаження у підключену хмару
    try {
        await uploadSnapshotToCloud(filepath, filename, snapshot.id);
    } catch (cloudErr) {
        await logMessage('warn', `Cloud upload warning for snapshot ${filename}: ${cloudErr.message}`);
    }

    // 8. Ротація старих снапшотів для цього процесу
    try {
        const retentionLimit = parseInt(await getSetting('wf_snapshots_retention') || '5', 10);
        if (retentionLimit > 0) {
            await cleanupWorkflowSnapshots(String(workflowRecord.id), retentionLimit);
        }
    } catch (rotErr) {
        await logMessage('warn', `Snapshot rotation error: ${rotErr.message}`);
    }

    // Сповіщення через Webhook (якщо налаштовано)
    try {
        notifyWebhook('workflow_snapshot_success', {
            workflowName: workflowRecord.name,
            workflowId: String(workflowRecord.id),
            filename,
            size: `${(fileStats.size / 1024).toFixed(1)} KB`,
            nodes: nodes.length,
            credentials: credentials.length
        });
    } catch (_) {}

    return snapshot;
};

/**
 * Гранулярне відновлення робочого процесу та його облікових даних наживо (Zero-Downtime Rollback).
 * Виконує атомарний upsert у базі n8n без перезавантаження контейнера.
 */
const restoreSnapshot = async (snapshotId) => {
    const snapshot = await WorkflowSnapshot.findByPk(snapshotId);
    if (!snapshot) {
        throw new Error('Snapshot not found in database');
    }

    if (!fs.existsSync(snapshot.path)) {
        throw new Error(`Snapshot file '${snapshot.filename}' does not exist on disk`);
    }

    await logMessage('info', `Starting rollback for workflow '${snapshot.workflowName}' from snapshot ${snapshot.filename}...`);

    let buffer = fs.readFileSync(snapshot.path);

    // Розшифрування за потреби
    if (snapshot.filename.endsWith('.enc')) {
        const key = await getEncryptionKey();
        if (!key) {
            throw new Error('Cannot decrypt snapshot: encryption key missing in settings');
        }
        const iv = buffer.subarray(0, 16);
        const encryptedData = buffer.subarray(16);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        buffer = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    }

    // Розпакування через AdmZip у пам'яті
    const zip = new AdmZip(buffer);
    const manifestEntry = zip.getEntry('manifest.json');
    const workflowEntry = zip.getEntry('workflow.json');
    const credentialsEntry = zip.getEntry('credentials.json');

    if (!workflowEntry) {
        throw new Error('Corrupted snapshot archive: workflow.json is missing');
    }

    const workflowData = JSON.parse(zip.readAsText(workflowEntry));
    const credentialsData = credentialsEntry ? JSON.parse(zip.readAsText(credentialsEntry)) : [];

    const dbType = (await getSetting('db_type')) || 'sqlite';
    const n8nContainer = (await getSetting('n8n_container_name')) || 'n8n';
    const containerName = dbType === 'postgres'
        ? ((await getSetting('db_container_name')) || n8nContainer)
        : n8nContainer;

    const dbPath = (await getSetting('db_path')) || '/home/node/.n8n/database.sqlite';
    const postgresConfig = {
        dbUser: (await getSetting('db_user')) || 'n8n',
        dbPassword: (await getSetting('db_password')) || '',
        dbName: (await getSetting('db_name')) || 'n8n'
    };

    const { workflowTable, credentialsTable } = await detectTableNames(dbType, containerName, dbPath, postgresConfig);

    // Формуємо транзакційний SQL-скрипт відновлення
    if (dbType === 'postgres') {
        let sql = 'BEGIN;\n';

        // Відновлення облікових даних
        for (const cred of credentialsData) {
            const dataStr = (typeof cred.data === 'string' ? cred.data : JSON.stringify(cred.data)).replace(/'/g, "''");
            const nameStr = (cred.name || '').replace(/'/g, "''");
            const typeStr = (cred.type || '').replace(/'/g, "''");
            const credId = String(cred.id).replace(/'/g, "''");
            const now = new Date().toISOString();

            sql += `
                INSERT INTO "${credentialsTable}" (id, name, type, data, "createdAt", "updatedAt")
                VALUES ('${credId}', '${nameStr}', '${typeStr}', '${dataStr}', '${now}', '${now}')
                ON CONFLICT (id) DO UPDATE 
                SET name = EXCLUDED.name, type = EXCLUDED.type, data = EXCLUDED.data, "updatedAt" = EXCLUDED."updatedAt";
            \n`;
        }

        // Відновлення воркфлоу
        const wfId = String(workflowData.id).replace(/'/g, "''");
        const wfName = (workflowData.name || '').replace(/'/g, "''");
        const activeVal = workflowData.active ? 'true' : 'false';
        const nodesJson = (typeof workflowData.nodes === 'string' ? workflowData.nodes : JSON.stringify(workflowData.nodes || [])).replace(/'/g, "''");
        const connJson = (typeof workflowData.connections === 'string' ? workflowData.connections : JSON.stringify(workflowData.connections || {})).replace(/'/g, "''");
        const settJson = (typeof workflowData.settings === 'string' ? workflowData.settings : JSON.stringify(workflowData.settings || {})).replace(/'/g, "''");
        const staticJson = (typeof workflowData.staticData === 'string' ? workflowData.staticData : JSON.stringify(workflowData.staticData || null)).replace(/'/g, "''");
        const pinJson = (typeof workflowData.pinData === 'string' ? workflowData.pinData : JSON.stringify(workflowData.pinData || {})).replace(/'/g, "''");
        const versionId = (workflowData.versionId || '').replace(/'/g, "''");
        const now = new Date().toISOString();

        sql += `
            INSERT INTO "${workflowTable}" (id, name, active, nodes, connections, settings, "staticData", "pinData", "versionId", "createdAt", "updatedAt")
            VALUES ('${wfId}', '${wfName}', ${activeVal}, '${nodesJson}', '${connJson}', '${settJson}', '${staticJson}', '${pinJson}', '${versionId}', '${now}', '${now}')
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name, active = EXCLUDED.active, nodes = EXCLUDED.nodes, connections = EXCLUDED.connections,
                settings = EXCLUDED.settings, "staticData" = EXCLUDED."staticData", "pinData" = EXCLUDED."pinData",
                "versionId" = EXCLUDED."versionId", "updatedAt" = EXCLUDED."updatedAt";
        \n`;

        sql += 'COMMIT;\n';

        const env = postgresConfig.dbPassword ? [`PGPASSWORD=${postgresConfig.dbPassword}`] : [];
        await executeInContainer(containerName, ['psql', '-U', postgresConfig.dbUser, '-d', postgresConfig.dbName], sql, env);
    } else {
        // SQLite
        let sql = 'BEGIN TRANSACTION;\n';

        // Відновлення облікових даних
        for (const cred of credentialsData) {
            const dataStr = (typeof cred.data === 'string' ? cred.data : JSON.stringify(cred.data)).replace(/'/g, "''");
            const nameStr = (cred.name || '').replace(/'/g, "''");
            const typeStr = (cred.type || '').replace(/'/g, "''");
            const credId = String(cred.id).replace(/'/g, "''");
            const now = new Date().toISOString();

            sql += `
                INSERT OR REPLACE INTO "${credentialsTable}" (id, name, type, data, createdAt, updatedAt)
                VALUES ('${credId}', '${nameStr}', '${typeStr}', '${dataStr}', '${now}', '${now}');
            \n`;
        }

        // Відновлення воркфлоу
        const wfId = String(workflowData.id).replace(/'/g, "''");
        const wfName = (workflowData.name || '').replace(/'/g, "''");
        const activeVal = workflowData.active ? 1 : 0;
        const nodesJson = (typeof workflowData.nodes === 'string' ? workflowData.nodes : JSON.stringify(workflowData.nodes || [])).replace(/'/g, "''");
        const connJson = (typeof workflowData.connections === 'string' ? workflowData.connections : JSON.stringify(workflowData.connections || {})).replace(/'/g, "''");
        const settJson = (typeof workflowData.settings === 'string' ? workflowData.settings : JSON.stringify(workflowData.settings || {})).replace(/'/g, "''");
        const staticJson = (typeof workflowData.staticData === 'string' ? workflowData.staticData : JSON.stringify(workflowData.staticData || null)).replace(/'/g, "''");
        const pinJson = (typeof workflowData.pinData === 'string' ? workflowData.pinData : JSON.stringify(workflowData.pinData || {})).replace(/'/g, "''");
        const versionId = (workflowData.versionId || '').replace(/'/g, "''");
        const now = new Date().toISOString();

        sql += `
            INSERT OR REPLACE INTO "${workflowTable}" (id, name, active, nodes, connections, settings, staticData, pinData, versionId, createdAt, updatedAt)
            VALUES ('${wfId}', '${wfName}', ${activeVal}, '${nodesJson}', '${connJson}', '${settJson}', '${staticJson}', '${pinJson}', '${versionId}', '${now}', '${now}');
        \n`;

        sql += 'COMMIT;\n';

        await executeInContainer(containerName, ['sqlite3', dbPath], sql);
    }

    await logMessage('info', `Workflow '${snapshot.workflowName}' (ID: ${snapshot.workflowId}) successfully rolled back to snapshot ${snapshot.filename}`);

    return {
        success: true,
        workflowId: snapshot.workflowId,
        workflowName: snapshot.workflowName,
        restoredCredentialsCount: credentialsData.length
    };
};

/**
 * Видалення снапшоту з локального диска та хмарних сховищ
 */
const deleteSnapshot = async (snapshotId) => {
    const snapshot = await WorkflowSnapshot.findByPk(snapshotId);
    if (!snapshot) {
        throw new Error('Snapshot not found');
    }

    if (snapshot.isProtected) {
        throw new Error('Cannot delete a protected snapshot. Disable protection first.');
    }

    // Видаляємо локальний файл
    if (fs.existsSync(snapshot.path)) {
        fs.unlinkSync(snapshot.path);
    }

    // Видаляємо з хмарних сховищ
    try {
        await deleteSnapshotFromCloud(snapshot.filename, snapshot.storageLocation);
    } catch (e) {
        await logMessage('warn', `Failed to delete snapshot from cloud: ${e.message}`);
    }

    await snapshot.destroy();
    await logMessage('info', `Deleted snapshot: ${snapshot.filename}`);
};

/**
 * Перемикання прапорця захисту від видалення (Protection Lock)
 */
const toggleProtection = async (snapshotId) => {
    const snapshot = await WorkflowSnapshot.findByPk(snapshotId);
    if (!snapshot) throw new Error('Snapshot not found');

    snapshot.isProtected = !snapshot.isProtected;
    await snapshot.save();
    return snapshot;
};

/**
 * Отримання списку збережених снапшотів із сортуванням
 */
const listSnapshots = async (workflowId = null) => {
    const where = {};
    if (workflowId) {
        where.workflowId = String(workflowId);
    }
    return await WorkflowSnapshot.findAll({
        where,
        order: [['createdAt', 'DESC']]
    });
};

/**
 * Автоматична ротація: збереження лише останніх N копій для конкретного процесу
 */
const cleanupWorkflowSnapshots = async (workflowId, retentionLimit) => {
    if (!retentionLimit || retentionLimit <= 0) return;

    const snapshots = await WorkflowSnapshot.findAll({
        where: { workflowId: String(workflowId) },
        order: [['createdAt', 'DESC']]
    });

    const unprotected = snapshots.filter(s => !s.isProtected);
    if (unprotected.length > retentionLimit) {
        const toDelete = unprotected.slice(retentionLimit);
        for (const snap of toDelete) {
            try {
                if (fs.existsSync(snap.path)) {
                    fs.unlinkSync(snap.path);
                }
                await deleteSnapshotFromCloud(snap.filename, snap.storageLocation);
                await snap.destroy();
                await logMessage('info', `Rotated old workflow snapshot: ${snap.filename} (Limit: ${retentionLimit})`);
            } catch (err) {
                await logMessage('warn', `Failed to rotate snapshot ${snap.filename}: ${err.message}`);
            }
        }
    }
};

/**
 * Завантаження файлу снапшоту у підключені хмарні сховища
 */
const uploadSnapshotToCloud = async (filepath, filename, snapshotId) => {
    const isCloud = (await getSetting('storage_location')) === 'cloud' || (await getSetting('aws_s3_enabled')) === 'true';
    if (!isCloud) return;

    const provider = (await getSetting('cloud_provider')) || 's3';

    if (provider === 's3') {
        const accessKeyId = await getSetting('aws_s3_access_key');
        const secretAccessKey = await getSetting('aws_s3_secret_key');
        const region = await getSetting('aws_s3_region');
        const bucket = await getSetting('aws_s3_bucket');
        const endpoint = await getSetting('aws_s3_endpoint');

        if (accessKeyId && secretAccessKey && region && bucket) {
            const config = { region, credentials: { accessKeyId, secretAccessKey } };
            if (endpoint) {
                config.endpoint = endpoint;
                config.forcePathStyle = true;
            }
            const s3Client = new S3Client(config);
            const key = `workflow-snapshots/${filename}`;
            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: fs.createReadStream(filepath)
            }));
            await logMessage('info', `Uploaded snapshot ${filename} to S3 (${key})`);

            const snap = await WorkflowSnapshot.findByPk(snapshotId);
            if (snap) {
                snap.storageLocation = snap.storageLocation === 'local' ? 's3' : `${snap.storageLocation},s3`;
                await snap.save();
            }
        }
    } else if (provider === 'gdrive') {
        let credentials = null;
        const credsStr = await getSetting('google_drive_credentials');
        if (credsStr) {
            try { credentials = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr; } catch (_) {}
        }
        if (!credentials) {
            const clientId = await getSetting('gdrive_client_id');
            const clientSecret = await getSetting('gdrive_client_secret');
            const refreshToken = await getSetting('gdrive_refresh_token');
            if (clientId && refreshToken) {
                credentials = { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken };
            }
        }
        const folderId = (await getSetting('gdrive_folder_id') || await getSetting('google_drive_folder_id') || '').trim();
        if (credentials) {
            const { uploadToGoogleDrive } = require('./cloud/googleDrive');
            await uploadToGoogleDrive(filepath, filename, credentials, folderId);
            await logMessage('info', `Uploaded snapshot ${filename} to Google Drive`);

            const snap = await WorkflowSnapshot.findByPk(snapshotId);
            if (snap) {
                snap.storageLocation = snap.storageLocation === 'local' ? 'gdrive' : `${snap.storageLocation},gdrive`;
                await snap.save();
            }
        }
    } else if (provider === 'onedrive') {
        let refreshToken = await getSetting('onedrive_refresh_token');
        const clientId = await getSetting('onedrive_client_id');
        const clientSecret = await getSetting('onedrive_client_secret');
        if (refreshToken && typeof refreshToken === 'string' && refreshToken.startsWith('{')) {
            try {
                const parsed = JSON.parse(refreshToken);
                if (parsed.refresh_token) refreshToken = parsed.refresh_token;
            } catch (_) {}
        }
        if (refreshToken) {
            const credentials = (clientId && clientSecret)
                ? { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }
                : refreshToken;
            const { uploadToOneDrive } = require('./cloud/oneDrive');
            await uploadToOneDrive(filepath, filename, credentials);
            await logMessage('info', `Uploaded snapshot ${filename} to OneDrive`);

            const snap = await WorkflowSnapshot.findByPk(snapshotId);
            if (snap) {
                snap.storageLocation = snap.storageLocation === 'local' ? 'onedrive' : `${snap.storageLocation},onedrive`;
                await snap.save();
            }
        }
    }
};

/**
 * Видалення снапшоту з хмари
 */
const deleteSnapshotFromCloud = async (filename, storageLocation) => {
    if (!storageLocation) return;
    const locations = storageLocation.split(',');

    for (const loc of locations) {
        const trimmed = loc.trim();
        if (!trimmed || trimmed === 'local') continue;

        try {
            if (trimmed === 's3') {
                const accessKeyId = await getSetting('aws_s3_access_key');
                const secretAccessKey = await getSetting('aws_s3_secret_key');
                const region = await getSetting('aws_s3_region');
                const bucket = await getSetting('aws_s3_bucket');
                const endpoint = await getSetting('aws_s3_endpoint');
                if (accessKeyId && secretAccessKey && region && bucket) {
                    const config = { region, credentials: { accessKeyId, secretAccessKey } };
                    if (endpoint) {
                        config.endpoint = endpoint;
                        config.forcePathStyle = true;
                    }
                    const s3Client = new S3Client(config);
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: bucket,
                        Key: `workflow-snapshots/${filename}`
                    }));
                }
            } else if (trimmed === 'gdrive') {
                let credentials = null;
                const credsStr = await getSetting('google_drive_credentials');
                if (credsStr) {
                    try { credentials = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr; } catch (_) {}
                }
                if (!credentials) {
                    const clientId = await getSetting('gdrive_client_id');
                    const clientSecret = await getSetting('gdrive_client_secret');
                    const refreshToken = await getSetting('gdrive_refresh_token');
                    if (clientId && refreshToken) {
                        credentials = { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken };
                    }
                }
                const folderId = (await getSetting('gdrive_folder_id') || await getSetting('google_drive_folder_id') || '').trim();
                if (credentials) {
                    const { deleteFromGoogleDrive } = require('./cloud/googleDrive');
                    await deleteFromGoogleDrive(filename, credentials, folderId);
                }
            } else if (trimmed === 'onedrive') {
                let refreshToken = await getSetting('onedrive_refresh_token');
                const clientId = await getSetting('onedrive_client_id');
                const clientSecret = await getSetting('onedrive_client_secret');
                if (refreshToken && typeof refreshToken === 'string' && refreshToken.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(refreshToken);
                        if (parsed.refresh_token) refreshToken = parsed.refresh_token;
                    } catch (_) {}
                }
                if (refreshToken) {
                    const credentials = (clientId && clientSecret)
                        ? { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }
                        : refreshToken;
                    const { deleteFromOneDrive } = require('./cloud/oneDrive');
                    await deleteFromOneDrive(filename, credentials);
                }
            }
        } catch (cloudDelErr) {
            await logMessage('warn', `Failed to delete ${filename} from ${trimmed}: ${cloudDelErr.message}`);
        }
    }
};

module.exports = {
    getLiveWorkflows,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    toggleProtection,
    listSnapshots
};
