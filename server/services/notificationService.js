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
        case 'backup_success': {
            let msg = `✅ *Backup Created*\n\`${data.filename}\`\nSize: ${data.size || '—'}`;
            if (data.integrity) {
                msg += `\n🛡️ Integrity: ${data.integrity}`;
            }
            msg += `\n🕐 ${timestamp}`;
            return msg;
        }
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

// Кеш для перевірки статусу підключення Telegram (TTL: 60 сек)
let telegramStatusCache = {
    key: '',
    result: false,
    timestamp: 0
};

/**
 * Перевіряє дійсність підключення до Telegram Bot API (без надсилання повідомлення)
 */
async function testTelegramConnection(token, chatId) {
    if (!token) return false;

    const cacheKey = `${token}_${chatId || ''}`;
    const now = Date.now();
    if (telegramStatusCache.key === cacheKey && (now - telegramStatusCache.timestamp) < 60000) {
        return telegramStatusCache.result;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        // Перевіряємо валідність токена бота
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            telegramStatusCache = { key: cacheKey, result: false, timestamp: now };
            return false;
        }

        const data = await res.json();
        let isValid = data.ok === true;

        // Якщо вказано chat_id, перевіряємо доступність чату
        if (isValid && chatId) {
            try {
                const chatController = new AbortController();
                const chatTimeout = setTimeout(() => chatController.abort(), 4000);
                const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`, {
                    signal: chatController.signal
                });
                clearTimeout(chatTimeout);
                if (chatRes.ok) {
                    const chatData = await chatRes.json();
                    if (chatData && chatData.ok) {
                        isValid = true;
                    }
                }
            } catch (_) {
                // Якщо getChat не вдався (наприклад чат приватний і бот не має /start),
                // але getMe повертає ok: true, то сам бот активний
            }
        }

        telegramStatusCache = { key: cacheKey, result: isValid, timestamp: now };
        return isValid;
    } catch (err) {
        telegramStatusCache = { key: cacheKey, result: false, timestamp: now };
        return false;
    }
}

/**
 * Надсилає тестове повідомлення в Telegram для валідації налаштувань користувачем
 */
async function sendTestMessage(token, chatId) {
    try {
        const text = `🔔 *n8n Backup Manager*\nТестове сповіщення успішно надіслано!\nTest notification delivered successfully!\n🕐 ${new Date().toLocaleString()}`;
        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown'
            })
        });

        const data = await res.json();
        if (data.ok) {
            telegramStatusCache = { key: `${token}_${chatId}`, result: true, timestamp: Date.now() };
            return { ok: true };
        } else {
            return { ok: false, error: data.description || 'Failed to send message' };
        }
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

module.exports = {
    notifyWebhook,
    testTelegramConnection,
    sendTestMessage
};

