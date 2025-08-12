/* main.js */
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
