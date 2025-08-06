import { handleFoundItems } from "../downloader/handlers.js";
import AppState from "../state/state.js";
import {
  clearDownloadBtnContainers,
  attachDownloadButtons,
  createAutoSwipeUI,
  scanAndInject,
} from "../downloader/ui.js";
import {
  getCurrentPageUsername,
  getPostInfoFrom,
  clickNextButton,
  canClickNextButton,
  canScrollTheList,
  scrollToLastUserPost,
  convertTikTokRawToMediaObject,
  getCurrentPlayingArticle,
  displayFoundUrls,
  detectScrollEnd,
  getTabSpans,
} from "../utils/utils.js";
import { DOM_IDS, STORAGE_KEYS } from "../state/constants.js";
(function patchHistory() {
  const _push = history.pushState;
  const _replace = history.replaceState;

  history.pushState = function () {
    _push.apply(this, arguments);
    window.dispatchEvent(new Event("locationchange"));
  };
  history.replaceState = function () {
    _replace.apply(this, arguments);
    window.dispatchEvent(new Event("locationchange"));
  };

  window.addEventListener("popstate", () =>
    window.dispatchEvent(new Event("locationchange"))
  );
})();
window.addEventListener("locationchange", () => {
  scanAndInject();
});

/**
 * Detects any new video data (logged-in, logged-out or React-Fiber),
 * feeds it into your handler. Runs every 3s.
 */
export function pollInitialData() {
  // if (AppState.debug.active)
  console.log("POLLINIT ettvdebugger: Polling initial data…");

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
      console.log("POLLINIT: ", fiberItem);
      if (fiberItem?.id && fiberItem?.url) {
        // TODO: Buggy.

        const postInfo = getPostInfoFrom(
          getCurrentPlayingArticle() || offsetParent,
          {
            origin: "pollInitialData",
          }
        );
        console.log("POLLINIT:  POSTINFO", postInfo);
        const mediaObject = convertTikTokRawToMediaObject(fiberItem);
        console.log("POLLINIT:  mediaObject", mediaObject);

        if (!mediaObject) return;
        mediaObject.author.uniqueId =
          mediaObject.author.uniqueId || postInfo.username;
        mediaObject.desc = mediaObject.desc || postInfo.description;
        mediaObject.isAd = mediaObject.isAd ?? postInfo.isAd;
        console.log("POLLINIT:  mediaObject updated", mediaObject);

        handleFoundItems([mediaObject]);
      }
    }
  } catch (err) {
    if (AppState.debug.active) console.warn("reactFiber error:", err);
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
  scanAndInject();
  autoNextOnVideoEnded();
}

function autoNextOnVideoEnded() {
  try {
    const currentVideo = document.querySelector("video");
    if (!currentVideo) return;
    currentVideo.onended = () => {
      if (
        AppState.downloadPreferences.autoScrollMode == "onVideoEnd" &&
        canClickNextButton()
      ) {
        clickNextButton();
      }
    };
  } catch (err) {
    console.log("Auto Next Errored", err);
  }
}

/**
 * Watches for page‐username changes and re-boots your UI/context.
 */
export function startPollingPageChanges() {
  if (AppState.debug.active)
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
 * Starts the auto swipe loop with countdown.
 */
export function startAutoSwipeLoop(minInterval = 4000, maxInterval = 8000) {
  createAutoSwipeUI();
  const timerText = document.getElementById("swipeTimerText");

  function loop() {
    if (AppState.debug.active)
      console.log(
        "SWIPE UP in the loop",
        AppState.downloadPreferences.autoScrollMode
      );
    if (AppState.scrapperDetails.isScrapping) {
      AppState.scrapperDetails.isScrapping = false;
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails)
      );
      const listToScrape = getTabSpans()[AppState.scrapperDetails.selectedTab];
      // Reset posts and links
      AppState.postItems = {}
      AppState.allDirectLinks = []
      listToScrape?.click();
      if (!listToScrape){
        alert(
          "Something bad happened tab not found " +
            AppState.scrapperDetails.selectedTab
        );
        }
      AppState.downloadPreferences.autoScrollMode = "always";
    }

    const interval =
      Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;
    AppState.ui.autoSwipeConfigurations.remainingTime = Math.floor(
      interval / 1000
    );

    const ui = document.getElementById("autoSwipeUI");
    if (ui)
      ui.style.display =
        AppState.downloadPreferences.autoScrollMode == "always"
          ? "flex"
          : "none";
    if (AppState.debug.active) console.log("SWIPE UP showing the box");

    // Update countdown every second
    AppState.ui.autoSwipeConfigurations.countdownInterval = setInterval(() => {
      if (AppState.downloadPreferences.autoScrollMode != "always") return;
      timerText.textContent = `Next Auto Scroll in ${Math.max(
        0,
        AppState.ui.autoSwipeConfigurations.remainingTime--
      )}s`;
      if (AppState.ui.autoSwipeConfigurations.remainingTime < 0)
        clearInterval(AppState.ui.autoSwipeConfigurations.countdownInterval);
    }, 1000);

    // Schedule next swipe
    AppState.ui.autoSwipeConfigurations.nextClickTimeout = setTimeout(() => {
      if (AppState.debug.active)
        console.log("SWIPE UP ", canClickNextButton(), canScrollTheList());
      clearInterval(AppState.ui.autoSwipeConfigurations.countdownInterval);
      if (
        canClickNextButton() &&
        AppState.downloadPreferences.autoScrollMode == "always"
      ) {
        clickNextButton();
      } else if (
        canScrollTheList() &&
        AppState.downloadPreferences.autoScrollMode == "always"
      ) {
        scrollToLastUserPost();
        detectScrollEnd(() => {
          alert("End of the scroll, download")
          console.warn("🔥 We reached the bottom — stop auto-scrolling.");
          AppState.downloadPreferences.autoScrollMode = "off";
          const downloadAllBtn = document.getElementById(
            DOM_IDS.DOWNLOAD_ALL_BUTTON
          );
          if (!downloadAllBtn) {
            alert("Please click Download All now!");
          } else {
            downloadAllBtn.click();
          }

          AppState.scrapperDetails.isScrapping = false;
          // You can also trigger any post-scroll UI updates here
        });
      } else if (canScrollTheList() && AppState.downloadPreferences.autoScrollMode == "always") {
        alert("Never Scrolled or something, download");
        AppState.downloadPreferences.autoScrollMode = "off";
        const downloadAllBtn = document.getElementById(
          DOM_IDS.DOWNLOAD_ALL_BUTTON
        );
        if (!downloadAllBtn) {
          alert("Please click Download All now!");
        } else {
          downloadAllBtn.click();
        }
        AppState.scrapperDetails.isScrapping = false;
      }
        loop(); // Repeat
    }, interval);
  }

  loop();
}

/**
 * Starts polling logic and optional auto-swipe.
 */
export function startPolling() {
  pollInitialData(); // First run
  setInterval(pollUI, 1 * 1000); // Refresh UI
  setTimeout(() => {
    startAutoSwipeLoop();
  }, 5000);
}
