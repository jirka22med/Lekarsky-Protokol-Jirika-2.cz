// JAVASCRIPT KÓD PRO FILTROVÁNÍ A ODPOČÍTÁVÁNÍ (zachováno z tvého původního kódu)
// Většina logiky pro CRUD operace s léky a interakci s Firestore je nyní v medicFirebaseFunctions.js
//

/**
 * @function filterTable
 * @description Filtruje řádky tabulky na základě zadaného statusu léku.
 * @param {string} status - Stav léku k filtrování ("Všechny", "Beru", "Používám", "Ukončeno").
 */
function filterTable(status) {
    const rows = document.querySelectorAll('#tabulka tr');
    rows.forEach(row => {
        const statusCell = row.querySelector('.status-cell'); // Použijeme třídu pro spolehlivější nalezení
        if (statusCell) {
            const rowStatus = statusCell.textContent.trim();
            if (status === 'Všechny' || rowStatus === status) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });

    const filterButtons = document.querySelectorAll('#filter-buttons button[data-status]');
    filterButtons.forEach(button => {
        if (button.dataset.status === status) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

/**
 * @function updateCountdown
 * @description Aktualizuje odpočítávání dní do dobrání/od dobrání léků.
 * OPRAVA: Přesný výpočet dní bez zaokrouhlovacích chyb.
 * Spouští se periodicky pro udržení aktuálních informací.
 */
function updateCountdown() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    document.querySelectorAll('.countdown-cell').forEach(cell => {
        const endDateString = cell.dataset.endDate;
        const startDateString = cell.dataset.startDate; // Propočítáme délku užívání

        if (endDateString) {
            const endDate = new Date(endDateString);

            if (isNaN(endDate.getTime())) {
                cell.textContent = '';
                return;
            }

            endDate.setHours(0, 0, 0, 0);

            // OPRAVA: Použití Math.round() místo Math.ceil() pro přesný výpočet
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                cell.textContent = `Zbývá ${diffDays} dní`;
                cell.style.color = '#FFFF00';
            } else if (diffDays === 0) {
                cell.textContent = `Dobrání dnes!`;
                cell.style.color = '#FF8C00';
            } else {
                cell.textContent = `Uplynulo ${Math.abs(diffDays)} dní`;
                cell.style.color = '#B0C4DE';
            }
        } else if (startDateString) {
            const startDate = new Date(startDateString);
            if (!isNaN(startDate.getTime())) {
                startDate.setHours(0, 0, 0, 0);
                
                // OPRAVA: Použití Math.floor() pro počet dní OD začátku
                const durationTime = today.getTime() - startDate.getTime();
                const durationDays = Math.floor(durationTime / (1000 * 60 * 60 * 24));
                
                if (durationDays >= 0) {
                    cell.textContent = `Užívá se ${durationDays} dní`;
                    cell.style.color = '#00ffcc'; // Zelená pro aktuálně používané léky bez konce
                } else {
                    cell.textContent = '';
                }
            } else {
                cell.textContent = '';
            }
        } else {
            cell.textContent = '';
        }
    });
}

// --- Funkce pro zobrazení/skrytí modalu ---
function showModal(isEditMode = false) {
    const modalOverlay = document.getElementById('medicine-modal-overlay');
    // Zde byla oprava: display: flex; se nastaví až zde
    modalOverlay.style.display = 'flex'; 
    modalOverlay.style.animation = 'fadeIn 0.3s ease-out forwards'; 

    // Vyčistí formulář POUZE pokud nejsme v režimu editace
    if (!isEditMode) {
        document.getElementById('medicine-form').reset(); 
        document.getElementById('medicine-id').value = ''; 
        updateColorPreview(); // Aktualizuje náhled barvy na "Žádná" pro nový lék
    }
    
    // Nastaví nadpis modalu
    document.querySelector('#medicine-modal-overlay h2').textContent = isEditMode ? 'Upravit lék' : 'Přidat nový lék';
    document.getElementById('medicine-name').focus(); // Zaměří na první pole
}

function hideModal() {
    const modalOverlay = document.getElementById('medicine-modal-overlay');
    modalOverlay.style.animation = 'fadeOut 0.3s ease-out forwards';
    modalOverlay.addEventListener('animationend', function handler() {
        modalOverlay.style.display = 'none';
        modalOverlay.style.animation = ''; // Reset animace
        modalOverlay.removeEventListener('animationend', handler);
    });
}

// --- Aktualizace náhledu barvy ve formuláři ---
function updateColorPreview() {
    const select = document.getElementById('medicine-color');
    const preview = document.getElementById('color-preview');
    const selectedValue = select.value;

    // Odebereme všechny předchozí třídy barev
    preview.classList.remove('green', 'blue', 'red');

    if (selectedValue === 'lek-stary-beru') {
        preview.classList.add('green');
    } else if (selectedValue === 'lek-novy-beru') {
        preview.classList.add('blue');
    } else if (selectedValue === 'lek-ukoncen') {
        preview.classList.add('red');
    }
    // Pokud je 'none', nic se nepřidá, zůstane jen rámeček
}


//
// SPUŠTĚNÍ KÓDU PO NAČTENÍ STRÁNKY
//
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializace Firebase a načtení dat léků z Firestore
    // Tato funkce je nyní definována v medicFirebaseFunctions.js
    window.initializeFirebaseAndLoadMedicines();

    filterTable('Všechny'); // Zobrazit všechna data po načtení

    // Přidáváme event listenery pro filtrační tlačítka
    document.querySelectorAll('#filter-buttons button[data-status]').forEach(button => {
        button.addEventListener('click', () => {
            filterTable(button.dataset.status);
        });
    });

    // Přidání event listeneru pro tlačítko "Přidat lék"
    document.getElementById('add-medicine-btn').addEventListener('click', () => {
        showModal(false); // Otevřít modal v režimu přidání
    });

    // Přidání event listeneru pro tlačítko "Zrušit" v modalu
    document.getElementById('cancel-medicine-btn').addEventListener('click', () => {
        hideModal();
    });

    // Přidání event listeneru pro změnu výběru barvy v modalu
    document.getElementById('medicine-color').addEventListener('change', updateColorPreview);


    // Aktualizace odpočítávání každou minutu
    updateCountdown();
    setInterval(updateCountdown, 60 * 1000);

    // FULLSCREEN FUNKCIONALITA (zachováno)
    const fullscreenToggleButton = document.getElementById('fullscreen-toggle');
    if (fullscreenToggleButton) {
        fullscreenToggleButton.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        });
    }

    document.addEventListener('fullscreenchange', () => {
        if (fullscreenToggleButton) {
            fullscreenToggleButton.classList.toggle('active', !!document.fullscreenElement);
            fullscreenToggleButton.title = document.fullscreenElement ? "Ukončit celou obrazovku (F)" : "Celá obrazovka (F)";
        }
    });

    // Klávesová zkratka F pro fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            if (fullscreenToggleButton) {
                fullscreenToggleButton.click();
            }
        }
    });
});

