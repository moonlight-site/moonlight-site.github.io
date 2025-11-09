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

  // ---- Load profile from Supabase ----
  if (!window.supabase) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = loadProfile;
    document.head.appendChild(script);
  } else loadProfile();

  async function loadProfile() {
    try {
      const supabaseUrl = 'https://mrkhmlhrbtedudclwfli.supabase.co';
      const supabaseKey = 'sb_publishable_Ej0sVQdRrHnWnctlZxWI3g_djchZi4L';
      const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
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

