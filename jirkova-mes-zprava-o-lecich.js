/**
 * ═══════════════════════════════════════════════════════════════
 * 🚀 JIŘÍKŮV LÉKAŘSKÝ NOTIFIKAČNÍ SYSTÉM - FCM MODUL V2.0 🚀
 * ═══════════════════════════════════════════════════════════════
 * VYLEPŠENÁ VERZE - Inteligentní notifikace o lécích
 * - Denní přehled aktivních léků
 * - Upozornění na expiraci
 * - Ignoruje ukončené léky
 * - Podporuje "Beru" i "Používám"
 * ═══════════════════════════════════════════════════════════════
 */

console.log("🚀 JIŘÍKŮV FCM MODUL V2.0: Inicializace torpédového systému notifikací...");

// Globální proměnné pro FCM
let messaging = null;
let notificationPermission = 'default';
let fcmToken = null;

// Sledování odeslaných notifikací (aby se neopakovaly)
let sentNotifications = new Set();

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

        // Počkáme na načtení dat z Firestore
        // Kontrola se spustí až když budou data připravena
        waitForMedicinesData().then(() => {
            // Spuštění kontroly expirací
            startExpirationMonitoring();
        });

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
        const vapidKey = 'BEPlJPREV3rAUkaPNkM-rfeeA__X-vaw7ji_lojde4qVbOKv3j-JBr46l5Bf2ME-3BoTpev5goHrFVGuWD60YN0';

        fcmToken = await messaging.getToken({ 
            vapidKey: vapidKey,
            serviceWorkerRegistration: await navigator.serviceWorker.ready
        });

        if (fcmToken) {
            console.log("✅ FCM Token získán:", fcmToken);
            await saveFCMTokenToFirestore(fcmToken);
            return fcmToken;
        } else {
            console.log("❌ Nepodařilo se získat FCM token");
            return null;
        }

    } catch (error) {
        console.error("❌ Chyba při získávání FCM tokenu:", error);
        if (error.code === 'messaging/token-subscribe-failed') {
            console.warn("⚠️ FCM token se nepodařilo získat - pravděpodobně běžíš na localhost.");
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
    checkCurrentPermission();
}

/**
 * @function checkCurrentPermission
 * @description Zkontroluje současný stav povolení notifikací
 */
function checkCurrentPermission() {
    if (Notification.permission === 'granted') {
        updateNotificationButton(true);
        getFCMToken();
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
 */
async function sendTestNotification() {
    if (Notification.permission !== 'granted') return;

    try {
        const registration = await navigator.serviceWorker.ready;
        
        await registration.showNotification('🚀 Lékařský Protokol aktivní!', {
            body: 'Notifikace fungují perfektně, admirále Jiříku! 🖖',
            icon: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
            badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
            tag: 'test-notification',
            requireInteraction: false,
            vibrate: [200, 100, 200],
            data: { url: window.location.href }
        });

        console.log("✅ Testovací notifikace odeslána");
    } catch (error) {
        console.error("❌ Chyba při odesílání testovací notifikace:", error);
    }
}

/**
 * @function waitForMedicinesData
 * @description Počká na načtení dat z Firestore
 */
async function waitForMedicinesData() {
    return new Promise((resolve) => {
        // Pokud data již jsou, vyřešíme hned
        if (window.currentMedicines && window.currentMedicines.length > 0) {
            console.log("📋 Data léků již načtena, spouštím monitoring");
            resolve();
            return;
        }

        // Jinak počkáme max 10 sekund
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.currentMedicines && window.currentMedicines.length > 0) {
                console.log("📋 Data léků načtena, spouštím monitoring");
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= 20) {
                console.warn("⚠️ Data léků se nenačetla do 10 sekund, spouštím monitoring stejně");
                clearInterval(checkInterval);
                resolve();
            }
        }, 500); // Kontrola každých 500ms
    });
}

