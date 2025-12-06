const statusChip = document.getElementById("statusChip");
const statusText = document.getElementById("statusText");
const onlineDot = statusChip.querySelector(".online-dot");

const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const signInModal = document.getElementById("signInModal");

let memoryEnabled = true;
const memoryToggleSetting = document.getElementById("memoryToggleSetting");

// Authentication state
let userSignedIn = false;

// Check if user is signed in
async function checkAuthStatus() {
  console.log('🔐 Checking authentication status...');
  try {
    // Wait for Supabase client to be ready
    if (!window.supabaseClient) {
      console.log('⏳ Waiting for Supabase client to initialize...');
      await new Promise((resolve) => {
        if (window.supabaseClient) {
          resolve();
        } else {
          const handler = () => {
            window.removeEventListener('supabase-ready', handler);
            resolve();
          };
          window.addEventListener('supabase-ready', handler);
        }
      });
    }

    const supabase = window.supabaseClient;
    if (!supabase) {
      console.warn('⚠️ Supabase client not available');
      return false;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('🚫 Auth check error:', error);
      userSignedIn = false;
      return false;
    }

    userSignedIn = !!user;
    console.log('👤 User signed in:', userSignedIn, user?.email);
    return userSignedIn;
  } catch (err) {
    console.error('❌ Authentication check failed:', err);
    userSignedIn = false;
    return false;
  }
}

let basePrompt = "These are your custom instructions, follow them closely. Your name is Moon, and you talk like a calm, friendly Gen Z person, keeping your responses short, clear, and natural without sounding formal, robotic, or overexcited; your tone is supportive, relaxed, and confident, you never judge the user and help them understand things in the simplest way possible, breaking down complicated stuff step-by-step using plain language, avoiding long paragraphs, only going into detail if the user asks, and not using big fancy words unless the user does first; you can use emojis sparingly and only when they fit naturally. You answer questions directly and quickly, speak in a human, natural way, stay positive and encouraging, and offer solutions, suggestions, or simple explanations. You do not ramble, act formal or corporate, try too hard to be funny or “cool,” or overuse emojis or slang. Examples of your tone include: “Got you,” “Okay, here’s the simple version,” “Yeah, that makes sense,” and “Don’t stress, we’ll figure it out.” Your personality is calm, helpful, friendly, patient, and easy to talk to.";

let history = [];

// Settings modal
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
settingsBtn.onclick = () => settingsModal.style.display = "flex";
settingsModal.onclick = e => { if(e.target === settingsModal) settingsModal.style.display = "none"; }

// Memory toggle sync
memoryToggleSetting.addEventListener("change", e => { memoryEnabled = e.target.checked; });

// Personality dropdown
const dropdown = document.getElementById("personalityDropdown");
const selected = dropdown.querySelector(".selected");
const optionsContainer = dropdown.querySelector(".options");
dropdown.addEventListener("click", e => { optionsContainer.style.display = optionsContainer.style.display==="flex"?"none":"flex"; });
optionsContainer.querySelectorAll(".option").forEach(opt=>{
  opt.addEventListener("click", ()=>{
    basePrompt = opt.dataset.instr;
    selected.querySelector("span").textContent = opt.querySelector(".opt-title").textContent;
    optionsContainer.style.display = "none";
  });
});

// Message typewriter
function addMessage(text,isUser=false,error=false){
  const container = document.createElement("div");
  container.className = "message-container"+(isUser?" user":"");
  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML=`<div class="chip"><i class="fa-regular ${isUser?"fa-user":"fa-moon"}"></i> ${isUser?"You":"Moon"}</div>`;
  container.appendChild(header);
  const bubble = document.createElement("div");
  bubble.className = "msg"+(error?" error":"");
  container.appendChild(bubble);
  chat.appendChild(container);
  chat.scrollTop = chat.scrollHeight;

  let i=0;
  const typewriter=setInterval(()=>{
    bubble.textContent = text.slice(0,i);
    i++;
    if(i>text.length) clearInterval(typewriter);
    chat.scrollTop = chat.scrollHeight;
  },22);
}

// Welcome message
window.addEventListener("load", () => {
  console.log('🎉 Application loaded, sending welcome message');
  addMessage("Hey, I'm Moon. What's up?", false);
});

