const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const newsService = require('../services/newsService');

/**
 * GET /api/news
 * Отримання списку новин та анонсів програми
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const feed = await newsService.getNewsFeed();
        res.json(feed);
    } catch (error) {
        console.error('Error fetching news feed:', error.message);
        res.status(500).json({
            news: [],
            error: error.message
        });
    }
});

module.exports = router;
