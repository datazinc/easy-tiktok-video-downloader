/* main.js */
// Initialize theme
(function() {
  const THEME_MODE_KEY = "tik.tok::themeMode";
  const themeMode = localStorage.getItem(THEME_MODE_KEY) || "dark";
  
  if (themeMode === "dark") {
    document.body.classList.add("theme-dark");
    document.documentElement.classList.add("theme-dark");
  } else {
    document.body.classList.remove("theme-dark");
    document.documentElement.classList.remove("theme-dark");
  }
})();

document.getElementById("startBtn").addEventListener("click", (e) => {
  e.preventDefault();
  const input = document.getElementById("username");
  let username = input.value.trim();
  const tiktokHostUrl = "https://tiktok.com/";

  if (username.startsWith("@")) username = username.slice(1);
  if (
    username.startsWith("https://tiktok.com") ||
    username.startsWith("https://www.tiktok.com")
  ) {
    window.open(username);
    return;
  }
  if (
    username.startsWith("tiktok.com") ||
    username.startsWith("www.tiktok.com")
  ) {
    window.open("https://" + username);
    return;
  }

  if (!username) {
    window.open(tiktokHostUrl, "_blank");
    return;
  }

  window.open(`${tiktokHostUrl}@${username}`, "_blank");
});
