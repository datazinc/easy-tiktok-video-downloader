// state.js
import {
  FILE_STORAGE_LOCATION_TEMPLATE_PRESETS,
  STORAGE_KEYS,
} from "./constants.js";

function safeParseJSON(jsonValue, fallback = {}) {
  if (jsonValue == null) return fallback;
  try {
    const parsed = JSON.parse(jsonValue);
    return parsed == null ? fallback : parsed;
  } catch (e) {
    console.warn("Failed to parse JSON from localStorage:", jsonValue, e);
    return fallback;
  }
}

function normalizeTs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null; // never happened
  return n < 1e12 ? n * 1000 : n; // seconds → ms
}

function safeParseRateDonateDates(jsonValue, fallback = {}) {
  const parsed = safeParseJSON(jsonValue, fallback);
  return {
    lastDonatedAt: normalizeTs(parsed.lastDonatedAt),
    lastRatedAt: normalizeTs(parsed.lastRatedAt),
    lastShownAt: normalizeTs(parsed.lastShownAt),
    shownCount: Number.isFinite(parsed.shownCount) ? parsed.shownCount : 0,
  };
}

function safeParseScrapperDetails(jsonValue, fallback = {}) {
  const parsed = safeParseJSON(jsonValue, fallback);

  const fixDate = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  return {
    locked: false,
    // "initiated" "ongoing" "downloading" "complete". Only accept initiated as the only valid default.
    // Otherwise partial states are reloaded (incomplete states, like: ongoing)
    scrappingStage:
      parsed.scrappingStage != "initiated"
        ? "completed"
        : parsed.scrappingStage,

    paused: false,
    startedAt: fixDate(parsed.startedAt),
    lastSuccessfullScrollAt: fixDate(parsed.lastSuccessfullScrollAt),
    selectedTab:
      parsed.scrappingStage == "initiated" ? parsed.selectedTab : null,
    selectedCollectionName:
      parsed.scrappingStage == "initiated"
        ? parsed.selectedCollectionName
        : null,
    scrappedPostsCount:
      typeof parsed.scrappedPostsCount === "number"
        ? parsed.scrappedPostsCount
        : 0,
  };
}

function getBooleanFromStorage(key, fallback = false) {
  try {
    return localStorage.getItem(key) === "true";
  } catch (e) {
    console.warn(`Failed to read boolean from localStorage for key ${key}:`, e);
    return fallback;
  }
}

function getStringOrNull(key) {
  try {
    const result = localStorage.getItem(key);
    return result == "null" ? null : result;
  } catch (e) {
    console.warn(`Failed to read string from localStorage for key ${key}:`, e);
    return null;
  }
}

