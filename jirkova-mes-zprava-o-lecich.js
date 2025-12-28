/**
 * ═══════════════════════════════════════════════════════════════
 * 🚀 JIŘÍKŮV LÉKAŘSKÝ NOTIFIKAČNÍ SYSTÉM - FCM MODUL 🚀
 * ═══════════════════════════════════════════════════════════════
 * Tento modul využívá Firebase Cloud Messaging pro zasílání
 * notifikací o lécích přímo do prohlížeče.
 * Admirál Jiřík bude informován i když je prohlížeč zavřený!
 * ═══════════════════════════════════════════════════════════════
 */

console.log("🚀 JIŘÍKŮV FCM MODUL: Inicializace torpédového systému notifikací...");

// Globální proměnné pro FCM
let messaging = null;
let notificationPermission = 'default';
let fcmToken = null;

/**
 * @function initializeFCMNotifications
 * @description Hlavní inicializační funkce pro FCM notifikace
 */
window.initializeFCMNotifications = async function() {
    console.log("🎯 Spouštím FCM notifikační systém...");
    
    // Kontrola podpory prohlížeče
    if (!('Notification' in window)) {
        console.error("❌ Tento prohlížeč nepodporuje notifikace!");
        window.showUserMessage('Tvůj prohlížeč nepodporuje notifikace!', true);
        return false;
    }

    if (!('serviceWorker' in navigator)) {
        console.error("❌ Tento prohlížeč nepodporuje Service Workers!");
        window.showUserMessage('Tvůj prohlížeč nepodporuje Service Workers!', true);
        return false;
    }

    try {
        // Kontrola zda je Firebase Messaging k dispozici
        if (typeof firebase === 'undefined' || !firebase.messaging) {
            console.error("❌ Firebase Messaging není načten!");
            window.showUserMessage('Firebase Messaging není k dispozici!', true);
            return false;
        }

        // Inicializace Firebase Messaging
        messaging = firebase.messaging();
        console.log("✅ Firebase Messaging inicializováno");

        // Registrace Service Workeru
        await registerServiceWorker();

        // Vytvoření UI pro notifikace
        createNotificationUI();

        // Spuštění kontroly expirací
        startExpirationMonitoring();

        console.log("🚀 FCM notifikační systém plně operační!");
        return true;

    } catch (error) {
        console.error("❌ Chyba při inicializaci FCM:", error);
        window.showUserMessage('Chyba při spuštění notifikačního systému!', true);
        return false;
    }
};

/**
 * @function registerServiceWorker
 * @description Registruje Service Worker pro FCM
 */
async function registerServiceWorker() {
    try {
        // Relativní cesta - funguje na GitHubu i localhost
        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        console.log("✅ Service Worker zaregistrován:", registration);
        
        // Počkáme na aktivaci Service Workeru
        await navigator.serviceWorker.ready;
        console.log("✅ Service Worker je aktivní a připravený!");
        
        return registration;
    } catch (error) {
        console.error("❌ Chyba při registraci Service Workeru:", error);
        throw error;
    }
}

/**
 * @function requestNotificationPermission
 * @description Požádá uživatele o povolení notifikací
 */
window.requestNotificationPermission = async function() {
    console.log("🔔 Žádám o povolení notifikací...");

    try {
        const permission = await Notification.requestPermission();
        notificationPermission = permission;

        if (permission === 'granted') {
            console.log("✅ Notifikace povoleny!");
            window.showUserMessage('🎉 Notifikace povoleny! Budeš informován o léčích.');
            
            // Získáme FCM token
            await getFCMToken();
            
            // Aktualizujeme UI
            updateNotificationButton(true);
            
            // Odešleme testovací notifikaci
            await sendTestNotification();
            
        } else if (permission === 'denied') {
            console.log("❌ Notifikace zamítnuty!");
            window.showUserMessage('⚠️ Notifikace byly zamítnuty. Povol je v nastavení prohlížeče.', true);
            updateNotificationButton(false);
        } else {
            console.log("⏳ Notifikace zatím nepovoleny");
            updateNotificationButton(false);
        }

        return permission;

    } catch (error) {
        console.error("❌ Chyba při žádosti o notifikace:", error);
        window.showUserMessage('Chyba při žádosti o notifikace!', true);
        return 'denied';
    }
};

