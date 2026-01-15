const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
    try {
        const backups = await backupService.listBackups();
        res.json(backups);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const backup = await backupService.createBackup('manual');
        res.json(backup);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await backupService.deleteBackup(req.params.id);
        res.send({ message: 'Backup deleted successfully!' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.post('/:id/restore', verifyToken, async (req, res) => {
    try {
        await backupService.restoreBackup(req.params.id);
        res.send({ message: 'Backup restored successfully!' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.get('/:id/download', verifyToken, async (req, res) => {
    try {
        const path = await backupService.getBackupPath(req.params.id);
        res.download(path);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Upload backup endpoint
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const storage = multer.diskStorage({
    destination: path.join(__dirname, '../backups'),
    filename: (req, file, cb) => {
        cb(null, `upload-${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

router.post('/upload', verifyToken, upload.single('backup'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No file uploaded' });
        }
        const backup = await backupService.registerUploadedBackup(req.file);
        res.json(backup);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Toggle backup protection
router.patch('/:id/protect', verifyToken, async (req, res) => {
    try {
        const { isProtected } = req.body;
        const backup = await backupService.toggleBackupProtection(req.params.id, isProtected);
        res.json(backup);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Connection status check
router.get('/status', verifyToken, async (req, res) => {
    try {
        const status = await backupService.checkConnectionStatus();
        res.json(status);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
