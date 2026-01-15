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

module.exports = router;
