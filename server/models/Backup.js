const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Backup = sequelize.define('Backup', {
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    label: {
        // Необов'язкова мітка для ручного бекапу (задається користувачем)
        type: DataTypes.STRING,
        allowNull: true
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    size: {
        type: DataTypes.INTEGER, // bytes
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM('manual', 'auto'),
        defaultValue: 'manual'
    },
    isProtected: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    storageLocation: {
        type: DataTypes.STRING,
        defaultValue: 'local',
        allowNull: false
    }
});

module.exports = Backup;
