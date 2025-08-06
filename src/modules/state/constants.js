// constants.js
export const STORAGE_KEYS = {
  // === 📦 User Preferences & UI State
  IS_DOWNLOADER_CLOSED: "tik.tok::isDownloaderClosed",
  SHOW_FOLDER_PICKER: "tik.tok::showFolderPicker",
  DOWNLOAD_FOLDER: "tik.tok::downloadFolder",
  FULL_PATH_TEMPLATES: "tik.tok::fullPathTemplates",
  SELECTED_FULL_PATH_TEMPLATE: "tik.tok::selectedFullPathTemplate",
  CURRENT_TIER_PROGRESS: "tik.tok::tierProgress",
  RATE_DONATE_DATA: "tik.tok::rateDonateData",
  DOWNLOADER_CUSTOM_POSITION: "tik.tok::customDownloaderPosition",
  DOWNLOADER_POSITION_TYPE: "tik.tok::downloaderPositionType",

  // Scrapper
  SCRAPPER_DETAILS: "tik.tok::scrapperDetails",

  // === ⬇️ Downloads Stats
  DOWNLOADS_ALL_TIME_COUNT: "tik.tok::downloads::allTimeCount", // number
  DOWNLOADS_WEEKLY_DATA: "tik.tok::downloads::weeklyData", // { count, weekId }

  // 👥 Downloads Leaderboards
  DOWNLOADS_LEADERBOARD_ALL_TIME: "tik.tok::downloads::leaderboard::allTime", // { authorId: { count, username, lastUpdatedAt } }
  DOWNLOADS_LEADERBOARD_WEEKLY: "tik.tok::downloads::leaderboard::weekly", // { weekId: { authorId: { count, username } } }

  // === 📣 Recommendations Stats
  RECOMMENDATIONS_ALL_TIME_COUNT: "tik.tok::recommendations::allTimeCount", // number
  RECOMMENDATIONS_WEEKLY_DATA: "tik.tok::recommendations::weeklyData", // { count, weekId }

  // 👥 Recommendations Leaderboards
  RECOMMENDATIONS_LEADERBOARD_ALL_TIME:
    "tik.tok::recommendations::leaderboard::allTime", // { authorId: { count, username, lastUpdatedAt } }
  RECOMMENDATIONS_LEADERBOARD_WEEKLY:
    "tik.tok::recommendations::leaderboard::weekly", // { weekId: { authorId: { count, username } } }
};

export const DOM_IDS = {
  DOWNLOADER_WRAPPER: "ttk-downloader-wrapper",
  DOWNLOADER_SCRAPPER_CONTAINER: "ttk-downloader-scrapper-container",
  SHOW_DOWNLOADER: "ettpd-show",
  DOWNLOAD_ALL_BUTTON: "ettpd-download-all-btn",
  NEXT_DATA: "__NEXT_DATA__",
  MODAL_CONTAINER: "modal-overlay-container",
};

export const UI_ELEMENTS = {
  LIKED_TAB_SELECTOR: 'p[role="tab"]',
  VIDEO_WRAPPER_SELECTOR: 'div[id^="xgwrapper"]',
};

export const DOWNLOAD_FOLDER_DEFAULT = "Easy TikTok Video Downloader";
export const DOWNLOAD_FOLDER_DEFAULT_PLACEHOLDER =
  "(Downloads)/Easy TikTok Video Downloader/@{username}/";

export const FILE_STORAGE_LOCATION_TEMPLATE_PRESETS = [
  {
    isDefault: true,
    label: "🟢 Default (@folder, all core info)",
    template:
      "@/@{authorUsername|unknown}/{ad}-{authorUsername|no-author}-{videoId|no-id}-{sequenceNumber}-{desc:30|-}.mp4",
    example: DOWNLOAD_FOLDER_DEFAULT + "/@coolguy/coolguy-abc123-1.mp4",
  },
  {
    label: "📁 Video Flat by Author",
    template: "videos/{authorUsername|unknown}/{videoId|no-id}.mp4",
    example: "videos/coolguy/abc123.mp4",
  },
  {
    label: "🖼️ Image Series (force numbered)",
    template:
      "images/{authorUsername|unknown}/{videoId|no-id}-{sequenceNumber|required}.jpeg",
    example: "images/coolguy/abc123-1.jpeg",
  },
  {
    label: "🧠 Descriptive (limit desc)",
    template:
      "desc_clips/{authorUsername|unknown}/{videoId|no-id}-{desc:30|no-desc}.mp4",
    example: "desc_clips/coolguy/abc123-My-best-clip-ever.mp4",
  },
  {
    label: "📢 Hashtags Folder (Weird ahh)",
    template: "hashtags/{hashtags|no-tags}/{videoId|no-id}.mp4",
    example: "hashtags/fun-relax/abc123.mp4",
  },
  {
    label: "🎶 Music by Artist",
    template:
      "music/{musicAuthor|unknown}/{videoId|no-id}-{authorUsername|no-author}.mp4",
    example: "music/DJFlow/abc123-coolguy.mp4",
  },
  {
    label: "🎛️ Creative Combo",
    template:
      "mix/{musicTitle|untitled}/{authorUsername|unknown}-{videoId|no-id}-{desc:20|no-desc}-{sequenceNumber}.mp4",
    example: "mix/Chill-Vibes/coolguy-abc123-Fun-tiktok-clip-1.mp4",
  },
  {
    label: "📦 Legacy Flat Format",
    template:
      "{authorUsername|user}-{videoId|no-id}-{sequenceNumber|required}.mp4",
    example: "coolguy-abc123-1.mp4",
  },
];

