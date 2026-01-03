const Docker = require('dockerode');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const Backup = require('../models/Backup');
const Settings = require('../models/Settings');
const Log = require('../models/Log');
const docker = new Docker();

const BACKUP_DIR = path.join(__dirname, '../../backups');

const logMessage = async (level, message) => {
    try {
        await Log.create({ level, message });
        console.log(`[${level.toUpperCase()}] ${message}`);
    } catch (error) {
        console.error('Failed to log message:', error);
    }
};

const getSetting = async (key) => {
    const s = await Settings.findOne({ where: { key } });
    return s ? s.value : null;
};

const rotateBackups = async (retentionCount) => {
    if (!retentionCount || retentionCount <= 0) return;

    try {
        const backups = await Backup.findAll({
            order: [['createdAt', 'DESC']]
        });

        // Filter out protected backups
        const unprotectedBackups = backups.filter(b => !b.isProtected);

        // If we have more unprotected backups than the limit
        if (unprotectedBackups.length > retentionCount) {
            const toDelete = unprotectedBackups.slice(retentionCount);

            await logMessage('info', `Rotating backups: Deleting ${toDelete.length} old backups (Limit: ${retentionCount})`);

            for (const backup of toDelete) {
                try {
                    if (fs.existsSync(backup.path)) {
                        fs.unlinkSync(backup.path);
                    }
                    await backup.destroy();
                    await logMessage('info', `Deleted old backup: ${backup.filename}`);
                } catch (err) {
                    await logMessage('error', `Failed to delete old backup ${backup.filename}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        await logMessage('error', `Backup rotation failed: ${error.message}`);
    }
};

const createBackup = async (type = 'manual') => {
    const VERSION = '1.2.2';
    await logMessage('info', `Starting ${type} backup... (v${VERSION})`);

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        await logMessage('info', `Created backup directory: ${BACKUP_DIR}`);
    }

    const containerName = await getSetting('n8n_container_name') || 'n8n';
    const dbType = await getSetting('db_type') || 'sqlite';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    await logMessage('info', `Container: ${containerName}, DB Type: ${dbType}, Backup Dir: ${BACKUP_DIR}`);

    try {
        let filename;
        let filepath;

        if (dbType === 'postgres') {
            const dbUser = await getSetting('db_user') || 'n8n';
            const dbPassword = await getSetting('db_password') || '';
            const dbName = await getSetting('db_name') || 'n8n';
            filename = `backup-${timestamp}.sql`;
            filepath = path.join(BACKUP_DIR, filename);

            await logMessage('info', `Creating PostgreSQL backup: ${filepath}`);

            const container = docker.getContainer(containerName);

            // Set PGPASSWORD environment variable to avoid password prompt
            const env = dbPassword ? [`PGPASSWORD=${dbPassword}`] : [];

            const exec = await container.exec({
                Cmd: ['pg_dump', '-U', dbUser, '-d', dbName, '--clean', '--if-exists'],
                AttachStdout: true,
                AttachStderr: true,
                Env: env
            });

            const stream = await exec.start();
            const writeStream = fs.createWriteStream(filepath);

            // Capture stderr for logging
            const { PassThrough } = require('stream');
            const stderrStream = new PassThrough();
            let stderrData = '';
            stderrStream.on('data', (chunk) => stderrData += chunk.toString());

            // Demultiplex the stream (separate stdout from stderr)
            // Docker streams combine both with a header, demuxStream separates them
            container.modem.demuxStream(stream, writeStream, stderrStream);

            await new Promise((resolve, reject) => {
                stream.on('end', () => {
                    if (stderrData.trim()) {
                        logMessage('warn', `pg_dump output: ${stderrData}`);
                    }
                    writeStream.end();
                    resolve();
                });
                stream.on('error', (err) => {
                    logMessage('error', `Stream error: ${err.message}`);
                    reject(err);
                });
                writeStream.on('error', (err) => {
                    logMessage('error', `Write stream error: ${err.message}`);
                    reject(err);
                });
            });

        } else {
            // SQLite
            const dbPath = await getSetting('db_path') || '/home/node/.n8n/database.sqlite';
            filename = `backup-${timestamp}.tar`;
            filepath = path.join(BACKUP_DIR, filename);

            await logMessage('info', `Creating SQLite backup from ${dbPath} to ${filepath}`);

            const container = docker.getContainer(containerName);
            const stream = await container.getArchive({ path: dbPath });
            const writeStream = fs.createWriteStream(filepath);

            stream.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
        }

        const stats = fs.statSync(filepath);

        await logMessage('info', `Backup created successfully: ${filename}, Size: ${stats.size} bytes`);

        const backup = await Backup.create({
            filename,
            path: filepath,
            size: stats.size,
            type
        });

        // Attempt S3 Upload
        await uploadToS3(filepath, filename);

        // Auto-Rotation logic
        const retentionCount = parseInt(await getSetting('backup_retention_count') || '0');
        if (retentionCount > 0) {
            await rotateBackups(retentionCount);
        }

        return backup;
    } catch (error) {
        await logMessage('error', `Backup failed: ${error.message}`);
        console.error('Backup failed:', error);
        throw error;
    }
};

const listBackups = async () => {
    return await Backup.findAll({ order: [['createdAt', 'DESC']] });
};

const deleteBackup = async (id) => {
    const backup = await Backup.findByPk(id);
    if (!backup) throw new Error('Backup not found');

    if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
    }

    await backup.destroy();
};

const restoreBackup = async (id) => {
    const backup = await Backup.findByPk(id);
    if (!backup) throw new Error('Backup not found');

    const containerName = await getSetting('n8n_container_name') || 'n8n';
    const dbType = await getSetting('db_type') || 'sqlite';
    const container = docker.getContainer(containerName);

    if (dbType === 'postgres') {
        const dbUser = await getSetting('db_user') || 'n8n';
        const dbName = await getSetting('db_name') || 'n8n';
        const dbPassword = await getSetting('db_password') || '';

        await logMessage('info', `Restoring PostgreSQL backup: ${backup.filename}`);

        // Strategy: Copy file to container -> Exec psql -> Delete file
        const tempFileName = `restore-${Date.now()}.sql`;
        const tempContainerPath = `/tmp/${tempFileName}`;

        // 1. Create a tar stream of the SQL file
        const archiver = require('archiver');
        const archive = archiver('tar');
        archive.file(backup.path, { name: tempFileName });
        archive.finalize();

        // 2. Put archive into container
        await logMessage('info', `Copying backup to container: ${tempContainerPath}`);
        await container.putArchive(archive, { path: '/tmp' });

        // 3. Execute psql
        await logMessage('info', 'Executing psql restore...');
        const env = dbPassword ? [`PGPASSWORD=${dbPassword}`] : [];

        const exec = await container.exec({
            Cmd: ['psql', '-U', dbUser, '-d', dbName, '-f', tempContainerPath],
            AttachStdout: true,
            AttachStderr: true,
            Env: env
        });

        const stream = await exec.start();

        // Capture output
        const { PassThrough } = require('stream');
        const outputStream = new PassThrough();
        let outputData = '';
        outputStream.on('data', (chunk) => outputData += chunk.toString());

        container.modem.demuxStream(stream, outputStream, outputStream);

        await new Promise((resolve, reject) => {
            stream.on('end', async () => {
                if (outputData.trim()) {
                    await logMessage('info', `Restore output: ${outputData.slice(0, 200)}...`); // Log first 200 chars
                }

                // Check for common errors in output
                if (outputData.includes('FATAL') || outputData.includes('ERROR')) {
                    // We might want to be more specific, but for now log it
                    await logMessage('warn', 'Potential errors detected in restore output.');
                }

                resolve();
            });
            stream.on('error', reject);
        });

        // 4. Cleanup
        await container.exec({
            Cmd: ['rm', tempContainerPath]
        }).then(e => e.start()); // Fire and forget cleanup

    } else {
        // SQLite
        const dbPath = await getSetting('db_path') || '/home/node/.n8n/database.sqlite';
        const dbDir = path.dirname(dbPath);
        const dbFileName = path.basename(dbPath);

        await logMessage('info', `Restoring SQLite backup: ${backup.filename}`);

        const archiver = require('archiver');
        const archive = archiver('tar');
        archive.file(backup.path, { name: dbFileName });
        archive.finalize();

        await container.putArchive(archive, { path: dbDir });
    }

    await logMessage('info', 'Restore completed successfully');
};

const getBackupPath = async (id) => {
    const backup = await Backup.findByPk(id);
    if (!backup) throw new Error('Backup not found');
    return backup.path;
};

const registerUploadedBackup = async (file) => {
    const backup = await Backup.create({
        filename: file.filename,
        path: file.path,
        size: file.size,
        type: 'upload'
    });
    return backup;
};

const checkConnectionStatus = async () => {
    const status = {
        n8n: false,
        database: false
    };

    try {
        // 1. Check Database Container (Target Container)
        const containerName = await getSetting('n8n_container_name') || 'n8n';
        const container = docker.getContainer(containerName);

        try {
            const info = await container.inspect();
            status.database = info.State.Running;
        } catch (e) {
            status.database = false;
        }

        // 2. Check n8n Container (Smart Discovery)
        // We look for any running container with an image name containing "n8n"
        const containers = await docker.listContainers();
        const n8nContainer = containers.find(c => c.Image.includes('n8n'));
        status.n8n = !!n8nContainer;

    } catch (error) {
        console.error('Connection check failed:', error.message);
    }

    return status;
};

const toggleBackupProtection = async (id, isProtected) => {
    const backup = await Backup.findByPk(id);
    if (!backup) throw new Error('Backup not found');

    backup.isProtected = isProtected;
    await backup.save();

    await logMessage('info', `Backup ${backup.filename} protection ${isProtected ? 'enabled' : 'disabled'}`);
    return backup;
};

const uploadToS3 = async (filepath, filename) => {
    try {
        const enabled = await getSetting('aws_s3_enabled');
        if (enabled !== 'true') return;

        await logMessage('info', 'Uploading backup to S3...');

        const accessKeyId = await getSetting('aws_s3_access_key');
        const secretAccessKey = await getSetting('aws_s3_secret_key');
        const region = await getSetting('aws_s3_region');
        const bucket = await getSetting('aws_s3_bucket');
        const endpoint = await getSetting('aws_s3_endpoint');

        if (!accessKeyId || !secretAccessKey || !bucket || !region) {
            await logMessage('warn', 'S3 enabled but missing configuration. Skipping upload.');
            return;
        }

        const config = {
            region,
            credentials: { accessKeyId, secretAccessKey }
        };

        if (endpoint) {
            config.endpoint = endpoint;
            config.forcePathStyle = true; // Often needed for custom endpoints like MinIO
        }

        const s3Client = new S3Client(config);
        const fileStream = fs.createReadStream(filepath);

        await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: filename,
            Body: fileStream
        }));

        await logMessage('info', `Successfully uploaded ${filename} to S3 bucket ${bucket}`);

    } catch (error) {
        await logMessage('error', `Failed to upload to S3: ${error.message}`);
    }
};

module.exports = {
    createBackup,
    listBackups,
    deleteBackup,
    restoreBackup,
    getBackupPath,
    registerUploadedBackup,
    checkConnectionStatus,
    toggleBackupProtection
};
