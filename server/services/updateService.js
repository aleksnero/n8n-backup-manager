const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const semver = require('semver');
const { execSync } = require('child_process');

const CURRENT_VERSION = require('../package.json').version;
const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || 'https://raw.githubusercontent.com/aleksnero/n8n-backup-manager/main/version.json';

class UpdateService {
    /**
     * Check for updates from the remote server
     */
    async checkForUpdates() {
        try {
            console.log(`Checking for updates from: ${UPDATE_SERVER_URL}`);

            const response = await fetch(UPDATE_SERVER_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch update info: ${response.statusText}`);
            }

            const remoteInfo = await response.json();
            const remoteVersion = remoteInfo.version;

            // Use semver for proper version comparison
            if (semver.gt(remoteVersion, CURRENT_VERSION)) {
                return {
                    hasUpdate: true,
                    currentVersion: CURRENT_VERSION,
                    remoteVersion: remoteVersion,
                    downloadUrl: remoteInfo.downloadUrl,
                    releaseNotes: remoteInfo.releaseNotes,
                    releaseDate: remoteInfo.releaseDate,
                    changelog: remoteInfo.changelog
                };
            }

            return {
                hasUpdate: false,
                currentVersion: CURRENT_VERSION,
                message: 'You are running the latest version'
            };

        } catch (error) {
            console.error('Update check failed:', error);
            return {
                hasUpdate: false,
                currentVersion: CURRENT_VERSION,
                error: error.message
            };
        }
    }

    /**
     * Download the update zip file
     */
    async downloadUpdate(downloadUrl) {
        try {
            // Security validation: only allow downloads from official repo
            if (!downloadUrl.startsWith('https://github.com/aleksnero/n8n-backup-manager/')) {
                throw new Error('Invalid download URL. Updates are only allowed from the official GitHub repository.');
            }

            console.log(`Downloading update from: ${downloadUrl}`);
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`Failed to download update: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const tempPath = path.join(__dirname, '..', 'temp_update.zip');
            fs.writeFileSync(tempPath, buffer);

            console.log('Update downloaded successfully');
            return tempPath;
        } catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    }

    /**
     * Create a backup before applying update
     */
    async createPreUpdateBackup() {
        try {
            const rootDir = path.join(__dirname, '..');
            const backupDir = path.join(rootDir, 'backups', 'pre_update_backups');

            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const backupName = `backup_v${CURRENT_VERSION}_${Date.now()}.zip`;
            const backupPath = path.join(backupDir, backupName);

            const zip = new AdmZip();

            // Determine the actual project root and files to backup
            // In Docker, we are in /app/services, root is /app, files are package.json, index.js...
            // In Local, we are in server/services, root is server, files might be in . or ../
            const filesToBackup = [];

            // Files relative to rootDir
            const potentialFiles = [
                'package.json',
                'index.js',
                'database.js',
                'version.json',
                'CHANGELOG.md',
                'README.md',
                'server/package.json',
                'server/index.js',
                'server/database.js',
                'routes',
                'services',
                'models',
                'middleware',
                'public',
                'data',
                'server/routes',
                'server/services',
                'server/models',
                'server/middleware',
                'server/public',
                'server/data'
            ];

            potentialFiles.forEach(file => {
                const fullPath = path.join(rootDir, file);
                if (fs.existsSync(fullPath)) {
                    // Extract the destination path (remove any leading server/ for the zip)
                    const zipPath = file.startsWith('server/') ? file.substring(7) : file;

                    if (fs.statSync(fullPath).isDirectory()) {
                        zip.addLocalFolder(fullPath, zipPath);
                    } else {
                        // For files, we need to ensure the parent folder exists in the zip if needed
                        const zipDir = path.dirname(zipPath);
                        zip.addLocalFile(fullPath, zipDir === '.' ? '' : zipDir);
                    }
                    filesToBackup.push(file);
                }
            });

            if (filesToBackup.length === 0) {
                throw new Error('No files found to backup');
            }

            zip.writeZip(backupPath);
            console.log(`Pre-update backup created: ${backupName}`);

            return backupPath;
        } catch (error) {
            console.error('Backup creation failed:', error);
            throw error;
        }
    }

    /**
     * Apply the update: unzip and restart
     */
    async applyUpdate(zipFilePath) {
        try {
            console.log('Applying update...');
            const rootDir = path.join(__dirname, '..');

            // 1. Create backup of current state
            await this.createPreUpdateBackup();

            // 2. Extract new files
            const updateZip = new AdmZip(zipFilePath);
            const entries = updateZip.getEntries();
            const hasServerFolder = entries.some(e => e.entryName.startsWith('server/'));

            // In Docker, package.json is in rootDir (/app)
            const isFlatEnv = fs.existsSync(path.join(rootDir, 'package.json'));

            try {
                if (isFlatEnv && hasServerFolder) {
                    console.log('Detected flat environment and nested update. Flattening extraction...');
                    entries.forEach(entry => {
                        let targetName = entry.entryName;
                        if (targetName.startsWith('server/')) {
                            targetName = targetName.substring(7); // Remove 'server/' prefix
                        }
                        if (targetName) {
                            const targetPath = path.join(rootDir, targetName);
                            if (entry.isDirectory) {
                                if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
                            } else {
                                const dir = path.dirname(targetPath);
                                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                                fs.writeFileSync(targetPath, entry.getData());
                            }
                        }
                    });
                } else {
                    updateZip.extractAllTo(rootDir, true);
                }

                console.log('Update extracted successfully.');

                // 2.5 Install new dependencies if they exist
                try {
                    console.log('Installing new dependencies...');
                    execSync('npm install --production --no-audit --no-fund', {
                        cwd: rootDir,
                        stdio: 'inherit'
                    });
                    console.log('Dependencies installed successfully.');
                } catch (installError) {
                    console.error('Failed to install dependencies:', installError);
                }
            } catch (extractError) {
                console.error('Extraction failed:', extractError);
                throw new Error(`Extraction failed: ${extractError.message}`);
            }

            // 3. Clean up
            fs.unlinkSync(zipFilePath);

            // 4. Restart process
            console.log('Restarting server to apply changes...');
            setTimeout(() => {
                process.exit(0);
            }, 1000);

            return { success: true, message: 'Update applied. Server restarting...' };

        } catch (error) {
            console.error('Apply update failed:', error);
            throw error;
        }
    }

    /**
     * Rollback to previous version
     */
    async rollback(filename = null) {
        try {
            const backupDir = path.join(__dirname, '..', 'backups', 'pre_update_backups');

            if (!fs.existsSync(backupDir)) {
                throw new Error('No backup directory found');
            }

            let backupToUse;
            if (filename) {
                backupToUse = filename;
            } else {
                // Get the most recent backup
                const backups = fs.readdirSync(backupDir)
                    .filter(file => file.startsWith('backup_v') && file.endsWith('.zip'))
                    .sort()
                    .reverse();

                if (backups.length === 0) {
                    throw new Error('No backups available for rollback');
                }
                backupToUse = backups[0];
            }

            const backupPath = path.join(backupDir, backupToUse);
            if (!fs.existsSync(backupPath)) {
                throw new Error('Specified backup file not found');
            }

            console.log(`Rolling back to: ${backupToUse}`);

            const rootDir = path.join(__dirname, '..');
            const zip = new AdmZip(backupPath);

            // Check if all entries start with 'server/' or if it's a mix
            // If it's a mix but includes 'server/', we might need to extract carefully
            const entries = zip.getEntries();
            const hasServerFolder = entries.some(e => e.entryName.startsWith('server/'));

            // If the current environment is flat (Docker) but zip has server folder, flatten it
            // We can detect flat environment if package.json is in rootDir
            const isFlatEnv = fs.existsSync(path.join(rootDir, 'package.json')) && !fs.existsSync(path.join(rootDir, 'server', 'package.json'));

            if (isFlatEnv && hasServerFolder) {
                console.log('Detected flat environment and nested backup. Flattening extraction...');
                entries.forEach(entry => {
                    let targetName = entry.entryName;
                    if (targetName.startsWith('server/')) {
                        targetName = targetName.substring(7);
                    }
                    if (targetName) {
                        const targetPath = path.join(rootDir, targetName);
                        if (entry.isDirectory) {
                            if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
                        } else {
                            const dir = path.dirname(targetPath);
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                            fs.writeFileSync(targetPath, entry.getData());
                        }
                    }
                });
            } else {
                zip.extractAllTo(rootDir, true);
            }

            console.log('Rollback successful. Restarting server...');
            setTimeout(() => {
                process.exit(0);
            }, 1000);

            return { success: true, message: 'Rollback successful. Server restarting...' };

        } catch (error) {
            console.error('Rollback failed:', error);
            throw error;
        }
    }

    /**
     * Get path for an update backup file
     */
    getUpdateBackupPath(filename) {
        const backupDir = path.join(__dirname, '..', 'backups', 'pre_update_backups');
        const filePath = path.resolve(backupDir, filename);

        // Security check: ensure file is within backupDir
        if (!filePath.startsWith(backupDir)) {
            throw new Error('Unauthorized access');
        }

        return filePath;
    }

    /**
     * Get update history
     */
    async getUpdateHistory() {
        try {
            const backupDir = path.join(__dirname, '..', 'backups', 'pre_update_backups');

            if (!fs.existsSync(backupDir)) {
                return [];
            }

            const backups = fs.readdirSync(backupDir)
                .filter(file => file.startsWith('backup_v') && file.endsWith('.zip'))
                .map(file => {
                    const stats = fs.statSync(path.join(backupDir, file));
                    // Improved regex to handle backup_v1.2.2.zip or backup_v1.2.2_1767472730511.zip
                    const match = file.match(/backup_v([\d\.]+)(?:_(\d+))?\.zip/);
                    return {
                        filename: file,
                        version: match ? match[1] : 'unknown',
                        timestamp: match ? parseInt(match[2]) : stats.mtimeMs,
                        size: stats.size,
                        date: new Date(stats.mtime)
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp);

            return backups;

            return backups;

        } catch (error) {
            console.error('Failed to get update history:', error);
            return [];
        }
    }

    /**
     * Delete update history item
     */
    async deleteUpdateHistoryItem(filename) {
        try {
            const filePath = path.join(__dirname, '..', 'backups', 'pre_update_backups', filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true, message: 'File deleted successfully' };
            } else {
                throw new Error('File not found');
            }
        } catch (error) {
            console.error('Failed to delete history item:', error);
            throw error;
        }
    }
}

module.exports = new UpdateService();
