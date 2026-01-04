// Supabase client is provided globally by `chip.js` as window.supabaseClient.
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

/** * Comprehensive username validation used for both Signup and Edit 
 */
async function validateUsername(val, currentUserId = null) {
  // Fix for "val.trim is not a function"
  if (typeof val !== 'string') return { valid: false, message: 'Invalid username format' };
  
  const trimmed = val.trim();
  
  if (!trimmed) return { valid: false, message: 'Enter a username' };
  if (trimmed.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
  if (trimmed.length > 20) return { valid: false, message: 'Username must be 20 characters or less' };
  
  const validCharRegex = /^[a-zA-Z0-9 ._]+$/;
  if (!validCharRegex.test(trimmed)) {
    return { valid: false, message: 'Use only letters, numbers, spaces, dots, and underscores' };
  }
  
  const startsWithValid = /^[a-zA-Z0-9]/.test(trimmed);
  const endsWithValid = /[a-zA-Z0-9]$/.test(trimmed);
  if (!startsWithValid || !endsWithValid) {
    return { valid: false, message: 'Username must start and end with a letter or number' };
  }
  
  try {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', trimmed)
      .maybeSingle();
    
    // If found and not the current user, it's taken
    if (existingUser && existingUser.id !== currentUserId) {
      return { valid: false, message: 'This username is taken' };
    }
  } catch (err) {
    console.error('[USERNAME] Availability check error:', err);
  }
  
  return { valid: true, message: '' };
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain a symbol');
  
  return { valid: errors.length === 0, errors: errors };
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateProfilePicture(file) {
  if (!file) return { valid: true, message: '' };
  const allowedTypes = ['image/png', 'image/jpeg'];
  if (!allowedTypes.includes(file.type)) return { valid: false, message: 'PNG or JPG only (no GIFs)' };
  return { valid: true, message: '' };
}

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

// ---- Turnstile bot protection helpers ----
const TURNSTILE_SITE_KEY = '0x4AAAAAACFDuiuySIP8Fi-o';
let turnstileContainerId = null;

function renderTurnstileWidget() {
  if (!turnstileContainerId) {
    const container = document.createElement('div');
    container.id = 'turnstile-widget-container';
    container.style.cssText = 'margin: 16px 0; display: flex; justify-content: center;';
    panel.appendChild(container);
    turnstileContainerId = 'turnstile-widget-container';
  }

  const container = document.getElementById(turnstileContainerId);
  if (container && typeof window.turnstile !== 'undefined') {
    try {
      container.innerHTML = '';
      window.turnstile.render(`#${turnstileContainerId}`, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark'
      });
    } catch (e) { console.error('[TURNSTILE] Render error:', e); }
  }
}

async function getAndValidateTurnstileToken() {
  if (typeof window.turnstile === 'undefined') return null;
  try {
    const token = window.turnstile.getResponse();
    return token || null;
  } catch (e) { return null; }
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

  const googleOpt = document.createElement('div'); googleOpt.className='option-item';
  googleOpt.innerHTML = `<div><strong>Google</strong><div class="small muted">Securely access your account</div></div><div><i class="fa-brands fa-google"></i></div>`;
  googleOpt.onclick = async ()=>{ 
    showMsg('Redirecting to Google...'); 
    await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` }
    });
  };

  actions.append(loginOpt, createOpt, googleOpt);
  panel.append(h, p, actions);
}

function showLoginOptions(){
  clearPanel();
  const h = document.createElement('h1'); h.textContent = 'Log back in';
  const list = document.createElement('div'); list.className='option-list';
  const pwd = document.createElement('div'); pwd.className='option-item'; pwd.innerHTML = `<div><strong>Password</strong><div class="small muted">Sign in with email</div></div><div><i class="fa-solid fa-key"></i></div>`;
  pwd.onclick = ()=> showPasswordLogin();
  const magic = document.createElement('div'); magic.className='option-item'; magic.innerHTML = `<div><strong>Magic link</strong><div class="small muted">We’ll email a link</div></div><div><i class="fa-regular fa-envelope"></i></div>`;
  magic.onclick = ()=> showMagicLogin();
  list.append(pwd, magic);
  panel.append(h, list);
}

function showPasswordLogin(){
  clearPanel();
  const h = document.createElement('h1'); h.textContent = 'Sign in';
  const email = createField('Email', 'email', 'email');
  const pass = createField('Password', 'password', 'password');
  const btn = document.createElement('button'); btn.className = 'btn primary'; btn.innerHTML = `<i class="fa-solid fa-key"></i> Sign in`;
  
  btn.onclick = async ()=> {
    const token = await getAndValidateTurnstileToken();
    if (!token) { showMsg('Please complete the CAPTCHA'); return; }
    showMsg('Signing in...');
    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.input.value, 
      password: pass.input.value,
      options: { captchaToken: token }
    });
    if(error) showMsg(error.message);
    else loadUserProfile();
  };
  
  panel.append(h, email.row, pass.row, btn);
  renderTurnstileWidget();
}

function showMagicLogin(){
  clearPanel();
  const h = document.createElement('h1'); h.textContent = 'Magic link';
  const email = createField('Email', 'email', 'email');
  const btn = document.createElement('button'); btn.className='btn primary'; btn.innerHTML = `<i class="fa-regular fa-envelope"></i> Send Link`;
  
  btn.onclick = async ()=> {
    const token = await getAndValidateTurnstileToken();
    if (!token) { showMsg('Please complete the CAPTCHA'); return; }
    showMsg('Sending magic link...');
    const { error } = await supabase.auth.signInWithOtp({ 
      email: email.input.value,
      options: { captchaToken: token }
    });
    if(error) showMsg(error.message);
    else showMsg('Check your email!');
  };
  
  panel.append(h, email.row, btn);
  renderTurnstileWidget();
}

/* ---------- Signup ---------- */

function showSignupForm(){
  clearPanel();
  const h = document.createElement('h1'); h.textContent = 'Create account';
  renderTurnstileWidget();

  const username = createField('Username', 'username', 'text');
  const email = createField('Email', 'email', 'email');
  const password = createField('Password', 'password', 'password');
  const dob = createField('Birthday', 'birthday', 'date');
  const bio = createField('Bio (optional)', 'bio', 'textarea');
  const fileRow = createFileField('Profile picture', 'profilePic');

  const ageError = document.createElement('div'); ageError.className='error';
  const usernameError = document.createElement('div'); usernameError.className='error';
  const emailError = document.createElement('div'); emailError.className='error'; emailError.textContent = "Enter a valid email.";
  const bioError = document.createElement('div'); bioError.className='error';
  const passwordError = document.createElement('div'); passwordError.className='error';
  const fileError = document.createElement('div'); fileError.className='error';

  username.row.append(usernameError);
  email.row.append(emailError);
  password.row.append(passwordError);
  bio.row.append(bioError);
  fileRow.row.append(fileError);
  dob.row.append(ageError);

  const signupBtn = document.createElement('button'); signupBtn.className='btn primary'; signupBtn.textContent='Sign Up';
  signupBtn.disabled = true; signupBtn.style.opacity = '0.7';

  let usernameBad = true, bioBad = false, ageOkay = false, passwordBad = true, emailBad = true, fileBad = false;

  const updateSignupState = () => {
    const baseOk = !emailBad && !passwordBad && ageOkay && !usernameBad && !bioBad && !fileBad;
    signupBtn.disabled = !baseOk;
    signupBtn.style.opacity = baseOk ? '1' : '0.7';
  };

  const checkUsernameDebounced = debounce(async (val) => {
    const validation = await validateUsername(val);
    if (!validation.valid) {
      usernameBad = true; username.input.classList.add('input-error'); 
      usernameError.style.display = 'block'; usernameError.textContent = validation.message;
    } else {
      try {
        const profCheck = await callProfanityApiWithTimeout(val, 7000);
        if (profCheck.isProfanity) {
          usernameBad = true; username.input.classList.add('input-error');
          usernameError.style.display = 'block'; usernameError.textContent = "Username is inappropriate.";
        } else {
          usernameBad = false; username.input.classList.remove('input-error'); usernameError.style.display = 'none';
        }
      } catch (err) { usernameBad = false; }
    }
    updateSignupState();
  }, 500);

  const checkBioDebounced = debounce(async (val) => {
    if(!val || val.trim().length===0){ bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; updateSignupState(); return; }
    try {
      const result = await callProfanityApiWithTimeout(val,7000);
      if(result.isProfanity){ bioBad=true; bio.input.classList.add('input-error'); bioError.style.display='block'; bioError.textContent = "Bio is inappropriate."; }
      else { bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; }
    } catch(err){ bioBad=false; }
    updateSignupState();
  }, 350);

  username.input.addEventListener('input', e=> checkUsernameDebounced(e.target.value));
  bio.input.addEventListener('input', e=> checkBioDebounced(e.target.value));
  email.input.addEventListener('input', debounce(v => {
    emailBad = !validateEmail(v.target.value);
    email.input.classList.toggle('input-error', emailBad);
    emailError.style.display = emailBad ? 'block' : 'none';
    updateSignupState();
  }));
  password.input.addEventListener('input', debounce(v => {
    const vld = validatePassword(v.target.value);
    passwordBad = !vld.valid;
    password.input.classList.toggle('input-error', passwordBad);
    passwordError.style.display = passwordBad ? 'block' : 'none';
    passwordError.innerHTML = vld.errors.map(e => `<div>${e}</div>`).join('');
    updateSignupState();
  }));
  dob.input.addEventListener('change', ()=>{
    const age = formatDateInputValueAsAge(dob.input.value);
    ageOkay = age !== null && age >= 13;
    dob.input.classList.toggle('input-error', !ageOkay);
    ageError.style.display = ageOkay ? 'none' : 'block';
    ageError.textContent = age === null ? "Enter birthday" : "You must be 13+";
    updateSignupState();
  });

  signupBtn.onclick = async ()=>{
    const turnstileToken = await getAndValidateTurnstileToken();
    if (!turnstileToken) { showMsg('Complete CAPTCHA'); return; }
    showMsg('Creating account...');
    
    let avatarUrl = '';
    if(fileRow.input.files[0]) avatarUrl = await fileToBase64(fileRow.input.files[0]);
    else avatarUrl = `https://placehold.co/500x500/000/fff?text=${username.input.value[0].toUpperCase()}`;

    const { data, error } = await supabase.auth.signUp({ 
      email: email.input.value, password: password.input.value,
      options: { captchaToken: turnstileToken }
    });
    
    if(error) { showMsg(error.message); return; }
    await supabase.from('profiles').insert([{
      id: data.user.id, username: username.input.value, email: email.input.value,
      bio: bio.input.value, avatar_url: avatarUrl
    }]);
    loadUserProfile();
  };

  panel.append(h, username.row, email.row, password.row, dob.row, bio.row, fileRow.row, signupBtn);
}

/* ---------- Edit profile (with Profanity and Username checks) ---------- */

function showEditProfile(){
  if(!currentProfile) return;
  clearPanel();

  const h = document.createElement('h1'); h.textContent = 'Edit Profile';
  const username = createField('Username', 'username', 'text', currentProfile.username || '');
  const bio = createField('Bio (optional)', 'bio', 'textarea', currentProfile.bio || '');
  const fileRow = createFileField('Profile picture', 'profilePic');
  const saveBtn = document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='Save changes';
  const cancelBtn = document.createElement('button'); cancelBtn.className='btn ghost'; cancelBtn.textContent='Cancel';

  const usernameError = document.createElement('div'); usernameError.className='error';
  const bioError = document.createElement('div'); bioError.className='error';
  username.row.append(usernameError); bio.row.append(bioError);

  let usernameBad=false, bioBad=false;

  const updateSaveState = () => { 
    const baseOk = !usernameBad && !bioBad && username.input.value.trim().length > 0;
    saveBtn.disabled = !baseOk; saveBtn.style.opacity = baseOk ? '1' : '0.6'; 
  };

  const checkUsernameDebounced = debounce(async (val) => {
    const v = await validateUsername(val, currentProfile.id);
    if(!v.valid){
      usernameBad=true; username.input.classList.add('input-error'); 
      usernameError.textContent=v.message; usernameError.style.display='block';
    } else {
      try {
        const profCheck = await callProfanityApiWithTimeout(val, 7000);
        if(profCheck.isProfanity){
          usernameBad=true; username.input.classList.add('input-error');
          usernameError.textContent="Username is inappropriate."; usernameError.style.display='block';
        } else {
          usernameBad=false; username.input.classList.remove('input-error'); usernameError.style.display='none';
        }
      } catch(e){ usernameBad=false; }
    }
    updateSaveState();
  }, 400);

  const checkBioDebounced = debounce(async (val)=>{
    if(!val || val.trim().length === 0){ bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none'; updateSaveState(); return; }
    try {
      const result = await callProfanityApiWithTimeout(val, 7000);
      if(result.isProfanity){ 
        bioBad=true; bio.input.classList.add('input-error'); 
        bioError.textContent = "Bio is inappropriate."; bioError.style.display='block'; 
      } else {
        bioBad=false; bio.input.classList.remove('input-error'); bioError.style.display='none';
      }
    } catch(e){ bioBad=false; }
    updateSaveState();
  }, 400);

  username.input.addEventListener('input', e => checkUsernameDebounced(e.target.value));
  bio.input.addEventListener('input', e => checkBioDebounced(e.target.value));

  cancelBtn.onclick = ()=> loadUserProfile();

  saveBtn.onclick = async ()=>{
    showMsg('Saving changes...');
    let avatarUrl = currentProfile.avatar_url || '';
    if(fileRow.input.files[0]) avatarUrl = await fileToBase64(fileRow.input.files[0]);

    const { error } = await supabase.from('profiles').update({
      username: username.input.value.trim(),
      bio: bio.input.value.trim(),
      avatar_url: avatarUrl
    }).eq('id', currentProfile.id);

    if(error) showMsg('Error: ' + error.message);
    else { showMsg('Updated!'); setTimeout(loadUserProfile, 1000); }
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

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    currentProfile = profile || { id:user.id, username:'User', email:user.email };

    const profileView = document.createElement('div');
    profileView.className = 'profile-view';
    profileView.innerHTML = `
      <button class="edit-btn" style="position:absolute; top:0; right:0;"><i class="fa-solid fa-pencil"></i></button>
      <div class="avatar" style="width:120px; height:120px; border-radius:60px; overflow:hidden; margin:0 auto;">
        <img src="${currentProfile.avatar_url || 'https://placehold.co/100'}" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div class="profile-title" style="font-weight:600; text-align:center; margin-top:16px;">${currentProfile.username}</div>
      <div class="profile-bio" style="text-align:center; opacity:0.7;">${currentProfile.bio || ''}</div>
      <button class="btn logout-btn" style="margin-top:20px;"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>
    `;

    profileView.querySelector('.edit-btn').onclick = () => showEditProfile();
    profileView.querySelector('.logout-btn').onclick = async () => {
      await supabase.auth.signOut();
      loadUserProfile();
    };

    panel.appendChild(profileView);
  } catch(err){ showWelcome(); }
}

/* ---------- helpers ---------- */

function createField(labelText, id, type='text', initial=''){
  const row = document.createElement('div'); row.className='field fade-in';
  const label = document.createElement('label'); label.textContent = labelText;
  let input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if(type !== 'textarea') input.type = type;
  input.id = id; input.value = initial;
  row.append(label, input);
  return { row, input };
}

function createFileField(labelText, id){
  const row = document.createElement('div'); row.className='field fade-in';
  const label = document.createElement('label'); label.textContent = labelText;
  const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.id = id;
  row.append(label, input);
  return { row, input };
}

/* ---------- init ---------- */

onClientReady(async ()=>{
  supabase.auth.onAuthStateChange(() => loadUserProfile());
  loadUserProfile();
});