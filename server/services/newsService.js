const fs = require('fs');
const path = require('path');

// Кросплатформенний fetch (native fetch у Node 18+ або node-fetch як fallback)
const getFetch = () => {
    if (typeof globalThis.fetch === 'function') return globalThis.fetch;
    const mod = require('node-fetch');
    return (mod && mod.default) ? mod.default : mod;
};

// Віддалена адреса стрічки новин в офіційному репозиторії
const NEWS_FEED_URL = process.env.NEWS_FEED_URL || 'https://raw.githubusercontent.com/aleksnero/n8n-backup-manager/main/news.json';

// Шляхи до локального фолбек-файлу news.json (перевіряє кілька локацій для dev/Docker)
function getLocalNewsFilePath() {
    const candidatePaths = [
        path.join(__dirname, '..', 'news.json'),        // server/news.json або /app/news.json (Docker/deploy)
        path.join(__dirname, '..', '..', 'news.json'),  // repo root news.json (local dev)
        path.join(process.cwd(), 'news.json'),          // поточна робоча директорія
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }
    return candidatePaths[0];
}

// Кеш новин у пам'яті (TTL: 30 хвилин)
let newsCache = {
    data: null,
    timestamp: 0
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 хвилин

/**
 * Валідація та очищення структури новин
 */
function sanitizeNews(items) {
    if (!Array.isArray(items)) return [];

    return items
        .filter(item => item && typeof item === 'object' && item.id && (item.title || item.title_en))
        .map(item => {
            // Безпечне посилання (тільки https://)
            const rawUrl = item.link || item.url || '';
            let safeLink = null;
            if (typeof rawUrl === 'string' && rawUrl.startsWith('https://')) {
                safeLink = rawUrl;
            }

            const titleUk = typeof item.title === 'object' && item.title ? (item.title.uk || item.title.en) : (item.title || item.title_en || '');
            const titleEn = typeof item.title === 'object' && item.title ? (item.title.en || item.title.uk) : (item.title_en || item.title || '');
            const contentUk = typeof item.message === 'object' && item.message ? (item.message.uk || item.message.en) : (item.message || item.content || item.content_en || '');
            const contentEn = typeof item.message === 'object' && item.message ? (item.message.en || item.message.uk) : (item.content_en || item.message || item.content || '');

            return {
                id: String(item.id).substring(0, 64),
                title: String(titleUk).substring(0, 200),
                title_en: String(titleEn).substring(0, 200),
                date: item.date ? String(item.date).substring(0, 20) : new Date().toISOString().slice(0, 10),
                type: ['release', 'important', 'tip', 'info'].includes(item.type) ? item.type : 'info',
                badge: item.badge ? String(item.badge).substring(0, 20).toUpperCase() : null,
                content: String(contentUk).substring(0, 1500),
                content_en: String(contentEn).substring(0, 1500),
                message: String(contentUk).substring(0, 1500),
                link: safeLink,
                url: safeLink,
                linkText: item.linkText ? String(item.linkText).substring(0, 50) : null,
                pinned: Boolean(item.pinned)
            };
        })
        .sort((a, b) => {
            // Спочатку закріплені (pinned), потім за спаданням дати
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.date) - new Date(a.date);
        });
}

/**
 * Читає новини з локального файлу news.json (фолбек при відсутності мережі)
 */
function getLocalNews() {
    try {
        const filePath = getLocalNewsFilePath();
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            return sanitizeNews(parsed);
        }
    } catch (e) {
        console.warn('Could not read local news.json:', e.message);
    }
    return [];
}

/**
 * Отримує стрічку новин:
 * 1. Повертає з кешу якщо TTL не минув
 * 2. Завантажує наживо з GitHub RAW
 * 3. При збої мережі повертає локальний файл news.json
 */
async function getNewsFeed() {
    const now = Date.now();

    // Якщо кеш свіжий — повертаємо негайно
    if (newsCache.data && (now - newsCache.timestamp) < CACHE_TTL_MS) {
        return {
            news: newsCache.data,
            source: 'cache',
            cachedAt: new Date(newsCache.timestamp).toISOString()
        };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); // 4 сек таймаут

        const fetchFn = getFetch();
        const res = await fetchFn(NEWS_FEED_URL, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (res.ok) {
            const rawData = await res.json();
            const sanitized = sanitizeNews(rawData);

            newsCache = {
                data: sanitized,
                timestamp: now
            };

            return {
                news: sanitized,
                source: 'remote',
                cachedAt: new Date(now).toISOString()
            };
        }
    } catch (networkError) {
        // Мережевий збій або відсутність інтернету
        console.warn('News feed fetch failed, falling back to local news:', networkError.message);
    }

    // Фолбек: якщо попередній кеш існував — використовуємо його, інакше читаємо локальний news.json
    const fallbackData = newsCache.data || getLocalNews();
    return {
        news: fallbackData,
        source: 'fallback',
        cachedAt: new Date(now).toISOString()
    };
}

module.exports = {
    getNewsFeed
};
