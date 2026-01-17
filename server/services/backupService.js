const Docker = require('dockerode');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const Backup = require('../models/Backup');
const Settings = require('../models/Settings');
const Log = require('../models/Log');
const docker = new Docker();

const BACKUP_DIR = path.join(__dirname, '../../backups');
const ALGORITHM = 'aes-256-cbc';

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

const getEncryptionKey = async () => {
    const key = await getSetting('backup_encryption_key');
    if (!key) return null;
    // Ensure key is 32 bytes
    return crypto.scryptSync(key, 'salt', 32);
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
    const VERSION = '1.3.5';
    await logMessage('info', `Starting ${type} backup... (v${VERSION})`);

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        await logMessage('info', `Created backup directory: ${BACKUP_DIR}`);
    }

    const containerName = await getSetting('db_container_name') || await getSetting('n8n_container_name') || 'n8n';
    const dbType = await getSetting('db_type') || 'sqlite';
    const useCompression = (await getSetting('backup_compression')) === 'true';
    const useEncryption = (await getSetting('backup_encryption')) === 'true';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    await logMessage('info', `Container: ${containerName}, DB: ${dbType}`);
    if (useCompression) await logMessage('info', 'Compression enabled (Gzip)');
    if (useEncryption) await logMessage('info', 'Encryption enabled (AES-256)');

    try {
        let filename;
        let filepath;
        let outputStream; // The final stream writing to disk

        if (dbType === 'postgres') {
            const dbUser = await getSetting('db_user') || 'n8n';
            const dbPassword = await getSetting('db_password') || '';
            const dbName = await getSetting('db_name') || 'n8n';

            let ext = '.sql';
            if (useCompression) ext += '.gz';
            if (useEncryption) ext += '.enc';

            filename = `backup-${timestamp}${ext}`;
            filepath = path.join(BACKUP_DIR, filename);
            outputStream = fs.createWriteStream(filepath);

            await logMessage('info', `Creating PostgreSQL backup: ${filepath}`);

            const container = docker.getContainer(containerName);
            const env = dbPassword ? [`PGPASSWORD=${dbPassword}`] : [];

            const exec = await container.exec({
                Cmd: ['pg_dump', '-U', dbUser, '-d', dbName, '--clean', '--if-exists'],
                AttachStdout: true,
                AttachStderr: true,
                Env: env
            });

            const stream = await exec.start();

            // Demux docker stream
            const { PassThrough } = require('stream');
            const pgDumpStream = new PassThrough();
            const stderrStream = new PassThrough();
            let stderrData = '';
            stderrStream.on('data', (chunk) => stderrData += chunk.toString());

            container.modem.demuxStream(stream, pgDumpStream, stderrStream);

            // Chain streams
            let pipeline = pgDumpStream;

            if (useCompression) {
                pipeline = pipeline.pipe(zlib.createGzip());
            }

            if (useEncryption) {
                const key = await getEncryptionKey();
                if (!key) throw new Error('Encryption enabled but key not found');
                const iv = crypto.randomBytes(16);
                // Write IV to beginning of file
                outputStream.write(iv);
                const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
                pipeline = pipeline.pipe(cipher);
            }

            pipeline.pipe(outputStream);

            await new Promise((resolve, reject) => {
                stream.on('end', () => {
                    pgDumpStream.end();
                });
                outputStream.on('finish', async () => {
                    try {
                        const inspect = await exec.inspect();
                        if (inspect.ExitCode !== 0) {
                            // Cleanup partial file
                            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                            const errMsg = stderrData.trim() || `pg_dump failed with exit code ${inspect.ExitCode}`;
                            reject(new Error(errMsg));
                        } else {
                            if (stderrData.trim()) await logMessage('warn', `pg_dump warnings: ${stderrData}`);
                            resolve();
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
                stream.on('error', reject);
                pipeline.on('error', reject);
                outputStream.on('error', reject);
            });

        } else {
            // SQLite
            const dbPath = await getSetting('db_path') || '/home/node/.n8n/database.sqlite';

            // Determine filename based on extensions
            filename = `backup-${timestamp}.tar`;
            if (useCompression) filename += '.gz';
            if (useEncryption) filename += '.enc';

            filepath = path.join(BACKUP_DIR, filename);

            await logMessage('info', `Creating SQLite backup from ${dbPath} to ${filepath} (Compression: ${useCompression}, Encryption: ${useEncryption})`);

            const container = docker.getContainer(containerName);

            // Attempt Atomic Backup via sqlite3 CLI
            let sourcePath = dbPath;
            let isTemp = false;
            const tempDir = '/tmp/n8n_backup_atomic';
            const tempFile = `${tempDir}/database.sqlite`;

            try {
                // Try to create atomic copy using sqlite3 CLI
                // 1. mkdir
                await container.exec({ Cmd: ['mkdir', '-p', tempDir] }).then(e => e.start());

                // 2. sqlite3 .backup
                // We use sh -c to handle potential command finding or redurection if needed, but direct Exec is safest for args.
                // Assuming `sqlite3` is in PATH.
                const exec = await container.exec({
                    Cmd: ['sqlite3', dbPath, `.backup '${tempFile}'`],
                    AttachStdout: true,
                    AttachStderr: true
                });

                // We need to wait for it to finish and check exit code.
                const stream = await exec.start();
                // Check exit code? Dockerode exec start returns stream. To get exit code we inspect after stream ends.

                await new Promise((resolve, reject) => {
                    stream.on('end', resolve);
                    stream.on('error', reject);
                    stream.resume(); // consume stream
                });

                const inspect = await exec.inspect();
                if (inspect.ExitCode === 0) {
                    await logMessage('info', 'Successfully created atomic SQLite backup copy.');
                    sourcePath = tempFile;
                    isTemp = true;
                } else {
                    await logMessage('warn', `sqlite3 CLI failed (Exit ${inspect.ExitCode}), falling back to direct file copy. (This is normal if sqlite3 is not installed)`);
                }

            } catch (err) {
                await logMessage('warn', `Atomic backup attempt failed: ${err.message}. Falling back.`);
            }

            const stream = await container.getArchive({ path: sourcePath });

            // Prepare pipeline
            let pipeline = stream;

            if (useCompression) {
                pipeline = pipeline.pipe(zlib.createGzip());
            }

            if (useEncryption) {
                const key = await getEncryptionKey();
                if (!key) throw new Error('Encryption enabled but key not found');

                const iv = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

                const writeStream = fs.createWriteStream(filepath);
                // Write IV first
                writeStream.write(iv);

                const encryptedStream = pipeline.pipe(cipher);
                encryptedStream.pipe(writeStream);

                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });
            } else {
                // Just write
                const writeStream = fs.createWriteStream(filepath);
                pipeline.pipe(writeStream);

                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });
            }

            // Cleanup temp
            if (isTemp) {
                container.exec({ Cmd: ['rm', '-rf', tempDir] }).then(e => e.start()).catch(() => { });
            }
        }

        const stats = fs.statSync(filepath);

        await logMessage('info', `Backup created successfully: ${filename}, Size: ${stats.size} bytes`);

        const backup = await Backup.create({
            filename,
            path: filepath,
            size: stats.size,
            type,
            storageLocation: 'local'
        });

        // Attempt Generic Cloud Upload
        await uploadToCloud(filepath, filename, backup.id);

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

    if (backup.isProtected) {
        throw new Error('Cannot delete a protected backup. Disable protection first.');
    }

    if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
    }

    await backup.destroy();
};

