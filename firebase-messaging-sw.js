/**
 * ═══════════════════════════════════════════════════════════════
 * 🚀 FIREBASE CLOUD MESSAGING SERVICE WORKER
 * ═══════════════════════════════════════════════════════════════
 * Tento Service Worker běží na pozadí a přijímá FCM notifikace
 * i když je prohlížeč zavřený nebo na pozadí.
 * UMÍSTI TENTO SOUBOR DO ROOT SLOŽKY (vedle index.html)!
 * ═══════════════════════════════════════════════════════════════
 */

// Import Firebase skriptů pro Service Worker
importScripts('https://www.gstatic.com/firebasejs/8.6.8/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.6.8/firebase-messaging.js');

// Firebase konfigurace - STEJNÁ jako v medicFirebaseFunctions.js
const firebaseConfig = {
  apiKey: "AIzaSyC5gSU4hC8ZuC9ofefCcRj9sOY6ID3LQFQ",
  authDomain: "medic-protokol-jirik.firebaseapp.com",
  projectId: "medic-protokol-jirik",
  storageBucket: "medic-protokol-jirik.firebasestorage.app",
  messagingSenderId: "162734152774",
  appId: "1:162734152774:web:31ab98174d2d04f9f1fe47",
  measurementId: "G-0Z3TNN5K88"
};

// Inicializace Firebase v Service Workeru
firebase.initializeApp(firebaseConfig);

// Získání instance Firebase Messaging
const messaging = firebase.messaging();

/**
 * Handler pro příchozí zprávy když je aplikace na pozadí
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Přijata zpráva na pozadí:', payload);

  const notificationTitle = payload.notification?.title || '🚀 Lékařský Protokol';
  const notificationOptions = {
    body: payload.notification?.body || 'Nová zpráva od admirála Jiříka',
    icon: payload.notification?.icon || 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
    badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
    tag: payload.notification?.tag || 'background-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: '🖖 Otevřít protokol'
      },
      {
        action: 'close',
        title: '❌ Zavřít'
      }
    ]
  };

  // Zobrazíme notifikaci
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handler pro kliknutí na notifikaci
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Kliknuto na notifikaci:', event);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Otevřeme aplikaci
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Pokud je aplikace již otevřená, zaměříme ji
          for (const client of clientList) {
            if (client.url.includes('index.html') || client.url.endsWith('/')) {
              return client.focus();
            }
          }
          // Jinak otevřeme nové okno
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
  // Pokud action === 'close', pouze zavřeme notifikaci (již provedeno výše)
});

/**
 * Handler pro instalaci Service Workeru
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalace Service Workeru...');
  self.skipWaiting(); // Okamžitá aktivace
});

/**
 * Handler pro aktivaci Service Workeru
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Service Worker aktivován');
  event.waitUntil(clients.claim()); // Převezme kontrolu nad všemi klienty
});

console.log('[Service Worker] Firebase Messaging Service Worker načten a připraven! 🚀');
