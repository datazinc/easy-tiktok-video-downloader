// ui.js
import AppState, { resetAppStateToDefaults } from "../state/state.js";
import {
  STORAGE_KEYS,
  DOM_IDS,
  DOWNLOAD_FOLDER_DEFAULT,
} from "../state/constants.js";
import {
  getDownloadFilePath,
  getSrcById,
  getPostInfoFrom,
  getUsernameFromPlayingArticle,
  getCurrentPageUsername,
  expectSmallViewer,
  getVideoUsernameFromAllDirectLinks,
  canClickNextButton,
  downloadSingleMedia,
  downloadAllPostImagesHandler,
  downloadURLToDisk,
  displayFoundUrls,
  downloadAllLinks,
  getSavedTemplates,
  saveTemplates,
  getPresetTemplates,
  saveSelectedTemplate,
  getAllTimeLeaderBoardList,
  getWeeklyLeaderBoardList,
  updateAllTimeRecommendationsLeaderBoard,
  getAllTimeRecommendationsLeaderBoardList,
  getWeeklyRecommendationsLeaderBoardList,
  getUserDownloadsCurrentTier,
  getUserRecommendationsCurrentTier,
  showCelebration,
  getRandomDownloadSuccessMessage,
  getTabSpans,
  listScrollingCompleted,
  toTitleCase,
  showAlertModal,
  shouldShowRatePopupLegacy,
  getRecommendedPresetTemplate,
  showShareOptions,
  buildVideoLinkMeta,
  cleanupPath,
  applyTemplate,
  isOnProfileOrCollectionPage,
  saveCSVFile,
} from "../utils/utils.js";
import {
  startAutoSwipeLoop,
  startAutoBatchDownloads,
} from "../polling/polling.js";
import {
  isExtensionEnabledSync,
  setExtensionEnabled,
} from "../utils/extensionState.js";

export function getResolvedThemeMode() {
  const stored = AppState.ui.themeMode || "dark";
  const normalized = stored === "classic" ? "light" : stored;

  // If system is selected, detect system preference
  if (normalized === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    return prefersDark ? "dark" : "light";
  }

  if (normalized !== stored && stored !== "system") {
    AppState.ui.themeMode = normalized;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, normalized);
    } catch {}
  }

  return normalized;
}

export function createDownloaderWrapper() {
  const wrapper = document.createElement("div");
  wrapper.id = DOM_IDS.DOWNLOADER_WRAPPER;
  wrapper.className = "ettpd-wrapper";

  // Apply theme class
  const themeMode = getResolvedThemeMode();
  if (themeMode === "dark") {
    wrapper.classList.add("ettpd-theme-dark");
  } else {
    wrapper.classList.add("ettpd-theme-classic");
  }

  const dragHandle = document.createElement("div");
  dragHandle.className = "ettpd-drag-handle";
  dragHandle.title = "Drag to move";
  dragHandle.innerHTML = `<svg class="ettpd-drag-handle-icon" style="display: flex;align-items: center; justify-content: center;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor" height="22px" width="22px" version="1.1" id="Layer_1" viewBox="0 0 492.001 492.001" xml:space="preserve">
                          <g>
                            <g>
                              <path d="M487.97,237.06l-58.82-58.82c-5.224-5.228-14.376-5.228-19.592,0l-7.436,7.432c-5.4,5.4-5.4,14.064,0,19.46l21.872,21.74    H265.206V68.396l21.808,22.132c5.224,5.22,14.216,5.22,19.428,0l7.36-7.432c5.404-5.404,5.356-14.196-0.044-19.596L254.846,4.444    c-2.6-2.592-6.088-4.184-9.804-4.184h-0.404c-3.712,0-7.188,1.588-9.784,4.184l-57.688,57.772    c-2.612,2.608-4.052,6.124-4.052,9.836c0,3.704,1.44,7.208,4.052,9.816l7.432,7.444c5.224,5.22,14.612,5.228,19.828,0.004    l22.368-22.132v159.688H67.814l22.14-22.008c2.608-2.608,4.048-6.028,4.048-9.732s-1.44-7.16-4.052-9.76l-7.436-7.42    c-5.22-5.216-14.372-5.2-19.584,0.008L4.034,236.856c-2.672,2.672-4.1,6.244-4.032,9.92c-0.068,3.816,1.356,7.388,4.028,10.056    l57.68,57.692c5.224,5.22,14.38,5.22,19.596,0l7.44-7.44c2.604-2.6,4.044-6.084,4.044-9.788c0-3.716-1.44-7.232-4.044-9.836    l-22.14-22.172H226.79V425.32l-23.336-23.088c-5.212-5.22-14.488-5.22-19.7,0l-7.5,7.44c-2.604,2.6-4.072,6.084-4.072,9.792    c0,3.704,1.424,7.184,4.028,9.792l58.448,58.456c2.596,2.592,6.068,4.028,9.9,4.028c0.024-0.016,0.24,0,0.272,0    c3.712,0,7.192-1.432,9.792-4.028l58.828-58.832c2.6-2.604,4.044-6.088,4.044-9.792c0-3.712-1.44-7.192-4.044-9.796l-7.44-7.44    c-5.216-5.22-14.044-5.22-19.264,0l-21.54,21.868V265.284H425.59l-23.096,23.132c-2.612,2.608-4.048,6.112-4.048,9.82    s1.432,7.192,4.048,9.8l7.44,7.444c5.212,5.224,14.372,5.224,19.584,0l58.452-58.452c2.672-2.664,4.096-6.244,4.028-9.916    C492.07,243.296,490.642,239.728,487.97,237.06z"/>
                            </g>
                          </g>
                          </svg>
                          `;
  dragHandle.style.marginRight = "25px";

  // Create corner selector dropdown
  const cornerSelector = document.createElement("select");
  cornerSelector.className = "ettpd-corner-select";
  cornerSelector.name = "corner";
  cornerSelector.title = "Snap to corner";
  ["", "top-left", "top-right", "bottom-left", "bottom-right"].forEach(
    (pos) => {
      const opt = document.createElement("option");
      opt.value = pos;
      opt.textContent = pos ? pos.replace("-", " ") : "⇱ Corners";
      cornerSelector.appendChild(opt);
    }
  );

  // Create leaderboard icon button
  const leaderboardBtn = document.createElement("button");
  leaderboardBtn.className = "ettpd-leaderboard-btn";
  leaderboardBtn.title = "View Leaderboard";
  leaderboardBtn.textContent = "📊";
  leaderboardBtn.onclick = showStatsPopUp;
  leaderboardBtn.style.fontSize = "24px";

  const shareBtn = document.createElement("div");
  shareBtn.className = "ettpd-share-btn icon-share";
  shareBtn.title = "Share Extension!";
  shareBtn.onclick = showShareOptions;

  // Append all UI elements
  const controlBar = document.createElement("div");
  controlBar.className = "ettpd-handle-controls";
  controlBar.appendChild(cornerSelector);
  controlBar.appendChild(leaderboardBtn);
  controlBar.appendChild(shareBtn);
  controlBar.appendChild(dragHandle);
  wrapper.appendChild(controlBar);
  if (!wrapper || !wrapper.style) return;
  console.warn(wrapper, "STYLE", wrapper.style);
  // Restore pinned position if exists
  const saved =
    localStorage.getItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE) ||
    "bottom-right";
  if (saved === "custom") {
    const pos =
      AppState.ui.live_ETTPD_CUSTOM_POS &&
      typeof AppState.ui.live_ETTPD_CUSTOM_POS == "string"
        ? JSON.parse(AppState.ui.live_ETTPD_CUSTOM_POS)
        : {};
    console.log("POS: ", pos);
    if (pos.left != null && pos.top != null) {
      wrapper.style.left = `${pos.left}px`;
      wrapper.style.top = `${pos.top}px`;
      wrapper.style.bottom = "auto";
      wrapper.style.right = "auto";
    }
    console.log("not applyCornerPosition-->", pos);
  } else if (saved) {
    applyCornerPosition(wrapper, saved);
  }

  // Enable dragging + save pinned position on pin
  makeElementDraggable(wrapper, dragHandle);

  cornerSelector.onchange = () => {
    const val = cornerSelector.value;
    if (!val) return;
    AppState.ui.downloaderPositionType = val;
    localStorage.setItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE, val);
    applyCornerPosition(wrapper, val);
  };
  return wrapper;
}

