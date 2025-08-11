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
} from "../utils/utils.js";
import { startAutoSwipeLoop } from "../polling/polling.js";

export function createDownloaderWrapper() {
  const wrapper = document.createElement("div");
  wrapper.id = DOM_IDS.DOWNLOADER_WRAPPER;
  wrapper.className = "ettpd-wrapper";

  const dragHandle = document.createElement("div");
  dragHandle.className = "ettpd-drag-handle";
  dragHandle.title = "Drag to move";
  dragHandle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000" height="20px" width="20px" version="1.1" id="Layer_1" viewBox="0 0 492.001 492.001" xml:space="preserve">
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

  // Append all UI elements
  const controlBar = document.createElement("div");
  controlBar.className = "ettpd-handle-controls";
  controlBar.appendChild(cornerSelector);
  controlBar.appendChild(leaderboardBtn);
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
  const spans = await getTabSpans(30 * 1000); // 30 seconds wait at most

  // Button Generator
  const tabOptions = [
    { key: "videos", label: "🎥 Scrape Videos" },
    { key: "reposts", label: "🔁 Scrape Reposts" },
    { key: "liked", label: "❤️ Scrape Likes" },
    { key: "favorites", label: "⭐ Scrape Favorites" },
    { key: "collection", label: `🗂️ Scrape: ${spans.collection}` },
  ];

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
    btn.className = `ettpd-tab-btn ettpd-tab-btn-${key} ${
      AppState.scrapperDetails.selectedTab == key &&
      (AppState.scrapperDetails.scrappingStage == "ongoing" ||
        AppState.scrapperDetails.scrappingStage == "downloading")
        ? "active"
        : ""
    }`;
    btn.textContent = label;

    btn.addEventListener("click", () => {
      // Remove active class from all tab buttons
      document
        .querySelectorAll(".ettpd-tab-btn.active")
        .forEach((b) => b.classList.remove("active"));

      // Set the clicked one as active
      btn.classList.add("active");
      if (key == "collection") {
        AppState.scrapperDetails.selectedCollectionName = spans.collection;
      }

      // Your existing logic
      showScrapperStateUI(key);
    });

    btnContainer.appendChild(btn);
  });
  const tabsAvailable =
    tabOptions.filter(({ key }) => {
      const span = spans[key];
      if (!span) return false;

      if (typeof span === "string") {
        return span.trim().length > 0; // allow non-empty string
      }

      return !!span.offsetParent; // DOM element visible
    }).length !== 0;
  if (!tabsAvailable) {
    const subtitle = document.createElement("span");
    subtitle.id = "tab-subtitle";
    subtitle.innerText =
      "🛑 Whoops — you're not on a profile or collection page. Turn on Auto Scroll in Settings (mode => 'Anytime'), smash that download, and you're golden. If this ain't it, refresh or hmu.";

    btnContainer.appendChild(subtitle);
  }
  {
    const subtitle = document.getElementById("tab-subtitle");
    if (subtitle) {
      subtitle.remove();
    }
  }

  scrapperContainer
    .querySelectorAll(".ettpd-scrapper-controls")
    .forEach((el) => el.remove());

  scrapperContainer.appendChild(controls);
  controls.appendChild(btnContainer);
  if (
    AppState.scrapperDetails.scrappingStage == "ongoing" ||
    AppState.scrapperDetails.scrappingStage == "downloading"
  ) {
    if (tabsAvailable)
      showScrapperStateUI(AppState.scrapperDetails.selectedTab);
  }
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
  If you can't <strong>see</strong> the posts, you can't <strong>download</strong> them. Duh. 😤
</blockquote>
<p class="alert">
  You can <strong>Pause</strong> anytime or smash <strong>Download Now</strong> to dive in instantly.
</p>
<p class="alert">
  Want full control? Customize where your downloads go by setting up your own
  <strong>File Path Templates</strong> under <strong>Settings → File Paths</strong>. 🛠️
