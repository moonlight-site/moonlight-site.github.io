  // Supabase client is provided globally by `chip.js` as window.supabaseClient.
  // Wait for it (or the 'supabase-ready' event) and then proceed.
  let supabase = null;
  let _clientReady = false;
  const _onClientReadyQueue = [];
  function onClientReady(cb){ if(_clientReady) cb(); else _onClientReadyQueue.push(cb); }

  if (window.supabaseClient) {
    supabase = window.supabaseClient;
    _clientReady = true;
  } else {
    window.addEventListener('supabase-ready', (e)=>{
      supabase = (e && e.detail && e.detail.client) || window.supabaseClient || null;
      _clientReady = !!supabase;
      while(_onClientReadyQueue.length) { const fn = _onClientReadyQueue.shift(); try{ fn(); }catch(e){console.error(e);} }
    }, { once: true });
  }

  const panel = document.getElementById('panel');
  const roadblock = document.getElementById('roadblock');
  const roadblockDesc1 = document.getElementById('roadblock-desc-line1');
  const roadblockDesc2 = document.getElementById('roadblock-desc-line2');

  let currentProfile = null;

  function clearPanel(){ panel.innerHTML = ''; }
  function showMsg(text){
    let el = panel.querySelector('.panel-msg');
    if(!el){ el = document.createElement('div'); el.className='panel-msg small muted fade-in'; panel.appendChild(el); }
    el.textContent = text;
  }
  function showRoadblock(modeText){
    roadblockDesc1.textContent = "We couldn't connect to our profanity checker.";
    roadblockDesc2.textContent = modeText === 'signup' ? "You are unable to sign up." : "You are unable to edit profile.";
    roadblock.style.display = 'flex';
    roadblock.setAttribute('aria-hidden','false');
  }
  function hideRoadblock(){ roadblock.style.display='none'; roadblock.setAttribute('aria-hidden','true'); }

  function formatDateInputValueAsAge(value){
    if(!value) return null;
    const dob = new Date(value);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if(m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  function debounce(fn, wait=300){ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); }; }

  async function callProfanityApiWithTimeout(message, timeoutMs = 10000){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), timeoutMs);
    try {
      const r = await fetch('https://vector.profanity.dev', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        signal: controller.signal,
        body: JSON.stringify({ message })
      });
      clearTimeout(timer);
      if(!r.ok) throw new Error('profanity api error ' + r.status);
      const result = await r.json();
      return { ok:true, isProfanity: !!result.isProfanity, raw: result };
    } catch(err){
      clearTimeout(timer);
      throw err;
    }
  }

  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = e => reject(e);
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- UI flows ---------------- */

  function showWelcome(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Welcome';
    const p = document.createElement('p'); p.className='lead'; p.textContent = "An account is required to use Moonlight.";
    const actions = document.createElement('div'); actions.className='option-list';

    const loginOpt = document.createElement('div'); loginOpt.className='option-item';
    loginOpt.innerHTML = `<div><strong>Log back in</strong><div class="small muted">Already have an account?</div></div><div><i class="fa-solid fa-right-to-bracket"></i></div>`;
    loginOpt.onclick = ()=> showLoginOptions();

    const createOpt = document.createElement('div'); createOpt.className='option-item';
    createOpt.innerHTML = `<div><strong>Create account</strong><div class="small muted">Join Moonlight</div></div><div><i class="fa-solid fa-user-plus"></i></div>`;
    createOpt.onclick = ()=> showSignupForm();

    actions.append(loginOpt, createOpt);
    panel.append(h, p, actions);
  }

  function showLoginOptions(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Log back in';
    const list = document.createElement('div'); list.className='option-list';

    const pwd = document.createElement('div'); pwd.className='option-item'; pwd.innerHTML = `<div><strong>Password</strong><div class="small muted">Sign in with email & password</div></div><div><i class="fa-solid fa-key"></i></div>`;
    pwd.onclick = ()=> showPasswordLogin();

    const magic = document.createElement('div'); magic.className='option-item'; magic.innerHTML = `<div><strong>Magic link</strong><div class="small muted">We’ll email a link</div></div><div><i class="fa-regular fa-envelope"></i></div>`;
    magic.onclick = ()=> showMagicLogin();

    const google = document.createElement('div'); google.className='option-item'; google.innerHTML = `<div><strong>Google</strong><div class="small muted">Sign in with Google</div></div><div><i class="fa-brands fa-google"></i></div>`;
    google.onclick = async ()=>{ showMsg('Redirecting...'); const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' }); if(error) showMsg(error.message || 'Error'); };

    list.append(pwd, magic, google);
    panel.append(h, list);
  }

  function showPasswordLogin(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Sign in with password';
    const email = createField('Email', 'email', 'email');
    const pass = createField('Password', 'password', 'password');

    const btn = document.createElement('button'); btn.className = 'btn primary'; btn.innerHTML = `<i class="fa-solid fa-key"></i> Sign in`;
    btn.onclick = async ()=> {
      showMsg('Signing in...');
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.input.value, password: pass.input.value });
      if(error) showMsg(error.message || 'Sign in failed'); else { showMsg('Welcome back!'); await loadUserProfile(); }
    };
    panel.append(h, email.row, pass.row, btn);
  }

  function showMagicLogin(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Magic link';
    const email = createField('Email', 'email', 'email');

    const btn = document.createElement('button'); btn.className='btn primary'; btn.innerHTML = `<i class="fa-regular fa-envelope"></i> Send Magic Link`;
    btn.onclick = async ()=> {
      showMsg('Sending magic link...');
      const { data, error } = await supabase.auth.signInWithOtp({ email: email.input.value });
      if(error) showMsg(error.message || 'Failed'); else showMsg('Check your email for the magic link.');
    };
    panel.append(h, email.row, btn);
  }

  /* ---------- Signup ---------- */

  function showSignupForm(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Create account';

    const username = createField('Username', 'username', 'text');
    const email = createField('Email', 'email', 'email');
    const password = createField('Password', 'password', 'password');
    const dob = createField('Birthday', 'birthday', 'date');
    const bio = createField('Bio (optional)', 'bio', 'textarea');
    const fileRow = createFileField('Profile picture', 'profilePic');

    const ageError = document.createElement('div'); ageError.className='error'; ageError.textContent = "You aren't old enough to use moonlight.";
    const usernameError = document.createElement('div'); usernameError.className='error'; usernameError.textContent = "This username isn't appropriate for moonlight.";
    const bioError = document.createElement('div'); bioError.className='error'; bioError.textContent = "This bio isn't appropriate for moonlight.";

    username.row.append(usernameError);
    bio.row.append(bioError);
    dob.row.append(ageError);

    const signupBtn = document.createElement('button'); signupBtn.className='btn primary'; signupBtn.textContent='Sign Up';
    signupBtn.disabled = true; signupBtn.style.opacity = '0.7';

    let usernameBad = true;
    let bioBad = false;
    let ageOkay = false;

    const checkUsernameDebounced = debounce(async (val) => {
      if(!val || val.trim().length<1){ usernameBad=true; username.input.classList.add('input-error'); usernameError.style.display='block'; usernameError.textContent='Enter a username'; updateSignupState(); return; }
      try {
        const result = await callProfanityApiWithTimeout(val,7000);
        if(result.isProfanity){ usernameBad=true; username.input.classList.add('input-error'); usernameError.style.display='block'; usernameError.textContent="This username isn't appropriate for moonlight."; }
        else { usernameBad=false; username.input.classList.remove('input-error'); usernameError.style.display='none'; }
      } catch(err){
        usernameBad=false; username.input.classList.remove('input-error'); usernameError.style.display='none';
      } finally { updateSignupState(); }
    }, 350);

    const checkBioDebounced = debounce(async (val) => {
      if(!val || val.trim().length===0){ bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; updateSignupState(); return; }
      try {
        const result = await callProfanityApiWithTimeout(val,7000);
        if(result.isProfanity){ bioBad=true; bio.input.classList.add('input-error'); bioError.style.display='block'; }
        else { bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; }
      } catch(err){
        bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none';
      } finally { updateSignupState(); }
    }, 350);

    dob.input.addEventListener('change', ()=>{
      const age = formatDateInputValueAsAge(dob.input.value);
      if(age === null || age === undefined || isNaN(age)){ ageOkay=false; dob.input.classList.add('input-error'); ageError.style.display='block'; ageError.textContent = "Enter your birthday."; }
      else if(age < 13){ ageOkay=false; dob.input.classList.add('input-error'); ageError.style.display='block'; ageError.textContent = "You aren't old enough to use moonlight."; }
      else { ageOkay=true; dob.input.classList.remove('input-error'); ageError.style.display='none'; }
      updateSignupState();
    });

    username.input.addEventListener('input', e=> checkUsernameDebounced(e.target.value));
    bio.input.addEventListener('input', e=> checkBioDebounced(e.target.value));

    function updateSignupState(){
      const baseOk = email.input.value.trim().length>3 && password.input.value.trim().length>=6 && ageOkay && !usernameBad && !bioBad;
      signupBtn.disabled = !baseOk;
      signupBtn.style.opacity = baseOk ? '1' : '0.7';
    }

    signupBtn.onclick = async ()=>{
      showMsg('Checking inputs and creating account...');
      try {
        const usernameCheck = await callProfanityApiWithTimeout(username.input.value,10000).catch(e=>{ throw { timeout:true }});
        if(usernameCheck.isProfanity){ username.input.classList.add('input-error'); usernameError.style.display='block'; usernameError.textContent = "This username isn't appropriate for moonlight."; return; }
        const bioVal = bio.input.value || '';
        const bioCheck = await callProfanityApiWithTimeout(bioVal,10000).catch(e=>{ throw { timeout:true }});
        if(bioCheck.isProfanity){ bio.input.classList.add('input-error'); bioError.style.display='block'; bioError.textContent = "This bio isn't appropriate for moonlight."; return; }
      } catch(err){
        showRoadblock('signup');
        return;
      }

      let avatarUrl = '';
      if(fileRow.input.files[0]) avatarUrl = await fileToBase64(fileRow.input.files[0]);
      else avatarUrl = `https://placehold.co/500x500/000/fff?text=${username.input.value[0] ? username.input.value[0].toUpperCase() : 'U'}`;

      const { data, error } = await supabase.auth.signUp({ email: email.input.value, password: password.input.value });
      if(error){ showMsg(error.message || 'Sign up failed'); return; }

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: data.user.id,
        username: username.input.value,
        email: email.input.value,
        bio: bio.input.value || '',
        avatar_url: avatarUrl
      }]);
      if(profileError){ showMsg(profileError.message || 'Profile creation failed'); return; }

      showMsg('Account created — welcome!');
      await loadUserProfile();
    };

    panel.append(h, username.row, email.row, password.row, dob.row, bio.row, fileRow.row, signupBtn);
  }

  /* ---------- Edit profile (in-panel) ---------- */

  function showEditProfile(){
    if(!currentProfile) return;
    clearPanel();

    const h = document.createElement('h1'); h.textContent = 'Edit Profile';
    const username = createField('Username', 'username', 'text', currentProfile.username || '');
    const bio = createField('Bio (optional)', 'bio', 'textarea', currentProfile.bio || '');
    const fileRow = createFileField('Profile picture', 'profilePic');
    const saveBtn = document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='Save changes';
    const cancelBtn = document.createElement('button'); cancelBtn.className='btn ghost'; cancelBtn.textContent='Cancel';

    const usernameError = document.createElement('div'); usernameError.className='error'; usernameError.textContent = "This username isn't appropriate for moonlight.";
    const bioError = document.createElement('div'); bioError.className='error'; bioError.textContent = "This bio isn't appropriate for moonlight.";
    username.row.append(usernameError); bio.row.append(bioError);

    let usernameBad=false, bioBad=false;

    const checkUsernameDebounced = debounce(async (val) => {
      if(!val || val.trim().length<1){ usernameBad=true; username.input.classList.add('input-error'); usernameError.style.display='block'; usernameError.textContent='Enter a username'; updateSaveState(); return; }
      try { const result = await callProfanityApiWithTimeout(val,7000); if(result.isProfanity){ usernameBad=true; username.input.classList.add('input-error'); usernameError.style.display='block'; } else { usernameBad=false; username.input.classList.remove('input-error'); usernameError.style.display='none'; } }
      catch(e){ usernameBad=false; username.input.classList.remove('input-error'); usernameError.style.display='none'; }
      updateSaveState();
    },350);

    const checkBioDebounced = debounce(async (val)=>{
      if(!val || val.trim().length===0){ bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; updateSaveState(); return; }
      try { const result = await callProfanityApiWithTimeout(val,7000); if(result.isProfanity){ bioBad=true; bio.input.classList.add('input-error'); bioError.style.display='block'; } else { bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; } }
      catch(e){ bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; }
      updateSaveState();
    },350);

    username.input.addEventListener('input', e=> checkUsernameDebounced(e.target.value));
    bio.input.addEventListener('input', e=> checkBioDebounced(e.target.value));

    function updateSaveState(){ const baseOk = !usernameBad && !bioBad && username.input.value.trim().length>0; saveBtn.disabled = !baseOk; saveBtn.style.opacity = baseOk ? '1' : '0.6'; }

    cancelBtn.onclick = ()=> loadUserProfile();

    saveBtn.onclick = async ()=>{
      const savingMsg = document.createElement('div'); savingMsg.className='small muted'; savingMsg.textContent = 'Saving changes...'; panel.appendChild(savingMsg);

      try {
        const uCheck = await callProfanityApiWithTimeout(username.input.value,10000);
        if(uCheck.isProfanity){ username.input.classList.add('input-error'); usernameError.style.display='block'; savingMsg.remove(); return; }
        const bCheck = await callProfanityApiWithTimeout(bio.input.value || '',10000);
        if(bCheck.isProfanity){ bio.input.classList.add('input-error'); bioError.style.display='block'; savingMsg.remove(); return; }
      } catch(e){
        showRoadblock('edit'); savingMsg.remove(); return;
      }

      let avatarUrl = currentProfile.avatar_url || '';
      if(fileRow.input.files[0]) avatarUrl = await fileToBase64(fileRow.input.files[0]);

      const { error } = await supabase.from('profiles').update({
        username: username.input.value,
        bio: bio.input.value || '',
        avatar_url: avatarUrl
      }).eq('id', currentProfile.id);

      if(error){ savingMsg.textContent = 'Failed to update profile'; savingMsg.style.color = 'var(--danger)'; setTimeout(()=>savingMsg.remove(),3000); return; }

      savingMsg.textContent = 'Profile updated successfully!'; savingMsg.style.color = 'var(--success)';
      setTimeout(()=>{ savingMsg.remove(); loadUserProfile(); }, 1200);
    };

    panel.append(h, username.row, bio.row, fileRow.row, saveBtn, cancelBtn);
    updateSaveState();
  }

  /* ---------- Load profile view into panel ---------- */

  async function loadUserProfile(){
    clearPanel();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if(!user){ currentProfile = null; showWelcome(); return; }

      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if(error || !profile) currentProfile = { id:user.id, username:'User', email:user.email, bio:'', avatar_url:`https://placehold.co/500x500/000/fff?text=${(user.email||'U')[0].toUpperCase()}` };
      else currentProfile = profile;

      // Create profile view container
      const profileView = document.createElement('div');
      profileView.className = 'profile-view';
      profileView.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%; position:relative; padding:20px 0;';

      // Edit button (positioned absolutely in the top-right)
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.title = 'Edit profile';
      editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
      editBtn.style.cssText = 'position:absolute; top:0; right:0;';
      editBtn.onclick = () => showEditProfile();

      // Avatar container with proper sizing
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.style.cssText = 'width:120px; height:120px; border-radius:60px; overflow:hidden; margin:0 auto; flex-shrink:0;';
      
      // Avatar image with proper fit and rounding
      const img = document.createElement('img');
      img.src = currentProfile.avatar_url || `https://placehold.co/500x500/000/fff?text=${(currentProfile.username||'U')[0].toUpperCase()}`;
      img.alt = 'Profile picture';
      img.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:60px;';
      avatar.appendChild(img);

      // User info with proper spacing
      const name = document.createElement('div');
      name.className = 'profile-title';
      name.style.cssText = 'font-weight:600; font-size:18px; margin-top:16px; text-align:center; display:flex; align-items:center; justify-content:center; gap:2px;';
      
      // Add username
      const usernameSpan = document.createElement('span');
      usernameSpan.textContent = currentProfile.username || 'User';
      name.appendChild(usernameSpan);
      
      // Add verified badge if applicable
      if (currentProfile.verified) {
        const badge = document.createElement('div');
        badge.className = 'verified-badge';
        badge.innerHTML = '<i class="fa-solid fa-check"></i>';
        name.appendChild(badge);
      }

      const emailDiv = document.createElement('div');
      emailDiv.className = 'profile-sub';
      emailDiv.style.cssText = 'opacity:0.7; font-size:13px; margin-top:4px; text-align:center;';
      emailDiv.textContent = currentProfile.email || '';

      const bio = document.createElement('div');
      bio.className = 'profile-bio small muted';
      bio.style.cssText = 'text-align:center; margin:12px 0; max-width:100%; padding:0 20px; word-wrap:break-word;';
      bio.textContent = currentProfile.bio || '';

      // Logout button at the bottom with proper spacing
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn';
      logoutBtn.style.marginTop = '20px';
      logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Log out';
      logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        currentProfile = null;
        loadUserProfile();
      };

      // Append elements in the correct order
      profileView.append(editBtn, avatar, name, emailDiv, bio, logoutBtn);
      
      // Clear panel and add profile view
      panel.innerHTML = '';
      panel.appendChild(profileView);
    } catch(err){ console.error(err); showWelcome(); }
  }

  /* ---------- helpers ---------- */

  function createField(labelText, id, type='text', initial=''){
    const row = document.createElement('div'); row.className='field fade-in';
    const label = document.createElement('label'); label.textContent = labelText;
    let input;
    if(type === 'textarea'){ input = document.createElement('textarea'); input.rows = 3; input.value = initial || ''; }
    else { input = document.createElement('input'); input.type = type || 'text'; input.value = initial || ''; }
    input.id = id;
    row.append(label, input);
    return { row, input, label };
  }

  function createFileField(labelText, id){
    const row = document.createElement('div'); row.className='field fade-in';
    const label = document.createElement('label'); label.textContent = labelText;
    const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.id = id;
    const hint = document.createElement('div'); hint.className='small muted'; hint.textContent = 'Recommended: square image';
    row.append(label, input, hint);
    return { row, input, label };
  }

  /* ---------- init ---------- */

  // Start auth flows only after supabase client is ready
  onClientReady(async ()=>{
    try { supabase.auth.onAuthStateChange((event, session) => { loadUserProfile(); }); } catch(e){ console.error('auth onAuthStateChange bind failed', e); }
    try {
      const s = await supabase.auth.getSession();
      if(s.data.session) await loadUserProfile(); else showWelcome();
    } catch(err){ console.error('failed initial auth check', err); showWelcome(); }
  });
