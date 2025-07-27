import { handleFoundItems } from "../downloader/handlers.js";
import AppState from "../state/state.js";
import { displayFoundUrls } from "../downloader/downloader.js";
import {
  clearDownloadBtnContainers,
  attachDownloadButtons,
} from "../downloader/ui.js";
import { getCurrentPageUsername, getAuthorInfoFrom } from "../utils/utils.js";

/**
 * Detects any new video data (logged-in, logged-out or React-Fiber),
 * feeds it into your handler. Runs every 3s.
 */
export function pollInitialData() {
  console.log("ettvdebugger: Polling initial data…");

  // logged-in preloadList
  try {
    const list = window?.SIGI_STATE?.ItemList["user-post"]?.preloadList || [];
    const mod = window?.SIGI_STATE?.ItemModule || {};
    handleFoundItems(list.map((i) => mod[i.id]).filter(Boolean));
  } catch {}

  // logged-out JSON in __NEXT_DATA__
  try {
    const raw = document.getElementById("__NEXT_DATA__")?.innerText;
    const items = JSON.parse(raw || "{}").props?.pageProps?.items || [];
    handleFoundItems(items.filter((i) => i.id));
  } catch {}

  // React-Fiber fallback
  try {
    const video = window?.MultiMediaPreloader?.preloader?.video;
    const offsetParent = video?.offsetParent;
    if (offsetParent) {
      const fiberKey = Object.keys(offsetParent).find((k) =>
        k.startsWith("__reactFiber$")
      );
      const fiberNode = offsetParent[fiberKey];
      const fiberItem = fiberNode?.child?.pendingProps;
      if (fiberItem?.id && fiberItem?.url) {
        // TODO: Buggy.
        handleFoundItems([
          {
            id: fiberItem.id,
            video: { playAddr: fiberItem.url },
            author: {
              uniqueId: getAuthorInfoFrom(offsetParent)?.username || "",
            },
            desc: getAuthorInfoFrom(offsetParent)?.description || "",
            hasLowConfidence: true,
          },
        ]);
      }
    }
  } catch (err) {
    console.warn("reactFiber error:", err);
  }

  // Schedule next poll in 3 seconds
  setTimeout(pollInitialData, 3000);
}

/**
 * Runs UI refresh logic (clear, redraw, reattach) every second.
 */
function pollUI() {
  clearDownloadBtnContainers();
  displayFoundUrls();
  attachDownloadButtons();
}

/**
 * Watches for page‐username changes and re-boots your UI/context.
 */
export function startPollingPageChanges() {
  console.log("ettvdebugger: Starting page change polling…");
  let currentUser = getCurrentPageUsername();

  setInterval(() => {
    const u = getCurrentPageUsername();
    if (u !== currentUser) {
      currentUser = u;
      AppState.allDirectLinks = [];
      document.getElementById("ttk-downloader-wrapper")?.remove();

      // re-apply any tab filters
      const tab = document.querySelector('[aria-selected="true"]');
      AppState.filters.likedVideos = !!(
        tab && tab.textContent?.includes("Liked")
      );
      displayFoundUrls({ forced: true });
    }
  }, 1000);
}

/**
 * Starts both data polling and UI refreshing
 */
export function startPolling() {
  pollInitialData(); // First run immediately
  setInterval(pollUI, 1000); // Refresh UI every 1s
}