</p>`;

  // Open the custom template modal
  const configBtn = document.createElement("button");
  configBtn.className = "ettpd-action-btn";
  configBtn.textContent = "⚙️ Configure file paths";
  configBtn.style.marginTop = "10px";
  configBtn.onclick = () => {
    createFilenameTemplateModal();
  };

  // NEW: one-click apply recommended template
  const applyBtn = document.createElement("button");
  applyBtn.className = "ettpd-action-btn";
  applyBtn.textContent = "✨ Apply Recommended File Path Template";
  applyBtn.style.marginTop = "10px";
  applyBtn.style.backgroundColor = "#0a84d6";
  applyBtn.style.color = "white";
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
    showAlertModal("Saved Recommended Template!");
  };

  const example = document.createElement("div");
  example.innerText = `Example: ${getRecommendedPresetTemplate().example}`;
  example.style.marginTop = "5px";
  example.style.fontSize = "11px";
  createModal({
    children: [description, configBtn, applyBtn, example],
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

function createDownloadAllButton(enabled = true) {
  const btn = document.createElement("button");
  btn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON;
  btn.className = "ettpd-btn download-all-btn";
  const total = AppState.allDirectLinks.length;
  const done = AppState.downloadedURLs.length;

  if (!total) {
    btn.textContent = "🚫 Nothing to download";
    btn.disabled = true;
  } else if (AppState.downloading.isDownloadingAll) {
    if (done < total) {
      btn.textContent = `⏳ Downloading ${done} of ${total} post${
        total !== 1 ? "s" : ""
      }…`;
      btn.disabled = true;
    } else {
      btn.textContent = `✅ All ${total} post${
        total !== 1 ? "s" : ""
      } downloaded`;
    }
  } else {
    btn.textContent = `⬇️ Download ${total > 1 ? `all ${total}` : "1"} post${
      total !== 1 ? "s" : ""
    }`;
    btn.disabled = false;
  }

  btn.disabled = !enabled;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (!enabled) return;
    downloadAllLinks(btn);
  };
  return btn;
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
  const total = AppState.allDirectLinks.length;
  const done = AppState.downloadedURLs.length;
  const isDownloading = AppState.downloading.isDownloadingAll;

  if (!total) {
    downloadAllBtn.textContent = "🚫 Nothing to download";
    downloadAllBtn.disabled = true;
  } else if (isDownloading) {
    if (done < total) {
      downloadAllBtn.textContent = `⏳ Downloading ${
        done
      } of ${total} Post${total !== 1 ? "s" : ""}…`;
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

function createCurrentVideoButton(items) {
  const btn = document.createElement("button");
  btn.className = "ettpd-btn ettpd-current-video-btn";
  btn.textContent = "Download Current";

  const currentVideoId = document.location.pathname.split("/")[3];
  const currentMedia = items.find(
    (media) => currentVideoId && media.videoId === currentVideoId
  );

  btn.onclick = !currentMedia
    ? () => {}
    : !currentMedia.isImage
    ? () => downloadSingleMedia(currentMedia)
    : (e) => downloadAllPostImagesHandler(e, currentMedia);

  return currentMedia ? btn : document.createElement("span");
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
  container.style.gap = "10px";
  container.style.justifyContent = "space-between";

  // --- Settings Button ---
  const settingsBtn = createSettingsToggle(preferencesBox);
  settingsBtn.style.flex = "1";

  // --- User Posts Button ---
  const userPostsBtn = document.createElement("button");
  userPostsBtn.className = "ettpd-settings-toggle";
  userPostsBtn.textContent = "🥵 Scrapper";
  userPostsBtn.title = "Download likes, reposts, and favorites";
  userPostsBtn.style.flex = "1";

  container.appendChild(settingsBtn);
  container.appendChild(userPostsBtn);

  return { container, settingsBtn, userPostsBtn };
}

export function updateDownloaderList(items, hashToDisplay) {
  if (AppState.downloading.isActive || AppState.downloading.isDownloadingAll)
    return;
  const _id = DOM_IDS.DOWNLOADER_WRAPPER;
  // Clean up if a wrapper already exists;
  document.getElementById(_id)?.remove();

  const wrapper = createDownloaderWrapper();
  // Despicable hack
  setTimeout(async () => {
    showStatsSpan();
    await showScrapperControls();
  });

  // AppState.allDirectLinks = [];
  // ettpd-download-btn-holder

  // Preferences box
  const preferencesBox = createPreferencesBox();
  const {
    container: settingsAndScrapperBtnContainer,
    settingsBtn,
    userPostsBtn,
  } = createControlButtons(preferencesBox, () => {
    console.log("Fetching user post stats...");
    // call your user posts stats fetcher here
  });

  const scrapperContainer = document.createElement("div");
  scrapperContainer.id = DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER;
  function updateVisibleBox() {
    // if scrapper and pref are open give higher priority the scrapper
    if (AppState.ui.isScrapperBoxOpen && AppState.ui.isPreferenceBoxOpen) {
      AppState.ui.isScrapperBoxOpen = true;
      AppState.ui.isPreferenceBoxOpen = false;
    }
    if (document.getElementById(DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER))
      document.getElementById(
        DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER
      ).style.display = AppState.ui.isScrapperBoxOpen ? "flex" : "none";

    if (document.querySelector(".ettpd-preferences-box")) {
      document.querySelector(".ettpd-preferences-box").style.display = AppState
        .ui.isPreferenceBoxOpen
        ? "flex"
        : "none";
    }
  }
  updateVisibleBox();
  userPostsBtn.onclick = (e) => {
    AppState.ui.isScrapperBoxOpen = !AppState.ui.isScrapperBoxOpen;
    AppState.ui.isPreferenceBoxOpen = AppState.ui.isScrapperBoxOpen
      ? false
      : AppState.ui.isScrapperBoxOpen;

    updateVisibleBox();
    console.log("AUG7SCROLL isScrapperBoxOpen", AppState.ui.isScrapperBoxOpen);
  };
  // addClosePreferenceButton(preferencesBox);

  // === Create the main wrapper ===

  const list = document.createElement("ol");
  list.className = "ettpd-ol";
  let downloadAllBtn = document.createElement("span");
  if (items.length > 0) {
    downloadAllBtn = createDownloadAllButton(items.length > 0);
    // Update the download button label

    updateDownloadButtonLabel(
      downloadAllBtn,
      `Download ${items.length > 1 ? "All " + items.length : 1} Post${
        items.length > 1 ? "s" : ""
      }!`
    );
    AppState.recommendationsLeaderboard.newlyRecommendedUrls = items;
    try {
      setTimeout(() => {
        updateAllTimeRecommendationsLeaderBoard(hashToDisplay);
      }, 0);
    } catch (err) {}
    // Populate the list with items
    items.reverse().forEach((media, idx) => {
      const item = document.createElement("li");
      item.className = "ettpd-li";

      const currentVideoId = document.location.pathname.split("/")[3];

      // Container for author and desc
      const textContainer = document.createElement("div");
      textContainer.className = "ettpd-text-container";

      // Container to hold emojis and author link
      const authorWrapper = document.createElement("div");
      authorWrapper.className = "ettpd-author-wrapper"; // Add CSS to style inline if needed

      // ▶️ Current video indicator
      if (currentVideoId && currentVideoId === media?.videoId) {
        const liveEmoji = document.createElement("span");
        liveEmoji.textContent = "▶️";
        liveEmoji.title = "Currently viewed video";
        liveEmoji.className = "ettpd-emoji";
        authorWrapper.appendChild(liveEmoji);
      }

      // 🤷‍♂️ Low confidence indicator
      if (media?.downloaderHasLowConfidence) {
        const lowConfidenceEmoji = document.createElement("span");
        lowConfidenceEmoji.textContent = "🤷‍♂️";
        lowConfidenceEmoji.title = "Low confidence data";
        lowConfidenceEmoji.className = "ettpd-emoji";
        authorWrapper.appendChild(lowConfidenceEmoji);
      }

      // 📣  Ad indicator
      if (media?.isAd) {
        const adEmoji = document.createElement("span");
        adEmoji.textContent = "📣";
        adEmoji.title = "Sponsored or ad content";
        adEmoji.className = "ettpd-emoji";
        authorWrapper.appendChild(adEmoji);
      }

      // Author link
      const authorAnchor = document.createElement("a");
      authorAnchor.className = "ettpd-a ettpd-author-link";
      authorAnchor.target = "_blank";
      authorAnchor.href = `https://www.tiktok.com/@${media?.authorId}`;
      authorAnchor.innerText = media?.authorId
        ? `@${media.authorId}`
        : "Unknown Author";

      authorWrapper.appendChild(authorAnchor);

      // Description element
      const descSpan = document.createElement("span");
      descSpan.className = "ettpd-desc-span";
      const fullDesc = media?.desc || "";
      const shortDesc =
        fullDesc.length > 100 ? fullDesc.slice(0, 100) + "..." : fullDesc;
      let expanded = false;
      descSpan.innerText = shortDesc;

      // Toggle on click
      descSpan.style.cursor = fullDesc.length > 100 ? "pointer" : "default";
      descSpan.style.textDecoration =
        fullDesc.length > 100 ? "underline" : "none";
      descSpan.title = fullDesc.length > 100 ? "Expandable" : "Description";
      descSpan.onclick = () => {
        expanded = !expanded;
        descSpan.innerText = expanded ? fullDesc : shortDesc;
      };

      textContainer.append(authorWrapper, descSpan);

      // Download button holder

      const downloadBtnHolder = document.createElement("div");
      downloadBtnHolder.className = "ettpd-download-btn-holder";

      if (media.isImage && Array.isArray(media.imagePostImages)) {
        // Create the download-all button container

        const downloadAllBtn = document.createElement("button");
        downloadAllBtn.textContent = "⬇️ Download All Images";
        downloadAllBtn.className = "ettpd-download-btn";
        downloadAllBtn.style.marginBottom = "10px";
        downloadAllBtn.style.marginTop = "5px";

        downloadAllBtn.onclick = (e) => downloadAllPostImagesHandler(e, media);
        downloadBtnHolder.appendChild(downloadAllBtn);

        // Then render the image list after
        const imageList = document.createElement("ol");
        imageList.className = "ettpd-image-download-list";

        media.imagePostImages.forEach((url, i) => {
          const li = document.createElement("li");
          li.className = "ettpd-image-download-item";

          // Open button
          const openBtn = document.createElement("button");
          openBtn.textContent = "Open";
          openBtn.className = "ettpd-download-btn ettpd-view-btn";
          openBtn.onclick = (e) => {
            e.stopPropagation();
            if (url) window.open(url, "_blank");
          };

          // Download button
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
        // Fallback for single video or non-image content
        const viewBtn = document.createElement("button");
        viewBtn.textContent = "Open";
        viewBtn.className = "ettpd-download-btn ettpd-view-btn";
        viewBtn.onclick = (e) => {
          e.stopPropagation();
          if (media?.url) window.open(media.url, "_blank");
        };

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
        holderEl.append(viewBtn, downloadBtn);
        downloadBtnHolder.append(holderEl);
      }

      item.append(textContainer, downloadBtnHolder);
      list.appendChild(item);
    });

    list.style.setProperty("--list-length", list.children.length);
    AppState.displayedState.itemsHash = hashToDisplay;
    AppState.displayedState.path = window.location.pathname;
  } else {
    showEmptyState(downloadAllBtn); // place the empty message inside the list area
  }
  // === Persistent controls ===
  wrapper.append(
    // createStatsSpan(),
    settingsAndScrapperBtnContainer,
    scrapperContainer,
    preferencesBox,
    downloadAllBtn,
    createCurrentVideoButton(items),
    createReportBugButton(),
    createCreditsSpan(),
    list,
    createCloseButton()
  );
  console.log("ALLHELLBLOCKLOSE", {
    settingsAndScrapperBtnContainer,
    preferencesBox,
    downloadAllBtn,
    createCurrentVideoButton: createCurrentVideoButton(items),
    createReportBugButton: createReportBugButton(),
    createCreditsSpan: createCreditsSpan(),
    list: list,
    createCloseButton: createCloseButton(),
  });
  return wrapper;
}