export async function showScrapperControls() {
  const scrapperContainer = document.getElementById(
    DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER
  );
  if (!scrapperContainer) return;
  scrapperContainer.style.display = AppState.ui.isScrapperBoxOpen
    ? "flex"
    : "none";
  AppState.ui.isPreferenceBoxOpen =
    scrapperContainer.style.display == "none"
      ? AppState.ui.isPreferenceBoxOpen
      : false;
  if (!scrapperContainer) return;

  const controls = document.createElement("div");
  controls.className = "ettpd-scrapper-controls";

  const title = document.createElement("h3");
  title.textContent = "🧰 Scrapper Controls";
  title.className = "ettpd-controls-title";
  controls.appendChild(title);

  const btnContainer = document.createElement("div");
  btnContainer.className = "ettpd-tab-buttons";

  // Check if we're on a profile or collection page (synchronous check)
  const pageInfo = isOnProfileOrCollectionPage();

  const spans = await getTabSpans(30 * 1000); // 30 seconds wait at most

  // Button Generator
  const tabOptions = [
    { key: "videos", label: "🎥 Scrape Videos" },
    { key: "reposts", label: "🔁 Scrape Reposts" },
    { key: "liked", label: "❤️ Scrape Likes" },
    { key: "favorites", label: "⭐ Scrape Favorites" },
    {
      key: "collection",
      label: `🗂️ Scrape: ${
        spans.collection || pageInfo.collectionName || "Collection"
      }`,
    },
  ];

  // Check if scrapping is already ongoing or downloading
  // Also check for "initiated" stage (after page reload) or if selectedTab is set (scrapping has started)
  // If selectedTab is set and stage is not "completed", scrapping is active
  const isScrappingActive =
    AppState.scrapperDetails.scrappingStage == "ongoing" ||
    AppState.scrapperDetails.scrappingStage == "downloading" ||
    AppState.scrapperDetails.scrappingStage == "initiated" ||
    (AppState.scrapperDetails.selectedTab != null &&
      AppState.scrapperDetails.scrappingStage != "completed");

  // Only show completion view if scrapping has actually completed AND there was a selected tab
  // (meaning a scrapping session was actually started)
  const isScrappingCompleted =
    AppState.scrapperDetails.scrappingStage == "completed" &&
    AppState.scrapperDetails.selectedTab != null;

  // If scrapping is active, show progress instead of tabs
  if (isScrappingActive) {
    const progressContainer = document.createElement("div");
    progressContainer.className = "ettpd-scrapper-progress";

    const progressTitle = document.createElement("div");
    progressTitle.className = "ettpd-scrapper-progress-title";
    progressTitle.textContent = `📂 ${toTitleCase(
      AppState.scrapperDetails.selectedTab || "Scrapper"
    )} Scrapper Active`;
    progressContainer.appendChild(progressTitle);

    const progressInfo = document.createElement("div");
    progressInfo.className = "ettpd-scrapper-progress-info";
    progressInfo.id = "ettpd-scrapper-progress-info";

    // Update progress info
    const updateProgressInfo = () => {
      const total = AppState.allDirectLinks.length;
      const downloaded = AppState.downloadedURLs.length;
      const batch = AppState.scrapperDetails.currentBatch || 1;
      const isDownloading = AppState.downloading.isDownloadingAll;

      if (isDownloading && AppState.scrapperDetails.isAutoBatchDownloading) {
        // Show current batch being downloaded
        const currentBatch = AppState.scrapperDetails.currentBatch || 1;
        progressInfo.innerHTML = `
          <div>⏳ Batch ${currentBatch}: Downloading items...</div>
          <div>Downloaded: ${downloaded} of ${total} posts</div>
          <div style="font-size: 11px; color: #666; margin-top: 5px;">Auto-scrolling and downloading in progress</div>
        `;
      } else if (total > 0) {
        progressInfo.innerHTML = `
          <div>📊 Total discovered: ${total} posts</div>
          <div>✅ Downloaded: ${downloaded} posts</div>
        `;
      } else {
        progressInfo.innerHTML = `
          <div>🔍 Discovering posts...</div>
          <div style="font-size: 11px; color: #666; margin-top: 5px;">Auto-scrolling in progress</div>
        `;
      }
    };

    updateProgressInfo();
    progressContainer.appendChild(progressInfo);

    // Add pause/resume controls
    const controlsRow = document.createElement("div");
    controlsRow.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 15px;
      justify-content: center;
    `;

    const pauseBtn = document.createElement("button");
    pauseBtn.className = "ettpd-scrapper-pause";
    pauseBtn.textContent = AppState.scrapperDetails.paused
      ? "▶️ Resume"
      : "⏸️ Pause";
    pauseBtn.style.cssText = `
      background: ${AppState.scrapperDetails.paused ? "#007AFF" : "#FF9500"};
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    `;

    pauseBtn.onmouseover = () => {
      pauseBtn.style.background = AppState.scrapperDetails.paused
        ? "#0056CC"
        : "#E68500";
    };
    pauseBtn.onmouseout = () => {
      pauseBtn.style.background = AppState.scrapperDetails.paused
        ? "#007AFF"
        : "#FF9500";
    };

    pauseBtn.onclick = () => {
      AppState.scrapperDetails.paused = !AppState.scrapperDetails.paused;
      if (AppState.scrapperDetails.paused) {
        // Pause logic
        AppState.downloadPreferences.autoScrollMode = "off";
        pauseBtn.textContent = "▶️ Resume";
        pauseBtn.style.background = "#007AFF";
        console.log("[Scrapper] Paused");
      } else {
        // Resume logic
        AppState.downloadPreferences.autoScrollMode = "always";
        pauseBtn.textContent = "⏸️ Pause";
        pauseBtn.style.background = "#FF9500";
        console.log("[Scrapper] Resumed");
      }
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails)
      );
      // Update button hover colors
      pauseBtn.onmouseover = () => {
        pauseBtn.style.background = AppState.scrapperDetails.paused
          ? "#0056CC"
          : "#E68500";
      };
    };

    controlsRow.appendChild(pauseBtn);
    progressContainer.appendChild(controlsRow);

    // Update progress periodically
    const progressInterval = setInterval(() => {
      if (!document.getElementById("ettpd-scrapper-progress-info")) {
        clearInterval(progressInterval);
        return;
      }

      // Check if scrapping has completed - if so, refresh the controls
      if (
        AppState.scrapperDetails.scrappingStage === "completed" &&
        AppState.ui.isScrapperBoxOpen
      ) {
        clearInterval(progressInterval);
        showScrapperControls();
        return;
      }

      // Update pause button state if it changed externally
      if (pauseBtn && pauseBtn.textContent) {
        const shouldBePaused = AppState.scrapperDetails.paused;
        const isCurrentlyPaused = pauseBtn.textContent.includes("Resume");
        if (shouldBePaused !== isCurrentlyPaused) {
          pauseBtn.textContent = shouldBePaused ? "▶️ Resume" : "⏸️ Pause";
          pauseBtn.style.background = shouldBePaused ? "#007AFF" : "#FF9500";
        }
      }

      updateProgressInfo();
    }, 2000);

    btnContainer.appendChild(progressContainer);
  } else if (isScrappingCompleted) {
    // Show completion state with continue button
    const completionContainer = document.createElement("div");
    completionContainer.className = "ettpd-scrapper-completion";

    const completionTitle = document.createElement("div");
    completionTitle.className = "ettpd-scrapper-completion-title";
    completionTitle.textContent = `✅ ${toTitleCase(
      AppState.scrapperDetails.selectedTab || "Scrapper"
    )} Scraping Finished`;
    completionContainer.appendChild(completionTitle);

    const completionInfo = document.createElement("div");
    completionInfo.className = "ettpd-scrapper-completion-info";
    const total = AppState.allDirectLinks.length;
    const downloaded = AppState.downloadedURLs.length;
    completionInfo.innerHTML = `
      <div style="margin-bottom: 15px;">
        <div>📊 Total discovered: ${total} posts</div>
        <div>✅ Downloaded: ${downloaded} posts</div>
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 15px; line-height: 1.5;">
        Auto-scrolling has reached the bottom. If you think there are more items, try manually scrolling down to trigger TikTok's "load more" feature, then click Continue.
      </div>
    `;
    completionContainer.appendChild(completionInfo);

    const continueBtn = document.createElement("button");
    continueBtn.className = "ettpd-scrapper-continue-btn";
    continueBtn.textContent = "🔄 Continue";
    continueBtn.style.cssText = `
      background: #007AFF;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
      margin-top: 10px;
      transition: background 0.2s;
    `;

    continueBtn.onmouseover = () => {
      continueBtn.style.background = "#0056CC";
    };
    continueBtn.onmouseout = () => {
      continueBtn.style.background = "#007AFF";
    };

    continueBtn.onclick = () => {
      // Resume auto-scrolling and batch downloading
      AppState.scrapperDetails.scrappingStage = "ongoing";
      AppState.scrapperDetails.isAutoBatchDownloading = false;

      // Resume scrolling if not at bottom
      if (AppState.downloadPreferences.autoScrollMode === "off") {
        AppState.downloadPreferences.autoScrollMode = "always";
      }

      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails)
      );

      // Restart batch downloading
      startAutoBatchDownloads();

      // Refresh the scrapper controls to show progress
      showScrapperControls();
    };

    // Add CSV download button
    const csvBtn = document.createElement("button");
    csvBtn.className = "ettpd-scrapper-continue-btn";
    csvBtn.textContent = "📥 Download CSV";
    csvBtn.style.cssText = `
      background: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
      margin-top: 10px;
      transition: background 0.2s;
    `;

    csvBtn.onmouseover = () => {
      csvBtn.style.background = "#e0e0e0";
    };
    csvBtn.onmouseout = () => {
      csvBtn.style.background = "#f0f0f0";
    };

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
    endBtn.className = "ettpd-scrapper-continue-btn";
    endBtn.textContent = "End Scrapping";
    endBtn.style.cssText = `
      background: #ff3b30;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
      margin-top: 10px;
      transition: background 0.2s;
    `;

    endBtn.onmouseover = () => {
      endBtn.style.background = "#d32f2f";
    };
    endBtn.onmouseout = () => {
      endBtn.style.background = "#ff3b30";
    };

    endBtn.onclick = () => {
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

      // Refresh scrapper controls to show initial state (tabs)
      showScrapperControls();

      // Update download button state
      updateDownloadButtonLabelSimple();
    };

    completionContainer.appendChild(continueBtn);
    completionContainer.appendChild(csvBtn);
    completionContainer.appendChild(endBtn);
    btnContainer.appendChild(completionContainer);
  } else if (!isScrappingActive) {
    // Show tabs when scrapping is not active
    // Double-check that scrapping is not active before showing tabs
    const createdTabButtons = [];

    tabOptions.forEach(({ key, label }) => {
      const tabSpan = spans[key];
      if (
        !tabSpan ||
        (typeof tabSpan === "string" && !tabSpan.trim()) ||
        (typeof tabSpan !== "string" && !tabSpan.offsetParent)
      ) {
        return;
      }

      const btn = document.createElement("button");
      btn.className = `ettpd-tab-btn ettpd-tab-btn-${key}`;
      btn.dataset.tabKey = key; // Store key for easy lookup
      btn.innerHTML = `
        <span class="ettpd-tab-check" aria-hidden="true">✓</span>
        <span class="ettpd-tab-label">${label}</span>
      `;
      btn.setAttribute("aria-pressed", "false");

      btn.addEventListener("click", () => {
        // Remove active class from all tab buttons
        document.querySelectorAll(".ettpd-tab-btn.active").forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });

        // Set the clicked one as active
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        if (key == "collection") {
          AppState.scrapperDetails.selectedCollectionName =
            spans.collection || pageInfo.collectionName;
        }

        // Your existing logic
        showScrapperStateUI(key);
      });

      btnContainer.appendChild(btn);
      createdTabButtons.push({ key, btn });
    });

    // Check which tabs are available
    const availableTabs = tabOptions.filter(({ key }) => {
      const span = spans[key];
      if (!span) return false;

      if (typeof span === "string") {
        return span.trim().length > 0; // allow non-empty string
      }

      return !!span.offsetParent; // DOM element visible
    });

    const tabsAvailable = availableTabs.length > 0;
    const allTabsAvailable = availableTabs.length === tabOptions.length;

    // Show refresh button if not all tabs are available (but at least some are)
    if (tabsAvailable && !allTabsAvailable && pageInfo.isProfile) {
      const refreshTabsBtn = document.createElement("button");
      refreshTabsBtn.textContent = "🔄 Check for More Tabs";
      refreshTabsBtn.className = "ettpd-refresh-tabs-btn";
      refreshTabsBtn.style.cssText = `
        background: #f0f0f0;
        color: #333;
        border: 1px solid #ddd;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
        margin-top: 10px;
        width: 100%;
      `;
      refreshTabsBtn.onmouseover = () => {
        refreshTabsBtn.style.background = "#e0e0e0";
      };
      refreshTabsBtn.onmouseout = () => {
        refreshTabsBtn.style.background = "#f0f0f0";
      };

      let isRefreshing = false;
      refreshTabsBtn.onclick = async () => {
        if (isRefreshing) return;
        isRefreshing = true;
        refreshTabsBtn.disabled = true;
        refreshTabsBtn.textContent = "⏳ Checking...";
        refreshTabsBtn.style.background = "#999";

        try {
          // Re-fetch tabs from DOM
          const newSpans = await getTabSpans(5000, 100);

          // Check which tabs are now available
          const newAvailableTabs = tabOptions.filter(({ key }) => {
            const span = newSpans[key];
            if (!span) return false;
            if (typeof span === "string") {
              return span.trim().length > 0;
            }
            return !!span.offsetParent;
          });

          // If we found more tabs, re-render
          if (newAvailableTabs.length > availableTabs.length) {
            refreshTabsBtn.textContent = "✅ Found More!";
            setTimeout(() => {
              showScrapperControls(); // Re-render with new tabs
            }, 500);
          } else {
            refreshTabsBtn.textContent = "🔄 Check for More Tabs";
            refreshTabsBtn.style.background = "#f0f0f0";
            // Show a brief message
            const originalText = refreshTabsBtn.textContent;
            refreshTabsBtn.textContent = "No new tabs found";
            setTimeout(() => {
              refreshTabsBtn.textContent = originalText;
            }, 2000);
          }
        } catch (err) {
          console.error("Error checking for tabs:", err);
          refreshTabsBtn.textContent = "🔄 Check for More Tabs";
          refreshTabsBtn.style.background = "#f0f0f0";
        } finally {
          isRefreshing = false;
          refreshTabsBtn.disabled = false;
        }
      };

      btnContainer.appendChild(refreshTabsBtn);
    }

    // Show message if not on profile/collection page OR if no tabs are available
    if (!pageInfo.isProfile) {
      const subtitle = document.createElement("span");
      subtitle.id = "tab-subtitle";
      subtitle.className = "ettpd-tab-subtitle";
      subtitle.innerHTML =
        "<strong>Heads up:</strong> Please navigate to a profile or collection page first. If you download from other pages, you may end up downloading random posts. Reload the page if you don't see any tabs.";
      btnContainer.appendChild(subtitle);
    } else if (!tabsAvailable) {
      // Show auto-checking message with manual refresh button
      const subtitle = document.createElement("div");
      subtitle.id = "tab-subtitle";
      subtitle.className = "ettpd-tab-subtitle";
      subtitle.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 15px;
        text-align: center;
      `;

      const message = document.createElement("div");
      message.style.cssText = `
        font-size: 13px;
        color: #666;
        margin-bottom: 5px;
      `;
      message.innerHTML = "<strong>🔍 Auto-checking for tabs...</strong>";

      const refreshBtn = document.createElement("button");
      refreshBtn.textContent = "🔄 Refresh Tabs";
      refreshBtn.style.cssText = `
        background: #007AFF;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
      `;
      refreshBtn.onmouseover = () => {
        refreshBtn.style.background = "#0056CC";
      };
      refreshBtn.onmouseout = () => {
        refreshBtn.style.background = "#007AFF";
      };

      let isRefreshing = false;
      refreshBtn.onclick = async () => {
        if (isRefreshing) return;
        isRefreshing = true;
        refreshBtn.disabled = true;
        refreshBtn.textContent = "⏳ Checking...";
        refreshBtn.style.background = "#999";

        try {
          // Re-fetch tabs
          const newSpans = await getTabSpans(5000, 100);

          // Check if we found any tabs
          const newTabsAvailable =
            tabOptions.filter(({ key }) => {
              const span = newSpans[key];
              if (!span) return false;
              if (typeof span === "string") {
                return span.trim().length > 0;
              }
              return !!span.offsetParent;
            }).length > 0;

          if (newTabsAvailable) {
            // Tabs found! Re-render the controls
            refreshBtn.textContent = "✅ Found!";
            setTimeout(() => {
              showScrapperControls(); // Re-render with new tabs
            }, 500);
          } else {
            refreshBtn.textContent = "🔄 Refresh Tabs";
            refreshBtn.style.background = "#007AFF";
            message.innerHTML =
              "<strong>⚠️ No tabs found yet. Try scrolling the page or wait a moment.</strong>";
          }
        } catch (err) {
          console.error("Error refreshing tabs:", err);
          refreshBtn.textContent = "🔄 Refresh Tabs";
          refreshBtn.style.background = "#007AFF";
          message.innerHTML =
            "<strong>❌ Error checking for tabs. Please try again.</strong>";
        } finally {
          isRefreshing = false;
          refreshBtn.disabled = false;
        }
      };

      subtitle.appendChild(message);
      subtitle.appendChild(refreshBtn);
      btnContainer.appendChild(subtitle);

      // Auto-check for tabs periodically
      let checkCount = 0;
      const maxAutoChecks = 30; // Check for 30 seconds (30 checks * 1 second)
      let autoCheckInterval = null;

      // Store interval ID on the subtitle element so we can clean it up
      const startAutoCheck = () => {
        if (autoCheckInterval) {
          clearInterval(autoCheckInterval);
        }

        autoCheckInterval = setInterval(async () => {
          // Check if subtitle still exists (controls might have been re-rendered)
          if (!document.getElementById("tab-subtitle")) {
            clearInterval(autoCheckInterval);
            return;
          }

          checkCount++;

          // Stop checking after max attempts
          if (checkCount > maxAutoChecks) {
            clearInterval(autoCheckInterval);
            if (message && document.getElementById("tab-subtitle")) {
              message.innerHTML =
                "<strong>⏱️ Auto-check stopped. Click Refresh Tabs to try again.</strong>";
            }
            return;
          }

          try {
            const newSpans = await getTabSpans(2000, 100); // Quick check (2 seconds)

            const newTabsAvailable =
              tabOptions.filter(({ key }) => {
                const span = newSpans[key];
                if (!span) return false;
                if (typeof span === "string") {
                  return span.trim().length > 0;
                }
                return !!span.offsetParent;
              }).length > 0;

            if (newTabsAvailable) {
              clearInterval(autoCheckInterval);
              if (message) {
                message.innerHTML =
                  "<strong>✅ Tabs found! Loading...</strong>";
              }
              setTimeout(() => {
                showScrapperControls(); // Re-render with new tabs
              }, 500);
            } else if (message && document.getElementById("tab-subtitle")) {
              message.innerHTML = `<strong>🔍 Auto-checking for tabs... (${checkCount}/${maxAutoChecks})</strong>`;
            }
          } catch (err) {
            console.error("Error in auto-check:", err);
          }
        }, 1000); // Check every 1 second
      };

      startAutoCheck();
    }
  }

  // Remove any existing subtitle that might be stale
  {
    const existingSubtitle = document.getElementById("tab-subtitle");
    if (existingSubtitle && existingSubtitle.parentElement !== btnContainer) {
      existingSubtitle.remove();
    }
  }

  // Remove all existing controls and tab buttons
  scrapperContainer
    .querySelectorAll(".ettpd-scrapper-controls")
    .forEach((el) => el.remove());
  scrapperContainer
    .querySelectorAll(".ettpd-tab-btn")
    .forEach((el) => el.remove());

  scrapperContainer.appendChild(controls);
  controls.appendChild(btnContainer);

  // Auto-select the previously chosen tab (or the first available) after controls are in DOM
  // Only do this if we're showing tabs (not active or completed scrapping)
  if (!isScrappingActive && !isScrappingCompleted) {
    const tabButtons = btnContainer.querySelectorAll(".ettpd-tab-btn");
    if (tabButtons.length > 0) {
      const savedKey = AppState.scrapperDetails.selectedTab;
      let defaultBtn = null;

      // Find the button matching saved key using data attribute
      if (savedKey) {
        defaultBtn = Array.from(tabButtons).find(
          (btn) => btn.dataset.tabKey === savedKey
        );
      }

      // If no match found, use first button
      if (!defaultBtn && tabButtons.length > 0) {
        defaultBtn = tabButtons[0];
      }

      if (defaultBtn) {
        // Remove active from all
        tabButtons.forEach((btn) => {
          btn.classList.remove("active");
          btn.setAttribute("aria-pressed", "false");
        });

        // Set active on default
        defaultBtn.classList.add("active");
        defaultBtn.setAttribute("aria-pressed", "true");

        // Get the key from data attribute
        const tabKey = defaultBtn.dataset.tabKey;

        // Set selected tab and collection name if needed
        if (tabKey == "collection") {
          AppState.scrapperDetails.selectedCollectionName =
            spans.collection || pageInfo.collectionName;
        }

        // Show the start button container - controls are now in the DOM
        showScrapperStateUI(tabKey);
      }
    }
  }

  // Update download all button state when scrapper controls are shown
  const downloadAllBtn = document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (downloadAllBtn) {
    updateDownloadAllButtonState(downloadAllBtn);
  }

  // Update message when location changes
  const updateMessageOnLocationChange = () => {
    const pageInfo = isOnProfileOrCollectionPage();
    const subtitle = document.getElementById("tab-subtitle");

    if (!subtitle) return;

    if (!pageInfo.isProfile) {
      subtitle.innerHTML =
        "<strong>Heads up:</strong> Please navigate to a profile or collection page first. If you download from other pages, you may end up downloading random posts. Reload the page if you don't see any tabs.";
    } else {
      // On valid page, check if tabs are available
      const tabsAvailable =
        btnContainer.querySelectorAll(".ettpd-tab-btn").length > 0;
      if (!tabsAvailable) {
        // If tabs aren't available, trigger a refresh of scrapper controls
        // This will set up the auto-checking mechanism
        showScrapperControls();
      } else {
        // Tabs are available, remove the message
        subtitle.remove();
      }
    }
  };

  // Listen for location changes
  window.addEventListener("locationchange", updateMessageOnLocationChange);
  window.addEventListener("popstate", updateMessageOnLocationChange);

  // Also check periodically in case tabs load after initial render
  let checkCount = 0;
  const checkInterval = setInterval(() => {
    if (!document.getElementById(DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER)) {
      clearInterval(checkInterval);
      return;
    }
    updateMessageOnLocationChange();

    // Stop checking after 15 iterations (30 seconds at 2s intervals)
    checkCount++;
    if (checkCount >= 15) {
      clearInterval(checkInterval);
    }
  }, 2000);

  return controls;
}

function explainerModal(tab) {
  const description = document.createElement("p");
  description.className = "ettpd-scrapper-info";
  description.innerHTML = `<p class="alert">
  Clicking <strong>Start</strong> will reload the page and scrape
  <strong>every post</strong> under your currently selected tab —
  <strong>@${getCurrentPageUsername()} <em>${tab}</em></strong>.
</p>
<blockquote class="black-text" style="margin-bottom: 10px;">
  If you can't <strong>see</strong> the posts, you can't <strong>download</strong> them. Duh. 😤. <br/> If a tab(likes, reposts, etc) is missing, first click on it or refresh :)
</blockquote>
<p class="alert">
  You can <strong>Pause</strong> anytime or smash <strong>Download Now</strong> to dive in instantly.
</p>
<p class="alert">
  Want full control? Customize where your downloads go by setting up your own
  <strong>File Path Templates</strong> under <strong>Settings → File Paths</strong>. 🛠️
</p>`;

  // Recommended template card with quick apply
  const recommendedCard = document.createElement("div");
  recommendedCard.style.cssText = `
    background: var(--ettpd-bg-tertiary, #f0f0f0);
    border: 1px solid var(--ettpd-border-color, #ddd);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
  `;

  const recommendedLabel = document.createElement("div");
  recommendedLabel.style.cssText = `
    font-size: 13px;
    font-weight: 600;
    color: var(--ettpd-text-primary, #333);
    margin-bottom: 8px;
  `;
  recommendedLabel.textContent = "✨ Recommended Template";

  const recommendedExample = document.createElement("div");
  recommendedExample.style.cssText = `
    font-size: 11px;
    color: var(--ettpd-text-secondary, #666);
    font-family: monospace;
    margin-bottom: 10px;
    word-break: break-all;
  `;
  recommendedExample.textContent = getRecommendedPresetTemplate().example;

  const applyBtn = document.createElement("button");
  applyBtn.className = "ettpd-action-btn primary";
  applyBtn.textContent = "✨ Use This Template";
  applyBtn.style.cssText = `
    width: 100%;
    margin-bottom: 0;
  `;

  // Success message element (initially hidden)
  const successMessage = document.createElement("div");
  successMessage.style.cssText = `
    font-size: 12px;
    color: var(--ettpd-accent, #3391ff);
    margin-top: 8px;
    text-align: center;
    font-weight: 500;
    display: none;
  `;

  applyBtn.onclick = () => {
    // Update state first (your comment says saveTemplates needs it)
    AppState.downloadPreferences.fullPathTemplate =
      getRecommendedPresetTemplate();
    const templates = getSavedTemplates();
    const updated = templates.filter(
      (t) => t.label !== AppState.downloadPreferences.fullPathTemplate.label
    );
    updated.push(AppState.downloadPreferences.fullPathTemplate);
    // First update the state, since it's needed by saveTemplates
    saveTemplates(updated);
    saveSelectedTemplate();

    // Show success message instead of opening another modal
    successMessage.textContent = "✅ Template applied successfully!";
    successMessage.style.display = "block";
    applyBtn.disabled = true;
    applyBtn.style.opacity = "0.7";
  };

  recommendedCard.appendChild(recommendedLabel);
  recommendedCard.appendChild(recommendedExample);
  recommendedCard.appendChild(applyBtn);
  recommendedCard.appendChild(successMessage);

  // Configure button - secondary action
  const configBtn = document.createElement("button");
  configBtn.className = "ettpd-action-btn secondary";
  configBtn.textContent = "⚙️ Customize File Paths";
  configBtn.style.cssText = `
    width: 100%;
  `;
  configBtn.onclick = () => {
    createFilenameTemplateModal();
  };

  const actionsContainer = document.createElement("div");
  actionsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;
  actionsContainer.appendChild(recommendedCard);
  actionsContainer.appendChild(configBtn);

  // Close button for easy access
  const closeBtn = document.createElement("button");
  closeBtn.className = "ettpd-action-btn secondary";
  closeBtn.textContent = "✕ Close";
  closeBtn.style.cssText = `
    width: 100%;
    margin-top: 8px;
  `;
  closeBtn.onclick = () => {
    const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
    if (overlay) overlay.remove();
  };

  actionsContainer.appendChild(closeBtn);

  createModal({
    children: [description, actionsContainer],
  });
}

function showScrapperStateUI(tabKey) {
  // Remove any previous active UI
  document.querySelector(".ettpd-scrapper-active-ui")?.remove();

  const container = document.createElement("div");
  container.className = "ettpd-scrapper-active-ui";

  const heading = document.createElement("h4");
  heading.textContent = `📂 ${toTitleCase(tabKey)} Scrapper Selected`;
  heading.className = "ettpd-scrapper-title";

  const actions = document.createElement("div");
  actions.className = "ettpd-scrapper-actions";

  const startBtn = document.createElement("button");
  startBtn.className = "ettpd-scrapper-start";
  startBtn.title =
    AppState.scrapperDetails.scrappingStage == "ongoing" ||
    AppState.scrapperDetails.scrappingStage == "downloading"
      ? "Press to cancel and start anew"
      : "Initiate Scrapping";
  startBtn.textContent =
    AppState.scrapperDetails.scrappingStage == "ongoing" ||
    AppState.scrapperDetails.scrappingStage == "downloading"
      ? "🚀 Start*"
      : "🚀 Start";
  // startBtn.disabled =
  //   AppState.scrapperDetails.scrappingStage == "ongoing" ||
  //   AppState.scrapperDetails.scrappingStage == "downloading";
  startBtn.onclick = () => {
    console.log(`[Scrapper] Starting download for "${tabKey}"`);
    AppState.scrapperDetails.startedAt = Date.now();
    AppState.scrapperDetails.selectedTab = tabKey;
    AppState.scrapperDetails.scrappingStage = "initiated";
    AppState.scrapperDetails.paused = false;
    AppState.scrapperDetails.locked = true;

    // Store original path and username to detect navigation away
    const pageInfo = isOnProfileOrCollectionPage();
    AppState.scrapperDetails.originalPath = window.location.pathname;
    AppState.scrapperDetails.originalUsername = getCurrentPageUsername();
    if (pageInfo.isCollection) {
      AppState.scrapperDetails.originalCollectionName = pageInfo.collectionName;
    }

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails)
    );
    // Start scraping logic here
    window.location.href = window.location.pathname;
  };

  const pauseBtn = document.createElement("button");
  pauseBtn.className = "ettpd-scrapper-pause";
  pauseBtn.textContent = AppState.scrapperDetails.paused
    ? "▶️ Resume"
    : "⏸️ Pause";
  pauseBtn.disabled =
    AppState.scrapperDetails.scrappingStage != "ongoing" &&
    AppState.scrapperDetails.scrappingStage != "downloading";

  pauseBtn.onclick = () => {
    AppState.scrapperDetails.paused = !AppState.scrapperDetails.paused;
    if (AppState.scrapperDetails.paused) {
      // Pause logic
      AppState.downloadPreferences.autoScrollMode = "off";
      pauseBtn.textContent = "▶️ Resume";
      console.log(`[Scrapper] Paused "${tabKey}"`);
    } else {
      // Resume logic
      AppState.downloadPreferences.autoScrollMode = "always";
      pauseBtn.textContent = "⏸️ Pause";
      console.log(`[Scrapper] Resumed "${tabKey}"`);
    }
  };
  const learnBtn = document.createElement("button");
  learnBtn.className = "ettpd-scrapper-learn";
  learnBtn.textContent = "ℹ️ Info";
  learnBtn.style.fontSize = "12px";
  learnBtn.onclick = () => {
    console.log(`[Scrapper] Showing explainer for "${tabKey}"`);
    explainerModal(toTitleCase(tabKey));
  };

  actions.append(startBtn, pauseBtn, learnBtn);
  container.append(heading, actions);

  // Insert below controls panel
  const controls = document.querySelector(".ettpd-scrapper-controls");
  controls?.insertAdjacentElement("afterend", container);
}

