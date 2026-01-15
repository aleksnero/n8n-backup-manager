const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
    try {
        const logs = await Log.findAll({
            order: [['createdAt', 'DESC']],
            limit: 100 // Limit to last 100 logs
        });
        res.json(logs);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.delete('/', verifyToken, async (req, res) => {
    try {
        await Log.destroy({ where: {} }); // Delete all logs
        res.json({ message: 'All logs cleared successfully' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
