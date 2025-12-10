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
  updateDownloadButtonLabelSimple,
  showScrapperControls,
  getResolvedThemeMode,
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
  downloadBatch,
  sleep,
  saveCSVFile,
  isOnProfileOrCollectionPage,
} from "../utils/utils.js";
import { DOM_IDS, STORAGE_KEYS } from "../state/constants.js";
import { isExtensionEnabledSync } from "../utils/extensionState.js";

// Helper function to check if extension is enabled
function isExtensionEnabled() {
  return isExtensionEnabledSync();
}
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
/**
 * Checks if the user has navigated away from the original scrapping target
 * and marks scrapping as abandoned if so.
 */
function checkScrapperPathChange() {
  const details = AppState.scrapperDetails;

  // Only check if scrapping is active
  if (
    details.scrappingStage !== "ongoing" &&
    details.scrappingStage !== "downloading" &&
    details.scrappingStage !== "initiated"
  ) {
    return;
  }

  // If no original path was stored, can't check (shouldn't happen, but be safe)
  if (!details.originalPath || !details.originalUsername) {
    return;
  }

  const currentPath = window.location.pathname;
  const currentUsername = getCurrentPageUsername();
  const currentPageInfo = isOnProfileOrCollectionPage();

  // Check if we're on a different profile/collection
  const pathChanged = currentPath !== details.originalPath;
  const usernameChanged = currentUsername !== details.originalUsername;

  // For collections, also check if collection name changed
  let collectionChanged = false;
  if (details.selectedTab === "collection" && details.selectedCollectionName) {
    collectionChanged =
      currentPageInfo.collectionName !== details.selectedCollectionName;
  }

  if (pathChanged || usernameChanged || collectionChanged) {
    console.warn(
      "[Scrapper] Path changed! Original:",
      details.originalPath,
      "Current:",
      currentPath,
      "Marking scrapping as abandoned."
    );

    // Stop auto-scroll immediately
    AppState.downloadPreferences.autoScrollMode = "off";

    // Stop any ongoing batch downloads
    AppState.scrapperDetails.isAutoBatchDownloading = false;

    // Stop any ongoing download operations
    AppState.downloading.isDownloadingAll = false;
    AppState.downloading.isActive = false;

    // Mark as abandoned
    AppState.scrapperDetails.scrappingStage = "completed";
    AppState.scrapperDetails.paused = true; // Pause to stop any ongoing operations

    // Clear the original path tracking
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;

    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails)
    );

    // Show notification to user
    showAlertModal(
      "⚠️ Scrapping Abandoned",
      `You navigated away from the original target (${
        details.originalUsername || details.originalPath
      }). Auto-scrolling and automatic downloads have been stopped. You can manually download items if needed.`
    );

    // Refresh scrapper controls to show the new state
    if (AppState.ui.isScrapperBoxOpen) {
      showScrapperControls();
    }

    // Update download button state to reflect that auto-downloading is stopped
    updateDownloadButtonLabelSimple();
  }
}

window.addEventListener("locationchange", () => {
  scanAndInject();
  checkScrapperPathChange();
});

const createTask = (name, run, interval, shouldRun) => ({
  name,
  run,
  interval,
  shouldRun,
  lastRun: -Infinity,
});

const uiTasks = [
  createTask("download-btn-cleanup", clearDownloadBtnContainers, 5000),
  createTask("download-btn-inject", attachDownloadButtons, 900),
  createTask("scan-and-inject", scanAndInject, 1500),
  createTask("auto-next-listener", autoNextOnVideoEnded, 2500),
  createTask("initial-data", pollInitialData, 4000),
];

let uiFrameHandle = null;
function runScheduledUITasks(reason = "timer") {
  // Check if extension is disabled before running any tasks
  if (!isExtensionEnabled()) {
    return;
  }

  uiFrameHandle = null;
  const now = performance.now();
  for (const task of uiTasks) {
    if (now - task.lastRun < task.interval) continue;
    if (typeof task.shouldRun === "function" && !task.shouldRun()) continue;
    task.lastRun = now;
    try {
      task.run();
    } catch (err) {
      console.warn(`UI task "${task.name}" failed`, err);
    }
  }
}

function scheduleUITasks(reason = "timer") {
  if (uiFrameHandle != null) return;
  uiFrameHandle = window.requestAnimationFrame(() =>
    runScheduledUITasks(reason)
  );
}