const AppState = {
  debug: {
    active: true,
  },
  isLoggedIn: false,
  allDirectLinks: [],
  allItemsEverSeen: {},
  displayedState: {
    itemsHash: "",
    path: "",
  },
  filters: {
    currentProfile: false,
    likedVideos: false,
    favoriteVideos: false,
    state: "INIT",
  },
  downloadedURLs: [],
  sessionHasConfirmedDownloads: false,
  currentTierProgress: safeParseJSON(
    localStorage.getItem(STORAGE_KEYS.CURRENT_TIER_PROGRESS),
    { downloads: 0, recommendations: 0 }
  ),
  leaderboard: {
    newlyConfirmedMedia: [],
    currentlyUpdating: false,
    lastUpdateHash: "",
    allTimeDownloadsCount: Number(
      getStringOrNull(STORAGE_KEYS.DOWNLOADS_ALL_TIME_COUNT) || 0
    ),
    weekDownloadsData: safeParseJSON(
      localStorage.getItem(STORAGE_KEYS.DOWNLOADS_WEEKLY_DATA),
      {
        count: 0,
        weekId: "missing",
      }
    ),
  },
  recommendationsLeaderboard: {
    newlyRecommendedUrls: [],
    currentlyUpdating: false,
    lastUpdateHash: "",
    allTimeRecommendationsCount: Number(
      localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS_ALL_TIME_COUNT) || 0
    ),
    weekRecommendationsData: safeParseJSON(
      localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS_WEEKLY_DATA),
      { count: 0, weekId: "missing" }
    ),
  },
  likedVideos: {},
  downloading: {
    isActive: false,
    isDownloadingAll: false,
  },
  ui: {
    downloaderPositionType:
      getStringOrNull(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE) == "custom" &&
      getStringOrNull(STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION)
        ? "custom"
        : "bottom-right",
    live_ETTPD_CUSTOM_POS: getStringOrNull(
      STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION
    ),
    isPreferenceBoxOpen: false,
    isScrapperBoxOpen: false,
    isDownloaderClosed: getBooleanFromStorage(
      STORAGE_KEYS.IS_DOWNLOADER_CLOSED
    ),
    isRatePopupOpen: false,
    isDragging: false,
    autoSwipeConfigurations: {
      nextClickTimeout: null,
      countdownInterval: null,
      remainingTime: 0,
    },
  },
  downloadPreferences: {
    skipFailedDownloads: false,
    skipAds: true,
    autoScrollMode: "off",
    autoScrollModePrev: "",
    includeCSV: false,
    fullPathTemplate: safeParseJSON(
      localStorage.getItem(STORAGE_KEYS.SELECTED_FULL_PATH_TEMPLATE),
      FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find((it) => it.isDefault)
    ),
    showFolderPicker: getBooleanFromStorage(STORAGE_KEYS.SHOW_FOLDER_PICKER),
    disableConfetti: getBooleanFromStorage(STORAGE_KEYS.DISABLE_CELEBRATION_CONFETTI),
  },
  rateDonate: safeParseRateDonateDates(
    localStorage.getItem(STORAGE_KEYS.RATE_DONATE_DATA),
    {
      lastDonatedAt: null,
      lastRatedAt: null,
      lastShownAt: null,
      shownCount: 0,
    }
  ),
  scrapperDetails: safeParseScrapperDetails(
    localStorage.getItem(STORAGE_KEYS.SCRAPPER_DETAILS),
    {
      locked: false,
      paused: null,
      lastSuccessfullScrollAt: null,
      startedAt: null,
      selectedTab: null,
      selectedCollectionName: null,
      scrappingStage: null,
      scrappedPostsCount: null,
    }
  ),
};

try {
  window.AppStateETTVD = AppState; // Expose AppState globally for debugging
  if (AppState.debug.active)
    console.log("ettvdebugger: AppState initialized", AppState);
} catch (error) {}

export function resetAppStateToDefaults() {
  // Reset localStorage-dependent values
  localStorage.removeItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE);
  localStorage.removeItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED);
  localStorage.removeItem(STORAGE_KEYS.SELECTED_FULL_PATH_TEMPLATE);
  localStorage.removeItem(STORAGE_KEYS.FULL_PATH_TEMPLATES);
  localStorage.removeItem(STORAGE_KEYS.SHOW_FOLDER_PICKER);

  // Reset AppState
  AppState.debug.active = false;
  AppState.isLoggedIn = false;
  AppState.allItemsEverSeen = {};
  AppState.allDirectLinks = [];
  AppState.displayedState = {
    itemsHash: "",
    path: "",
  };
  AppState.filters = {
    currentProfile: false,
    likedVideos: false,
    favoriteVideos: false,
    state: "INIT",
  };
  AppState.downloadedURLs = [];
  // AppState.comfirmedDownloadedUrlsCount = 0;
  AppState.likedVideos = {};
  AppState.downloading = {
    isActive: false,
    isDownloadingAll: false,
  };
  AppState.ui = {
    downloaderPositionType: null,
    live_ETTPD_CUSTOM_POS: null,
    isPreferenceBoxOpen: false,
    isDownloaderClosed: false,
    isRatePopupOpen: false,
    isDragging: false,
    autoSwipeConfigurations: {
      nextClickTimeout: null,
      countdownInterval: null,
      remainingTime: 0,
    },
  };
  AppState.downloadPreferences = {
    skipFailedDownloads: false,
    skipAds: true,
    autoScrollMode: "off",
    includeCSV: false,
    fullPathTemplate: {},
    showFolderPicker: false,
  };
  // Set default
  localStorage.setItem(
    STORAGE_KEYS.SELECTED_FULL_PATH_TEMPLATE,
    JSON.stringify(
      FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find((it) => it.isDefault)
    )
  );
  // Default template
  AppState.downloadPreferences.fullPathTemplate =
    FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find((it) => it.isDefault);

  console.log("AppState has been reset to defaults.");
}

export default AppState;
