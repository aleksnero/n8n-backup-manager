const fs = require('fs');
const fetch = require('node-fetch');

/**
 * Upload to OneDrive using Refresh Token Flow (Microsoft Graph API)
 */
const uploadToOneDrive = async (filepath, filename, credentials) => {
    try {
        let creds = credentials;

        // Robust JSON detection
        if (typeof credentials === 'string') {
            const trimmed = credentials.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                    creds = JSON.parse(trimmed);
                } catch (e) {
                    console.error('[OneDrive] JSON Parse failed, treating as raw token.');
                }
            } else {
                creds = trimmed;
            }
        }

        const accessToken = await refreshAccessToken(creds);

        const fileStats = fs.statSync(filepath);
        const fileSize = fileStats.size;
        const fileStream = fs.createReadStream(filepath);

        // Initiate Resumable Upload Session
        const uploadSessionRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/Backups/${filename}:/createUploadSession`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item: { "@microsoft.graph.conflictBehavior": "rename" }
            })
        });

        if (!uploadSessionRes.ok) {
            throw new Error(`OneDrive Session Error: ${await uploadSessionRes.text()}`);
        }

        const { uploadUrl } = await uploadSessionRes.json();

        // Upload file bytes
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Length': fileSize,
                'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`
            },
            body: fileStream
        });

        if (!uploadRes.ok) {
            throw new Error(`OneDrive Upload Error: ${await uploadRes.text()}`);
        }

        const result = await uploadRes.json();
        console.log(`[ONEDRIVE] Uploaded ${filename} (ID: ${result.id})`);
        return result;

    } catch (error) {
        console.error('[ONEDRIVE] Error:', error.message);
        throw error;
    }
};

const refreshAccessToken = async (credentials) => {
    let client_id = (process.env.MS_CLIENT_ID || '').trim();
    let client_secret = (process.env.MS_CLIENT_SECRET || '').trim();
    let refresh_token = '';

    if (typeof credentials === 'string') {
        refresh_token = credentials.trim();
    } else if (credentials && typeof credentials === 'object') {
        const rTok = credentials.refresh_token || credentials.refreshToken || credentials.token;
        const cId = credentials.client_id || credentials.clientId;
        const cSec = credentials.client_secret || credentials.clientSecret;

        if (rTok) refresh_token = rTok.trim();
        if (cId) client_id = cId.trim();
        if (cSec) client_secret = cSec.trim();
    }

    if (!client_id || !refresh_token) {
        throw new Error("OneDrive Configuration Error: Missing Client ID or Refresh Token.");
    }

    // Detect if this is an OAuth Authorization Code (M.C...)
    // Permanent tokens are very long (>1000 chars), Codes are short (~60-100 chars)
    const isAuthCode = refresh_token.startsWith('M.C') && refresh_token.length < 200;

    const params = new URLSearchParams();
    params.append('client_id', client_id);

    if (isAuthCode) {
        console.log(`[OneDrive] Detected Auth Code. Exchanging for permanent Refresh Token...`);
        params.append('grant_type', 'authorization_code');
        params.append('code', refresh_token);
        params.append('redirect_uri', 'https://developer.microsoft.com/en-us/graph/graph-explorer');
    } else {
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refresh_token);
        params.append('scope', 'Files.ReadWrite.All offline_access');
    }

    if (client_secret) {
        params.append('client_secret', client_secret);
    }

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: params.toString()
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(`[OneDrive Debug] Exchange Failed: ${data.error_description || data.error}`);
        throw new Error(`OneDrive API Error: ${data.error_description || JSON.stringify(data)}`);
    }

    // If we just exchanged a code, find the Refresh Token and print it clearly
    if (isAuthCode && data.refresh_token) {
        console.log('\n***************************************************');
        console.log('✅ ONEDRIVE SUCCESS! COPY YOUR PERMANENT REFRESH TOKEN:');
        console.log('---------------------------------------------------');
        console.log(data.refresh_token);
        console.log('---------------------------------------------------');
        console.log('***************************************************\n');
    }

    return data.access_token;
};

/**
 * Test connectivity by making a small metadata request
 */
const testOneDriveConnection = async (credentials) => {
    try {
        const accessToken = await refreshAccessToken(credentials);
        const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        return res.ok;
    } catch (e) {
        console.error('[ONEDRIVE] Connection test failed:', e.message);
        return false;
    }
};

module.exports = { uploadToOneDrive, testOneDriveConnection };
