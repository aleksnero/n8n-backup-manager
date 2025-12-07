const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Settings = sequelize.define('Settings', {
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.TEXT, // Store JSON or string
        allowNull: true
    }
});

module.exports = Settings;
