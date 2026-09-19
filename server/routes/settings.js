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
        if (settingsMap.auto_integrity_check === undefined) {
            settingsMap.auto_integrity_check = 'true';
        }
        if (settingsMap.enable_news_feed === undefined) {
            settingsMap.enable_news_feed = 'true';
        }

        // Синхронізація статусу хмари: storage_location ('cloud' | 'local') та aws_s3_enabled ('true' | 'false')
        const isCloudEnabled = settingsMap.storage_location === 'cloud' || settingsMap.aws_s3_enabled === 'true';
        settingsMap.storage_location = isCloudEnabled ? 'cloud' : 'local';
        settingsMap.aws_s3_enabled = isCloudEnabled ? 'true' : 'false';

        // Якщо в БД збережено google_drive_credentials як OAuth2 JSON, заповнюємо окремі поля для зручності UI
        if (settingsMap.google_drive_credentials) {
            try {
                const parsed = JSON.parse(settingsMap.google_drive_credentials);
                if (parsed.client_id && !settingsMap.gdrive_client_id) settingsMap.gdrive_client_id = parsed.client_id;
                if (parsed.client_secret && !settingsMap.gdrive_client_secret) settingsMap.gdrive_client_secret = parsed.client_secret;
                if (parsed.refresh_token && !settingsMap.gdrive_refresh_token) settingsMap.gdrive_refresh_token = parsed.refresh_token;
            } catch (_) {}
        }
        if (settingsMap.google_drive_folder_id && !settingsMap.gdrive_folder_id) {
            settingsMap.gdrive_folder_id = settingsMap.google_drive_folder_id;
        }

        // Якщо onedrive_refresh_token містить JSON з client_id
        if (settingsMap.onedrive_refresh_token && typeof settingsMap.onedrive_refresh_token === 'string' && settingsMap.onedrive_refresh_token.startsWith('{')) {
            try {
                const parsed = JSON.parse(settingsMap.onedrive_refresh_token);
                if (parsed.client_id && !settingsMap.onedrive_client_id) settingsMap.onedrive_client_id = parsed.client_id;
                if (parsed.client_secret && !settingsMap.onedrive_client_secret) settingsMap.onedrive_client_secret = parsed.client_secret;
                if (parsed.refresh_token) settingsMap.onedrive_refresh_token = parsed.refresh_token;
            } catch (_) {}
        }

        res.json(settingsMap);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const settingsData = { ...req.body };

        // Синхронізуємо обидва ключі для збереження в базі даних
        if (settingsData.storage_location !== undefined || settingsData.aws_s3_enabled !== undefined) {
            const isCloud = settingsData.storage_location === 'cloud' || settingsData.aws_s3_enabled === 'true';
            settingsData.storage_location = isCloud ? 'cloud' : 'local';
            settingsData.aws_s3_enabled = isCloud ? 'true' : 'false';
        }

        // Автоматично формуємо google_drive_credentials при заповненні окремих OAuth2 полів
        if (settingsData.gdrive_client_id && settingsData.gdrive_refresh_token) {
            settingsData.google_drive_credentials = JSON.stringify({
                client_id: settingsData.gdrive_client_id.trim(),
                client_secret: (settingsData.gdrive_client_secret || '').trim(),
                refresh_token: settingsData.gdrive_refresh_token.trim()
            });
        }
        if (settingsData.gdrive_folder_id !== undefined) {
            settingsData.google_drive_folder_id = settingsData.gdrive_folder_id.trim();
        }

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
    const { provider, credentials: bodyCredentials } = req.body;
    if (!provider) return res.status(400).json({ ok: false, error: 'Provider is required' });

    try {
        if (provider === 'gdrive') {
            let credentials = null;

            // 1. Прямий об'єкт або JSON
            if (bodyCredentials && (bodyCredentials.client_email || (bodyCredentials.client_id && bodyCredentials.refresh_token))) {
                credentials = bodyCredentials;
            }

            // 2. google_drive_credentials із запиту або бази даних
            if (!credentials) {
                const credsStr = bodyCredentials?.google_drive_credentials || (await Settings.findByPk('google_drive_credentials'))?.value;
                if (credsStr) {
                    try {
                        credentials = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
                    } catch (_) {}
                }
            }

            // 3. Окремі поля
            if (!credentials) {
                const clientId = bodyCredentials?.client_id || (await Settings.findByPk('gdrive_client_id'))?.value;
                const clientSecret = bodyCredentials?.client_secret || (await Settings.findByPk('gdrive_client_secret'))?.value;
                const refreshToken = bodyCredentials?.refresh_token || (await Settings.findByPk('gdrive_refresh_token'))?.value;

                if (clientId && refreshToken) {
                    credentials = { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken };
                }
            }

            if (!credentials) {
                return res.json({ ok: false, error: 'Missing Google Drive credentials (client_id, client_secret, or refresh_token)' });
            }

            const { testGDriveConnection } = require('../services/cloud/googleDrive');
            const result = await testGDriveConnection(credentials);
            return res.json({ ok: result, error: result ? null : 'Connection test failed — check credentials' });
        }

        if (provider === 'onedrive') {
            let refreshToken = bodyCredentials?.refresh_token || (await Settings.findByPk('onedrive_refresh_token'))?.value;
            const clientId = bodyCredentials?.client_id || (await Settings.findByPk('onedrive_client_id'))?.value;
            const clientSecret = bodyCredentials?.client_secret || (await Settings.findByPk('onedrive_client_secret'))?.value;

            if (refreshToken && typeof refreshToken === 'string' && refreshToken.startsWith('{')) {
                try {
                    const parsed = JSON.parse(refreshToken);
                    if (parsed.refresh_token) refreshToken = parsed.refresh_token;
                } catch (_) {}
            }

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
            const accessKeyId = bodyCredentials?.access_key || (await Settings.findByPk('aws_s3_access_key'))?.value;
            const secretAccessKey = bodyCredentials?.secret_key || (await Settings.findByPk('aws_s3_secret_key'))?.value;
            const region = bodyCredentials?.region || (await Settings.findByPk('aws_s3_region'))?.value;
            const bucket = bodyCredentials?.bucket || (await Settings.findByPk('aws_s3_bucket'))?.value;
            const endpoint = bodyCredentials?.endpoint !== undefined ? bodyCredentials.endpoint : (await Settings.findByPk('aws_s3_endpoint'))?.value;

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

/**
 * POST /api/settings/test-notification
 * Надсилає тестове сповіщення у Telegram для перевірки налаштувань
 */
router.post('/test-notification', verifyToken, async (req, res) => {
    try {
        const { telegram_token, telegram_chat_id } = req.body;
        const token = telegram_token || (await Settings.findByPk('notification_telegram_token'))?.value;
        const chatId = telegram_chat_id || (await Settings.findByPk('notification_telegram_chat_id'))?.value;

        if (!token || !chatId) {
            return res.status(400).json({ ok: false, error: 'Telegram Token and Chat ID are required' });
        }

        const { sendTestMessage } = require('../services/notificationService');
        const result = await sendTestMessage(token, chatId);
        res.json(result);
    } catch (error) {
        console.error('Test notification error:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;