function applyCornerPosition(wrapper, position) {
  console.log("applyCornerPosition-->", position);
  wrapper.style.top = "";
  wrapper.style.left = "";
  wrapper.style.right = "";
  wrapper.style.bottom = "";

  switch (position) {
    case "top-left":
      wrapper.style.top = "20px";
      wrapper.style.left = "20px";
      break;
    case "top-right":
      wrapper.style.top = "20px";
      wrapper.style.right = "20px";
      break;
    case "bottom-left":
      wrapper.style.bottom = "80px";
      wrapper.style.left = "20px";
      break;
    case "bottom-right":
      wrapper.style.bottom = "80px";
      wrapper.style.right = "20px";
      break;
  }
}

function createDownloadAllButton() {
  const container = document.createElement("div");
  container.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-container";
  container.className = "ettpd-download-all-container";

  const btn = document.createElement("button");
  btn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON;
  btn.className = "ettpd-btn download-all-btn";
  btn.textContent = "⬇️ Download";
  btn.disabled = true;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    downloadAllLinks(btn);
  };

  const message = document.createElement("div");
  message.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-message";
  message.className = "ettpd-scrapper-message";
  message.style.display = "none";
  message.innerHTML = `
    <strong>💡 Use the Scrapper instead!</strong><br>
    <span style="font-size: 11px;">Pick a tab (e.g., Scrape Videos), then click Start to begin automated downloading.</span>
  `;
  message.style.fontSize = "12px";
  message.style.color = "#666";
  message.style.marginTop = "5px";
  message.style.textAlign = "center";
  message.style.padding = "10px";
  message.style.borderRadius = "5px";
  message.style.backgroundColor = "#f0f0f0";
  message.style.border = "1px solid #ccc";
  message.style.lineHeight = "1.5";

  container.appendChild(btn);
  container.appendChild(message);

  return container;
}

function updateDownloadAllButtonState(btn, items = []) {
  if (!btn) return;

  const scrapperBoxOpen = AppState.ui.isScrapperBoxOpen;
  const scrappingStage = AppState.scrapperDetails.scrappingStage;
  const selectedTab = AppState.scrapperDetails.selectedTab;
  const scrappingAbandoned =
    scrappingStage === "completed" &&
    AppState.scrapperDetails.paused &&
    AppState.scrapperDetails.originalPath !== null; // Indicates it was abandoned

  // Check if scrapping is actually active (ongoing or downloading)
  const isScrappingActive =
    scrappingStage === "ongoing" || scrappingStage === "downloading";

  // Check if scrapper is selected but not started - hide button in this case
  const scrapperSelectedNotStarted =
    selectedTab &&
    scrappingStage !== "ongoing" &&
    scrappingStage !== "downloading" &&
    scrappingStage !== "completed";

  // btn might be the container or the actual button
  const container =
    btn.id === DOM_IDS.DOWNLOAD_ALL_BUTTON + "-container"
      ? btn
      : btn.closest("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-container");
  const actualBtn = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON)
    : btn.id === DOM_IDS.DOWNLOAD_ALL_BUTTON
    ? btn
    : null;
  const message = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-message")
    : null;

  if (!actualBtn) return;

  // Show container
  if (container) container.style.display = "block";

  // Hide button only when:
  // 1. Scrapper box is open AND scrapping is active (ongoing/downloading), OR
  // 2. Scrapper box is open AND a tab is selected but not started
  // BUT allow manual downloads if scrapping was abandoned
  if (scrapperBoxOpen && !scrappingAbandoned) {
    if (isScrappingActive || scrapperSelectedNotStarted) {
      actualBtn.style.display = "none";
      if (message) message.style.display = "block";
      return;
    }
    // If scrapper box is open but scrapping is not active and no tab selected,
    // show the button normally (user can use regular download)
  }

  // If scrapping was abandoned, show the button for manual downloads
  if (scrapperBoxOpen && scrappingAbandoned) {
    actualBtn.style.display = "block";
    if (message) message.style.display = "none";
    // Continue to show normal button state below
  }

  if (scrapperSelectedNotStarted) {
    // Hide button and show message when scrapper is selected but not started
    actualBtn.style.display = "none";
    if (message) message.style.display = "block";
    return;
  }

  // Show button and hide message (when scrapping is ongoing or not using scrapper)
  actualBtn.style.display = "block";
  if (message) message.style.display = "none";

  const total = items.length || AppState.allDirectLinks.length;
  const done = AppState.downloadedURLs.length;
  const isDownloading = AppState.downloading.isDownloadingAll;

  if (!total) {
    actualBtn.textContent = "🚫 Nothing to download";
    actualBtn.disabled = true;
    return;
  }

  if (isDownloading) {
    if (done < total) {
      actualBtn.textContent = `⏳ Downloading ${done} of ${total} post${
        total !== 1 ? "s" : ""
      }…`;
    } else {
      actualBtn.textContent = `✅ All ${total} post${
        total !== 1 ? "s" : ""
      } downloaded`;
    }
    actualBtn.disabled = true;
    return;
  }

  actualBtn.textContent = `⬇️ Download ${
    total > 1 ? `all ${total}` : "1"
  } post${total !== 1 ? "s" : ""}`;
  actualBtn.disabled = false;
}

export function updateDownloadButtonLabel(btnElement, text) {
  const btn =
    btnElement || document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (AppState.debug.active)
    if (btn) {
      btn.innerText = text;
    } else {
      console.warn("Download All button not found in the DOM.");
    }
}

export function updateDownloadButtonLabelSimple() {
  const downloadAllBtn = document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (!downloadAllBtn) return;

  // Check if scrapper is selected but not started - hide button in this case
  const scrapperSelectedNotStarted =
    AppState.scrapperDetails.selectedTab &&
    AppState.scrapperDetails.scrappingStage !== "ongoing" &&
    AppState.scrapperDetails.scrappingStage !== "downloading" &&
    AppState.scrapperDetails.scrappingStage !== "completed";

  const container = downloadAllBtn.parentElement;
  const message = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-message")
    : null;

  // Show container
  if (container) container.style.display = "block";

  if (scrapperSelectedNotStarted) {
    // Hide button and show message when scrapper is selected but not started
    downloadAllBtn.style.display = "none";
    if (message) message.style.display = "block";
    return;
  }

  // Show button and hide message (when scrapping is ongoing or not using scrapper)
  downloadAllBtn.style.display = "block";
  if (message) message.style.display = "none";

  const total = AppState.allDirectLinks.length;
  const done = AppState.downloadedURLs.length;
  const isDownloading = AppState.downloading.isDownloadingAll;

  // If scrapper is in batch downloading mode, show batch status
  if (
    AppState.scrapperDetails.scrappingStage === "ongoing" &&
    AppState.scrapperDetails.isAutoBatchDownloading
  ) {
    // Show simple progress: current item being downloaded out of total discovered
    // Cap the current item at total to avoid showing "item X of Y" where X > Y
    const currentItem = Math.min(done + 1, total);
    if (done >= total) {
      downloadAllBtn.textContent = `Downloaded: ${done} of ${total} items discovered`;
    } else {
      downloadAllBtn.textContent = `Downloading item ${currentItem} of ${total} items discovered`;
    }
    downloadAllBtn.disabled = true;
    return;
  }

  if (!total) {
    downloadAllBtn.textContent = "🚫 Nothing to download";
    downloadAllBtn.disabled = true;
  } else if (isDownloading) {
    if (done < total) {
      downloadAllBtn.textContent = `⏳ Downloading ${done} of ${total} Post${
        total !== 1 ? "s" : ""
      }…`;
      downloadAllBtn.disabled = true;
    } else {
      downloadAllBtn.textContent = `✅ Downloaded all ${total} Post${
        total !== 1 ? "s" : ""
      }`;
    }
  } else {
    downloadAllBtn.textContent = `⬇️ Download ${
      total > 1 ? "All " + total : "1"
    } Post${total !== 1 ? "s" : ""}`;
    downloadAllBtn.disabled = false;
  }
}

function createCurrentVideoButton() {
  const btn = document.createElement("button");
  btn.className = "ettpd-btn ettpd-current-video-btn";
  btn.textContent = "Download Current";
  btn.disabled = true;
  btn.onclick = () => {};
  btn.style.width = "100%";
  btn.style.marginBottom = "5px";
  btn.style.marginTop = "10px";
  return btn;
}

function updateCurrentVideoButton(btn, items = []) {
  if (!btn) return;
  const currentVideoId = document.location.pathname.split("/")[3];
  const currentMedia = items.find(
    (media) => currentVideoId && media.videoId === currentVideoId
  );

  if (!currentMedia) {
    btn.disabled = true;
    btn.textContent = "Download Current";
    btn.onclick = () => {};
    return;
  }

  btn.disabled = false;
  btn.textContent = currentMedia.isImage
    ? "Download Current Images"
    : "Download Current";

  if (currentMedia.isImage) {
    btn.onclick = (e) => downloadAllPostImagesHandler(e, currentMedia);
  } else {
    btn.onclick = async (e) => {
      e?.stopPropagation?.();
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = "⏳ Downloading...";
      try {
        await downloadSingleMedia(currentMedia);
        btn.textContent = "✅ Done!";
      } catch (err) {
        console.warn("Download current failed", err);
        btn.textContent = "❌ Failed";
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
        }, 1500);
      }
    };
  }
}

function createReportBugButton() {
  const reportBugBtn = document.createElement("button");
  reportBugBtn.className = "ettpd-btn ettpd-report-bug";
  reportBugBtn.innerText = "Report Bugs (Quick fix: Refresh/Login/Logout😉)";

  const reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.href = "https://forms.gle/Up1JaQJjxSBNYsZw5";
  reportBugBtnLink.appendChild(reportBugBtn);

  return reportBugBtnLink;
}
function formatCompactNumberWithTooltip(number) {
  const compact = Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);

  return `<span title="${number.toLocaleString()}">${compact}</span>`;
}

function getLeaderboardRankBadge(count, getUserCurrentTierFunction) {
  const tier = getUserCurrentTierFunction(count);
  return tier
    ? `${tier.emoji} <span class="ettpd-tier">${tier.name}</span>`
    : "";
}

function formatStatsLine(label, count, pos, getUserCurrentTierFunction) {
  const compact = formatCompactNumberWithTooltip(count);
  const badge = getLeaderboardRankBadge(count, getUserCurrentTierFunction);
  return `<div class="ettpd-stat-line-${pos}">${badge} <strong>${compact}</strong> ${label}</div>`;
}

export function showStatsSpan() {
  const wrapper = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
  if (!wrapper) return;

  const allTimeRecsCount =
    AppState.recommendationsLeaderboard.allTimeRecommendationsCount;
  const weeklyCount = AppState.leaderboard.weekDownloadsData?.count || 0;

  let newHTML;

  if (weeklyCount === allTimeRecsCount && allTimeRecsCount > 0) {
    newHTML = `
      ${formatStatsLine(
        "This week?!",
        allTimeRecsCount,
        "top",
        getUserRecommendationsCurrentTier
      )}
      <div class="ettpd-stat-line-bottom" title="You're in a downloading mood 😏">📦 Fresh streak</div>
    `;
  } else {
    newHTML = `
      ${formatStatsLine(
        "Downloads this week",
        weeklyCount,
        "top",
        getUserDownloadsCurrentTier
      )}
      ${formatStatsLine(
        "All time recommendations",
        allTimeRecsCount,
        "bottom",
        getUserRecommendationsCurrentTier
      )}
    `;
  }

  let existing = wrapper.querySelector(".ettpd-stats");

  if (existing && existing.innerHTML.trim() === newHTML.trim()) {
    return; // No need to update
  }

  if (existing) existing.remove();

  const span = document.createElement("span");
  span.className = "ettpd-span ettpd-stats";
  span.innerHTML = newHTML;
  span.onclick = showStatsPopUp;

  const link = span.querySelector("a");
  if (link) {
    link.addEventListener("click", (e) => e.stopPropagation());
  }

  wrapper.appendChild(span);
}

function createCreditsSpan() {
  const span = document.createElement("span");
  span.className = "ettpd-span ettpd-copyright";

  const year = new Date().getFullYear();
  span.innerHTML = `&copy; ${year} <a href="https://linktr.ee/aimuhire" target="_blank">buy me a coffee ☕</a> <strong>no refunds lol</strong>`;

  // Prevent link click from triggering the span click
  span.querySelector("a").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  span.onclick = hideDownloader;
  return span;
}

function createCloseButton() {
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.id = "ettpd-close";
  btn.onclick = () => {
    AppState.ui.isDownloaderClosed = true;
    localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "true");
    hideDownloader();
  };
  return btn;
}
export function createControlButtons(preferencesBox) {
  const container = document.createElement("div");
  container.className = "ettpd-settings-scrapper-controls-container";
  container.style.display = "flex";
  container.style.justifyContent = "space-between";

  // --- Settings Button ---
  const settingsBtn = createSettingsToggle(preferencesBox);
  settingsBtn.style.flex = "1";

  // --- User Posts Button ---
  const userPostsBtn = document.createElement("button");
  userPostsBtn.className = "ettpd-settings-toggle";
  userPostsBtn.textContent = "🥹 Scrapper";
  userPostsBtn.title =
    "Download/Archive likes, reposts, favorites or collections";
  userPostsBtn.style.flex = "1";

  container.appendChild(settingsBtn);
  container.appendChild(userPostsBtn);

  return { container, settingsBtn, userPostsBtn };
}

export function updateDownloaderList(items, hashToDisplay) {
  if (AppState.downloading.isActive || AppState.downloading.isDownloadingAll)
    return;
  const _id = DOM_IDS.DOWNLOADER_WRAPPER;
  let wrapper = document.getElementById(_id);
  let isNewWrapper = false;
  if (!wrapper) {
    wrapper = createDownloaderWrapper();
    isNewWrapper = true;
  }

  if (isNewWrapper || !wrapper._structureInitialized) {
    initializeDownloaderStructure(wrapper);
    wrapper._structureInitialized = true;
  }

  const refs = wrapper._ettpdRefs;
  refs?.updateVisibleBox?.();
  updateDownloadAllButtonState(refs?.downloadAllBtn, items);
  updateCurrentVideoButton(refs?.currentVideoBtn, items);

  if (items.length > 0) {
    AppState.recommendationsLeaderboard.newlyRecommendedUrls = items;
    try {
      setTimeout(() => {
        updateAllTimeRecommendationsLeaderBoard(hashToDisplay);
      }, 0);
    } catch (err) {
      console.warn("Failed to update leaderboard", err);
    }
  } else {
    AppState.recommendationsLeaderboard.newlyRecommendedUrls = [];
  }

  renderMediaList(refs?.list, items);

  if (isNewWrapper && !wrapper.dataset.statsInitialized) {
    setTimeout(async () => {
      showStatsSpan();
      await showScrapperControls();
    });
    wrapper.dataset.statsInitialized = "true";
  }

  AppState.displayedState.itemsHash = hashToDisplay;
  AppState.displayedState.path = window.location.pathname;

  return wrapper;
}

function initializeDownloaderStructure(wrapper) {
  const preferencesBox = createPreferencesBox();
  const {
    container: settingsAndScrapperBtnContainer,
    settingsBtn,
    userPostsBtn,
  } = createControlButtons(preferencesBox);

  const scrapperContainer = document.createElement("div");
  scrapperContainer.id = DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER;
  const downloadAllContainer = createDownloadAllButton();
  const downloadAllBtn = downloadAllContainer.querySelector(
    "#" + DOM_IDS.DOWNLOAD_ALL_BUTTON
  );
  const currentVideoBtn = createCurrentVideoButton();
  const reportBugBtn = createReportBugButton();
  const creditsSpan = createCreditsSpan();
  const list = document.createElement("ol");
  list.className = "ettpd-ol";
  const closeBtn = createCloseButton();

  wrapper.append(
    settingsAndScrapperBtnContainer,
    scrapperContainer,
    preferencesBox,
    downloadAllContainer,
    currentVideoBtn,
    reportBugBtn,
    creditsSpan,
    list,
    closeBtn
  );

  const refs = {
    preferencesBox,
    settingsBtn,
    userPostsBtn,
    scrapperContainer,
    downloadAllBtn,
    currentVideoBtn,
    list,
  };

  const updateVisibleBox = () => {
    if (AppState.ui.isScrapperBoxOpen && AppState.ui.isPreferenceBoxOpen) {
      AppState.ui.isScrapperBoxOpen = true;
      AppState.ui.isPreferenceBoxOpen = false;
    }

    if (scrapperContainer) {
      scrapperContainer.style.display = AppState.ui.isScrapperBoxOpen
        ? "flex"
        : "none";
    }

    if (preferencesBox) {
      preferencesBox.style.display = AppState.ui.isPreferenceBoxOpen
        ? "flex"
        : "none";
    }

    if (settingsBtn) {
      settingsBtn.classList.toggle(
        "ettpd-settings-open",
        AppState.ui.isPreferenceBoxOpen
      );
    }

    if (userPostsBtn) {
      userPostsBtn.classList.toggle(
        "ettpd-settings-open",
        AppState.ui.isScrapperBoxOpen
      );
    }

    // Update download all button state when scrapper box visibility changes
    if (downloadAllBtn) {
      updateDownloadAllButtonState(downloadAllBtn);
    }
  };

  refs.updateVisibleBox = updateVisibleBox;
  updateVisibleBox();

  userPostsBtn.onclick = (e) => {
    e.stopPropagation();
    AppState.ui.isPreferenceBoxOpen = false;
    AppState.ui.isScrapperBoxOpen = !AppState.ui.isScrapperBoxOpen;
    updateVisibleBox();
  };

  wrapper._ettpdRefs = refs;
}

