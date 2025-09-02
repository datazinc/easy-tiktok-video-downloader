import {
  handleFoundItems,
  isVisitedItemBetterOrNew,
} from "../downloader/handlers.js";
import AppState from "../state/state.js";
import {
  clearDownloadBtnContainers,
  attachDownloadButtons,
  createAutoSwipeUI,
  scanAndInject,
} from "../downloader/ui.js";
import {
  getCurrentPageUsername,
  // getPostInfoFrom,
  clickNextButton,
  canClickNextButton,
  listScrollingCompleted,
  scrollToLastUserPost,
  // convertTikTokRawToMediaObject,
  getCurrentPlayingArticle,
  displayFoundUrls,
  detectScrollEnd,
  getTabSpans,
  getRenderedPostsMetadata,
  // buildMediaObjectFromRaw,
  showCelebration,
  toTitleCase,
  showAlertModal,
  findFiberItemById,
  getClosestPlayingVideoId,
  makeOverlay,
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
  try {
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

    // Visible-Fiber fallback item
    try {
      const fiberItem = findFiberItemById(
        getCurrentPlayingArticle(),
        getClosestPlayingVideoId()
      );
      if (fiberItem?.item) {
        fiberItem.item.downloaderHasLowConfidence = true;
        handleFoundItems([fiberItem.item]);
      }
    } catch (err) {
      if (AppState.debug.active) console.warn("reactFiber error:", err);
    }
    // React-Fiber profile list (Best for missed initial item_list requests due to slow ahh injection)
    try {
      const rawList = getRenderedPostsMetadata();
      if (!rawList || !rawList.length) return;

      // dedupe within this batch
      const parsed = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];

        // normalize the id early and use the SAME key everywhere
        const idRaw = item?.id ?? item?.aweme_id ?? item?.video?.id;
        const id = idRaw == null ? null : String(idRaw).trim();
        if (!id) continue;
        if (!isVisitedItemBetterOrNew(item)) continue; // seen before

        try {
          const media = item;
          const mid = media?.id == null ? null : String(media.id).trim();
          if (!mid || mid !== id) {
            continue;
          }
          AppState.allItemsEverSeen[mid] = item;
          parsed.push(media);
        } catch (e) {
          if (AppState.debug.active)
            console.warn("Failed to parse media at index", i, e);
        }
      }

      if (parsed.length) handleFoundItems(parsed);
    } catch (err) {
      if (AppState.debug.active) console.warn("reactFiber list error:", err);
    }
  } catch (err) {
    console.error(err);
  }
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
  pollInitialData();
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
 * Starts the auto swipe loop with countdown.
 */
export function startAutoSwipeLoop(minInterval = 4000, maxInterval = 8000) {
  createAutoSwipeUI();
  const timerText = document.getElementById("swipeTimerText");

  async function loop() {
    if (AppState.debug.active)
      console.log(
        "SWIPE UP in the loop",
        AppState.downloadPreferences.autoScrollMode
      );
    if (
      AppState.scrapperDetails.scrappingStage == "initiated" &&
      !AppState.scrapperDetails.locked // Avoids pre-mature celebration. i.e, before the refresh. Refresh resets the value to false.
    ) {
      const message = "🔥 Scraping in progress — sit back and watch the magic!";

      AppState.downloadPreferences.disableConfetti
        ? makeOverlay(message)
        : showCelebration("tier", message);
      AppState.scrapperDetails.scrappingStage = "ongoing";
      AppState.ui.isScrapperBoxOpen = true;
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails)
      );
      let listToScrape;
      if (AppState.scrapperDetails.selectedTab != "collection") {
        listToScrape = (await getTabSpans(30 * 1000))[
          AppState.scrapperDetails.selectedTab
        ];
      }

      // Reset posts and links
      AppState.allDirectLinks = [];
      AppState.allItemsEverSeen = {};
      AppState.displayedState.itemsHash = "";
      AppState.displayedState.path = "";
      listToScrape?.click();
      if (
        !listToScrape &&
        AppState.scrapperDetails.selectedTab != "collection"
      ) {
        showAlertModal(
          "Something unexpected happened tab not found: " +
            toTitleCase(AppState.scrapperDetails.selectedTab || "ew")
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
    AppState.ui.autoSwipeConfigurations.nextClickTimeout = setTimeout(
      async () => {
        if (AppState.debug.active)
          console.log(
            "SWIPE UP ",
            canClickNextButton(),
            "all visible? ",
            listScrollingCompleted()
          );
        clearInterval(AppState.ui.autoSwipeConfigurations.countdownInterval);
        if (
          canClickNextButton() &&
          AppState.downloadPreferences.autoScrollMode == "always"
        ) {
          clickNextButton();
        } else if (AppState.downloadPreferences.autoScrollMode == "always") {
          scrollToLastUserPost();
          detectScrollEnd(() => {
            if (AppState.scrapperDetails.scrappingStage != "ongoing") return;
            console.warn("🔥 We reached the bottom — stop auto-scrolling.");
            AppState.downloadPreferences.autoScrollMode = "off";
            const downloadAllBtn = document.getElementById(
              DOM_IDS.DOWNLOAD_ALL_BUTTON
            );

            if (!downloadAllBtn) {
              if (AppState.allDirectLinks.length) {
                showAlertModal(
                  "⚠️ Couldn't start automatically — click 'Download All' to try again."
                );
              } else {
                AppState.scrapperDetails.scrappingStage = "completed";

                showAlertModal(
                  "😕 No posts found — try another tab or account."
                );
              }
            } else {
              AppState.scrapperDetails.scrappingStage = "downloading";
              downloadAllBtn.click();
            }
            // You can also trigger any post-scroll UI updates here
          });
        }
        loop(); // Repeat
      },
      interval
    );
  }

  loop();
}

/**
 * Starts polling logic and optional auto-swipe.
 */
export function startPolling() {
  setInterval(pollUI, 1 * 1000); // Refresh UI
  setTimeout(() => {
    startAutoSwipeLoop();
  }, 5000);
}
