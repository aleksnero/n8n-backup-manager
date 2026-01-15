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
            throw new Error(`Failed to upload file content to GDrive: ${err}`);
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

module.exports = { uploadToGoogleDrive };