/**
 * Detects any new video data (logged-in, logged-out or React-Fiber),
 * feeds it into your handler. Runs every 3s.
 */
export function pollInitialData() {
  // Check if extension is disabled before polling
  if (!isExtensionEnabled()) {
    return;
  }

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

// Helper function to get post list context
function getPostListContext() {
  // Strategy A: user-post-item-list
  let list = document.querySelector('[data-e2e="user-post-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="user-post-item"]');
    if (items.length > 0) {
      return { list, items, strategy: "user-post-list" };
    }
  }

  // Strategy B: challenge-item-list
  list = document.querySelector('[data-e2e="challenge-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="challenge-item"]');
    if (items.length > 0) {
      return { list, items, strategy: "challenge-list" };
    }
  }

  // Strategy C: collection-item-list
  list = document.querySelector('[data-e2e="collection-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="collection-item"]');
    if (items.length > 0) {
      return { list, items, strategy: "collection-list" };
    }
  }

  return { list: null, items: [], strategy: null };
}

/**
 * Performs scroll-back-and-retry strategy before marking completion.
 * Scrolls back up (at most 10 items), then scrolls to bottom to trigger load more.
 * Waits 20 seconds to check for new items.
 * @returns {Promise<boolean>} true if should complete, false if new items found
 */
async function performScrollBackAndRetry() {
  console.log("[AutoBatch] Starting scroll-back-and-retry strategy");

  const { list, items } = getPostListContext();
  if (!list || items.length === 0) {
    console.log("[AutoBatch] No list/items found, completing");
    return true;
  }

  const initialItemCount = AppState.allDirectLinks.length;
  const scrollBackCount = Math.min(20, items.length);

  if (scrollBackCount === 0) {
    console.log("[AutoBatch] No items to scroll back to, completing");
    return true;
  }

  console.log(
    `[AutoBatch] Scrolling back ${scrollBackCount} items to trigger load more`
  );

  // Scroll back up to item at position (items.length - scrollBackCount)
  const targetIndex = items.length - scrollBackCount;
  const targetItem = items[targetIndex];

  if (targetItem) {
    // Temporarily enable scrolling if needed
    const wasAutoScrollEnabled =
      AppState.downloadPreferences.autoScrollMode === "always";

    // Scroll to the target item
    targetItem.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(2000); // Wait for scroll to complete

    // Now scroll back to the bottom
    console.log("[AutoBatch] Scrolling back to bottom");
    // Refresh items list in case new items were loaded
    const refreshedContext = getPostListContext();
    const refreshedItems = refreshedContext.items;
    const lastItem =
      refreshedItems.length > 0
        ? refreshedItems[refreshedItems.length - 1]
        : items[items.length - 1];

    if (lastItem) {
      lastItem.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(2000); // Wait for scroll to complete
    }

    // Re-enable auto-scroll if it was enabled
    if (wasAutoScrollEnabled) {
      AppState.downloadPreferences.autoScrollMode = "always";
    }
  }

  // Wait and check for new items (20 seconds, checking every 2 seconds)
  const waitTime = 20000; // 20 seconds
  const checkInterval = 2000; // Check every 2 seconds
  const maxChecks = waitTime / checkInterval; // 10 checks

  console.log(`[AutoBatch] Waiting ${waitTime / 1000}s to check for new items`);

  for (let i = 0; i < maxChecks; i++) {
    await sleep(checkInterval);

    // Check if new items were discovered in allDirectLinks
    const currentItemCount = AppState.allDirectLinks.length;
    if (currentItemCount > initialItemCount) {
      console.log(
        `[AutoBatch] New items found! Initial: ${initialItemCount}, Current: ${currentItemCount}`
      );
      return false; // New items found, don't complete
    }

    // Also check if there are undownloaded items
    const allItems = AppState.allDirectLinks || [];
    const undownloadedItems = allItems.filter(
      (item) => !AppState.downloadedURLs.includes(item.url)
    );

    if (undownloadedItems.length > 0) {
      console.log(
        `[AutoBatch] Found ${undownloadedItems.length} undownloaded items after scroll-back`
      );
      return false; // Undownloaded items found, don't complete
    }
  }

  console.log("[AutoBatch] No new items found after scroll-back, completing");
  return true; // No new items, safe to complete
}

