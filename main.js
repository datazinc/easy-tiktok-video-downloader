document.getElementById("startBtn").addEventListener("click", () => {
    let input = document.getElementById("username");
    let username = input.value;
    let tiktokHostUrl = "https://tiktok.com/";
    if (username[0] == "@") username = username.substr(1);
    if (!username)
        if (confirm("No username provided. Continue to tiktok.com anyways?"))
            window.open(tiktokHostUrl, "_blank");
        else return;

    window.open(tiktokHostUrl + "@" + username, "_blank");
});
