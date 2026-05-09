const fetch = require('node-fetch');
const Settings = require('../models/Settings');

/**
 * Отримує налаштування сповіщень з бази даних
 */
async function getNotificationConfig() {
    const keys = ['notification_enabled', 'notification_telegram_token', 'notification_telegram_chat_id'];
    const rows = await Settings.findAll({ where: { key: keys } });
    const config = {};
    rows.forEach(row => { config[row.key] = row.value; });
    return config;
}

/**
 * Формує текст повідомлення залежно від події
 */
function buildMessage(event, data) {
    const timestamp = new Date().toLocaleString();
    switch (event) {
        case 'backup_success':
            return `✅ *Backup Created*\n\`${data.filename}\`\nSize: ${data.size || '—'}\n🕐 ${timestamp}`;
        case 'backup_failed':
            return `❌ *Backup Failed*\nError: ${data.error || 'Unknown error'}\n🕐 ${timestamp}`;
        case 'restore_success':
            return `🔄 *Restore Completed*\n\`${data.filename || '—'}\`\n🕐 ${timestamp}`;
        case 'restore_failed':
            return `⚠️ *Restore Failed*\nError: ${data.error || 'Unknown error'}\n🕐 ${timestamp}`;
        default:
            return `ℹ️ *n8n Backup Manager*\nEvent: ${event}\n🕐 ${timestamp}`;
    }
}

/**
 * Надсилає сповіщення у Telegram.
 * Використовує fire-and-forget — помилка сповіщення не перериває основну операцію.
 */
async function notifyWebhook(event, data = {}) {
    try {
        const config = await getNotificationConfig();

        // Перевіряємо чи увімкнені сповіщення та чи є потрібні налаштування
        if (config.notification_enabled !== 'true') return;
        if (!config.notification_telegram_token || !config.notification_telegram_chat_id) return;

        const text = buildMessage(event, data);
        const url = `https://api.telegram.org/bot${config.notification_telegram_token}/sendMessage`;

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.notification_telegram_chat_id,
                text,
                parse_mode: 'Markdown'
            })
        });
    } catch (error) {
        // Навмисно тільки логуємо — помилка сповіщення не повинна зупиняти бекап
        console.error({ error: error.message }, 'Notification send failed');
    }
}

module.exports = { notifyWebhook };