export function showEmptyState(container) {
  let existing = container.querySelector(".ettpd-empty");

  if (existing) {
    existing.style.display = "";
    return;
  }

  const p = document.createElement("p");
  p.className = "ettpd-span ettpd-empty";
  p.innerText = "No videos found to display 😔";
  container.appendChild(p);
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

export function hideDownloader() {
  document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER)?.remove();
  if (document.getElementById(DOM_IDS.SHOW_DOWNLOADER)) return;

  const showBtn = document.createElement("button");
  showBtn.id = DOM_IDS.SHOW_DOWNLOADER;
  showBtn.textContent = "Open Video Downloader";
  showBtn.id = DOM_IDS.SHOW_DOWNLOADER;
  showBtn.onclick = () => {
    localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "false");
    AppState.ui.isDownloaderClosed = false;
    AppState.ui.isPreferenceBoxOpen = false;
    document.getElementById(DOM_IDS.SHOW_DOWNLOADER)?.remove();
    displayFoundUrls({ forced: true });
  };

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

    const section = (label, list, count = 0) => `
    <div class="ettpd-stats-section">
      <div class="ettpd-section-header black-text">
        <span>${label}</span>
        <span class="ettpd-section-total" title="${count.toLocaleString()}">  |  Total: ${formatCompactNumberWithTooltip(
      count
    )} 🔢</span>
      </div>
      <ol class="ettpd-leaderboard-list">
        ${
          list.length
            ? list
                .map(
                  (item, i) => `
          <li>
            <a class="ettpd-name black-text" href="https://tiktok.com/@${
              item.username || "tiktok"
            }" target="_blank">
              <span class="ettpd-rank">${i + 1}.</span>  ${item.username}
            </a>
            <span class="ettpd-count black-text" title="${item.count.toLocaleString()}"> — ${formatCompactNumberWithTooltip(
                    item.count
                  )}</span>
          </li>`
                )
                .join("")
            : "<li class='alert'>No entries yet</li>"
        }
      </ol>
    </div>
  `;

    const sameCount = weeklyCount === allTimeCount && allTimeCount > 0;

    const funMessage = sameCount
      ? `<div class="alert">You peaked this week 😮‍💨</div>`
      : "";

    content.innerHTML = `
    <div class="ettpd-summary-line black-text">
      You've ${
        tabKey === "downloads" ? "downloaded" : "been recommended"
      } <strong title="${totalCount.toLocaleString()}">${formatCompactNumberWithTooltip(
      totalCount
    )}</strong> items. Level: ${tierLabel}
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

  // === Container to hold both close btn and modal box ===
  const container = document.createElement("div");
  container.className = "ettpd-modal-box-container";

  // === Close Button ===
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.id = "ettpd-close";
  btn.setAttribute("aria-label", "Close modal");

  Object.assign(btn.style, {
    fontSize: "24px",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    width: "36px",
    height: "36px",
    lineHeight: "36px",
    right: "234px",
    top: "-20px",
    textAlign: "center",
    marginBottom: "12px",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
  });

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
  layout.style.padding = "10px";
  layout.style.color = "#fff";

  // Collapsible instructions
  const knownFields = [
    "videoId",
    "authorUsername",
    "authorNickname",
    "desc",
    "createTime",
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

  const instructions = document.createElement("details");
  instructions.style.fontSize = "13px";
  instructions.style.marginBottom = "10px";
  instructions.style.color = "black";
  instructions.innerHTML = ` 
     <summary style="cursor: pointer;">
    <div>
      <strong>📂 Customize your full file path</strong><br/>
      <span style="font-size: 12px; display: block; color: #555;">
        Use <code>{fieldName}</code>, <code>{fieldName|fallback}</code>, or <code>{fieldName:maxLen|fallback}</code> in your relative path. 'fallback' defaults to "missing-{fieldName}", to change it, add a fallback value of '-' as seen on <em>desc</em> in the default preset." <br/>
        Supports dynamic values and constants like <code>{videoId}-cat.mp4</code>.<br/>
        👉<em style="color:#888;"> Click to read more...</em>
      </span>
    </div>
  </summary>
  <div style="margin-top: 8px;">
    <p><strong>Supported fields:</strong> <code style="display: block; color: brown; font-family: monospace; white-space: normal;">
    ${knownFields.join(", ")}
    </code></p>
    <strong>Notes:</strong>
    <ul style="margin-left:1em; padding-left:1em; text-align: left;">
      <li>Downloader auto-appends correct extension: <code>.jpeg</code> for images, <code>.mp4</code> for videos.</li>
      <li>If you omit <code>{sequenceNumber}</code>, it will be added automatically for multi-image posts.</li>
      <li>Use <code>{sequenceNumber|required}</code> to force numbering even on single-image posts.</li>
      <li>You can optionally control field length, e.g. <code>{desc:40|no-desc}</code> limits to 40 characters.</li>
      <li>Paths must be <strong>relative</strong>. No leading slashes or <code>..</code>.</li>
      <li>{ad} adds "ad" to the file path if the media is an advertisement.</li>
      <li>{mediaType} inserts either "image" or "video" based on the type of media being downloaded.</li>
      <li>{tabName} Best for scrapping mode, it prints: Video, Reposts, Liked, Favorited! Recommended template replaces the initial username with the account being scrapped username so you find everything in the same folder. </li>
      <li>Use your imagination—or don't. Totally up to you.</li>
    </ul>
  </div>
