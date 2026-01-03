/* --------------------------
  Real-time Chat with Supabase
  - Verified badge logic (White circle, Black check)
  - live profanity checks while typing (debounced)
  - final profanity check on send with 10s timeout
  - subscription to messages (postgres_changes)
  - signed-out => show unclosable roadblock modal
--------------------------- */

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

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const sendIcon = document.getElementById('sendIcon');
const inputError = document.getElementById('inputError');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const userLabel = document.getElementById('userLabel');
const roadblock = document.getElementById('roadblock');
const road1 = document.getElementById('road1');
const road2 = document.getElementById('road2');

let currentUser = null;
let liveProfanityController = null;
let typingCheckToken = 0;
let typingSafe = false;
let initialLoadDone = false;
let channel = null;

function showRoadblock(mode){
  if(mode === 'not-signed-in'){
    road1.textContent = "You must be signed in to use Moonbeam.";
    road2.innerHTML = '<a style="color:white !important;" href="/auth.html"> Sign in </a> to continue.';
  } else if(mode === 'profanity'){
    road1.textContent = "We couldn't connect to our profanity checker.";
    road2.textContent = "You are unable to send messages right now.";
  }
  roadblock.style.display = 'flex';
  roadblock.setAttribute('aria-hidden','false');
}

function hideRoadblock(){ roadblock.style.display='none'; roadblock.setAttribute('aria-hidden','true'); }

/* small util: create message DOM node with Verified Checkmark logic */
function renderMessageRow(msgRow){ 
  const row = document.createElement('div');
  const outgoing = (currentUser && msgRow.user_id === currentUser.id);

  row.className = 'msg-row ' + (outgoing ? 'outgoing' : 'incoming') + ' msg-appear';
  row.dataset.id = msgRow.id;

  const meta = document.createElement('div');
  meta.className = 'msg-meta' + (outgoing ? ' right' : '');
  
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'avatar';
  const av = document.createElement('img');
  av.alt = msgRow.profile?.username || 'U';
  av.src = msgRow.profile?.avatar_url || `https://placehold.co/80x80/000/fff?text=${(msgRow.profile?.username || 'U')[0].toUpperCase()}`;
  avatarWrap.appendChild(av);

  const uname = document.createElement('div');
  uname.className = 'username';
  uname.style.display = 'flex';
  uname.style.alignItems = 'center';
  uname.style.gap = '5px';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = outgoing ? (msgRow.profile?.username ? msgRow.profile.username + ' (You)' : 'You') : (msgRow.profile?.username || 'User');
  uname.appendChild(nameSpan);

  // VERIFIED CHECKMARK LOGIC
  if (msgRow.profile?.verified === true) {
    const badge = document.createElement('span');
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="white"/>
        <path d="M7 12L10.5 15.5L17 9" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    uname.appendChild(badge);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msgRow.message;

  meta.appendChild(uname);
  meta.appendChild(bubble);

  row.appendChild(avatarWrap);
  row.appendChild(meta);

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* fetch profiles map - includes 'verified' column */
async function fetchProfilesMap(userIds){
  if(!userIds || userIds.length===0) return {};
  const { data, error } = await supabase.from('profiles').select('id, username, avatar_url, verified').in('id', userIds);
  if(error) return {};
  const map = {};
  data.forEach(p => map[p.id] = p);
  return map;
}

async function loadInitialMessages(){
  messagesEl.innerHTML = '';
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id,user_id,message,inserted_at')
      .order('inserted_at', {ascending:true})
      .limit(200);

    if(error) return;

    const userIds = Array.from(new Set(data.map(d => d.user_id)));
    const profiles = await fetchProfilesMap(userIds);

    data.forEach(row => {
      renderMessageRow({
        id: row.id,
        user_id: row.user_id,
        message: row.message,
        inserted_at: row.inserted_at,
        profile: profiles[row.user_id] || null
      });
    });

    initialLoadDone = true;
  } catch(err) {
    console.error('initial load err', err);
  }
}

function subscribeToMessages(){
  if(channel) { try { channel.unsubscribe(); } catch(e){} }

  channel = supabase.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const newRow = payload.new;
      // Fetch profile including verified status for the new message
      const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url, verified').eq('id', newRow.user_id).maybeSingle();
      renderMessageRow({
        id: newRow.id,
        user_id: newRow.user_id,
        message: newRow.message,
        inserted_at: newRow.inserted_at,
        profile: profile || null
      });
    })
    .subscribe();
}

