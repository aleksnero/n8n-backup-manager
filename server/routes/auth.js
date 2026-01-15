const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authenticateToken = require('../middleware/auth');

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(404).send({ message: 'User not found.' });
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);

        if (!passwordIsValid) {
            return res.status(401).send({ accessToken: null, message: 'Invalid Password!' });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret-key', {
            expiresIn: 86400 // 24 hours
        });

        res.status(200).send({
            id: user.id,
            username: user.username,
            accessToken: token
        });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Check setup status
router.get('/setup-status', async (req, res) => {
    try {
        const count = await User.count();
        res.send({ isSetup: count > 0 });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Verify token validity
router.get('/verify', async (req, res) => {
    const token = req.headers['x-access-token'];
    if (!token) {
        return res.status(401).send({ message: 'No token provided!' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret-key', (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized!' });
        }
        res.status(200).send({ message: 'Token is valid', userId: decoded.id });
    });
});

// Initial setup route (create first user if none exists)
router.post('/setup', async (req, res) => {
    try {
        const count = await User.count();
        if (count > 0) {
            return res.status(403).send({ message: 'Setup already completed.' });
        }

        const { username, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 8);

        await User.create({
            username,
            password: hashedPassword
        });

        res.send({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Change password route
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send({ message: 'User not found.' });
        }

        const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
        if (!passwordIsValid) {
            return res.status(401).send({ message: 'Invalid current password!' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 8);
        await user.update({ password: hashedPassword });

        res.send({ message: 'Password changed successfully!' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