/**
 * @function getFCMToken
 * @description Získá FCM token pro zasílání notifikací
 */
async function getFCMToken() {
    try {
        // VAPID klíč z Firebase Console - Cloud Messaging
        // ✅ KLÍČ JE NASTAVEN! FCM notifikace jsou připraveny!
        const vapidKey = 'BEPlJPREV3rAUkaPNkM-rfeeA__X-vaw7ji_lojde4qVbOKv3j-JBr46l5Bf2ME-3BoTpev5goHrFVGuWD60YN0';

        fcmToken = await messaging.getToken({ 
            vapidKey: vapidKey,
            serviceWorkerRegistration: await navigator.serviceWorker.ready
        });

        if (fcmToken) {
            console.log("✅ FCM Token získán:", fcmToken);
            
            // Uložíme token do Firestore pro pozdější použití
            await saveFCMTokenToFirestore(fcmToken);
            
            return fcmToken;
        } else {
            console.log("❌ Nepodařilo se získat FCM token");
            return null;
        }

    } catch (error) {
        console.error("❌ Chyba při získávání FCM tokenu:", error);
        // Localhost chyba je normální - FCM potřebuje HTTPS
        if (error.code === 'messaging/token-subscribe-failed') {
            console.warn("⚠️ FCM token se nepodařilo získat - pravděpodobně běžíš na localhost. Na Firebase Hosting (HTTPS) bude fungovat!");
        }
        return null;
    }
}

/**
 * @function saveFCMTokenToFirestore
 * @description Uloží FCM token do Firestore
 */
async function saveFCMTokenToFirestore(token) {
    try {
        if (!db || !userId) {
            console.error("❌ Firestore nebo userId není k dispozici");
            return;
        }

        await db.collection('fcmTokens').doc(userId).set({
            token: token,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: userId
        }, { merge: true });

        console.log("✅ FCM token uložen do Firestore");

    } catch (error) {
        console.error("❌ Chyba při ukládání FCM tokenu:", error);
    }
}

/**
 * @function createNotificationUI
 * @description Vytvoří UI tlačítko pro správu notifikací
 */
function createNotificationUI() {
    const filterButtons = document.getElementById('filter-buttons');
    
    if (!filterButtons) {
        console.error("❌ Nenalezen element #filter-buttons");
        return;
    }

    // Zkontrolujeme zda tlačítko již neexistuje
    if (document.getElementById('notification-toggle')) {
        console.log("ℹ️ Notifikační tlačítko již existuje");
        return;
    }

    const notifButton = document.createElement('button');
    notifButton.id = 'notification-toggle';
    notifButton.innerHTML = '🔔 Povolit notifikace';
    notifButton.title = 'Klikni pro povolení notifikací o lécích';
    notifButton.style.cssText = `
        background-color: #ff6600;
        color: white;
        border: 2px solid #ff6600;
        padding: 10px 15px;
        cursor: pointer;
        font-size: 1em;
        border-radius: 5px;
        font-weight: bold;
        transition: all 0.3s ease;
        box-shadow: 0 0 15px rgba(255, 102, 0, 0.5);
    `;

    notifButton.addEventListener('click', async () => {
        await window.requestNotificationPermission();
    });

    filterButtons.appendChild(notifButton);
    
    // Zkontrolujeme aktuální stav povolení
    checkCurrentPermission();
}

/**
 * @function checkCurrentPermission
 * @description Zkontroluje současný stav povolení notifikací
 */
function checkCurrentPermission() {
    if (Notification.permission === 'granted') {
        updateNotificationButton(true);
        getFCMToken(); // Získáme token pokud už jsou notifikace povoleny
    } else if (Notification.permission === 'denied') {
        updateNotificationButton(false);
    }
}

/**
 * @function updateNotificationButton
 * @description Aktualizuje vzhled tlačítka podle stavu notifikací
 */
