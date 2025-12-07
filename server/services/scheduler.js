const cron = require('node-cron');
const Settings = require('../models/Settings');
const backupService = require('./backupService');
const Backup = require('../models/Backup');

let task = null;

const getSetting = async (key) => {
    const s = await Settings.findOne({ where: { key } });
    return s ? s.value : null;
};

const startScheduler = async () => {
    if (task) {
        task.stop();
        task = null;
    }

    const schedule = await getSetting('backup_schedule'); // e.g., '0 0 * * *' or 'interval:60'

    if (!schedule) return;

    console.log(`Starting scheduler with schedule: ${schedule}`);

    let cronExpression = schedule;
    if (schedule.startsWith('interval:')) {
        const minutes = parseInt(schedule.split(':')[1]);

        // node-cron uses 6-field format: second minute hour day month weekday
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainderMinutes = minutes % 60;
            if (remainderMinutes === 0) {
                // Every N hours at minute 0
                cronExpression = `0 0 */${hours} * * *`;
            } else {
                // Complex interval, fall back to minute-based if < 1440 (24 hours)
                if (minutes < 1440) {
                    cronExpression = `0 */${minutes} * * * *`;
                } else {
                    // For very long intervals, use daily at midnight
                    const days = Math.floor(minutes / 1440);
                    cronExpression = `0 0 0 */${days} * *`;
                }
            }
        } else {
            // Every N minutes at second 0
            cronExpression = `0 */${minutes} * * * *`;
        }

        console.log(`Converted interval:${minutes} to cron: ${cronExpression}`);
    }

    if (!cron.validate(cronExpression)) {
        console.error('Invalid cron expression:', cronExpression);
        return;
    }

    task = cron.schedule(cronExpression, async () => {
        console.log('Running auto-backup...');
        try {
            await backupService.createBackup('auto');
            await enforceRetentionPolicy();
        } catch (error) {
            console.error('Auto-backup failed:', error);
        }
    });
};

const enforceRetentionPolicy = async () => {
    const retentionCount = await getSetting('backup_retention_count');
    if (!retentionCount) return;

    const count = parseInt(retentionCount);
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

module.exports = { startScheduler };
