const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const semver = require('semver');

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

            // Backup critical files
            const filesToBackup = [
                'server/package.json',
                'server/index.js',
                'server/database.js',
                'data' // Include database
            ];

            filesToBackup.forEach(file => {
                const fullPath = path.join(rootDir, file);
                if (fs.existsSync(fullPath)) {
                    if (fs.statSync(fullPath).isDirectory()) {
                        zip.addLocalFolder(fullPath, file);
                    } else {
                        zip.addLocalFile(fullPath, path.dirname(file));
                    }
                }
            });

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
            updateZip.extractAllTo(rootDir, true); // overwrite = true

            console.log('Update extracted successfully.');

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
    async rollback() {
        try {
            const backupDir = path.join(__dirname, '..', 'backups', 'pre_update_backups');

            if (!fs.existsSync(backupDir)) {
                throw new Error('No backup directory found');
            }

            // Get the most recent backup
            const backups = fs.readdirSync(backupDir)
                .filter(file => file.startsWith('backup_v') && file.endsWith('.zip'))
                .sort()
                .reverse();

            if (backups.length === 0) {
                throw new Error('No backups available for rollback');
            }

            const latestBackup = path.join(backupDir, backups[0]);
            console.log(`Rolling back to: ${backups[0]}`);

            const rootDir = path.join(__dirname, '..');
            const zip = new AdmZip(latestBackup);
            zip.extractAllTo(rootDir, true);

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
                    const match = file.match(/backup_v(.+)_(\d+)\.zip/);
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

        } catch (error) {
            console.error('Failed to get update history:', error);
            return [];
        }
    }
}

module.exports = new UpdateService();