function renderMediaList(listEl, items = []) {
  if (!listEl) return;

  if (!items.length) {
    listEl.replaceChildren(createEmptyListPlaceholder());
    listEl.style.setProperty("--list-length", "0");
    return;
  }

  const existingNodes = new Map(
    Array.from(listEl.children).map((child) => [child.dataset.videoId, child])
  );

  const fragment = document.createDocumentFragment();
  const orderedItems = [...items].reverse();

  orderedItems.forEach((media) => {
    const key = media.videoId || media.id;
    if (!key) return;
    const entryHash = getMediaEntryHash(media);

    let node = existingNodes.get(key);

    if (node && node.dataset.entryHash === entryHash) {
      existingNodes.delete(key);
    } else {
      if (node) {
        existingNodes.delete(key);
        node.remove();
      }
      node = buildMediaListItem(media);
      node.dataset.entryHash = entryHash;
    }

    node.dataset.videoId = key;
    fragment.appendChild(node);
  });

  existingNodes.forEach((node) => node.remove());

  listEl.replaceChildren(fragment);
  listEl.style.setProperty("--list-length", String(orderedItems.length));
}

function createEmptyListPlaceholder() {
  const li = document.createElement("li");
  li.className = "ettpd-li ettpd-empty";
  li.textContent = "No videos found to display 😔";
  return li;
}

function getMediaEntryHash(media) {
  const parts = [
    media.videoId || media.id || "",
    media.authorId || "",
    media.desc || "",
    media.downloaderHasLowConfidence ? "1" : "0",
    media.isAd ? "1" : "0",
    media.isImage
      ? `img:${(media.imagePostImages || []).join("|")}`
      : `vid:${media.url || ""}`,
  ];
  return parts.join("|");
}

function buildMediaListItem(media) {
  const item = document.createElement("li");
  item.className = "ettpd-li";
  item.dataset.videoId = media.videoId || media.id || "";

  const currentVideoId = document.location.pathname.split("/")[3];

  const textContainer = document.createElement("div");
  textContainer.className = "ettpd-text-container";

  const authorWrapper = document.createElement("div");
  authorWrapper.className = "ettpd-author-wrapper";

  if (currentVideoId && currentVideoId === media?.videoId) {
    const liveEmoji = document.createElement("span");
    liveEmoji.textContent = "▶️";
    liveEmoji.title = "Currently playing video";
    liveEmoji.className = "ettpd-emoji";
    authorWrapper.appendChild(liveEmoji);
  }

  if (media?.downloaderHasLowConfidence) {
    const lowConfidenceEmoji = document.createElement("span");
    lowConfidenceEmoji.textContent = "🤷‍♂️";
    lowConfidenceEmoji.title = "Low confidence data";
    lowConfidenceEmoji.className = "ettpd-emoji";
    authorWrapper.appendChild(lowConfidenceEmoji);
  }

  if (media?.isAd) {
    const adEmoji = document.createElement("span");
    adEmoji.textContent = "📣";
    adEmoji.title = "Sponsored or ad content";
    adEmoji.className = "ettpd-emoji";
    authorWrapper.appendChild(adEmoji);
  }

  const authorAnchor = document.createElement("a");
  authorAnchor.className = "ettpd-a ettpd-author-link";
  authorAnchor.target = "_blank";
  authorAnchor.href = `https://www.tiktok.com/@${media?.authorId}`;
  authorAnchor.innerText = media?.authorId
    ? `@${media.authorId}`
    : "Unknown Author";

  authorWrapper.appendChild(authorAnchor);

  const descSpan = document.createElement("span");
  descSpan.className = "ettpd-desc-span";
  const fullDesc = media?.desc || "";
  const shortDesc =
    fullDesc.length > 100 ? fullDesc.slice(0, 100) + "..." : fullDesc;
  let expanded = false;
  descSpan.innerText = shortDesc;
  descSpan.style.cursor = fullDesc.length > 100 ? "pointer" : "default";
  descSpan.style.textDecoration = fullDesc.length > 100 ? "underline" : "none";
  descSpan.title = fullDesc.length > 100 ? "Expandable" : "Description";
  descSpan.onclick = () => {
    expanded = !expanded;
    descSpan.innerText = expanded ? fullDesc : shortDesc;
  };

  textContainer.append(authorWrapper, descSpan);

  const downloadBtnHolder = document.createElement("div");
  downloadBtnHolder.className = "ettpd-download-btn-holder";

  if (media.isImage && Array.isArray(media.imagePostImages)) {
    const downloadAllBtnContainer = document.createElement("div");
    downloadAllBtnContainer.className = "ettpd-images-download-all-container";
    const downloadAllBtn = document.createElement("button");
    const tiktokBtnContainer = document.createElement("div");
    tiktokBtnContainer.className = "ettpd-download-btn ettpd-tiktok-btn";
    tiktokBtnContainer.title = "Open on TikTok";
    tiktokBtnContainer.onclick = (e) => {
      e.stopPropagation();
      if (media?.videoId && media?.authorId)
        window.open(
          `https://tiktok.com/@${media.authorId}/photo/${media.videoId}`,
          "_blank"
        );
    };
    const tiktokBtn = document.createElement("span");
    tiktokBtnContainer.appendChild(tiktokBtn);
    downloadAllBtnContainer.appendChild(tiktokBtnContainer);
    downloadAllBtn.textContent = "⬇️ Download All Images";
    downloadAllBtn.className = "ettpd-download-btn";
    downloadAllBtn.style.marginBottom = "10px";
    downloadAllBtn.style.marginTop = "5px";

    downloadAllBtn.onclick = (e) => downloadAllPostImagesHandler(e, media);
    downloadAllBtnContainer.appendChild(downloadAllBtn);
    downloadBtnHolder.appendChild(downloadAllBtnContainer);

    const imageList = document.createElement("ol");
    imageList.className = "ettpd-image-download-list";

    media.imagePostImages.forEach((url, i) => {
      const li = document.createElement("li");
      li.className = "ettpd-image-download-item";

      const openBtn = document.createElement("button");
      const openBtnSpan = document.createElement("span");
      openBtn.className = "ettpd-download-btn ettpd-view-btn";
      openBtn.onclick = (e) => {
        e.stopPropagation();
        if (url) window.open(url, "_blank");
      };
      openBtn.appendChild(openBtnSpan);

      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = "Download";
      downloadBtn.className = "ettpd-download-btn";

      downloadBtn.onclick = async (e) => {
        e.stopPropagation();

        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = "⏳ Downloading...";

        const delayBeforeStart = 600;
        const minDisplayAfter = 1000;
        const startedAt = Date.now();

        await new Promise((r) => setTimeout(r, delayBeforeStart));

        try {
          await downloadSingleMedia(media, { imageIndex: i });

          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, minDisplayAfter - elapsed);

          setTimeout(() => {
            downloadBtn.textContent = "✅ Done!";
            setTimeout(() => {
              downloadBtn.textContent = originalText;
            }, 3000);
          }, remaining);
        } catch (err) {
          console.error("Image download failed:", err);
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, minDisplayAfter - elapsed);

          setTimeout(() => {
            downloadBtn.textContent = "❌ Failed!";
            setTimeout(() => {
              downloadBtn.textContent = originalText;
            }, 3000);
          }, remaining);
        }
      };

      li.append(openBtn, downloadBtn);

      imageList.appendChild(li);
    });

    downloadBtnHolder.appendChild(imageList);
  } else {
    const tiktokBtnContainer = document.createElement("div");
    tiktokBtnContainer.className = "ettpd-download-btn ettpd-tiktok-btn";
    tiktokBtnContainer.title = "Open on TikTok";
    const tiktokBtn = document.createElement("span");

    tiktokBtn.onclick = (e) => {
      e.stopPropagation();
      if (media?.videoId && media?.authorId)
        window.open(
          `https://tiktok.com/@${media.authorId}/video/${media.videoId}`,
          "_blank"
        );
    };
    tiktokBtnContainer.appendChild(tiktokBtn);
    const viewBtnContainer = document.createElement("div");
    viewBtnContainer.className = "ettpd-download-btn ettpd-view-btn";
    viewBtnContainer.title = "Open Direct Link";
    const viewBtn = document.createElement("span");
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      if (media?.url) window.open(media.url, "_blank");
    };
    viewBtnContainer.appendChild(viewBtn);

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.className = "ettpd-download-btn";

    downloadBtn.onclick = async (e) => {
      e.stopPropagation();

      const originalText = downloadBtn.textContent;
      downloadBtn.textContent = "⏳ Downloading...";
      const delayBeforeStart = 600;
      const minDisplayAfter = 1000;
      const startedAt = Date.now();

      await new Promise((r) => setTimeout(r, delayBeforeStart));

      try {
        await downloadSingleMedia(media);

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minDisplayAfter - elapsed);

        setTimeout(() => {
          downloadBtn.textContent = "✅ Done!";
          setTimeout(() => {
            downloadBtn.textContent = originalText;
          }, 3000);
        }, remaining);
      } catch (err) {
        console.error("Download failed:", err);
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minDisplayAfter - elapsed);

        setTimeout(() => {
          downloadBtn.textContent = "❌ Failed!";
          setTimeout(() => {
            downloadBtn.textContent = originalText;
          }, 3000);
        }, remaining);
      }
    };

    const holderEl = document.createElement("div");
    holderEl.className = "ettpd-download-btns-container";
    holderEl.append(tiktokBtnContainer, viewBtnContainer, downloadBtn);
    downloadBtnHolder.append(holderEl);
  }

  item.append(textContainer, downloadBtnHolder);
  return item;
}

function makeElementDraggable(wrapper, handle) {
  console.log(" AppState.ui.isDragging 12orubt init", AppState.ui.isDragging);

  let offsetX = 0,
    offsetY = 0;

  // Start dragging
  handle.addEventListener("mousedown", (e) => {
    console.log(
      " AppState.ui.isDragging 12orubt mousedown",
      AppState.ui.isDragging
    );

    AppState.ui.isDragging = true;
    console.log(
      " AppState.ui.isDragging 12orubt mousedown 2",
      AppState.ui.isDragging
    );
    const rect = wrapper.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = "none";
  });

  //Dragging in motion
  document.addEventListener("mousemove", (e) => {
    if (
      localStorage.getItem(STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION) !==
      AppState.ui.live_ETTPD_CUSTOM_POS
    ) {
      // Persist location:
      AppState.ui.downloaderPositionType = "custom";
      localStorage.setItem(
        STORAGE_KEYS.DOWNLOADER_POSITION_TYPE,
        AppState.ui.downloaderPositionType
      );
      localStorage.setItem(
        STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION,
        AppState.ui.live_ETTPD_CUSTOM_POS
      );
    }

    if (!AppState.ui.isDragging) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const wrapperRect = wrapper.getBoundingClientRect();

    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    newLeft = Math.max(0, Math.min(viewportWidth - wrapperRect.width, newLeft));
    newTop = Math.max(0, Math.min(viewportHeight - wrapperRect.height, newTop));

    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
    wrapper.style.bottom = "auto";
    wrapper.style.right = "auto";
    AppState.ui.live_ETTPD_CUSTOM_POS = JSON.stringify({
      left: wrapperRect.left,
      top: wrapperRect.top,
    });
  });

  // Stop dragging
  document.addEventListener("mouseup", () => {
    AppState.ui.isDragging = false;
    document.body.style.userSelect = "";
  });
}

function makeShowButtonDraggable(button) {
  let offsetX = 0,
    offsetY = 0;
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;

  // Start dragging
  button.addEventListener("mousedown", (e) => {
    isDragging = true;
    hasMoved = false;
    const rect = button.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    startX = e.clientX;
    startY = e.clientY;
    document.body.style.userSelect = "none";
    button.style.cursor = "grabbing";
    button.classList.add("ettpd-show-dragging");
    // Store drag state on button for click handler
    button.dataset.wasDragging = "false";
  });

  // Function to constrain button to viewport
  const constrainToViewport = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const buttonRect = button.getBoundingClientRect();

    // Get current position
    let currentLeft = buttonRect.left;
    let currentTop = buttonRect.top;

    // Ensure button is fully visible within viewport
    const minLeft = 0;
    const maxLeft = viewportWidth - buttonRect.width;
    const minTop = 0;
    const maxTop = viewportHeight - buttonRect.height;

    // Constrain position
    currentLeft = Math.max(minLeft, Math.min(maxLeft, currentLeft));
    currentTop = Math.max(minTop, Math.min(maxTop, currentTop));

    // Apply constrained position
    button.style.left = `${currentLeft}px`;
    button.style.top = `${currentTop}px`;
    button.style.bottom = "auto";
    button.style.right = "auto";

    return { left: currentLeft, top: currentTop };
  };

  // Dragging in motion - optimized for responsiveness
  const handleMouseMove = (e) => {
    if (!isDragging) return;

    // Mark as moved immediately for better responsiveness
    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);
    if (deltaX > 2 || deltaY > 2) {
      hasMoved = true;
      button.dataset.wasDragging = "true";
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const buttonRect = button.getBoundingClientRect();

    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Constrain to viewport bounds - ensure button never goes offscreen
    const minLeft = 0;
    const maxLeft = viewportWidth - buttonRect.width;
    const minTop = 0;
    const maxTop = viewportHeight - buttonRect.height;

    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
    newTop = Math.max(minTop, Math.min(maxTop, newTop));

    // Update position immediately for responsive dragging
    button.style.left = `${newLeft}px`;
    button.style.top = `${newTop}px`;
    button.style.bottom = "auto";
    button.style.right = "auto";

    // Throttle localStorage saves to avoid performance issues
    if (!button._savePositionTimeout) {
      button._savePositionTimeout = setTimeout(() => {
        const position = JSON.stringify({ left: newLeft, top: newTop });
        localStorage.setItem(STORAGE_KEYS.SHOW_BUTTON_POSITION, position);
        button._savePositionTimeout = null;
      }, 100);
    }
  };

  // Ensure button stays in viewport on window resize
  const handleResize = () => {
    if (button && button.parentElement) {
      constrainToViewport();
      const pos = constrainToViewport();
      localStorage.setItem(
        STORAGE_KEYS.SHOW_BUTTON_POSITION,
        JSON.stringify(pos)
      );
    }
  };

  window.addEventListener("resize", handleResize);

  document.addEventListener("mousemove", handleMouseMove);

  // Stop dragging
  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = "";
      button.style.cursor = "grab";
      button.classList.remove("ettpd-show-dragging");

      // Save final position immediately
      if (button._savePositionTimeout) {
        clearTimeout(button._savePositionTimeout);
        button._savePositionTimeout = null;
      }
      const buttonRect = button.getBoundingClientRect();
      const position = JSON.stringify({
        left: buttonRect.left,
        top: buttonRect.top,
      });
      localStorage.setItem(STORAGE_KEYS.SHOW_BUTTON_POSITION, position);

      // Reset after a short delay
      setTimeout(() => {
        button.dataset.wasDragging = "false";
      }, 100);
    }
  };

  document.addEventListener("mouseup", handleMouseUp);

  // Store cleanup on button for later removal if needed
  button._cleanupDraggable = () => {
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };
}

// Function to reset show button position to default
export function resetShowButtonPosition() {
  // Remove saved position from localStorage
  localStorage.removeItem(STORAGE_KEYS.SHOW_BUTTON_POSITION);

  // If button exists, reset its position
  const showBtn = document.getElementById(DOM_IDS.SHOW_DOWNLOADER);
  if (showBtn) {
    showBtn.style.left = "auto";
    showBtn.style.top = "auto";
    showBtn.style.bottom = "50px";
    showBtn.style.right = "20px";
  }
}

export function hideDownloader() {
  document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER)?.remove();
  if (document.getElementById(DOM_IDS.SHOW_DOWNLOADER)) return;

  const showBtn = document.createElement("button");
  showBtn.id = DOM_IDS.SHOW_DOWNLOADER;
  showBtn.className = "ettpd-show-btn";

  // Create SVG download icon
  const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgIcon.setAttribute("width", "16");
  svgIcon.setAttribute("height", "16");
  svgIcon.setAttribute("viewBox", "0 0 24 24");
  svgIcon.setAttribute("fill", "none");
  svgIcon.setAttribute("stroke", "currentColor");
  svgIcon.setAttribute("stroke-width", "2");
  svgIcon.setAttribute("stroke-linecap", "round");
  svgIcon.setAttribute("stroke-linejoin", "round");
  svgIcon.style.verticalAlign = "middle";
  svgIcon.style.marginRight = "4px";

  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
  svgIcon.appendChild(path1);

  const polyline = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline"
  );
  polyline.setAttribute("points", "7 10 12 15 17 10");
  svgIcon.appendChild(polyline);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "12");
  line.setAttribute("y1", "15");
  line.setAttribute("x2", "12");
  line.setAttribute("y2", "3");
  svgIcon.appendChild(line);

  // Set button content - small text with icon
  showBtn.appendChild(svgIcon);
  const textSpan = document.createElement("span");
  textSpan.textContent = "Open";
  showBtn.appendChild(textSpan);

  // Apply theme class
  if (getResolvedThemeMode() === "dark") {
    showBtn.classList.add("ettpd-theme-dark");
  }

  // Restore saved position and ensure it's within viewport
  const savedPosition = localStorage.getItem(STORAGE_KEYS.SHOW_BUTTON_POSITION);
  if (savedPosition) {
    try {
      const pos = JSON.parse(savedPosition);
      if (pos.left != null && pos.top != null) {
        // Ensure position is within viewport bounds
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        // We'll measure the button after it's added to DOM, but set initial position
        showBtn.style.left = `${pos.left}px`;
        showBtn.style.top = `${pos.top}px`;
        showBtn.style.bottom = "auto";
        showBtn.style.right = "auto";

        // After button is added to DOM, constrain it to viewport
        setTimeout(() => {
          const buttonRect = showBtn.getBoundingClientRect();
          const minLeft = 0;
          const maxLeft = viewportWidth - buttonRect.width;
          const minTop = 0;
          const maxTop = viewportHeight - buttonRect.height;

          let constrainedLeft = Math.max(minLeft, Math.min(maxLeft, pos.left));
          let constrainedTop = Math.max(minTop, Math.min(maxTop, pos.top));

          // Only update if position was constrained
          if (constrainedLeft !== pos.left || constrainedTop !== pos.top) {
            showBtn.style.left = `${constrainedLeft}px`;
            showBtn.style.top = `${constrainedTop}px`;
            localStorage.setItem(
              STORAGE_KEYS.SHOW_BUTTON_POSITION,
              JSON.stringify({
                left: constrainedLeft,
                top: constrainedTop,
              })
            );
          }
        }, 0);
      }
    } catch (e) {
      console.warn("Failed to parse saved button position", e);
    }
  }

  // Click handler - check if dragging occurred
  showBtn.addEventListener("click", (e) => {
    // Small delay to check if dragging occurred
    setTimeout(() => {
      if (showBtn.dataset.wasDragging !== "true") {
        // Check if extension is enabled before showing downloader
        if (!isExtensionEnabledSync()) {
          // Extension is disabled, show message
          alert(
            "Extension is disabled. Please enable it from the extension popup to use the downloader."
          );
          return;
        }

        localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "false");
        AppState.ui.isDownloaderClosed = false;
        AppState.ui.isPreferenceBoxOpen = false;
        document.getElementById(DOM_IDS.SHOW_DOWNLOADER)?.remove();
        displayFoundUrls({ forced: true });
      }
    }, 50);
  });

  // Make draggable
  makeShowButtonDraggable(showBtn);

  // Make draggable
  makeShowButtonDraggable(showBtn);

  document.body?.appendChild(showBtn);
}

