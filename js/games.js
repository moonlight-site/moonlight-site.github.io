// Supabase client will be provided globally by `chip.js` as window.supabaseClient.
// We wait for it (or the 'supabase-ready' event) and then proceed.
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

/* state */
let games = [];
let filtered = [];
let userFavorites = []; // array of game ids
let currentUserId = null;
const contentArea = document.getElementById('contentArea');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');

/* helpers */
const delay = ms => new Promise(r => setTimeout(r, ms));
function ellipsize(str, n){ return str.length > n ? str.slice(0,n) + '...' : str; }

/* fetch games and favorites, but ensure skeleton shown for minimum 3s */
async function loadData(){
  // show skeleton is already in DOM. We will fetch and wait at least 3s.
  try {
    const fetchGames = supabase.from('games').select('*');
    const sessionResp = await supabase.auth.getSession();
    currentUserId = sessionResp.data.session?.user?.id || null;

    // fetch games and favorites in parallel
    const [gamesRes, favRes] = await Promise.all([
      fetchGames,
      currentUserId ? supabase.from('favorites').select('favorites').eq('id', currentUserId).single() : Promise.resolve({ data: null, error: null })
    ]);

    if (gamesRes.error) throw gamesRes.error;
    games = (gamesRes.data || []).map(g => ({ ...g, id: g.id })); // preserve id

    if (favRes && !favRes.error && favRes.data) {
      userFavorites = favRes.data.favorites || [];
    } else {
      userFavorites = [];
    }

    // ensure skeleton visible for at least 3s
    await delay(3000);

    // render with initial sort
    filtered = [...games];
    applyFilters(); // This will sort by your_favorites by default
  } catch (err) {
    console.error('loadData error', err);
    // hide skeleton and show an empty/error
    contentArea.innerHTML = `<div class="empty">Couldn't load games. Check network / Supabase.</div>`;
  }
}

/* render functions */
function renderGrid(){
  if (!filtered || filtered.length === 0) {
    contentArea.innerHTML = `<div class="empty">No games found.</div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  filtered.forEach(game => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-game-id', game.id);

    // thumb
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    const img = document.createElement('img'); img.src = game.img_url || `https://placehold.co/500x500/000/fff?text=${encodeURIComponent(game.name?.slice(0,1) || 'G')}`;
    img.alt = game.name || 'Game';
    thumb.appendChild(img);

    // title and chips
    const titleRow = document.createElement('div'); titleRow.className = 'title-row';
    const name = document.createElement('div'); name.className = 'name'; name.textContent = game.name || 'Untitled';
    const chips = document.createElement('div'); chips.className = 'chips';
    const playsChip = document.createElement('div'); playsChip.className = 'chip'; playsChip.innerHTML = `<i class="fa-solid fa-play"></i> ${game.plays ?? 0}`;
    const favChip = document.createElement('div'); favChip.className = 'chip'; favChip.innerHTML = `<i class="fa-solid fa-heart"></i> ${game.favorites ?? 0}`;
    chips.append(playsChip, favChip);
    titleRow.append(name, chips);



    // actions
    const actions = document.createElement('div'); actions.className = 'actions';
    const playBtn = document.createElement('a'); playBtn.className = 'play-btn'; playBtn.href = game.url || '#';
    playBtn.innerHTML = `<i class="fa-solid fa-play"></i><span style="font-weight:600">Play</span>`;
    playBtn.onclick = async (e) => {
      e.preventDefault(); // Prevent default link behavior
      
      // Update plays count in UI immediately (optimistic)
      const newPlays = (game.plays || 0) + 1;
      playsChip.innerHTML = `<i class="fa-solid fa-play"></i> ${newPlays}`;
      game.plays = newPlays;
      
      // Save game details to sessionStorage
      const gameDetails = {
        name: game.name || 'Untitled Game',
        img_url: game.img_url || `https://placehold.co/500x500/000/fff?text=${encodeURIComponent(game.name?.slice(0,1) || 'G')}`,
        url: game.url || '#'
      };
      sessionStorage.setItem('currentGame', JSON.stringify(gameDetails));
      
      // Update database
      try {
        const { error } = await supabase.from('games')
          .update({ plays: newPlays })
          .eq('id', game.id);
        if (error) {
          console.error('Failed to update play count:', error);
          // Revert UI if failed
          playsChip.innerHTML = `<i class="fa-solid fa-play"></i> ${game.plays - 1}`;
          game.plays--;
        } else {
          // Update the games array to keep it in sync
          games = games.map(g => g.id === game.id ? { ...g, plays: newPlays } : g);
          // Redirect to play page after successful update
          window.location.href = '/play';
        }
      } catch (err) {
        console.error('Error updating play count:', err);
        // Revert UI on error
        playsChip.innerHTML = `<i class="fa-solid fa-play"></i> ${game.plays - 1}`;
        game.plays--;
      }
    };
    const favBtn = document.createElement('button'); favBtn.className = 'fav-btn';
    const isFav = userFavorites.includes(game.id);
    favBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
    favBtn.title = isFav ? 'Remove favorite' : 'Add favorite';
    favBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(game, favBtn, favChip); };

    actions.append(playBtn, favBtn);

    // assemble
    card.append(thumb, titleRow, actions);
    grid.appendChild(card);
  });

  contentArea.innerHTML = '';
  contentArea.appendChild(grid);
}

