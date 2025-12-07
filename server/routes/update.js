const express = require('express');
const router = express.Router();
const updateService = require('../services/updateService');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/updates/check
 * Check for available updates
 */
router.get('/check', async (req, res) => {
    try {
        const updateInfo = await updateService.checkForUpdates();
        res.json(updateInfo);
    } catch (error) {
        console.error('Check updates error:', error);
        res.status(500).json({ message: 'Failed to check for updates', error: error.message });
    }
});

/**
 * POST /api/updates/apply
 * Download and apply update
 */
router.post('/apply', async (req, res) => {
    try {
        const updateInfo = await updateService.checkForUpdates();

        if (!updateInfo.hasUpdate) {
            return res.status(400).json({ message: 'No updates available' });
        }

        // Download update
        const zipPath = await updateService.downloadUpdate(updateInfo.downloadUrl);

        // Apply update (this will restart the server)
        const result = await updateService.applyUpdate(zipPath);

        res.json(result);
    } catch (error) {
        console.error('Apply update error:', error);
        res.status(500).json({ message: 'Failed to apply update', error: error.message });
    }
});

/**
 * POST /api/updates/rollback
 * Rollback to previous version
 */
router.post('/rollback', async (req, res) => {
    try {
        const result = await updateService.rollback();
        res.json(result);
    } catch (error) {
        console.error('Rollback error:', error);
        res.status(500).json({ message: 'Failed to rollback', error: error.message });
    }
});

/**
 * GET /api/updates/history
 * Get update history
 */
router.get('/history', async (req, res) => {
    try {
        const history = await updateService.getUpdateHistory();
        res.json(history);
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ message: 'Failed to get update history', error: error.message });
    }
});

module.exports = router;
