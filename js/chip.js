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
      if (!window.supabase || typeof window.supabase.createClient !== 'function') return false;
      window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      // dispatch ready event with client in detail
      window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { client: window.supabaseClient } }));
      // also attempt to load profile using global client
      loadProfile().catch(e => console.error('Profile chip load error:', e));
      return true;
    } catch (e) {
      console.error('createAndDispatchClient error', e);
      return false;
    }
  }

  // If UMD is already present, create client immediately
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    createAndDispatchClient();
  } else {
    // inject UMD bundle and create client when loaded
    const existing = document.querySelector('script[data-supabase-umd]');
    if (!existing) {
      const s = document.createElement('script');
      // load the canonical Supabase build from jsdelivr
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.setAttribute('data-supabase-umd', '1');
      s.onload = () => {
        // small delay to allow UMD to initialize
        setTimeout(() => createAndDispatchClient(), 20);
      };
      s.onerror = (e) => console.error('Failed to load Supabase UMD bundle', e);
      document.head.appendChild(s);
    } else {
      // already loading; watch for ready
      existing.addEventListener('load', () => setTimeout(() => createAndDispatchClient(), 20));
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
          img.src = profile.profile_picture || `https://placehold.co/40x40/000/fff?text=${(profile.username||'U')[0].toUpperCase()}`;
        }
      }
    } catch (e) {
      console.error('Profile chip load error:', e);
    }
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
      id: 'update-1',
      title: 'Update Available',
      body: 'A new feature is ready!',
      icon: 'fa-solid fa-circle-info',
      closable: true,
      persistent: true,
      duration: 0 // stays until manually closed
    });
  });

})();

});