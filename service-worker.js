const CACHE_NAME = 'binaural-beats-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/normalize.css',
  '/css/styles.css',
  '/js/main.js',
  '/manifest.json',
  '/images/icons/icon-72x72.png',
  '/images/icons/icon-96x96.png',
  '/images/icons/icon-128x128.png',
  '/images/icons/icon-144x144.png',
  '/images/icons/icon-152x152.png',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-384x384.png',
  '/images/icons/icon-512x512.png',
  '/images/icons/favicon.ico'
];

// Install event - cache the app shell
self.addEventListener('install', event => {
  // Service Worker installation
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Caching app shell files
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Force the service worker to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  // Service Worker activation
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            // Removing old cache version
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Ensure the service worker takes control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request - a request is a stream and can only be consumed once
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response - a response is a stream and can only be consumed once
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              // Don't cache responses with query strings
              if (!event.request.url.includes('?')) {
                cache.put(event.request, responseToCache);
              }
            });

          return response;
        }).catch(error => {
          // Network request failed, try to serve the offline page
          console.log('[Service Worker] Fetch failed; returning offline page instead.', error);
          // You could return a custom offline page here
        });
      })
  );
});