export function showRateUsPopUpLegacy() {
  if (!shouldShowRatePopupLegacy()) return;
  AppState.ui.isRatePopupOpen = true;
  hideDownloader();
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  });

  const box = document.createElement("div");
  box.style.position = "fixed";
  box.style.top = "0";
  box.style.left = "0";
  box.style.width = "100%";
  box.style.height = "100%";
  box.style.zIndex = "999";
  box.style.backgroundColor = "rgba(31, 26, 26, 0.5)";
  box.innerHTML = `
  <div style="
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    max-width: 90%;
    background-color: #ffffff;
    color: #333333;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    font-family: Arial, sans-serif;
    text-align: center;
  ">
    <h2 style="margin-bottom: 15px; font-size: 1.5em; color: #1da1f2;">Download Complete! 🎉</h2>
    <p style="margin-bottom: 20px; font-size: 1em; line-height: 1.5; color: #555555;">
      Your video has been successfully downloaded! 🎥<br>
      We'd love your support—rate us 5 ⭐ on the Chrome Web Store to help us grow! 🥰
    </p>
    <a
      href="https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg"
      target="_blank"
      style="
        display: inline-block;
        background-color: #1da1f2;
        color: white;
        padding: 12px 20px;
        font-size: 1em;
        border-radius: 8px;
        text-decoration: none;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: background-color 0.3s ease;
      "
      onmouseover="this.style.backgroundColor='#0a84d6';"
      onmouseout="this.style.backgroundColor='#1da1f2';"
    >
      Rate Now
    </a>
  </div>
`;
  overlay.appendChild(box);

  overlay.onclick = () => {
    AppState.ui.isRatePopupOpen = false;

    overlay.remove();
  };
  AppState.rateDonate.lastShownAt = Date.now();
  AppState.rateDonate.shownCount += 1;
  localStorage.setItem(
    STORAGE_KEYS.RATE_DONATE_DATA,
    JSON.stringify(AppState.rateDonate)
  );
  document.body.appendChild(overlay);
}

export function showStatsPopUp() {
  if (AppState.downloading.isDownloadingAll || AppState.downloading.isActive) {
    return showAlertModal("Wait for the download to be over or refresh 🙂");
  }

  if (AppState.downloadedURLs.length || AppState.sessionHasConfirmedDownloads) {
    showCelebration("tier", "", AppState.downloadedURLs.length);
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "ettpd-tab-content-wrapper";
  contentWrapper.classList.add("ettpd-stats-modal");

  const tabNav = document.createElement("div");
  tabNav.className = "ettpd-tab-nav";

  const tabs = [
    { key: "downloads", label: "⬇️ Downloads" },
    { key: "recommendations", label: "📣 Recommendations" },
  ];

  const tabButtons = tabs.map(({ key, label }) => {
    const btn = document.createElement("button");
    btn.className = "ettpd-tab-btn";
    btn.textContent = label;
    btn.dataset.key = key;
    return btn;
  });

  tabButtons.forEach((btn) => tabNav.appendChild(btn));

  const content = document.createElement("div");
  content.className = "ettpd-stats-modal-body";

  const renderTab = (tabKey) => {
    let allTimeList, weeklyList, allTimeCount, weeklyCount, tierLabel, tier;

    if (tabKey === "downloads") {
      allTimeList = getAllTimeLeaderBoardList();
      weeklyList = getWeeklyLeaderBoardList();
      allTimeCount = AppState.leaderboard.allTimeDownloadsCount;
      weeklyCount = AppState.leaderboard.weekDownloadsData.count;
      tier = getUserDownloadsCurrentTier(allTimeCount);
    } else {
      allTimeList = getAllTimeRecommendationsLeaderBoardList();
      weeklyList = getWeeklyRecommendationsLeaderBoardList();
      allTimeCount =
        AppState.recommendationsLeaderboard.allTimeRecommendationsCount || 0;
      weeklyCount =
        AppState.recommendationsLeaderboard.weekRecommendationsData.count || 0;
      tier = getUserRecommendationsCurrentTier(allTimeCount);
    }

    const totalCount = allTimeCount;

    tierLabel = `<span class="ettpd-tier">${tier.emoji} ${tier.name}</span>`;

    const section = (label, list, count = 0) => {
      const itemsMarkup = list.length
        ? list
            .map((item, i) => {
              const username = item.username || "tiktok";
              return `
            <li class="ettpd-leaderboard-item">
              <div class="ettpd-leaderboard-rank">${i + 1}</div>
              <div class="ettpd-leaderboard-meta">
                <a class="ettpd-leaderboard-name" href="https://tiktok.com/@${username}" target="_blank" rel="noopener noreferrer">@${username}</a>
                <span class="ettpd-leaderboard-handle">tiktok.com/@${username}</span>
              </div>
              <div class="ettpd-leaderboard-count" title="${item.count.toLocaleString()}">
                ${formatCompactNumberWithTooltip(item.count)}
                <span class="ettpd-leaderboard-count-label">posts</span>
              </div>
            </li>`;
            })
            .join("")
        : `<li class="ettpd-leaderboard-empty">No entries yet</li>`;

      return `
        <section class="ettpd-stats-card">
          <div class="ettpd-stats-card__header">
            <div class="ettpd-stats-card__title">${label}</div>
            <div class="ettpd-stats-card__total" title="${count.toLocaleString()}">
              <span class="ettpd-total-label">Total</span>
              <span class="ettpd-total-value">${formatCompactNumberWithTooltip(
                count
              )}</span>
            </div>
          </div>
          <ol class="ettpd-leaderboard-list">
            ${itemsMarkup}
          </ol>
        </section>
      `;
    };

    const sameCount = weeklyCount === allTimeCount && allTimeCount > 0;

    const funMessage = sameCount
      ? `<div class="ettpd-stats-banner">You peaked this week 😮‍💨</div>`
      : "";

    content.innerHTML = `
    <div class="ettpd-summary-line black-text">
      You've ${
        tabKey === "downloads" ? "downloaded" : "been recommended"
      } <strong title="${totalCount.toLocaleString()}">${formatCompactNumberWithTooltip(
      totalCount
    )}</strong> posts. Level: ${tierLabel}
    </div>
    ${
      sameCount
        ? section("🔥 Weekly Top (also All Time)", weeklyList, weeklyCount) +
          funMessage
        : section("🔥 Weekly Top", weeklyList, weeklyCount) +
          section("🏆 All Time", allTimeList, allTimeCount)
    }
    <p class="alert ettpd-disclaimer">📌 Stats are local to your browser. You're in control. 🤝</p>
  `;
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.key);
    });
  });

  tabButtons[0].classList.add("active"); // default tab
  renderTab("downloads");

  const actionBtnContainer = document.createElement("div");
  actionBtnContainer.className = "ettpd-modal-buttons-container";

  const rateBtn = document.createElement("a");
  rateBtn.href =
    "https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg";
  rateBtn.target = "_blank";
  rateBtn.className = "ettpd-modal-button";
  rateBtn.textContent = "⭐ Rate Us";

  const coffeeBtn = document.createElement("a");
  coffeeBtn.href = "https://linktr.ee/aimuhire";
  coffeeBtn.target = "_blank";
  coffeeBtn.className = "ettpd-modal-button";
  coffeeBtn.textContent = "☕ Tip/Coffee Jar";

  const resetBtn = document.createElement("button");
  resetBtn.className = "ettpd-modal-button reset-leaderboard";
  resetBtn.textContent = "🧹 Reset";
  resetBtn.addEventListener("click", () => {
    const confirmed = confirm(
      "⚠️ This will wipe your local leaderboard stats (downloads + recommendations). Nothing else will be touched. Want to proceed with the reset?"
    );
    if (!confirmed) return;

    const doubleCheck = confirm(
      "🚨 Just making sure — this can't be undone. All your leaderboard stats will be gone. Still want to do it?"
    );
    if (!doubleCheck) return;

    // Correct keys to clear
    const keysToClear = [
      // Downloads
      STORAGE_KEYS.DOWNLOADS_ALL_TIME_COUNT,
      STORAGE_KEYS.DOWNLOADS_WEEKLY_DATA,
      STORAGE_KEYS.DOWNLOADS_LEADERBOARD_ALL_TIME,
      STORAGE_KEYS.DOWNLOADS_LEADERBOARD_WEEKLY,

      // Recommendations
      STORAGE_KEYS.RECOMMENDATIONS_ALL_TIME_COUNT,
      STORAGE_KEYS.RECOMMENDATIONS_WEEKLY_DATA,
      STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_ALL_TIME,
      STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_WEEKLY,

      // Tier progress
      STORAGE_KEYS.CURRENT_TIER_PROGRESS,
    ];

    keysToClear.forEach((key) => localStorage.removeItem(key));

    // Reset AppState (optional, depends on how tightly it's coupled)
    AppState.leaderboard.allTimeDownloadsCount = 0;
    AppState.leaderboard.weekDownloadsData = { weekId: "missing", count: 0 };
    AppState.recommendationsLeaderboard.allTimeRecommendationsCount = 0;
    AppState.recommendationsLeaderboard.weekRecommendationsData = {
      weekId: "missing",
      count: 0,
    };
    AppState.currentTierProgress = { downloads: 0, recommendations: 0 };

    showAlertModal("✅ All leaderboard data has been reset.");
    document.getElementById(DOM_IDS.MODAL_CONTAINER)?.remove();
    displayFoundUrls({ forced: true });
  });

  actionBtnContainer.appendChild(resetBtn);
  actionBtnContainer.appendChild(rateBtn);
  actionBtnContainer.appendChild(coffeeBtn);

  contentWrapper.appendChild(tabNav);
  contentWrapper.appendChild(content);

  createModal({
    children: [contentWrapper, actionBtnContainer],
    onClose: () => {},
  });
}

export function createModal({ children = [], onClose = null }) {
  const overlay = document.createElement("div");
  overlay.id = DOM_IDS.MODAL_CONTAINER;
  overlay.className = "ettpd-modal-overlay";
  overlay.classList.add(
    getResolvedThemeMode() === "dark"
      ? "ettpd-theme-dark"
      : "ettpd-theme-classic"
  );

  // === Container to hold both close btn and modal box ===
  const container = document.createElement("div");
  container.className = "ettpd-modal-box-container";

  // === Close Button ===
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.id = "ettpd-close";
  btn.setAttribute("aria-label", "Close modal");
  btn.classList.add("ettpd-modal-close");

  btn.onclick = () => {
    overlay.remove();
    if (typeof onClose === "function") onClose();
  };

  // === Scrollable content box ===
  const modal = document.createElement("div");
  modal.className = "ettpd-modal-box";

  children.forEach((child) => {
    if (typeof child === "string") {
      modal.insertAdjacentHTML("beforeend", child);
    } else if (child instanceof HTMLElement) {
      modal.appendChild(child);
    }
  });

  // Overlay background click closes modal
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (typeof onClose === "function") onClose();
    }
  };

  container.appendChild(btn);
  container.appendChild(modal);
  overlay.appendChild(container);
  document.body?.appendChild(overlay);
  return overlay;
}

export function showMorpheusRateUsPage() {
  AppState.ui.isRatePopupOpen = true;
  hideDownloader();
  showCelebration("mindblown");
  setTimeout(() => {
    createModalMorpheus({
      message: `<div class="ettpd-morpheus-message">
  You've just seen how good this downloader is.<br>
  Now it's your turn to support the mission.<br><br>
  <strong>Take the red pill ☕ — fuel us.<br>
  Take the blue pill ⭐ — rate us.</strong>
</div>`,
      redPillClick: (e, overlay) => {
        console.log("✅ User took the red pill — bought coffee.");
        window.open("https://linktr.ee/aimuhire", "_blank");
        AppState.rateDonate.lastShownAt = Date.now();
        AppState.rateDonate.lastDonatedAt = Date.now();
        localStorage.setItem(
          STORAGE_KEYS.RATE_DONATE_DATA,
          JSON.stringify(AppState.rateDonate)
        );
        overlay?.remove();
        if (typeof onClose === "function") onClose();
      },
      bluePillClick: (e, overlay) => {
        console.log("✅ User took the blue pill — rated us.");
        window.open(
          "https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg",
          "_blank"
        );
        AppState.rateDonate.lastShownAt = Date.now();
        AppState.rateDonate.lastRatedAt = Date.now();
        localStorage.setItem(
          STORAGE_KEYS.RATE_DONATE_DATA,
          JSON.stringify(AppState.rateDonate)
        );
        overlay?.remove();
        if (typeof onClose === "function") onClose();
      },
      onClose: (overlay) => {
        AppState.ui.isRatePopupOpen = false;
        overlay?.remove();
      },
    });

    AppState.rateDonate.lastShownAt = Date.now();
    AppState.rateDonate.shownCount += 1;
    localStorage.setItem(
      STORAGE_KEYS.RATE_DONATE_DATA,
      JSON.stringify(AppState.rateDonate)
    );
  }, 3500);
}

export function createModalMorpheus({
  message = "",
  onClose = null,
  redPillClick = () => {},
  bluePillClick = () => {},
} = {}) {
  const overlay = document.createElement("div");
  overlay.id = "ettpd-morpheus-overlay";
  overlay.className = "ettpd-modal-overlay morpheus-theme";
  overlay.classList.add(
    getResolvedThemeMode() === "dark"
      ? "ettpd-theme-dark"
      : "ettpd-theme-classic"
  );

  const modal = document.createElement("div");
  modal.className = "ettpd-morpheus-modal";

  const btn = document.createElement("button");
  btn.textContent = "x";
  btn.className = "ettpd-close-morpheus";
  btn.setAttribute("aria-label", "Close modal");
  btn.onclick = () => {
    overlay.remove();
    if (typeof onClose === "function") onClose();
  };

  // 📜 Message in the center
  const msg = document.createElement("div");
  msg.className = "ettpd-morpheus-message";
  msg.innerHTML =
    message ||
    `You take the blue pill… You wake up in your bed and believe whatever you want to believe.`;

  // 🔵 Blue pill button (right hand)
  const bluePill = document.createElement("button");
  bluePill.className = "ettpd-morpheus-pill blue-pill";
  bluePill.textContent = "🔵 Rate";
  bluePill.onclick = (e) => bluePillClick(e, overlay);

  // 🔴 Red pill button (left hand)
  const redPill = document.createElement("button");
  redPill.className = "ettpd-morpheus-pill red-pill";
  redPill.textContent = "🔴 Support";
  redPill.onclick = (e) => redPillClick(e, overlay);

  // 💊 Container for pill buttons
  const pillContainer = document.createElement("div");
  pillContainer.className = "ettpd-morpheus-pill-container";
  pillContainer.appendChild(redPill);
  pillContainer.appendChild(bluePill);

  modal.appendChild(btn);
  modal.appendChild(msg);
  modal.appendChild(pillContainer);

  overlay.appendChild(modal);
  document.body?.appendChild(overlay);
  return overlay;
}