/**
 * @function startExpirationMonitoring
 * @description Spustí monitoring expirace léků a odesílání notifikací
 */
function startExpirationMonitoring() {
    console.log("📊 Spouštím monitoring expirace léků...");

    // Kontrola každých 6 hodin
    const checkInterval = 6 * 60 * 60 * 1000;

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
 * NOVÁ LOGIKA: Ignoruje "Ukončeno", hlásí "Beru" a "Používám"
 */
async function checkMedicineExpirations() {
    console.log("🔍 Kontroluji expiraci léků...");

    if (Notification.permission !== 'granted') {
        console.log("⚠️ Notifikace nejsou povoleny, přeskakuji kontrolu");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toDateString();

    // Získáme aktuální léky z globální proměnné
    const medicines = window.currentMedicines || [];

    // FILTRUJEME: Pouze "Beru" a "Používám"
    const activeMedicines = medicines.filter(medicine => 
        medicine.status === 'Beru' || medicine.status === 'Používám'
    );

    console.log(`📋 Aktivních léků k monitorování: ${activeMedicines.length}`);

    activeMedicines.forEach(medicine => {
        if (!medicine.endDate) {
            console.log(`ℹ️ ${medicine.name} - bez koncového data, přeskakuji`);
            return;
        }

        const endDate = new Date(medicine.endDate);
        endDate.setHours(0, 0, 0, 0);

        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Vytvoříme unikátní klíč pro notifikaci
        const notifKey = `${medicine.id}-${diffDays}-${todayKey}`;

        // Notifikace 7 dní před skončením
        if (diffDays === 7 && !sentNotifications.has(notifKey)) {
            sendMedicineNotification(
                `⚠️ Lék končí za týden`,
                `${medicine.name}\nZbývá 7 dní do dobrání.\nPřiprav si recept na nový!`,
                'warning',
                medicine
            );
            sentNotifications.add(notifKey);
        }

        // Notifikace 3 dny před skončením
        if (diffDays === 3 && !sentNotifications.has(notifKey)) {
            sendMedicineNotification(
                `🚨 Lék brzy končí!`,
                `${medicine.name}\nZbývají jen 3 dny!\nZajisti si nový VČAS, admirále!`,
                'urgent',
                medicine
            );
            sentNotifications.add(notifKey);
        }

        // Notifikace v den skončení
        if (diffDays === 0 && !sentNotifications.has(notifKey)) {
            sendMedicineNotification(
                `🔴 Lék končí DNES!`,
                `${medicine.name}\nDnes je poslední den!\nNezapomeň si zajistit náhradu!`,
                'critical',
                medicine
            );
            sentNotifications.add(notifKey);
        }

        // Notifikace 1 den po skončení
        if (diffDays === -1 && !sentNotifications.has(notifKey)) {
            sendMedicineNotification(
                `❌ Lék skončil včera!`,
                `${medicine.name}\nLék již není k dispozici.\nDoplň si zásoby, admirále!`,
                'expired',
                medicine
            );
            sentNotifications.add(notifKey);
        }
    });

    console.log("✅ Kontrola expirací dokončena");
}

/**
 * @function sendMedicineNotification
 * @description Pošle notifikaci o léku
 */
async function sendMedicineNotification(title, body, type, medicine) {
    if (Notification.permission !== 'granted') return;

    try {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, {
            body: body,
            icon: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
            badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
            tag: `medicine-${type}-${medicine.id}`,
            requireInteraction: type === 'critical' || type === 'urgent',
            vibrate: type === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
            data: {
                type: type,
                medicineId: medicine.id,
                medicineName: medicine.name,
                timestamp: Date.now(),
                url: window.location.href
            }
        });

        console.log(`📤 Notifikace odeslána: ${type} - ${medicine.name}`);
    } catch (error) {
        console.error(`❌ Chyba při odesílání notifikace:`, error);
    }
}

/**
 * @function setupFCMMessageListener
 * @description Nastaví posluchač pro příchozí FCM zprávy
 */
function setupFCMMessageListener() {
    if (!messaging) {
        console.error("❌ Messaging není inicializováno");
        return;
    }

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
 * @description Naplánuje denní připomínku s přehledem aktivních léků
 * NOVÁ VERZE: Zobrazuje seznam léků "Beru" a "Používám" se zbývajícími dny
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
        sendDailyMedicineReminder();
        
        // Naplánujeme další připomínku za 24 hodin
        scheduleDailyReminder();
    }, timeUntilReminder);
    
    console.log(`⏰ Denní připomínka naplánována na: ${targetTime.toLocaleString('cs-CZ')}`);
}

