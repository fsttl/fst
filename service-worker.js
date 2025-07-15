const CACHE_NAME = 'fst-fisilti-v1.0.0';
const STATIC_CACHE = 'fst-static-v1.0.0';
const DYNAMIC_CACHE = 'fst-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static files', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', request.url);
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache if not a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Determine which cache to use
            let cacheName = DYNAMIC_CACHE;
            
            // Cache static assets in static cache
            if (STATIC_FILES.includes(request.url) || 
                request.url.includes('fonts.googleapis.com') ||
                request.url.includes('fonts.gstatic.com')) {
              cacheName = STATIC_CACHE;
            }

            // Add to cache
            caches.open(cacheName)
              .then((cache) => {
                console.log('Service Worker: Caching new resource', request.url);
                cache.put(request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.log('Service Worker: Fetch failed, serving offline page', error);
            
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/');
            }
            
            // Return placeholder for images
            if (request.destination === 'image') {
              return new Response(
                '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#dc2626"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial, sans-serif" font-size="16">Resim Yüklenemedi</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background sync tasks
      doBackgroundSync()
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Yeni bir makale yayınlandı!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Makaleyi Oku',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Kapat',
        icon: '/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('fst. FISILTI', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_ARTICLE') {
    cacheArticle(event.data.url);
  }
});

// Helper function for background sync
async function doBackgroundSync() {
  try {
    // Sync offline actions, update cache, etc.
    console.log('Service Worker: Performing background sync');
    
    // Example: Sync read articles, user preferences, etc.
    const cache = await caches.open(DYNAMIC_CACHE);
    
    // Clean up old cache entries (keep only last 50 articles)
    const keys = await cache.keys();
    if (keys.length > 50) {
      const oldKeys = keys.slice(0, keys.length - 50);
      await Promise.all(oldKeys.map(key => cache.delete(key)));
    }
    
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Helper function to cache specific article
async function cacheArticle(url) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.add(url);
    console.log('Service Worker: Article cached', url);
  } catch (error) {
    console.error('Service Worker: Failed to cache article', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(
      doBackgroundSync()
    );
  }
});

// Handle cache storage quota
self.addEventListener('quotaexceeded', (event) => {
  console.log('Service Worker: Storage quota exceeded');
  
  event.waitUntil(
    caches.open(DYNAMIC_CACHE)
      .then((cache) => {
        return cache.keys();
      })
      .then((keys) => {
        // Delete oldest entries
        const deletePromises = keys.slice(0, 10).map(key => 
          caches.delete(key)
        );
        return Promise.all(deletePromises);
      })
  );
});

console.log('Service Worker: Script loaded');
