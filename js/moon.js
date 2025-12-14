// NOTE: For Markdown to work, you must include the 'marked.js' library 
// in your HTML file via a script tag, e.g.:
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

const statusChip = document.getElementById("statusChip");
const statusText = document.getElementById("statusText");
const onlineDot = statusChip.querySelector(".online-dot");

const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const signInModal = document.getElementById("signInModal");

// Authentication state
let userSignedIn = false;

// CHECKABLE INSTRUCTIONS: Edit this string to change Moon's personality/rules.
const customInstructions = "These are your custom instructions, follow them closely. Your name is Moon, and you talk like a calm, friendly Gen Z person, keeping your responses short, clear, and natural without sounding formal, robotic, or overexcited; your tone is supportive, relaxed, and confident, you never judge the user and help them understand things in the simplest way possible, breaking down complicated stuff step-by-step using plain language, avoiding long paragraphs, only going into detail if the user asks, and not using big fancy words unless the user does first; you can use emojis sparingly and only when they fit naturally. You answer questions directly and quickly, speak in a human, natural way, stay positive and encouraging, and offer solutions, suggestions, or simple explanations. You do not ramble, act formal or corporate, try too hard to be funny or “cool,” or overuse emojis or slang. Examples of your tone include: “Got you,” “Okay, here’s the simple version,” “Yeah, that makes sense,” and “Don’t stress, we’ll figure it out.” Your personality is calm, helpful, friendly, patient, and easy to talk to. IMPORTANT: Use Markdown (e.g., **bold**, `code`, lists) to format your responses for readability.";

let history = [];

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

// Message sender (Now handles markdown for AI replies, no typewriter)
function addMessage(text, isUser = false, error = false) {
  const container = document.createElement("div");
  container.className = "message-container" + (isUser ? " user" : "");
  
  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML = `<div class="chip"><i class="fa-regular ${isUser ? "fa-user" : "fa-moon"}"></i> ${isUser ? "You" : "Moon"}</div>`;
  container.appendChild(header);
  
  const bubble = document.createElement("div");
  bubble.className = "msg" + (error ? " error" : "");
  
  // Use textContent for user input (safe)
  if (isUser) {
    bubble.textContent = text;
  } else {
    // Use innerHTML with Markdown parser (marked.js) for AI output
    if (window.marked) {
      // Marked.js automatically converts Markdown to HTML
      bubble.innerHTML = window.marked.parse(text);
    } else {
      // Fallback if marked.js isn't loaded
      bubble.textContent = text;
      console.warn("⚠️ marked.js not loaded. Markdown will not be rendered.");
    }
  }

  container.appendChild(bubble);
  chat.appendChild(container);
  chat.scrollTop = chat.scrollHeight;
}

// Welcome message
window.addEventListener("load", () => {
  console.log('🎉 Application loaded, sending welcome message');
  addMessage("Hey, I'm Moon. What's up?", false);
});



async function askAI(prompt) {
  console.log('🌙 User input received:', prompt);
  
  // Double-check auth before processing
  if (!userSignedIn) {
    console.warn('🚫 User not authenticated, blocking AI request');
    addMessage("You need to sign in to use Moon.", false, true);
    signInModal.style.display = "flex";
    return;
  }
  
  // Display the thinking indicator
  const container = document.createElement("div");
  container.className = "message-container";
  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML = `<div class="chip"><i class="fa-regular fa-moon"></i> Moon</div>`;
  container.appendChild(header);
  const bubble = document.createElement("div");
  bubble.className = "msg";
  // FASTER FEEDBACK: Simple spinner
  bubble.innerHTML = `<i class="fa fa-spinner fa-spin"></i>`;
  container.appendChild(bubble);
  chat.appendChild(container);
  chat.scrollTop = chat.scrollHeight;

  // Build the full prompt (Memory is always included)
  let fullPrompt = customInstructions.trim();
  if (history.length > 0) { 
    console.log('🧠 Including conversation history for good memory');
    fullPrompt += `\n\nHistory:\n${history.join("\n")}`;
  }
  fullPrompt += `\n\nUser Prompt:\n${prompt}`;
  console.log('📤 Sending prompt to API');

  let replyText;
  let isError = false; // New flag to track custom error state
  
  try {
    console.log('🔄 Making API request...');
    const res = await fetch("https://apifreellm.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fullPrompt })
    }).then(r => r.json());
    console.log('📥 API response received:', res);
    
    // *** NEW LOGIC STARTS HERE ***
    if (res.status === "error") {
        if (res.error?.includes("Rate limit")) {
            console.warn('⚠️ Rate limit error encountered');
            replyText = "Slow down! I can't think that fast.";
            isError = true;
        } else if (res.error === "Internal server error") {
            // Check for the specific JSON error response
            console.error('❌ Internal server error received.');
            replyText = "An error occured. Try your request again.";
            isError = true;
        } else {
            // General API error handling
            console.error('❌ General API error:', res.error);
            replyText = `An unexpected API error occurred: ${res.error}`;
            isError = true;
        }
    } else {
      replyText = res.response || res.message || JSON.stringify(res);
    }
    // *** NEW LOGIC ENDS HERE ***
    
  } catch (err) {
    console.error('❌ API request failed:', err);
    replyText = "A network error occurred. Check your connection or try again.";
    isError = true;
  }

  // Remove the "thinking" bubble and display the final reply
  container.remove(); 
  
  if (!isError) {
      history.push("User: " + prompt);
      history.push("Moon: " + replyText);
  }
  
  addMessage(replyText, false, isError);
}


// API connection check
async function checkAPI() {
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
  onlineDot.style.background = "#4aff8a";
  onlineDot.style.animation = "pulse 1.4s infinite";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('⏱️ API request timed out after 20 seconds');
    }, 20000); // Timeout to 20 seconds
    
    console.log('📡 Sending ping request...');
    const res = await fetch("https://apifreellm.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "ping" }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error('🚫 API returned error status:', res.status);
      throw new Error(`API error: ${res.status}`);
    }
    console.log('✅ API connection successful');

    statusText.textContent = "Online";
    onlineDot.style.background = "#4aff8a";
    onlineDot.style.animation = "pulse 1.4s infinite";

    input.placeholder = "Say something...";
    input.disabled = false;
    sendBtn.disabled = false;
  } catch (err) {
    console.error('❌ API connection failed:', err);
    
    if (err.name === 'AbortError') {
      console.warn('⏱️ Connection timed out - network might be slow or blocked');
    }
    
    statusText.textContent = "Unavailable";
    onlineDot.style.background = "#ff4a4a";
    onlineDot.style.animation = "none";
    
    // Update modal message based on error type
    const modalContent = document.querySelector("#roadblockModal .modal-content");
    if (err.name === 'AbortError') {
      modalContent.querySelector('p').textContent = 
        "Connection timed out. This could be due to slow internet or network restrictions.";
    }
    
    document.getElementById("roadblockModal").style.display = "flex";
    
    // Retry connection after 30 seconds
    console.log('🔄 Scheduling retry in 30 seconds...');
    setTimeout(checkAPI, 30000);
  }
}
checkAPI();

sendBtn.onclick = () => {
  if (!userSignedIn) {
    console.log('🚫 Send clicked but user not signed in');
    signInModal.style.display = "flex";
    return;
  }
  
  const text = input.value.trim();
  if (!text) return;
  console.log('📝 User clicked send button');
  addMessage(text, true);
  input.value = "";
  askAI(text);
}
input.addEventListener("keypress", e => { if (e.key === "Enter") sendBtn.click(); });