/**
 * Starts automatic batch downloading during auto-scroll.
 * Monitors allDirectLinks for new items and downloads them in batches.
 */
export function startAutoBatchDownloads() {
  // Check if extension is disabled before starting batch downloads
  if (!isExtensionEnabled()) {
    console.log("[Extension] Extension is disabled. Auto-batch downloads not started.");
    return;
  }

  if (AppState.scrapperDetails.isAutoBatchDownloading) {
    console.log("[AutoBatch] Already running, skipping");
    return;
  }

  // Only start if scrapping is actually ongoing or downloading
  if (
    AppState.scrapperDetails.scrappingStage !== "ongoing" &&
    AppState.scrapperDetails.scrappingStage !== "downloading"
  ) {
    console.log(
      "[AutoBatch] Not starting - scrappingStage is:",
      AppState.scrapperDetails.scrappingStage
    );
    return;
  }

  // Check if path has changed - if so, don't start
  const details = AppState.scrapperDetails;
  if (
    details.originalPath &&
    details.originalPath !== window.location.pathname
  ) {
    console.warn("[AutoBatch] Path changed, not starting batch downloads");
    checkScrapperPathChange(); // This will mark as abandoned
    return;
  }

  AppState.scrapperDetails.isAutoBatchDownloading = true;
  AppState.scrapperDetails.currentBatch = 1;
  AppState.scrapperDetails.downloadedInBatches = 0;
  localStorage.setItem(
    STORAGE_KEYS.SCRAPPER_DETAILS,
    JSON.stringify(AppState.scrapperDetails)
  );

  console.log("[AutoBatch] Starting automatic batch downloads");

  async function processBatches() {
    while (
      AppState.scrapperDetails.scrappingStage === "ongoing" ||
      AppState.scrapperDetails.scrappingStage === "downloading"
    ) {
      // Check if path has changed - if so, stop processing
      const details = AppState.scrapperDetails;
      if (
        details.originalPath &&
        details.originalPath !== window.location.pathname
      ) {
        console.warn(
          "[AutoBatch] Path changed during batch processing, stopping"
        );
        checkScrapperPathChange();
        return;
      }

      // Check if scrapping was abandoned (completed and paused)
      if (
        AppState.scrapperDetails.scrappingStage === "completed" &&
        AppState.scrapperDetails.paused
      ) {
        console.warn(
          "[AutoBatch] Scrapping was abandoned, stopping batch processing"
        );
        AppState.scrapperDetails.isAutoBatchDownloading = false;
        return;
      }

      // Respect pause state
      while (AppState.scrapperDetails.paused) {
        await sleep(1000);
      }

      // Get all available items
      const allItems = AppState.allDirectLinks || [];

      console.log(
        `[AutoBatch] Checking for items. Total: ${allItems.length}, Downloaded: ${AppState.downloadedURLs.length}`
      );

      // Filter out already downloaded items
      const undownloadedItems = allItems.filter(
        (item) => !AppState.downloadedURLs.includes(item.url)
      );

      if (undownloadedItems.length === 0) {
        console.log("[AutoBatch] No undownloaded items found");

        // No new items, check if scrolling is complete
        if (AppState.downloadPreferences.autoScrollMode !== "always") {
          // Scrolling has completed, check if all items are downloaded
          const allDownloaded = allItems.every((item) =>
            AppState.downloadedURLs.includes(item.url)
          );

          if (allDownloaded) {
            console.log(
              "[AutoBatch] All items downloaded, attempting final scroll-back check"
            );

            // Before marking complete, try scroll-back strategy to trigger load more
            const shouldComplete = await performScrollBackAndRetry();

            if (shouldComplete) {
              console.log(
                "[AutoBatch] Scroll-back check complete, marking as completed"
              );
              AppState.scrapperDetails.scrappingStage = "completed";
              AppState.scrapperDetails.isAutoBatchDownloading = false;
              localStorage.setItem(
                STORAGE_KEYS.SCRAPPER_DETAILS,
                JSON.stringify(AppState.scrapperDetails)
              );

              // Refresh scrapper controls to show completion view
              if (AppState.ui.isScrapperBoxOpen) {
                showScrapperControls();
              }

              // Show completion modal
              showScrapperCompletionModal();
              return;
            } else {
              // New items were found, continue processing
              console.log(
                "[AutoBatch] New items found after scroll-back, continuing"
              );
              continue;
            }
          }
        }

        // Wait a bit before checking again
        await sleep(2000);
        continue;
      }

      // We have undownloaded items, create a batch
      // Get current batch number (starts at 1)
      const batchNumber = AppState.scrapperDetails.currentBatch;

      console.log(
        `[AutoBatch] Batch ${batchNumber}: Found ${undownloadedItems.length} undownloaded items`
      );

      // Download the batch
      const result = await downloadBatch(undownloadedItems, batchNumber);

      // Increment batch number AFTER download completes (for next batch)
      AppState.scrapperDetails.currentBatch += 1;
      // Save to localStorage so batch number persists
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails)
      );

      if (result.success) {
        console.log(
          `[AutoBatch] Batch ${batchNumber} completed: ${result.downloaded} items downloaded`
        );
      } else {
        console.warn(
          `[AutoBatch] Batch ${batchNumber} had errors:`,
          result.error
        );
      }

      // Update UI
      updateDownloadButtonLabelSimple();

      // Small delay before checking for next batch
      await sleep(500);
    }

    // If we exit the loop and scrappingStage is not completed, mark as completed
    if (AppState.scrapperDetails.scrappingStage !== "completed") {
      const allItems = AppState.allDirectLinks || [];
      const allDownloaded = allItems.every((item) =>
        AppState.downloadedURLs.includes(item.url)
      );

      if (allDownloaded) {
        // Before marking complete, try scroll-back strategy to trigger load more
        const shouldComplete = await performScrollBackAndRetry();

        if (shouldComplete) {
          AppState.scrapperDetails.scrappingStage = "completed";
          AppState.scrapperDetails.isAutoBatchDownloading = false;
          localStorage.setItem(
            STORAGE_KEYS.SCRAPPER_DETAILS,
            JSON.stringify(AppState.scrapperDetails)
          );

          // Refresh scrapper controls to show completion view
          if (AppState.ui.isScrapperBoxOpen) {
            showScrapperControls();
          }

          showScrapperCompletionModal();
        } else {
          // New items were found, continue processing
          console.log(
            "[AutoBatch] New items found after scroll-back, continuing"
          );
        }
      }
    }
  }

  // Start processing batches
  processBatches().catch((err) => {
    console.error("[AutoBatch] Error in batch processing:", err);
    AppState.scrapperDetails.isAutoBatchDownloading = false;
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails)
    );
  });
}

