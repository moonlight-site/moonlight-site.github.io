// --- GLOBAL STATE ---
window.settingsReady = false; 

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay'); 
const cloakSelect = document.getElementById('cloak-select');
const customFields = document.getElementById('custom-cloak-fields');
const customTitleInput = document.getElementById('custom-title');
const customFaviconInput = document.getElementById('custom-favicon');

const panicToggle = document.getElementById('panic-key-toggle');
const panicKeyInput = document.getElementById('panic-key-input');
const panicKeyCodeHidden = document.getElementById('panic-key-code-hidden');
const panicTargetInput = document.getElementById('panic-target-input');
const panicWarning = document.getElementById('panic-warning'); 

const antiCloseToggle = document.getElementById('anti-close-toggle');

const aboutBlankBtn = document.getElementById('about-blank-btn');
const statusMsg = document.getElementById('status-msg');

const authModal = document.getElementById('auth-modal'); 
const modalCloseBtn = document.getElementById('modal-close-btn'); 

// Check for critical elements
const requiredElements = { loadingOverlay, cloakSelect, panicToggle, antiCloseToggle, authModal };
for (const key in requiredElements) {
    if (!requiredElements[key]) console.error(`[DOM ERROR] Missing: ${key}`);
}

// =========================================================================
// ## 🛠️ Utility Functions
// =========================================================================

function showStatus(message, isSuccess = true) {
    statusMsg.textContent = message;
    statusMsg.className = isSuccess ? 'status-msg success' : 'status-msg';
    statusMsg.style.display = 'block';
    setTimeout(() => { statusMsg.style.display = 'none'; }, 5000);
}

function showAuthModal() {
    if (authModal) authModal.style.display = 'flex'; 
    else alert("Please sign in to save settings.");
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        if (authModal) authModal.style.display = 'none';
    });
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => { func.apply(this, args); }, delay);
    };
}

// --- Listener Management ---

const saveListeners = {
    cloak: () => { /* Logic injected below */ },
    panicToggle: () => { /* Logic injected below */ },
    panicTarget: () => { /* Logic injected below */ },
    panicKey: (e) => { /* Logic injected below */ },
    antiClose: () => { /* Logic injected below */ },
};

function disableSaveListeners() {
    console.log('[LISTENERS] Disabling save listeners.');
    cloakSelect.removeEventListener('change', saveListeners.cloak);
    panicToggle.removeEventListener('change', saveListeners.panicToggle);
    panicTargetInput.removeEventListener('change', saveListeners.panicTarget);
    panicKeyInput.removeEventListener('keydown', saveListeners.panicKey);
    antiCloseToggle.removeEventListener('change', saveListeners.antiClose);
}

function enableSaveListeners() {
    console.log('[LISTENERS] Enabling save listeners.');
    cloakSelect.addEventListener('change', saveListeners.cloak);
    panicToggle.addEventListener('change', saveListeners.panicToggle);
    panicTargetInput.addEventListener('change', saveListeners.panicTarget);
    panicKeyInput.addEventListener('keydown', saveListeners.panicKey);
    antiCloseToggle.addEventListener('change', saveListeners.antiClose);
}

function checkConflictWarning() {
    if (!panicToggle || !antiCloseToggle || !panicWarning) return;
    const isConflict = panicToggle.checked && antiCloseToggle.checked;
    panicWarning.style.display = isConflict ? 'block' : 'none';
}

// =========================================================================
// ## 🚀 Core Logic
// =========================================================================

function loadSettingsFromCache() {
    // 1. Safety: Remove listeners so setting values doesn't trigger saves
    disableSaveListeners(); 
    
    const settings = window.moonlightSettings || {};
    console.log('[LOAD DATA] Applying:', settings);

    // --- Tab Cloak ---
    let selectedOption = settings.cloak_type;
    if (settings.cloak_type === 'preset') selectedOption = `preset:${settings.cloak_preset}`;

    // Validate option exists
    const validOption = Array.from(cloakSelect.options).find(opt => opt.value === selectedOption);
    cloakSelect.value = validOption ? selectedOption : 'off';
    
    // Custom Fields
    const isCustom = cloakSelect.value === 'custom';
    if (customFields) customFields.style.display = isCustom ? 'block' : 'none';
    customTitleInput.value = settings.cloak_custom_title || '';
    customFaviconInput.value = settings.cloak_custom_favicon || '';
    
    // --- Panic Key ---
    panicToggle.checked = settings.panic_key_enabled || false;
    panicTargetInput.value = settings.panic_key_target || 'https://www.google.com';
    const pCode = settings.panic_key_code || 123;
    panicKeyCodeHidden.value = pCode;
    panicKeyInput.value = `[Key Code: ${pCode}]`;

    // --- Anti Close ---
    antiCloseToggle.checked = settings.anti_tab_close || false;
    
    checkConflictWarning();
    
    // 2. Safety: Re-enable listeners
    enableSaveListeners(); 
    window.settingsReady = true;
    console.log('[SYNC] Ready. Save enabled.');
}

