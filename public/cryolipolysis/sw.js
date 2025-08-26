const CACHE_NAME = 'mouthpiece-v2';
const urlsToCache = [
  '/',
  '/styles.css',
  '/app.js',
  '/images/injection-MV.webp',
  '/images/favicon.png',
  '/images/ranking_header_banner.webp'
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// フェッチ時にキャッシュから返す
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュがあればキャッシュから返す
        if (response) {
          return response;
        }
        
        // なければネットワークから取得
        return fetch(event.request).then(response => {
          // 画像とCSSはキャッシュに追加
          if (event.request.url.match(/\.(webp|jpg|png|css|js)$/)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
          }
          return response;
        });
      })
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});