export const DATA_PRUNE_MAX_WEEKS_TO_KEEP = 12;
export const PRUNE_AFTER_MAX_WEEKS_OF_LOW_DOWNLOADS = 12;
export const PRUNE_LOW_DOWNLOADS_COUNT = 5;

export const DOWNLOAD_TIER_THRESHOLDS = [
  { min: 1, name: "Lil Clicker", emoji: "🍼" }, // 1
  { min: 5, name: "Hatchling", emoji: "🐣" }, // 5
  { min: 10, name: "Certified", emoji: "📥" }, // 10
  { min: 25, name: "Smooth Op", emoji: "😎" }, // 25
  { min: 50, name: "On Fire", emoji: "🔥" }, // 50
  { min: 100, name: "Clip Connoisseur", emoji: "🎬" }, // 100
  { min: 250, name: "Trend Thief", emoji: "⚡" }, // 250
  { min: 500, name: "Goblin Mode", emoji: "🧌" }, // 500
  { min: 1000, name: "Demon Time", emoji: "👹" }, // 1K
  { min: 5000, name: "Link Legend", emoji: "🧠" }, // 5K
  { min: 10000, name: "Vault Dragon", emoji: "🐉" }, // 10K
  { min: 50000, name: "Dead King", emoji: "💀👑" }, // 50K
  { min: 100000, name: "Ultimate Hoarder", emoji: "🐉" }, // 100K
];


export const RECOMMENDATION_TIER_THRESHOLDS = [
  { min: 1, name: "Just Hatched", emoji: "🥚" }, // 1
  { min: 5, name: "Lil Gremlin", emoji: "🧌" }, // 5
  { min: 10, name: "Intern Vibes", emoji: "🪪" }, // 10
  { min: 25, name: "Feeding", emoji: "🍽️" }, // 25
  { min: 50, name: "Online-ish", emoji: "📶" }, // 50
  { min: 100, name: "Fed Up", emoji: "🍔" }, // 100
  { min: 250, name: "Tastebud", emoji: "👅" }, // 250
  { min: 500, name: "Main Char", emoji: "🎬" }, // 500
  { min: 1000, name: "Algo Beast", emoji: "📡" }, // 1K
  { min: 5000, name: "5K Deep", emoji: "🕳️" }, // 5K
  { min: 10000, name: "Cooked", emoji: "🔥" }, // 10K
  { min: 50000, name: "No Return", emoji: "🚪" }, // 50K
  { min: 100000, name: "Overfed", emoji: "🤯" }, // 100K
  { min: 250000, name: "Lost Cause", emoji: "🧬" }, // 250K
  { min: 500000, name: "Soulbound", emoji: "🔗" }, // 500K
  { min: 1000000, name: "Too Online", emoji: "💀" }, // 1M
  { min: 5000000, name: "Pixelated", emoji: "📲" }, // 5M
  { min: 10000000, name: "Touch Grass", emoji: "🌱" }, // 10M
];



