const express = require('express');
const router = express.Router();
const fs = require('fs');
const verifyToken = require('../middleware/auth');
const workflowSnapshotService = require('../services/workflowSnapshotService');
const Settings = require('../models/Settings');
const { startWorkflowSnapshotScheduler } = require('../services/scheduler');

/**
 * Отримання списку робочих процесів наживо з підключеної бази n8n
 */
router.get('/live', verifyToken, async (req, res) => {
    try {
        const workflows = await workflowSnapshotService.getLiveWorkflows();
        res.json(workflows);
    } catch (error) {
        console.error('Error fetching live workflows:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * Отримання списку збережених снапшотів (з опціональною фільтрацією за workflowId)
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const snapshots = await workflowSnapshotService.listSnapshots(req.query.workflowId);
        res.json(snapshots);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Створення нового гранулярного снапшоту для обраного процесу
 */
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { workflowId, note } = req.body;
        if (!workflowId) {
            return res.status(400).json({ message: 'workflowId is required' });
        }

        const snapshot = await workflowSnapshotService.createSnapshot(workflowId, {
            type: 'manual',
            note: note || ''
        });

        res.json({
            message: 'Workflow snapshot created successfully',
            snapshot
        });
    } catch (error) {
        console.error('Snapshot creation failed:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * Гранулярний відкат / відновлення воркфлоу та креденшелів наживо
 */
router.post('/:id/restore', verifyToken, async (req, res) => {
    try {
        const result = await workflowSnapshotService.restoreSnapshot(req.params.id);
        res.json({
            message: `Workflow '${result.workflowName}' and its credentials successfully restored!`,
            result
        });
    } catch (error) {
        console.error('Snapshot restore failed:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * Завантаження архіву снапшоту на комп'ютер користувача
 */
router.get('/:id/download', verifyToken, async (req, res) => {
    try {
        const snapshots = await workflowSnapshotService.listSnapshots();
        const snapshot = snapshots.find(s => String(s.id) === String(req.params.id));

        if (!snapshot || !fs.existsSync(snapshot.path)) {
            return res.status(404).json({ message: 'Snapshot file not found on disk' });
        }

        res.download(snapshot.path, snapshot.filename);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Видалення снапшоту
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await workflowSnapshotService.deleteSnapshot(req.params.id);
        res.json({ message: 'Snapshot deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Перемикання захисту від видалення та ротації
 */
router.put('/:id/protect', verifyToken, async (req, res) => {
    try {
        const updated = await workflowSnapshotService.toggleProtection(req.params.id);
        res.json({
            message: `Snapshot protection ${updated.isProtected ? 'enabled' : 'disabled'}`,
            snapshot: updated
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Отримання налаштувань авто-розкладу для снапшотів процесів
 */
router.get('/schedule/config', verifyToken, async (req, res) => {
    try {
        const enabled = await Settings.findOne({ where: { key: 'wf_snapshots_enabled' } });
        const schedule = await Settings.findOne({ where: { key: 'wf_snapshots_schedule' } });
        const scope = await Settings.findOne({ where: { key: 'wf_snapshots_scope' } });
        const retention = await Settings.findOne({ where: { key: 'wf_snapshots_retention' } });

        res.json({
            enabled: enabled ? enabled.value === 'true' : false,
            schedule: schedule ? schedule.value : 'interval:360',
            scope: scope ? scope.value : 'all_active',
            retention: retention ? parseInt(retention.value, 10) : 5
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * Збереження налаштувань авто-розкладу для снапшотів
 */
router.post('/schedule/config', verifyToken, async (req, res) => {
    try {
        const { enabled, schedule, scope, retention } = req.body;

        const updateOrSet = async (key, value) => {
            let item = await Settings.findOne({ where: { key } });
            if (item) {
                item.value = String(value);
                await item.save();
            } else {
                await Settings.create({ key, value: String(value) });
            }
        };

        if (enabled !== undefined) await updateOrSet('wf_snapshots_enabled', enabled ? 'true' : 'false');
        if (schedule !== undefined) await updateOrSet('wf_snapshots_schedule', schedule);
        if (scope !== undefined) await updateOrSet('wf_snapshots_scope', scope);
        if (retention !== undefined) await updateOrSet('wf_snapshots_retention', retention);

        // Перезапускаємо планувальник із новими параметрами
        await startWorkflowSnapshotScheduler();

        res.json({ message: 'Workflow snapshots schedule updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