`;

  // Dropdown for both user templates and presets
  const comboSelect = document.createElement("select");
  comboSelect.style = "margin-bottom: 8px; width: 100%; padding: 6px;";

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
  // labelInput.style = "width:100%;padding:6px;margin-bottom:8px;";
  labelInput.className = "ettpd-modal-input";

  const inputPathTemplate = document.createElement("input");
  inputPathTemplate.type = "text";
  inputPathTemplate.name = "template";
  inputPathTemplate.placeholder =
    "downloads/{authorUsername}/{videoId}-{desc|no-desc}.mp4";
  inputPathTemplate.value = savedFullTemplate;
  inputPathTemplate.style = "width:100%;padding:6px;margin-bottom:8px;";

  const error = document.createElement("div");
  error.style = "color:red;font-size:12px;margin-top:4px;";

  const preview = document.createElement("div");
  preview.style =
    "font-family:monospace;color:#fe2c55;margin-top:6px;font-size:13px;margin-bottom:5px;";

  const activeFullPathTemplate = document.createElement("div");
  activeFullPathTemplate.style =
    "font-family:monospace;color:#2f3989;margin-top:6px;font-size:13px;margin-bottom:5px;";
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
      createTime: "1690000000",
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
      createTime: sanitize(sample.createTime),
      musicTitle: sanitize(sample.musicTitle),
      musicAuthor: sanitize(sample.musicAuthor),
      views: sanitize(sample.views),
      duration: sanitize(sample.duration),
      hashtags: (sample.hashtags || [])
        .map((tag) => sanitize(tag.name || tag))
        .join("-"),
    };

    const replaced = tpl.replace(
      /\{(\w+)(?::(\d+))?(?:\|([^}]+))?\}/g,
      (_, key, maxLenRaw, fallbackRaw) => {
        const maxLen = Number(maxLenRaw) || undefined;
        const fallback = fallbackRaw;
        const isRequiredSequence =
          key === "sequenceNumber" && fallback === "required";

        if (key === "sequenceNumber") {
          if (isRequiredSequence || (sample.isImage && isMultiImage)) {
            return sequenceNumber;
          }
          return "";
        }

        if (key === "ad") return sample.isAd ? "ad" : "";
        if (key === "mediaType") return sample.isImage ? "image" : "video";

        let val = fieldValues[key];
        if (val == null || val === "") {
          val = fallback ?? `missing-${key}`;
        }

        val = sanitize(val);
        if (maxLen) val = val.slice(0, maxLen);
        return val;
      }
    );

    let cleaned = replaced
      .replace(
        /\/?([^/]+)\.(jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|tiff|bmp|svg)$/i,
        "/$1"
      )
      .replace(/\/+/g, "/")
      .replace(/--+/g, "-")
      .replace(/__+/g, "_")
      .replace(/[-_]+/g, (m) => m[0])
      .replace(/(^|\/)[-_]+/g, "$1")
      .replace(/[-_]+($|\/)/g, "$1")
      .replace(/^\/+|\/+$/g, "");

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
  inputsLabel.style.color = "black";
  inputsLabel.style.textAlign = "left";
  inputsLabel.style.display = "block";
  inputsLabel.style.marginBottom = "5px";

  inputsLabel.textContent = "🤤 Create your own or copy existing template!";
  inputPathTemplate.addEventListener("input", renderPreviewAndErrors);
  inputPathTemplate.className = "ettpd-modal-input";

  labelInput.addEventListener("input", () => (deleteBtn.disabled = false));

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
    activeFullPathTemplate,
    deleteBtn,
    saveBtn
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
    AppState.downloadPreferences.skipAds
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
    defaultValue = false
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
    preferencesBox.style.display =
      preferencesBox.style.display === "none" ? "flex" : "none";
    AppState.ui.isPreferenceBoxOpen = preferencesBox.style.display === "flex";
    updateSettingsBtn();
  };

  updateSettingsBtn();

  function updateSettingsBtn() {
    // Reset any previous listeners
    settingsBtn.onmouseenter = null;
    settingsBtn.onmouseleave = null;

    if (AppState.ui.isPreferenceBoxOpen) {
      AppState.ui.isScrapperBoxOpen = false;
      if (document.getElementById(DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER))
        document.getElementById(
          DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER
        ).style.display = AppState.ui.isScrapperBoxOpen ? "flex" : "none";

      settingsBtn.textContent = "⚙️ Close";
      settingsBtn.style.border = "1px solid #fe2c55";
      settingsBtn.style.color = "#fe2c55";
      settingsBtn.style.background = "#fff";

      settingsBtn.onmouseenter = () => {
        settingsBtn.style.background = "#fe2c55";
        settingsBtn.style.color = "#fff";
      };

      settingsBtn.onmouseleave = () => {
        settingsBtn.style.background = "#fff";
        settingsBtn.style.color = "#fe2c55";
      };
    } else {
      settingsBtn.textContent = "⚙️ Settings";
      settingsBtn.style.border = "1px solid #1da1f2";
      settingsBtn.style.color = "#1da1f2";
      settingsBtn.style.background = "#fff";

      settingsBtn.onmouseenter = () => {
        settingsBtn.style.background = "#1da1f2";
        settingsBtn.style.color = "#fff";
      };

      settingsBtn.onmouseleave = () => {
        settingsBtn.style.background = "#fff";
        settingsBtn.style.color = "#1da1f2";
      };
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
  btn.textContent = isSmallView
    ? "⬇️ Download"
    : "⬇️ Download " + (isImage ? "Image" : "Video");
  btn.className = className;
  btn.dataset.wrapperId = wrapperId;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const src = getVideoSrc();
    console.log("IMAGES_DL ⏬ Clicked, source:", src);
    if (!src?.startsWith("http")) {
      if (AppState.debug.active) console.warn("IMAGES_DL ❌ Invalid source");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Downloading…";
    let hasFailed = false;
    try {
      await downloadURLToDisk(
        src,
        getDownloadFilePath(
          {
            videoId,
            authorId: author,
          },
          {
            imageIndex: photoIndex,
          }
        )
      );
      btn.textContent = "✅ Downloaded!";
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
      if (hasFailed) btn.textContent = "Download Failed";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = isSmallView
          ? "⬇️ Download"
          : "⬇️ Download " + (isImage ? "Image" : "Video");
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
