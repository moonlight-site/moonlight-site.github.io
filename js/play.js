  const game = JSON.parse(sessionStorage.getItem("currentGame"));

  if (!game) {
    alert("No game found.");
    window.location.href = "index.html";
  }

  const iframe = document.getElementById("gameFrame");
  const loader = document.getElementById("loader");

  document.getElementById("gameImg").src = game.img_url || "https://placehold.co/500x500/000/fff?text=?";
  document.getElementById("gameName").textContent = game.name || "Couldn't load.";

  // Load iframe immediately
  iframe.src = game.url || "#";

  // Fade-out overlay after 3s
  setTimeout(() => {
    loader.classList.add("hide");
    setTimeout(() => loader.style.display = "none", 700);
  }, 3000);

  // Reload button
  document.getElementById("reloadBtn").onclick = () => {
    iframe.src = iframe.src;
  };

  // Fullscreen button
  document.getElementById("fullscreenBtn").onclick = () => {
    if (iframe.requestFullscreen) iframe.requestFullscreen();
    else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
  };