/**
 * Shows completion modal when scrapper finishes
 */
function showScrapperCompletionModal() {
  // Remove any existing modal
  const existingModal = document.querySelector(
    ".ettpd-scrapper-completion-modal"
  );
  if (existingModal) {
    document.body.removeChild(existingModal);
  }

  const themeClass =
    getResolvedThemeMode() === "dark"
      ? "ettpd-theme-dark"
      : "ettpd-theme-classic";
  const modal = document.createElement("div");
  modal.className = `ettpd-modal-overlay ettpd-scrapper-completion-modal ${themeClass}`;

  const content = document.createElement("div");
  content.className = "ettpd-modal-box ettpd-completion-card";

  const badge = document.createElement("div");
  badge.className = "ettpd-completion-badge";
  badge.textContent = "Auto-scroll";

  const title = document.createElement("h3");
  title.className = "ettpd-completion-title";
  title.textContent = "Scraping finished";

  const message = document.createElement("p");
  message.className = "ettpd-completion-message";
  message.textContent =
    "We downloaded everything we could find. Want us to keep exploring in case TikTok loads more posts?";

  const tip = document.createElement("div");
  tip.className = "ettpd-completion-tip";
  tip.innerHTML =
    "<strong>Pro tip:</strong> Scroll a bit manually to nudge TikTok to load extra items, then hit continue to sweep them up.";

  const actions = document.createElement("div");
  actions.className = "ettpd-modal-actions";

  const continueBtn = document.createElement("button");
  continueBtn.textContent = "Continue & rescan";
  continueBtn.className = "ettpd-modal-button primary";

  const resumeAndClose = () => {
    // Resume auto-scrolling and batch downloading
    AppState.scrapperDetails.scrappingStage = "ongoing";
    AppState.scrapperDetails.isAutoBatchDownloading = false;

    // Check if we're at the bottom - if not, resume scrolling
    if (AppState.downloadPreferences.autoScrollMode === "off") {
      // Try to resume scrolling if not at bottom
      AppState.downloadPreferences.autoScrollMode = "always";
    }

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails)
    );

    // Remove modal
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }

    // Restart batch downloading
    startAutoBatchDownloads();
  };

  continueBtn.onclick = resumeAndClose;

  // Add CSV download button
  const csvBtn = document.createElement("button");
  csvBtn.textContent = "📥 Download CSV";
  csvBtn.className = "ettpd-modal-button secondary";

  csvBtn.onclick = () => {
    // Get all downloaded items by filtering allDirectLinks
    const allItems = AppState.allDirectLinks || [];
    const downloadedItems = allItems.filter((item) =>
      AppState.downloadedURLs.includes(item.url)
    );

    if (downloadedItems.length === 0) {
      showAlertModal(
        "No items to export",
        "No downloaded items found to export to CSV."
      );
      return;
    }

    // Generate CSV using existing function
    saveCSVFile(downloadedItems);

    // Show success message
    showAlertModal(
      "CSV Export Started",
      `Exporting ${downloadedItems.length} downloaded items to CSV file.`
    );
  };

  // Add "End Scrapping" button
  const endBtn = document.createElement("button");
  endBtn.textContent = "End Scrapping";
  endBtn.className = "ettpd-modal-button secondary";

  const endAndClose = () => {
    // End scrapping - clear selected tab and reset state
    AppState.scrapperDetails.scrappingStage = "completed";
    AppState.scrapperDetails.isAutoBatchDownloading = false;
    AppState.scrapperDetails.selectedTab = null;
    AppState.scrapperDetails.selectedCollectionName = null;
    AppState.scrapperDetails.paused = false;

    // Stop auto-scroll
    AppState.downloadPreferences.autoScrollMode = "off";

    // Stop any ongoing downloads
    AppState.downloading.isDownloadingAll = false;
    AppState.downloading.isActive = false;

    // Clear original path tracking
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;

    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails)
    );

    // Remove modal
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }

    // Refresh scrapper controls to show initial state (tabs)
    if (AppState.ui.isScrapperBoxOpen) {
      showScrapperControls();
    }

    // Update download button state
    updateDownloadButtonLabelSimple();
  };

  endBtn.onclick = endAndClose;

  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      resumeAndClose();
    }
  };

  actions.appendChild(continueBtn);
  actions.appendChild(csvBtn);
  actions.appendChild(endBtn);
  content.appendChild(badge);
  content.appendChild(title);
  content.appendChild(message);
  content.appendChild(tip);
  content.appendChild(actions);
  modal.appendChild(content);
  document.body.appendChild(modal);
}