function updateNotificationButton(enabled) {
    const button = document.getElementById('notification-toggle');
    if (!button) return;

    if (enabled) {
        button.innerHTML = '✅ Notifikace zapnuty';
        button.style.backgroundColor = '#00cc00';
        button.style.borderColor = '#00cc00';
        button.title = 'Notifikace jsou aktivní';
        button.disabled = false;
    } else {
        button.innerHTML = '🔔 Povolit notifikace';
        button.style.backgroundColor = '#ff6600';
        button.style.borderColor = '#ff6600';
        button.title = 'Klikni pro povolení notifikací';
        button.disabled = false;
    }
}

/**
 * @function sendTestNotification
 * @description Pošle testovací notifikaci pro ověření funkčnosti
 * OPRAVA: Používá Service Worker API pro podporu mobilů
 */
async function sendTestNotification() {
    if (Notification.permission !== 'granted') return;

    try {
        // Získáme Service Worker registraci
        const registration = await navigator.serviceWorker.ready;
        
        // Na mobilu MUSÍME použít showNotification() místo new Notification()
        await registration.showNotification('🚀 Lékařský Protokol aktivní!', {
            body: 'Notifikace fungují perfektně, admirále Jiříku! 🖖',
            icon: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
            badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
            tag: 'test-notification',
            requireInteraction: false,
            vibrate: [200, 100, 200],
            data: {
                url: window.location.href
            }
        });

        console.log("✅ Testovací notifikace odeslána");
    } catch (error) {
        console.error("❌ Chyba při odesílání testovací notifikace:", error);
    }
}

/**
 * @function startExpirationMonitoring
 * @description Spustí monitoring expirace léků a odesílání notifikací
 */
function startExpirationMonitoring() {
    console.log("📊 Spouštím monitoring expirace léků...");

    // Kontrola každých 6 hodin
    const checkInterval = 6 * 60 * 60 * 1000; // 6 hodin v milisekundách

    // První kontrola ihned
    checkMedicineExpirations();

    // Opakovaná kontrola
    setInterval(() => {
        checkMedicineExpirations();
    }, checkInterval);

    console.log("✅ Monitoring expirací nastaven (kontrola každých 6 hodin)");
}

/**
 * @function checkMedicineExpirations
 * @description Kontroluje expiraci léků a odesílá notifikace
 */