/**
 * @function sendDailyMedicineReminder
 * @description Pošle denní přehled aktivních léků
 * NOVÁ FUNKCE: Inteligentní přehled léků k užití
 */
async function sendDailyMedicineReminder() {
    if (Notification.permission !== 'granted') return;

    const medicines = window.currentMedicines || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filtrujeme pouze "Beru" a "Používám"
    const activeMedicines = medicines.filter(medicine => 
        medicine.status === 'Beru' || medicine.status === 'Používám'
    );

    if (activeMedicines.length === 0) {
        console.log("ℹ️ Žádné aktivní léky k připomínce");
        return;
    }

    // Vytvoříme seznam léků s počtem zbývajících dní
    let medicineList = '';
    let warningList = '';

    activeMedicines.forEach(medicine => {
        const emoji = medicine.status === 'Beru' ? '💊' : '🔵';
        
        if (medicine.endDate) {
            const endDate = new Date(medicine.endDate);
            endDate.setHours(0, 0, 0, 0);
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            medicineList += `${emoji} ${medicine.name} - zbývá ${diffDays} dní\n`;
            
            // Přidáme varování pro léky končící brzy
            if (diffDays <= 7 && diffDays > 0) {
                warningList += `⚠️ ${medicine.name} - zbývá ${diffDays} dní\n`;
            } else if (diffDays <= 0) {
                warningList += `🔴 ${medicine.name} - SKONČENO!\n`;
            }
        } else {
            // Lék bez koncového data
            medicineList += `${emoji} ${medicine.name} - dlouhodobě\n`;
        }
    });

    // Sestavíme zprávu
    let notificationBody = `🌅 Dobré ráno, admirále!\n\n`;
    notificationBody += `Dnes užíváš:\n${medicineList}`;
    
    if (warningList) {
        notificationBody += `\n⚠️ Upozornění:\n${warningList}`;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        await registration.showNotification('🌅 Ranní přehled léků', {
            body: notificationBody.trim(),
            icon: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_192x192.png',
            badge: 'https://raw.githubusercontent.com/jirka22med/Lekarsky-Protokol-Jirika-2.cz/11b61ddd0c3cf63536e88c9ffdc2acb93321f095/image_72x72.png',
            tag: 'daily-reminder',
            requireInteraction: false,
            vibrate: [200, 100, 200],
            data: {
                type: 'daily-reminder',
                timestamp: Date.now(),
                url: window.location.href
            }
        });

        console.log("📤 Denní přehled léků odeslán");
    } catch (error) {
        console.error("❌ Chyba při odesílání denního přehledu:", error);
    }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 AUTOMATICKÁ INICIALIZACE PO NAČTENÍ FIREBASE
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            window.initializeFCMNotifications().then(success => {
                if (success) {
                    setupFCMMessageListener();
                    scheduleDailyReminder();
                    console.log("🚀 JIŘÍKŮV FCM MODUL V2.0: Plně operační na warp 9.99! 🖖");
                }
            });
        } else {
            console.warn("⚠️ Firebase Messaging není k dispozici. Zkontroluj připojení skriptů.");
        }
    }, 2000);
});

console.log("✅ jirkova-mes-zprava-o-lecich.js V2.0 načten a připraven k akci!");
