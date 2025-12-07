// The supabaseClient will be provided by chip.js globally.
let supabase = null;

// Phrases for the typing animation (will follow "Your internet, ")
const PHRASES = [
    "your rules.",
    "unblocked.",
    "always private.",
    "ready for the next level?"
];

// --- 1. Typing Animation Logic (Updated Target) ---
// Target the span inside the slogan p tag
const el = document.querySelector('#typing-slogan span'); 
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function type() {
    const currentPhrase = PHRASES[phraseIndex];
    let displayText = '';

    if (isDeleting) {
        displayText = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
    } else {
        displayText = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
    }

    el.textContent = displayText;

    let typingSpeed = isDeleting ? 30 : 100;

    if (!isDeleting && charIndex === currentPhrase.length) {
        typingSpeed = 5000; // Stay at full phrase for 5 seconds
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        typingSpeed = 500; // Pause before starting next phrase
    }

    setTimeout(type, typingSpeed);
}


// --- 2. Supabase Initialization and Data Loading ---
function onClientReady(cb){ 
    if (window.supabaseClient) {
        supabase = window.supabaseClient;
        cb();
    } else {
        window.addEventListener('supabase-ready', (e)=>{
            supabase = (e && e.detail && e.detail.client) || window.supabaseClient || null;
            if (supabase) cb();
        }, { once: true });
    }
}

async function loadStatsAndAuth(){
    // a) Fetch Game Count
    try {
        const { count, error } = await supabase.from('games').select('*', { count: 'exact', head: true });
        if (error) throw error;
        // Use a more readable format for the count
        document.getElementById('game-count').textContent = (count || 0).toLocaleString();
    } catch (e) {
        console.error('Failed to load game count:', e);
        document.getElementById('game-count').textContent = '150+'; // Fallback
    }

    // b) Dynamic Auth Button Check
    const authCta = document.getElementById('auth-cta');
    const session = await supabase.auth.getSession();
    
    // Hide the Sign In button if a session exists (user is logged in)
    if (session.data.session) {
        authCta.style.display = 'none';
    }

    // c) Listen for Auth changes to dynamically hide/show the button
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            authCta.style.display = 'none';
        } else if (event === 'SIGNED_OUT') {
            authCta.style.display = 'inline-block';
        }
    });
    
    // d) Load Game Showcase
    loadGameShowcase();
}

// --- 3. Load Game Showcase ---
async function loadGameShowcase() {
    try {
        // Fetch top 4 games by play count
        const { data: topGames, error: gamesError } = await supabase
            .from('games')
            .select('id, name, img_url, url, plays')
            .order('plays', { ascending: false })
            .limit(4); 

        if (gamesError) throw gamesError;

        const grid = document.getElementById('showcase-grid');
        grid.innerHTML = ''; // Clear skeleton/placeholders

        topGames.forEach(game => {
            const card = document.createElement('a');
            // Link to the game's URL or the main /play page
            card.href = game.url ? `${game.url}` : `/play?gameId=${game.id}`; 
            card.className = 'showcase-card';
            
            const img = document.createElement('img');
            // Fallback image if img_url is missing
            img.src = game.img_url || `https://placehold.co/500x500/000/fff?text=${encodeURIComponent(game.name?.slice(0,1) || 'G')}`;
            img.alt = game.name;
            
            const name = document.createElement('div');
            name.className = 'showcase-name';
            name.textContent = game.name;

            const plays = document.createElement('div');
            plays.className = 'showcase-plays';
            plays.innerHTML = `<i class="fa-solid fa-play"></i> ${(game.plays || 0).toLocaleString()} Plays`;

            card.append(img, name, plays);
            grid.appendChild(card);
        });

    } catch (e) {
        console.error('Failed to load game showcase:', e);
        // On error, the section will remain with the placeholder skeletons or be empty.
    }
}


// --- 4. Run on Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Start the typing animation immediately
    type();

    // Wait for Supabase client to be ready, then load stats, auth, and games
    onClientReady(loadStatsAndAuth);
});