const liveDebounced = (function(){
  let timer = null;
  return function(fn, delay=420){
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
})();

async function liveProfanityCheck(text){
  typingCheckToken++;
  const myToken = typingCheckToken;
  if(liveProfanityController) { try { liveProfanityController.abort(); } catch(e){} }
  liveProfanityController = new AbortController();
  
  if(!text || text.trim().length === 0){
    inputError.style.display = 'none'; inputEl.classList.remove('input-error'); typingSafe = false; sendBtn.disabled = true; return;
  }

  try {
    const res = await fetch('https://vector.profanity.dev', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: text }),
      signal: liveProfanityController.signal
    });
    if(!res.ok) throw new Error('bad profanity response');
    const data = await res.json();
    if(myToken !== typingCheckToken) return;
    if(data.isProfanity){
      inputError.style.display = 'block';
      inputEl.classList.add('input-error');
      inputError.textContent = "This message isn't appropriate for moonlight.";
      typingSafe = false;
      sendBtn.disabled = true;
    } else {
      inputError.style.display = 'none';
      inputEl.classList.remove('input-error');
      typingSafe = true;
      sendBtn.disabled = false;
    }
  } catch(err) {
    typingSafe = false;
    sendBtn.disabled = false; 
  }
}

async function finalProfanityCheck(message){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), 10000);
  try {
    const res = await fetch('https://vector.profanity.dev', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if(!res.ok) throw new Error('profanity api bad status');
    const data = await res.json();
    return { ok: true, isProfanity: !!data.isProfanity, raw: data };
  } catch(err){
    clearTimeout(timer);
    return { ok: false, error: err };
  }
}

async function sendMessageFlow(){
  const text = inputEl.value.trim();
  if(!text) return;
  sendBtn.disabled = true;
  sendIcon.className = 'fa-solid fa-circle-notch fa-spin';
  
  const check = await finalProfanityCheck(text);
  if(!check.ok){
    showRoadblock('profanity');
    sendIcon.className = 'fa-solid fa-paper-plane';
    return;
  }
  if(check.isProfanity){
    inputError.style.display = 'block';
    inputEl.classList.add('input-error');
    inputError.textContent = "This message isn't appropriate for moonlight.";
    sendIcon.className = 'fa-solid fa-paper-plane';
    return;
  }

  try {
    const { error } = await supabase.from('messages').insert([{ user_id: currentUser.id, message: text }]);
    if(error){
      showMsg('Failed to send message');
    } else {
      inputEl.value = '';
      typingSafe = false;
      sendBtn.disabled = true;
      inputError.style.display = 'none';
      inputEl.classList.remove('input-error');
    }
  } catch(err) {
    console.error('send err', err);
  } finally {
    sendIcon.className = 'fa-solid fa-paper-plane';
  }
}

inputEl.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    if(!sendBtn.disabled) sendMessageFlow();
  }
});

inputEl.addEventListener('input', (e) => {
  const v = e.target.value;
  sendBtn.disabled = true;
  inputError.style.display = 'none';
  inputEl.classList.remove('input-error');
  liveDebounced(() => liveProfanityCheck(v), 420);
});

sendBtn.addEventListener('click', async () => {
  if(sendBtn.disabled) return;
  await sendMessageFlow();
});

async function checkAuthAndInit(){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user || !user.id){
    showRoadblock('not-signed-in');
    statusText.textContent = 'Signed out';
    statusDot.style.background = 'var(--danger)';
    sendBtn.disabled = true;
    inputEl.disabled = true;
    userLabel.textContent = 'Not signed in';
    return;
  }
  currentUser = user;
  userLabel.textContent = `Signed in as ${user.email || 'User'}`;
  statusText.textContent = 'Online';
  statusDot.style.background = 'var(--success)';

  sendBtn.disabled = true;

  await loadInitialMessages();
  subscribeToMessages();
}

function showMsg(text){
  const el = document.createElement('div');
  el.className = 'helper';
  el.style.margin = '8px';
  el.textContent = text;
  const parent = document.querySelector('.card');
  if(parent) {
    parent.appendChild(el);
    setTimeout(()=>el.remove(),2500);
  }
}

onClientReady(() => {
  try { checkAuthAndInit(); } catch(e){ console.error('chat init failed', e); }
});