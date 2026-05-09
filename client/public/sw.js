const CACHE_NAME = 'backup-mgr-v1';
const STATIC_ASSETS = ['/', '/index.html'];

// Service Worker встановлення — кешуємо основні статичні ресурси
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Активація — очищаємо старі кеші
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch стратегія:
// - API запити (/api/*) — завжди network-first (актуальні дані)
// - Статичні ресурси — cache-first із fallback на network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Пропускаємо не-GET запити та API
    if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Кешуємо тільки успішні відповіді
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