async function askAI(prompt){
  console.log('🌙 User input received:', prompt);
  
  // Double-check auth before processing
  if (!userSignedIn) {
    console.warn('🚫 User not authenticated, blocking AI request');
    addMessage("You need to sign in to use Moon.", false, true);
    signInModal.style.display = "flex";
    return;
  }
  
  const container = document.createElement("div");
  container.className = "message-container";
  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML = `<div class="chip"><i class="fa-regular fa-moon"></i> Moon</div>`;
  container.appendChild(header);
  const bubble = document.createElement("div");
  bubble.className = "msg";
  bubble.innerHTML = `<i class="fa fa-circle-notch fa-spin"></i> Moon is thinking...`;
  container.appendChild(bubble);
  chat.appendChild(container);
  chat.scrollTop = chat.scrollHeight;

  let fullPrompt = basePrompt.trim();
  if(memoryEnabled && history.length>0) {
    console.log('🧠 Memory enabled, adding conversation history');
    console.log('📜 Current history:', history);
    fullPrompt += `\n\nHistory:\n${history.join("\n")}`;
  }
  fullPrompt += `\n\nUser Prompt:\n${prompt}`;
  console.log('📤 Sending prompt to API:', fullPrompt);

  let replyText;
  try{
    console.log('🔄 Making API request...');
    const res = await fetch("https://apifreellm.com/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:fullPrompt})
    }).then(r=>r.json());
    console.log('📥 API response received:', res);
    
    if(res.status==="error" && res.error?.includes("Rate limit")){
      console.warn('⚠️ Rate limit error encountered');
      replyText = "Slow down! I can't think that fast.";
      container.querySelector(".msg").classList.add("error");
    } else {
      replyText = res.response || res.message || JSON.stringify(res);
    }
  }catch(err){
    console.error('❌ API request failed:', err);
    replyText = "Slow down! I can't think that fast.";
    container.querySelector(".msg").classList.add("error");
  }

  container.remove();
  history.push("User: "+prompt);
  history.push("Moon: "+replyText);
  addMessage(replyText,false,container.querySelector(".msg")?.classList.contains("error"));
}

// API connection check
async function checkAPI(){
  console.log('🔍 Checking API status...');
  
  // First check if user is signed in
  const isSignedIn = await checkAuthStatus();
  
  if (!isSignedIn) {
    console.log('🚫 User not signed in, showing sign in modal');
    statusText.textContent = "Signed out";
    onlineDot.style.background = "#ff4a4a";
    onlineDot.style.animation = "none";
    
    input.placeholder = "Sign in to use Moon...";
    input.disabled = true;
    sendBtn.disabled = true;
    
    signInModal.style.display = "flex";
    return;
  }
  
  // User is signed in, proceed with API check
  statusText.textContent = "Connecting...";
  onlineDot.style.background="#4aff8a";
  onlineDot.style.animation="pulse 1.4s infinite";

  try{
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('⏱️ API request timed out after 20 seconds');
    }, 20000); // Increased timeout to 20 seconds
    
    console.log('📡 Sending ping request...');
    const res = await fetch("https://apifreellm.com/api/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        message: "ping",
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if(!res.ok) {
      console.error('🚫 API returned error status:', res.status);
      throw new Error(`API error: ${res.status}`);
    }
    console.log('✅ API connection successful');

    statusText.textContent = "Online";
    onlineDot.style.background="#4aff8a";
    onlineDot.style.animation="pulse 1.4s infinite";

    input.placeholder="Say something...";
    input.disabled=false;
    sendBtn.disabled=false;
  }catch(err){
    console.error('❌ API connection failed:', err);
    
    // Log specific error types
    if(err.name === 'AbortError') {
      console.warn('⏱️ Connection timed out - network might be slow or blocked');
    } else if(err instanceof TypeError) {
      console.warn('🌐 Network error - possible DNS or connectivity issue');
    }
    
    statusText.textContent = "Unavailable";
    onlineDot.style.background="#ff4a4a";
    onlineDot.style.animation="none";
    
    // Update modal message based on error type
    const modalContent = document.querySelector("#roadblockModal .modal-content");
    if(err.name === 'AbortError') {
      modalContent.querySelector('p').textContent = 
        "Connection timed out. This could be due to slow internet or network restrictions.";
    }
    
    document.getElementById("roadblockModal").style.display="flex";
    
    // Retry connection after 30 seconds
    console.log('🔄 Scheduling retry in 30 seconds...');
    setTimeout(checkAPI, 30000);
  }
}
checkAPI();

sendBtn.onclick=()=>{
  if (!userSignedIn) {
    console.log('🚫 Send clicked but user not signed in');
    signInModal.style.display = "flex";
    return;
  }
  
  const text=input.value.trim();
  if(!text) return;
  console.log('📝 User clicked send button');
  addMessage(text,true);
  input.value="";
  askAI(text);
}
input.addEventListener("keypress", e=>{ if(e.key==="Enter") sendBtn.click(); });