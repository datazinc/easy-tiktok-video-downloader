// constants.js
export const STORAGE_KEYS = {
  // === 📦 User Preferences & UI State
  IS_DOWNLOADER_CLOSED: "tik.tok::isDownloaderClosed",
  SHOW_FOLDER_PICKER: "tik.tok::showFolderPicker",
  DISABLE_CELEBRATION_CONFETTI: "tik.tok::disableCelebrationConfetti",
  DOWNLOAD_FOLDER: "tik.tok::downloadFolder",
  FULL_PATH_TEMPLATES: "tik.tok::fullPathTemplates",
  SELECTED_FULL_PATH_TEMPLATE: "tik.tok::selectedFullPathTemplate",
  CURRENT_TIER_PROGRESS: "tik.tok::tierProgress",
  RATE_DONATE_DATA: "tik.tok::rateDonateData",
  DOWNLOADER_CUSTOM_POSITION: "tik.tok::customDownloaderPosition",
  DOWNLOADER_POSITION_TYPE: "tik.tok::downloaderPositionType",
  THEME_MODE: "tik.tok::themeMode",
  SHOW_BUTTON_POSITION: "tik.tok::showButtonPosition",
  SHOW_BUTTON_HINT_SEEN: "tik.tok::showButtonHintSeen",
  EXTENSION_ENABLED: "tik.tok::extensionEnabled",
  BROWSER_COMPAT_ALERT_DISMISSED: "tik.tok::browserCompatAlertDismissed",
  USE_NATIVE_DOWNLOAD: "tik.tok::useNativeDownload",
  FILE_PATH_HINT_SEEN: "tik.tok::filePathHintSeen",

  // Scrapper
  SCRAPPER_DETAILS: "tik.tok::scrapperDetails",
  PENDING_RESUME_DOWNLOAD: "tik.tok::pendingResumeDownload",

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
  ALERT_ACTION_BUTTON: "alert-action-btn",
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
    label: "🟢 Recommended (@folder, all core info)",
    template:
      "@/@{authorUsername|:profile:}/{tabName}/{ad}-{authorUsername|no-author}-{createTime|-}-{sequenceNumber}-{desc:100|-}-{videoId:-4|no-id}.mp4",
    example:
      DOWNLOAD_FOLDER_DEFAULT +
      "/@coolguy/Liked/@coolguy-2025-08-14_0110-1-BEST-BELIEVE-me-this-dude-cooked-6775.mp4",
    isRecommended: true,
  },
  {
    label: "📁 Video Flat by Author",
    template: "videos/{authorUsername|unknown}/{videoId|no-id}.mp4",
    example: "videos/coolguy/739462775.mp4",
  },
  {
    label: "🖼️ Image Series (force numbered)",
    template:
      "images/{authorUsername|unknown}/{videoId|no-id}-{sequenceNumber|required}.jpeg",
    example: "images/coolguy/739462775-1.jpeg",
  },
  {
    label: "🧠 Descriptive (limit desc)",
    template:
      "desc_clips/{authorUsername|unknown}/{desc:255|no-desc}-{videoId|no-id}.mp4",
    example: "desc_clips/coolguy/My-best-clip-ever-739462775.mp4",
  },
  {
    label: "📢 Hashtags Folder (Weird ahh)",
    template: "hashtags/{hashtags|no-tags}/{videoId|no-id}.mp4",
    example: "hashtags/#fun#relax/739462775.mp4",
  },
  {
    label: "🎶 Music by Artist",
    template:
      "music/{musicAuthor|unknown}/{authorUsername|no-author}-{videoId|no-id}.mp4",
    example: "music/DJFlow/coolguy-739462775.mp4",
  },
  {
    label: "🎛️ Creative Combo",
    template:
      "mix/{musicTitle|untitled}/{authorUsername|unknown}-{desc:20|no-desc}-{sequenceNumber}-{videoId|no-id}.mp4",
    example: "mix/Chill-Vibes/coolguy-Fun-tiktok-clip-1-739462775.mp4",
  },
  {
    isDefault: true,
    label: "📦 Legacy Flat Format",
    template:
      "{ad}-@{authorUsername|user}-{tabName}-{createTime|-}-{desc|-}-{videoId|no-id}-{sequenceNumber}.mp4",
    example:
      "ad-@coolguy-Videos-2025-08-14_0110-You-cant-make-up-this-sht-739462775-1.mp4",
  },
];

