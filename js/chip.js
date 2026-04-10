document.addEventListener("DOMContentLoaded", () => {
  // Nuke all page content
  document.documentElement.innerHTML = "";

  // Redirect to shutdown page
  window.location.replace("/shutdown.html");
});
