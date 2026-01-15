const express = require('express');
const router = express.Router();
const updateService = require('../services/updateService');
const authenticateToken = require('../middleware/auth');

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
        res.status(500).json({
            message: error.message || 'Failed to apply update',
            error: error.stack
        });
    }
});

/**
 * POST /api/updates/rollback
 * Rollback to previous version
 */
router.post('/rollback', async (req, res) => {
    try {
        const { filename } = req.body;
        const result = await updateService.rollback(filename);
        res.json(result);
    } catch (error) {
        console.error('Rollback error:', error);
        res.status(500).json({ message: 'Failed to rollback', error: error.message });
    }
});

/**
 * GET /api/updates/download/:filename
 * Download an update backup
 */
router.get('/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = updateService.getUpdateBackupPath(filename);
        res.download(filePath);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Failed to download backup', error: error.message });
    }
});

/**
 * POST /api/updates/upload
 * Upload an update backup (.zip)
 */
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'backups', 'pre_update_backups');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Ensure it has .zip extension and a safe name
        const name = file.originalname.endsWith('.zip') ? file.originalname : `${file.originalname}.zip`;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.zip') {
            cb(null, true);
        } else {
            cb(new Error('Only .zip files are allowed'));
        }
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No file uploaded');
        res.json({ success: true, message: 'File uploaded successfully', filename: req.file.filename });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Failed to upload file', error: error.message });
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

/**
 * DELETE /api/updates/history/:filename
 * Delete update history item
 */
router.delete('/history/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const result = await updateService.deleteUpdateHistoryItem(filename);
        res.json(result);
    } catch (error) {
        console.error('Delete history item error:', error);
        res.status(500).json({ message: 'Failed to delete history item', error: error.message });
    }
});

module.exports = router;
