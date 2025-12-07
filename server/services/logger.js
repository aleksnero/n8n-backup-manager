const Log = require('../models/Log');

const log = async (level, message) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
    try {
        await Log.create({ level, message });
    } catch (err) {
        console.error('Failed to save log:', err);
    }
};

module.exports = {
    info: (msg) => log('info', msg),
    error: (msg) => log('error', msg),
    warn: (msg) => log('warn', msg)
};