const restoreBackup = async (id) => {
    const backup = await Backup.findByPk(id);
    if (!backup) throw new Error('Backup not found');

    const containerName = await getSetting('db_container_name') || await getSetting('n8n_container_name') || 'n8n';
    const dbType = await getSetting('db_type') || 'sqlite';
    const container = docker.getContainer(containerName);

    let readStream = fs.createReadStream(backup.path);
    let tempFilePath = null;

    try {
        // 1. Handle Decryption
        if (backup.filename.endsWith('.enc')) {
            await logMessage('info', 'Decrypting backup...');
            const key = await getEncryptionKey();
            if (!key) throw new Error('Cannot decrypt: Key not found in settings');

            // Read IV from first 16 bytes
            const FileReadForIV = fs.openSync(backup.path, 'r');
            const iv = Buffer.alloc(16);
            fs.readSync(FileReadForIV, iv, 0, 16, 0);
            fs.closeSync(FileReadForIV);

            // Create decoupled stream starting after IV
            const encryptedContentStream = fs.createReadStream(backup.path, { start: 16 });
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

            // We need to pipe to a temporary file OR keep piping in memory?
            // Piping in memory for restore is nice, but `pg_dump` restore expects a file inside the container usually?
            // Or we just pipe the output of decipher to the next stage.

            readStream = encryptedContentStream.pipe(decipher);
        }

        // 2. Handle Decompression
        if (backup.filename.includes('.gz')) {
            await logMessage('info', 'Decompressing backup...');
            readStream = readStream.pipe(zlib.createGunzip());
        }

        if (dbType === 'postgres') {
            const dbUser = await getSetting('db_user') || 'n8n';
            const dbName = await getSetting('db_name') || 'n8n';
            const dbPassword = await getSetting('db_password') || '';

            await logMessage('info', `Restoring PostgreSQL backup: ${backup.filename}`);

            // We need a file inside the container for `psql -f`. 
            // So we must stream the processed content (decrypted/gunzipped) to a buffer or temp file and then `putArchive`.
            // Docker's `putArchive` expects a TAR stream containing the file.

            const tempFileName = `restore-${Date.now()}.sql`;
            const archiver = require('archiver');
            const archive = archiver('tar');

            archive.append(readStream, { name: tempFileName });
            archive.finalize();

            await logMessage('info', `Copying stream to container as ${tempFileName}...`);
            await container.putArchive(archive, { path: '/tmp' });

            // Execute psql
            await logMessage('info', 'Executing psql restore...');
            const env = dbPassword ? [`PGPASSWORD=${dbPassword}`] : [];

            // Give it a moment to sync file system?
            await new Promise(r => setTimeout(r, 1000));

            const exec = await container.exec({
                Cmd: ['psql', '-U', dbUser, '-d', dbName, '-f', `/tmp/${tempFileName}`],
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
                        // Filter out "SET" "ALTER" noise if too long?
                        await logMessage('info', `Restore processed.`);
                    }
                    // Cleanup
                    await container.exec({ Cmd: ['rm', `/tmp/${tempFileName}`] }).then(e => e.start());
                    resolve();
                });
                stream.on('error', reject);
            });

        } else {
            // SQLite
            // If it was .tar.gz or .tar.gz.enc, we have now decompressed it to a tar stream.
            // If the original was just .tar (uncompressed), we just have the stream.
            // But wait, `readStream` is now the content.
            // If the original backup of SQLite was made via `container.getArchive`, it IS a tar file.
            // So if we gunzip/decrypt it, we are left with a TAR stream. 
            // `container.putArchive` EXPECTS a tar stream.

            // Check if we need to re-tar? 
            // When we created backup: `container.getArchive` -> (optional gzip) -> (optional encrypt) -> file
            // Restore: file -> (optional decrypt) -> (optional gunzip) -> TAR STREAM

            // BUT: `container.getArchive` returns a tarball containing the file with full path or relative?
            // Usually it preserves the path structure requested.
            // If we restore it to the root '/' it might try to overwrite /home/node/...

            const dbPath = await getSetting('db_path') || '/home/node/.n8n/database.sqlite';
            const dbDir = path.dirname(dbPath);

            await logMessage('info', `Restoring SQLite backup to ${dbDir}`);

            // If we simply pipe the TAR stream to putArchive, it should extract relative to `path`.
            // But `getArchive` usually creates a tar with the file at the top level?

            // Let's assume the tar structure is correct for now as it's just a reverse of creation.
            // However, `readStream` might not be a valid node-stream if it comes from fs directly without pipe? 
            // It is.

            await container.putArchive(readStream, { path: dbDir });
        }

        await logMessage('info', 'Restore completed successfully');

    } catch (error) {
        await logMessage('error', `Restore failed: ${error.message}`);
        console.error(error);
        throw error;
    }
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
        database: false,
        gdrive: false,
        onedrive: false
    };

    try {
        // 1. Check n8n Container
        const n8nName = await getSetting('n8n_container_name');
        if (n8nName) {
            try {
                const containers = await docker.listContainers();
                // Docker container names in the API usually start with /
                const namedContainer = containers.find(c =>
                    c.Names.some(n => n === `/${n8nName}` || n === n8nName)
                );

                if (namedContainer) {
                    status.n8n = namedContainer.State === 'running';
                } else {
                    status.n8n = false;
                }
            } catch (dockerError) {
                try {
                    const n8nPort = 5678;
                    status.n8n = await testHttpConnection(n8nName, n8nPort);
                } catch (e) {
                    status.n8n = false;
                }
            }
        } else {
            status.n8n = false;
        }

        // 2. Check Database Connection
        const dbType = await getSetting('db_type') || 'sqlite';

        if (dbType === 'postgres') {
            const dbHost = await getSetting('db_container_name') || await getSetting('n8n_container_name');
            const dbPort = parseInt(await getSetting('db_port')) || 5432;

            if (dbHost) {
                // Try TCP first
                status.database = await testDatabaseConnection(dbHost, dbPort);

                // Fallback: If TCP fails, check if the container is at least running via Docker API
                if (!status.database) {
                    try {
                        const containers = await docker.listContainers();
                        const dbCont = containers.find(c =>
                            c.Names.some(n => n === `/${dbHost}` || n === dbHost)
                        );
                        if (dbCont) {
                            status.database = dbCont.State === 'running';
                        }
                    } catch (e) {
                        status.database = false;
                    }
                }
            } else {
                status.database = false;
            }
        } else {
            // For SQLite, database status is tied to n8n container status
            status.database = status.n8n;
        }

        // 3. Check Google Drive connectivity
        const s3Enabled = await getSetting('aws_s3_enabled') === 'true';
        const provider = await getSetting('cloud_provider') || 's3';

        if (s3Enabled && provider === 'gdrive') {
            try {
                const credsStr = await getSetting('google_drive_credentials');
                if (credsStr) {
                    const credentials = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
                    if (credentials.client_email || credentials.client_id) {
                        const { testGDriveConnection } = require('./cloud/googleDrive');
                        status.gdrive = await testGDriveConnection(credentials);
                    }
                }
            } catch (e) {
                status.gdrive = false;
            }
        }

        // 4. Check OneDrive connectivity
        if (s3Enabled && provider === 'onedrive') {
            try {
                const refreshToken = await getSetting('onedrive_refresh_token');
                if (refreshToken && refreshToken.length > 50) {
                    const { testOneDriveConnection } = require('./cloud/oneDrive');
                    status.onedrive = await testOneDriveConnection(refreshToken);
                }
            } catch (e) {
                status.onedrive = false;
            }
        }

    } catch (error) {
        console.error('Connection check failed:', error.message);
    }

    return status;
};

