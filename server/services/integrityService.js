const { execFile } = require('child_process');
const { promisify } = require('util');
const Backup = require('../models/Backup');

const execFileAsync = promisify(execFile);

/**
 * Перевіряє цілісність tar.gz архіву бекапу.
 * Використовує `tar --list` — якщо команда завершується успішно, архів читабельний.
 * Для SQL-файлів (.sql) — перевіряємо чи файл існує та не порожній.
 *
 * @param {string|number} backupId — ID запису у базі даних
 * @returns {{ ok: boolean, error?: string, filename: string }}
 */
async function checkBackupIntegrity(backupId) {
    const backup = await Backup.findByPk(backupId);
    if (!backup) {
        throw new Error(`Backup #${backupId} not found`);
    }

    const { path: filePath, filename } = backup;

    // Перевіряємо чи файл існує
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        return { ok: false, filename, error: 'File not found on disk' };
    }

    // SQL-файли не є архівами — перевіряємо лише розмір
    if (filename.endsWith('.sql')) {
        const stat = fs.statSync(filePath);
        return {
            ok: stat.size > 0,
            filename,
            error: stat.size === 0 ? 'SQL file is empty' : undefined
        };
    }

    // Для tar.gz / tar — запускаємо `tar --list` щоб перевірити читабельність архіву
    try {
        await execFileAsync('tar', ['--list', '-f', filePath], { timeout: 30000 });
        return { ok: true, filename };
    } catch (err) {
        // tar повертає ненульовий exit code якщо архів пошкоджений
        return {
            ok: false,
            filename,
            error: err.stderr?.trim() || 'Archive is corrupted or unreadable'
        };
    }
}

module.exports = { checkBackupIntegrity };
