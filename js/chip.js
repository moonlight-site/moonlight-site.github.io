document.addEventListener('DOMContentLoaded', async () => {
  // ---- Inject Font Awesome if not present ----
  if (!document.querySelector('link[data-fa-injected]')) {
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
    faLink.crossOrigin = 'anonymous';
    faLink.setAttribute('data-fa-injected', '1');
    document.head.appendChild(faLink);
  }

  // ---- Inject Cloudflare Turnstile bot protection ----
  if (!document.querySelector('script[data-turnstile-injected]')) {
    const turnstileScript = document.createElement('script');
    turnstileScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    turnstileScript.setAttribute('data-turnstile-injected', '1');
    turnstileScript.async = true;
    turnstileScript.defer = true;
    document.head.appendChild(turnstileScript);
  }

  // ---- Global Turnstile token getter ----
  window.getTurnstileToken = async () => {
    if (typeof window.turnstile === 'undefined') {
      console.warn('Turnstile not loaded yet');
      return null;
    }
    try {
      const token = window.turnstile.getResponse();
      if (!token) {
        console.warn('Turnstile token not available; widget may not be rendered');
      }
      return token || null;
    } catch (e) {
      console.error('Error getting Turnstile token:', e);
      return null;
    }
  };

  // ---- Create Navbar Chip (Left) ----
  const navbarWrapper = document.createElement('div');
  navbarWrapper.id = 'chip-navbar-wrapper';
  navbarWrapper.innerHTML = `
    <div class="chip-inner" tabindex="0" role="button" aria-label="Open quick links">
      <img class="chip-img" src="/branding/logo.png" alt="chip" />
      <div class="links-row" aria-hidden="true">
        <a class="chip-link" href="/home" title="home"><i class="fa fa-house"></i></a>
        <a class="chip-link" href="/moon" title="moon ai"><i class="fa-solid fa-robot"></i></a>
        <a class="chip-link" href="/games" title="games"><i class="fa fa-gamepad"></i></a>
        <a class="chip-link" href="/chat" title="chat"><i class="fa-solid fa-comments"></i></a>
        <a class="chip-link" href="/contact" title="contact"><i class="fa-solid fa-phone"></i></a>
        <a class="chip-link" href="/settings" title="settings"><i class="fa-solid fa-gear"></i></a>
      </div>
    </div>
  `;
  Object.assign(navbarWrapper.style, {
    position: 'fixed',
    left: '20px',
    bottom: '20px',
    zIndex: 99999,
    pointerEvents: 'auto',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
  });
  document.body.appendChild(navbarWrapper);

  // ---- Create Profile Chip (Right) ----
  const profileWrapper = document.createElement('div');
  profileWrapper.id = 'chip-profile-wrapper';
  profileWrapper.innerHTML = `
    <div class="chip-inner" tabindex="0" role="button" aria-label="User profile">
      <img class="chip-img" src="/branding/default-pfp.png" alt="User Profile" />
      <div class="profile-info" aria-hidden="true">
        <span class="username">Sign Up</span>
      </div>
    </div>
  `;
  Object.assign(profileWrapper.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: 99998,
    pointerEvents: 'auto',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
  });
  document.body.appendChild(profileWrapper);

  // ---- Unified Styles ----
  const style = document.createElement('style');
  style.textContent = `
    .chip-inner {
      z-index:999999;
      display:flex;
      align-items:center;
      gap:8px;
      width:50px;
      height:50px;
      padding:5px;
      border-radius:50%;
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 6px 20px rgba(0,0,0,0.45);
      transition: all 250ms cubic-bezier(.2,.9,.2,1);
      overflow:hidden;
      cursor:pointer;
    }
    .chip-inner .chip-img {
      width:40px;
      height:40px;
      border-radius:50%;
      flex:0 0 40px;
      object-fit:cover;
      transition: transform 220ms ease;
    }
    .chip-inner .links-row, .chip-inner .profile-info {
      opacity:0;
      transform:translateX(6px);
      transition: opacity 220ms ease, transform 220ms ease;
      white-space: nowrap;
      font-size: 14px;
      color:#fff;
      margin-left: 6px;
    }
    .chip-inner .links-row {
      display:flex;
      gap:10px;
      align-items:center;
    }
    .chip-link {
      width:44px;
      height:44px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      background: rgba(255,255,255,0.06);
      color:#fff;
      text-decoration:none;
      font-size:18px;
      border:1px solid rgba(255,255,255,0.06);
      transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease;
      box-shadow:0 6px 14px rgba(0,0,0,0.35);
    }
    .chip-link i { pointer-events:none; }
    .chip-link:hover {
      transform: translateY(-6px) scale(1.06);
      background: rgba(255,255,255,0.12);
      box-shadow: 0 10px 24px rgba(0,0,0,0.5);
    }
    .chip-inner.expanded {
      width:auto;
      padding:10px 14px;
      min-width:120px;
      height:64px;
      border-radius:18px;
      background: rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
    }
    .chip-inner.expanded .chip-img { transform: scale(0.9); }
    .chip-inner.expanded .links-row, .chip-inner.expanded .profile-info { opacity:1; transform:translateX(0); }
    .chip-inner:focus { outline:none; box-shadow: 0 10px 30px rgba(0,0,0,0.6),0 0 0 3px rgba(255,255,255,0.02); }
    @media(max-width:420px) {
      .chip-inner.expanded { min-width:100px; }
      .chip-img { width:36px; height:36px; }
      .chip-link { width:38px; height:38px; font-size:16px; }
    }
  `;
  document.head.appendChild(style);

  // ---- Expand/Collapse behavior ----
  function setupChip(chip) {
    const inner = chip.querySelector('.chip-inner');
    const extra = chip.querySelector('.links-row') || chip.querySelector('.profile-info');
    function expand() { inner.classList.add('expanded'); extra.setAttribute('aria-hidden','false'); }
    function collapse() { inner.classList.remove('expanded'); extra.setAttribute('aria-hidden','true'); }
    inner.addEventListener('mouseenter', expand);
    inner.addEventListener('mouseleave', collapse);
    inner.addEventListener('focus', expand);
    inner.addEventListener('blur', collapse);
    let tapped = false;
    inner.addEventListener('click', () => {
      tapped = !tapped;
      tapped ? expand() : collapse();
      if (chip.id === 'chip-profile-wrapper') window.location.href = '/auth';
    });
  }

  setupChip(navbarWrapper);
  setupChip(profileWrapper);

  // ---- Supabase UMD loader + global client ----
  // We'll inject the Supabase UMD script once (if not present), create a global
  // `window.supabaseClient` (UMD client), and dispatch a `supabase-ready` event so
  // other modules can use the client instead of importing/creating their own.

  function createAndDispatchClient() {
    try {
      const supabaseUrl = 'https://mrkhmlhrbtedudclwfli.supabase.co';
      const supabaseKey = 'sb_publishable_Ej0sVQdRrHnWnctlZxWI3g_djchZi4L';
      // window.supabase is the UMD namespace from the bundle; createClient exists there
      console.log('[SUPABASE] Checking if window.supabase is available:', !!window.supabase);
      console.log('[SUPABASE] Checking if createClient exists:', window.supabase && typeof window.supabase.createClient === 'function');
      
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('[SUPABASE] Supabase UMD not ready');
        return false;
      }
      
      console.log('[SUPABASE] Creating client...');
      window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('[SUPABASE] Client created:', !!window.supabaseClient);
      
      // dispatch ready event with client in detail
      console.log('[SUPABASE] Dispatching supabase-ready event...');
      window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { client: window.supabaseClient } }));
      
      // also attempt to load profile using global client
      console.log('[SUPABASE] Loading profile...');
      loadProfile().catch(e => console.error('[SUPABASE] Profile chip load error:', e));
      return true;
    } catch (e) {
      console.error('[SUPABASE] createAndDispatchClient error', e);
      return false;
    }
  }

  // If UMD is already present, create client immediately
  console.log('[SUPABASE] Checking if UMD is already loaded...');
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    console.log('[SUPABASE] UMD already available, creating client immediately');
    createAndDispatchClient();
  } else {
    // inject UMD bundle and create client when loaded
    console.log('[SUPABASE] UMD not available, injecting bundle...');
    const existing = document.querySelector('script[data-supabase-umd]');
    if (!existing) {
      const s = document.createElement('script');
      // load the canonical Supabase build from jsdelivr
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.setAttribute('data-supabase-umd', '1');
      s.onload = () => {
        // small delay to allow UMD to initialize
        console.log('[SUPABASE] UMD bundle loaded');
        setTimeout(() => createAndDispatchClient(), 20);
      };
      s.onerror = (e) => console.error('[SUPABASE] Failed to load Supabase UMD bundle', e);
      document.head.appendChild(s);
    } else {
      // already loading; watch for ready
      console.log('[SUPABASE] UMD script already in DOM, waiting for load...');
      existing.addEventListener('load', () => {
        console.log('[SUPABASE] UMD script load event fired');
        setTimeout(() => createAndDispatchClient(), 20);
      });
    }
  }

  // loadProfile now uses the global window.supabaseClient if available
  async function loadProfile() {
    try {
      const supabase = window.supabaseClient;
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) throw error;
        if (profile) {
          const img = profileWrapper.querySelector('.chip-img');
          const username = profileWrapper.querySelector('.username');
          username.textContent = profile.username || 'User';
          img.src = profile.avatar_url || `https://placehold.co/40x40/000/fff?text=${(profile.username||'U')[0].toUpperCase()}`;
        }
        
        // Check if user is banned
        await checkUserBan(user.id);
      }
    } catch (e) {
      console.error('Profile chip load error:', e);
    }
  }

  // Ban checking function
  async function checkUserBan(userId) {
    try {
      const supabase = window.supabaseClient;
      if (!supabase) return;
      
      console.log('[BAN CHECK] Checking if user is banned...');
      const { data: banRecord, error } = await supabase.from('bans').select('*').eq('user_id', userId).maybeSingle();
      
      if (error) {
        console.warn('[BAN CHECK] Ban check error:', error);
        return; // Continue on error - don't lock out if DB fails
      }
      
      if (banRecord) {
        console.log('[BAN CHECK] User is banned:', banRecord);
        
        // Check if temporary ban is expired
        if (banRecord.ban_type === 'temporary' && banRecord.banned_until) {
          const banExpiresAt = new Date(banRecord.banned_until);
          
          if (new Date() > banExpiresAt) {
            console.log('[BAN CHECK] Temporary ban has expired, removing...');
            // Delete expired ban
            await supabase.from('bans').delete().eq('id', banRecord.id).catch(console.warn);
            return; // User is no longer banned
          }
        }
        
        // User is banned - show 403 error and redirect
        console.log('[BAN CHECK] User is banned, showing ban page...');
        showBanScreen(banRecord);
      }
    } catch (e) {
      console.error('[BAN CHECK] Error checking ban:', e);
    }
  }

  // Show ban screen
  function showBanScreen(banRecord) {
    // Store ban data in sessionStorage so ban.html can access it
    sessionStorage.setItem('banData', JSON.stringify(banRecord));
    
    // Redirect to ban page
    window.location.href = '/ban.html';
  }
});
document.addEventListener('DOMContentLoaded', () => {


// Moonlight Notification System (JS Only) with stacking
(function() {
  // create container if not exists
  let container = document.getElementById('moonNotifContainer');
  if(!container) {
    container = document.createElement('div');
    container.id = 'moonNotifContainer';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 99999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const closedNotifs = new Set();

  window.showMoonNotification = function({ 
    id, 
    icon='fa-solid fa-bell', 
    title='Notification', 
    body='', 
    duration=5000, 
    closable=true, 
    persistent=false 
  }) {
    // skip if persistent and closed before
    if(persistent && id && closedNotifs.has(id)) return;

    // notification wrapper
    const notif = document.createElement('div');
    notif.style.cssText = `
      display:flex; align-items:flex-start; gap:12px;
      padding:12px 16px; border-radius:12px;
      background: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(16px); box-shadow:0 8px 22px rgba(0,0,0,0.45);
      color:#fff; max-width:320px; font-family:"Inter Tight",system-ui,sans-serif;
      opacity:0; transform:translateX(18px);
      transition: opacity .4s ease, transform .4s ease, margin-top .3s ease;
      pointer-events: auto;
      position: relative;
    `;

    // icon
    const iconEl = document.createElement('div');
    iconEl.innerHTML = `<i class="${icon}"></i>`;
    iconEl.style.cssText = `
      flex-shrink:0; width:40px; height:40px; border-radius:10px;
      background: rgba(255,255,255,0.06); display:flex;align-items:center;justify-content:center;
      font-size:18px;
    `;
    notif.appendChild(iconEl);

    // content
    const content = document.createElement('div');
    content.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:4px;';
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-weight:700; font-size:15px;';
    const bodyEl = document.createElement('div');
    bodyEl.textContent = body;
    bodyEl.style.cssText = 'font-size:14px; opacity:0.85; line-height:1.3;';
    content.appendChild(titleEl);
    content.appendChild(bodyEl);
    notif.appendChild(content);

    // close button
    if(closable){
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.style.cssText = `
        margin-left:8px; cursor:pointer; font-size:14px; opacity:0.7;
        transition: opacity .14s;
      `;
      closeBtn.onmouseenter = ()=>closeBtn.style.opacity='1';
      closeBtn.onmouseleave = ()=>closeBtn.style.opacity='0.7';
      closeBtn.onclick = () => removeNotif();
      notif.appendChild(closeBtn);
    }

    // inject at top for stacking effect
    if(container.firstChild){
      container.insertBefore(notif, container.firstChild);
    } else {
      container.appendChild(notif);
    }

    // animate in
    requestAnimationFrame(()=>{
      notif.style.opacity='1'; 
      notif.style.transform='translateX(0)';
    });

    let timeoutId;
    if(duration>0){
      timeoutId = setTimeout(removeNotif, duration);
    }

    function removeNotif() {
      notif.style.opacity='0';
      notif.style.transform='translateX(18px)';
      notif.addEventListener('transitionend', ()=>{
        if(notif.parentNode) notif.parentNode.removeChild(notif);
      });
      if(timeoutId) clearTimeout(timeoutId);
      if(persistent && id) closedNotifs.add(id);
    }

    return notif;
  };

  // Example notifications on page load
  window.addEventListener('DOMContentLoaded', () => {
    //showMoonNotification({
     // title: 'Welcome!',
     // body: 'You have successfully signed in.',
      //icon: 'fa-solid fa-moon',
      //duration: 4000
  //  });

    showMoonNotification({
      id: 'beta',
      title: 'Moonlight Beta',
      body: 'Moonlight is still in beta, expect bugs and missing features.',
      icon: 'fa-solid fa-circle-info',
      closable: false,
      persistent: true,
      duration: 0 // stays until manually closed
    });
  });

})();

});

// === LEGAL AGREEMENT POPUP INJECTION ===
document.addEventListener("DOMContentLoaded", () => {
  const AGREED_KEY = "moonlight_legal_acknowledged";

  // If already agreed, do nothing
  if (localStorage.getItem(AGREED_KEY) === "true") return;

  // ===== Inject Styles =====
  const legalStyle = document.createElement("style");
  legalStyle.textContent = `
    #legal-blur-overlay {
      position: fixed;
      inset: 0;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      background: rgba(0,0,0,0.55);
      z-index: 999999999;
    }

    #legal-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 92%;
      max-width: 460px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 18px;
      padding: 26px;
      color: #fff;
      font-family: "Inter Tight", system-ui, sans-serif;
      text-align: center;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 18px 60px rgba(0,0,0,0.6);
      animation: fadeInLegal .35s cubic-bezier(.2,.9,.2,1) both;
      z-index: 9999999999;
    }

    @keyframes fadeInLegal {
      from { opacity:0; transform:translate(-50%, -46%) scale(.96); }
      to { opacity:1; transform:translate(-50%, -50%) scale(1); }
    }

    #legal-popup h2 {
      font-size: 22px;
      margin-bottom: 10px;
    }

    #legal-popup p {
      font-size: 14px;
      opacity: 0.85;
      margin-bottom: 18px;
      line-height: 1.5;
    }

    #legal-agree-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 18px;
      justify-content: center;
    }

    #legal-continue-btn {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 15px;
      color: #fff;
      cursor: pointer;
      transition: 0.2s;
      width: 100%;
    }

    #legal-continue-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    #legal-continue-btn:not(:disabled):hover {
      transform: translateY(-3px);
      background: rgba(255,255,255,0.12);
    }
  `;
  document.head.appendChild(legalStyle);

  // ===== Inject Blur Overlay =====
  const blurOverlay = document.createElement("div");
  blurOverlay.id = "legal-blur-overlay";
  document.body.appendChild(blurOverlay);

  // ===== Inject Popup =====
  const popup = document.createElement("div");
  popup.id = "legal-popup";
  popup.innerHTML = `
    <h2>Before You Continue</h2>
    <p>
      To use Moonlight, you must agree to our legal documents.
      You can review them anytime <a href="/legal" style="color:#4aff8a;">here</a>.
    </p>

    <div id="legal-agree-row">
      <input type="checkbox" id="legal-checkbox" />
      <label for="legal-checkbox">I have read and agree to the legal documents.</label>
    </div>

    <button id="legal-continue-btn" disabled>Continue</button>
  `;
  document.body.appendChild(popup);

  // ===== Checkbox + Continue Logic =====
  const checkbox = document.getElementById("legal-checkbox");
  const btn = document.getElementById("legal-continue-btn");

  checkbox.addEventListener("change", () => {
    btn.disabled = !checkbox.checked;
  });

  btn.addEventListener("click", () => {
    localStorage.setItem(AGREED_KEY, "true");

    // remove overlay & popup
    popup.style.opacity = "0";
    blurOverlay.style.opacity = "0";
    setTimeout(() => {
      popup.remove();
      blurOverlay.remove();
    }, 300);

    showMoonNotification({
      title: "Thank you!",
      body: "Your agreement has been saved.",
      icon: "fa-solid fa-circle-check",
      duration: 3000
    });
  });
});


/**
 * --- START OF SETTINGS LOGIC FOR CHIP.JS ---
 * Fetches, caches, and applies user settings globally.
 */

// Global cache for settings (initialized to defaults)
window.moonlightSettings = {
    // Cloak defaults
    cloak_type: 'off',
    cloak_preset: null,
    cloak_custom_title: null,
    cloak_custom_favicon: null,
    // Security defaults
    anti_tab_close: false,
    panic_key_enabled: false,
    panic_key_code: 123, // F12
    panic_key_target: 'https://www.google.com',
};

async function fetchAndApplySettings() {
    // Wait for Supabase client to be ready
    if (!window.supabaseClient) {
        await new Promise(resolve => window.addEventListener('supabase-ready', resolve, { once: true }));
    }
    const supabase = window.supabaseClient;

    const { data: { session } } = await supabase.auth.getSession();
    
    // Only fetch settings if a user is logged in
    if (session) {
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found", which is fine for new users
                throw error;
            }

            if (data) {
                // Merge fetched settings into the global cache
                window.moonlightSettings = { ...window.moonlightSettings, ...data };
            }

        } catch (e) {
            console.warn('Failed to fetch user settings:', e);
            // Will continue with default settings
        }
    }

    // Apply the settings immediately after fetch (or using defaults/cache)
    applySettings();
}

