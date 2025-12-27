// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5gSU4hC8ZuC9ofefCcRj9sOY6ID3LQFQ",
  authDomain: "medic-protokol-jirik.firebaseapp.com",
  projectId: "medic-protokol-jirik",
  storageBucket: "medic-protokol-jirik.firebasestorage.app",
  messagingSenderId: "162734152774",
  appId: "1:162734152774:web:31ab98174d2d04f9f1fe47",
  measurementId: "G-0Z3TNN5K88"
};
console.log("medicFirebaseFunctions.js: Načítám konfigurační objekt Firebase.", firebaseConfig.projectId);

// Deklarace globálních proměnných pro Firebase
let app;
let db;
let auth;
let userId; // Uložení ID uživatele

// Proměnná pro ukládání aktuálních léků pro filtrování
window.currentMedicines = [];

/**
 * @function checkFirebaseConfiguration
 * @description Kontroluje, zda je Firebase správně nakonfigurováno
 */
window.checkFirebaseConfiguration = function() {
    console.log("Kontrolujem Firebase konfiguraci...");
    
    // Kontrola, zda jsou načteny Firebase SDK
    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK není načteno!");
        return false;
    }
    
    // Kontrola konfigurace
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
        console.error("Chybí povinná pole v konfiguraci:", missingFields);
        return false;
    }
    
    console.log("Firebase konfigurace je v pořádku");
    return true;
};

/**
 * @function initializeFirebaseAndLoadMedicines
 * @description Inicializuje Firebase aplikaci, provede anonymní přihlášení
 * a nastaví posluchače pro automatickou synchronizaci léků z Firestore.
 */
window.initializeFirebaseAndLoadMedicines = async function() {
    console.log("initializeFirebaseAndLoadMedicines: Spouštím inicializaci Firebase a načítání léků.");
    
    // Nejprve zkontroluj konfiguraci
    if (!window.checkFirebaseConfiguration()) {
        window.showUserMessage("Chyba: Firebase není správně nakonfigurováno!", true);
        return;
    }
    
    try {
        // Kontrola, zda už není inicializováno, aby se předešlo chybám
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
            console.log("initializeFirebaseAndLoadMedicines: Firebase aplikace inicializována.");
        } else {
            app = firebase.app();
            console.log("initializeFirebaseAndLoadMedicines: Firebase aplikace již byla inicializována.");
        }

        db = firebase.firestore();
        auth = firebase.auth();
        console.log("initializeFirebaseAndLoadMedicines: Firestore a Auth služby připraveny.");

        // Anonymní přihlášení s lepším error handlingem
        try {
            const userCredential = await auth.signInAnonymously();
            userId = userCredential.user.uid;
            console.log(`initializeFirebaseAndLoadMedicines: Uživatel anonymně přihlášen s UID: ${userId}`);
        } catch (authError) {
            console.error("Chyba při anonymním přihlášení:", authError);
            
            // Specifické chybové hlášky
            if (authError.code === 'auth/operation-not-allowed') {
                throw new Error("Anonymní přihlašování není povoleno. Povolte ho v Firebase Console -> Authentication -> Sign-in method -> Anonymous.");
            } else if (authError.code === 'auth/internal-error') {
                throw new Error("Interní chyba Firebase. Zkontrolujte konfiguraci v Firebase Console - povolte Anonymous přihlašování.");
            } else if (authError.code === 'auth/api-key-not-valid') {
                throw new Error("Neplatný API klíč. Zkontrolujte Firebase konfiguraci.");
            } else {
                throw new Error(`Chyba přihlášení: ${authError.message}`);
            }
        }

        // Nastavení posluchače na kolekci léků
        // Používáme onSnapshot pro real-time aktualizace
        db.collection('medicines')
          .orderBy('name') // Řazení podle názvu
          .onSnapshot(snapshot => {
            console.log("medicines snapshot: Nová data léků přišla z Firestore.");
            const medicines = [];
            snapshot.forEach(doc => {
                medicines.push({ id: doc.id, ...doc.data() });
            });
            window.currentMedicines = medicines; // Uložíme aktuální data
            window.renderMedicines(medicines); // Vykreslíme tabulku
            // Po vykreslení znovu aplikujeme aktivní filtr
            const activeFilterButton = document.querySelector('#filter-buttons button.active');
            if (activeFilterButton) {
                window.filterTable(activeFilterButton.dataset.status);
            }
            window.updateCountdown(); // Aktualizujeme odpočítávání
            window.showUserMessage('Data léků synchronizována s cloudem.');
        }, error => {
            console.error("Chyba při načítání léků z Firestore:", error);
            
            // Specifické chybové hlášky pro Firestore
            if (error.code === 'permission-denied') {
                window.showUserMessage('Nemáte oprávnění k přístupu k datům!', true);
            } else if (error.code === 'unavailable') {
                window.showUserMessage('Databáze je momentálně nedostupná. Zkuste to znovu později.', true);
            } else {
                window.showUserMessage('Chyba při synchronizaci dat s cloudem!', true);
            }
        });

    } catch (error) {
        console.error("Chyba při inicializaci Firebase nebo přihlášení:", error);
        window.showUserMessage(error.message || "Kritická chyba: Nepodařilo se připojit k databázi nebo přihlásit!", true);
    }
};

/**
 * @function saveMedicineToFirestore
 * @description Uloží nový lék nebo aktualizuje existující v Firestore.
 * @param {Object} medicineData - Objekt s daty léku.
 * @param {string} [id] - Volitelné ID dokumentu pro aktualizaci existujícího léku.
 */