export const DOWNLOAD_SUCCESS_MESSAGES = [
  // === Template-based messages ===
  "✨ {count} {media} saved. Instant sparkle upgrade.",
  "⚡ {count} {media} charged up and downloaded.",
  "💽 {count} {media} backed up for digital eternity.",
  "🎒 Packed {count} {media} into your download bag.",
  "📂 {count} {media} filed under: certified awesome.",
  "🕶️ Coolness level +1 after downloading {count} {media}.",
  "🧃 {count} {media} — juicy download vibes.",
  "🔐 {count} {media} locked down like Fort Knox.",
  "🚁 {count} {media} airlifted directly into your downloads.",
  "🛸 {count} {media} beamed up and saved locally.",
  "🎬 {count} {media} directed by You. Produced by Swag.",
  "🗃️ {count} {media} safely archived in your stash.",
  "💫 {count} {media} entered the realm of ‘mine now'.",
  "📶 {count} {media} downloaded with full bars.",
  "🏁 {count} {media} — mission complete.",
  "🖼️ {count} {media} framed in your gallery of wins.",
  "🪄 Like magic! {count} {media} appeared on your device.",
  "🍩 {count} {media} — sweet, round, and fully downloaded.",
  "🔊 {count} {media} in. Loud and clear.",
  "🎈 {count} {media} floating into your storage like joy balloons.",
  "📦 Boxed it. Bagged it. {count} {media} now yours.",
  "🗂️ Filing complete — {count} {media} officially saved.",
  "🥶 {count} {media}? Ice cold download game.",
  "📡 {count} {media} received from the content gods.",
  "🏕️ {count} {media} pitched into your local camp.",
  "🛸 {count} {media} abducted into your device. Smooth.",
  "🍒 {count} {media} on top of your digital sundae.",
  "🏖️ Vacation vibes: {count} {media} secured.",
  "🍕 {count} {media} served hot and ready. Bon appétit.",
  "🧳 {count} {media} packed up. Ready for the journey.",
  "🎀 {count} {media} — wrapped, tagged, and delivered.",
  "💿 Burned {count} {media} into your data soul.",
  "📲 {count} {media} whispered straight into your storage.",
  "🎮 {count} {media} unlocked like bonus levels.",
  "🪙 {count} {media} collected. Add to your streak.",
  "🚢 {count} {media} landed in the download dock.",
  "📜 {count} {media} added to your scroll of greatness.",
  "🎯 {count} {media} bullseyed into your collection.",
  "🧁 {count} {media} — tasty, frosted, and downloaded.",
  "🛰️ Signal locked. {count} {media} received and confirmed.",
  "🎰 Jackpot! {count} {media} downloaded in style.",
  "💡 {count} {media} brightening up your file system.",
  "🎨 {count} {media} added to your personal museum.",
  "🧩 {count} {media} fits perfectly into your collection.",
  "🚿 Fresh drop! {count} {media} cleaned and downloaded.",
  "🪐 Orbiting your device now: {count} {media}.",
  "📌 {count} {media} pinned straight to your gallery.",
  "💼 {count} {media} filed under: ‘Epic Stuff'.",
  "🕳️ {count} {media} vanished from the web — into your device.",
  "💬 No cap. {count} {media} saved flawlessly.",

  // === Static & chaotic ones ===
  () => "All downloaded. Go touch grass 🌱.",
  () => "Nice click. Good choice. Powerful energy.",
  () => "You're dangerously good at pressing buttons.",
  () => "That was elite. Like, top 1% behavior.",
  () => "Downloads done. Your storage weeps with joy.",
  () => "Mmm. That was smooth. Download smooth.",
  () => "If downloads were art, you just made a masterpiece.",
  () => "They doubted you. But here you are. Downloaded.",
  () => "Somewhere, an angel gets wings for every file you save.",
  () => "✅ Boom. Another win for you.",
  () => "You vs. storage: you won. Storage surrendered.",
  () => "Low effort, high reward. Vibes immaculate.",
  () => "You're carrying the team. What team? Doesn't matter.",
  () => "Saved. You can now legally call yourself a collector.",
  () => "Need more dopamine? Do it again.",
  () => "🔥 You're on fire! Not literally. Hopefully.",
  () => "Just another day being amazing. No big deal.",
  () => "You deserve a raise. Also coffee. Buy yourself one.",
  () => "🚨 Cool download alert. Oh wait, that's you.",
  () => "This is what peak performance looks like.",
  () => "Yes chef 👨‍🍳 download served.",
  () => "Pressing buttons has never looked this good.",
  () => "Congrats. You're now the proud parent of pixels.",
  () => "You're giving main character downloader energy.",
  () => "Would you like a parade too? You earned it.",
  () => "🧋 Downloads done. Vibes sweet. Boba optional.",
  () => "BRB writing a song about your download success.",
  () => "Some people dream it. You click it. Iconic.",
  () => "Big click. Bigger results. No notes.",
  () => "You and downloads? Soulmates.",
  () => "💅 Effortlessly efficient. That's you.",
  () => "Yup, another file down. Don't stop now.",
  () => "Data gods bless your clicks. Download divine.",
  () => "Your disk is now 0.01% happier.",
  () => "Don't forget to hydrate after that sick download.",
  () => "Go off, digital hoarder. Go off.",
  () => "I'd applaud but I'm code. So just… *applause sounds*.",
  () => "You've unlocked the secret ending. Just kidding. Or am I?",
  () => "That download? Clean. Smooth. Fresh. Iconic.",
  () => "🌊 Wave of downloads. You're surfing it.",
  () => "🛠️ Tools used: Finger. Button. Swag.",
  () => "🍀 You got the lucky download pixel. Cherish it.",
  () => "You're like a download wizard. Staff and all.",
  () => "🏃💨 You downloaded that like you were late for school.",
  () => "Flashback: You clicking download. Present: Victory.",
  () => "Ok but seriously. You did that. 🫡",
  () => "Not all heroes wear capes. Some click download.",
  () => "The algorithm smiles upon you.",
  () => "More downloads than my confidence on a good day.",
  () => "✨ Sprinkle some more files in. You've got this.",
  () => "Download complete. You've officially entered the matrix.",
];