export function createFilenameTemplateModal() {
  // Fetch saved user templates and built-in presets
  const templates = getSavedTemplates();
  const presetTemplates = getPresetTemplates();

  // Currently applied template from state
  const savedTemplateObj = AppState.downloadPreferences.fullPathTemplate || {};
  const savedFullTemplate = savedTemplateObj.template || "";
  const savedLabel = savedTemplateObj.label || "";

  // Main container
  const layout = document.createElement("div");
  layout.className = "layout";
  layout.classList.add("ettpd-template-modal");

  // Collapsible instructions
  const knownFields = [
    "videoId",
    "authorUsername",
    "authorNickname",
    "desc",
    "createTime",
    "downloadTime",
    "musicTitle",
    "musicAuthor",
    "views",
    "duration",
    "hashtags",
    "sequenceNumber",
    "ad",
    "mediaType",
    "tabName",
  ];

  const instructions = document.createElement("div");
  instructions.className = "ettpd-template-instructions";

  const tabNav = document.createElement("div");
  tabNav.className = "ettpd-template-tabs";

  const tabContent = document.createElement("div");
  tabContent.className = "ettpd-template-panel";

  const tabConfig = [
    {
      key: "guide",
      label: "Guide",
      body: `
        <p class="ettpd-template-subtitle">Use <code>{field}</code>, <code>{field|fallback}</code>, or <code>{field:maxLen|fallback}</code>. Defaults use <code>missing-{field}</code>. Click to see the full playbook.</p>
        <details class="ettpd-template-accordion">
          <summary style="cursor: pointer;">Read more</summary>
          <ul class="ettpd-template-list">
            <li><strong>Extensions</strong>: auto-added (<code>.jpeg</code> / <code>.mp4</code>).</li>
            <li><strong>Numbering</strong>: <code>{sequenceNumber}</code> only on multi-image unless forced with <code>{sequenceNumber|required}</code>.</li>
            <li><strong>Length</strong>: trim with <code>{desc:40|no-desc}</code> or any field.</li>
            <li><strong>Paths</strong>: keep them relative; no leading <code>/</code> or <code>..</code>.</li>
            <li><strong>Ads & media</strong>: <code>{ad}</code> adds “ad”; <code>{mediaType}</code> is <em>image</em>/<em>video</em>.</li>
            <li><strong>Context</strong>: <code>{tabName}</code> follows the scrapper tab (Video, Reposts, Liked, Favorited).</li>
          </ul>
        </details>
      `,
    },
    {
      key: "fields",
      label: "Supported fields",
      body: `
        <p><strong>Fields:</strong></p>
        <code class="ettpd-template-code">${knownFields.join(", ")}</code>
        <div class="ettpd-template-grid">
          <div><strong>{videoId}</strong><span>Unique post ID</span></div>
          <div><strong>{authorUsername}</strong><span>@handle of the creator</span></div>
          <div><strong>{authorNickname}</strong><span>Display name when available</span></div>
          <div><strong>{desc}</strong><span>Caption/description text</span></div>
          <div><strong>{createTime}</strong><span>Original post timestamp</span></div>
          <div><strong>{downloadTime}</strong><span>When you downloaded it</span></div>
          <div><strong>{musicTitle}</strong><span>Track title</span></div>
          <div><strong>{musicAuthor}</strong><span>Track artist</span></div>
          <div><strong>{views}</strong><span>View count if available</span></div>
          <div><strong>{duration}</strong><span>Length in seconds</span></div>
          <div><strong>{hashtags}</strong><span>Comma-separated tags</span></div>
          <div><strong>{sequenceNumber}</strong><span>Index for multi-assets</span></div>
          <div><strong>{ad}</strong><span>“ad” when marked as ad</span></div>
          <div><strong>{mediaType}</strong><span>image or video</span></div>
          <div><strong>{tabName}</strong><span>Video/Reposts/Liked/Favorited</span></div>
        </div>
      `,
    },
  ];

  const renderTab = (key) => {
    tabButtons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.key === key)
    );
    const section = tabConfig.find((t) => t.key === key);
    tabContent.innerHTML = section?.body || "";
  };

  const tabButtons = tabConfig.map((tab) => {
    const btn = document.createElement("button");
    btn.className = "ettpd-template-tab";
    btn.dataset.key = tab.key;
    btn.textContent = tab.label;
    btn.onclick = () => renderTab(tab.key);
    tabNav.appendChild(btn);
    return btn;
  });

  instructions.appendChild(tabNav);
  instructions.appendChild(tabContent);
  renderTab("guide");

  // Dropdown for both user templates and presets
  const comboSelect = document.createElement("select");
  comboSelect.className = "ettpd-template-select";

  // Default placeholder option
  const defaultOpt = document.createElement("option");
  defaultOpt.text = "⚙️ Select template...";
  defaultOpt.value = "";
  comboSelect.appendChild(defaultOpt);

  // Add user-saved templates
  templates.forEach((t, i) => {
    const opt = document.createElement("option");
    opt.value = `user-${i}`;
    opt.text = t.label === savedLabel ? `(Active) ${t.label}` : t.label;
    if (t.label === savedLabel) opt.selected = true;
    comboSelect.appendChild(opt);
  });

  // Divider before presets
  if (presetTemplates.length) {
    const sep = document.createElement("option");
    sep.text = "-- Presets --";
    sep.disabled = true;
    comboSelect.appendChild(sep);

    // Add built-in presets
    presetTemplates.forEach((p, i) => {
      const opt = document.createElement("option");
      opt.value = `preset-${i}`;
      opt.text = p.label === savedLabel ? `(Active) ${p.label}` : p.label;
      if (p.label === savedLabel) opt.selected = true;
      opt.title = p.example;
      comboSelect.appendChild(opt);
    });
  }

  // Inputs for label and template
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.name = "label";
  labelInput.placeholder = "Template name (e.g. Default, ShortDesc)";
  labelInput.value = savedLabel;
  labelInput.className = "ettpd-modal-input";

  const inputPathTemplate = document.createElement("input");
  inputPathTemplate.type = "text";
  inputPathTemplate.name = "template";
  inputPathTemplate.placeholder =
    "downloads/{authorUsername}/{videoId}-{desc|no-desc}.mp4";
  inputPathTemplate.value = savedFullTemplate;
  inputPathTemplate.className = "ettpd-modal-input";

  const error = document.createElement("div");
  error.className = "ettpd-modal-error";

  const preview = document.createElement("div");
  preview.className = "ettpd-template-preview";

  const activeFullPathTemplate = document.createElement("div");
  activeFullPathTemplate.className = "ettpd-template-active";
  if (
    savedLabel &&
    savedLabel == AppState.downloadPreferences.fullPathTemplate?.label
  ) {
    activeFullPathTemplate.textContent = `Active template: ${savedLabel}`;
  }

  const presetExample = document.createElement("code");
  presetExample.style =
    "font-size:12px;display:block;margin-top:4px;color:#888;";

  // Buttons
  const saveBtn = document.createElement("button");
  saveBtn.className = "ettpd-pref-btn";
  saveBtn.textContent = "💾 Save & Apply";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "ettpd-pref-btn danger";
  deleteBtn.textContent = "🗑️ Delete Template";
  deleteBtn.style = "margin-right:15px;";

  // Utility: sanitize
  const sanitize = (val) =>
    (val ?? "")
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 100);

  // Validator for the template path
  const validatePathTemplate = (tpl) => {
    const errs = [];
    if (tpl.startsWith("/") && !tpl.startsWith("@/@"))
      errs.push("Path must be relative (no leading / or drive letters)");
    if (/\.\.|^[a-zA-Z]:/.test(tpl))
      errs.push("No '..' or drive letters allowed");
    const tokenRe = /\{(\w+)(\|[^}]+)?\}/g;
    let m;
    while ((m = tokenRe.exec(tpl))) {
      if (!knownFields.includes(m[1])) errs.push(`Unknown field: ${m[1]}`);
    }
    return errs;
  };

  // Preview logic
  function renderPreviewAndErrors() {
    const tpl = inputPathTemplate.value.trim();
    const errors = validatePathTemplate(tpl);

    if (errors.length) {
      error.textContent = "⚠️ " + errors.join("; ");
      preview.textContent = "";
      return;
    }

    error.textContent = "";

    const sample = {
      videoId: "abc123",
      authorId: "user456",
      authorUsername: "coolguy",
      authorNickname: "coolguy",
      desc: "My best post ever that should be trimmed",
      createTime: "2020-08-23_1201",
      downloadTime: "2025-08-23_1201",
      musicTitle: "Chill Vibes",
      musicAuthor: "DJ Flow",
      views: "10234",
      duration: "30",
      hashtags: [{ name: "fun" }, { name: "relax" }],
      isAd: true,
      isImage: false,
      imagePostImages: ["img1", "img2", "img3", "img4"],
      tabName: "Reposts",
    };

    const sanitize = (val) =>
      (val ?? "")
        .toString()
        .replace(/[^\p{L}\p{N}_-]+/gu, "-")
        .slice(0, 100);

    const getFieldMaxLength = (fieldName) => {
      const regex = new RegExp(`\\{${fieldName}:(\\d+)`);
      const match = tpl.match(regex);
      return match ? Number(match[1]) : undefined;
    };

    const sequenceNumber = 4;
    const isMultiImage = sample.imagePostImages?.length > 1;
    const descMaxLen = getFieldMaxLength("desc");
    const isDescMaxLenDefined = descMaxLen !== undefined;

    const fieldValues = {
      videoId: sanitize(sample.videoId),
      authorUsername: sanitize(sample.authorId),
      authorNickname: sanitize(sample.authorNickname),
      desc: sanitize(
        sample.desc?.slice(0, isDescMaxLenDefined ? descMaxLen : 40)
      ),
      createTime: sample.createTime,
      musicTitle: sanitize(sample.musicTitle),
      musicAuthor: sanitize(sample.musicAuthor),
      views: sanitize(sample.views),
      duration: sanitize(sample.duration),
      hashtags: (sample.hashtags || [])
        .map((tag) => sanitize(tag.name || tag))
        .join("-"),
      downloadTime: sample.downloadTime,
      isAd: false,
      isImage: false,
    };

    const replaced = applyTemplate(tpl, fieldValues, {
      sequenceNumber,
      isMultiImage,
    });
    let cleaned = cleanupPath(replaced);

    if (cleaned.startsWith("@/")) {
      cleaned = cleaned.replace("@", DOWNLOAD_FOLDER_DEFAULT);
    }
    preview.textContent = `Example: ${cleaned}.mp4`;
  }

  comboSelect.onchange = () => {
    const val = comboSelect.value;
    if (!val) return;

    const [type, idxStr] = val.split("-");
    const idx = parseInt(idxStr, 10);

    const currentUserTemplates = getSavedTemplates();
    const currentPresetTemplates = getPresetTemplates();

    let selected;
    if (type === "user") {
      selected = currentUserTemplates[idx];
      deleteBtn.disabled = false;
    } else {
      selected = currentPresetTemplates[idx];
      deleteBtn.disabled = false;
    }

    if (!selected) {
      console.warn("Invalid template selection:", val);
      return;
    }

    inputPathTemplate.value = selected.template || selected.fullPathTemplate;
    labelInput.value = selected.label;
    activeFullPathTemplate.textContent = `Selected: ${selected.label}`;
    presetExample.textContent = selected.example
      ? `e.g. ${selected.example}`
      : "";

    renderPreviewAndErrors();
  };

  renderPreviewAndErrors();
  // Feedback container
  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "ettpd-reset-feedback";
  feedbackContainer.style.textAlign = "center";
  // Utility function to show feedback
  function showFeedback(text) {
    feedbackContainer.innerHTML = `<span>Applying...</span>`;
    layout.appendChild(feedbackContainer);
    // Then show the actual message after displayFoundUrls finishes
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        feedbackContainer.innerHTML = `<span>${text}</span>`;
        // Then remove the message after a short delay
        setTimeout(() => {
          feedbackContainer.remove();
          displayFoundUrls({ forced: true });
          resolve();
        }, 1500);
      }, 1500); // slight delay to allow DOM update to complete
    });
  }

  // Save & Apply
  saveBtn.onclick = async () => {
    renderPreviewAndErrors();
    if (error.textContent) return showAlertModal("Fix errors before saving.");
    if (!labelInput.value.trim()) return showAlertModal("Please enter a name.");
    const newTpl = {
      label: labelInput.value.trim(),
      template: inputPathTemplate.value.trim(),
    };
    const updated = templates.filter((t) => t.label !== newTpl.label);
    updated.push(newTpl);
    // First update the state, since it's needed by saveTemplates
    AppState.downloadPreferences.fullPathTemplate = newTpl;
    saveTemplates(updated);
    saveSelectedTemplate();
    activeFullPathTemplate.textContent = `Applied & saved: ${newTpl.template}`;
    // Remove old options
    comboSelect.querySelectorAll("option").forEach((opt) => opt.remove());

    // Rebuild dropdown options with updated templates and current selection
    const updatedTemplates = getSavedTemplates();
    const rebuilt = document.createDocumentFragment();

    const defaultOpt = document.createElement("option");
    defaultOpt.text = "⚙️ Select template...";
    defaultOpt.value = "";
    rebuilt.appendChild(defaultOpt);

    updatedTemplates.forEach((t, i) => {
      const opt = document.createElement("option");
      opt.value = `user-${i}`;
      opt.text = t.label === newTpl.label ? `(Active) ${t.label}` : t.label;
      if (t.label === newTpl.label) opt.selected = true;
      rebuilt.appendChild(opt);
    });

    if (presetTemplates.length) {
      const sep = document.createElement("option");
      sep.text = "-- Presets --";
      sep.disabled = true;
      rebuilt.appendChild(sep);

      presetTemplates.forEach((p, i) => {
        const opt = document.createElement("option");
        opt.value = `preset-${i}`;
        opt.text = p.label === newTpl.label ? `(Active) ${p.label}` : p.label;
        if (p.label === newTpl.label) opt.selected = true;
        opt.title = p.example;
        rebuilt.appendChild(opt);
      });
    }

    comboSelect.appendChild(rebuilt);

    await showFeedback("✅ Template saved and applied!");
  };

  // Delete Handler
  deleteBtn.onclick = async () => {
    const val = comboSelect.value;
    if (!val) return showAlertModal("Select a user template to delete.");
    const [type, idxStr] = val.split("-");
    const idx = parseInt(idxStr, 10);
    if (type !== "user") {
      return showAlertModal("Cannot delete built-in presets.");
    }
    const removed = templates.splice(idx, 1)[0];
    saveTemplates(templates);
    comboSelect.querySelector(`option[value=\"${type}-${idx}\"]`).remove();
    labelInput.value = "";
    inputPathTemplate.value = "";
    activeFullPathTemplate.textContent = "";
    await showFeedback(`🗑️ Deleted template '${removed.label}'.`);
  };

  // Wire input events
  const inputsLabel = document.createElement("span");
  inputsLabel.style.cssText = `
    color: var(--ettpd-text-primary, #333);
    text-align: left;
    display: block;
    margin-bottom: 5px;
  `;

  inputsLabel.textContent = "🤤 Create your own or copy existing template!";
  inputPathTemplate.addEventListener("input", renderPreviewAndErrors);
  inputPathTemplate.className = "ettpd-modal-input";

  labelInput.addEventListener("input", () => (deleteBtn.disabled = false));

  // Create a flex container for template label and buttons (same line)
  const templateActionsContainer = document.createElement("div");
  templateActionsContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-top: 10px;
    flex-wrap: wrap;
  `;
  templateActionsContainer.appendChild(activeFullPathTemplate);
  templateActionsContainer.appendChild(deleteBtn);
  templateActionsContainer.appendChild(saveBtn);

  // Assemble UI
  layout.append(
    instructions,
    comboSelect,
    presetExample,
    inputsLabel,
    labelInput,
    inputPathTemplate,
    error,
    preview,
    templateActionsContainer
  );

  createModal({
    children: [layout],
    onClose: () => showFeedback("Closed template editor."),
  });
}

export function createPreferencesBox() {
  const preferencesBox = document.createElement("div");
  preferencesBox.className = "ettpd-preferences-box";
  preferencesBox.style.display = AppState.ui.isPreferenceBoxOpen
    ? "flex"
    : "none";
  // Label
  const prefLabel = document.createElement("div");
  prefLabel.className = "ettpd-pref-label";
  prefLabel.textContent = "Options:";

  // 🔄 Create button container
  const btnContainer = document.createElement("div");
  btnContainer.style.display = "flex";
  btnContainer.style.flexWrap = "wrap";
  btnContainer.style.gap = "8px";
  btnContainer.style.justifyContent = "space-around";
  btnContainer.style.marginTop = "10px";

  // 🔄 Reset Downloader button
  const resetBtn = document.createElement("button");
  resetBtn.className = "ettpd-pref-btn danger";
  resetBtn.textContent = "🔄 Factory Reset";
  resetBtn.onclick = async (e) => {
    e.stopPropagation();
    resetAppStateToDefaults();
    await showFeedback("✅ Downloader state has been reset.");
    setTimeout(() => {
      AppState.ui.isPreferenceBoxOpen = false;
      AppState.ui.isScrapperBoxOpen = false;

      displayFoundUrls({ forced: true });
    }, 1000);
  };

  // 🧹 Clear List button
  const clearListBtn = document.createElement("button");
  clearListBtn.className = "ettpd-pref-btn";
  clearListBtn.textContent = "🧹 Clean List";
  clearListBtn.onclick = (e) => {
    e.stopPropagation();
    if (
      AppState.downloading.isActive ||
      AppState.downloading.isDownloadingAll
    ) {
      showAlertModal("Please wait for the download to be over or refresh!");
      return;
    }
    AppState.downloadedURLs = [];
    AppState.allDirectLinks = [];
    AppState.allItemsEverSeen = {};
    AppState.displayedState.itemsHash = "";
    AppState.displayedState.path = window.location.pathname;
    AppState.ui.isPreferenceBoxOpen = false;
    AppState.ui.isScrapperBoxOpen = false;
    showAlertModal(
      "🔄 All set! The download list now shows only the posts visible on the main screen — nothing from the sidebar.<br><br>💡 <b>Tip:</b> To scrape this page, scroll all the way down, then click <b>Download All</b> once you're happy with your list."
    );

    setTimeout(() => {
      displayFoundUrls({ forced: true });
    }, 1000);
  };

  // Add buttons to container
  btnContainer.appendChild(resetBtn);
  btnContainer.appendChild(clearListBtn);

  // Append container wherever it needs to go
  // Example: parentEl.appendChild(btnContainer);

  // Filters (as checkboxes)
  const filtersLabel = document.createElement("div");
  filtersLabel.className = "ettpd-pref-label";
  filtersLabel.textContent = "Filters:";

  const currentUserCheckbox = createCheckbox(
    `👤 Current User Only (${
      getCurrentPageUsername() !== "😃"
        ? "@" + getCurrentPageUsername()
        : "Go to a user page!"
    })`,
    "filterUsername",
    (e) => {
      const checkbox = e.target;
      if (
        getCurrentPageUsername() === "😃" &&
        !AppState.filters.currentProfile
      ) {
        e?.stopPropagation();
        e?.preventDefault();

        // Revert the checkbox state visually
        checkbox.checked = false;

        showAlertModal(
          "This feature only works when you are on a user page :) 👀 Psst… The Scrapper's the glow-up. This legacy mode is giving 2019 vibes."
        );
        return;
      }

      // Toggle state only when valid
      AppState.filters.currentProfile = checkbox.checked;
    },
    AppState.filters.currentProfile
  );

  // Advanced checkboxes
  const advancedLabel = document.createElement("div");
  advancedLabel.className = "ettpd-pref-label";
  advancedLabel.textContent = "Downloader Preferences:";

  const skipFailedCheckbox = createCheckbox(
    "Skip Failed Downloads",
    "skipFailedDownloads",
    () => {
      AppState.downloadPreferences.skipFailedDownloads =
        !AppState.downloadPreferences.skipFailedDownloads;
    },
    AppState.downloadPreferences.skipFailedDownloads
  );
  const skipAdsCheckbox = createCheckbox(
    "Skip Ads",
    "skipAds",
    () => {
      AppState.downloadPreferences.skipAds =
        !AppState.downloadPreferences.skipAds;
    },
    AppState.downloadPreferences.skipAds,
    "Will not download ads, buy you will still see ads."
  );
  const includeCSVFile = createCheckbox(
    "Include CSV File",
    "includeCSV",
    () => {
      AppState.downloadPreferences.includeCSV =
        !AppState.downloadPreferences.includeCSV;
    },
    AppState.downloadPreferences.includeCSV
  );

  const disableConfetti = createCheckbox(
    "Hide Confetti 🎉",
    "disableConfetti",
    () => {
      AppState.downloadPreferences.disableConfetti =
        !AppState.downloadPreferences.disableConfetti;
      localStorage.setItem(
        STORAGE_KEYS.DISABLE_CELEBRATION_CONFETTI,
        AppState.downloadPreferences.disableConfetti
      );
    },
    AppState.downloadPreferences.disableConfetti
  );

  // Theme dropdown
  function createThemeToggle() {
    const container = document.createElement("div");
    container.className = "ettpd-theme-toggle-container";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "10px";
    container.style.marginTop = "8px";

    const label = document.createElement("label");
    label.className = "ettpd-label";
    label.textContent = "Theme:";
    label.style.marginRight = "8px";

    const select = document.createElement("select");
    select.name = "themeMode";
    select.className = "ettpd-select";
    select.style.cursor = "pointer";

    // Get current stored theme (not resolved, to show "system" if selected)
    const currentStored = AppState.ui.themeMode || "dark";
    const currentNormalized =
      currentStored === "classic" ? "light" : currentStored;

    const options = [
      { value: "dark", label: "🌙 Dark" },
      { value: "light", label: "☀️ Light" },
      { value: "system", label: "🖥️ System" },
    ];

    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (value === currentNormalized) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.onchange = (e) => {
      const newTheme = e.target.value;
      AppState.ui.themeMode = newTheme;
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, newTheme);

      // Get resolved theme (actual theme to apply)
      const resolvedTheme =
        newTheme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : newTheme;

      // Apply theme to downloader wrapper
      const wrapper = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
      if (wrapper) {
        if (resolvedTheme === "dark") {
          wrapper.classList.add("ettpd-theme-dark");
          wrapper.classList.remove("ettpd-theme-classic");
        } else {
          wrapper.classList.add("ettpd-theme-classic");
          wrapper.classList.remove("ettpd-theme-dark");
        }
      }

      // Update all modals
      document.querySelectorAll(".ettpd-modal-overlay").forEach((modal) => {
        if (resolvedTheme === "dark") {
          modal.classList.add("ettpd-theme-dark");
          modal.classList.remove("ettpd-theme-classic");
        } else {
          modal.classList.add("ettpd-theme-classic");
          modal.classList.remove("ettpd-theme-dark");
        }
      });

      const themeLabel =
        newTheme === "system"
          ? "System"
          : newTheme === "dark"
          ? "Dark"
          : "Light";
      showFeedback(`Theme set to ${themeLabel} mode`);
    };

    // Listen for system theme changes when "system" is selected
    if (currentNormalized === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemThemeChange = (e) => {
        if (AppState.ui.themeMode === "system") {
          const resolvedTheme = e.matches ? "dark" : "light";
          const wrapper = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
          if (wrapper) {
            if (resolvedTheme === "dark") {
              wrapper.classList.add("ettpd-theme-dark");
              wrapper.classList.remove("ettpd-theme-classic");
            } else {
              wrapper.classList.add("ettpd-theme-classic");
              wrapper.classList.remove("ettpd-theme-dark");
            }
          }
        }
      };
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      // Store handler for cleanup if needed
      select._systemThemeHandler = handleSystemThemeChange;
    }

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  const themeToggle = createThemeToggle();

  // Power Toggle Component
  function createPowerToggle() {
    const container = document.createElement("div");
    container.className = "ettpd-power-toggle-container";
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      padding: 10px;
      border: 1px solid var(--ettpd-border-color);
      border-radius: 8px;
      background: var(--ettpd-bg-tertiary);
    `;

    const label = document.createElement("label");
    label.className = "ettpd-label";
    label.textContent = "Extension Status:";
    label.style.marginBottom = "0";

    const toggleContainer = document.createElement("div");
    toggleContainer.className = "ettpd-power-toggle-wrapper";
    toggleContainer.style.cssText = `
      position: relative;
      width: 60px;
      height: 30px;
      cursor: pointer;
    `;

    const toggle = document.createElement("div");
    toggle.className = "ettpd-power-toggle";
    const isEnabled = isExtensionEnabledSync();
    toggle.classList.toggle("ettpd-power-toggle-on", isEnabled);
    toggle.classList.toggle("ettpd-power-toggle-off", !isEnabled);

    const toggleIcon = document.createElement("span");
    toggleIcon.className = "ettpd-power-toggle-icon";
    toggleIcon.textContent = isEnabled ? "⚡" : "🔌";
    toggleIcon.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 16px;
      transition: all 0.3s ease;
    `;

    toggle.appendChild(toggleIcon);
    toggleContainer.appendChild(toggle);

    toggleContainer.onclick = async (e) => {
      e.stopPropagation();
      const currentState = isExtensionEnabledSync();
      console.log("[EXT_POWER] toggle clicked, currentState:", currentState);

      if (currentState) {
        // Turning off - show warning modal with Cancel and Disable buttons
        return new Promise((resolve) => {
          const message = document.createElement("div");
          message.className = "alert";
          message.innerHTML =
            "⚠️ <b>Disable Extension?</b><br><br>" +
            "The extension will be completely disabled. No scripts will run, no polling will occur, and no downloads will be processed.<br><br>" +
            "To re-enable, click the extension icon and select 'Turn On'.";

          const actionsContainer = document.createElement("div");
          actionsContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 20px;
            justify-content: center;
          `;

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "ettpd-modal-button secondary";
          cancelBtn.textContent = "Cancel";
          cancelBtn.onclick = () => {
            const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
            if (overlay) overlay.remove();
            resolve(false);
          };

          const disableBtn = document.createElement("button");
          disableBtn.className = "ettpd-modal-button danger";
          disableBtn.textContent = "Disable";
          disableBtn.onclick = async () => {
            console.log("[EXT_POWER] disabling via modal");
            await setExtensionEnabled(false);
            toggle.classList.remove("ettpd-power-toggle-on");
            toggle.classList.add("ettpd-power-toggle-off");
            toggleIcon.textContent = "🔌";

            // Refresh all TikTok tabs
            try {
              if (typeof chrome !== "undefined" && chrome.tabs) {
                const tabs = await new Promise((resolve) => {
                  chrome.tabs.query({ url: "*://*.tiktok.com/*" }, resolve);
                });

                if (tabs && tabs.length > 0) {
                  console.log("[EXT_POWER] reloading TikTok tabs:", tabs.length);
                  tabs.forEach((tab) => {
                    if (tab.id) {
                      chrome.tabs.reload(tab.id);
                    }
                  });
                  showFeedback(
                    `Extension disabled. Refreshed ${tabs.length} TikTok tab${
                      tabs.length !== 1 ? "s" : ""
                    }.`
                  );
                } else {
                  showFeedback(
                    "Extension disabled. Reload the page for changes to take effect."
                  );
                  console.log("[EXT_POWER] no TikTok tabs found on disable");
                }
              } else {
                // Fallback: reload current page
                showFeedback(
                  "Extension disabled. Reload the page for changes to take effect."
                );
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
                console.log("[EXT_POWER] disable fallback: no chrome.tabs");
              }
            } catch (err) {
              console.warn("Failed to refresh tabs:", err);
              showFeedback(
                "Extension disabled. Reload the page for changes to take effect."
              );
              // Fallback: reload current page
              setTimeout(() => {
                window.location.reload();
              }, 1500);
              console.log("[EXT_POWER] disable error", err);
            }

            const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
            if (overlay) overlay.remove();
            resolve(true);
          };

          actionsContainer.appendChild(cancelBtn);
          actionsContainer.appendChild(disableBtn);

          createModal({
            children: [message, actionsContainer],
            onClose: () => resolve(false),
          });
        });
      } else {
        // Turning on
        console.log("[EXT_POWER] enabling via toggle");
        await setExtensionEnabled(true);
        toggle.classList.remove("ettpd-power-toggle-off");
        toggle.classList.add("ettpd-power-toggle-on");
        toggleIcon.textContent = "⚡";
        showFeedback(
          "Extension enabled. Reload the page for changes to take effect."
        );
      }
    };

    container.appendChild(label);
    container.appendChild(toggleContainer);

    return container;
  }

  const powerToggle = createPowerToggle();

  const autoScrollSettingUI = createScrollModeSelector();

  // Feedback container
  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "ettpd-reset-feedback";
  // Utility function to show feedback
  function showFeedback(text) {
    feedbackContainer.innerHTML = `<span>Applying...</span>`;
    preferencesBox.appendChild(feedbackContainer);
    // Then show the actual message after displayFoundUrls finishes
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        feedbackContainer.innerHTML = `<span>${text}</span>`;
        // Then remove the message after a short delay
        setTimeout(() => {
          feedbackContainer.remove();
          displayFoundUrls({ forced: true });
        }, 1500);
      }, 1500); // slight delay to allow DOM update to complete
    });
  }

  // Checkbox generator
  function createCheckbox(
    label,
    stateKey,
    customHandler = null,
    defaultValue = false,
    title = ""
  ) {
    const container = document.createElement("label");
    container.className = "ettpd-checkbox-container";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = defaultValue ?? false;
    checkbox.name = stateKey;

    checkbox.onchange = (e) => {
      if (customHandler) {
        customHandler(e);
      } else {
        AppState[stateKey] = checkbox.checked;
      }
      showFeedback(`${label} saved! ☑️`);
    };

    const span = document.createElement("span");
    span.textContent = label;
    span.title = title;
    container.appendChild(checkbox);
    container.appendChild(span);
    return container;
  }

  function createScrollModeSelector() {
    const label = document.createElement("label");
    label.className = "ettpd-label";
    label.textContent = `Auto Scroll Mode (${
      !listScrollingCompleted() || canClickNextButton()
        ? "Available"
        : "Unavailable"
    })`;

    const select = document.createElement("select");
    select.name = "scrollMode";
    select.className = "ettpd-select";
    const options = [
      { value: "onVideoEnd", label: "🔁 On Video End" },
      { value: "always", label: "🔄 Anytime (Load More)" },
      { value: "off", label: "📴 Off" },
    ];

    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });

    select.value = AppState.downloadPreferences.autoScrollMode;
    select.onchange = (e) => {
      AppState.downloadPreferences.autoScrollMode = e.target.value;
      showFeedback(
        `Auto Scroll Mode set to "${e.target.selectedOptions[0].text}"`
      );
    };

    const container = document.createElement("div");
    container.className = "ettpd-scroll-settings";
    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  const templateEditorBtn = document.createElement("button");
  templateEditorBtn.className = "ettpd-pref-btn";
  templateEditorBtn.textContent = "📝 File Paths Preferences";
  templateEditorBtn.onclick = (e) => {
    e.stopPropagation();
    createFilenameTemplateModal();
  };

  preferencesBox.append(
    filtersLabel,
    currentUserCheckbox,
    advancedLabel,
    skipFailedCheckbox,
    skipAdsCheckbox,
    includeCSVFile,
    disableConfetti,
    themeToggle,
    powerToggle,
    autoScrollSettingUI,
    prefLabel,
    templateEditorBtn,
    btnContainer
  );

  return preferencesBox;
}

