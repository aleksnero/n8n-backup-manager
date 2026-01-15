/**
 * Secure Update Manager for n8n-backup-manager
 * Validates download URLs and manages safe updates
 */

class UpdateValidator {
    constructor() {
        this.allowedDomain = 'https://github.com/aleksnero/n8n-backup-manager/';
        this.versionJsonUrl = 'https://raw.githubusercontent.com/aleksnero/n8n-backup-manager/main/version.json';
    }

    /**
     * Validates if a download URL is from the trusted source
     * @param {string} url - The download URL to validate
     * @returns {boolean} - True if URL is valid
     */
    isValidDownloadUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        // Must be from the correct GitHub repository
        if (!url.startsWith(this.allowedDomain)) {
            return false;
        }

        // Must use HTTPS
        if (!url.startsWith('https://')) {
            return false;
        }

        // Security: Prevent directory traversal attacks
        if (url.includes('../') || url.includes('..\\') || url.includes('//')) {
            return false;
        }

        return true;
    }

    /**
     * Fetches and validates the version.json file
     * @returns {Promise<Object>} - Parsed and validated version info
     */
    async fetchAndValidateVersionJson() {
        try {
            const response = await fetch(this.versionJsonUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch version.json: ${response.status} ${response.statusText}`);
            }

            const versionJson = await response.json();
            
            // Validate required fields exist in version.json
            if (!versionJson.version || !versionJson.downloadUrl) {
                throw new Error('Invalid version.json: missing required fields (version, downloadUrl)');
            }

            // Validate download URL security
            if (!this.isValidDownloadUrl(versionJson.downloadUrl)) {
                throw new Error(`Security violation: Invalid download URL in version.json. Must start with: ${this.allowedDomain}`);
            }

            return versionJson;

        } catch (error) {
            console.error('Failed to fetch or validate version.json:', error);
            throw error;
        }
    }

    /**
     * Validates semantic version format
     * @param {string} version - Version string
     * @returns {boolean} - True if format is valid
     */
    isValidVersionFormat(version) {
        const semverRegex = /^v?\d+\.\d+\.\d+(-\w+)?(\.\d+)?$/;
        return semverRegex.test(version);
    }

    /**
     * Compares two version strings
     * @param {string} currentVersion - Current version
     * @param {string} newVersion - New version
     * @returns {number} - 1 if newVersion > currentVersion, -1 if less, 0 if equal
     */
    compareVersions(currentVersion, newVersion) {
        const cleanCurrent = currentVersion.replace(/^v/, '');
        const cleanNew = newVersion.replace(/^v/, '');

        const currentParts = cleanCurrent.split('.').map(Number);
        const newParts = cleanNew.split('.').map(Number);

        while (currentParts.length < 3) currentParts.push(0);
        while (newParts.length < 3) newParts.push(0);

        for (let i = 0; i < 3; i++) {
            if (newParts[i] > currentParts[i]) return 1;
            if (newParts[i] < currentParts[i]) return -1;
        }
        return 0;
    }

    /**
     * Checks if an update is needed by fetching version.json
     * @param {string} currentVersion - Current app version
     * @returns {Promise<Object>} - Update info
     */
    async checkForUpdate(currentVersion) {
        try {
            const versionJson = await this.fetchAndValidateVersionJson();

            const comparison = this.compareVersions(currentVersion, versionJson.version);
            
            if (comparison === 1) {
                return {
                    available: true,
                    currentVersion,
                    newVersion: versionJson.version,
                    downloadUrl: versionJson.downloadUrl,
                    changelog: versionJson.changelog || '',
                    releaseDate: versionJson.releaseDate,
                    requiresRestart: versionJson.requiresRestart || false
                };
            } else if (comparison === 0) {
                return {
                    available: false,
                    currentVersion,
                    latestVersion: versionJson.version,
                    isLatest: true
                };
            } else {
                return {
                    available: false,
                    currentVersion,
                    latestVersion: versionJson.version,
                    isDevelopment: true
                };
            }

        } catch (error) {
            console.error('Update check failed:', error);
            return {
                available: false,
                error: error.message,
                currentVersion,
                failed: true
            };
        }
    }

    /**
     * Downloads the update securely after validating version.json
     * @param {string} downloadUrl - Validated download URL from version.json
     * @returns {Promise<Response>} - Fetch response
     */
    async downloadUpdate(downloadUrl) {
        if (!this.isValidDownloadUrl(downloadUrl)) {
            throw new Error('Security violation: Cannot download - URL validation failed');
        }

        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    /**
     * Full update process with version.json validation
     * @param {string} currentVersion - Current app version
     * @returns {Promise<Object>} - Update result
     */
    async performSafeUpdate(currentVersion) {
        try {
            const updateInfo = await this.checkForUpdate(currentVersion);
            
            if (updateInfo.failed) {
                throw new Error(`Failed to check for updates: ${updateInfo.error}`);
            }
            
            if (!updateInfo.available) {
                return {
                    success: false,
                    message: 'No update available',
                    info: updateInfo
                };
            }

            const downloadResponse = await this.downloadUpdate(updateInfo.downloadUrl);
            
            const contentLength = downloadResponse.headers.get('content-length');
            
            return {
                success: true,
                message: `Update ${updateInfo.newVersion} downloaded successfully`,
                version: updateInfo.newVersion,
                downloadSize: contentLength ? `${Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100} MB` : 'Unknown',
                requiresRestart: updateInfo.requiresRestart || false,
                changelog: updateInfo.changelog
            };

        } catch (error) {
            console.error('Safe update process failed:', error);
            return {
                success: false,
                error: error.message,
                message: 'Update failed - security validation or download error'
            };
        }
    }
}

// Export for use in your application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpdateValidator;
}