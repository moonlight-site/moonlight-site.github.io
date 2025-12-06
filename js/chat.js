/* --------------------------
  Real-time Chat with Supabase
  - live profanity checks while typing (debounced)
  - final profanity check on send with 10s timeout
  - subscription to messages (postgres_changes)
  - signed-out => show unclosable roadblock modal
--------------------------- */

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

/* helper: show roadblock modal (unclickable). mode: 'not-signed-in' | 'profanity' */
function showRoadblock(mode){
  if(mode === 'not-signed-in'){
    road1.textContent = "You must be signed in to use Moon Chat.";
    road2.textContent = "Sign in from the app to continue.";
  } else if(mode === 'profanity'){
    road1.textContent = "We couldn't connect to our profanity checker.";
    road2.textContent = "You are unable to send messages right now.";
  }
  roadblock.style.display = 'flex';
  roadblock.setAttribute('aria-hidden','false');
}

/* helper: hide roadblock (not used for unclosable flows) */
function hideRoadblock(){ roadblock.style.display='none'; roadblock.setAttribute('aria-hidden','true'); }

/* small util: create message DOM node */
function renderMessageRow(msgRow){ 
  // msgRow: { id, user_id, message, inserted_at, profile: { username, avatar_url } }
  const row = document.createElement('div');
  const outgoing = (currentUser && msgRow.user_id === currentUser.id);

  row.className = 'msg-row ' + (outgoing ? 'outgoing' : 'incoming') + ' msg-appear';
  row.dataset.id = msgRow.id;

  // avatar area
  const meta = document.createElement('div');
  meta.className = 'msg-meta' + (outgoing ? ' right' : '');
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'avatar';
  const av = document.createElement('img');
  av.alt = msgRow.profile?.username || 'U';
  av.src = msgRow.profile?.avatar_url || `https://placehold.co/80x80/000/fff?text=${(msgRow.profile?.username || 'U')[0].toUpperCase()}`;
  avatarWrap.appendChild(av);

  // username
  const uname = document.createElement('div');
  uname.className = 'username';
  uname.textContent = outgoing ? (msgRow.profile?.username ? msgRow.profile.username + ' (You)' : 'You') : (msgRow.profile?.username || 'User');

  // bubble
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msgRow.message;

  meta.appendChild(uname);
  meta.appendChild(bubble);

  // arrange: left avatar + meta for incoming, reverse for outgoing (CSS handles it)
  row.appendChild(avatarWrap);
  row.appendChild(meta);

  // append to messages
  messagesEl.appendChild(row);
  // scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* fetch profiles map by ids */
async function fetchProfilesMap(userIds){
  if(!userIds || userIds.length===0) return {};
  const { data, error } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
  if(error) return {};
  const map = {};
  data.forEach(p => map[p.id] = p);
  return map;
}

/* Load recent messages (last 100) and render (oldest -> newest) */
async function loadInitialMessages(){
  messagesEl.innerHTML = ''; // clear skeletons
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id,user_id,message,inserted_at')
      .order('inserted_at', {ascending:true})
      .limit(200);

    if(error) {
      console.error('load messages error', error);
      return;
    }

    // fetch profiles for unique user_ids
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

/* subscribe to new messages using postgres_changes via channel */
function subscribeToMessages(){
  // unsubscribe previous if exists
  if(channel) {
    try { channel.unsubscribe(); } catch(e){ /* ignore */ }
  }

  channel = supabase.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      // payload.new contains the message
      const newRow = payload.new;
      // fetch profile for sender
      const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', newRow.user_id).maybeSingle();
      renderMessageRow({
        id: newRow.id,
        user_id: newRow.user_id,
        message: newRow.message,
        inserted_at: newRow.inserted_at,
        profile: profile || null
      });
    })
    .subscribe(status => {
      // status callback not always available; we rely on general client state
      console.log('subscribe status', status);
    });
}

/* live profanity check while typing (debounced) */
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
  // abort previous controller
  if(liveProfanityController) { try { liveProfanityController.abort(); } catch(e){} }
  liveProfanityController = new AbortController();
  const controller = liveProfanityController;

  // quick empty check
  if(!text || text.trim().length === 0){
    inputError.style.display = 'none'; inputEl.classList.remove('input-error'); typingSafe = false; sendBtn.disabled = true; return;
  }

  // call profanity API (short timeout)
  try {
    const res = await fetch('https://vector.profanity.dev', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: text }),
      signal: controller.signal
    });
    if(!res.ok) throw new Error('bad profanity response');
    const data = await res.json();
    // the API returns something like { isProfanity: true/false } — treat truthy
    if(myToken !== typingCheckToken) return; // stale
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
    // if call fails while typing, be permissive but disable send until confirmed at send time
    console.warn('live profanity check failed', err);
    inputError.style.display = 'none';
    inputEl.classList.remove('input-error');
    typingSafe = false;
    sendBtn.disabled = false; // allow send optimistically (final check will gate)
  }
}

/* final check with timeout; if no response in 10s -> show roadblock and return { ok:false, reason:'timeout' } */
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

/* send message flow */
async function sendMessageFlow(){
  const text = inputEl.value.trim();
  if(!text) return;
  // disable UI while sending
  sendBtn.disabled = true;
  sendIcon.className = 'fa-solid fa-circle-notch fa-spin';
  // final profanity check
  const check = await finalProfanityCheck(text);
  if(!check.ok){
    // timeout / network
    showRoadblock('profanity');
    sendIcon.className = 'fa-solid fa-paper-plane';
    sendBtn.disabled = true;
    return;
  }
  if(check.isProfanity){
    inputError.style.display = 'block';
    inputEl.classList.add('input-error');
    inputError.textContent = "This message isn't appropriate for moonlight.";
    sendIcon.className = 'fa-solid fa-paper-plane';
    sendBtn.disabled = true;
    return;
  }

  // passed -> insert into messages
  try {
    const { error } = await supabase.from('messages').insert([{ user_id: currentUser.id, message: text }]);
    if(error){
      console.error('insert error', error);
      showMsg('Failed to send message');
    } else {
      // clear input
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
    sendBtn.disabled = true;
  }
}

/* keyboard handling: Enter to send, Shift+Enter newline */
inputEl.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    if(!sendBtn.disabled) sendMessageFlow();
  }
});

/* live typing -> debounce profanity check */
inputEl.addEventListener('input', (e) => {
  const v = e.target.value;
  // disable send until safe
  sendBtn.disabled = true;
  inputError.style.display = 'none';
  inputEl.classList.remove('input-error');

  liveDebounced(() => liveProfanityCheck(v), 420);
});

/* wire up send button */
sendBtn.addEventListener('click', async () => {
  if(sendBtn.disabled) return;
  await sendMessageFlow();
});

/* helper: show signed-in user label, or show roadblock if not signed in */
async function checkAuthAndInit(){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user || !user.id){
    // not signed in — show unclosable roadblock modal
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

  // enable composer only when typingSafe after checks; initially disabled until typing check
  sendBtn.disabled = true;

  // load messages and subscribe
  await loadInitialMessages();
  subscribeToMessages();
}

/* small helper for showing one-off messages in UI (not used heavily) */
function showMsg(text){
  const el = document.createElement('div');
  el.className = 'helper';
  el.style.margin = '8px';
  el.textContent = text;
  panelAppendTemp(el);
}
function panelAppendTemp(el){
  const parent = document.querySelector('.card');
  parent.appendChild(el);
  setTimeout(()=>el.remove(),2500);
}

/* start: wait for supabase client to be ready */
onClientReady(() => {
  try { checkAuthAndInit(); } catch(e){ console.error('chat init failed', e); }
});