// ⚠️ FIXED: Removed duplicate function definition that was causing the error.
async function handleSave(updates, successMessage = 'Settings saved automatically!') {
    console.log('[SAVE ATTEMPT]', updates);

    // 1. Block if system isn't ready (Overlay still up)
    if (!window.settingsReady) {
        console.warn('[SAVE BLOCKED] Still loading.');
        return { success: false, reason: 'loading' };
    }

    // 2. Auth Check (The Fix)
    // We check Supabase auth OR if we have loaded settings data (which implies auth)
    let isAuthenticated = false;

    // Check A: Standard Supabase Auth
    if (window.supabase && window.supabase.auth && window.supabase.auth.user()) {
        isAuthenticated = true;
    } 
    // Check B: Fallback - If we have moonlightSettings with an ID, we are likely logged in
    else if (window.moonlightSettings && Object.keys(window.moonlightSettings).length > 0) {
        console.log('[AUTH CHECK] Supabase auth object missing, but settings data is present. Proceeding.');
        isAuthenticated = true;
    }

    if (!isAuthenticated) {
        console.warn('[SAVE BLOCKED] No user / Auth not ready.');
        showAuthModal();
        return { success: false, reason: 'unauthenticated' };
    }

    // 3. Proceed with Save
    const result = await window.updateMoonlightSettings(updates);
    
    if (result && result.success) {
        showStatus(successMessage, true);
        console.log('[SAVE SUCCESS]', updates);
    } else {
        showStatus('Save failed. Try refreshing.', false);
        console.error('[SAVE FAILED]', result);
    }
    
    checkConflictWarning(); 
    return result;
}


// =========================================================================
// ## 🕹️ Event Definitions
// =========================================================================

const debouncedSaveCustomCloak = debounce(() => {
    if (cloakSelect.value !== 'custom') return;
    const updates = {
        cloak_type: 'custom',
        cloak_custom_title: customTitleInput.value.trim(),
        cloak_custom_favicon: customFaviconInput.value.trim(),
        cloak_preset: null,
    };
    handleSave(updates, 'Custom cloak saved.');
}, 500);

customTitleInput.addEventListener('input', debouncedSaveCustomCloak);
customFaviconInput.addEventListener('input', debouncedSaveCustomCloak);

// Mapping logic to the listeners object we created earlier
saveListeners.cloak = () => {
    const val = cloakSelect.value;
    const updates = {};
    
    if (customFields) customFields.style.display = (val === 'custom') ? 'block' : 'none';

    if (val === 'off') {
        updates.cloak_type = 'off'; updates.cloak_preset = null;
    } else if (val.startsWith('preset:')) {
        updates.cloak_type = 'preset'; updates.cloak_preset = val.split(':')[1];
    } else if (val === 'custom') {
        updates.cloak_type = 'custom';
        updates.cloak_custom_title = customTitleInput.value.trim();
        updates.cloak_custom_favicon = customFaviconInput.value.trim();
    }
    handleSave(updates);
};

saveListeners.panicToggle = () => handleSave({ panic_key_enabled: panicToggle.checked });
saveListeners.panicTarget = () => handleSave({ panic_key_target: panicTargetInput.value.trim() });
saveListeners.antiClose = () => handleSave({ anti_tab_close: antiCloseToggle.checked });

saveListeners.panicKey = (e) => {
    e.preventDefault();
    const code = e.keyCode;
    let name = e.key === ' ' ? 'Spacebar' : e.key;
    if (e.ctrlKey) name = `Ctrl + ${name}`;
    if (e.shiftKey) name = `Shift + ${name}`;
    
    panicKeyInput.value = `[${name} | Code: ${code}]`;
    panicKeyCodeHidden.value = code;
    handleSave({ panic_key_code: code });
};

aboutBlankBtn.addEventListener('click', () => {
    const win = window.open('about:blank', '_blank');
    if (win) {
        win.document.write(`<script>window.location.replace('${window.location.href}');<\/script>`);
        win.document.close();
    } else {
        alert("Allow popups to use this feature.");
    }
});

// =========================================================================
// ## 🛑 INITIALIZATION (The "Bulletproof" Part)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Ensure overlay is ON and listeners OFF
    if(loadingOverlay) loadingOverlay.style.display = 'flex';
    disableSaveListeners();
    
    console.log('[INIT] Waiting for Supabase...');

    window.addEventListener('supabase-ready', () => {
        console.log('[INIT] Supabase loaded. Starting 2.5s stabilization timer...');

        // 2. FORCE WAIT - 2500ms
        setTimeout(() => {
            console.log('[INIT] Timer done. Hydrating UI.');

            // 3. Load Data
            loadSettingsFromCache();

            // 4. Hide Overlay
            if(loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
            }

        }, 2500); // <--- CHANGE THIS TO 5000 IF YOU WANT 5 SECONDS
    }, { once: true });
});