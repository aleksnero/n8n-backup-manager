const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Backup = sequelize.define('Backup', {
    filename: {
        type: DataTypes.STRING,
        allowNull: false
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
    }
});

module.exports = Backup;