// Pomocná funkce pro zobrazení zpráv uživateli (podobná showNotification z trackeru)
window.showUserMessage = function(message, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${isError ? '#8B0000' : '#006400'};
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1001;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
    `;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.addEventListener('transitionend', () => messageDiv.remove());
    }, 3000);
};

// Připojení funkcí pro editaci a mazání na window pro přístup z HTML
window.editMedicine = async function(id) {
    console.log(`Editace léku s ID: ${id}`);
    const medicine = await window.getMedicineById(id); // Načte lék z Firestore
    if (medicine) {
        document.getElementById('medicine-id').value = medicine.id;
        document.getElementById('medicine-name').value = medicine.name;
        document.getElementById('medicine-start-date').value = medicine.startDate;
        document.getElementById('medicine-end-date').value = medicine.endDate || '';
        document.getElementById('medicine-status').value = medicine.status;
        document.getElementById('medicine-color').value = medicine.colorClass || 'none';
        updateColorPreview(); // Aktualizuje náhled barvy s načtenou barvou
        showModal(true); // Otevřít modal v režimu editace
    } else {
        window.showUserMessage('Lék nebyl nalezen pro editaci.', true);
    }
};

window.deleteMedicine = async function(id) {
    console.log(`Mazání léku s ID: ${id}`);
    // Místo confirm() používáme vlastní modalovou funkci pro potvrzení
    // Tím se vyhneme blokování UI v prohlížeči.
    if (await confirmAction('Opravdu chcete smazat tento lék? Tuto akci nelze vrátit zpět!')) {
        try {
            await window.deleteMedicineFromFirestore(id); // Smaže lék z Firestore
            window.showUserMessage('Lék byl úspěšně smazán!');
            // Renderování a filtrování se provede automaticky díky onSnapshot posluchači ve medicFirebaseFunctions.js
        } catch (error) {
            console.error("Chyba při mazání léku:", error);
            window.showUserMessage('Chyba při mazání léku!', true);
        }
    }
};

// Nová funkce pro vlastní potvrzovací dialog (nahrazuje confirm())
async function confirmAction(message) {
    return new Promise(resolve => {
        const confirmationModal = document.createElement('div');
        confirmationModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            backdrop-filter: blur(5px);
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: #1f2633;
            padding: 30px;
            border-radius: 15px;
            border: 2px solid #00d9ff;
            box-shadow: 0 0 25px rgba(0, 217, 255, 0.5);
            color: #f0f0f0;
            text-align: center;
            max-width: 400px;
            width: 90%;
        `;

        const messageParagraph = document.createElement('p');
        messageParagraph.textContent = message;
        messageParagraph.style.cssText = `
            font-size: 1.2em;
            margin-bottom: 25px;
            color: #00ff99;
        `;

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Ano, smazat!';
        confirmButton.style.cssText = `
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.1em;
            font-weight: bold;
            margin: 0 10px;
            background-color: #ff5555;
            color: #f0f0f0;
            box-shadow: 0 4px 8px rgba(255, 85, 85, 0.4);
            transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
        `;
        confirmButton.onmouseover = () => confirmButton.style.backgroundColor = '#cc4444';
        confirmButton.onmouseout = () => confirmButton.style.backgroundColor = '#ff5555';
        confirmButton.onclick = () => {
            document.body.removeChild(confirmationModal);
            resolve(true);
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Zrušit';
        cancelButton.style.cssText = `
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.1em;
            font-weight: bold;
            margin: 0 10px;
            background-color: #00aaff;
            color: #0b0f1a;
            box-shadow: 0 4px 8px rgba(0, 170, 255, 0.4);
            transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
        `;
        cancelButton.onmouseover = () => cancelButton.style.backgroundColor = '#00ccff';
        cancelButton.onmouseout = () => cancelButton.style.backgroundColor = '#00aaff';
        cancelButton.onclick = () => {
            document.body.removeChild(confirmationModal);
            resolve(false);
        };

        modalContent.appendChild(messageParagraph);
        modalContent.appendChild(confirmButton);
        modalContent.appendChild(cancelButton);
        confirmationModal.appendChild(modalContent);
        document.body.appendChild(confirmationModal);
    });
}