export function createSettingsToggle(preferencesBox) {
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "ettpd-settings-toggle";
  settingsBtn.textContent = "⚙️ Settings";
  settingsBtn.title = "Click to toggle settings";
  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    // Close Scrapper if open
    AppState.ui.isScrapperBoxOpen = false;
    if (document.getElementById(DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER)) {
      document.getElementById(
        DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER
      ).style.display = "none";
    }
    preferencesBox.style.display =
      preferencesBox.style.display === "none" ? "flex" : "none";
    AppState.ui.isPreferenceBoxOpen = preferencesBox.style.display === "flex";
    updateSettingsBtn();
    // Update Scrapper button state - find it and update
    const allButtons = document.querySelectorAll(".ettpd-settings-toggle");
    allButtons.forEach((btn) => {
      if (btn !== settingsBtn && btn.textContent.includes("Scrapper")) {
        btn.classList.remove("ettpd-settings-open");
      }
    });
  };

  updateSettingsBtn();

  function updateSettingsBtn() {
    if (AppState.ui.isPreferenceBoxOpen) {
      AppState.ui.isScrapperBoxOpen = false;
      if (document.getElementById(DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER))
        document.getElementById(
          DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER
        ).style.display = AppState.ui.isScrapperBoxOpen ? "flex" : "none";

      settingsBtn.textContent = "⚙️ Close";
      settingsBtn.classList.add("ettpd-settings-open");

      // Update Scrapper button state
      const allButtons = document.querySelectorAll(".ettpd-settings-toggle");
      allButtons.forEach((btn) => {
        if (btn !== settingsBtn && btn.textContent.includes("Scrapper")) {
          btn.classList.remove("ettpd-settings-open");
        }
      });
    } else {
      settingsBtn.textContent = "⚙️ Settings";
      settingsBtn.classList.remove("ettpd-settings-open");
    }
  }
  return settingsBtn;
}

// function addClosePreferenceButton(preferencesBox) {
//   // Prevent duplicates
//   if (preferencesBox.querySelector(".ettpd-close-btn")) return;

//   const closeBtn = document.createElement("button");
//   closeBtn.className = "ettpd-close-btn";
//   closeBtn.textContent = "❌ Close Preferences";
//   closeBtn.title = "Hide the preferences box";
//   closeBtn.style.marginTop = "8px";
//   closeBtn.style.alignSelf = "center";

//   closeBtn.onclick = (e) => {
//     e.stopPropagation();
//     preferencesBox.style.display = "none";
//     AppState.ui.isPreferenceBoxOpen = false;
//   };

//   preferencesBox.appendChild(closeBtn);
// }

/**
 * Remove every existing “.download-btn-container” from the DOM.
 */
// export function clearDownloadBtnContainers() {
//   return document
//     .querySelectorAll(".download-btn-container")
//     .forEach((el) => el.remove());
// }

export function clearDownloadBtnContainers() {
  const match = window.location.pathname.match(
    /^\/@[^/]+\/(photo|video)\/([A-Za-z0-9]+)$/
  );
  const activeId = match?.[2];

  document.querySelectorAll(".download-btn-container").forEach((el) => {
    const hasActiveButton = el.querySelector(
      `button.download-btn.${CSS.escape(activeId)}`
    );

    if (hasActiveButton) {
      console.log("✅ Skipping active download-btn-container", el);
      return;
    }

    console.log("🧹 Removing download-btn-container", el);
    el.remove();
  });
}

function createDownloadButton({
  wrapperId,
  author,
  videoId,
  getVideoSrc,
  parentEl,
  isSmallView,
  isImage,
  photoIndex,
  from,
}) {
  if (!parentEl) {
    console.log("IMAGES_DL ❌ No parent element found!", isImage);
    return;
  }

  console.log("IMAGES_DL createDownloadButton", {
    wrapperId,
    author,
    videoId,
    getVideoSrc,
    parentEl,
    isSmallView,
    isImage,
    photoIndex,
    from,
  });

  const className = `download-btn ${videoId}`;
  const mediaTypeLabel = isImage ? "Image" : "Video";
  // const defaultBtnLabel = isSmallView ? "Save" : `Save ${mediaTypeLabel}`;
  const defaultBtnLabel = "Save";
  const buildDefaultMarkup = () =>
    `<span class="download-btn-icon" aria-hidden="true"></span><span class="download-btn-label">${defaultBtnLabel}</span>`;

  // Prevent duplicate buttons
  if (parentEl.querySelector(`.${CSS.escape(videoId)}`)) {
    console.log("IMAGES_DL ⛔ Button already exists", {
      existing: parentEl.querySelector(`.${CSS.escape(videoId)}`),
    });
    return;
  }

  const container = document.createElement("div");
  container.className = "download-btn-container";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.dataset.wrapperId = wrapperId;
  btn.title = `Download ${mediaTypeLabel}`;
  btn.setAttribute("aria-label", `Download ${mediaTypeLabel}`);
  const resetButtonToDefault = () => {
    btn.disabled = false;
    btn.innerHTML = buildDefaultMarkup();
  };
  resetButtonToDefault();

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const media = buildVideoLinkMeta(AppState.allItemsEverSeen[videoId]) ?? {
      videoId,
      authorId: author,
    };
    const src = media?.url ?? getVideoSrc();

    console.log("IMAGES_DL ⏬ Clicked, source:", src);
    if (!src?.startsWith("http")) {
      if (AppState.debug.active) console.warn("IMAGES_DL ❌ Invalid source");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    let hasFailed = false;
    try {
      await downloadURLToDisk(
        src,
        getDownloadFilePath(media, {
          imageIndex: photoIndex,
        })
      );
      btn.textContent = "✅ Saved";
      showCelebration(
        "downloads",
        getRandomDownloadSuccessMessage(isImage ? "photo" : "video")
      );
      if (!AppState.downloadPreferences.skipFailedDownloads) {
        setTimeout(() => {
          showRateUsPopUpLegacy();
        }, 8000);
      }
    } catch (err) {
      if (AppState.debug.active)
        console.warn("IMAGES_DL ❌ Download failed", err);
      hasFailed = true;
    } finally {
      if (hasFailed) btn.textContent = "Save Failed";
      setTimeout(() => {
        resetButtonToDefault();
      }, 5000);
    }
  });

  // Style the container

  container.appendChild(btn);

  parentEl.appendChild(container);

  console.log("IMAGES_DL ✅ Button injected", {
    injectedInto: parentEl,
    container,
    from,
  });
}

export function createMediaDownloadButtonForWrapper(wrapperEl, postId) {
  if (!wrapperEl || !postId) {
    console.log("createMediaDownloadButtonForWrapper ", { wrapperEl, postId });
    return;
  }
  const isImage = !wrapperEl.querySelector("video");

  const author =
    getVideoUsernameFromAllDirectLinks(postId) ||
    wrapperEl.querySelector('a[href*="/@"]')?.textContent?.slice(1) ||
    getUsernameFromPlayingArticle() ||
    getPostInfoFrom(wrapperEl, {
      origin: "createMediaDownloadButtonForWrapper",
    })?.username ||
    getCurrentPageUsername() ||
    "username";

  const getMediaSrc = () => {
    if (isImage) {
      return (
        wrapperEl.querySelector("img")?.src ||
        wrapperEl
          .querySelector("source[type='image/avif']")
          ?.srcset?.split(" ")[0]
      );
    } else {
      return (
        getSrcById(postId) ||
        wrapperEl.querySelector("video source")?.src ||
        wrapperEl.querySelector("video")?.src
      );
    }
  };

  createDownloadButton({
    wrapperId: wrapperEl.id,
    author,
    videoId: postId,
    getVideoSrc: getMediaSrc,
    parentEl: wrapperEl,
    isSmallView: expectSmallViewer(),
    isImage,
    from: "createMediaDownloadButtonForWrapper",
  });
}

