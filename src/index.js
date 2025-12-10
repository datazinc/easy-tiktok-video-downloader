// index.js
import "./modules/networking/networkInterceptor.js";
import {
  startPolling,
} from "./modules/polling/polling.js";
import AppState from "./modules/state/state.js";
import { displayFoundUrls } from "./modules/utils/utils.js";
import { isExtensionEnabledSync } from "./modules/utils/extensionState.js";
import { hideDownloader } from "./modules/downloader/ui.js";
import { DOM_IDS } from "./modules/state/constants.js";

setTimeout(async () => {
  // Check if extension is disabled before initializing
  if (!isExtensionEnabledSync()) {
    console.log("[Extension] Extension is disabled. Skipping initialization.");
    // Even when disabled, show the "Open" button so users can re-enable
    // Remove any existing downloader wrapper first
    const existingWrapper = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
    if (existingWrapper) {
      existingWrapper.remove();
    }
    // Set state to closed and show the button
    AppState.ui.isDownloaderClosed = true;
    hideDownloader();
    return;
  }

  // Awful initial poll mechanism. Injecting on time seems to not be efficient.
  [1, 3, 5, 10, 15, 20, 30, 60, 180].forEach((sec) =>
    setTimeout(() => {
      // Check state again before each refresh
      if (!isExtensionEnabledSync()) return;
      if (
        Object.keys(AppState.allItemsEverSeen).length >
        AppState.allDirectLinks.length
      ) {
        console.log("SOFT_REFRESHER_ON", sec);
        // Soft refresh.
        displayFoundUrls();
      }
    }, sec * 1000)
  );
  startPolling();
  displayFoundUrls({ forced: true });
  if (AppState.debug.active) console.log("INDEX LOADED!!!!");
}, 1000);