function applySettings() {
    const settings = window.moonlightSettings;
    
   // --- 1. Tab Cloak Logic ---
let title = 'moonlight — your internet, your rules.';
let favicon = '/branding/favicon.png';

// 🛑 FIX: If cloak is OFF, stop execution here to keep the page's original title/favicon.
if (settings.cloak_type === 'off') {
    console.log('[CLOAK] Cloak is off. Skipping title/favicon modification.');
    return; // Exit the cloaking function immediately.
}

if (settings.cloak_type === 'preset') {
    switch (settings.cloak_preset) {
        // --- NEW PRESETS ---
        case 'gdoc':
            title = 'Untitled document - Google Docs';
            favicon = '/uploads/cloaks/gdocs.png';
            break;
        case 'gslides':
            title = 'Untitled presentation - Google Slides';
            favicon = '/uploads/cloaks/gslides.png';
            break;
        case 'gsheets':
            title = 'Untitled spreadsheet - Google Sheets';
            favicon = '/uploads/cloaks/gsheets.png';
            break;
        case 'desmoscalc':
            title = 'Desmos | Scientific Calculator';
            favicon = '/uploads/cloaks/desmos.png';
            break;
        case 'gdrive':
            title = 'Google Drive';
            favicon = '/uploads/cloaks/gdrive.png';
            break;
        case 'gassign':
            title = 'Google Assignments';
            favicon = '/uploads/cloaks/gassign.png';
            break;
        case 'blank':
            title = '\u200B'; // Transparent character
            favicon = '/uploads/cloaks/transparent.png';
            break;

        // --- EXISTING PRESETS (Updated) ---
        case 'google':
            title = 'Google';
            favicon = 'https://www.google.com/favicon.ico';
            break;
        case 'calculator':
            title = 'Calculator - Google Search';
            favicon = '/uploads/cloaks/google.png'; // Reusing Google icon
            break;
    }
} else if (settings.cloak_type === 'custom' && settings.cloak_custom_title) {
    // **KEEP THE CUSTOM CLOAK LOGIC THE SAME**
    title = settings.cloak_custom_title;
    if (settings.cloak_custom_favicon) {
        favicon = settings.cloak_custom_favicon;
    }
}
    
// --- APPLICATION ---
document.title = title;
// Update favicon
const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
link.rel = 'icon';
link.href = favicon;
console.log('[CLOAK] Applying cloak settings:', { title, favicon });
console.log('[CLOAK] Current document title:', document.title);
console.log('[CLOAK] Current favicon link:', link.href);
document.getElementsByTagName('head')[0].appendChild(link);

    // --- 2. Panic Key Logic ---
    const panicHandler = (event) => {
        if (settings.panic_key_enabled && event.keyCode === settings.panic_key_code) {
            window.location.replace(settings.panic_key_target);
        }
    };
    
    // Remove previous listener to avoid duplicates if settings are reapplied
    document.removeEventListener('keydown', window.moonlightPanicHandler); 
    window.moonlightPanicHandler = panicHandler;
    document.addEventListener('keydown', window.moonlightPanicHandler);

    // --- 3. Anti Tab Close Logic ---
    if (settings.anti_tab_close) {
        window.onbeforeunload = function() {
            return "Are you sure you want to leave?";
        };
    } else {
        window.onbeforeunload = null;
    }
}

// Initial call when chip.js loads and on auth change
// Ensure this runs when the Supabase client is ready.
window.addEventListener('supabase-ready', fetchAndApplySettings, { once: true });
// Also run on sign in/out in case settings need to be cleared/loaded
if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange(() => {
        fetchAndApplySettings();
    });
}


/**
 * Helper function used by settings.js to update the global settings and DB.
 * @param {object} updates - Object containing setting keys and new values.
 */
window.updateMoonlightSettings = async function(updates) {
    if (!window.supabaseClient) return { success: false, error: 'Supabase not ready' };
    const supabase = window.supabaseClient;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'User not signed in' };

    // Update global cache immediately (optimistic update)
    window.moonlightSettings = { ...window.moonlightSettings, ...updates };
    applySettings();

    // Persist to database
    try {
        const { error } = await supabase.from('user_settings').upsert(
            { id: user.id, ...window.moonlightSettings },
            { onConflict: 'id' }
        );

        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Failed to save settings:', e);
        // A real implementation would revert the global cache here on failure.
        return { success: false, error: e.message };
    }
}
/**
 * --- END OF SETTINGS LOGIC FOR CHIP.JS ---
 */