// 1. List item - explore
export function createExploreDownloadButton(exploreItem, videoId) {
  const wrapper = exploreItem.querySelector(".xgplayer-container");
  if (!wrapper) return;

  const author =
    getVideoUsernameFromAllDirectLinks(videoId) ||
    exploreItem
      .querySelector('[data-e2e="explore-card-user-unique-id"]')
      ?.textContent?.trim() ||
    getPostInfoFrom(
      exploreItem.closest('[data-e2e="explore-item"]')?.parentElement,
      {
        origin: "createExploreDownloadButton",
      }
    )?.username ||
    getUsernameFromPlayingArticle() ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    getSrcById(videoId) ||
    wrapper.querySelector("video source")?.src ||
    wrapper.querySelector("video")?.src;

  createDownloadButton({
    wrapperId: `explore-${videoId}`,
    author,
    videoId,
    getVideoSrc,
    parentEl: wrapper,
    isSmallView: expectSmallViewer(),
    from: "createExploreDownloadButton",
  });
}
export function getImageDivPlayerContainer(parentEl) {
  if (!parentEl) return;
  // Traverse up to find a relevant container
  while (parentEl && parentEl !== document.body) {
    if (
      parentEl.nodeName === "DIV" &&
      (parentEl.className.includes("DivPlayerContainer") ||
        parentEl.className.includes("DivVideoWrapper"))
    ) {
      return parentEl;
    }
    parentEl = parentEl.parentElement;
  }
}
export function getImageDivPlayerContainerDownward(rootEl) {
  if (!rootEl || !(rootEl instanceof Element)) return null;

  // Breadth-first search
  const queue = [rootEl];

  while (queue.length) {
    const el = queue.shift();
    if (
      el.nodeName === "DIV" &&
      (el.className.includes("DivPlayerContainer") ||
        el.className.includes("DivPlayerWrapper") ||
        el.className.includes("DivPlayerContainer"))
    ) {
      return el;
    }

    for (const child of el.children) {
      queue.push(child);
    }
  }

  return null;
}

// /**
//  * Scan the page for feed‐wrappers and explore‐items,
//  * and attach download buttons via your three helpers:
//  * - createExploreDownloadButton
//  * - createMediaDownloadButtonForWrapper
//  * - createImageDownloadButton
//  * - downloadBtnInjectorForMainVideoSideGrid
//  */
// export function attachDownloadButtons() {
//   // Handle explore items and track their video IDs
//   document.querySelectorAll('div[data-e2e="explore-item"]').forEach((item) => {
//     const href = item.querySelector("a[href*='/video/']")?.getAttribute("href");
//     const m = href?.match(/\/video\/(\d+)/);
//     if (m && !item.querySelector(".ettpd-download-btn")) {
//       createExploreDownloadButton(item, m[1]);
//     }
//   });

//   // Handle video feed wrappers (not already handled and no button yet)
//   document.querySelectorAll("div[id^='xgwrapper-']").forEach((wrapper) => {
//     const m = wrapper.id.match(/xgwrapper-\d+-(\d+)/);
//     if (m && !wrapper.querySelector(".ettpd-download-btn")) {
//       createMediaDownloadButtonForWrapper(wrapper, m[1]);
//     }
//   });

//   // Handle image posts (e.g., in image feed or browse mode)
//   // document.querySelectorAll("div[data-e2e='browse-image-feed-item']").forEach((item) => {
//   //   const idMatch = item.id?.match(/imagewrapper-(\d+)/);
//   //   if (idMatch && !item.querySelector(".ettpd-download-btn")) {
//   //     createImageDownloadButton(item, idMatch[1]);
//   //   }
//   // });

//   document
//     .querySelectorAll("div[id^='column-item-video-container-']")
//     .forEach((wrapper) => {
//       // Check if wrapper contains a DivPlayerContainer (fuzzy match)
//       const playerDiv = wrapper.querySelector(
//         "div[class*='DivPlayerContainer']"
//       );
//       if (!playerDiv) return;

//       // Get post ID from link — works for both /video/ and /photo/
//       const href = wrapper
//         .querySelector("a[href*='/video/'], a[href*='/photo/']")
//         ?.getAttribute("href");
//       const m = href?.match(/\/(video|photo)\/(\d+)/);
//       if (!m) return;

//       const postType = m[1]; // "video" or "photo"
//       const postId = m[2];

//       // Skip if download button already present
//       if (wrapper.querySelector(".ettpd-download-btn")) return;

//       // Only activate if mouse is currently over the wrapper
//       const isHovered = wrapper.matches(":hover");
//       if (!isHovered) return;

//       // Create appropriate download button
//       // if (postType === "photo") {
//       createMediaDownloadButtonForWrapper(
//         Array.from(wrapper.children)?.at(0),
//         postId
//       );
//       // console.log("SELECTED PHOTO WRAPPER dskjfsj", wrapper);
//       // } else if (postType === "video") {
//       // createMediaDownloadButtonForWrapper(wrapper, postId);
//       // console.log("SELECTED VIDEO WRAPPER dskjfsj", wrapper);

//       // }
//     });

//   downloadBtnInjectorForMainVideoSideGrid();
// }

function injectExploreDownloadButtons() {
  document.querySelectorAll('div[data-e2e="explore-item"]').forEach((item) => {
    const href = item.querySelector("a[href*='/video/']")?.getAttribute("href");
    const m = href?.match(/\/video\/(\d+)/);
    if (m && !item.querySelector(".ettpd-download-btn")) {
      createExploreDownloadButton(item, m[1]);
    }
  });
}

function injectFeedWrapperDownloadButtons() {
  document.querySelectorAll("div[id^='xgwrapper-']").forEach((wrapper) => {
    const m = wrapper.id.match(/xgwrapper-\d+-(\d+)/);
    if (m && !wrapper.querySelector(".ettpd-download-btn")) {
      createMediaDownloadButtonForWrapper(wrapper, m[1]);
    }
  });
}

// If you ever want to re-enable this
function injectImageFeedDownloadButtons() {
  document
    .querySelectorAll("div[data-e2e='browse-image-feed-item']")
    .forEach((item) => {
      const idMatch = item.id?.match(/imagewrapper-(\d+)/);
      if (idMatch && !item.querySelector(".ettpd-download-btn")) {
        createImageDownloadButton(item, idMatch[1]);
      }
    });
}

function injectSideGridDownloadButtons() {
  document
    .querySelectorAll("div[id^='column-item-video-container-']")
    .forEach((wrapper) => {
      const playerDiv = wrapper.querySelector(
        "div[class*='DivPlayerContainer']"
      );
      if (!playerDiv) return;

      const href = wrapper
        .querySelector("a[href*='/video/'], a[href*='/photo/']")
        ?.getAttribute("href");
      const m = href?.match(/\/(video|photo)\/(\d+)/);
      if (!m) return;

      const postId = m[2];
      if (wrapper.querySelector(".ettpd-download-btn")) return;

      if (!wrapper.matches(":hover")) return;

      createMediaDownloadButtonForWrapper(
        Array.from(wrapper.children)?.at(0),
        postId
      );
    });
}

function downloadBtnInjectorForMainVideoSideGrid() {
  const listContainer = [...document.querySelectorAll("a[href*='/video/']")]
    .map((a) => a.closest("div"))
    .filter((el) => el?.tagName === "DIV");

  listContainer.forEach((card) => {
    const link = card.querySelector("a[href*='/video/']");
    const href = link?.getAttribute("href");
    const m = href?.match(/\/video\/(\d+)/);
    const videoId = m?.[1];
    if (!videoId) return;

    const wrapper = getImageDivPlayerContainerDownward(card);
    if (wrapper)
      if (
        wrapper &&
        wrapper.className.includes("DivPlayerWrapper") &&
        !wrapper.querySelector(".ettpd-download-btn")
      ) {
        const author =
          getVideoUsernameFromAllDirectLinks(videoId) ||
          getPostInfoFrom(card, {
            origin: "safeGridObserver",
          })?.username ||
          getCurrentPageUsername() ||
          "username";

        const getVideoSrc = () =>
          getSrcById(videoId) ||
          wrapper.querySelector("video source")?.src ||
          wrapper.querySelector("video")?.src;

        createDownloadButton({
          wrapperId: `grid-${videoId}`,
          author,
          videoId,
          getVideoSrc,
          parentEl: wrapper.parentElement.parentElement, // This will definitely break in the future
          isSmallView: true,
          from: "safeGridObserver",
        });
      }
  });
}
/**
 * Scans the current TikTok page for various post containers (explore items, feed wrappers, and side grid)
 * and attaches appropriate download buttons to each, if not already present.
 *
 * The function delegates the actual logic to specialized helpers for each layout type:
 * - `injectExploreDownloadButtons` handles explore page grid items.
 * - `injectFeedWrapperDownloadButtons` handles feed-style video wrappers.
 * - `injectSideGridDownloadButtons` handles main video/photo containers in side grid view.
 * - `downloadBtnInjectorForMainVideoSideGrid` handles download button injection for the floating side grid.
 *
 * This method is intended to be called periodically or in response to DOM changes (e.g., scroll, navigation)
 * to ensure buttons are added as new content loads.
 */
export function attachDownloadButtons() {
  injectExploreDownloadButtons();
  injectFeedWrapperDownloadButtons();
  injectSideGridDownloadButtons();
  // injectImageFeedDownloadButtons(); // optional
  downloadBtnInjectorForMainVideoSideGrid();
}

/**
 * Create or show the floating auto-swipe UI.
 */
export function createAutoSwipeUI() {
  let ui = document.getElementById("autoSwipeUI");

  // If UI already exists, just show it
  if (ui) {
    ui.style.display = "flex";
    return;
  }

  // Create new UI
  ui = document.createElement("div");
  ui.id = "autoSwipeUI";
  ui.style.position = "fixed";
  ui.style.bottom = "8px";
  ui.style.right = "10px";
  ui.style.zIndex = "99999";
  ui.style.backgroundColor = "rgba(0,0,0,0.7)";
  ui.style.color = "#fff";
  ui.style.padding = "8px 12px";
  ui.style.borderRadius = "6px";
  ui.style.fontSize = "14px";
  ui.style.fontFamily = "sans-serif";
  ui.style.display =
    AppState.downloadPreferences.autoScrollMode != "off" ? "flex" : "none";
  ui.style.alignItems = "center";
  ui.style.gap = "10px";
  ui.style.zIndex = "9999";

  const timerText = document.createElement("span");
  timerText.id = "swipeTimerText";
  timerText.textContent = "Next in 0s";

  const pauseBtn = document.createElement("button");
  pauseBtn.id = "pauseSwipeBtn";
  pauseBtn.textContent = "Pause";
  pauseBtn.style.padding = "4px 8px";
  pauseBtn.style.background = "#f44336";
  pauseBtn.style.border = "none";
  pauseBtn.style.color = "#fff";
  pauseBtn.style.borderRadius = "4px";
  pauseBtn.style.cursor = "pointer";
  pauseBtn.style.fontSize = "12px";

  pauseBtn.onclick = () => {
    if (AppState.downloadPreferences.autoScrollMode != "off") {
      AppState.downloadPreferences.autoScrollModePrev =
        AppState.downloadPreferences.autoScrollMode;
    }
    AppState.downloadPreferences.autoScrollMode =
      AppState.downloadPreferences.autoScrollMode == "off"
        ? AppState.downloadPreferences.autoScrollModePrev || "off"
        : "off";

    pauseBtn.textContent =
      AppState.downloadPreferences.autoScrollMode != "off" ? "Pause" : "Resume";

    if (AppState.downloadPreferences.autoScrollMode != "off") {
      startAutoSwipeLoop(); // Restart loop
    } else {
      clearTimeout(AppState.ui.autoSwipeConfigurations.nextClickTimeout);
      clearInterval(AppState.ui.autoSwipeConfigurations.countdownInterval);
    }
    // Reload UI
    displayFoundUrls({ forced: true });
  };

  ui.appendChild(timerText);
  ui.appendChild(pauseBtn);
  document.body?.appendChild(ui);
}
// ui.js

export function handleSwiper(swiper) {
  console.log("IMAGES_DL handleSwiper init...", {
    swiper,
  });

  const section =
    findAncestor(swiper, (el) => el.tagName === "SECTION") ||
    swiper.querySelector("div.swiper-slide.swiper-slide-active");

  if (!section) return;
  console.log("IMAGES_DL handleSwiper section found...", {
    section,
  });
  const linkHref = window.location.href;
  const isPhotoLink = linkHref.includes("/photo/");
  const photoIndex = Number(
    document
      .querySelector(".swiper-slide-active")
      ?.getAttribute("data-swiper-slide-index") || "0"
  );

  const isFeedVideo = section.getAttribute("data-e2e") === "feed-video";
  if (!isPhotoLink && !isFeedVideo && section.tagName === "SECTION") return;
  console.log("IMAGES_DL handleSwiper section isPhoto/video...", {
    section,
  });
  const videoId = extractVideoIdFromURL(linkHref);
  const authorId = extractAuthorFromURL(linkHref);
  console.log("IMAGES_DL handleSwiper section author/videoId...", {
    videoId,
    authorId,
    link: linkHref,
  });
  if (!videoId || !authorId) return;
  console.log("IMAGES_DL handleSwiper section author/videoId found...", {
    videoId,
    authorId,
  });
  if (section.querySelector(`.download-btn.${CSS.escape(videoId)}`)) return;
  console.log("IMAGES_DL handleSwiper download btn being created ", {
    videoId,
    authorId,
  });
  createDownloadButton({
    wrapperId: swiper.id || videoId,
    author: authorId,
    videoId,
    getVideoSrc: () => {
      const img = swiper.querySelector(".swiper-slide-active img");
      return img?.src || "";
    },
    parentEl: isPhotoLink ? getImageDivPlayerContainer(section) : section,
    isSmallView: false,
    isImage: true,
    photoIndex,
    from: "handleSwiper",
  });
}

export function handleSingleImage(picture) {
  const img = picture.querySelector("img");
  if (!img?.src) return;

  const wrapper = findAncestor(
    picture,
    (el) => el.getAttribute("data-e2e") === "user-post-item"
  );
  if (!wrapper) return;

  const linkHref = window.location.pathname;
  if (!linkHref?.includes("/photo/")) return;

  const videoId = extractVideoIdFromURL(linkHref);
  const authorId = extractAuthorFromURL(linkHref);
  if (!videoId || !authorId) return;

  if (wrapper.querySelector(`.download-btn.${CSS.escape(videoId)}`)) return;

  createDownloadButton({
    wrapperId: wrapper.id || videoId,
    author: authorId,
    videoId,
    getVideoSrc: () => img.src,
    parentEl: wrapper,
    isSmallView: true,
    isImage: true,
    from: "handleSingleImage",
  });
}

export function scanAndInject() {
  console.log("IMAGES_DL scanAndInject init...");
  const swipers = Array.from(document.querySelectorAll("div.swiper"));
  const activeSwiper = document.querySelector("div.swiper.swiper-initialized");
  console.log("IMAGES_DL scanAndInject init...", { swipers, activeSwiper });

  if (
    /^\/@[^\/]+\/(photo|video)\/[A-Za-z0-9]+$/.test(window.location.pathname) &&
    activeSwiper
  ) {
    console.log("IMAGES_DL photo/video match found init...");

    clearDownloadContainers();
    swipers.length = 0;
    swipers.push(activeSwiper);
  }

  swipers.forEach(handleSwiper);

  if (!activeSwiper) {
    const firstPicture = Array.from(document.querySelectorAll("picture")).length
      ? Array.from(document.querySelectorAll("picture"))[0]
      : null;
    firstPicture ? handleSingleImage(firstPicture) : null;
  }
}

export function clearDownloadContainers() {
  if (
    !/^\/@[^\/]+\/(photo|video)\/[A-Za-z0-9]+$/.test(window.location.pathname)
  )
    return;
  console.log(
    "IMAGES_DL photo/video match cleaning buttons...",
    document.querySelectorAll(
      ".photo-download-btn-container, .download-btn-container"
    )
  );

  document
    .querySelectorAll(".photo-download-btn-container, .download-btn-container")
    .forEach((el) => el.remove());
}

// Helpers

// export function clearDownloadContainers() {
//   const match = window.location.pathname.match(
//     /^\/@[^/]+\/(photo|video)\/([A-Za-z0-9]+)$/
//   );
//   if (!match) return;

//   const activeId = match[2]; // Extracted video ID
//   console.log("IMAGES_DL cleaning, keeping active:", activeId);

//   document
//     .querySelectorAll(".photo-download-btn-container, .download-btn-container")
//     .forEach((el) => {
//       const btn = el.querySelector(
//         `button.download-btn.${CSS.escape(activeId)}`
//       );
//       if (btn) {
//         console.log("✅ Skipping active download container", el);
//         return;
//       }

//       console.log("🧹 Removing inactive download container", el);
//       el.remove();
//     });
// }

function extractVideoIdFromURL(url) {
  const match = url?.match(/\/(?:photo|video)\/([A-Za-z0-9]+)/);
  return match?.[1] || null;
}

function extractAuthorFromURL(url) {
  const match = url?.match(/\/@([^\/]+)/);
  return match?.[1] || null;
}

// Find the nearest ancestor matching a predicate
function findAncestor(el, testFn) {
  while (el) {
    if (testFn(el)) return el;
    el = el.parentElement;
  }
  return null;
}
function createOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "photo-download-btn-container";
  Object.assign(overlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    zIndex: "9999",
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    pointerEvents: "auto",
  });
  return overlay;
}

// Ensure the parent can host an absolute overlay
function ensureRelative(el) {
  const pos = window.getComputedStyle(el).position;
  if (pos === "static") el.style.position = "relative";
}

// Build a button and wire up its click
function makeButton(text, onClick) {
  const btn = document.createElement("button");
  btn.className = "download-btn";
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

// function handleDownloadAllPostImages(media) {
//   return async function (e) {
//     e.stopPropagation();

//     const downloadAllBtn = e.currentTarget;
//     const originalText = downloadAllBtn.textContent;

//     downloadAllBtn.textContent = "⏳ Downloading...";
//     downloadAllBtn.disabled = true;

//     AppState.downloading.isActive = true;
//     AppState.downloading.isDownloadingAll = true;

//     try {
//       for (let i = 0; i < media.imagePostImages.length; i++) {
//         try {
//           downloadAllBtn.textContent = `⏳ Downloading ${i + 1}/${
//             media.imagePostImages.length
//           }...`;
//           await downloadSingleMedia(media, { imageIndex: i });
//         } catch (err) {
//           console.error(`Download failed for image ${i + 1}`, err);
//           downloadAllBtn.textContent = `⏳ Failed at ${i + 1}/${
//             media.imagePostImages.length
//           }...`;
//           await sleep(3000);
//         }
//       }
//     } catch (error) {
//       console.warn("Unexpected error during bulk download:", error);
//     } finally {
//       AppState.downloading.isActive = false;
//       AppState.downloading.isDownloadingAll = false;
//     }

//     downloadAllBtn.textContent = "✅ All Done!";
//     setTimeout(() => {
//       downloadAllBtn.textContent = originalText;
//       downloadAllBtn.disabled = false;
//     }, 3000);
//   };
// }

function getVisibleImageVidPlayer() {
  const container = Array.from(document.querySelectorAll("div")).find(
    (el) =>
      el.className.includes("DivPlayerContainer") && el.offsetParent !== null // visible in layout flow
  );

  return container;
}