/* search filter + sort */
function applyFilters(){
  const q = searchInput.value.trim().toLowerCase();
  filtered = games.filter(g => {
    if (!q) return true;
    const nameMatch = (g.name || '').toLowerCase().includes(q);
    const tags = (g.tags || '') + ''; // tags string
    const tagMatch = (tags.toLowerCase().split(',').map(s=>s.trim())).some(t => t && t.includes(q));
    return nameMatch || tagMatch;
  });

  const sort = sortSelect.value;
  if (sort === 'plays') filtered.sort((a,b) => (b.plays||0) - (a.plays||0));
  else if (sort === 'favorites') filtered.sort((a,b) => (b.favorites||0) - (a.favorites||0));
  else if (sort === 'your_favorites') {
    // bring favorites first, then rest by plays
    filtered.sort((a,b) => {
      const aFav = userFavorites.includes(a.id) ? 1 : 0;
      const bFav = userFavorites.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return (b.plays||0) - (a.plays||0);
    });
  } else {
    // relevance default: by match and plays
    filtered.sort((a,b) => (b.plays||0) - (a.plays||0));
  }

  renderGrid();
}

/* favorites toggle */
let favLock = new Set();
async function toggleFavorite(game, favBtn, favChip) {
  if (!currentUserId) {
    alert('Please sign in to favorite games.');
    return;
  }
  // prevent double clicks
  if (favLock.has(game.id)) return;
  favLock.add(game.id);

  const currentlyFav = userFavorites.includes(game.id);
  // optimistic UI
  if (currentlyFav) {
    userFavorites = userFavorites.filter(id => id !== game.id);
    favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    favBtn.title = 'Add favorite';
    // decrement displayed count
    favChip.innerHTML = `<i class="fa-solid fa-heart"></i> ${Math.max((game.favorites||0) - 1, 0)}`;
  } else {
    userFavorites = [...userFavorites, game.id];
    favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    favBtn.title = 'Remove favorite';
    favChip.innerHTML = `<i class="fa-solid fa-heart"></i> ${((game.favorites||0) + 1)}`;
  }

  // update DB: upsert favorites row and update games.favorites count
  try {
    // upsert favorites row for user
    await supabase.from('favorites').upsert({ id: currentUserId, favorites: userFavorites }).select();

    // Update games table favorites count
    const inc = currentlyFav ? -1 : 1;
    const newFavorites = Math.max((game.favorites || 0) + inc, 0);
    const { error: gErr } = await supabase.from('games')
      .update({ favorites: newFavorites })
      .eq('id', game.id);
    
    if (gErr) {
      console.warn('games update failed', gErr);
      // Revert optimistic UI updates
      userFavorites = currentlyFav ? [...userFavorites, game.id] : userFavorites.filter(id => id !== game.id);
      favBtn.innerHTML = currentlyFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
      favChip.innerHTML = `<i class="fa-solid fa-heart"></i> ${game.favorites}`;
    } else {
      // Update was successful, update local state
      game.favorites = newFavorites;
      games = games.map(g => g.id === game.id ? { ...g, favorites: newFavorites } : g);
      // Re-sort if needed based on current sort selection
      if (['favorites', 'your_favorites'].includes(sortSelect.value)) {
        applyFilters();
      }
    }
  } catch (err) {
    console.error('fav toggle err', err);
    // revert optimistic
    if (currentlyFav) {
      userFavorites = [...userFavorites, game.id];
      favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
      userFavorites = userFavorites.filter(id => id !== game.id);
      favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
    // refresh UI counts from games array (client handled at module top)
    renderGrid();
  } finally {
    favLock.delete(game.id);
  }

}
/* events */
/* events */
searchInput.addEventListener('input', () => { applyFilters(); });
sortSelect.addEventListener('change', () => { applyFilters(); });

/* initial load: wait for supabase client to be ready */
onClientReady(async ()=>{
  try { await loadData(); } catch(e){ console.error('loadData failed', e); }

  /* listen to auth changes to update favorites when user logs in/out */
  supabase.auth.onAuthStateChange(async () => {
    const s = await supabase.auth.getSession();
    currentUserId = s.data.session?.user?.id || null;
    // reload favorites if logged in
    if (currentUserId) {
      const favRes = await supabase.from('favorites').select('favorites').eq('id', currentUserId).single();
      userFavorites = favRes && favRes.data ? favRes.data.favorites || [] : [];
    } else {
      userFavorites = [];
    }
    applyFilters();
  });
});