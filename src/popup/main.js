/* main.js */
document.getElementById("startBtn").addEventListener("click", (e) => {
  e.preventDefault();
  const input = document.getElementById("username");
  let username = input.value.trim();
  const tiktokHostUrl = "https://tiktok.com/";

  if (username.startsWith("@")) username = username.slice(1);

  if (!username) {
    if (confirm("No username provided. Continue to tiktok.com anyway?")) {
      window.open(tiktokHostUrl, "_blank");
    }
    return;
  }

  window.open(`${tiktokHostUrl}@${username}`, "_blank");
});
