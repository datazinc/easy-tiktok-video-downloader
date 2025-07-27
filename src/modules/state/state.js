// state.js
import { STORAGE_KEYS } from "./constants.js";

const AppState = {
  isLoggedIn: false,
  postItems: {},
  allDirectLinks: [],
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
  likedVideos: {},
  downloading: {
    isActive: false,
    isDownloadingAll: false,
  },
  ui: {
    isDownloaderClosed:
      localStorage.getItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED) === "true",
    isRatePopupOpen: false,
    hasRated: false,
    // localStorage.getItem(STORAGE_KEYS.HAS_RATED) === "true" &&
    // Math.random() < 0.95,
  },
  downloadPreferences: {
    skipFailedDownloads: false,
    skipAds: true,
    folderName: localStorage.getItem(STORAGE_KEYS.DOWNLOAD_FOLDER) || "", // new field
    showFolderPicker:
      localStorage.getItem(STORAGE_KEYS.SHOW_FOLDER_PICKER) === "true", // new field
  },
};
try {
  window.AppState = AppState; // Expose AppState globally for debugging
  console.log("ettvdebugger: AppState initialized", AppState);
} catch (error) { }

export default AppState;
