const { DataTypes } = require('sequelize');
const sequelize = require('../database');

/**
 * Модель WorkflowSnapshot зберігає метадані гранулярних снапшотів окремих воркфлоу n8n
 * разом із збереженими обліковими даними (credentials).
 * Це дозволяє реалізувати незалежну ротацію, фільтрацію та швидке відновлення без торкання інших процесів.
 */
const WorkflowSnapshot = sequelize.define('WorkflowSnapshot', {
    // Ідентифікатор воркфлоу в системі n8n (наприклад, ID з таблиці workflow_entity)
    workflowId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Назва процесу на момент створення копії
    workflowName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Назва файлу архіву на диску
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Повний шлях до файлу снапшоту в каталозі backups/snapshots
    path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Розмір архіву в байтах
    size: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Тип створення: 'manual' (ручний) або 'auto' (за розкладом)
    type: {
        type: DataTypes.ENUM('manual', 'auto'),
        defaultValue: 'manual'
    },
    // Прапорець блокування від випадкового видалення та ротації
    isProtected: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Місце зберігання копії: 'local', 's3', 'gdrive', 'onedrive' (може бути декілька через кому)
    storageLocation: {
        type: DataTypes.STRING,
        defaultValue: 'local',
        allowNull: false
    },
    // Кількість вузлів (nodes) у збереженому сценарії
    nodesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Кількість зв'язаних облікових записів (credentials), збережених у цьому снапшоті
    credentialsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Список збережених креденшелів у форматі JSON-рядка (назва, тип) для швидкого відображення бейджів у UI
    credentialsSummary: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Користувацька примітка або опис версії
    note: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = WorkflowSnapshot;
