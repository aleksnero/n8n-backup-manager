const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Log = sequelize.define('Log', {
    level: {
        type: DataTypes.ENUM('info', 'warn', 'error'),
        defaultValue: 'info'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

module.exports = Log;
