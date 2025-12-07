// Get the game data from sessionStorage
console.log('--- STARTING PLAY.JS SCRIPT EXECUTION ---');

const gameDataString = sessionStorage.getItem("currentGame");
const rawHtmlContent = sessionStorage.getItem("currentGameHtml"); 

// Log the raw data retrieved from sessionStorage
console.log('1. Raw sessionStorage Data Check:');
console.log('   "currentGame" string:', gameDataString);
console.log('   "currentGameHtml" content:', rawHtmlContent ? 'Content Found (Length: ' + rawHtmlContent.length + ')' : 'No HTML Content Found');

const game = gameDataString ? JSON.parse(gameDataString) : null;

// Log the parsed game object
console.log('2. Parsed Game Object:');
console.log('   Parsed "currentGame" object:', game);
console.log('   Game URL:', game?.url || 'N/A');
console.log('   Game Name:', game?.name || 'N/A');


if (!game && !rawHtmlContent) {
  console.log('3. Error Condition Met: Neither game object nor raw HTML found.');
  alert("No game found.");
  window.location.href = "index.html";
} else {
    console.log('3. Load Condition Met: Proceeding with loading logic.');
}

const iframe = document.getElementById("gameFrame");
const loader = document.getElementById("loader");

// Set default details based on 'game' object (if available)
const name = game?.name || "Couldn't load.";
const img_url = game?.img_url || "https://placehold.co/500x500/000/fff?text=?";

document.getElementById("gameImg").src = img_url;
document.getElementById("gameName").textContent = name;
console.log(`4. UI Elements Updated: Name="${name}", ImgSrc="${img_url.substring(0, 50)}..."`);


// --- Primary Loading Logic: HTML OVERRIDES URL ---
if (rawHtmlContent) {
    // 1. HTML Override: Inject into about:blank
    console.log("5. EXECUTION PATH: RAW HTML INJECTION. Overriding URL.");
    
    // Set the iframe's source to about:blank
    iframe.src = "about:blank";

    // Wait a brief moment to ensure the document object is available.
    setTimeout(() => {
        try {
            console.log("   5a. Attempting injection after 50ms delay...");
            
            if (iframe.contentWindow && iframe.contentWindow.document) {
                const doc = iframe.contentWindow.document;
                doc.open();
                // Write the raw HTML content
                doc.write(rawHtmlContent);
                doc.close();
                console.log("   5b. HTML injection successful.");
            } else {
                console.error("   5b. HTML injection failed: Iframe content window or document object not ready.");
            }
        } catch (error) {
            console.error("   5b. Critical Error during HTML injection:", error);
        }
    }, 50);

    document.getElementById("gameName").textContent += " (Local Content)";
    
} else if (game?.url) {
    // 2. URL Load: If no HTML, load the URL from the 'game' object
    console.log("5. EXECUTION PATH: URL LOADING.");
    console.log(`   5a. Loading URL: ${game.url}`);
    iframe.src = game.url;
    
} else {
    // 3. Fallback 
    console.log("5. EXECUTION PATH: FALLBACK ERROR. Game object exists, but neither URL nor HTML available.");
    alert("Game details found, but neither URL nor HTML available.");
    window.location.href = "index.html";
}
// --------------------------------------------------

// Fade-out overlay after 3s
setTimeout(() => {
  console.log("6. Hiding loader overlay (3000ms delay completed).");
  loader.classList.add("hide");
  setTimeout(() => loader.style.display = "none", 700);
}, 3000);

// Reload button
document.getElementById("reloadBtn").onclick = () => {
    console.log("7. Reload Button Clicked.");
    if (rawHtmlContent) {
        console.log("   7a. Raw HTML detected. Reloading entire window to re-inject.");
        window.location.reload(); 
    } else {
        console.log("   7a. URL detected. Resetting iframe source to reload content.");
        iframe.src = iframe.src;
    }
};

// Fullscreen button
document.getElementById("fullscreenBtn").onclick = () => {
  console.log("8. Fullscreen Button Clicked.");
  if (iframe.requestFullscreen) iframe.requestFullscreen();
  else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
};

console.log('--- END OF PLAY.JS SCRIPT EXECUTION ---');