window.saveMedicineToFirestore = async function(medicineData, id = null) {
    console.log(`saveMedicineToFirestore: Pokus o uložení/aktualizaci léku. ID: ${id}, Data:`, medicineData);
    if (!db) {
        console.error("Firestore není inicializováno.");
        throw new Error("Firestore není připraveno.");
    }

    try {
        if (id) {
            // Aktualizace existujícího dokumentu
            await db.collection('medicines').doc(id).set(medicineData, { merge: true });
            console.log(`Lék s ID ${id} byl úspěšně aktualizován.`);
        } else {
            // Přidání nového dokumentu
            await db.collection('medicines').add(medicineData);
            console.log("Nový lék byl úspěšně přidán do Firestore.");
        }
    } catch (error) {
        console.error("Chyba při ukládání léku do Firestore:", error);
        throw error;
    }
};

/**
 * @function getMedicineById
 * @description Načte lék z Firestore podle ID.
 * @param {string} id - ID dokumentu léku.
 * @returns {Object|null} Objekt s daty léku nebo null, pokud lék neexistuje.
 */
window.getMedicineById = async function(id) {
    console.log(`getMedicineById: Načítám lék s ID: ${id}`);
    if (!db) {
        console.error("Firestore není inicializováno.");
        return null;
    }
    try {
        const doc = await db.collection('medicines').doc(id).get();
        if (doc.exists) {
            console.log(`Lék ${id} načten:`, doc.data());
            return { id: doc.id, ...doc.data() };
        } else {
            console.log(`Lék s ID ${id} nebyl nalezen.`);
            return null;
        }
    } catch (error) {
        console.error("Chyba při načítání léku podle ID:", error);
        return null;
    }
};

/**
 * @function deleteMedicineFromFirestore
 * @description Smaže lék z Firestore podle ID.
 * @param {string} id - ID dokumentu léku ke smazání.
 */
window.deleteMedicineFromFirestore = async function(id) {
    console.log(`deleteMedicineFromFirestore: Mažu lék s ID: ${id}`);
    if (!db) {
        console.error("Firestore není inicializováno.");
        throw new Error("Firestore není připraveno.");
    }
    try {
        await db.collection('medicines').doc(id).delete();
        console.log(`Lék s ID ${id} byl úspěšně smazán z Firestore.`);
    } catch (error) {
        console.error("Chyba při mazání léku z Firestore:", error);
        throw error;
    }
};

/**
 * @function renderMedicines
 * @description Vykreslí léky do tabulky na HTML stránce.
 * @param {Array<Object>} medicines - Pole objektů léků k zobrazení.
 */
window.renderMedicines = function(medicines) {
    console.log("renderMedicines: Vykresluji léky do tabulky.", medicines);
    const tableBody = document.getElementById('tabulka');
    tableBody.innerHTML = ''; // Vyčistí tabulku

    if (medicines.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Žádné léky k zobrazení.</td></tr>';
        return;
    }

    // Řazení léků - prioritně "Beru", pak "Používám", nakonec "Ukončeno", a v rámci statusu abecedně
    medicines.sort((a, b) => {
        const statusOrder = { 'Beru': 1, 'Používám': 2, 'Ukončeno': 3 };
        const statusCompare = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        if (statusCompare !== 0) return statusCompare;
        return a.name.localeCompare(b.name);
    });

    medicines.forEach(medicine => {
        const row = document.createElement('tr');
        // Přidáme třídu pro barvu řádku, pokud je definovaná
        if (medicine.colorClass && medicine.colorClass !== 'none') {
            row.classList.add(medicine.colorClass);
        }

        let dateRange = '';
        if (medicine.startDate && medicine.endDate) {
            dateRange = `${formatDate(medicine.startDate)} / ${formatDate(medicine.endDate)}`;
        } else if (medicine.startDate) {
            dateRange = `${formatDate(medicine.startDate)} / `;
        }

        row.innerHTML = `
            <td>${medicine.name}</td>
            <td>${dateRange}</td>
            <td class="status-cell">${medicine.status}</td>
            <td class="countdown-cell" data-end-date="${medicine.endDate || ''}" data-start-date="${medicine.startDate || ''}"></td>
            <td>
                <button onclick="window.editMedicine('${medicine.id}')" title="Upravit">✏️</button>
                <button onclick="window.deleteMedicine('${medicine.id}')" title="Smazat">🗑️</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    console.log("renderMedicines: Léky vykresleny.");
};

/**
 * @function formatDate
 * @description Formátuje datum ze stringu YYYY-MM-DD na DD.MM.YYYY.
 * @param {string} dateString - Datum ve formátu YYYY-MM-DD.
 * @returns {string} Formátované datum.
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${parseInt(day)}.${parseInt(month)}.${year}`;
}

// --- Zpracování formuláře pro přidání/editaci léku ---
document.addEventListener('DOMContentLoaded', () => {
    const medicineForm = document.getElementById('medicine-form');
    medicineForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('medicine-id').value;
        const name = document.getElementById('medicine-name').value;
        const startDate = document.getElementById('medicine-start-date').value;
        const endDate = document.getElementById('medicine-end-date').value;
        const status = document.getElementById('medicine-status').value;
        const colorClass = document.getElementById('medicine-color').value;

        const medicineData = {
            name,
            startDate,
            endDate: endDate || null, // Uložíme null, pokud je pole prázdné
            status,
            colorClass // Uložíme vybranou třídu pro barvu
        };

        try {
            await window.saveMedicineToFirestore(medicineData, id);
            window.showUserMessage(`Lék "${name}" byl úspěšně uložen!`);
            hideModal(); // Skryje modal po uložení
        } catch (error) {
            console.error("Chyba při ukládání léku:", error);
            window.showUserMessage('Chyba při ukládání léku!', true);
        }
    });
});