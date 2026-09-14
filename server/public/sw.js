const CACHE_NAME = 'backup-mgr-v1.6.0';
const STATIC_ASSETS = ['/'];

// Service Worker встановлення
self.addEventListener('install', (event) => {
    // Негайне перемикання на новий Service Worker без очікування закриття вкладок
    self.skipWaiting();
});

// Активація — очищаємо старі кеші (включаючи backup-mgr-v1) та захоплюємо клієнтів
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch стратегія:
// - API запити (/api/*) — завжди мережа
// - HTML та сторінки навігації — ЗАВЖДИ Network-First (щоб оновлення завантажувалися миттєво)
// - Хешовані асети (/assets/*) — Cache-First (оскільки вони мають унікальні хеші Vite)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Пропускаємо не-GET запити та API
    if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        return;
    }

    // 1. Для навігації та HTML (головна сторінка, роути) — Network-First!
    if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. Для статичних ресурсів (assets, icons, fonts)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