// Helper function to test database connection
const testDatabaseConnection = (host, port) => {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();

        const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, 3000);

        socket.connect(port, host, () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
};

// Helper function to test HTTP connection
const testHttpConnection = (host, port) => {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();

        const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, 3000);

        socket.connect(port, host, () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
};

const toggleBackupProtection = async (id, isProtected) => {
    const backup = await Backup.findByPk(id);
    if (!backup) throw new Error('Backup not found');

    backup.isProtected = isProtected;
    await backup.save();

    await logMessage('info', `Backup ${backup.filename} protection ${isProtected ? 'enabled' : 'disabled'}`);
    return backup;
};

// Helper function for S3 upload, extracted from original uploadToCloud
const uploadToS3 = async (filepath, filename) => {
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
        config.forcePathStyle = true;
    }

    const s3Client = new S3Client(config);
    const fileStream = fs.createReadStream(filepath);

    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: fileStream
    }));

    await logMessage('info', `Successfully uploaded ${filename} to S3 bucket ${bucket}`);
};

const uploadToCloud = async (filepath, filename, backupId) => {
    const cloudEnabled = await getSetting('aws_s3_enabled') === 'true'; // Legacy key name, but now means "cloud backups enabled"
    if (!cloudEnabled) return;

    const provider = await getSetting('cloud_provider') || 's3';

    try {
        await logMessage('info', `Uploading backup to cloud provider: ${provider}...`);

        if (provider === 'gdrive') {
            const credsStr = await getSetting('google_drive_credentials');
            const folderId = (await getSetting('google_drive_folder_id') || '').trim();
            if (!credsStr) {
                await logMessage('warn', 'Google Drive enabled but credentials missing.');
                return;
            }
            let credentials;
            try {
                credentials = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
            } catch (e) {
                await logMessage('error', `Failed to parse Google Drive credentials: ${e.message}`);
                return;
            }
            const { uploadToGoogleDrive } = require('./cloud/googleDrive');
            await uploadToGoogleDrive(filepath, filename, credentials, folderId);

            // Update storage location
            if (backupId) {
                const backup = await Backup.findByPk(backupId);
                if (backup) {
                    backup.storageLocation = backup.storageLocation === 'local' ? 'gdrive' : `${backup.storageLocation},gdrive`;
                    await backup.save();
                }
            }

        } else if (provider === 'onedrive') {
            const refreshToken = await getSetting('onedrive_refresh_token');
            if (!refreshToken) {
                await logMessage('warn', 'OneDrive enabled but refresh token missing.');
                return;
            }
            const { uploadToOneDrive } = require('./cloud/oneDrive');
            await uploadToOneDrive(filepath, filename, refreshToken);

            // Update storage location
            if (backupId) {
                const backup = await Backup.findByPk(backupId);
                if (backup) {
                    backup.storageLocation = backup.storageLocation === 'local' ? 'onedrive' : `${backup.storageLocation},onedrive`;
                    await backup.save();
                }
            }

        } else {
            // S3 Default
            const accessKeyId = await getSetting('aws_s3_access_key');
            const secretAccessKey = await getSetting('aws_s3_secret_key');
            const region = await getSetting('aws_s3_region');
            const bucket = await getSetting('aws_s3_bucket');
            const endpoint = await getSetting('aws_s3_endpoint');

            if (!accessKeyId || !secretAccessKey || !bucket || !region) {
                await logMessage('warn', 'S3 provider selected but missing configuration. Skipping upload.');
                return;
            }

            const config = {
                region,
                credentials: { accessKeyId, secretAccessKey }
            };

            if (endpoint) {
                config.endpoint = endpoint;
                config.forcePathStyle = true;
            }

            const s3Client = new S3Client(config);
            const fileStream = fs.createReadStream(filepath);

            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: filename,
                Body: fileStream
            }));

            await logMessage('info', `Successfully uploaded ${filename} to S3 bucket ${bucket}`);

            // Update storage location
            if (backupId) {
                const backup = await Backup.findByPk(backupId);
                if (backup) {
                    backup.storageLocation = backup.storageLocation === 'local' ? 's3' : `${backup.storageLocation},s3`;
                    await backup.save();
                }
            }
        }

    } catch (error) {
        await logMessage('error', `Failed to upload to Cloud (${error.message})`);
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
