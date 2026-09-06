const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const verifyToken = require('../middleware/auth');
const { startScheduler } = require('../services/scheduler');

router.get('/', verifyToken, async (req, res) => {
    try {
        const settings = await Settings.findAll();
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });
        // Inject app version
        settingsMap.version = require('../package.json').version;
        res.json(settingsMap);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const settingsData = req.body;
        for (const [key, value] of Object.entries(settingsData)) {
            await Settings.upsert({ key, value: String(value) });
        }

        // Restart scheduler to apply new backup schedule
        await startScheduler();
        console.log('Scheduler restarted with new settings');

        res.send({ message: 'Settings updated successfully!' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/update/mock', verifyToken, async (req, res) => {
    try {
        // This is a special endpoint to SIMULATE an update for testing purposes
        // It pretends there is an update available
        res.json({
            hasUpdate: true,
            currentVersion: require('../package.json').version,
            remoteVersion: '9.9.9', // Fake new version
            downloadUrl: 'MOCK_DOWNLOAD_Url',
            releaseNotes: 'This is a simulated update for testing UI.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/update/check', verifyToken, async (req, res) => {
    try {
        const updateService = require('../services/updateService');
        const result = await updateService.checkForUpdates();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/update/apply', verifyToken, async (req, res) => {
    try {
        const { downloadUrl } = req.body;
        if (!downloadUrl) return res.status(400).json({ error: 'Download URL required' });

        const updateService = require('../services/updateService');

        // If it's the mock URL, we don't actually download, just restart to validation
        if (downloadUrl === 'MOCK_DOWNLOAD_Url') {
            setTimeout(() => process.exit(0), 1000);
            return res.json({ success: true, message: 'Mock update applied. Restarting...' });
        }

        const zipPath = await updateService.downloadUpdate(downloadUrl);
        const result = await updateService.applyUpdate(zipPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/notify/test', verifyToken, async (req, res) => {
    try {
        const { notifyWebhook } = require('../services/notificationService');
        await notifyWebhook('backup_success', {
            filename: 'test-backup-2026-01-01.tar.gz',
            size: '12.34 MB'
        });
        res.json({ message: 'Test notification sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to send test notification: ' + error.message });
    }
});

router.post('/cloud/test', verifyToken, async (req, res) => {
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ ok: false, error: 'Provider is required' });

    try {
        if (provider === 'gdrive') {
            const clientId = (await Settings.findByPk('gdrive_client_id'))?.value;
            const clientSecret = (await Settings.findByPk('gdrive_client_secret'))?.value;
            const refreshToken = (await Settings.findByPk('gdrive_refresh_token'))?.value;

            if (!clientId || !clientSecret || !refreshToken) {
                return res.json({ ok: false, error: 'Missing Google Drive credentials (client_id, client_secret, or refresh_token)' });
            }

            const credentials = { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken };
            const { testGDriveConnection } = require('../services/cloud/googleDrive');
            const result = await testGDriveConnection(credentials);
            return res.json({ ok: result, error: result ? null : 'Connection test failed — check credentials' });
        }

        if (provider === 'onedrive') {
            const clientId = (await Settings.findByPk('onedrive_client_id'))?.value;
            const clientSecret = (await Settings.findByPk('onedrive_client_secret'))?.value;
            const refreshToken = (await Settings.findByPk('onedrive_refresh_token'))?.value;

            if (!refreshToken) {
                return res.json({ ok: false, error: 'Missing OneDrive refresh_token' });
            }

            const credentials = clientId && clientSecret
                ? { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }
                : refreshToken;

            const { testOneDriveConnection } = require('../services/cloud/oneDrive');
            const result = await testOneDriveConnection(credentials);
            return res.json({ ok: result, error: result ? null : 'Connection test failed — check credentials' });
        }

        if (provider === 's3') {
            const accessKeyId = (await Settings.findByPk('aws_s3_access_key'))?.value;
            const secretAccessKey = (await Settings.findByPk('aws_s3_secret_key'))?.value;
            const region = (await Settings.findByPk('aws_s3_region'))?.value;
            const bucket = (await Settings.findByPk('aws_s3_bucket'))?.value;
            const endpoint = (await Settings.findByPk('aws_s3_endpoint'))?.value;

            if (!accessKeyId || !secretAccessKey || !bucket || !region) {
                return res.json({ ok: false, error: 'Missing S3 credentials (access_key, secret_key, region, or bucket)' });
            }

            const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
            const config = { region, credentials: { accessKeyId, secretAccessKey } };
            if (endpoint) { config.endpoint = endpoint; config.forcePathStyle = true; }

            const s3Client = new S3Client(config);
            await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
            return res.json({ ok: true });
        }

        return res.status(400).json({ ok: false, error: `Unknown provider: ${provider}` });
    } catch (error) {
        console.error(`[CLOUD TEST] ${provider} error:`, error.message);
        return res.json({ ok: false, error: error.message });
    }
});

module.exports = router;
