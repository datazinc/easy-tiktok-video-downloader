// constants.js
export const STORAGE_KEYS = {
  // === 📦 User Preferences & UI State
  IS_DOWNLOADER_CLOSED: "tik.tok::isDownloaderClosed",
  SHOW_FOLDER_PICKER: "tik.tok::showFolderPicker",
  DISABLE_CELEBRATION_CONFETTI: "tik.tok::disableCelebrationConfetti",
  SHOW_DOWNLOAD_MESSAGES: "tik.tok::showDownloadMessages",
  DOWNLOAD_MESSAGES_NOTICE_SEEN: "tik.tok::downloadMessagesNoticeSeen",
  LAST_AUTOMATIC_POPUP_AT: "tik.tok::lastAutomaticPopupAt",
  DOWNLOAD_FOLDER: "tik.tok::downloadFolder",
  FULL_PATH_TEMPLATES: "tik.tok::fullPathTemplates",
  SELECTED_FULL_PATH_TEMPLATE: "tik.tok::selectedFullPathTemplate",
  CURRENT_TIER_PROGRESS: "tik.tok::tierProgress",
  RATE_DONATE_DATA: "tik.tok::rateDonateData",
  LAST_SUPPORTED_AT: "tik.tok::lastSupportedAt",
  DOWNLOADER_CUSTOM_POSITION: "tik.tok::customDownloaderPosition",
  DOWNLOADER_POSITION_TYPE: "tik.tok::downloaderPositionType",
  THEME_MODE: "tik.tok::themeMode",
  SHOW_BUTTON_POSITION: "tik.tok::showButtonPosition",
  SHOW_BUTTON_HINT_SEEN: "tik.tok::showButtonHintSeen",
  EXTENSION_ENABLED: "tik.tok::extensionEnabled",
  BROWSER_COMPAT_ALERT_DISMISSED: "tik.tok::browserCompatAlertDismissed",
  USE_NATIVE_DOWNLOAD: "tik.tok::useNativeDownload",
  EXPERIMENTAL_HD: "tik.tok::experimentalHd",
  EXPERIMENTAL_HD_BANNER_DISMISSED:
    "tik.tok::experimentalHdBannerDismissed",
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
    messageKey: "presetRecommended",
    template:
      "@/@{authorUsername|:profile:}/{tabName}/{ad}-{authorUsername|no-author}-{createTime|-}-{sequenceNumber}-{desc:100|-}-{videoId:-4|no-id}-{quality|SD}.mp4",
    example:
      DOWNLOAD_FOLDER_DEFAULT +
      "/@coolguy/Liked/@coolguy-2025-08-14_0110-1-BEST-BELIEVE-me-this-dude-cooked-6775-HD.mp4",
    isRecommended: true,
  },
  {
    label: "📁 Video Flat by Author",
    messageKey: "presetAuthor",
    template: "videos/{authorUsername|unknown}/{videoId|no-id}.mp4",
    example: "videos/coolguy/739462775.mp4",
  },
  {
    label: "🖼️ Image Series (force numbered)",
    messageKey: "presetImages",
    template:
      "images/{authorUsername|unknown}/{videoId|no-id}-{sequenceNumber|required}.jpeg",
    example: "images/coolguy/739462775-1.jpeg",
  },
  {
    label: "🧠 Descriptive (limit desc)",
    messageKey: "presetDescription",
    template:
      "desc_clips/{authorUsername|unknown}/{desc:255|no-desc}-{videoId|no-id}.mp4",
    example: "desc_clips/coolguy/My-best-clip-ever-739462775.mp4",
  },
  {
    label: "📢 Hashtags Folder (Weird ahh)",
    messageKey: "presetHashtags",
    template: "hashtags/{hashtags|no-tags}/{videoId|no-id}.mp4",
    example: "hashtags/#fun#relax/739462775.mp4",
  },
  {
    label: "🎶 Music by Artist",
    messageKey: "presetMusic",
    template:
      "music/{musicAuthor|unknown}/{authorUsername|no-author}-{videoId|no-id}.mp4",
    example: "music/DJFlow/coolguy-739462775.mp4",
  },
  {
    label: "🎛️ Creative Combo",
    messageKey: "presetMix",
    template:
      "mix/{musicTitle|untitled}/{authorUsername|unknown}-{desc:20|no-desc}-{sequenceNumber}-{videoId|no-id}.mp4",
    example: "mix/Chill-Vibes/coolguy-Fun-tiktok-clip-1-739462775.mp4",
  },
  {
    isDefault: true,
    label: "📦 Legacy Flat Format",
    messageKey: "presetLegacy",
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
  "Saved {count} {media}. A tiny victory for the offline department.",
  "Saved {count} {media}. Filed under: I'll need this later, probably.",
  "Saved {count} {media}. Your future group chat has material.",
  "Saved {count} {media}. One less reason to keep that tab open.",
  "Saved {count} {media}. The loading spinner can clock out.",
  "Saved {count} {media}. Your collection called dibs.",
  "Saved {count} {media}. No packing tape required.",
  "Saved {count} {media}. The pixels have checked in.",
  "Saved {count} {media}. A small step for you, a new file for your folder.",
  "Saved {count} {media}. Added to the very serious research archive.",
  "Saved {count} {media}. The replay button approves this decision.",
  "Saved {count} {media}. Consider this your offline plot twist.",
  "Saved {count} {media}. The internet-to-folder commute is complete.",
  "Saved {count} {media}. Your watch-later list has a physical address now.",
  "Saved {count} {media}. No assembly instructions included.",
  "Saved {count} {media}. Another entry in the folder of good intentions.",
  "Saved {count} {media}. Filed by our entire staff of one button.",
  "Saved {count} {media}. A productive use of exactly one click.",
  "Saved {count} {media}. Your offline queue just got a promotion.",
  "Saved {count} {media}. A little less scrolling, a little more keeping.",
  "Saved {count} {media}. The progress bar would like its lunch break.",
  "Saved {count} {media}. Ready for that suspiciously specific reference.",
  "Saved {count} {media}. The collection committee voted yes.",
  "Saved {count} {media}. The folder has updated its guest list.",
  "Saved {count} {media}. Your replay plans are now in writing.",
  "Saved {count} {media}. Please direct applause toward your clicking hand.",
  "Saved {count} {media}. The buffering department has left the meeting.",
  "Saved {count} {media}. This counts as organizing if nobody asks questions.",
  "Saved {count} {media}. The tab can finally stop auditioning for permanence.",
  "Saved {count} {media}. A fresh addition to your just-in-case collection.",
  "Saved {count} {media}. Your folder is calling this a strategic acquisition.",
  "Saved {count} {media}. The download button has met its quarterly target.",
  "Saved. Your Downloads folder has accepted another side quest.",
  "Saved. Future you can stop asking present you for the link.",
  "Download complete. This meeting could have been a click. It was.",
  "Saved. A permanent answer to 'wait, where was that video?'",
  "Download complete. You may now close the tab with confidence.",
  "Saved. The progress bar has retired undefeated.",
  "Saved. Your folder would like a bigger desk.",
  "Download complete. No cliffhanger this time.",
  "Saved. Your collection has excellent taste in tiny rectangles.",
  "Saved. Another successful case of pressing the right button.",
  "Download complete. The pixels made it through orientation.",
  "Saved. Offline you just received a care package.",
  "Saved. Your just-one-more collection remains undefeated.",
  "Download complete. That was the whole tutorial.",
  "Saved. The replay potential is now locally sourced.",
  "Saved. A receipt for your excellent scrolling decisions.",
  "Download complete. The loading bar has no further comments.",
  "Saved. Your storage has another story to tell.",
  "Saved. Put it on the agenda for later.",
  "Download complete. A rare task with a clearly defined ending.",
  "Saved. One tab closer to an emotionally manageable browser.",
  "Saved. Your rainy-day entertainment fund received a deposit.",
  "Download complete. No subscription to this sentence required.",
  "Saved. Somewhere in your folder, a sequel is being planned.",
  "Saved. The 'send me that' contingency plan is ready.",
  "Download complete. Your thumb did the scouting; your folder did the hiring.",
  "Saved. Your future presentation has found its unexpected visual aid.",
  "Saved. We are officially calling this a collection, not a phase.",
  "Download complete. The button will include this in its performance review.",
  "Saved. A modest achievement for the department of keeping things.",
  "Saved. You have successfully converted scrolling into filing.",
  "Download complete. Your device has joined the conversation.",
  "Saved. This file has successfully relocated out of your browser.",
  "Saved. The archive is expanding faster than its naming convention.",
  "Download complete. Refreshing the page is no longer a dramatic decision.",
  "Saved. Your folder has agreed to remember this so you do not have to.",
  "Saved. A backup plan for your memory's search feature.",
  "Download complete. All that suspense for a very satisfying checkmark.",
  "Saved. The link can stop living rent-free in your clipboard.",
  "Saved. Your archive has acquired another conversation starter.",
  "Download complete. Please remain seated until the progress bar disappears.",
  "Saved. Another entry in the 'this will make sense later' department.",
  "Saved. Your folder has waived the application fee.",
  "Download complete. The waiting room is now empty.",
  "Saved. A successful transfer from endless feed to finite folder.",
  "Saved. The file has been introduced to its new neighbors.",
  "Download complete. Your mouse would like this listed as work experience.",
  "Saved. The committee for future rewatching thanks you.",
  "Saved. You brought a file to a link-only conversation.",
];

export const SCRAPER_DONE_MESSAGES = [
  "Batch finished. The progress bar has submitted its timesheet.",
  "Batch finished. That was a lot of scrolling you did not have to do.",
  "Batch finished. The archive department is taking five.",
  "Batch finished. Your clicking finger was on paid leave for this one.",
  "Batch finished. The queue has officially left the building.",
  "Batch finished. A whole checklist, handled without a clipboard.",
  "Batch finished. The loading spinner has booked some time off.",
  "Batch finished. Your collection just had a busy afternoon.",
  "Batch finished. The to-do list is looking unusually relaxed.",
  "Batch finished. Bulk ordering, minus the cardboard boxes.",
  "Batch finished. The last item in line can finally sit down.",
  "Batch finished. Your folder may now update its inventory.",
  "Batch finished. This is what delegating to a button looks like.",
  "Batch finished. The queue is empty; your schedule has options.",
  "Batch finished. Consider the repetitive clicking meeting canceled.",
  "Batch finished. The progress bar would like a reference letter.",
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
