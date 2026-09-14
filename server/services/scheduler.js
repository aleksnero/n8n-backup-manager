const cron = require('node-cron');
const Settings = require('../models/Settings');
const backupService = require('./backupService');
const workflowSnapshotService = require('./workflowSnapshotService');
const Backup = require('../models/Backup');

let backupTask = null;
let workflowSnapshotTask = null;

const getSetting = async (key) => {
    const s = await Settings.findOne({ where: { key } });
    return s ? s.value : null;
};

/**
 * Конвертація інтервалу у хвилинах або рядка розкладу у валідний вираз node-cron
 */
const parseScheduleToCron = (schedule) => {
    if (!schedule) return null;
    let cronExpression = schedule;

    if (schedule.startsWith('interval:')) {
        const minutes = parseInt(schedule.split(':')[1], 10);
        if (isNaN(minutes) || minutes <= 0) return null;

        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainderMinutes = minutes % 60;
            if (remainderMinutes === 0) {
                cronExpression = `0 0 */${hours} * * *`;
            } else {
                if (minutes < 1440) {
                    cronExpression = `0 */${minutes} * * * *`;
                } else {
                    const days = Math.floor(minutes / 1440);
                    cronExpression = `0 0 0 */${days} * *`;
                }
            }
        } else {
            cronExpression = `0 */${minutes} * * * *`;
        }
    }

    return cron.validate(cronExpression) ? cronExpression : null;
};

/**
 * Запуск планувальника для основних повних бекапів
 */
const startBackupScheduler = async () => {
    if (backupTask) {
        backupTask.stop();
        backupTask = null;
    }

    const schedule = await getSetting('backup_schedule');
    if (!schedule) return;

    const cronExpression = parseScheduleToCron(schedule);
    if (!cronExpression) {
        console.error('Invalid backup cron expression:', schedule);
        return;
    }

    console.log(`Starting main backup scheduler with cron: ${cronExpression}`);

    backupTask = cron.schedule(cronExpression, async () => {
        console.log('Running auto-backup...');
        try {
            await backupService.createBackup('auto');
            await enforceRetentionPolicy();
        } catch (error) {
            console.error('Auto-backup failed:', error);
        }
    });
};

/**
 * Запуск планувальника для авто-снапшотів робочих процесів n8n
 */
const startWorkflowSnapshotScheduler = async () => {
    if (workflowSnapshotTask) {
        workflowSnapshotTask.stop();
        workflowSnapshotTask = null;
    }

    const enabled = (await getSetting('wf_snapshots_enabled')) === 'true';
    if (!enabled) return;

    const schedule = await getSetting('wf_snapshots_schedule') || 'interval:360'; // За замовчуванням кожні 6 годин
    const cronExpression = parseScheduleToCron(schedule);
    if (!cronExpression) {
        console.error('Invalid workflow snapshot cron expression:', schedule);
        return;
    }

    console.log(`Starting workflow snapshots scheduler with cron: ${cronExpression}`);

    workflowSnapshotTask = cron.schedule(cronExpression, async () => {
        console.log('Running scheduled workflow auto-snapshots...');
        try {
            const scope = (await getSetting('wf_snapshots_scope')) || 'all_active';
            const liveWorkflows = await workflowSnapshotService.getLiveWorkflows();

            let targetWorkflows = [];
            if (scope === 'all_active') {
                targetWorkflows = liveWorkflows.filter(w => w.active);
            } else if (scope.startsWith('ids:')) {
                const targetIds = scope.replace('ids:', '').split(',').map(id => id.trim());
                targetWorkflows = liveWorkflows.filter(w => targetIds.includes(w.id));
            } else {
                targetWorkflows = liveWorkflows.filter(w => w.active);
            }

            console.log(`Creating auto-snapshots for ${targetWorkflows.length} workflow(s)...`);

            for (const wf of targetWorkflows) {
                try {
                    await workflowSnapshotService.createSnapshot(wf.id, {
                        type: 'auto',
                        note: 'Scheduled auto-snapshot'
                    });
                } catch (snapErr) {
                    console.error(`Failed to auto-snapshot workflow ${wf.id} (${wf.name}):`, snapErr.message);
                }
            }
        } catch (error) {
            console.error('Workflow auto-snapshots run failed:', error);
        }
    });
};

const enforceRetentionPolicy = async () => {
    const retentionCount = await getSetting('backup_retention_count');
    if (!retentionCount) return;

    const count = parseInt(retentionCount, 10);
    if (isNaN(count) || count <= 0) return;

    const backups = await Backup.findAll({
        where: { isProtected: false },
        order: [['createdAt', 'DESC']]
    });

    if (backups.length > count) {
        const toDelete = backups.slice(count);
        for (const backup of toDelete) {
            console.log(`Deleting old backup: ${backup.filename}`);
            try {
                await backupService.deleteBackup(backup.id);
            } catch (err) {
                console.error(`Failed to delete backup ${backup.id}:`, err);
            }
        }
    }
};

const startScheduler = async () => {
    await startBackupScheduler();
    await startWorkflowSnapshotScheduler();
};

module.exports = {
    startScheduler,
    startBackupScheduler,
    startWorkflowSnapshotScheduler
};