async function checkMedicineExpirations() {
    console.log("🔍 Kontroluji expiraci léků...");

    if (Notification.permission !== 'granted') {
        console.log("⚠️ Notifikace nejsou povoleny, přeskakuji kontrolu");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Získáme aktuální léky z globální proměnné
    const medicines = window.currentMedicines || [];

    medicines.forEach(medicine => {
        if (!medicine.endDate) return; // Přeskočíme léky bez koncového data

        const endDate = new Date(medicine.endDate);
        endDate.setHours(0, 0, 0, 0);

        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Notifikace 7 dní před skončením
        if (diffDays === 7) {
            sendMedicineNotification(
                `⚠️ Lék ${medicine.name} končí za týden!`,
                `Zbývá 7 dní do skončení léku "${medicine.name}". Připrav si recept na nový!`,
                'warning'
            );
        }

        // Notifikace 3 dny před skončením
        if (diffDays === 3) {
            sendMedicineNotification(
                `🚨 Lék ${medicine.name} končí za 3 dny!`,
                `Pozor! Lék "${medicine.name}" brzy doběhne. Zajisti si nový včas!`,
                'urgent'
            );
        }

        // Notifikace v den skončení
        if (diffDays === 0) {
            sendMedicineNotification(
                `🔴 Lék ${medicine.name} končí DNES!`,
                `Dnes je poslední den léku "${medicine.name}". Nezapomeň si zajistit náhradu!`,
                'critical'
            );
        }

        // Notifikace po skončení (1 den po)
        if (diffDays === -1) {
            sendMedicineNotification(
                `❌ Lék ${medicine.name} skončil včera!`,
                `Lék "${medicine.name}" již není k dispozici. Doplň si zásoby, admirále!`,
                'expired'
            );
        }
    });

    console.log("✅ Kontrola expirací dokončena");
}

/**
 * @function sendMedicineNotification
 * @description Pošle notifikaci o léku
 * OPRAVA: Používá Service Worker API pro podporu mobilů
 */
async function sendMedicineNotification(title, body, type) {
    if (Notification.permission !== 'granted') return;

    try {
        // Získáme Service Worker registraci
        const registration = await navigator.serviceWorker.ready;
        
        // Ikony podle typu notifikace
        const icons = {
            'warning': '⚠️',
            'urgent': '🚨',
            'critical': '🔴',
            'expired': '❌',
            'info': 'ℹ️'
        };

        const icon = icons[type] || 'ℹ️';

        // Na mobilu MUSÍME použít showNotification()
        await registration.showNotification(title, {
            body: body,
            icon: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
            badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
            tag: `medicine-${type}-${Date.now()}`,
            requireInteraction: type === 'critical' || type === 'urgent',
            vibrate: type === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
            data: {
                type: type,
                timestamp: Date.now(),
                url: window.location.href
            }
        });

        console.log(`📤 Notifikace odeslána: ${type} - ${title}`);
    } catch (error) {
        console.error(`❌ Chyba při odesílání notifikace: ${error}`);
    }
}

/**
 * @function setupFCMMessageListener
 * @description Nastaví posluchač pro příchozí FCM zprávy
 * OPRAVA: Používá Service Worker API pro zobrazení notifikací
 */
function setupFCMMessageListener() {
    if (!messaging) {
        console.error("❌ Messaging není inicializováno");
        return;
    }

    // Posluchač pro zprávy když je aplikace v popředí
    messaging.onMessage(async (payload) => {
        console.log("📩 Přijata FCM zpráva:", payload);

        const notificationTitle = payload.notification?.title || 'Lékařský Protokol';
        const notificationOptions = {
            body: payload.notification?.body || 'Nová zpráva',
            icon: payload.notification?.icon || 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
            badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
            tag: payload.notification?.tag || 'fcm-notification',
            data: payload.data
        };

        // Zobrazíme notifikaci přes Service Worker (funguje i na mobilu)
        if (Notification.permission === 'granted') {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(notificationTitle, notificationOptions);
            } catch (error) {
                console.error("❌ Chyba při zobrazení notifikace:", error);
            }
        }
    });

    console.log("✅ FCM message listener nastaven");
}

/**
 * @function scheduleDailyReminder
 * @description Naplánuje denní připomínku (např. každé ráno v 8:00)
 */
function scheduleDailyReminder() {
    const now = new Date();
    const targetTime = new Date();
    
    // Nastavíme cílový čas na 8:00 ráno
    targetTime.setHours(8, 0, 0, 0);
    
    // Pokud je už po 8:00, nastavíme na zítřek
    if (now > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const timeUntilReminder = targetTime.getTime() - now.getTime();
    
    setTimeout(() => {
        sendMedicineNotification(
            '🌅 Dobré ráno, admirále!',
            'Nezapomeň zkontrolovat svůj lékařský protokol a vzít si předepsané léky! 💊',
            'info'
        );
        
        // Naplánujeme další připomínku za 24 hodin
        scheduleDailyReminder();
    }, timeUntilReminder);
    
    console.log(`⏰ Denní připomínka naplánována na: ${targetTime.toLocaleString('cs-CZ')}`);
}

// ═══════════════════════════════════════════════════════════════
// 🚀 AUTOMATICKÁ INICIALIZACE PO NAČTENÍ FIREBASE
// ═══════════════════════════════════════════════════════════════

// Počkáme na načtení Firebase a pak inicializujeme FCM
document.addEventListener('DOMContentLoaded', () => {
    // Počkáme chvíli, aby se Firebase stihlo inicializovat
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            window.initializeFCMNotifications().then(success => {
                if (success) {
                    setupFCMMessageListener();
                    scheduleDailyReminder();
                    console.log("🚀 JIŘÍKŮV FCM MODUL: Plně operační na warp 9.99! 🖖");
                }
            });
        } else {
            console.warn("⚠️ Firebase Messaging není k dispozici. Zkontroluj připojení skriptů.");
        }
    }, 2000); // Počkáme 2 sekundy na inicializaci Firebase
});

console.log("✅ jirkova-mes-zprava-o-lecich.js načten a připraven k akci!");
