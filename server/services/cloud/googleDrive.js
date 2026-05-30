const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken'); // Already in package.json
const fetch = require('node-fetch'); // Already in package.json

/**
 * Upload details to Google Drive using Service Account
 * @param {string} filepath - Path to the file to upload
 * @param {string} filename - Name of the file
 * @param {object} credentials - Service Account JSON object
 * @param {string} folderId - (Optional) Folder ID to upload to
 */
const uploadToGoogleDrive = async (filepath, filename, credentials, folderId) => {
    try {
        const token = await getAccessToken(credentials);

        const fileStats = fs.statSync(filepath);
        const fileSize = fileStats.size;

        // 1. Initiate Resumable Upload
        if (!folderId) {
            throw new Error('Google Drive Folder ID is REQUIRED. Service Accounts cannot upload to root without storage quota. Please share a folder with the Service Account and enter its ID in settings.');
        }
        console.log(`[GDRIVE] Starting upload. Folder ID: ${folderId}`);
        const metadata = {
            name: filename,
            parents: folderId ? [folderId] : []
        };

        const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!initRes.ok) {
            const err = await initRes.text();
            throw new Error(`Failed to initiate GDrive upload: ${err}`);
        }

        const location = initRes.headers.get('Location');

        // 2. Upload File Content
        const fileStream = fs.createReadStream(filepath);

        const uploadRes = await fetch(location, {
            method: 'PUT',
            headers: {
                'Content-Length': fileSize
            },
            body: fileStream
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.text();
            let errorMessage = `Failed to upload file content to GDrive: ${err}`;

            if (err.includes('storageQuotaExceeded') || err.includes('Service Accounts do not have storage quota')) {
                errorMessage = 'Google Drive Error: Service Accounts have 0 quota in personal accounts. ' +
                    'FIX: 1. Use a "Shared Drive" (Спільний диск) and share it with the Service Account email. ' +
                    '2. OR use OAuth2 credentials (client_id, client_secret, refresh_token) instead of a Service Account. ' +
                    '3. OR use OneDrive which handles personal accounts better.';
            }

            throw new Error(errorMessage);
        }

        const result = await uploadRes.json();
        console.log(`[GDRIVE] Uploaded ${filename} (ID: ${result.id})`);
        return result;

    } catch (error) {
        console.error('[GDRIVE] Error:', error.message);
        throw error;
    }
};

/**
 * Get Access Token from Service Account credentials
 */
const getAccessToken = async (credentials) => {
    // Check if OAuth2 Credentials
    if (credentials.refresh_token && credentials.client_id) {
        return getAccessTokenFromRefreshToken(credentials);
    }

    const { client_email, private_key } = credentials;

    // Service Account Flow
    const key = private_key;
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: client_email,
        scope: 'https://www.googleapis.com/auth/drive.file',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const token = jwt.sign(payload, key, { algorithm: 'RS256' });

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get Access Token from Service Account: ${err}`);
    }

    const data = await res.json();
    return data.access_token;
};

const getAccessTokenFromRefreshToken = async (credentials) => {
    const client_id = credentials.client_id ? credentials.client_id.trim() : '';
    const client_secret = credentials.client_secret ? credentials.client_secret.trim() : '';
    const refresh_token = credentials.refresh_token ? credentials.refresh_token.trim() : '';

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id,
            client_secret,
            refresh_token,
            grant_type: 'refresh_token'
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to refresh OAuth2 token: ${err}`);
    }

    const data = await res.json();
    return data.access_token;
};

/**
 * Test connectivity by making a small metadata request
 */
const testGDriveConnection = async (credentials) => {
    try {
        const token = await getAccessToken(credentials);
        const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.ok;
    } catch (e) {
        console.error('[GDRIVE] Connection test failed:', e.message);
        return false;
    }
};


const deleteFromGoogleDrive = async (filename, credentials, folderId) => {
    try {
        const token = await getAccessToken(credentials);

        if (!folderId) {
            throw new Error('Google Drive Folder ID is REQUIRED.');
        }

        const query = encodeURIComponent(`name = '${filename}' and '${folderId}' in parents and trashed = false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!searchRes.ok) {
            const err = await searchRes.text();
            throw new Error(`Failed to search for file in GDrive: ${err}`);
        }

        const { files } = await searchRes.json();
        if (!files || files.length === 0) {
            console.log(`[GDRIVE] File ${filename} not found, skipping deletion.`);
            return;
        }

        const fileId = files[0].id;
        const deleteRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deleteRes.ok) {
            const err = await deleteRes.text();
            throw new Error(`Failed to delete file from GDrive: ${err}`);
        }

        console.log(`[GDRIVE] Deleted ${filename} (ID: ${fileId})`);
    } catch (error) {
        console.error('[GDRIVE] Deletion error:', error.message);
        throw error;
    }
};

module.exports = { uploadToGoogleDrive, testGDriveConnection, deleteFromGoogleDrive };
