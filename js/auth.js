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

  function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain an uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain a lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one symbol (!@#$%^&* etc)');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function validateProfilePicture(file) {
    if (!file) {
      return { valid: true, message: '' }; // Optional field
    }
    
    const allowedTypes = ['image/png', 'image/jpeg'];
    const allowedExtensions = ['.png', '.jpg', '.jpeg'];
    
    // Check MIME type
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, message: 'Profile picture must be PNG or JPG only (no GIFs)' };
    }
    
    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return { valid: false, message: 'Profile picture must be PNG or JPG only (no GIFs)' };
    }
    
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
    console.log('[TURNSTILE] renderTurnstileWidget() called');
    if (!turnstileContainerId) {
      // Create a container for the widget if not already done
      console.log('[TURNSTILE] Creating new container...');
      const container = document.createElement('div');
      container.id = 'turnstile-widget-container';
      container.style.cssText = 'margin: 16px 0; display: flex; justify-content: center;';
      panel.appendChild(container);
      turnstileContainerId = 'turnstile-widget-container';
      console.log('[TURNSTILE] Container created with ID:', turnstileContainerId);
    }

    // Clear and render turnstile widget
    const container = document.getElementById(turnstileContainerId);
    console.log('[TURNSTILE] Container element found:', !!container);
    console.log('[TURNSTILE] window.turnstile available:', typeof window.turnstile !== 'undefined');
    
    if (container && typeof window.turnstile !== 'undefined') {
      try {
        console.log('[TURNSTILE] Clearing container innerHTML');
        container.innerHTML = ''; // Clear previous widget
        console.log('[TURNSTILE] Calling window.turnstile.render...');
        window.turnstile.render(`#${turnstileContainerId}`, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark'
        });
        console.log('[TURNSTILE] Widget rendered successfully');
      } catch (e) {
        console.error('[TURNSTILE] Error rendering widget:', e);
      }
    } else {
      console.warn('[TURNSTILE] Cannot render: container=' + !!container + ', turnstile=' + (typeof window.turnstile !== 'undefined'));
    }
  }

  async function getAndValidateTurnstileToken() {
    console.log('[TURNSTILE] getAndValidateTurnstileToken() called');
    if (typeof window.turnstile === 'undefined') {
      console.warn('[TURNSTILE] Turnstile library not loaded');
      return null;
    }
    try {
      console.log('[TURNSTILE] Calling window.turnstile.getResponse()');
      const token = window.turnstile.getResponse();
      console.log('[TURNSTILE] Token response:', token ? '(length=' + token.length + ')' : 'null/empty');
      return token || null;
    } catch (e) {
      console.error('[TURNSTILE] Error getting token:', e);
      return null;
    }
  }

  function resetTurnstileWidget() {
    console.log('[TURNSTILE] resetTurnstileWidget() called');
    if (typeof window.turnstile !== 'undefined' && turnstileContainerId) {
      try {
        console.log('[TURNSTILE] Calling window.turnstile.reset()');
        window.turnstile.reset(`#${turnstileContainerId}`);
        console.log('[TURNSTILE] Widget reset successfully');
      } catch (e) {
        console.warn('[TURNSTILE] Failed to reset widget:', e);
      }
    } else {
      console.warn('[TURNSTILE] Cannot reset: turnstile=' + (typeof window.turnstile !== 'undefined') + ', containerId=' + turnstileContainerId);
    }
  }

  // Wrapper for Supabase auth calls to include Turnstile token in headers
  async function callSupabaseAuthWithTurnstile(authFn) {
    const token = await getAndValidateTurnstileToken();
    const headers = {};
    if (token) {
      headers['cf-turnstile-token'] = token;
    }
    
    // Call the auth function with custom headers injected
    // Supabase client allows headers via the fetch options
    return authFn(headers);
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
    googleOpt.innerHTML = `<div><strong>Google</strong><div class="small muted">Securely access your account with Google</div></div><div><i class="fa-brands fa-google"></i></div>`;
    googleOpt.onclick = async ()=>{ 
      console.log('[AUTH] Google sign in clicked');
      showMsg('Redirecting to Google...'); 
      try {
        console.log('[AUTH] Calling signInWithOAuth with provider: google');
        const { data, error } = await supabase.auth.signInWithOAuth({ 
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth`
          }
        });
        
        console.log('[AUTH] OAuth response:', { data, error });
        
        if(error) {
          console.error('[AUTH] Google OAuth error:', error.message);
          showMsg(error.message || 'Error');
        }
      } catch(err) {
        console.error('[AUTH] Exception during Google OAuth:', err);
        showMsg('Error: ' + err.message);
      }
    };

    actions.append(loginOpt, createOpt, googleOpt);
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

    list.append(pwd, magic);
    panel.append(h, list);
  }

  function showPasswordLogin(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Sign in with password';
    const email = createField('Email', 'email', 'email');
    const pass = createField('Password', 'password', 'password');

    const btn = document.createElement('button'); btn.className = 'btn primary'; btn.innerHTML = `<i class="fa-solid fa-key"></i> Sign in`;
    btn.onclick = async ()=> {
      console.log('[AUTH] Password login clicked');
      showMsg('Signing in...');
      
      console.log('[TURNSTILE] Checking for token...');
      const token = await getAndValidateTurnstileToken();
      console.log('[TURNSTILE] Token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
      
      if (!token) {
        console.warn('[TURNSTILE] No token available, returning');
        showMsg('Please complete the CAPTCHA');
        return;
      }

      const emailVal = email.input.value;
      const passVal = pass.input.value;
      console.log('[AUTH] Attempting signInWithPassword with email:', emailVal);
      console.log('[AUTH] Password length:', passVal.length);

      try {
        console.log('[AUTH] Calling supabase.auth.signInWithPassword...');
        console.log('[AUTH] Token being passed:', token ? '(length=' + token.length + ')' : 'MISSING');
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: emailVal, 
          password: passVal,
          options: {
            captchaToken: token
          }
        });
        
        console.log('[AUTH] Response received');
        console.log('[AUTH] Data:', data);
        console.log('[AUTH] Error:', error);
        
        if(error) {
          console.error('[AUTH] Sign in error:', error.message);
          showMsg(error.message || 'Sign in failed');
          return;
        }
        
        console.log('[AUTH] Sign in successful!');
            showMoonNotification({
      id: 'welcome',
      title: 'Welcome',
      body: 'You\'ve signed in successfully.',
      icon: 'fa-solid fa-lock',
      closable: true,
      persistent: false,
      duration: 7000 // stays until manually closed
    });
        showMsg('Welcome back!');
        setTimeout(() => {
          console.log('[AUTH] Loading user profile...');
          loadUserProfile();
        }, 500);
      } catch(err) {
        console.error('[AUTH] Exception caught:', err);
        showMsg('Sign in error: ' + err.message);
      }
    };
    
    // Add Turnstile widget AFTER form fields (at bottom)
    panel.append(h, email.row, pass.row, btn);
    renderTurnstileWidget();
  }

  function showMagicLogin(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Magic link';
    const email = createField('Email', 'email', 'email');

    const btn = document.createElement('button'); btn.className='btn primary'; btn.innerHTML = `<i class="fa-regular fa-envelope"></i> Send Magic Link`;
    btn.onclick = async ()=> {
      console.log('[AUTH] Magic link login clicked');
      showMsg('Sending magic link...');
      
      console.log('[TURNSTILE] Checking for token...');
      const token = await getAndValidateTurnstileToken();
      console.log('[TURNSTILE] Token retrieved:', token ? 'YES (length: ' + token.length + ')' : 'NO');
      
      if (!token) {
        console.warn('[TURNSTILE] No token available, returning');
        showMsg('Please complete the CAPTCHA');
        return;
      }

      const emailVal = email.input.value;
      console.log('[AUTH] Attempting signInWithOtp with email:', emailVal);

      try {
        console.log('[AUTH] Calling supabase.auth.signInWithOtp...');
        console.log('[AUTH] Token being passed:', token ? '(length=' + token.length + ')' : 'MISSING');
        const { data, error } = await supabase.auth.signInWithOtp({ 
          email: emailVal,
          options: {
            captchaToken: token
          }
        });
        
        console.log('[AUTH] Response received');
        console.log('[AUTH] Data:', data);
        console.log('[AUTH] Error:', error);
        
        if(error) {
          console.error('[AUTH] OTP send error:', error.message);
          showMsg(error.message || 'Failed');
          return;
        }
        
        console.log('[AUTH] Magic link sent successfully!');
        showMsg('Check your email for the magic link.');
      } catch(err) {
        console.error('[AUTH] Exception caught:', err);
        showMsg('Error: ' + err.message);
      }
    };
    
    // Add Turnstile widget AFTER form fields (at bottom)
    panel.append(h, email.row, btn);
    renderTurnstileWidget();
  }

  /* ---------- Signup ---------- */

  function showSignupForm(){
    clearPanel();
    const h = document.createElement('h1'); h.textContent = 'Create account';

    // Auto-render Turnstile widget when signup form opens
    renderTurnstileWidget();

    const username = createField('Username', 'username', 'text');
    const email = createField('Email', 'email', 'email');
    const password = createField('Password', 'password', 'password');
    const dob = createField('Birthday', 'birthday', 'date');
    const bio = createField('Bio (optional)', 'bio', 'textarea');
    const fileRow = createFileField('Profile picture', 'profilePic');

    const ageError = document.createElement('div'); ageError.className='error'; ageError.textContent = "You aren't old enough to use moonlight.";
    const usernameError = document.createElement('div'); usernameError.className='error'; usernameError.textContent = "This username isn't appropriate for moonlight.";
    const emailError = document.createElement('div'); emailError.className='error'; emailError.textContent = "Please enter a valid email address.";
    const bioError = document.createElement('div'); bioError.className='error'; bioError.textContent = "This bio isn't appropriate for moonlight.";
    const passwordError = document.createElement('div'); passwordError.className='error'; passwordError.innerHTML = '';
    const fileError = document.createElement('div'); fileError.className='error'; fileError.textContent = "Profile picture must be PNG or JPG only (no GIFs).";

    username.row.append(usernameError);
    email.row.append(emailError);
    password.row.append(passwordError);
    bio.row.append(bioError);
    fileRow.row.append(fileError);
    dob.row.append(ageError);

    const signupBtn = document.createElement('button'); signupBtn.className='btn primary'; signupBtn.textContent='Sign Up';
    signupBtn.disabled = true; signupBtn.style.opacity = '0.7';

    let usernameBad = true;
    let bioBad = false;
    let ageOkay = false;
    let passwordBad = true;
    let emailBad = true;
    let fileBad = false;

    const checkFileDebounced = debounce(() => {
      const file = fileRow.input.files[0];
      const validation = validateProfilePicture(file);
      
      if (!validation.valid) {
        fileBad = true;
        fileRow.input.classList.add('input-error');
        fileError.style.display = 'block';
        fileError.textContent = validation.message;
      } else {
        fileBad = false;
        fileRow.input.classList.remove('input-error');
        fileError.style.display = 'none';
      }
      
      updateSignupState();
    }, 300);

    fileRow.input.addEventListener('change', checkFileDebounced);

    const checkEmailDebounced = debounce((val) => {
      if (!validateEmail(val)) {
        emailBad = true;
        email.input.classList.add('input-error');
        emailError.style.display = 'block';
      } else {
        emailBad = false;
        email.input.classList.remove('input-error');
        emailError.style.display = 'none';
      }
      
      updateSignupState();
    }, 350);

    email.input.addEventListener('input', e => checkEmailDebounced(e.target.value));

    const checkPasswordDebounced = debounce((val) => {
      const validation = validatePassword(val);
      
      if (!validation.valid) {
        passwordBad = true;
        password.input.classList.add('input-error');
        passwordError.style.display = 'block';
        passwordError.innerHTML = validation.errors.map(e => `<div>${e}</div>`).join('');
      } else {
        passwordBad = false;
        password.input.classList.remove('input-error');
        passwordError.style.display = 'none';
      }
      
      updateSignupState();
    }, 350);

    password.input.addEventListener('input', e => checkPasswordDebounced(e.target.value));

    // Comprehensive username validation
    async function validateUsername(val) {
      const trimmed = val.trim();
      
      // Check if empty
      if (!trimmed) {
        return { valid: false, message: 'Enter a username' };
      }
      
      // Check length (3-20 characters)
      if (trimmed.length < 3) {
        return { valid: false, message: 'Username must be at least 3 characters' };
      }
      if (trimmed.length > 20) {
        return { valid: false, message: 'Username must be 20 characters or less' };
      }
      
      // Check if starts/ends with space (trim would have removed outer spaces already checked above)
      if (val.startsWith(' ') || val.endsWith(' ')) {
        return { valid: false, message: 'Username cannot start or end with a space' };
      }
      
      // Check if only spaces
      if (trimmed.length === 0) {
        return { valid: false, message: 'Username cannot be only spaces' };
      }
      
      // Check for valid characters (letters, numbers, spaces, dots, underscores - no symbols/emojis)
      const validCharRegex = /^[a-zA-Z0-9 ._]+$/;
      if (!validCharRegex.test(trimmed)) {
        return { valid: false, message: 'Username can only contain letters, numbers, spaces, dots, and underscores' };
      }
      
      // Check if starts and ends with letter or number
      const startsWithValid = /^[a-zA-Z0-9]/.test(trimmed);
      const endsWithValid = /[a-zA-Z0-9]$/.test(trimmed);
      if (!startsWithValid || !endsWithValid) {
        return { valid: false, message: 'Username must start and end with a letter or number' };
      }
      
      // Check if username is taken
      try {
        const { data: existingUser, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', trimmed)
          .single();
        
        if (existingUser) {
          return { valid: false, message: 'This username is taken' };
        }
      } catch (err) {
        // If error is "not found" (PGRST116), username is available
        // Other errors we'll treat as a temporary issue
        if (err.code && err.code !== 'PGRST116') {
          console.error('[USERNAME] Availability check error:', err);
        }
      }
      
      return { valid: true, message: '' };
    }

    const checkUsernameDebounced = debounce(async (val) => {
      const validation = await validateUsername(val);
      
      if (!validation.valid) {
        usernameBad = true;
        username.input.classList.add('input-error');
        usernameError.style.display = 'block';
        usernameError.textContent = validation.message;
      } else {
        // Format validation passed, now check profanity
        try {
          const profanityCheck = await callProfanityApiWithTimeout(val, 7000);
          if (profanityCheck.isProfanity) {
            usernameBad = true;
            username.input.classList.add('input-error');
            usernameError.style.display = 'block';
            usernameError.textContent = "This username isn't appropriate for moonlight.";
          } else {
            usernameBad = false;
            username.input.classList.remove('input-error');
            usernameError.style.display = 'none';
          }
        } catch (err) {
          // If profanity check fails, allow it through
          console.warn('[PROFANITY] Username profanity check error:', err);
          usernameBad = false;
          username.input.classList.remove('input-error');
          usernameError.style.display = 'none';
        }
      }
      
      updateSignupState();
    }, 500);

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
      const baseOk = !emailBad && !passwordBad && ageOkay && !usernameBad && !bioBad && !fileBad;
      signupBtn.disabled = !baseOk;
      signupBtn.style.opacity = baseOk ? '1' : '0.7';
    }

    signupBtn.onclick = async ()=>{
      console.log('[AUTH] Sign up button clicked');
      showMsg('Checking inputs and creating account...');
      try {
        console.log('[EMAIL] Validating email format...');
        if (!validateEmail(email.input.value)) {
          console.warn('[EMAIL] Invalid email format');
          email.input.classList.add('input-error');
          emailError.style.display = 'block';
          emailError.textContent = 'Please enter a valid email address';
          showMsg('Please fix the errors below');
          return;
        }
        console.log('[EMAIL] Email format OK');
        
        console.log('[FILE] Validating profile picture...');
        const fileValidation = validateProfilePicture(fileRow.input.files[0]);
        if (!fileValidation.valid) {
          console.warn('[FILE] Invalid profile picture:', fileValidation.message);
          fileRow.input.classList.add('input-error');
          fileError.style.display = 'block';
          fileError.textContent = fileValidation.message;
          showMsg('Please fix the errors below');
          return;
        }
        console.log('[FILE] Profile picture validation OK');
        
        console.log('[AUTH] Validating username format...');
        const usernameValidation = await validateUsername(username.input.value);
        if (!usernameValidation.valid) {
          console.warn('[USERNAME] Validation failed:', usernameValidation.message);
          username.input.classList.add('input-error');
          usernameError.style.display = 'block';
          usernameError.textContent = usernameValidation.message;
          showMsg('Please fix the errors below');
          return;
        }
        console.log('[USERNAME] Format validation OK');
        
        console.log('[AUTH] Validating password strength...');
        const passwordValidation = validatePassword(password.input.value);
        if (!passwordValidation.valid) {
          console.warn('[PASSWORD] Validation failed:', passwordValidation.errors);
          password.input.classList.add('input-error');
          passwordError.style.display = 'block';
          passwordError.innerHTML = passwordValidation.errors.map(e => `<div>${e}</div>`).join('');
          showMsg('Please fix the errors below');
          return;
        }
        console.log('[PASSWORD] Strength validation OK');
        
        console.log('[PROFANITY] Checking username...');
        const usernameCheck = await callProfanityApiWithTimeout(username.input.value,10000).catch(e=>{ throw { timeout:true }});
        if(usernameCheck.isProfanity){ 
          console.warn('[PROFANITY] Username flagged as inappropriate');
          username.input.classList.add('input-error'); 
          usernameError.style.display = 'block'; 
          usernameError.textContent = "This username isn't appropriate for moonlight."; 
          showMsg('Please fix the errors below');
          return; 
        }
        console.log('[PROFANITY] Username OK');
        
        const bioVal = bio.input.value || '';
        console.log('[PROFANITY] Checking bio...');
        if (bioVal && bioVal.trim().length > 0) {
          const bioCheck = await callProfanityApiWithTimeout(bioVal,10000).catch(e=>{ throw { timeout:true }});
          if(bioCheck.isProfanity){ 
            console.warn('[PROFANITY] Bio flagged as inappropriate');
            bio.input.classList.add('input-error'); 
            bioError.style.display='block'; 
            bioError.textContent = "This bio isn't appropriate for moonlight."; 
            showMsg('Please fix the errors below');
            return; 
          }
        }
        console.log('[PROFANITY] Bio OK');
      } catch(err){
        console.error('[PROFANITY] Error during profanity check:', err);
        showRoadblock('signup');
        return;
      }

      console.log('[TURNSTILE] Checking for signup CAPTCHA token...');
      const turnstileToken = await getAndValidateTurnstileToken();
      console.log('[TURNSTILE] Token retrieved:', turnstileToken ? 'YES (length: ' + turnstileToken.length + ')' : 'NO');
      if (!turnstileToken) {
        console.warn('[TURNSTILE] No token available for signup');
        showMsg('Please complete the CAPTCHA');
        return;
      }

      let avatarUrl = '';
      if(fileRow.input.files[0]) {
        console.log('[PROFILE] Converting avatar to base64...');
        avatarUrl = await fileToBase64(fileRow.input.files[0]);
      } else {
        console.log('[PROFILE] Using placeholder avatar');
        avatarUrl = `https://placehold.co/500x500/000/fff?text=${username.input.value[0] ? username.input.value[0].toUpperCase() : 'U'}`;
      }

      try {
        const emailVal = email.input.value;
        const passVal = password.input.value;
        console.log('[AUTH] Calling supabase.auth.signUp with email:', emailVal);
        console.log('[AUTH] Token being passed:', turnstileToken ? '(length=' + turnstileToken.length + ')' : 'MISSING');
        const { data, error } = await supabase.auth.signUp({ 
          email: emailVal, 
          password: passVal,
          options: {
            captchaToken: turnstileToken
          }
        });
        
        console.log('[AUTH] signUp response received');
        console.log('[AUTH] Data:', data);
        console.log('[AUTH] Error:', error);
        
        if(error) {
          console.error('[AUTH] Sign up error:', error.message);
          showMsg(error.message || 'Sign up failed');
          return;
        }

        console.log('[PROFILE] Inserting profile for user:', data.user.id);
        const { error: profileError } = await supabase.from('profiles').insert([{
          id: data.user.id,
          username: username.input.value,
          email: emailVal,
          bio: bio.input.value || '',
          avatar_url: avatarUrl
        }]);
        
        console.log('[PROFILE] Insert response received');
        console.log('[PROFILE] Error:', profileError);
        
        if(profileError) {
          console.error('[PROFILE] Profile creation error:', profileError.message);
          showMsg(profileError.message || 'Profile creation failed');
          return;
        }

        console.log('[AUTH] Account created successfully!');
        showMsg('Account created — welcome!');
        setTimeout(() => {
          console.log('[AUTH] Loading user profile...');
          loadUserProfile();
        }, 500);
      } catch(err) {
        console.error('[AUTH] Exception caught during signup:', err);
        showMsg('Error: ' + err.message);
      }
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

      try {
        const { error } = await supabase.from('profiles').update({
          username: username.input.value,
          bio: bio.input.value || '',
          avatar_url: avatarUrl
        }).eq('id', currentProfile.id);

        if(error) {
          savingMsg.textContent = 'Failed to update profile'; 
          savingMsg.style.color = 'var(--danger)'; 
          setTimeout(()=>savingMsg.remove(),3000);
          return;
        }

        savingMsg.textContent = 'Profile updated successfully!';
        savingMsg.style.color = 'var(--success)';
        setTimeout(()=>{ savingMsg.remove(); loadUserProfile(); }, 1200);
      } catch(err) {
        savingMsg.textContent = 'Error: ' + err.message;
        savingMsg.style.color = 'var(--danger)';
        setTimeout(()=>savingMsg.remove(),3000);
      }
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

  /* ---------- OAuth callback handler ---------- */
  
  async function handleOAuthCallback() {
    console.log('[OAUTH] Checking for OAuth callback...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[OAUTH] Session retrieval error:', error);
        return false;
      }
      
      if (!session) {
        console.log('[OAUTH] No active session');
        return false;
      }
      
      console.log('[OAUTH] Active session found for user:', session.user.email);
      
      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[OAUTH] Profile check error:', profileError);
        return true; // Session exists but couldn't check profile
      }
      
      // If no profile exists, create one
      if (!profile) {
        console.log('[OAUTH] No profile found, creating new profile for user:', session.user.id);
        
        const username = session.user.email.split('@')[0] + Math.random().toString(36).substring(7);
        const avatarUrl = `https://placehold.co/500x500/000/fff?text=${(username[0] || 'U').toUpperCase()}`;
        
        const { error: insertError } = await supabase.from('profiles').insert([{
          id: session.user.id,
          username: username,
          email: session.user.email,
          bio: '',
          avatar_url: avatarUrl
        }]);
        
        if (insertError) {
          console.error('[OAUTH] Profile creation error:', insertError);
          // Profile creation failed, but user is still signed in
          return true;
        }
        
        console.log('[OAUTH] Profile created successfully for user:', username);
      } else {
        console.log('[OAUTH] Existing profile found:', profile.username);
        console.log('[OAUTH] User successfully signed in with Google:', session.user.email);
        
      }
      
      return true;
    } catch (err) {
      console.error('[OAUTH] Callback handler exception:', err);
      return false;
    }
  }

  /* ---------- init ---------- */

  // Start auth flows only after supabase client is ready
  onClientReady(async ()=>{
    console.log('[INIT] Client ready, setting up auth state listener and checking for OAuth callback');
    
    try { 
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[AUTH] Auth state changed:', event, !!session);
        loadUserProfile(); 
      }); 
    } catch(e){ 
      console.error('[INIT] auth onAuthStateChange bind failed', e); 
    }
    
    try {
      // Handle OAuth callback if we just returned from Google
      const isOAuthCallback = await handleOAuthCallback();
      
      const s = await supabase.auth.getSession();
      if(s.data.session) {
        console.log('[INIT] User is signed in, loading profile');
        await loadUserProfile();
      } else {
        console.log('[INIT] No active session, showing welcome');
        showWelcome();
      }
    } catch(err){ 
      console.error('[INIT] failed initial auth check', err); 
      showWelcome(); 
    }
  });