export const DATA_PRUNE_MAX_WEEKS_TO_KEEP = 12;
export const PRUNE_AFTER_MAX_WEEKS_OF_LOW_DOWNLOADS = 12;
export const PRUNE_LOW_DOWNLOADS_COUNT = 5;

export const DOWNLOAD_TIER_THRESHOLDS = [
  { min: 10, name: "Smooth Op", emoji: "😎" }, // 10
  { min: 25, name: "On Fire", emoji: "🔥" }, // 25
  { min: 50, name: "Clip Connoisseur", emoji: "🎬" }, // 50
  { min: 100, name: "Trend Thief", emoji: "⚡" }, // 100
  { min: 250, name: "Goblin Mode", emoji: "🧌" }, // 250
  { min: 500, name: "Demon Time", emoji: "👹" }, // 500
  { min: 1_000, name: "HD Greed", emoji: "🖥️" }, // 1K
  { min: 5_000, name: "Dead King", emoji: "💀👑" }, // 5K
  { min: 10_000, name: "Ultimate Hoarder", emoji: "📦" }, // 10K
  { min: 50_000, name: "Cache Cryptid", emoji: "🦝" }, // 50K
  { min: 100_000, name: "Downloadlord", emoji: "👑" }, // 100K
  { min: 1_000_000, name: "Data Deity", emoji: "💾" }, // 1M
  { min: 10_000_000, name: "Cloud Overlord", emoji: "☁️" }, // 10M
];