/**
 * Starts the auto swipe loop with countdown.
 */
export function startAutoSwipeLoop(minInterval = 4000, maxInterval = 8000) {
  // Check if extension is disabled before starting auto-swipe
  if (!isExtensionEnabled()) {
    console.log("[Extension] Extension is disabled. Auto-swipe not started.");
    return;
  }

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
      // Store original path if not already stored (in case of page reload)
      if (!AppState.scrapperDetails.originalPath) {
        AppState.scrapperDetails.originalPath = window.location.pathname;
        AppState.scrapperDetails.originalUsername = getCurrentPageUsername();
        const pageInfo = isOnProfileOrCollectionPage();
        if (pageInfo.isCollection) {
          AppState.scrapperDetails.originalCollectionName =
            pageInfo.collectionName;
        }
      }

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

      // Start automatic batch downloading after a short delay to ensure state is set
      setTimeout(() => {
        console.log("[AutoBatch] Triggering start after scrapping begins");
        startAutoBatchDownloads();
      }, 1000);
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

            // Let the batch downloader continue processing remaining items
            // It will set scrappingStage to "completed" when all items are downloaded
            // No need to manually trigger download - batch downloader handles it
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
  // Check if extension is disabled before starting polling
  if (!isExtensionEnabled()) {
    console.log("[Extension] Extension is disabled. Polling not started.");
    return;
  }

  scheduleUITasks("initial");
  setInterval(() => scheduleUITasks("heartbeat"), 600);
  setTimeout(() => {
    startAutoSwipeLoop();
  }, 5000);
}