export const RECOMMENDATION_TIER_THRESHOLDS = [
  { min: 1_000, name: "Just Hatched", emoji: "🥚" }, // 1K
  { min: 2_000, name: "Lil Gremlin", emoji: "🧌" }, // 2K
  { min: 3_500, name: "Intern Vibes", emoji: "🪪" }, // 3.5K
  { min: 5_000, name: "Feeding", emoji: "🍽️" }, // 5K
  { min: 7_500, name: "Online-ish", emoji: "📶" }, // 7.5K
  { min: 10_000, name: "Fed Up", emoji: "🍔" }, // 10K
  { min: 15_000, name: "Tastebud", emoji: "👅" }, // 15K
  { min: 25_000, name: "Main Char", emoji: "🎬" }, // 25K
  { min: 50_000, name: "Algo Beast", emoji: "📡" }, // 50K
  { min: 100_000, name: "100K Deep", emoji: "🕳️" }, // 100K
  { min: 250_000, name: "Cooked", emoji: "🔥" }, // 250K
  { min: 500_000, name: "No Return", emoji: "🚪" }, // 500K
  { min: 1_000_000, name: "Overfed", emoji: "🤯" }, // 1M
  { min: 2_500_000, name: "Lost Cause", emoji: "🧬" }, // 2.5M
  { min: 5_000_000, name: "Soulbound", emoji: "🔗" }, // 5M
  { min: 10_000_000, name: "Too Online", emoji: "💀" }, // 10M
  { min: 50_000_000, name: "Pixelated", emoji: "📲" }, // 50M
  { min: 100_000_000, name: "Touch Grass", emoji: "🌱" }, // 100M
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

export const SCRAPER_DONE_MESSAGES = [
  "✅ Mission complete — all posts secured!",
  "🎯 Done & dusted — your haul is ready!",
  "📦 Delivery complete — enjoy the goods!",
  "🏁 Scraper crossed the finish line!",
  "🔥 Operation finished — clean sweep!",
  "💾 Saved & sealed — until next time!",
  "🚀 Downloads wrapped — smooth ride!",
  "🧊 Chill, everything's downloaded.",
  "🐉 Legendary sweep — all yours now.",
  "🌈 Scraper rainbowed the whole tab!",
];

export const HYPE_TEMPLATES = {
  recommendations: [
    // Gen-Z vibes
    `🚀 LEVEL UP: {{emoji}} <b>{{name}}</b>  
     {{min}}+ recommendations — the algo is obsessed with you 🔥`,
    `✨ {{emoji}} {{name}} unlocked  
     {{min}}+ recs — main character energy activated 🎬`,
    `🌪️ {{emoji}} {{name}} tier achieved  
     {{min}}+ recs — your feed is pure heat ⚡`,
    `💎 {{emoji}} Welcome to <b>{{name}}</b>  
     {{min}}+ recs — certified GOAT vibes 🐐`,

    // Professional / neutral
    `📈 Milestone reached: {{emoji}} {{name}}  
     {{min}}+ recommendations delivered to your feed`,
    `🏁 Unlocked: {{emoji}} {{name}}  
     You've crossed {{min}} recommendations`,
    `✅ Progress update — {{emoji}} {{name}}  
     {{min}}+ recommendations surfaced`,

    // Wholesome / friendly
    `🌼 {{emoji}} {{name}} unlocked  
     {{min}}+ recommendations — the feed knows what you love`,
    `🌟 Nice! {{emoji}} {{name}}  
     {{min}}+ recommendations found their way to you`,
    `🎉 {{emoji}} {{name}}  
     {{min}}+ recommendations — keep exploring`,

    // Gamer energy
    `🕹️ GG! {{emoji}} {{name}} tier  
     {{min}}+ recommendations — the RNG favored you 🎲`,
    `⚔️ Unlock achieved: {{emoji}} {{name}}  
     {{min}}+ recommendations — streak continues`,
    `🏆 Speedrun vibes — {{emoji}} {{name}}  
     {{min}}+ recommendations secured`,

    // Sports tone
    `🏟️ {{emoji}} {{name}} on the board  
     {{min}}+ recommendations — momentum's real`,
    `🥇 {{emoji}} {{name}} unlocked  
     {{min}}+ recommendations — keep the pace`,
    `📣 Big play: {{emoji}} {{name}}  
     {{min}}+ recommendations — crowd goes wild`,
  ],

  downloads: [
    // Gen-Z vibes
    `⬇️ DEMON MODE: {{emoji}} <b>{{name}}</b>  
     {{min}}+ downloads — you're farming bangers 🔥`,
    `💥 {{emoji}} {{name}} unlocked  
     {{min}}+ downloads — zero chill, max sauce 🧪`,
    `🧲 {{emoji}} {{name}}  
     {{min}}+ downloads — you pull heat on demand`,
    `🚨 {{emoji}} {{name}} tier  
     {{min}}+ downloads — certified curator`,

    // Professional / neutral
    `📦 Milestone: {{emoji}} {{name}}  
     {{min}}+ downloads added to your library`,
    `✅ Unlocked: {{emoji}} {{name}}  
     {{min}}+ downloads — great collection discipline`,
    `📁 {{emoji}} {{name}} reached  
     {{min}}+ downloads archived`,

    // Wholesome / friendly
    `🌈 {{emoji}} {{name}} unlocked  
     {{min}}+ downloads — your stash is looking cozy`,
    `🌟 {{emoji}} {{name}}  
     {{min}}+ downloads — saved with love`,
    `🎀 {{emoji}} {{name}} achieved  
     {{min}}+ downloads — neat and tidy`,

    // Gamer energy
    `🎮 Loot secured: {{emoji}} {{name}}  
     {{min}}+ downloads — perfect inventory management`,
    `🧱 Crafting tier: {{emoji}} {{name}}  
     {{min}}+ downloads — S-tier collector`,
    `🏹 Crit hit! {{emoji}} {{name}}  
     {{min}}+ downloads — stash leveled up`,

    // Sports tone
    `🏆 {{emoji}} {{name}} — clutch  
     {{min}}+ downloads — trophy cabinet expanding`,
    `📊 {{emoji}} {{name}}  
     {{min}}+ downloads — numbers don't lie`,
    `🥁 {{emoji}} {{name}} unlocked  
     {{min}}+ downloads — keep the streak alive`,
  ],
};
