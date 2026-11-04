// ui.js
import AppState, { resetAppStateToDefaults } from "../state/state.js";
import { t, getLocale, bindText, clearText, initializeI18n, createLanguageControl, onLanguageChange, localizeMarkup } from "../i18n/index.js";
import { summarizeResume } from "../storage/resumeSummary.js";
import { showPayItForwardDialog, hasSupportCooldown } from "../utils/payItForward.js";
import { getShortDramaId, resolveShortDramaRequest, collectShortDramaEpisodes, getEpisodeNumber } from "../utils/shortDrama.js";
import { getCollectionContext, resolveCollectionRequest, collectCollectionItems } from "../utils/collection.js";
import { getAccountUsername, resolveAccountList, rememberAccountIdentity } from "../utils/accountLists.js";
import { DEFAULT_BATCH_SIZE, ProgressiveBatch } from "../storage/progressiveBatch.js";
import { createHtmlFragment, replaceElementHtml as replaceRawElementHtml } from "../utils/html.js";
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
  getCurrentPlayingArticle,
  expectSmallViewer,
  getVideoUsernameFromAllDirectLinks,
  canClickNextButton,
  downloadSingleMedia,
  downloadAllPostImagesHandler,
  downloadURLToDisk,
  displayFoundUrls,
  downloadAllLinks,
  downloadAccountListBatches,
  getProgressiveListCheckpoint,
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
  claimAutomaticPopup,
  getRandomDownloadSuccessMessage,
  getTabSpans,
  listScrollingCompleted,
  toTitleCase,
  shouldShowRatePopupLegacy,
  shouldShowRateDonatePopup,
  getRecommendedPresetTemplate,
  showShareOptions,
  buildVideoLinkMeta,
  findRecentPlaylistRequestUrl,
  isOnProfileOrCollectionPage,
  rememberCurrentPlaylistItems,
  saveCSVFile,
  stopActiveBatchDownload,
  findFiberItemById,
  findFiberItemsInContainer,
  detectBrowserType,
  syncPlaylistStateWithLocation,
  hydrateTikTokVideoDetail,
  isAdaptiveGearName,
  getPreferredExperimentalHdSource,
} from "../utils/utils.js";
import {
  startAutoSwipeLoop,
  startAutoBatchDownloads,
  pollInitialData,
} from "../polling/polling.js";
import {
  isExtensionEnabledSync,
  setExtensionEnabled,
} from "../utils/extensionState.js";
import {
  loadProgress,
  getAllProgress,
  saveProgress,
} from "../storage/progress.js";
import { handleFoundItems, handleResumeDownload } from "./handlers.js";

// Track current username to detect profile changes for resume downloads
function replaceElementHtml(element, markup) {
  clearText(element);
  replaceRawElementHtml(element, markup);
  localizeMarkup(element);
}

let lastTrackedUsername = null;
const experimentalHdHydrationState = new Map();
initializeI18n();
onLanguageChange(() => {
  for (const button of document.querySelectorAll("[data-i18n-button]")) {
    if (button.dataset.downloadActive !== "true" && !button.classList.contains("ettpd-batch-progress")) setButtonWithIcon(button, t(button.dataset.i18nButton, button._i18nValues || {}), button.dataset.i18nIcon || null);
  }
  const batchButton = document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (batchButton && AppState.downloading.isDownloadingAll) renderBatchDownloadProgress(batchButton);
  showStatsSpan();
});

function setLocalizedButton(button, key, icon = null, values = {}) {
  button.dataset.i18nButton = key;
  button.dataset.i18nIcon = icon || "";
  button._i18nValues = values;
  setButtonWithIcon(button, t(key, values), icon);
}

function readStoredPosition(value) {
  try {
    const position = JSON.parse(value || "null");
    return position && Number.isFinite(position.left) && Number.isFinite(position.top) ? position : null;
  } catch {
    return null;
  }
}

function templateDisplayName(template) {
  const preset = getPresetTemplates().find(candidate => candidate.label === template.label && (candidate.template === template.template || candidate.template === template.fullPathTemplate));
  return preset?.messageKey ? t(preset.messageKey) : template.label;
}

function renderResumeSummary(checkpoint) {
  let chunk = null;
  try { chunk = new ProgressiveBatch(sessionStorage).readChunk(checkpoint.scope); } catch {}
  const summary = summarizeResume(checkpoint, chunk);
  const list = document.createElement("dl");
  list.className = "ettpd-resume-summary";
  for (const key of ["saved", "skipped", "pending", "unconfirmed", "failed", "remaining"]) {
    const label = document.createElement("dt"); bindText(label, key);
    const value = document.createElement("dd");
    if (summary[key] === null) {
      label.className = "ettpd-summary-unknown";
      value.className = "ettpd-summary-unknown";
      bindText(value, "unknown");
    }
    else bindText(value, "number", { count: summary[key] });
    list.append(label, value);
  }
  return list;
}

const CHROME_EXTENSION_REVIEW_URL =
  "https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg";
const FIREFOX_EXTENSION_REVIEW_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/tiktok-downloader-bulk/reviews/";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function getExtensionReviewTarget() {
  if (detectBrowserType() === "firefox") {
    return {
      storeLabel: "Firefox Add-ons",
      url: FIREFOX_EXTENSION_REVIEW_URL,
    };
  }

  return {
    storeLabel: "Chrome Web Store",
    url: CHROME_EXTENSION_REVIEW_URL,
  };
}

/**
 * Show a toast notification that auto-dismisses after a few seconds
 * @param {string} title - The title of the toast
 * @param {string} message - The message content
 * @param {number} duration - Duration in milliseconds (default: 4500)
 */
export function showToast(title, message, duration = 4500) {
  // Remove any existing toast
  const existingToast = document.getElementById("ettpd-toast-container");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.id = "ettpd-toast-container";

  // Apply current theme so toast matches the utility UI
  const resolvedTheme = getResolvedThemeMode();
  if (resolvedTheme === "dark") {
    toast.classList.add("ettpd-theme-dark");
  } else {
    toast.classList.add("ettpd-theme-classic");
  }

  // Add animation keyframes if not already present
  if (!document.getElementById("ettpd-toast-styles")) {
    const style = document.createElement("style");
    style.id = "ettpd-toast-styles";
    style.textContent = `
      #ettpd-toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 100000;
        max-width: 420px;
        padding: 12px 16px;
        border-radius: 12px;
        background: var(--ettpd-bg-tertiary, #333);
        color: var(--ettpd-text-primary, #fff);
        border: 1px solid var(--ettpd-border-color, rgba(0, 0, 0, 0.2));
        box-shadow: 0 14px 32px var(--ettpd-shadow, rgba(15, 23, 42, 0.45));
        font-size: 13px;
        line-height: 1.5;
        display: grid;
        grid-template-columns: 1fr auto;
        column-gap: 12px;
        row-gap: 4px;
        align-items: flex-start;
        animation: slideInRight 0.25s ease-out;
        pointer-events: auto;
      }

      #ettpd-toast-container .ettpd-toast-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      #ettpd-toast-container .ettpd-toast-title {
        font-weight: 600;
        font-size: 14px;
        color: var(--ettpd-text-primary, #fff);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #ettpd-toast-container .ettpd-toast-message {
        color: var(--ettpd-text-secondary, rgba(255, 255, 255, 0.9));
        font-size: 13px;
        word-wrap: break-word;
        overflow-wrap: anywhere;
      }

      #ettpd-toast-container .ettpd-toast-close {
        border: none;
        background: transparent;
        color: var(--ettpd-text-secondary, rgba(255, 255, 255, 0.8));
        padding: 0;
        margin: 0;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      }

      #ettpd-toast-container .ettpd-toast-close:hover {
        color: var(--ettpd-text-primary, #fff);
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const contentEl = document.createElement("div");
  contentEl.className = "ettpd-toast-content";

  const titleEl = document.createElement("div");
  titleEl.className = "ettpd-toast-title";
  titleEl.textContent = title;

  const messageEl = document.createElement("div");
  messageEl.className = "ettpd-toast-message";
  messageEl.textContent = message;

  contentEl.appendChild(titleEl);
  contentEl.appendChild(messageEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ettpd-toast-close";
  bindText(closeBtn, "dismiss", {}, "aria-label");
  closeBtn.textContent = "×";

  const dismissToast = () => {
    if (toast && toast.parentNode) {
      toast.style.animation = "slideOutRight 0.2s ease-in forwards";
      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.remove();
        }
      }, 200);
    }
  };

  closeBtn.onclick = (e) => {
    e.stopPropagation();
    dismissToast();
  };

  toast.onclick = () => {
    dismissToast();
  };

  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  toast.appendChild(contentEl);
  toast.appendChild(closeBtn);
  document.body.appendChild(toast);

  // Auto-dismiss after duration
  setTimeout(dismissToast, duration);
}

/**
 * Create an SVG icon element
 * @param {string} iconName - Name of the icon (download, refresh, play, pause, etc.)
 * @param {number} size - Size of the icon in pixels (default: 16)
 * @returns {SVGElement} SVG element with the icon
 */
export function createIcon(iconName, size = 16) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.verticalAlign = "middle";
  svg.style.display = "inline-block";

  const icons = {
    download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`,
    refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path>`,
    play: `<polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>`,
    pause: `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`,
    check: `<polyline points="20 6 9 17 4 12"></polyline>`,
    warning: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`,
    error: `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`,
    settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>`,
    info: `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`,
    delete: `<path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>`,
    video: `<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect>`,
    repost: `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path>`,
    heart: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>`,
    star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
    folder: `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>`,
    sun: `<circle cx="12" cy="12" r="4"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
    computer: `<rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`,
    fire: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.5-1.5-2-1.5-5C9.5 4 8.5 5 8.5 7c0 1.5.5 2.5.5 3.5s-.5 2.5-1 4"></path><path d="M12.5 13.5A2.5 2.5 0 0 0 15 11c0-1.5-1.5-2-1.5-5C13.5 3 12.5 4 12.5 6c0 1.5.5 2.5.5 3.5s-.5 2.5-1 4"></path><path d="M16.5 12.5A2.5 2.5 0 0 0 19 10c0-1.5-1.5-2-1.5-5C17.5 2 16.5 3 16.5 5c0 1.5.5 2.5.5 3.5s-.5 2.5-1 4"></path>`,
    sparkles: `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path>`,
    hourglass: `<path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path>`,
    stop: `<circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6"></rect>`,
    skip: `<polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line>`,
    down: `<path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path>`,
    "corner-top-left": `<line x1="18" y1="18" x2="6" y2="6"></line><polyline points="6 13 6 6 13 6"></polyline>`,
    "corner-top-right": `<line x1="6" y1="18" x2="18" y2="6"></line><polyline points="11 6 18 6 18 13"></polyline>`,
    "corner-bottom-left": `<line x1="18" y1="6" x2="6" y2="18"></line><polyline points="13 18 6 18 6 11"></polyline>`,
    "corner-bottom-right": `<line x1="6" y1="6" x2="18" y2="18"></line><polyline points="11 18 18 18 18 11"></polyline>`,
    "corner-none": `<path d="M12 3v18M3 12h18"></path><polyline points="8 7 12 3 16 7"></polyline><polyline points="8 17 12 21 16 17"></polyline><polyline points="7 8 3 12 7 16"></polyline><polyline points="17 8 21 12 17 16"></polyline>`,
    discord: `<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="currentColor"></path>`,
  };

  const iconPath = icons[iconName];
  if (!iconPath) {
    console.warn(`Icon "${iconName}" not found`);
    return svg;
  }

  // Discord icon uses fill instead of stroke
  if (iconName === "discord") {
    svg.setAttribute("fill", "currentColor");
    svg.removeAttribute("stroke");
    svg.removeAttribute("stroke-width");
  }

  replaceElementHtml(svg, iconPath);
  return svg;
}

/**
 * Set button text with an icon
 * @param {HTMLElement} button - Button element
 * @param {string} text - Text to display
 * @param {string} iconName - Name of the icon (optional)
 * @param {string} iconPosition - 'before' or 'after' (default: 'before')
 */
export function setButtonWithIcon(
  button,
  text,
  iconName = null,
  iconPosition = "before",
) {
  // Clear existing content
  clearText(button);

  if (iconName) {
    const icon = createIcon(iconName, 16);
    icon.style.marginRight = iconPosition === "before" ? "4px" : "0";
    icon.style.marginLeft = iconPosition === "after" ? "4px" : "0";

    if (iconPosition === "before") {
      button.appendChild(icon);
      button.appendChild(document.createTextNode(text));
    } else {
      button.appendChild(document.createTextNode(text));
      button.appendChild(icon);
    }
  } else {
    button.textContent = text;
  }
}

/**
 * Update button text with an icon (for dynamic updates)
 * @param {HTMLElement} button - Button element
 * @param {string} text - Text to display
 * @param {string} iconName - Name of the icon (optional)
 */
export function updateButtonWithIcon(button, text, iconName = null) {
  setButtonWithIcon(button, text, iconName);
}

export function getResolvedThemeMode() {
  const stored = AppState.ui.themeMode || "system";
  const normalized = stored === "classic" ? "light" : stored;

  // If system is selected, detect system preference
  if (normalized === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
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

function createHeaderPowerButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ettpd-icon-btn ettpd-power-btn";
  bindText(button, "disable", {}, "title");
  bindText(button, "disable", {}, "aria-label");

  replaceElementHtml(
    button,
    `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <line x1="12" y1="4" x2="12" y2="11" />
        <path d="M8.5 6.5A7 7 0 1 0 15.5 6.5" />
      </g>
    </svg>
  `,
  );

  const applyState = (enabled) => {
    button.classList.toggle("ettpd-power-btn-on", enabled);
    button.classList.toggle("ettpd-power-btn-off", !enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    bindText(button, enabled ? "disable" : "enable", {}, "title");
    bindText(button, enabled ? "disable" : "enable", {}, "aria-label");
  };

  applyState(isExtensionEnabledSync());

  button.onclick = async (e) => {
    e.stopPropagation();
    const currentState = isExtensionEnabledSync();
    console.log(
      "[EXT_POWER] header button clicked, currentState:",
      currentState,
    );

    if (currentState) {
      // Turning off - show warning modal with Cancel and Disable buttons
      return new Promise((resolve) => {
        const message = document.createElement("div");
        message.className = "alert";
        replaceElementHtml(
          message,
          '<p data-i18n="disableWarning"></p>',
        );

        const actionsContainer = document.createElement("div");
        actionsContainer.style.cssText = `
          display: flex;
          gap: 10px;
          margin-top: 20px;
          justify-content: center;
        `;

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "ettpd-modal-button secondary";
        bindText(cancelBtn, "cancel");
        cancelBtn.onclick = () => {
          const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
          if (overlay) overlay.remove();
          resolve(false);
        };

        const disableBtn = document.createElement("button");
        disableBtn.className = "ettpd-modal-button danger";
        bindText(disableBtn, "disable");
        disableBtn.onclick = async () => {
          console.log("[EXT_POWER] disabling via header modal");
          await setExtensionEnabled(false);
          applyState(false);

          showToast(
            t("disabled"),
            t("disabling"),
          );

          const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
          if (overlay) overlay.remove();
          setTimeout(() => {
            try {
              window.location.reload();
            } catch {}
          }, 300);
          resolve(true);
        };

        actionsContainer.appendChild(cancelBtn);
        actionsContainer.appendChild(disableBtn);

        createModal({
          children: [message, actionsContainer],
          onClose: () => resolve(false),
        });
      });
    }

    console.log("[EXT_POWER] enabling via header button");
    await setExtensionEnabled(true);
    applyState(true);
    showToast(
      t("enable"),
      t("refreshHint"),
    );
  };

  return button;
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
  bindText(dragHandle, "dragMove", {}, "title");
  replaceElementHtml(
    dragHandle,
    `<svg class="ettpd-drag-handle-icon" style="display:flex;align-items:center;justify-content:center;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="currentColor">
      <circle cx="9" cy="8" r="1.1" />
      <circle cx="9" cy="12" r="1.1" />
      <circle cx="9" cy="16" r="1.1" />
      <circle cx="15" cy="8" r="1.1" />
      <circle cx="15" cy="12" r="1.1" />
      <circle cx="15" cy="16" r="1.1" />
    </g>
  </svg>`,
  );
  dragHandle.style.marginRight = "0px";

  // Create custom corner selector dropdown (no native <select> — SVG in options
  // is unsupported on some platforms like Safari/macOS)
  const cornerSelectorWrapper = document.createElement("div");
  cornerSelectorWrapper.className = "ettpd-corner-select-wrapper";

  const cornerOptions = [
    { value: "", icon: "corner-none", label: "cornerFree" },
    { value: "top-left", icon: "corner-top-left", label: "cornerTopLeft" },
    { value: "top-right", icon: "corner-top-right", label: "cornerTopRight" },
    { value: "bottom-left", icon: "corner-bottom-left", label: "cornerBottomLeft" },
    {
      value: "bottom-right",
      icon: "corner-bottom-right",
      label: "cornerBottomRight",
    },
  ];

  let selectedCornerValue = "";

  // Toggle button that shows the currently selected icon
  const cornerToggle = document.createElement("button");
  cornerToggle.type = "button";
  cornerToggle.className = "ettpd-corner-toggle";
  bindText(cornerToggle, "snapCorner", {}, "title");
  bindText(cornerToggle, "snapCorner", {}, "aria-label");
  cornerToggle.setAttribute("aria-haspopup", "listbox");
  cornerToggle.setAttribute("aria-expanded", "false");

  let cornerIcon = createIcon("corner-bottom-left", 14);
  cornerIcon.setAttribute("class", "ettpd-corner-select-icon");
  cornerToggle.appendChild(cornerIcon);
  cornerSelectorWrapper.appendChild(cornerToggle);

  // Dropdown menu
  const cornerMenu = document.createElement("div");
  cornerMenu.className = "ettpd-corner-menu";
  cornerMenu.setAttribute("role", "listbox");

  cornerOptions.forEach(({ value, icon, label }) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ettpd-corner-menu-item";
    item.dataset.value = value;
    item.setAttribute("role", "option");
    bindText(item, label, {}, "title");
    bindText(item, label, {}, "aria-label");

    const itemIcon = createIcon(icon, 16);
    item.appendChild(itemIcon);

    item.onclick = (e) => {
      e.stopPropagation();
      selectedCornerValue = value;

      // Update active state on all items
      cornerMenu.querySelectorAll(".ettpd-corner-menu-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.value === value);
      });

      // Update toggle icon
      const newIcon = createIcon(icon, 14);
      newIcon.setAttribute("class", "ettpd-corner-select-icon");
      cornerToggle.replaceChild(
        newIcon,
        cornerToggle.querySelector(".ettpd-corner-select-icon"),
      );
      cornerIcon = newIcon;

      // Close menu
      cornerMenu.classList.remove("ettpd-corner-menu-open");
      cornerToggle.setAttribute("aria-expanded", "false");

      // Apply position
      if (!value) return;
      AppState.ui.downloaderPositionType = value;
      localStorage.setItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE, value);
      applyCornerPosition(wrapper, value);
    };

    cornerMenu.appendChild(item);
  });

  cornerSelectorWrapper.appendChild(cornerMenu);

  // Toggle open/close on button click
  cornerToggle.onclick = (e) => {
    e.stopPropagation();
    const isOpen = cornerMenu.classList.toggle("ettpd-corner-menu-open");
    cornerToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!cornerSelectorWrapper.contains(e.target)) {
      cornerMenu.classList.remove("ettpd-corner-menu-open");
      cornerToggle.setAttribute("aria-expanded", "false");
    }
  });

  // Helper to set the selected corner value programmatically
  const setCornerValue = (val) => {
    selectedCornerValue = val;
    const match =
      cornerOptions.find((o) => o.value === val) ||
      cornerOptions[cornerOptions.length - 1];
    const newIcon = createIcon(match.icon, 14);
    newIcon.setAttribute("class", "ettpd-corner-select-icon");
    const oldIcon = cornerToggle.querySelector(".ettpd-corner-select-icon");
    if (oldIcon) cornerToggle.replaceChild(newIcon, oldIcon);
    cornerIcon = newIcon;

    cornerMenu.querySelectorAll(".ettpd-corner-menu-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.value === val);
    });
  };

  // Expose on wrapper so the drag handler can reset to "none" on custom positioning
  wrapper._setCornerValue = setCornerValue;

  const powerButton = createHeaderPowerButton();

  // Create leaderboard icon button
  const leaderboardBtn = document.createElement("button");
  leaderboardBtn.type = "button";
  leaderboardBtn.className = "ettpd-icon-btn ettpd-leaderboard-btn";
  bindText(leaderboardBtn, "leaderboard", {}, "title");
  bindText(leaderboardBtn, "leaderboard", {}, "aria-label");
  replaceElementHtml(
    leaderboardBtn,
    `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="11" width="3" height="7" rx="1.5" fill="currentColor" />
      <rect x="10.5" y="7" width="3" height="11" rx="1.5" fill="currentColor" />
      <rect x="17" y="9" width="3" height="9" rx="1.5" fill="currentColor" />
    </svg>
  `,
  );
  leaderboardBtn.onclick = showStatsPopUp;

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "ettpd-icon-btn ettpd-share-btn";
  bindText(shareBtn, "share", {}, "title");
  bindText(shareBtn, "share", {}, "aria-label");
  replaceElementHtml(
    shareBtn,
    `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="17" cy="5" r="2.3" />
        <circle cx="7" cy="12" r="2.3" />
        <circle cx="17" cy="19" r="2.3" />
        <path d="M9.3 11l5.4-3.2M9.3 13l5.4 3.2" />
      </g>
    </svg>
  `,
  );
  shareBtn.onclick = showShareOptions;

  // Append all UI elements
  const controlBar = document.createElement("div");
  controlBar.className = "ettpd-handle-controls";
  controlBar.appendChild(cornerSelectorWrapper);
  controlBar.appendChild(dragHandle);
  controlBar.appendChild(leaderboardBtn);
  controlBar.appendChild(shareBtn);
  controlBar.appendChild(createLanguageControl("ettpd-icon-btn", { getTheme: getResolvedThemeMode }));
  controlBar.appendChild(powerButton);
  wrapper.appendChild(controlBar);
  if (!wrapper || !wrapper.style) return;
  console.warn(wrapper, "STYLE", wrapper.style);
  // Restore pinned position if exists
  const saved =
    localStorage.getItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE) ||
    "bottom-left";

  // Set initial select value and icon
  if (saved && saved !== "custom") {
    setCornerValue(saved);
  }

  if (saved === "custom") {
    const pos = readStoredPosition(AppState.ui.live_ETTPD_CUSTOM_POS);
    console.log("POS: ", pos);
    if (pos) {
      wrapper.style.left = `${pos.left}px`;
      wrapper.style.top = `${pos.top}px`;
      wrapper.style.bottom = "auto";
      wrapper.style.right = "auto";
    } else applyCornerPosition(wrapper, "bottom-left");
    console.log("not applyCornerPosition-->", pos);
  } else if (saved) {
    applyCornerPosition(wrapper, saved);
  }

  // Enable dragging + save pinned position on pin
  makeElementDraggable(wrapper, dragHandle);

  // Ensure wrapper is constrained to viewport after position is restored
  // Use setTimeout to ensure wrapper is in DOM before constraining
  setTimeout(() => {
    constrainWrapperToViewport(wrapper);

    // If using custom position, update saved position with constrained values
    if (saved === "custom") {
      const pos = constrainWrapperToViewport(wrapper);
      if (pos) {
        AppState.ui.live_ETTPD_CUSTOM_POS = JSON.stringify(pos);
        localStorage.setItem(
          STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION,
          AppState.ui.live_ETTPD_CUSTOM_POS,
        );
      }
    }
  }, 0);
  return wrapper;
}

/**
 * Create a container showing resumable downloads for the current user
 * @param {Object} pageInfo - Page information from isOnProfileOrCollectionPage()
 * @param {Array} tabOptions - Available tab options
 * @returns {Promise<HTMLElement|null>} Container element or null if no resumable downloads
 */
async function createResumableDownloadsContainer(pageInfo, tabOptions) {
  try {
    const username = getCurrentPageUsername();
    if (!username || username === "😃") {
      return null;
    }

    const allProgress = await getAllProgress();
    const normalizedUsername = username.toLowerCase().trim();
    const userProgress = allProgress[normalizedUsername];

    if (!userProgress) {
      return null;
    }

    // Map standard tab keys to display names
    const standardTabs = {
      videos: "Videos",
      reposts: "Reposts",
      liked: "Likes",
      favorites: "Favorites",
    };

    // Find tabs with existing downloads
    const resumableTabs = [];
    for (const [tabKey, videoIds] of Object.entries(userProgress)) {
      if (Array.isArray(videoIds) && videoIds.length > 0) {
        // Check if this is a standard tab
        if (standardTabs[tabKey]) {
          // Check if this tab is available in tabOptions
          const tabOption = tabOptions.find((opt) => opt.key === tabKey);
          if (tabOption) {
            resumableTabs.push({
              key: tabKey,
              label: standardTabs[tabKey],
              count: videoIds.length,
              isCollection: false,
            });
          }
        } else {
          // This is likely a collection (collection name is used as tabKey)
          // Only show collections when we're on that specific collection page
          if (!pageInfo.isCollection) {
            // Skip collections when not on a collection page
            continue;
          }

          // Check if we have a collection tab option
          const collectionTabOption = tabOptions.find(
            (opt) => opt.key === "collection",
          );
          if (collectionTabOption && pageInfo.collectionName) {
            // Decode and format the stored collection name for comparison
            let storedCollectionName = tabKey;
            try {
              // Try to decode if it's URL encoded
              storedCollectionName = decodeURIComponent(tabKey);
            } catch (e) {
              // If decoding fails, use the original tabKey
              storedCollectionName = tabKey;
            }
            // Remove the numeric suffix for comparison (e.g., "Summer of Sports-7394627756635573022" -> "Summer of Sports")
            storedCollectionName = storedCollectionName.replace(/-\d+$/, "");

            // Get the current collection name (also remove numeric suffix for comparison)
            let currentCollectionName = pageInfo.collectionName.replace(
              /-\d+$/,
              "",
            );

            // Only show if this collection matches the current page's collection
            if (storedCollectionName === currentCollectionName) {
              // Decode and format the collection name for display
              let displayName = tabKey;
              try {
                displayName = decodeURIComponent(tabKey);
              } catch (e) {
                displayName = tabKey;
              }
              displayName = displayName.replace(/-\d+$/, "");

              // Skip if it's the generic "collection" string
              if (displayName && displayName !== "collection") {
                resumableTabs.push({
                  key: "collection",
                  label: displayName, // Use the formatted collection name as label
                  count: videoIds.length,
                  isCollection: true,
                  collectionName: tabKey, // Store the actual collection name (original tabKey)
                });
              }
            }
          }
        }
      }
    }

    if (resumableTabs.length === 0) {
      return null;
    }

    // Create container
    const container = document.createElement("div");
    container.className = "ettpd-resume-downloads-container";

    // Title
    const title = document.createElement("div");
    title.className = "ettpd-resume-downloads-title";
    bindText(title, "resume");
    container.appendChild(title);

    // List of resumable downloads
    const list = document.createElement("div");
    list.className = "ettpd-resume-downloads-list";

    for (const tab of resumableTabs) {
      const item = document.createElement("div");
      item.className = "ettpd-resume-download-item";

      const label = document.createElement("span");
      label.className = "ettpd-resume-download-label";
      bindText(label, "scanRecorded", () => ({ list: tab.isCollection ? tab.label : t(tab.key), count: tab.count }));
      item.appendChild(label);

      const resumeBtn = document.createElement("button");
      setLocalizedButton(resumeBtn, "resume", "play");
      resumeBtn.className = "ettpd-pref-btn primary ettpd-resume-downloads-btn";

      resumeBtn.onclick = async () => {
        // Set the selected tab
        AppState.scrapperDetails.selectedTab = tab.key;
        if (tab.isCollection && tab.collectionName) {
          AppState.scrapperDetails.selectedCollectionName = tab.collectionName;
        }

        // Start the scrapping process directly
        await startScrappingProcess(tab.key, pageInfo);
      };

      item.appendChild(resumeBtn);
      list.appendChild(item);
    }

    container.appendChild(list);
    return container;
  } catch (err) {
    console.error("[Resume Downloads] Error creating container:", err);
    return null;
  }
}

/**
 * Render ultra-compact active scrapping session view
 * Single-line status with inline pause button
 */
function renderActiveScrappingView() {
  // Check if we're still on the same user's page
  const currentUsername = getCurrentPageUsername();
  const originalUsername = AppState.scrapperDetails.originalUsername;

  // If we're on a different user's page, reset the state
  if (
    originalUsername !== null &&
    currentUsername !== originalUsername &&
    currentUsername !== "😃"
  ) {
    // Clear the active state since we're on a different user
    AppState.scrapperDetails.scrappingStage = null;
    AppState.scrapperDetails.selectedTab = null;
    AppState.scrapperDetails.selectedCollectionName = null;
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );

    // Re-render with stepper view
    showScrapperControls();
    return document.createElement("div"); // Return empty container, will be replaced
  }

  const container = document.createElement("div");
  container.className = "ettpd-progress-compact";
  container.id = "ettpd-progress-compact-container";

  // Create single-line status display
  const statusLine = document.createElement("div");
  statusLine.className = "ettpd-progress-compact-line";
  statusLine.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    padding: 4px 8px;
  `;

  // Left section: Tab name
  const tabName = document.createElement("span");
  tabName.className = "ettpd-progress-tab-name";
  const selectedTabKey = AppState.scrapperDetails.selectedTab;
  if (["videos", "liked", "reposts", "favorites"].includes(selectedTabKey)) bindText(tabName, selectedTabKey);
  else bindText(tabName, "displayName", () => ({ name: AppState.scrapperDetails.selectedCollectionName || t("autoScroll") }));

  // Center section: Status info
  const statusInfo = document.createElement("span");
  statusInfo.className = "ettpd-progress-status-info";
  statusInfo.id = "ettpd-progress-status-info";

  // Right section: Pause button
  const pauseBtn = document.createElement("button");
  pauseBtn.className = "ettpd-progress-pause-btn";
  setButtonWithIcon(
    pauseBtn,
    "",
    AppState.scrapperDetails.paused ? "play" : "pause",
  );
  bindText(pauseBtn, AppState.scrapperDetails.paused ? "resume" : "pause", {}, "title");
  pauseBtn.style.cssText = `
    background: ${AppState.scrapperDetails.paused ? "#007AFF" : "#FF9500"};
    color: white;
    border: none;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    height: 20px;
    min-width: 32px;
    transition: background 0.2s;
    flex-shrink: 0;
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
      AppState.downloadPreferences.autoScrollMode = "off";
      setButtonWithIcon(pauseBtn, "", "play");
      bindText(pauseBtn, "resume", {}, "title");
      pauseBtn.style.background = "#007AFF";
    } else {
      AppState.downloadPreferences.autoScrollMode = "always";
      setButtonWithIcon(pauseBtn, "", "pause");
      bindText(pauseBtn, "pause", {}, "title");
      pauseBtn.style.background = "#FF9500";
    }
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );
    pauseBtn.onmouseover = () => {
      pauseBtn.style.background = AppState.scrapperDetails.paused
        ? "#0056CC"
        : "#E68500";
    };
  };

  // Cache for previously downloaded videoIds list, scoped to username+tab
  let cachedPreviouslyDownloadedVideoIds = null;
  let cachedContextKey = null;
  let isLoadingPreviouslyDownloadedVideoIds = false;

  // Update status info function
  const updateStatusInfo = () => {
    const discovered = AppState.allDirectLinks.length;
    const currentBatch = AppState.scrapperDetails.currentBatch || 1;
    const isDownloading = AppState.downloading.isDownloadingAll;
    const isAutoBatch = AppState.scrapperDetails.isAutoBatchDownloading;
    const skipDownloaded = AppState.scrapperDetails.skipDownloaded;
    const isDiscovering = AppState.scrapperDetails.scrappingStage === "ongoing";

    // When skipDownloaded is enabled, load previously downloaded videoIds based on current context
    const username = AppState.scrapperDetails.originalUsername;
    const tabName =
      AppState.scrapperDetails.selectedTab === "collection"
        ? AppState.scrapperDetails.selectedCollectionName
        : AppState.scrapperDetails.selectedTab;
    const contextKey = `${username}:${tabName}`;

    // If context changed, reset cache
    if (cachedContextKey !== contextKey) {
      cachedPreviouslyDownloadedVideoIds = null;
      cachedContextKey = contextKey;
      isLoadingPreviouslyDownloadedVideoIds = false;
    }

    // When skipDownloaded is enabled, count discovered items that were previously downloaded
    // Fall back to session downloads if list is not available yet
    let downloaded; // A: Count of downloaded items (as they are being discovered)
    let maxCount; // B: Max of (total previously downloaded ever, discovered items in session)

    if (skipDownloaded) {
      // Load previously downloaded videoIds list asynchronously if not cached and not already loading
      if (
        cachedPreviouslyDownloadedVideoIds === null &&
        !isLoadingPreviouslyDownloadedVideoIds &&
        username &&
        username !== "😃" &&
        tabName
      ) {
        isLoadingPreviouslyDownloadedVideoIds = true;
        loadProgress(username, tabName)
          .then((progress) => {
            cachedPreviouslyDownloadedVideoIds = progress || [];
            isLoadingPreviouslyDownloadedVideoIds = false;
            // Update the status display with the new value
            updateStatusInfo();
          })
          .catch(() => {
            cachedPreviouslyDownloadedVideoIds = [];
            isLoadingPreviouslyDownloadedVideoIds = false;
            updateStatusInfo();
          });
      }

      // When skipDownloaded is enabled, downloader skips previously downloaded items
      // So A = items downloaded in this session (session downloads only)
      downloaded =
        AppState.downloadedURLs.length ||
        AppState.scrapperDetails.downloadedInBatches ||
        0;

      // B = Max of (total previously downloaded ever, discovered items in this session)
      if (cachedPreviouslyDownloadedVideoIds !== null) {
        const totalPreviouslyDownloadedCount =
          cachedPreviouslyDownloadedVideoIds.length;
        maxCount = Math.max(totalPreviouslyDownloadedCount, discovered);
      } else {
        // While loading, use discovered as maxCount
        maxCount = discovered;
      }

      // Ensure A never exceeds B
      downloaded = Math.min(downloaded, maxCount);
    } else {
      // Normal case: count discovered items downloaded in this session
      const sessionDownloadedUrlsSet = new Set(AppState.downloadedURLs);
      downloaded = AppState.allDirectLinks.filter((item) =>
        sessionDownloadedUrlsSet.has(item.url),
      ).length;
      // B = discovered items in this session
      maxCount = discovered;
      // Ensure A never exceeds discovered
      downloaded = Math.min(downloaded, discovered);
    }

    bindText(statusInfo, "scanProgress", () => ({ current: downloaded, total: skipDownloaded && isDiscovering ? maxCount : discovered, phase: t(AppState.scrapperDetails.paused ? "paused" : isDiscovering ? "loading" : isDownloading ? "download" : "ready") }));
  };

  updateStatusInfo();

  // Assemble the line
  statusLine.appendChild(tabName);
  statusLine.appendChild(statusInfo);
  statusLine.appendChild(pauseBtn);
  container.appendChild(statusLine);

  // Update progress periodically
  const progressInterval = setInterval(() => {
    if (!document.getElementById("ettpd-progress-compact-container")) {
      clearInterval(progressInterval);
      return;
    }

    // Check if scrapping has completed
    if (
      AppState.scrapperDetails.scrappingStage === "completed" &&
      AppState.ui.isScrapperBoxOpen
    ) {
      clearInterval(progressInterval);
      showScrapperControls();
      return;
    }

    // Update pause button state if changed externally
    const shouldBePaused = AppState.scrapperDetails.paused;
    const isCurrentlyPaused =
      pauseBtn.querySelector("svg") &&
      pauseBtn
        .querySelector("svg")
        .innerHTML.includes('polygon points="5 3 19 12 5 21 5 3"');
    if (shouldBePaused !== isCurrentlyPaused) {
      setButtonWithIcon(pauseBtn, "", shouldBePaused ? "play" : "pause");
      bindText(pauseBtn, shouldBePaused ? "resume" : "pause", {}, "title");
      pauseBtn.style.background = shouldBePaused ? "#007AFF" : "#FF9500";
    }

    updateStatusInfo();
  }, 2000);

  return container;
}

/**
 * Render completed session view
 */
async function renderCompletedView() {
  const completionContainer = document.createElement("div");
  completionContainer.className = "ettpd-scrapper-completion";

  // Check if we're still on the same user's page
  const currentUsername = getCurrentPageUsername();
  const originalUsername = AppState.scrapperDetails.originalUsername;

  // If we're on a different user's page, reset the state and show stepper view instead
  if (
    originalUsername !== null &&
    currentUsername !== originalUsername &&
    currentUsername !== "😃"
  ) {
    // Clear the completed state since we're on a different user
    AppState.scrapperDetails.scrappingStage = null;
    AppState.scrapperDetails.selectedTab = null;
    AppState.scrapperDetails.selectedCollectionName = null;
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );

    // Re-render with stepper view
    showScrapperControls();
    return document.createElement("div"); // Return empty container, will be replaced
  }

  // Safety check: verify evidence exists (in case validation in showScrapperControls missed something)
  const selectedTab = AppState.scrapperDetails.selectedTab;
  const hasEvidenceOfCompletion = selectedTab
    ? await hasEvidence(currentUsername, selectedTab)
    : false;

  if (!hasEvidenceOfCompletion) {
    // No evidence - clear state and show stepper view instead
    AppState.scrapperDetails.scrappingStage = null;
    AppState.scrapperDetails.selectedTab = null;
    AppState.scrapperDetails.selectedCollectionName = null;
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );

    // Re-render with stepper view
    showScrapperControls();
    return document.createElement("div"); // Return empty container, will be replaced
  }

  const continueBtn = document.createElement("button");
  continueBtn.className = "ettpd-scrapper-continue-btn";
  setLocalizedButton(continueBtn, "continue", "play");
  continueBtn.style.cssText = `
    background: #007AFF;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
    margin-bottom: 8px;
    transition: background 0.2s;
  `;

  continueBtn.onmouseover = () => {
    continueBtn.style.background = "#0056CC";
  };
  continueBtn.onmouseout = () => {
    continueBtn.style.background = "#007AFF";
  };

  continueBtn.onclick = () => {
    AppState.scrapperDetails.scrappingStage = "ongoing";
    AppState.scrapperDetails.paused = false;
    AppState.downloadPreferences.autoScrollMode = "always";
    AppState.downloading.isDownloadingAll = false;
    AppState.downloading.isActive = false;
    AppState.scrapperDetails.isAutoBatchDownloading = false;

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );

    startAutoBatchDownloads();
    showScrapperControls();
  };

  const csvBtn = document.createElement("button");
  csvBtn.className = "ettpd-scrapper-continue-btn";
  setLocalizedButton(csvBtn, "downloadCsv", "download");
  csvBtn.style.cssText = `
    background: #f0f0f0;
    color: #333;
    border: 1px solid #ddd;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
    margin-bottom: 8px;
    transition: background 0.2s;
  `;

  csvBtn.onmouseover = () => {
    csvBtn.style.background = "#e0e0e0";
  };
  csvBtn.onmouseout = () => {
    csvBtn.style.background = "#f0f0f0";
  };

  csvBtn.onclick = () => {
    const allItems = AppState.allDirectLinks || [];
    const downloadedItems = allItems.filter((item) =>
      AppState.downloadedURLs.includes(item.url),
    );

    if (downloadedItems.length === 0) {
      showToast(
        t("exportEmpty"),
        t("exportEmpty"),
      );
      return;
    }

    saveCSVFile(downloadedItems);
    showToast(
      t("downloadCsv"),
      t("itemsCount", { count: downloadedItems.length }),
    );
  };

  const endBtn = document.createElement("button");
  endBtn.className = "ettpd-scrapper-continue-btn";
  bindText(endBtn, "stop");
  endBtn.style.cssText = `
    background: #ff3b30;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
    transition: background 0.2s;
  `;

  endBtn.onmouseover = () => {
    endBtn.style.background = "#d32f2f";
  };
  endBtn.onmouseout = () => {
    endBtn.style.background = "#ff3b30";
  };

  endBtn.onclick = () => {
    AppState.scrapperDetails.scrappingStage = "completed";
    AppState.scrapperDetails.isAutoBatchDownloading = false;
    AppState.scrapperDetails.selectedTab = null;
    AppState.scrapperDetails.selectedCollectionName = null;
    AppState.scrapperDetails.paused = false;
    AppState.downloadPreferences.autoScrollMode = "off";
    AppState.downloading.isDownloadingAll = false;
    AppState.downloading.isActive = false;
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;

    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );

    showScrapperControls();
    updateDownloadButtonLabelSimple();
  };

  completionContainer.appendChild(continueBtn);
  completionContainer.appendChild(csvBtn);
  completionContainer.appendChild(endBtn);

  // Add section for scraping other tabs
  const pageInfo = isOnProfileOrCollectionPage();
  if (pageInfo.isProfile || pageInfo.isCollection) {
    // Get available tabs
    const spans = await getTabSpans(5 * 1000); // 5 seconds wait
    const tabOptions = [
      { key: "videos", label: t("videos"), icon: "video" },
      { key: "reposts", label: t("reposts"), icon: "repost" },
      { key: "liked", label: t("liked"), icon: "heart" },
      { key: "favorites", label: t("favorites"), icon: "star" },
      {
        key: "collection",
        label: t("scanList", { list: spans.collection || pageInfo.collectionName || "Collection" }),
        icon: "folder",
      },
    ];

    // Filter available tabs from DOM
    const availableTabs = tabOptions.filter(({ key }) => {
      const span = spans[key];
      if (!span) return false;
      if (typeof span === "string") {
        return span.trim().length > 0;
      }
      return !!span.offsetParent;
    });

    // Filter out the currently completed tab
    const otherTabs = availableTabs.filter((tab) => tab.key !== selectedTab);

    if (otherTabs.length > 0) {
      const separator = document.createElement("div");
      separator.style.cssText = `
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--ettpd-border-color, #e0e0e0);
      `;

      const otherTabsTitle = document.createElement("div");
      otherTabsTitle.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        color: var(--ettpd-text-secondary, #666);
        margin-bottom: 10px;
        text-align: center;
      `;
      bindText(otherTabsTitle, "downloadOtherTabs");
      separator.appendChild(otherTabsTitle);

      const tabsGrid = document.createElement("div");
      tabsGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
      `;

      otherTabs.forEach(({ key, label, icon }) => {
        const btn = document.createElement("button");
        btn.className = `ettpd-tab-btn ettpd-tab-btn-${key}`;
        btn.dataset.tabKey = key;
        btn.style.cssText = `
          padding: 8px 12px;
          border: 1px solid var(--ettpd-border-color, #ddd);
          border-radius: 6px;
          background: var(--ettpd-bg-secondary, #f5f5f5);
          color: var(--ettpd-text-primary, #333);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        `;

        const iconEl = icon ? createIcon(icon, 14) : null;
        if (iconEl) {
          btn.appendChild(iconEl);
        }
        setLocalizedButton(btn, key, icon);

        btn.onmouseover = () => {
          btn.style.background = "var(--ettpd-button-primary, #007AFF)";
          btn.style.color = "#fff";
          btn.style.borderColor = "var(--ettpd-button-primary, #007AFF)";
        };
        btn.onmouseout = () => {
          btn.style.background = "var(--ettpd-bg-secondary, #f5f5f5)";
          btn.style.color = "var(--ettpd-text-primary, #333)";
          btn.style.borderColor = "var(--ettpd-border-color, #ddd)";
        };

        btn.onclick = async () => {
          // Reset current completion state
          AppState.scrapperDetails.scrappingStage = null;
          AppState.scrapperDetails.selectedTab = null;
          AppState.scrapperDetails.selectedCollectionName = null;
          AppState.scrapperDetails.paused = false;
          AppState.downloadPreferences.autoScrollMode = "off";
          AppState.downloading.isDownloadingAll = false;
          AppState.downloading.isActive = false;
          AppState.scrapperDetails.isAutoBatchDownloading = false;

          // Set new tab
          if (key === "collection") {
            AppState.scrapperDetails.selectedCollectionName =
              pageInfo.collectionName || spans.collection || "Collection";
          }
          AppState.scrapperDetails.selectedTab = key;

          // Save state
          localStorage.setItem(
            STORAGE_KEYS.SCRAPPER_DETAILS,
            JSON.stringify(AppState.scrapperDetails),
          );

          // Start scraping the new tab
          await startScrappingProcess(key, pageInfo);
        };

        tabsGrid.appendChild(btn);
      });

      separator.appendChild(tabsGrid);
      completionContainer.appendChild(separator);
    }
  }

  return completionContainer;
}

/**
 * Show a one-time hint modal explaining that users can customise where downloads go.
 * Resolves to "configure" if the user wants to open the template modal,
 * or "continue" if they're happy with defaults.
 */
function showFilePathHintModal() {
  return new Promise((resolve) => {
    // Mark as seen immediately
    AppState.ui.hasSeenFilePathHint = true;
    try {
      localStorage.setItem(STORAGE_KEYS.FILE_PATH_HINT_SEEN, "true");
    } catch {}

    const content = document.createElement("div");
    replaceElementHtml(
      content,
      `
      <div style="text-align:center;margin-bottom:10px;">
        <span style="font-size:28px;">📂</span>
      </div>
      <div class="alert" style="text-align:left;">
        <strong data-i18n="templateLocation"></strong><br><br>
        <p data-i18n="templateDefaultLocation"></p>
        <code style="font-size:11px;background:var(--ettpd-bg-secondary,#eee);padding:2px 6px;border-radius:4px;display:inline-block;margin:6px 0;">
          @username-Videos-2025-01-01-cool-video-12345.mp4
        </code><br><br>
        <p data-i18n="templateIntro"></p>
        <span data-i18n="settings"></span> → <span data-i18n="templateTitle"></span>
      </div>
    `,
    );

    const actionsContainer = document.createElement("div");
    actionsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 16px;
      justify-content: center;
      flex-wrap: wrap;
    `;

    const continueBtn = document.createElement("button");
    continueBtn.className = "ettpd-modal-button secondary";
    bindText(continueBtn, "continue");
    continueBtn.onclick = () => {
      const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
      if (overlay) overlay.remove();
      resolve("continue");
    };

    const configureBtn = document.createElement("button");
    configureBtn.className = "ettpd-modal-button primary";
    setLocalizedButton(configureBtn, "templateTitle", "settings");
    configureBtn.onclick = () => {
      const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
      if (overlay) overlay.remove();
      resolve("configure");
    };

    actionsContainer.appendChild(continueBtn);
    actionsContainer.appendChild(configureBtn);

    createModal({
      children: [content, actionsContainer],
      onClose: () => resolve("continue"),
    });
  });
}

async function startScrappingProcess(tabKey, pageInfo) {
  // Show one-time file path hint for first-time users
  if (!AppState.ui.hasSeenFilePathHint) {
    const choice = await showFilePathHintModal();
    if (choice === "configure") {
      createFilenameTemplateModal();
      return; // Let them configure first; they can start scrapping after
    }
  }

  const username = getCurrentPageUsername();
  const tabName =
    tabKey === "collection"
      ? AppState.scrapperDetails.selectedCollectionName ||
        pageInfo.collectionName ||
        "collection"
      : tabKey;

  if (username && username !== "😃") {
    try {
      const existingProgress = await loadProgress(username, tabName);
      if (existingProgress && existingProgress.length > 0) {
        const userChoice = await showDownloadConfirmationModal(
          username,
          tabName,
          existingProgress.length,
        );

        if (userChoice === "cancel") {
          return;
        }

        AppState.scrapperDetails.skipDownloaded = userChoice === "skip";
      } else {
        AppState.scrapperDetails.skipDownloaded = false;
      }
    } catch (err) {
      console.warn("[Scrapper] Failed to check progress:", err);
      AppState.scrapperDetails.skipDownloaded = false;
    }
  } else {
    AppState.scrapperDetails.skipDownloaded = false;
  }

  AppState.scrapperDetails.startedAt = Date.now();
  AppState.scrapperDetails.scrappingStage = "initiated";
  AppState.scrapperDetails.paused = false;
  AppState.scrapperDetails.locked = true;
  AppState.scrapperDetails.originalPath = window.location.pathname;
  AppState.scrapperDetails.originalUsername = getCurrentPageUsername();
  if (pageInfo.isCollection) {
    AppState.scrapperDetails.originalCollectionName = pageInfo.collectionName;
    // Store collection URL in progress storage for resume functionality
    const username = getCurrentPageUsername();
    const collectionName = pageInfo.collectionName;
    if (username && username !== "😃" && collectionName) {
      // Get existing progress to preserve videoIds
      loadProgress(username, collectionName).then((existingVideoIds) => {
        // Save with collection URL metadata
        saveProgress(
          username,
          collectionName,
          existingVideoIds || [],
          window.location.pathname,
        );
      });
    }
  }

  localStorage.setItem(
    STORAGE_KEYS.SCRAPPER_DETAILS,
    JSON.stringify(AppState.scrapperDetails),
  );

  window.location.href = window.location.pathname;
}

/**
 * Create stepper view with progressive disclosure
 * Step 1: Resume downloads (if available)
 * Step 2: Tab selection (if no tab selected)
 * Step 3: Start action (after tab selected)
 */
async function createStepperView(pageInfo, tabOptions, spans) {
  const stepperContainer = document.createElement("div");
  stepperContainer.className = "ettpd-stepper-container";

  // Show warning if not on a profile or collection page
  if (!pageInfo.isProfile) {
    const warningContainer = document.createElement("div");
    warningContainer.className = "ettpd-stepper-warning";
    warningContainer.style.cssText = `
      padding: 15px;
      margin-bottom: 15px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      text-align: center;
    `;
    const warningText = document.createElement("p");
    warningText.style.cssText = `
      margin: 0;
      font-size: 13px;
      color: #856404;
      line-height: 1.5;
    `;
    replaceElementHtml(
      warningText,
      '<p data-i18n="scanProfileRequired"></p>',
    );
    warningContainer.appendChild(warningText);
    stepperContainer.appendChild(warningContainer);
    return stepperContainer;
  }

  // Stepper indicator
  const indicator = document.createElement("div");
  indicator.className = "ettpd-stepper-indicator";

  // Get resumable downloads
  const resumableContainer = await createResumableDownloadsContainer(
    pageInfo,
    tabOptions,
  );
  const hasResumableDownloads = resumableContainer !== null;
  const hasSelectedTab = AppState.scrapperDetails.selectedTab !== null;

  // Determine current step
  let currentStep = 1;
  const totalSteps = hasResumableDownloads ? 3 : 2;

  if (hasSelectedTab) {
    // Tab already selected, show start action (step 3 if resumable exists, step 2 if not)
    currentStep = hasResumableDownloads ? 3 : 2;
  } else if (hasResumableDownloads) {
    // Has resumable downloads but no tab selected, show resume step
    currentStep = 1;
  } else {
    // No resumable downloads and no tab selected, show tab selection
    currentStep = 1; // This will be step 1 of 2 (tab selection)
  }

  // Update indicator
  replaceElementHtml(
    indicator,
    `
    <div class="ettpd-stepper-dots">
      ${Array.from(
        { length: totalSteps },
        (_, i) =>
          `<span class="ettpd-stepper-dot ${
            i + 1 === currentStep
              ? "active"
              : i + 1 < currentStep
                ? "completed"
                : ""
          }"></span>`,
      ).join("")}
    </div>
  `,
  );
  stepperContainer.appendChild(indicator);

  // Step 1: Resume Downloads (only show if no tab selected yet)
  if (hasResumableDownloads && !hasSelectedTab && currentStep === 1) {
    const step1 = document.createElement("div");
    step1.className = "ettpd-stepper-step";
    step1.appendChild(resumableContainer);

    // Get available tabs from DOM
    const availableTabs = tabOptions.filter(({ key }) => {
      const span = spans[key];
      if (!span) return false;
      if (typeof span === "string") {
        return span.trim().length > 0;
      }
      return !!span.offsetParent;
    });

    // Get list of resumable tab keys
    const allProgress = await getAllProgress();
    const currentUsername = getCurrentPageUsername();
    const normalizedUsername = currentUsername?.toLowerCase().trim();
    const userProgress = normalizedUsername
      ? allProgress[normalizedUsername]
      : null;

    const resumableTabKeys = new Set();
    if (userProgress) {
      for (const [tabKey, videoIds] of Object.entries(userProgress)) {
        if (Array.isArray(videoIds) && videoIds.length > 0) {
          const standardTabs = ["videos", "reposts", "liked", "favorites"];
          if (standardTabs.includes(tabKey)) {
            resumableTabKeys.add(tabKey);
          } else {
            // Collection tabs - only add if it matches the current collection name
            if (pageInfo.isCollection && pageInfo.collectionName) {
              // Decode and normalize the stored collection name for comparison
              let storedCollectionName = tabKey;
              try {
                storedCollectionName = decodeURIComponent(tabKey);
              } catch (e) {
                // If decoding fails, use the original tabKey
              }
              // Remove numeric suffix for comparison
              storedCollectionName = storedCollectionName.replace(/-\d+$/, "");

              // Get the current collection name (also remove numeric suffix for comparison)
              const currentCollectionName = pageInfo.collectionName.replace(
                /-\d+$/,
                "",
              );

              // Only add if the collection name matches
              if (storedCollectionName === currentCollectionName) {
                resumableTabKeys.add("collection");
              }
            }
          }
        }
      }
    }

    // Filter out tabs that are already resumable - show only tabs for new downloads
    const tabsForNewDownloads = availableTabs.filter(
      (tab) => !resumableTabKeys.has(tab.key),
    );

    // Show other available tabs for new downloads
    if (tabsForNewDownloads.length > 0) {
      const separator = document.createElement("div");
      separator.style.margin = "16px 0 8px 0";
      separator.style.paddingTop = "10px";
      separator.style.borderTop =
        "1px solid var(--ettpd-border-color, #e0e0e0)";

      const newDownloadsTitle = document.createElement("div");
      newDownloadsTitle.className = "ettpd-resume-downloads-title";
      bindText(newDownloadsTitle, "downloadOtherTabs");
      newDownloadsTitle.style.marginBottom = "10px";
      separator.appendChild(newDownloadsTitle);

      const tabsGrid = document.createElement("div");
      tabsGrid.className = "ettpd-tabs-compact";

      tabsForNewDownloads.forEach(({ key, label, icon }) => {
        const btn = document.createElement("button");
        btn.className = `ettpd-tab-btn ettpd-tab-btn-${key}`;
        btn.dataset.tabKey = key;
        const iconEl = icon ? createIcon(icon, 16).outerHTML : "";
        replaceElementHtml(
          btn,
          `
          <span class="ettpd-tab-check" aria-hidden="true">✓</span>
          <span class="ettpd-tab-label">${
            iconEl
              ? `<span style="display:inline-block;margin-right:4px;vertical-align:middle;">${iconEl}</span>`
              : ""
          }${escapeHtml(label)}</span>
        `,
        );
        btn.setAttribute("aria-pressed", "false");

        btn.addEventListener("click", () => {
          // Remove active state from other buttons
          tabsGrid.querySelectorAll(".ettpd-tab-btn.active").forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });

          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");

          if (key === "collection") {
            // Use the actual collection name from pageInfo (not spans which might have path issues)
            AppState.scrapperDetails.selectedCollectionName =
              pageInfo.collectionName || spans.collection || "Collection";
          }

          AppState.scrapperDetails.selectedTab = key;

          // Save state
          localStorage.setItem(
            STORAGE_KEYS.SCRAPPER_DETAILS,
            JSON.stringify(AppState.scrapperDetails),
          );

          // Refresh controls to show Step 3 (start action)
          showScrapperControls();
        });

        tabsGrid.appendChild(btn);
      });

      separator.appendChild(tabsGrid);
      step1.appendChild(separator);
    }

    // Show refresh button if not all tabs are available
    const allTabsAvailable = availableTabs.length === tabOptions.length;
    if (!allTabsAvailable && pageInfo.isProfile) {
      const refreshTabsBtn = document.createElement("button");
      setLocalizedButton(refreshTabsBtn, "checkTabs", "refresh");
      refreshTabsBtn.className = "ettpd-refresh-tabs-btn";
      refreshTabsBtn.style.cssText = `
        background: #f0f0f0;
        color: #333;
        border: 1px solid #ddd;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
        margin-top: 15px;
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
        setLocalizedButton(refreshTabsBtn, "preparing", "hourglass");
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
            setLocalizedButton(refreshTabsBtn, "ready", "check");
            setTimeout(() => {
              showScrapperControls(); // Re-render with new tabs
            }, 500);
          } else {
            setLocalizedButton(
              refreshTabsBtn,
              "checkTabs",
              "refresh",
            );
            refreshTabsBtn.style.background = "#f0f0f0";
            // Show a brief message
            const originalContent = refreshTabsBtn.cloneNode(true);
            bindText(refreshTabsBtn, "noNewTabs");
            setTimeout(() => {
              refreshTabsBtn.replaceWith(originalContent);
            }, 2000);
          }
        } catch (err) {
          console.error("Error checking for tabs:", err);
          setLocalizedButton(
            refreshTabsBtn,
            "checkTabs",
            "refresh",
          );
          refreshTabsBtn.style.background = "#f0f0f0";
        } finally {
          isRefreshing = false;
          refreshTabsBtn.disabled = false;
        }
      };

      step1.appendChild(refreshTabsBtn);

      // Auto-click the button after 2 seconds
      setTimeout(() => {
        if (
          refreshTabsBtn &&
          refreshTabsBtn.offsetParent !== null &&
          !refreshTabsBtn.disabled
        ) {
          refreshTabsBtn.click();
        }
      }, 2000);
    }

    stepperContainer.appendChild(step1);
  }

  // Step 2: Tab Selection (show if no tab selected)
  if (
    !hasSelectedTab &&
    ((hasResumableDownloads && currentStep === 2) ||
      (!hasResumableDownloads && currentStep === 1))
  ) {
    const step2 = document.createElement("div");
    step2.className = "ettpd-stepper-step";

    const step2Label = document.createElement("div");
    step2Label.className = "ettpd-stepper-step-title";
    bindText(step2Label, "selectTab");
    step2.appendChild(step2Label);

    const tabsGrid = document.createElement("div");
    tabsGrid.className = "ettpd-tabs-compact";

    const availableTabs = tabOptions.filter(({ key }) => {
      const span = spans[key];
      if (!span) return false;
      if (typeof span === "string") {
        return span.trim().length > 0;
      }
      return !!span.offsetParent;
    });

    const tabsAvailable = availableTabs.length > 0;
    const allTabsAvailable = availableTabs.length === tabOptions.length;

    // Show refresh button if not all tabs are available (but at least some are)
    if (tabsAvailable && !allTabsAvailable && pageInfo.isProfile) {
      const refreshTabsBtn = document.createElement("button");
      setLocalizedButton(refreshTabsBtn, "checkTabs", "refresh");
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
        setLocalizedButton(refreshTabsBtn, "preparing", "hourglass");
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
            setLocalizedButton(refreshTabsBtn, "ready", "check");
            setTimeout(() => {
              showScrapperControls(); // Re-render with new tabs
            }, 500);
          } else {
            setLocalizedButton(
              refreshTabsBtn,
              "checkTabs",
              "refresh",
            );
            refreshTabsBtn.style.background = "#f0f0f0";
            // Show a brief message
            const originalContent = refreshTabsBtn.cloneNode(true);
            bindText(refreshTabsBtn, "noNewTabs");
            setTimeout(() => {
              refreshTabsBtn.replaceWith(originalContent);
            }, 2000);
          }
        } catch (err) {
          console.error("Error checking for tabs:", err);
          setLocalizedButton(
            refreshTabsBtn,
            "checkTabs",
            "refresh",
          );
          refreshTabsBtn.style.background = "#f0f0f0";
        } finally {
          isRefreshing = false;
          refreshTabsBtn.disabled = false;
        }
      };

      step2.appendChild(refreshTabsBtn);

      // Auto-click the button after 2 seconds
      setTimeout(() => {
        if (
          refreshTabsBtn &&
          refreshTabsBtn.offsetParent !== null &&
          !refreshTabsBtn.disabled
        ) {
          refreshTabsBtn.click();
        }
      }, 2000);
    }

    availableTabs.forEach(({ key, label, icon }) => {
      const btn = document.createElement("button");
      btn.className = `ettpd-tab-btn ettpd-tab-btn-${key}`;
      btn.dataset.tabKey = key;
      const iconEl = icon ? createIcon(icon, 16).outerHTML : "";
      replaceElementHtml(
        btn,
        `
        <span class="ettpd-tab-check" aria-hidden="true">✓</span>
        <span class="ettpd-tab-label">${
          iconEl
            ? `<span style="display:inline-block;margin-right:4px;vertical-align:middle;">${iconEl}</span>`
            : ""
        }${escapeHtml(label)}</span>
      `,
      );
      btn.setAttribute("aria-pressed", "false");

      btn.addEventListener("click", () => {
        document.querySelectorAll(".ettpd-tab-btn.active").forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });

        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");

        if (key === "collection") {
          // Use the actual collection name from pageInfo (not spans which might have path issues)
          AppState.scrapperDetails.selectedCollectionName =
            pageInfo.collectionName || spans.collection || "Collection";
        }

        AppState.scrapperDetails.selectedTab = key;
        showScrapperControls();
      });

      tabsGrid.appendChild(btn);
    });

    step2.appendChild(tabsGrid);
    stepperContainer.appendChild(step2);
  }

  // Step 3: Start Action
  if (
    hasSelectedTab &&
    (currentStep === 3 || (!hasResumableDownloads && currentStep === 2))
  ) {
    const step3 = document.createElement("div");
    step3.className = "ettpd-stepper-step";

    const selectedTabKey = AppState.scrapperDetails.selectedTab;
    const selectedTabLabel =
      tabOptions.find((t) => t.key === selectedTabKey)?.label ||
      toTitleCase(selectedTabKey);

    const step3Label = document.createElement("div");
    step3Label.className = "ettpd-stepper-step-title";
    bindText(step3Label, "templateSelected", { name: selectedTabLabel });
    step3.appendChild(step3Label);

    const actionsRow = document.createElement("div");
    actionsRow.className = "ettpd-stepper-actions";

    const startBtn = document.createElement("button");
    startBtn.className = "ettpd-scrapper-start";
    setLocalizedButton(startBtn, "start", "play");
    startBtn.onclick = async () => {
      await startScrappingProcess(selectedTabKey, pageInfo);
    };

    const infoBtn = document.createElement("button");
    infoBtn.className = "ettpd-scrapper-learn";
    setLocalizedButton(infoBtn, "info", "info");
    infoBtn.onclick = () => {
      explainerModal(toTitleCase(selectedTabKey));
    };

    actionsRow.appendChild(startBtn);
    actionsRow.appendChild(infoBtn);
    step3.appendChild(actionsRow);
    stepperContainer.appendChild(step3);
  }

  return stepperContainer;
}

/**
 * Check if there's evidence of a completed scrapping session
 * Progress-first: checks persisted progress data, then falls back to in-memory items
 * @param {string} username - The username to check progress for
 * @param {string} tabName - The tab name to check progress for
 * @returns {Promise<boolean>} True if evidence exists, false otherwise
 */
async function hasEvidence(username, tabName) {
  if (!username || username === "😃" || !tabName) {
    return false;
  }

  try {
    // Progress-first: check persisted progress data
    const progress = await loadProgress(username, tabName);
    if (progress && Array.isArray(progress) && progress.length > 0) {
      return true;
    }

    // Fallback: check in-memory items (may be empty after reload)
    const hasScrappedItems =
      AppState.allDirectLinks && AppState.allDirectLinks.length > 0;
    return hasScrappedItems;
  } catch (err) {
    console.warn("[hasEvidence] Error checking for evidence:", err);
    // Fallback to in-memory items on error
    return AppState.allDirectLinks && AppState.allDirectLinks.length > 0;
  }
}

export async function showScrapperControls() {
  const scrapperContainer = document.getElementById(
    DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER,
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

  // Check if we're on a profile or collection page (synchronous check)
  const pageInfo = isOnProfileOrCollectionPage();

  const spans = await getTabSpans(30 * 1000); // 30 seconds wait at most

  // Button Generator
  const tabOptions = [
    { key: "videos", label: t("videos"), icon: "video" },
    { key: "reposts", label: t("reposts"), icon: "repost" },
    { key: "liked", label: t("liked"), icon: "heart" },
    { key: "favorites", label: t("favorites"), icon: "star" },
    {
      key: "collection",
      label: t("scanList", { list: spans.collection || pageInfo.collectionName || "Collection" }),
      icon: "folder",
    },
  ];

  // Check if scrapping is already ongoing or downloading
  // Only consider active if scrappingStage is explicitly one of the active stages
  const isScrappingActive =
    AppState.scrapperDetails.scrappingStage == "ongoing" ||
    AppState.scrapperDetails.scrappingStage == "downloading" ||
    AppState.scrapperDetails.scrappingStage == "initiated";

  // Only show completion view if scrapping has actually completed AND there was a selected tab
  // AND we're still on the same user's page AND there's evidence of actual completion
  const currentUsername = getCurrentPageUsername();
  const originalUsername = AppState.scrapperDetails.originalUsername;
  const isOnCorrectUserPage =
    originalUsername === null ||
    currentUsername === originalUsername ||
    currentUsername === "😃";

  // Check for evidence of completed scrapping (progress-first approach)
  const selectedTab = AppState.scrapperDetails.selectedTab;
  const hasEvidenceOfCompletion = selectedTab
    ? await hasEvidence(currentUsername, selectedTab)
    : false;

  // Clear stale completed state if no evidence exists
  if (
    AppState.scrapperDetails.scrappingStage == "completed" &&
    !hasEvidenceOfCompletion
  ) {
    // Stale completed state - clear it
    AppState.scrapperDetails.scrappingStage = null;
    AppState.scrapperDetails.selectedTab = null;
    AppState.scrapperDetails.selectedCollectionName = null;
    AppState.scrapperDetails.originalPath = null;
    AppState.scrapperDetails.originalUsername = null;
    AppState.scrapperDetails.originalCollectionName = null;
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );
  }

  const isScrappingCompleted =
    AppState.scrapperDetails.scrappingStage == "completed" &&
    selectedTab != null &&
    isOnCorrectUserPage &&
    hasEvidenceOfCompletion; // Only show if there's actual evidence

  // State-aware rendering
  let contentContainer;
  if (isScrappingActive && isOnCorrectUserPage) {
    // Ultra-compact active session view
    contentContainer = renderActiveScrappingView();
  } else if (isScrappingCompleted) {
    // Completed session view (only shown when evidence exists)
    contentContainer = await renderCompletedView();
  } else {
    // Stepper view for new/resume flow (or if we're on wrong user page)
    // If we're on wrong user page, clear the active state first
    if (isScrappingActive && !isOnCorrectUserPage) {
      AppState.scrapperDetails.scrappingStage = null;
      AppState.scrapperDetails.selectedTab = null;
      AppState.scrapperDetails.selectedCollectionName = null;
      AppState.scrapperDetails.originalPath = null;
      AppState.scrapperDetails.originalUsername = null;
      AppState.scrapperDetails.originalCollectionName = null;
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails),
      );
    }
    contentContainer = await createStepperView(pageInfo, tabOptions, spans);
  }

  controls.appendChild(contentContainer);

  // Remove all existing controls and tab buttons
  scrapperContainer
    .querySelectorAll(".ettpd-scrapper-controls")
    .forEach((el) => el.remove());
  scrapperContainer
    .querySelectorAll(".ettpd-tab-btn")
    .forEach((el) => el.remove());
  // Remove resume downloads container if it exists
  scrapperContainer
    .querySelectorAll(".ettpd-resume-downloads-container")
    .forEach((el) => el.remove());

  scrapperContainer.appendChild(controls);

  // Update download all button state when scrapper controls are shown
  const downloadAllBtn = document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (downloadAllBtn) {
    updateDownloadButtonLabelSimple();
  }

  // Check if username changed and update tracking
  // Reuse currentUsername from earlier in the function
  const usernameChanged = currentUsername !== lastTrackedUsername;

  // If username changed and we have an active session for a different user, clear the state
  if (usernameChanged) {
    lastTrackedUsername = currentUsername;

    // Clear scrapper state if we're on a different user's page than the original session
    if (
      AppState.scrapperDetails.originalUsername !== null &&
      currentUsername !== AppState.scrapperDetails.originalUsername &&
      currentUsername !== "😃" // Don't clear if username detection failed
    ) {
      // Reset scrapper state since we're on a different user's page
      AppState.scrapperDetails.selectedTab = null;
      AppState.scrapperDetails.selectedCollectionName = null;
      AppState.scrapperDetails.scrappingStage = null;
      AppState.scrapperDetails.originalPath = null;
      AppState.scrapperDetails.originalUsername = null;
      AppState.scrapperDetails.originalCollectionName = null;
      AppState.scrapperDetails.paused = false;
      AppState.scrapperDetails.isAutoBatchDownloading = false;

      // Save cleared state
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails),
      );

      // Re-render controls with cleared state
      showScrapperControls();
      return;
    }
  }

  // Track whether the last rendered state was a valid profile page
  let wasOnValidPage = isOnProfileOrCollectionPage().isProfile;

  // Update message when location changes
  const updateMessageOnLocationChange = () => {
    const pageInfo = isOnProfileOrCollectionPage();
    const newUsername = getCurrentPageUsername();
    const usernameChangedNow = newUsername !== lastTrackedUsername;
    const transitionedToValidPage = !wasOnValidPage && pageInfo.isProfile;

    // Update tracked username if it changed
    if (usernameChangedNow) {
      lastTrackedUsername = newUsername;
    }
    wasOnValidPage = pageInfo.isProfile;

    const subtitle = document.getElementById("tab-subtitle");

    if (!pageInfo.isProfile) {
      if (subtitle) {
        replaceElementHtml(
          subtitle,
          "<strong>Heads up:</strong> Please navigate to a profile or collection page first. If you download from other pages, you may end up downloading random posts. Reload the page if you don't see any tabs.",
        );
      }
      // Also refresh controls to show warning in stepper view
      showScrapperControls();
    } else {
      // On valid page, refresh controls if username changed or
      // if we just transitioned from an invalid page (e.g., /video/ → profile root)
      if (usernameChangedNow || transitionedToValidPage) {
        showScrapperControls();
      }
    }
  };

  // Listen for location changes
  window.addEventListener("locationchange", updateMessageOnLocationChange);
  window.addEventListener("popstate", updateMessageOnLocationChange);

  return controls;
}

/**
 * Show a confirmation modal when previous downloads are detected
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 * @param {number} count - Number of previously downloaded items
 * @returns {Promise<string>} User choice: "redownload", "skip", or "cancel"
 */
async function showDownloadConfirmationModal(username, tabName, count) {
  // Verify we're still on the correct user's page
  const currentPageUsername = getCurrentPageUsername();
  if (currentPageUsername !== username && currentPageUsername !== "😃") {
    // User navigated away, cancel the modal
    return Promise.resolve("cancel");
  }

  return new Promise((resolve) => {
    const safeUsername = escapeHtml(username);
    const safeTabName = escapeHtml(toTitleCase(tabName));
    const contentDiv = document.createElement("div");
    contentDiv.style.cssText = "padding: 20px; text-align: center;";
    bindText(contentDiv, "scanPrevious", () => ({ name: username, list: ["videos", "liked", "reposts", "favorites"].includes(tabName) ? t(tabName) : tabName, count }));

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText =
      "display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;";

    const redownloadBtn = document.createElement("button");
    redownloadBtn.className = "ettpd-pref-btn";
    setLocalizedButton(redownloadBtn, "redownload", "refresh");
    redownloadBtn.onclick = () => {
      modal.remove();
      resolve("redownload");
    };

    const skipBtn = document.createElement("button");
    skipBtn.className = "ettpd-pref-btn";
    setLocalizedButton(skipBtn, "skipDownloaded", "skip");
    skipBtn.onclick = () => {
      modal.remove();
      resolve("skip");
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ettpd-pref-btn danger";
    setLocalizedButton(cancelBtn, "cancel", "error");
    cancelBtn.onclick = () => {
      modal.remove();
      resolve("cancel");
    };

    buttonContainer.appendChild(redownloadBtn);
    buttonContainer.appendChild(skipBtn);
    buttonContainer.appendChild(cancelBtn);

    const modal = createModal({
      children: [contentDiv, buttonContainer],
      onClose: () => resolve("cancel"),
    });
  });
}

function explainerModal(tab) {
  const safeUsername = escapeHtml(getCurrentPageUsername());
  const safeTab = escapeHtml(tab);
  const description = document.createElement("div");
  description.className = "ettpd-scrapper-info";
  replaceElementHtml(
    description,
    '<h3 data-i18n="autoScroll"></h3><p data-i18n="scanHelp"></p><p data-i18n="scanProfileRequired"></p><p data-i18n="templateIntro"></p>',
  );

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
  recommendedLabel.textContent = "";
  const sparklesIcon = createIcon("sparkles", 16);
  sparklesIcon.style.marginRight = "4px";
  recommendedLabel.appendChild(sparklesIcon);
  const recommendedText = document.createElement("span");
  bindText(recommendedText, "recommended");
  recommendedLabel.appendChild(recommendedText);

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
  setLocalizedButton(applyBtn, "useTemplate", "sparkles");
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
      (t) => t.label !== AppState.downloadPreferences.fullPathTemplate.label,
    );
    updated.push(AppState.downloadPreferences.fullPathTemplate);
    // First update the state, since it's needed by saveTemplates
    saveTemplates(updated);
    saveSelectedTemplate();

    // Show success message instead of opening another modal
    successMessage.textContent = "";
    const checkIcon = createIcon("check", 16);
    checkIcon.style.marginRight = "4px";
    successMessage.appendChild(checkIcon);
    const appliedText = document.createElement("span");
    bindText(appliedText, "templateSaved");
    successMessage.appendChild(appliedText);
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
  setLocalizedButton(configBtn, "templateTitle", "settings");
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
  bindText(closeBtn, "close");
  closeBtn.style.cssText = `
    width: 100%;
  `;
  actionsContainer.appendChild(closeBtn);

  const overlay = createModal({
    children: [description, actionsContainer],
  });

  closeBtn.onclick = () => {
    overlay?.remove();
  };
}

function showScrapperStateUI(tabKey) {
  // Remove any previous active UI
  document.querySelector(".ettpd-scrapper-active-ui")?.remove();

  const container = document.createElement("div");
  container.className = "ettpd-scrapper-active-ui";

  const heading = document.createElement("h4");
  bindText(heading, "scanList", () => ({ list: ["videos", "liked", "reposts", "favorites"].includes(tabKey) ? t(tabKey) : AppState.scrapperDetails.selectedCollectionName || t("collection") }));
  heading.className = "ettpd-scrapper-title";

  const actions = document.createElement("div");
  actions.className = "ettpd-scrapper-actions";

  const startBtn = document.createElement("button");
  startBtn.className = "ettpd-scrapper-start";
  bindText(startBtn, ["ongoing", "downloading"].includes(AppState.scrapperDetails.scrappingStage) ? "abandonStart" : "start", {}, "title");
  bindText(startBtn, "start");
  // startBtn.disabled =
  //   AppState.scrapperDetails.scrappingStage == "ongoing" ||
  //   AppState.scrapperDetails.scrappingStage == "downloading";
  startBtn.onclick = async () => {
    console.log(`[Scrapper] Starting download for "${tabKey}"`);

    // Set the selected tab
    AppState.scrapperDetails.selectedTab = tabKey;

    // Get page info and start the scrapping process
    const pageInfo = isOnProfileOrCollectionPage();
    await startScrappingProcess(tabKey, pageInfo);
  };

  const pauseBtn = document.createElement("button");
  pauseBtn.className = "ettpd-scrapper-pause";
  bindText(pauseBtn, AppState.scrapperDetails.paused ? "resume" : "pause");
  pauseBtn.disabled =
    AppState.scrapperDetails.scrappingStage != "ongoing" &&
    AppState.scrapperDetails.scrappingStage != "downloading";

  pauseBtn.onclick = () => {
    AppState.scrapperDetails.paused = !AppState.scrapperDetails.paused;
    if (AppState.scrapperDetails.paused) {
      // Pause logic
      AppState.downloadPreferences.autoScrollMode = "off";
      setLocalizedButton(pauseBtn, "resume", "play");
      console.log(`[Scrapper] Paused "${tabKey}"`);
    } else {
      // Resume logic
      AppState.downloadPreferences.autoScrollMode = "always";
      setLocalizedButton(pauseBtn, "pause", "pause");
      console.log(`[Scrapper] Resumed "${tabKey}"`);
    }
  };
  const learnBtn = document.createElement("button");
  learnBtn.className = "ettpd-scrapper-learn";
  setLocalizedButton(learnBtn, "info", "info");
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

  // Ensure wrapper stays visible after applying corner position
  constrainWrapperToViewport(wrapper);
}

function createDownloadAllButton() {
  const container = document.createElement("div");
  container.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-container";
  container.className = "ettpd-download-all-container";

  const btn = document.createElement("button");
  btn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON;
  btn.className = "ettpd-btn download-all-btn";
  setLocalizedButton(btn, "download", "down");
  btn.disabled = true;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (notifyDownloadBusy() || btn.disabled) return;
    downloadAllLinks(btn);
  };

  const pauseBtn = document.createElement("button");
  pauseBtn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-pause";
  pauseBtn.className = "ettpd-btn download-all-btn-pause";
  setLocalizedButton(pauseBtn, "pause", "pause");
  pauseBtn.disabled = true;
  pauseBtn.style.display = "none";
  bindText(pauseBtn, "pause", {}, "title");
  pauseBtn.onclick = (e) => {
    e.stopPropagation();
    if (!AppState.downloading.isDownloadingAll) return;
    AppState.downloading.pausedAll = !(AppState.downloading.accountBatch?.paused ?? AppState.downloading.pausedAll);
    if (AppState.downloading.accountBatch) AppState.downloading.accountBatch.paused = AppState.downloading.pausedAll;
    if (AppState.downloading.pausedAll) {
      setLocalizedButton(pauseBtn, "resume", "play");
      bindText(pauseBtn, "resume", {}, "title");
    } else {
      setLocalizedButton(pauseBtn, "pause", "pause");
      bindText(pauseBtn, "pause", {}, "title");
    }
    updateBatchDownloadProgress({});
  };

  const stopBtn = document.createElement("button");
  stopBtn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-stop";
  stopBtn.className = "ettpd-btn download-all-btn-stop";
  setLocalizedButton(stopBtn, "stop", "stop");
  stopBtn.disabled = true;
  stopBtn.style.display = "none";
  bindText(stopBtn, "stop", {}, "title");
  stopBtn.onclick = (e) => {
    e.stopPropagation();
    if (!AppState.downloading.isDownloadingAll) return;
    stopActiveBatchDownload();
  };

  const message = document.createElement("div");
  message.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-message";
  message.className = "ettpd-scrapper-message";
  message.style.display = "none";

  container.appendChild(btn);
  container.appendChild(pauseBtn);
  container.appendChild(stopBtn);
  container.appendChild(message);

  return container;
}

function getDownloadItemUrls(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items
    .map((item) => (typeof item?.url === "string" ? item.url.trim() : ""))
    .filter(Boolean);
}

function getActiveDownloadBatchType() {
  if (!AppState.downloading.isDownloadingAll) {
    return null;
  }

  return ["playlist", "episodes", "collection"].includes(AppState.downloading.batchType) ? AppState.downloading.batchType : "all";
}

function getActiveDownloadBatchUrls() {
  const urls = AppState.downloading.activeBatchUrls;
  if (!Array.isArray(urls) || !urls.length) {
    return [];
  }

  return urls
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean);
}

function getDownloadedCountForUrls(urls = []) {
  if (!Array.isArray(urls) || !urls.length) {
    return 0;
  }

  const uniqueUrls = new Set(
    urls
      .map((url) => (typeof url === "string" ? url.trim() : ""))
      .filter(Boolean),
  );
  if (!uniqueUrls.size) {
    return 0;
  }

  const downloadedUrlSet = new Set(AppState.downloadedURLs);
  let done = 0;
  uniqueUrls.forEach((url) => {
    if (downloadedUrlSet.has(url)) {
      done += 1;
    }
  });
  return done;
}

function getActiveBatchProgressSnapshot(fallbackItems = []) {
  const activeBatchUrls = getActiveDownloadBatchUrls();
  if (activeBatchUrls.length) {
    return {
      total: activeBatchUrls.length,
      done: getDownloadedCountForUrls(activeBatchUrls),
    };
  }

  const fallbackUrls = getDownloadItemUrls(fallbackItems);
  return {
    total: fallbackUrls.length,
    done: getDownloadedCountForUrls(fallbackUrls),
  };
}

/**
 * Populate the scrapper message area with tab-picker buttons.
 * Each button lets the user start scrapping that tab directly.
 * If scrapping is already active, a modal warns them that the current
 * session will be abandoned before switching.
 */
async function populateScrapperTabPicker(messageEl) {
  if (!messageEl) return;

  // Avoid re-populating if already filled and visible
  if (messageEl._tabPickerPopulated) return;
  messageEl._tabPickerPopulated = true;

  messageEl.replaceChildren();

  const pageInfo = isOnProfileOrCollectionPage();

  // Wrapper
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 6px;
    background: var(--ettpd-bg-secondary, #f5f5f5);
    border: 1px solid var(--ettpd-border-color, #ddd);
  `;

  // Title
  const title = document.createElement("div");
  title.style.cssText = `
    font-size: 11px;
    font-weight: 600;
    color: var(--ettpd-text-primary, #333);
    text-align: center;
    margin-bottom: 2px;
  `;
  bindText(title, "autoScroll");
  wrapper.appendChild(title);

  // Tab grid
  const grid = document.createElement("div");
  grid.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  `;

  // Get available tabs from DOM
  let spans = {};
  try {
    spans = await getTabSpans(3000);
  } catch {}

  const tabOptions = [
    { key: "videos", label: t("videos"), icon: "video" },
    { key: "reposts", label: t("reposts"), icon: "repost" },
    { key: "liked", label: t("liked"), icon: "heart" },
    { key: "favorites", label: t("favorites"), icon: "star" },
    {
      key: "collection",
      label: spans.collection || pageInfo.collectionName || "Collection",
      icon: "folder",
    },
  ];

  const availableTabs = tabOptions.filter(({ key }) => {
    if (key === "collection") return pageInfo.isCollection;
    return !!spans[key];
  });

  if (availableTabs.length === 0) {
    const hint = document.createElement("div");
    hint.style.cssText = `
      font-size: 11px;
      color: var(--ettpd-text-secondary, #888);
      text-align: center;
      padding: 4px;
    `;
    hint.textContent = t("scanProfileRequired");
    wrapper.appendChild(hint);
    messageEl.appendChild(wrapper);
    return;
  }

  availableTabs.forEach(({ key, label, icon }) => {
    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.className = "ettpd-tab-btn";
    tabBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      font-size: 11px;
      border: 1px solid var(--ettpd-border-color, #ccc);
      border-radius: 6px;
      background: var(--ettpd-bg-primary, #fff);
      color: var(--ettpd-text-primary, #333);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    `;

    const iconEl = createIcon(icon, 14);
    iconEl.style.flexShrink = "0";
    tabBtn.appendChild(iconEl);
    tabBtn.appendChild(document.createTextNode(label));

    tabBtn.onmouseenter = () => {
      tabBtn.style.borderColor = "var(--ettpd-accent, #4a90d9)";
      tabBtn.style.background = "var(--ettpd-bg-secondary, #eef)";
    };
    tabBtn.onmouseleave = () => {
      tabBtn.style.borderColor = "var(--ettpd-border-color, #ccc)";
      tabBtn.style.background = "var(--ettpd-bg-primary, #fff)";
    };

    tabBtn.onclick = async (e) => {
      e.stopPropagation();

      const scrappingStage = AppState.scrapperDetails.scrappingStage;
      const isScrappingActive =
        scrappingStage === "ongoing" ||
        scrappingStage === "downloading" ||
        scrappingStage === "initiated";

      if (isScrappingActive) {
        // Show abandon-warning modal
        const shouldProceed = await showAbandonScrappingModal();
        if (!shouldProceed) return;

        // Abandon current scrapping session
        AppState.scrapperDetails.scrappingStage = null;
        AppState.scrapperDetails.paused = false;
        AppState.scrapperDetails.locked = false;
        AppState.scrapperDetails.selectedTab = null;
        AppState.scrapperDetails.selectedCollectionName = null;
        localStorage.setItem(
          STORAGE_KEYS.SCRAPPER_DETAILS,
          JSON.stringify(AppState.scrapperDetails),
        );
      }

      // Select this tab and start scrapping
      AppState.scrapperDetails.selectedTab = key;
      if (key === "collection") {
        AppState.scrapperDetails.selectedCollectionName =
          pageInfo.collectionName || "collection";
      }
      localStorage.setItem(
        STORAGE_KEYS.SCRAPPER_DETAILS,
        JSON.stringify(AppState.scrapperDetails),
      );

      // Reset populated flag so it rebuilds on next show
      messageEl._tabPickerPopulated = false;

      await startScrappingProcess(key, pageInfo);
    };

    grid.appendChild(tabBtn);
  });

  wrapper.appendChild(grid);
  messageEl.appendChild(wrapper);
}

/**
 * Modal warning the user that the current scrapping session will be abandoned.
 * Returns a promise that resolves to true if they confirm, false if cancelled.
 */
function showAbandonScrappingModal() {
  return new Promise((resolve) => {
    const content = document.createElement("div");
    content.className = "alert";
    replaceElementHtml(
      content,
      '<p data-i18n="scanAbandonWarning"></p>',
    );

    const actionsContainer = document.createElement("div");
    actionsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 20px;
      justify-content: center;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ettpd-modal-button secondary";
    bindText(cancelBtn, "cancel");
    cancelBtn.onclick = () => {
      const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
      if (overlay) overlay.remove();
      resolve(false);
    };

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "ettpd-modal-button danger";
    bindText(confirmBtn, "abandonStart");
    confirmBtn.onclick = () => {
      const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
      if (overlay) overlay.remove();
      resolve(true);
    };

    actionsContainer.appendChild(cancelBtn);
    actionsContainer.appendChild(confirmBtn);

    createModal({
      children: [content, actionsContainer],
      onClose: () => resolve(false),
    });
  });
}

export function updateBatchDownloadProgress(status = {}) {
  if (!AppState.downloading.isDownloadingAll) return;
  const previous = AppState.downloading.batchProgress || {};
  AppState.downloading.batchProgress = {
    ...previous,
    ...(status.batchIndex !== undefined && status.batchIndex !== previous.batchIndex ? { experimentalHd: false, quality: null } : {}),
    ...(status.phase && status.phase !== previous.phase ? { progress: null, loaded: null, total: null } : {}),
    ...status,
  };
  const button = document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (button) renderBatchDownloadProgress(button);
}

function setBusyDownloadButton(button) {
  button.disabled = false;
  button.setAttribute("aria-disabled", "true");
}

function renderBatchDownloadProgress(button) {
  const status = AppState.downloading.batchProgress;
  const isLoadingList = status?.batchTotal == null && ["load", "paused"].includes(status?.phase);
  if (!AppState.downloading.isDownloadingAll || !status || !status.batchTotal && !isLoadingList) {
    button.classList.remove("ettpd-batch-progress");
    button.removeAttribute("aria-busy");
    button.removeAttribute("aria-disabled");
    return false;
  }
  const paused = AppState.downloading.accountBatch?.paused || AppState.downloading.pausedAll ||
    AppState.scrapperDetails.isAutoBatchDownloading && AppState.scrapperDetails.paused;
  const progress = !status.experimentalHd && typeof status.progress === "number" && Number.isFinite(status.progress)
    ? Math.max(0, Math.min(1, status.progress)) : null;
  const waiting = status.phase === "waiting" || status.phase === "paused";
  const phase = paused && !waiting ? t("pauseRequested") : status.experimentalHd && status.phase === "fallback" ? t("hdFallback") :
    status.experimentalHd && status.phase === "fetch" ? t(status.quality === "standard" ? "standardFetching" : "hdFetching") :
    status.phase === "retry" ? t("retryProgress", { current: status.attempt || 1, total: status.maxRetries || 3 }) :
    t(({ "fetch-video": "fetch", "fetch-audio": "fetch", load: "loading", retry: "retrying" })[status.phase] ||
      (["prepare", "fetch", "mux", "save", "fallback", "waiting", "paused"].includes(status.phase) ? status.phase : "prepare"));
  const percent = progress === null ? "" : ` · ${new Intl.NumberFormat(getLocale(), { style: "percent" }).format(progress)}`;
  const bytes = status.loaded > 0
    ? ` · ${(status.loaded / 1048576).toFixed(1)}${status.total > 0 ? ` / ${(status.total / 1048576).toFixed(1)}` : ""} MB`
    : "";
  const batchLabel = status.batchNumber ? `${t("batch", { count: status.batchNumber })} · ` : "";
  const label = isLoadingList
    ? `${batchLabel}${waiting || paused ? t("paused") : t("loading")}`
    : `${batchLabel}${t(status.phase === "paused" ? "pausedProgress" : "progress", { current: status.batchIndex || 1, total: status.batchTotal })}`;
  const photo = !isLoadingList && status.unit === "posts" && status.imageTotal > 1
    ? ` · ${t("photoProgress", { current: (status.imageIndex || 0) + 1, total: status.imageTotal })}` : "";
  const detail = isLoadingList ? t("savedCount", { count: status.savedPosts || 0 }) : `${phase}${percent}${bytes}${photo}`;
  button.classList.add("ettpd-batch-progress");
  setBusyDownloadButton(button);
  button.setAttribute("aria-busy", String(!waiting));
  button.title = `${label}. ${detail}`;
  let heading = button.querySelector(".ettpd-batch-progress-label");
  if (!heading) {
    clearText(button);
    delete button.dataset.i18nButton;
    heading = document.createElement("span");
    heading.className = "ettpd-batch-progress-label";
    const description = document.createElement("span");
    description.className = "ettpd-batch-progress-detail";
    const track = document.createElement("span");
    track.className = "ettpd-batch-progress-track";
    track.setAttribute("role", "progressbar");
    bindText(track, "downloads", {}, "aria-label");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    const fill = document.createElement("span");
    fill.className = "ettpd-batch-progress-fill";
    track.appendChild(fill);
    button.replaceChildren(heading, description, track);
  }
  heading.textContent = label;
  button.querySelector(".ettpd-batch-progress-detail").textContent = detail;
  const track = button.querySelector(".ettpd-batch-progress-track");
  const fileFraction = progress === null ? 0
    : status.phase === "save" ? 0.95 + 0.05 * progress
      : status.phase === "mux" ? 0.9 + 0.05 * progress : 0.9 * progress;
  const fraction = status.unit === "posts" && status.imageTotal > 1
    ? ((status.imageIndex || 0) + fileFraction) / status.imageTotal : fileFraction;
  const overall = isLoadingList ? null : Math.min(99, 100 * ((status.settled || 0) + fraction) / status.batchTotal);
  const fill = track.firstElementChild;
  fill.style.width = `${overall === null ? 100 : Math.max(1, overall)}%`;
  fill.classList.toggle("is-indeterminate", (isLoadingList || progress === null && !status.experimentalHd) && !waiting);
  track.setAttribute("aria-valuetext", `${label}. ${detail}`);
  if (isLoadingList || progress === null) track.removeAttribute("aria-valuenow");
  else track.setAttribute("aria-valuenow", String(Math.round(overall)));
  const container = button.parentElement;
  const pauseButton = container?.querySelector(`#${DOM_IDS.DOWNLOAD_ALL_BUTTON}-pause`);
  const stopButton = container?.querySelector(`#${DOM_IDS.DOWNLOAD_ALL_BUTTON}-stop`);
  if (pauseButton) {
    pauseButton.style.display = "inline-flex";
    pauseButton.disabled = false;
    if (pauseButton.dataset.progressPaused !== String(paused)) {
      setLocalizedButton(pauseButton, paused ? "resume" : "pause", paused ? "play" : "pause");
      pauseButton.dataset.progressPaused = String(paused);
    }
    pauseButton.title = paused ? t("resume") : t("pauseRequested");
  }
  if (stopButton) {
    stopButton.style.display = "inline-flex";
    stopButton.disabled = false;
  }
  return true;
}

function updateDownloadAllButtonState(btn, items = []) {
  if (!btn) return;

  const syncPlaylistButton = () => {
    schedulePlaylistHeaderSync();
  };

  const scrapperBoxOpen = AppState.ui.isScrapperBoxOpen;
  const scrappingStage = AppState.scrapperDetails.scrappingStage;
  const selectedTab = AppState.scrapperDetails.selectedTab;
  const scrappingAbandoned =
    scrappingStage === "completed" &&
    AppState.scrapperDetails.paused &&
    AppState.scrapperDetails.originalPath !== null; // Indicates it was abandoned

  // Check if scrapping is actually active (ongoing, downloading, or initiated)
  const isScrappingActive =
    scrappingStage === "ongoing" ||
    scrappingStage === "downloading" ||
    scrappingStage === "initiated";

  // Check if scrapper is selected but not started - hide button in this case
  const scrapperSelectedNotStarted =
    selectedTab && !isScrappingActive && scrappingStage !== "completed";

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
  const pauseBtn = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-pause")
    : null;
  const stopBtn = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-stop")
    : null;

  if (!actualBtn) {
    syncPlaylistButton();
    return;
  }

  // Show container
  if (container) container.style.display = "block";

  // Hide button only when:
  // 1. Scrapper box is open AND scrapping is active (ongoing/downloading), OR
  // 2. Scrapper box is open AND a tab is selected but not started
  // BUT allow manual downloads if scrapping was abandoned
  if (scrapperBoxOpen && !scrappingAbandoned) {
    if (isScrappingActive) {
      // Scrapping is actively happening - hide button, show tab picker so
      // user can switch tabs (with abandon warning)
      actualBtn.style.display = "none";
      if (pauseBtn) pauseBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      if (message) {
        message.style.display = "block";
        populateScrapperTabPicker(message);
      }
      syncPlaylistButton();
      return;
    }
    if (scrapperSelectedNotStarted) {
      // Tab selected but not started - show tab picker
      actualBtn.style.display = "none";
      if (pauseBtn) pauseBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      if (message) {
        message.style.display = "block";
        populateScrapperTabPicker(message);
      }
      syncPlaylistButton();
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
    // Hide button and show tab picker when scrapper is selected but not started
    actualBtn.style.display = "none";
    if (pauseBtn) pauseBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "none";
    if (message) {
      message.style.display = "block";
      populateScrapperTabPicker(message);
    }
    syncPlaylistButton();
    return;
  }

  // Show button and hide message (when scrapping is ongoing or not using scrapper)
  actualBtn.style.display = "block";
  if (message) {
    message.style.display = "none";
    message._tabPickerPopulated = false; // Reset so tabs refresh on next show
  }

  const activeBatchType = getActiveDownloadBatchType();
  if (renderBatchDownloadProgress(actualBtn)) {
    syncPlaylistButton();
    return;
  }
  const activeBatchProgress = AppState.downloading.isDownloadingAll
    ? getActiveBatchProgressSnapshot(
        items.length ? items : AppState.allDirectLinks,
      )
    : null;
  const total = AppState.downloading.isDownloadingAll
    ? activeBatchProgress.total
    : items.length || AppState.allDirectLinks.length;
  const done = AppState.downloading.isDownloadingAll
    ? activeBatchProgress.done
    : AppState.downloadedURLs.length;
  const isDownloading = AppState.downloading.isDownloadingAll;
  const isPausedAll = AppState.downloading.pausedAll;

  if (!total) {
    setLocalizedButton(actualBtn, "noPosts", "stop");
    actualBtn.disabled = true;
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.style.display = "none";
      stopBtn.disabled = true;
    }
    syncPlaylistButton();
    return;
  }

  if (isDownloading) {
    if (activeBatchType === "playlist") {
      actualBtn.textContent = "";
      const activeIcon = createIcon(done < total ? "hourglass" : "check", 16);
      activeIcon.style.marginRight = "4px";
      actualBtn.appendChild(activeIcon);
      actualBtn.appendChild(
        document.createTextNode(
          done < total
            ? t("progress", { current: done, total: total })
            : t("downloadedCount", { count: total }),
        ),
      );
    } else if (done < total) {
      actualBtn.textContent = "";
      const hourglassIcon = createIcon("hourglass", 16);
      hourglassIcon.style.marginRight = "4px";
      actualBtn.appendChild(hourglassIcon);
      actualBtn.appendChild(
        document.createTextNode(
          t("progress", { current: done, total: total }),
        ),
      );
    } else {
      actualBtn.textContent = "";
      const checkIcon = createIcon("check", 16);
      checkIcon.style.marginRight = "4px";
      actualBtn.appendChild(checkIcon);
      actualBtn.appendChild(
        document.createTextNode(
          t("downloadedCount", { count: total }),
        ),
      );
    }
    setBusyDownloadButton(actualBtn);
    if (pauseBtn) {
      pauseBtn.style.display = "inline-flex";
      pauseBtn.disabled = false;
      setButtonWithIcon(
        pauseBtn,
        isPausedAll ? "Resume" : "Pause",
        isPausedAll ? "play" : "pause",
      );
      pauseBtn.title = isPausedAll ? t("resume") : t("pause");
    }
    if (stopBtn) {
      stopBtn.style.display = "inline-flex";
      stopBtn.disabled = false;
    }
    syncPlaylistButton();
    return;
  }

  setLocalizedButton(actualBtn, "downloadCount", "down", { count: total });
  actualBtn.disabled = false;
  if (pauseBtn) {
    pauseBtn.style.display = "none";
    pauseBtn.disabled = true;
  }
  if (stopBtn) {
    stopBtn.style.display = "none";
    stopBtn.disabled = true;
  }
  syncPlaylistButton();
}

export function updateDownloadButtonLabel(btnElement, text) {
  const btn =
    btnElement || document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (!btn) return;
  if (!AppState.downloading.isDownloadingAll) {
    AppState.downloading.batchProgress = null;
    updateDownloadAllButtonState(btn, AppState.allDirectLinks);
  }
  if (btn.id === DOM_IDS.DOWNLOAD_ALL_BUTTON &&
    AppState.downloading.isDownloadingAll && renderBatchDownloadProgress(btn)) return;
  btn.textContent = text;
}

export function updateDownloadButtonLabelSimple() {
  const downloadAllBtn = document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  if (!downloadAllBtn) {
    schedulePlaylistHeaderSync();
    return;
  }

  const scrappingStage = AppState.scrapperDetails.scrappingStage;
  const scrapperBoxOpen = AppState.ui.isScrapperBoxOpen;
  const selectedTab = AppState.scrapperDetails.selectedTab;

  // Check if scrapping is actually active (ongoing or downloading)
  const isScrappingActive =
    scrappingStage === "ongoing" || scrappingStage === "downloading";

  // Check if scrapper is selected but not started - hide button in this case
  const scrapperSelectedNotStarted =
    selectedTab &&
    scrappingStage !== "ongoing" &&
    scrappingStage !== "downloading" &&
    scrappingStage !== "completed";

  const container = downloadAllBtn.parentElement;
  const message = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-message")
    : null;
  const pauseBtn = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-pause")
    : null;
  const stopBtn = container
    ? container.querySelector("#" + DOM_IDS.DOWNLOAD_ALL_BUTTON + "-stop")
    : null;

  // Show container
  if (container) container.style.display = "block";

  // Hide button when:
  // 1. Scrapper box is open AND scrapping is active (ongoing/downloading), OR
  // 2. Scrapper box is open AND a tab is selected but not started
  if (scrapperBoxOpen) {
    if (isScrappingActive || scrapperSelectedNotStarted) {
      downloadAllBtn.style.display = "none";
      if (pauseBtn) pauseBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      if (message) message.style.display = "block";
      schedulePlaylistHeaderSync();
      return;
    }
  }

  // Show button and hide message (when scrapping is not active or not using scrapper)
  downloadAllBtn.style.display = "block";
  if (message) message.style.display = "none";

  const activeBatchType = getActiveDownloadBatchType();
  if (renderBatchDownloadProgress(downloadAllBtn)) {
    schedulePlaylistHeaderSync();
    return;
  }
  const activeBatchProgress = AppState.downloading.isDownloadingAll
    ? getActiveBatchProgressSnapshot(AppState.allDirectLinks)
    : null;
  const total = AppState.downloading.isDownloadingAll
    ? activeBatchProgress.total
    : AppState.allDirectLinks.length;
  const done = AppState.downloading.isDownloadingAll
    ? activeBatchProgress.done
    : AppState.downloadedURLs.length;
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
      bindText(downloadAllBtn, "downloadedCount", { count: done });
    } else {
      bindText(downloadAllBtn, "progress", { current: currentItem, total });
    }
    setBusyDownloadButton(downloadAllBtn);
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.style.display = "none";
      stopBtn.disabled = true;
    }
    schedulePlaylistHeaderSync();
    return;
  }

  if (!total) {
    setLocalizedButton(downloadAllBtn, "noPosts", "stop");
    downloadAllBtn.disabled = true;
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.style.display = "none";
      stopBtn.disabled = true;
    }
  } else if (isDownloading) {
    if (activeBatchType === "playlist") {
      downloadAllBtn.textContent = "";
      const playlistIcon = createIcon(done < total ? "hourglass" : "check", 16);
      playlistIcon.style.marginRight = "4px";
      downloadAllBtn.appendChild(playlistIcon);
      downloadAllBtn.appendChild(
        document.createTextNode(
          done < total
            ? t("progress", { current: done, total: total })
            : t("downloadedCount", { count: total }),
        ),
      );
      setBusyDownloadButton(downloadAllBtn);
      if (pauseBtn) {
        pauseBtn.style.display = "inline-flex";
        pauseBtn.disabled = false;
        setButtonWithIcon(
          pauseBtn,
          AppState.downloading.pausedAll ? "Resume" : "Pause",
          AppState.downloading.pausedAll ? "play" : "pause",
        );
        pauseBtn.title = AppState.downloading.pausedAll
          ? t("resume")
          : t("pause");
      }
      if (stopBtn) {
        stopBtn.style.display = "inline-flex";
        stopBtn.disabled = false;
      }
    } else if (done < total) {
      downloadAllBtn.textContent = "";
      const hourglassIcon2 = createIcon("hourglass", 16);
      hourglassIcon2.style.marginRight = "4px";
      downloadAllBtn.appendChild(hourglassIcon2);
      downloadAllBtn.appendChild(
        document.createTextNode(
          t("progress", { current: done, total: total }),
        ),
      );
      setBusyDownloadButton(downloadAllBtn);
      if (pauseBtn) {
        pauseBtn.style.display = "inline-flex";
        pauseBtn.disabled = false;
        setButtonWithIcon(
          pauseBtn,
          AppState.downloading.pausedAll ? "Resume" : "Pause",
          AppState.downloading.pausedAll ? "play" : "pause",
        );
        pauseBtn.title = AppState.downloading.pausedAll
          ? t("resume")
          : t("pause");
      }
      if (stopBtn) {
        stopBtn.style.display = "inline-flex";
        stopBtn.disabled = false;
      }
    } else {
      downloadAllBtn.textContent = "";
      const checkIcon2 = createIcon("check", 16);
      checkIcon2.style.marginRight = "4px";
      downloadAllBtn.appendChild(checkIcon2);
      downloadAllBtn.appendChild(
        document.createTextNode(
          t("downloadedCount", { count: total }),
        ),
      );
      if (pauseBtn) {
        pauseBtn.style.display = "none";
        pauseBtn.disabled = true;
      }
      if (stopBtn) {
        stopBtn.style.display = "none";
        stopBtn.disabled = true;
      }
    }
  } else {
    setLocalizedButton(downloadAllBtn, "downloadCount", "down", { count: total });
    downloadAllBtn.disabled = false;
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.style.display = "none";
      stopBtn.disabled = true;
    }
  }

  schedulePlaylistHeaderSync();
}

const PLAYLIST_HEADER_BUTTON_ID = "ettpd-playlist-download-header-btn";

// ── Playlist sync throttle ──────────────────────────────────────────
// syncPlaylistHeaderActionButton is called from many code-paths on every
// polling tick.  Coalesce into at most one execution per animation frame
// and guard against microtask-driven re-entrance to avoid freezing the
// tab.
let _playlistSyncPending = false;
let _playlistSyncActive = false;
const HYDRATION_RETRY_COOLDOWN_MS = 3000;
let _lastHydrationAttemptAt = 0;

function schedulePlaylistHeaderSync() {
  if (_playlistSyncPending) return;
  _playlistSyncPending = true;
  requestAnimationFrame(() => {
    _playlistSyncPending = false;
    syncPlaylistHeaderActionButton();
  });
}

function getNormalizedPlaylistIds() {
  return AppState.playlist.itemIds
    .map((id) => (id == null ? "" : String(id).trim()))
    .filter(Boolean);
}

function filterPlaylistDirectLinks(
  items,
  playlistIds = getNormalizedPlaylistIds(),
) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const normalizedPlaylistIds = playlistIds
    .map((id) => (id == null ? "" : String(id).trim()))
    .filter(Boolean);
  if (!normalizedPlaylistIds.length) {
    return [];
  }

  const playlistIdSet = new Set(normalizedPlaylistIds);
  const seenIds = new Set();

  return items.filter((item) => {
    const id = item?.videoId ?? item?.id;
    const normalizedId = id == null ? "" : String(id).trim();
    if (!normalizedId || seenIds.has(normalizedId)) {
      return false;
    }

    if (playlistIdSet.size && !playlistIdSet.has(normalizedId)) {
      return false;
    }

    seenIds.add(normalizedId);
    return true;
  });
}

function buildPlaylistDirectLinksFromItems(
  items,
  playlistIds = getNormalizedPlaylistIds(),
) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return filterPlaylistDirectLinks(
    items
      .map((item, index) => buildVideoLinkMeta(item, index))
      .filter((item) => item?.videoId || item?.id),
    playlistIds,
  );
}

function getKnownPlaylistItems(playlistIds = getNormalizedPlaylistIds()) {
  if (!playlistIds.length) {
    return [];
  }

  const itemsById = AppState.allItemsEverSeen || {};
  const orderedItems = playlistIds.map((id) => itemsById[id]).filter(Boolean);

  if (orderedItems.length) {
    return orderedItems;
  }

  const playlistIdSet = new Set(playlistIds);
  return Object.values(itemsById).filter((item) => {
    const id = item?.id ?? item?.videoId;
    const normalizedId = id == null ? "" : String(id).trim();
    return normalizedId ? playlistIdSet.has(normalizedId) : false;
  });
}

function getRuntimePlaylistModalDirectLinks(pageInfo) {
  if (pageInfo?.playlistSource !== "runtime") {
    return [];
  }

  // The playlist modal already triggers signed mix-item requests that are captured by
  // the network interceptor. Crawling the modal's React fiber tree on every sync tick
  // is expensive enough to destabilize the tab, so modal hydration stays request-driven.
  return [];
}

function getCurrentPlaylistDirectLinks(
  pageInfo = syncPlaylistStateWithLocation(),
) {
  const playlistIds = getNormalizedPlaylistIds();

  if (pageInfo?.playlistSource === "runtime" && !playlistIds.length) {
    return [];
  }

  const cachedDirectLinks = filterPlaylistDirectLinks(
    AppState.allDirectLinks || [],
    playlistIds,
  );
  if (cachedDirectLinks.length) {
    return cachedDirectLinks;
  }

  const knownItems = getKnownPlaylistItems(playlistIds);
  const derivedKnownLinks = buildPlaylistDirectLinksFromItems(
    knownItems,
    playlistIds,
  );
  if (derivedKnownLinks.length) {
    return derivedKnownLinks;
  }

  return [];
}

async function ensurePlaylistLinksHydrated(pageInfo) {
  if (
    !pageInfo?.isPlaylist ||
    !pageInfo.playlistId ||
    AppState.playlist.isHydrating
  ) {
    return false;
  }

  // Cooldown: avoid rapid-fire retries when no request URL exists yet.
  const now = Date.now();
  if (now - _lastHydrationAttemptAt < HYDRATION_RETRY_COOLDOWN_MS) {
    return false;
  }
  _lastHydrationAttemptAt = now;

  if (getCurrentPlaylistDirectLinks(pageInfo).length) {
    return true;
  }

  const requestUrl = findRecentPlaylistRequestUrl(pageInfo.playlistId);
  if (!requestUrl) {
    // TikTok's playlist modal often loads items from its React store rather than
    // firing a fresh /api/mix/item_list/ request.  When no intercepted URL exists
    // we construct one ourself by borrowing auth params from any recent TikTok API
    // call on this page.
    const builtUrl = buildMixItemListUrl(pageInfo.playlistId);
    if (!builtUrl) {
      return false;
    }
    return hydratePlaylistFromUrl(builtUrl, pageInfo);
  }

  return hydratePlaylistFromUrl(requestUrl, pageInfo);
}

function buildMixItemListUrl(playlistId) {
  if (!playlistId) return null;

  // Find any recent TikTok API request to borrow auth/session parameters from.
  try {
    const entries = performance.getEntriesByType?.("resource") || [];
    let donorUrl = null;
    let donorStart = -Infinity;

    for (const entry of entries) {
      if (
        !entry.name ||
        !entry.name.includes("/api/") ||
        !entry.name.includes("tiktok.com")
      )
        continue;
      // Prefer user/playlist or post/item_list as donors since they share the
      // same parameter shape.
      const isGoodDonor =
        entry.name.includes("/api/user/playlist") ||
        entry.name.includes("/api/post/item_list");
      const startTime = Number(entry.startTime) || 0;
      if (isGoodDonor && startTime >= donorStart) {
        donorStart = startTime;
        donorUrl = entry.name;
      }
    }

    if (!donorUrl) {
      // Fall back to any tiktok API call
      for (const entry of entries) {
        if (entry.name?.includes("tiktok.com/api/")) {
          donorUrl = entry.name;
          break;
        }
      }
    }

    if (!donorUrl) return null;

    const parsed = new URL(donorUrl);
    // Rewrite endpoint to mix/item_list
    parsed.pathname = "/api/mix/item_list/";
    // Set the playlist-specific params
    parsed.searchParams.set("mixId", playlistId);
    parsed.searchParams.set("count", "30");
    parsed.searchParams.set("cursor", "0");
    // Remove donor-specific params that don't apply
    parsed.searchParams.delete("secUid");
    // Remove bogus/gnarly since they're request-specific signatures
    parsed.searchParams.delete("X-Bogus");
    parsed.searchParams.delete("X-Gnarly");

    return parsed.toString();
  } catch (error) {
    console.warn("[Playlist:Hydrate] buildMixItemListUrl error:", error);
    return null;
  }
}

async function hydratePlaylistFromUrl(requestUrl, pageInfo) {
  AppState.playlist.isHydrating = true;

  try {
    const response = await fetch(requestUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Playlist request failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data?.itemList) || data.itemList.length === 0) {
      return false;
    }

    rememberCurrentPlaylistItems(
      data.itemList,
      pageInfo.playlistId,
      requestUrl,
      { touchLastSeen: false },
    );
    handleFoundItems(data.itemList.filter((item) => item?.id));
    return true;
  } catch (error) {
    if (AppState.debug.active) {
      console.warn("Failed to lazily hydrate playlist links:", error);
    }
    return false;
  } finally {
    AppState.playlist.isHydrating = false;
  }
}

function removePlaylistHeaderActionButton() {
  document.getElementById(PLAYLIST_HEADER_BUTTON_ID)?.remove();
}

function getPlaylistActionContextContainer(element) {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const selector =
    '#login-modal, [role="dialog"], [aria-modal="true"], [data-e2e*="modal"], [data-e2e*="video-detail"], [data-e2e*="player"]';

  return (
    element.parentElement?.closest(selector) ||
    element.closest(selector) ||
    null
  );
}

function hasPlaylistShareSemantics(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const dataE2E = element.getAttribute("data-e2e") || "";
  const label =
    element.getAttribute("aria-label") || element.textContent || dataE2E || "";

  return /\bshare\b/i.test(label.trim()) || /share-btn/i.test(dataE2E);
}

function isPlaylistModalContext(element) {
  const container = getPlaylistActionContextContainer(element);
  if (!(container instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    container.querySelector('[data-e2e="modal-close-inner-button"]') &&
    container.querySelector('[data-e2e="browse-video-desc"]'),
  );
}

function getPlaylistShareActionScore(element) {
  if (!(element instanceof HTMLElement) || !element.offsetParent) {
    return Number.NEGATIVE_INFINITY;
  }

  if (!hasPlaylistShareSemantics(element)) {
    return Number.NEGATIVE_INFINITY;
  }

  const dataE2E = element.getAttribute("data-e2e") || "";
  let score = /share-btn/i.test(dataE2E) ? 100 : 20;

  if (getPlaylistActionContextContainer(element)) {
    score += 60;
  }

  if (element.closest('[data-e2e="browse-video-desc"]')) {
    score -= 200;
  }

  if (element.closest("header")) {
    score -= 30;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    score += 5;
  }

  return score;
}

function findPlaylistShareActionElement() {
  const isNativePageAction = (element) => {
    if (!(element instanceof HTMLElement) || !element.offsetParent) {
      return false;
    }

    return !element.closest("#" + DOM_IDS.DOWNLOADER_WRAPPER);
  };

  const selectorCandidates = [
    '[data-e2e="share-btn"]',
    '[role="button"][data-e2e*="share"]',
    'button[data-e2e*="share"]',
    '[data-e2e*="share"] button',
    'button[aria-label*="Share"]',
    '[role="button"][aria-label*="Share"]',
  ];

  const candidates = new Set();

  for (const selector of selectorCandidates) {
    Array.from(document.querySelectorAll(selector)).forEach((element) => {
      const candidate =
        element instanceof HTMLElement
          ? element.closest('button, [role="button"], a') || element
          : null;

      if (
        candidate instanceof HTMLElement &&
        isNativePageAction(candidate) &&
        hasPlaylistShareSemantics(candidate)
      ) {
        candidates.add(candidate);
      }
    });
  }

  Array.from(document.querySelectorAll('button, [role="button"], a')).forEach(
    (element) => {
      if (!isNativePageAction(element)) {
        return;
      }

      if (getPlaylistShareActionScore(element) > 0) {
        candidates.add(element);
      }
    },
  );

  return (
    Array.from(candidates).sort(
      (left, right) =>
        getPlaylistShareActionScore(right) - getPlaylistShareActionScore(left),
    )[0] || null
  );
}

function findPlaylistModalCloseElement() {
  return (
    Array.from(
      document.querySelectorAll('[data-e2e="modal-close-inner-button"]'),
    ).find(
      (element) =>
        element instanceof HTMLElement &&
        element.offsetParent &&
        !element.closest("#" + DOM_IDS.DOWNLOADER_WRAPPER) &&
        isPlaylistModalContext(element),
    ) || null
  );
}

function getPlaylistButtonContext() {
  const pageInfo = syncPlaylistStateWithLocation();
  if (pageInfo.isPlaylist) {
    return pageInfo;
  }

  const modalCloseButton = findPlaylistModalCloseElement();
  if (!(modalCloseButton instanceof HTMLElement)) {
    return pageInfo;
  }

  let playlistId = String(AppState.playlist.currentId || "").trim();

  // If the modal is open but pointerdown priming didn't fire (e.g. programmatic
  // click or fast navigation), try to extract the playlist ID from a visible
  // playlist link inside the modal's parent container.
  if (!playlistId) {
    const container = getPlaylistActionContextContainer(modalCloseButton);
    if (container instanceof HTMLElement) {
      const playlistLink = container.querySelector('a[href*="/playlist/"]');
      if (playlistLink instanceof HTMLAnchorElement) {
        const href = playlistLink.getAttribute("href") || playlistLink.href;
        const match = href.match(/-([0-9]{10,})(?:[?#]|$)/);
        if (match) {
          playlistId = match[1];
          AppState.playlist.currentId = playlistId;
          AppState.playlist.currentName =
            playlistLink.textContent?.trim() || "Playlist";
          AppState.playlist.lastPrimedAt = Date.now();
        }
      }
    }
  }

  return {
    ...pageInfo,
    isProfile: true,
    isPlaylist: true,
    playlistId,
    playlistName: AppState.playlist.currentName || "Playlist",
    playlistSource: "runtime",
    isTransientPlaylist: true,
  };
}

function findPlaylistModalTitleElement() {
  const closeBtn = findPlaylistModalCloseElement();
  if (!(closeBtn instanceof HTMLElement)) return null;

  const modalContainer = closeBtn.parentElement;
  if (!(modalContainer instanceof HTMLElement)) return null;

  // The modal title is the first visible child element of the modal container
  // that isn't the content area, close button, or our own button.
  // It's always the first child div in TikTok's DivModalContainer.
  const firstChild = modalContainer.firstElementChild;
  if (
    firstChild instanceof HTMLElement &&
    firstChild.id !== PLAYLIST_HEADER_BUTTON_ID &&
    !firstChild.querySelector('[data-e2e="browse-video-desc"]') &&
    firstChild.getAttribute("data-e2e") !== "modal-close-inner-button"
  ) {
    return firstChild;
  }
  return null;
}

function getPlaylistHeaderMountTarget(pageInfo) {
  if (pageInfo.playlistSource === "runtime") {
    const modalCloseButton = findPlaylistModalCloseElement();
    if (
      modalCloseButton instanceof HTMLElement &&
      modalCloseButton.parentElement instanceof HTMLElement
    ) {
      const modalContainer = modalCloseButton.parentElement;
      // Find the content container (has browse-video-desc inside) and insert before it.
      // This places the button between the title and the video list.
      const contentContainer = Array.from(modalContainer.children).find(
        (child) =>
          child instanceof HTMLElement &&
          child.querySelector('[data-e2e="browse-video-desc"]'),
      );
      if (contentContainer) {
        return {
          container: modalContainer,
          reference: contentContainer,
          variant: "modal",
          insertPosition: "before",
        };
      }
      // Fallback: insert as second child (after title, before everything else)
      const secondChild = modalContainer.children[1];
      if (secondChild) {
        return {
          container: modalContainer,
          reference: secondChild,
          variant: "modal",
          insertPosition: "before",
        };
      }
    }
  }

  const shareAction = findPlaylistShareActionElement();
  if (!(shareAction instanceof HTMLElement) || !shareAction.parentElement) {
    return null;
  }

  if (
    pageInfo.playlistSource === "runtime" &&
    !getPlaylistActionContextContainer(shareAction)
  ) {
    return null;
  }

  return {
    container: shareAction.parentElement,
    reference: shareAction,
    variant: "inline",
    insertPosition: "after",
  };
}

function getPlaylistHeaderButtonState(
  pageInfo = syncPlaylistStateWithLocation(),
  playlistItems = getCurrentPlaylistDirectLinks(pageInfo),
) {
  const activeBatchType = getActiveDownloadBatchType();
  const activePlaylistUrls =
    activeBatchType === "playlist"
      ? getActiveDownloadBatchUrls()
      : getDownloadItemUrls(playlistItems);
  const total = activePlaylistUrls.length || playlistItems.length;
  const done = getDownloadedCountForUrls(activePlaylistUrls);

  if (AppState.downloading.isDownloadingAll) {
    if (activeBatchType !== "playlist") {
      return {
        label: t("busy"),
        icon: "hourglass",
        disabled: true,
      };
    }

    if (!total) {
      return {
        label: t("playlistDownloading"),
        icon: "hourglass",
        disabled: true,
      };
    }

    return {
      label:
        done < total ? t("progress", { current: done, total: total }) : `Downloaded ${total}`,
      icon: done < total ? "hourglass" : "check",
      disabled: true,
    };
  }

  if (!total) {
    return {
      label: t("playlistDownload"),
      icon: "down",
      disabled: !pageInfo.playlistId,
    };
  }

  return {
    label: `Download Playlist (${total})`,
    icon: "down",
    disabled: false,
  };
}

function syncPlaylistHeaderActionButton() {
  // Reentrancy guard — prevents recursive calls from microtasks or
  // DOM-mutation callbacks from creating a runaway loop.
  if (_playlistSyncActive) return;
  _playlistSyncActive = true;

  try {
    _syncPlaylistHeaderActionButtonImpl();
  } finally {
    _playlistSyncActive = false;
  }
}

function _syncPlaylistHeaderActionButtonImpl() {
  const pageInfo = getPlaylistButtonContext();
  if (!pageInfo.isPlaylist) {
    removePlaylistHeaderActionButton();
    return;
  }

  const mountTarget = getPlaylistHeaderMountTarget(pageInfo);
  if (!mountTarget) {
    removePlaylistHeaderActionButton();
    return;
  }

  const playlistLinks = getCurrentPlaylistDirectLinks(pageInfo);

  let button = document.getElementById(PLAYLIST_HEADER_BUTTON_ID);
  if (!button) {
    button = document.createElement("button");
    button.id = PLAYLIST_HEADER_BUTTON_ID;
    button.type = "button";
    button.className = "ettpd-playlist-header-btn";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (notifyDownloadBusy()) {
        return;
      }

      const current = getPlaylistButtonContext();
      await showAccountBatchDialog({ kind: "playlist", id: current.playlistId, title: current.playlistName || "Playlist" });
    });
  }

  button.classList.toggle(
    "ettpd-playlist-modal-btn",
    mountTarget.variant === "modal",
  );

  const shouldMoveButton =
    button.parentElement !== mountTarget.container ||
    (mountTarget.insertPosition === "before"
      ? button.nextElementSibling !== mountTarget.reference
      : button.previousElementSibling !== mountTarget.reference);

  if (shouldMoveButton) {
    button.remove();
    if (mountTarget.insertPosition === "before") {
      mountTarget.container.insertBefore(button, mountTarget.reference);
    } else {
      mountTarget.container.insertBefore(
        button,
        mountTarget.reference.nextSibling,
      );
    }
  }

  const state = getPlaylistHeaderButtonState(pageInfo, playlistLinks);
  setButtonWithIcon(button, state.label, state.icon);
  button.disabled = state.disabled && !AppState.downloading.isDownloadingAll;
  button.setAttribute("aria-disabled", String(state.disabled));
  button.dataset.playlistId = pageInfo.playlistId || "";
}

function createCurrentVideoButton() {
  const btn = document.createElement("button");
  btn.className = "ettpd-btn ettpd-current-video-btn";
  bindText(btn, "downloadCurrent");
  btn.disabled = true;
  btn.onclick = () => {};
  btn.style.width = "100%";
  btn.style.marginBottom = "5px";
  btn.style.marginTop = "10px";
  btn.style.display = "none"; // Hidden by default, shown when there's a current item
  return btn;
}

function createExperimentalHdButton(className, label = "HD") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.defaultLabel = label;
  setExperimentalHdIdleContent(button);
  button.style.display = "none";
  return button;
}

function setExperimentalHdIdleContent(button) {
  clearText(button);
  if (button.dataset.overlayCompact === "true") {
    const icon = document.createElement("span");
    icon.className = "download-btn-icon";
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "download-btn-label";
    label.textContent = button.dataset.defaultLabel || "HD";
    button.append(icon, label);
    return;
  }
  if (button.dataset.compact === "true") {
    const icon = createIcon("download", 14);
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
  }
  button.appendChild(
    document.createTextNode(button.dataset.defaultLabel || "HD"),
  );
}

function setCompactStandardDownloadContent(button, media) {
  clearText(button);
  const icon = createIcon("download", 14);
  icon.setAttribute("aria-hidden", "true");
  const actionLabel = getDownloadActionLabel(media);
  button.append(icon, document.createTextNode(actionLabel));
  button.title = getStandardDownloadTitle(media);
  button.setAttribute(
    "aria-label",
    getStandardDownloadTitle(media),
  );
}

function getDownloadActionLabel(media) {
  const qualityLabel = getMediaQualityLabel(media);
  return !qualityLabel || qualityLabel === "?" ? t("download") : qualityLabel;
}

function getResolutionDetails({
  width = 0,
  height = 0,
  resolutionLabel = null,
} = {}) {
  const normalizedWidth = Number(width) || 0;
  const normalizedHeight = Number(height) || 0;
  if (normalizedWidth && normalizedHeight) {
    return `${normalizedWidth}×${normalizedHeight}${
      resolutionLabel ? ` (${resolutionLabel})` : ""
    }`;
  }
  return resolutionLabel || t("unknown");
}

function getStandardDownloadTitle(media) {
  return t("standardTitle", { resolution: getResolutionDetails({
    width: media?.videoWidth,
    height: media?.videoHeight,
    resolutionLabel: media?.resolutionLabel,
  }) });
}

function getExperimentalHdTitle(source) {
  const method =
    source?.deliveryMethod === "tiktok-gateway-muxed"
        ? t("completeSource")
        : t("matchedStreams");
      return t("hdTitle", { resolution: getResolutionDetails({
    width: source?.width,
    height: source?.height,
    resolutionLabel: source?.resolutionLabel,
  }), method });
}

function getExperimentalHdSource(media) {
  if (!AppState.downloadPreferences.experimentalHd || media?.isImage) {
    return null;
  }
  return getPreferredExperimentalHdSource(media);
}

function updateExperimentalHdProgress(button, status) {
  const phase = status?.phase || "fetch";
  if (status?.quality) button.dataset.hdFallback = String(status.quality === "standard");
  else if (phase === "fallback") button.dataset.hdFallback = "true";
  const fallback = button.dataset.hdFallback === "true";
  const labelKey = phase === "fallback" ? "hdFallback" :
    ({ prepare: "prepare", mux: "mux", save: "save", retry: "retrying" })[phase] || (fallback ? "standardFetching" : "hdFetching");
  const isCompact =
    button.dataset.compact === "true" ||
    button.dataset.overlayCompact === "true";

  let label = button.querySelector(".ettpd-hd-progress-label");
  let track = button.querySelector(".ettpd-hd-progress-track");
  if (!label || !track) {
    clearText(button);
    delete button.dataset.i18nButton;
    label = document.createElement("span");
    label.className = "ettpd-hd-progress-label";
    track = document.createElement("span");
    track.className = "ettpd-hd-progress-track";
    track.setAttribute("role", "progressbar");
    const fill = document.createElement("span");
    fill.className = "ettpd-hd-progress-fill is-indeterminate";
    fill.style.width = "100%";
    track.appendChild(fill);
    button.append(label, track);
  }
  if (isCompact) label.textContent = fallback ? "SD" : "HD";
  else bindText(label, labelKey);
  bindText(track, labelKey, {}, "aria-valuetext");
  bindText(button, labelKey, {}, "title");
}

async function runExperimentalHdDownload(button, media, options = {}) {
  button.dataset.downloadActive = "true";
  button.dataset.hdFallback = "false";
  button.disabled = true;
  let usedFallback = false;
  updateExperimentalHdProgress(button, { phase: "fetch", progress: 0 });

  try {
    const saved = await downloadSingleMedia(media, {
      imageIndex: options.imageIndex || 0,
      experimentalHd: true,
      onProgress: (status) => {
        if (status.quality) usedFallback = status.quality === "standard";
        else if (status.phase === "fallback") usedFallback = true;
        updateExperimentalHdProgress(button, status);
      },
    });
    bindText(button, saved === false ? "alreadySaved" : usedFallback ? "fallbackSaved" : "hdSaved");
  } catch (error) {
    console.warn("Experimental HD download failed", error);
    bindText(button, "hdSaveFailed");
  } finally {
    setTimeout(() => {
      button.disabled = false;
      setExperimentalHdIdleContent(button);
      bindText(button, "displayName", () => ({ name: getExperimentalHdTitle(getExperimentalHdSource(media)) }), "title");
      delete button.dataset.downloadActive;
      clearDownloadBtnContainers();
    }, 2500);
  }
}

function updateStandardDownloadProgress(button, media, status) {
  const phase = status?.phase || "fetch";
  const progress = status?.progress;
  const hasProgress = typeof progress === "number" && Number.isFinite(progress);
  const labelKey = phase === "save" ? "save" : "fetch";
  const overallProgress = hasProgress
    ? Math.round(
        (phase === "save" ? 0.92 + 0.08 * progress : 0.92 * progress) * 100,
      )
    : null;
  const isCompact = button.matches(
    ".ettpd-compact-quality-download, .download-btn",
  );

  clearText(button);
  delete button.dataset.i18nButton;
  const text = document.createElement("span");
  text.className = "ettpd-hd-progress-label";
  if (isCompact) text.textContent = overallProgress == null
      ? "…"
      : new Intl.NumberFormat(getLocale(), { style: "percent" }).format(overallProgress / 100);
  else if (overallProgress == null) bindText(text, labelKey);
  else bindText(text, "phasePercent", () => ({ phase: t(labelKey), percent: new Intl.NumberFormat(getLocale(), { style: "percent" }).format(overallProgress / 100) }));
  const track = document.createElement("span");
  track.className = "ettpd-hd-progress-track";
  const fill = document.createElement("span");
  fill.className = "ettpd-hd-progress-fill";
  fill.style.width = `${overallProgress ?? 100}%`;
  if (overallProgress == null) fill.classList.add("is-indeterminate");
  track.appendChild(fill);
  button.append(text, track);
  bindText(button, labelKey, {}, "title");
}

async function runStandardDownload(button, media, options = {}) {
  button.dataset.downloadActive = "true";
  button.disabled = true;
  updateStandardDownloadProgress(button, media, {
    phase: "fetch",
    progress: 0,
  });

  try {
    const downloaded = await downloadSingleMedia(media, {
      imageIndex: options.imageIndex || 0,
      onProgress: (status) =>
        updateStandardDownloadProgress(button, media, status),
    });
    bindText(button, downloaded === false ? "alreadySaved" : "saved");
  } catch (error) {
    console.warn("Standard download failed", error);
    bindText(button, "saveFailed");
  } finally {
    setTimeout(() => {
      button.disabled = false;
      if (options.reset) {
        clearText(button);
        options.reset();
        bindText(button, "displayName", () => ({ name: getStandardDownloadTitle(media) }), "title");
      }
      delete button.dataset.downloadActive;
      clearDownloadBtnContainers();
    }, 2000);
  }
}

function getMediaQualityLabel(media) {
  if (media?.isImage) return null;
  if (media?.qualityTier === "hd") return "HD";
  if (media?.qualityTier === "sd") return "SD";
  return "?";
}

function getMediaQualityTitle(media) {
  if (!["hd", "sd"].includes(media?.qualityTier)) {
    return t("unknown");
  }

  if (media?.qualityTier !== "hd") {
    return t("qualityTitle", { quality: "SD", resolution: getResolutionDetails({
      width: media?.videoWidth,
      height: media?.videoHeight,
      resolutionLabel: media?.resolutionLabel,
    }) });
  }

  return t("qualityTitle", { quality: "HD", resolution: getResolutionDetails({
    width: media?.videoWidth,
    height: media?.videoHeight,
    resolutionLabel: media?.resolutionLabel,
  }) });
}

function createQualityBadge(media) {
  const qualityLabel = getMediaQualityLabel(media);
  if (!qualityLabel || qualityLabel === "?") return null;

  const badge = document.createElement("span");
  badge.className = `ettpd-quality-badge ettpd-quality-${
    media?.qualityTier === "hd"
      ? "hd"
      : media?.qualityTier === "sd"
        ? "sd"
        : "unknown"
  }`;
  badge.textContent = qualityLabel;
  badge.title = getMediaQualityTitle(media);
  return badge;
}

function setButtonLabelWithQuality(button, label, media) {
  clearText(button);
  const caption = document.createElement("span");
  bindText(caption, media?.isImage ? "downloadImages" : "downloadCurrent");
  button.appendChild(caption);
  const badge = createQualityBadge(media);
  if (badge) button.appendChild(badge);
  button.title = getStandardDownloadTitle(media);
}

function updateCurrentVideoButton(btn, experimentalHdBtn, items = []) {
  if (!btn) return;
  const currentVideoId = document.location.pathname.split("/")[3];
  const currentMedia = items.find(
    (media) => currentVideoId && media.videoId === currentVideoId,
  );

  if (!currentMedia) {
    // Hide the button when there's no current item
    btn.style.display = "none";
    btn.disabled = true;
    bindText(btn, "downloadCurrent");
    btn.onclick = () => {};
    if (experimentalHdBtn) {
      experimentalHdBtn.style.display = "none";
      experimentalHdBtn.onclick = null;
    }
    return;
  }

  // Show the button when there's a current item
  btn.style.display = "block";

  btn.disabled = false;
  const defaultLabel = currentMedia.isImage
    ? t("downloadImages")
    : t("downloadCurrent");
  setButtonLabelWithQuality(btn, defaultLabel, currentMedia);

  const experimentalHdSource = getExperimentalHdSource(currentMedia);
  if (experimentalHdBtn) {
    experimentalHdBtn.style.display = experimentalHdSource ? "block" : "none";
    experimentalHdBtn.textContent = experimentalHdBtn.dataset.defaultLabel;
    experimentalHdBtn.title = experimentalHdSource
      ? getExperimentalHdTitle(experimentalHdSource)
      : "";
    experimentalHdBtn.dataset.defaultTitle = experimentalHdBtn.title;
    experimentalHdBtn.onclick = experimentalHdSource
      ? (event) => {
          event.stopPropagation();
          void runExperimentalHdDownload(experimentalHdBtn, currentMedia);
        }
      : null;
  }

  if (currentMedia.isImage) {
    btn.onclick = (e) => downloadAllPostImagesHandler(e, currentMedia);
  } else {
    btn.onclick = (e) => {
      e?.stopPropagation?.();
      void runStandardDownload(btn, currentMedia, {
        reset: () => {
          setButtonLabelWithQuality(btn, defaultLabel, currentMedia);
        },
      });
    };
  }
}

function createReportBugButton() {
  const discordUrl = "https://discord.gg/UVEBcbMAqZ";
  const reportBugBtn = document.createElement("button");
  reportBugBtn.className = "ettpd-btn ettpd-report-bug";
  bindText(reportBugBtn, "reportBug");

  const reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.rel = "noopener noreferrer";
  reportBugBtnLink.href = discordUrl;
  reportBugBtnLink.appendChild(reportBugBtn);

  return reportBugBtnLink;
}
function formatCompactNumberWithTooltip(number) {
  const compact = Intl.NumberFormat(getLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);

  return `<span title="${number.toLocaleString(getLocale())}">${compact}</span>`;
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
        t("weekly"),
        allTimeRecsCount,
        "top",
        getUserRecommendationsCurrentTier,
      )}
      <div class="ettpd-stat-line-bottom" data-i18n="jokeSaved2"></div>
    `;
  } else {
    newHTML = `
      ${formatStatsLine(
        `${t("downloads")} · ${t("weekly")}`,
        weeklyCount,
        "top",
        getUserDownloadsCurrentTier,
      )}
      ${formatStatsLine(
        `${t("recommendations")} · ${t("allTime")}`,
        allTimeRecsCount,
        "bottom",
        getUserRecommendationsCurrentTier,
      )}
    `;
  }

  let existing = wrapper.querySelector(".ettpd-stats");

  if (existing && existing.dataset.renderedHtml === newHTML.trim()) {
    return; // No need to update
  }

  if (existing) existing.remove();

  const span = document.createElement("span");
  span.className = "ettpd-span ettpd-stats";
  replaceElementHtml(span, newHTML);
  span.dataset.renderedHtml = newHTML.trim();
  span.onclick = showStatsPopUp;

  const link = span.querySelector("a");
  if (link) {
    link.addEventListener("click", (e) => e.stopPropagation());
  }

  wrapper.appendChild(span);
}

function getExtensionVersion() {
  try {
    const pageVersion = document.documentElement?.getAttribute(
      "data-ettpd-extension-version",
    );
    if (pageVersion) {
      return pageVersion;
    }

    const runtime =
      typeof chrome !== "undefined" && chrome?.runtime
        ? chrome.runtime
        : typeof browser !== "undefined" && browser?.runtime
          ? browser.runtime
          : null;
    return runtime?.getManifest?.().version || "unknown";
  } catch {
    return "unknown";
  }
}

function createCreditsSpan() {
  const span = document.createElement("span");
  span.className = "ettpd-span ettpd-copyright";

  const year = new Date().getFullYear();
  const version = getExtensionVersion();

  // Create coffee link with consistent styling
  const coffeeLink = document.createElement("button");
  coffeeLink.type = "button";
  coffeeLink.textContent = "buy me a coffee ☕";
  coffeeLink.style.cssText = `
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-decoration: none;
    opacity: 0.8;
    transition: opacity 0.2s;
  `;
  coffeeLink.onmouseenter = () => {
    coffeeLink.style.opacity = "1";
  };
  coffeeLink.onmouseleave = () => {
    coffeeLink.style.opacity = "0.8";
  };
  coffeeLink.onclick = (e) => {
    e.stopPropagation();
    showPayItForwardDialog({ dark: getResolvedThemeMode() === "dark" });
  };

  // Add Discord link (replaces "no refunds lol")
  const discordLink = document.createElement("a");
  discordLink.href = "https://discord.gg/UVEBcbMAqZ";
  discordLink.target = "_blank";
  discordLink.rel = "noopener noreferrer";
  bindText(discordLink, "joinDiscord", {}, "title");
  discordLink.className = "ettpd-discord-link";

  // Apply theme class
  const resolvedTheme = getResolvedThemeMode();
  if (resolvedTheme === "dark") {
    discordLink.classList.add("ettpd-theme-dark");
  } else {
    discordLink.classList.add("ettpd-theme-classic");
  }

  // Match the coffee link styling exactly for proper alignment
  discordLink.style.cssText = `
    display: inline;
    color: inherit;
    text-decoration: none;
    opacity: 0.8;
    transition: opacity 0.2s;
    margin-left: 4px;
  `;
  discordLink.onmouseenter = () => {
    discordLink.style.opacity = "1";
  };
  discordLink.onmouseleave = () => {
    discordLink.style.opacity = "0.8";
  };
  discordLink.onclick = (e) => {
    e.stopPropagation();
  };

  // Add Discord icon inline with text, properly aligned
  const discordIcon = createIcon("discord", 12);
  discordIcon.style.cssText = `
    display: inline-block;
    vertical-align: baseline;
    margin-right: 3px;
    position: relative;
    top: 2px;
  `;
  discordLink.appendChild(discordIcon);

  // Add text node directly (not wrapped in span) for better baseline alignment
  discordLink.appendChild(document.createTextNode("Discord"));

  // Build the span content
  span.appendChild(document.createTextNode(`v${version} © ${year} `));
  span.appendChild(coffeeLink);
  span.appendChild(document.createTextNode(" "));
  span.appendChild(discordLink);
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
  setLocalizedButton(userPostsBtn, "autoScroll", "folder");
  userPostsBtn.title =
    t("scanHelp");
  userPostsBtn.style.flex = "1";

  container.appendChild(settingsBtn);
  container.appendChild(userPostsBtn);

  return { container, settingsBtn, userPostsBtn };
}

function createExperimentalHdBanner(preferencesBox, settingsBtn) {
  const banner = document.createElement("aside");
  banner.className = "ettpd-experimental-hd-banner";
  bindText(banner, "experimentalHd", {}, "aria-label");
  banner.style.display =
    AppState.downloadPreferences.experimentalHd ||
    AppState.ui.hasDismissedExperimentalHdBanner
      ? "none"
      : "grid";

  const icon = document.createElement("span");
  icon.className = "ettpd-experimental-hd-banner-icon";
  icon.textContent = "HD";

  const copy = document.createElement("div");
  copy.className = "ettpd-experimental-hd-banner-copy";
  const title = document.createElement("strong");
  bindText(title, "experimentalHd");
  const detail = document.createElement("span");
  bindText(detail, "experimentalHdHint");
  copy.append(title, detail);

  const actions = document.createElement("div");
  actions.className = "ettpd-experimental-hd-banner-actions";
  const tryButton = document.createElement("button");
  tryButton.type = "button";
  tryButton.className = "ettpd-experimental-hd-banner-try";
  bindText(tryButton, "experimentalHd");
  tryButton.onclick = (event) => {
    event.stopPropagation();
    if (!AppState.ui.isPreferenceBoxOpen) settingsBtn.click();
    setTimeout(() => {
      const checkbox = preferencesBox.querySelector(
        'input[name="experimentalHd"]',
      );
      const settingRow = checkbox?.closest("label");
      if (!checkbox || !settingRow) return;

      preferencesBox.scrollTop = Math.max(
        0,
        settingRow.offsetTop - preferencesBox.clientHeight / 3,
      );
      settingRow.classList.remove("ettpd-setting-spotlight");
      void settingRow.offsetWidth;
      settingRow.classList.add("ettpd-setting-spotlight");
      settingRow.setAttribute("aria-live", "polite");
      checkbox?.focus();
      setTimeout(() => {
        settingRow.classList.remove("ettpd-setting-spotlight");
        settingRow.removeAttribute("aria-live");
      }, 6000);
    }, 100);
  };
  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "ettpd-experimental-hd-banner-dismiss";
  bindText(dismissButton, "dismiss", {}, "aria-label");
  bindText(dismissButton, "dismiss", {}, "title");
  dismissButton.textContent = "×";
  dismissButton.onclick = (event) => {
    event.stopPropagation();
    AppState.ui.hasDismissedExperimentalHdBanner = true;
    localStorage.setItem(
      STORAGE_KEYS.EXPERIMENTAL_HD_BANNER_DISMISSED,
      "true",
    );
    banner.remove();
  };
  actions.append(tryButton, dismissButton);
  banner.append(icon, copy, actions);
  return banner;
}

function createExperimentalHdStatus() {
  const status = document.createElement("aside");
  status.className = "ettpd-experimental-hd-status";
  status.setAttribute("aria-live", "polite");
  status.style.display = "none";
  return status;
}

function updateExperimentalHdStatus(status, items = []) {
  if (!status) return;
  const wrapper = status.closest("#" + DOM_IDS.DOWNLOADER_WRAPPER);
  wrapper?.classList.toggle(
    "ettpd-experimental-hd-enabled",
    AppState.downloadPreferences.experimentalHd,
  );
  if (!AppState.downloadPreferences.experimentalHd) {
    status.style.display = "none";
    status.replaceChildren();
    return;
  }

  const currentVideoId = document.location.pathname.match(/\/video\/(\d+)/)?.[1];
  const currentMedia = items.find(
    (media) => String(media?.videoId) === String(currentVideoId),
  );
  const experimentalSource = getExperimentalHdSource(currentMedia);
  const rawItem = currentVideoId
    ? AppState.allItemsEverSeen?.[currentVideoId]
    : null;
  const rawHdSource = (rawItem?.video?.bitrateInfo || []).find((entry) => {
    const width = Number(entry?.PlayAddr?.Width) || 0;
    const height = Number(entry?.PlayAddr?.Height) || 0;
    return (
      isAdaptiveGearName(entry?.GearName) &&
      Math.min(width, height) >= 1080
    );
  });
  const hydrationState = currentVideoId
    ? experimentalHdHydrationState.get(currentVideoId)
    : null;

  if (currentMedia && !experimentalSource && !hydrationState) {
    experimentalHdHydrationState.set(currentVideoId, "loading");
    void hydrateTikTokVideoDetail(
      currentVideoId,
      currentMedia.authorId,
    ).then((item) => {
      experimentalHdHydrationState.set(
        currentVideoId,
        item ? "loaded" : "unavailable",
      );
      if (item) handleFoundItems([item]);
      displayFoundUrls({ forced: true });
    });
  }

  let state = "waiting";
  let headline = "experimentalHd";
  let headlineValues = {};
  let detail = "experimentalHdHint";
  if (experimentalSource) {
    state = "ready";
    headline = "qualityTitle";
    headlineValues = { quality: "HD", resolution: getResolutionDetails({
      width: experimentalSource.width,
      height: experimentalSource.height,
      resolutionLabel: experimentalSource.resolutionLabel,
    }) };
    detail = "hdReadyHint";
  } else if (
    currentVideoId &&
    (rawHdSource || hydrationState === "loading" || !hydrationState)
  ) {
    state = "scanning";
    headline = "prepare";
    detail = "hdCheckingHint";
  } else if (currentVideoId) {
    state = "unavailable";
    const observedQuality = getResolutionDetails({
      width: currentMedia?.observedMaxWidth,
      height: currentMedia?.observedMaxHeight,
      resolutionLabel: currentMedia?.observedMaxResolution,
    });
    headline = currentMedia?.observedMaxResolution ? "qualityTitle" : "notAvailable";
    headlineValues = { quality: getMediaQualityLabel(currentMedia) || "?", resolution: observedQuality };
    detail = "standardHint";
  }

  status.dataset.state = state;
  status.style.display = "flex";
  status.replaceChildren();
  const indicator = document.createElement("span");
  indicator.className = "ettpd-experimental-hd-status-indicator";
  indicator.textContent = state === "ready" ? "HD" : "✓";
  const copy = document.createElement("span");
  copy.className = "ettpd-experimental-hd-status-copy";
  const title = document.createElement("strong");
  bindText(title, headline, headlineValues);
  const description = document.createElement("span");
  bindText(description, detail);
  copy.append(title, description);
  status.append(indicator, copy);
}

export function updateDownloaderList(items, hashToDisplay) {
  const _id = DOM_IDS.DOWNLOADER_WRAPPER;
  let wrapper = document.getElementById(_id);
  if (
    wrapper &&
    (AppState.downloading.isActive || AppState.downloading.isDownloadingAll)
  ) return wrapper;
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
  const messagesCheckbox = wrapper.querySelector('input[name="showDownloadMessages"]');
  if (messagesCheckbox) {
    messagesCheckbox.checked = AppState.downloadPreferences.showDownloadMessages;
  }
  const confettiCheckbox = wrapper.querySelector('input[name="disableConfetti"]');
  if (confettiCheckbox) {
    confettiCheckbox.checked = !AppState.downloadPreferences.disableConfetti;
  }
  refs?.updateVisibleBox?.();
  updateExperimentalHdStatus(refs?.experimentalHdStatus, items);
  updateDownloadAllButtonState(refs?.downloadAllBtn, items);
  updateCurrentVideoButton(
    refs?.currentVideoBtn,
    refs?.experimentalCurrentVideoBtn,
    items,
  );

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
  const experimentalHdBanner = createExperimentalHdBanner(
    preferencesBox,
    settingsBtn,
  );
  const experimentalHdStatus = createExperimentalHdStatus();

  const scrapperContainer = document.createElement("div");
  scrapperContainer.id = DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER;
  const downloadAllContainer = createDownloadAllButton();
  const downloadAllBtn = downloadAllContainer.querySelector(
    "#" + DOM_IDS.DOWNLOAD_ALL_BUTTON,
  );
  const currentVideoBtn = createCurrentVideoButton();
  const experimentalCurrentVideoBtn = createExperimentalHdButton(
    "ettpd-btn ettpd-experimental-current-video-btn",
  );
  const reportBugBtn = createReportBugButton();
  const creditsSpan = createCreditsSpan();
  const list = document.createElement("ol");
  list.className = "ettpd-ol";
  const closeBtn = createCloseButton();

  wrapper.append(
    settingsAndScrapperBtnContainer,
    experimentalHdBanner,
    experimentalHdStatus,
    scrapperContainer,
    preferencesBox,
    downloadAllContainer,
    currentVideoBtn,
    experimentalCurrentVideoBtn,
    reportBugBtn,
    creditsSpan,
    list,
    closeBtn,
  );

  const refs = {
    preferencesBox,
    settingsBtn,
    userPostsBtn,
    scrapperContainer,
    downloadAllBtn,
    currentVideoBtn,
    experimentalCurrentVideoBtn,
    experimentalHdStatus,
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
        AppState.ui.isPreferenceBoxOpen,
      );
    }

    if (userPostsBtn) {
      userPostsBtn.classList.toggle(
        "ettpd-settings-open",
        AppState.ui.isScrapperBoxOpen,
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
    Array.from(listEl.children).map((child) => [child.dataset.videoId, child]),
  );

  const fragment = document.createDocumentFragment();
  const orderedItems = [...items].reverse();

  const currentVideoId = document.location.pathname.split("/")[3];
  let hasMarkedCurrent = false;

  orderedItems.forEach((media) => {
    const key = media.videoId || media.id;
    if (!key) return;
    const entryHash = getMediaEntryHash(media);

    const shouldMarkAsCurrent =
      !hasMarkedCurrent && currentVideoId && currentVideoId === media?.videoId;

    let node = existingNodes.get(key);

    if (node && node.dataset.entryHash === entryHash) {
      existingNodes.delete(key);
      const authorWrapper = node.querySelector(".ettpd-author-wrapper");
      if (authorWrapper) {
        const existingCurrent = authorWrapper.querySelector(
          '.ettpd-emoji[data-role="current-video"]',
        );
        if (existingCurrent) existingCurrent.remove();
        if (shouldMarkAsCurrent) {
          const liveEmoji = document.createElement("span");
          bindText(liveEmoji, "currentPost", {}, "title");
          liveEmoji.className = "ettpd-emoji";
          liveEmoji.dataset.role = "current-video";
          const playIcon = createIcon("play", 14);
          liveEmoji.appendChild(playIcon);
          authorWrapper.insertBefore(liveEmoji, authorWrapper.firstChild);
        }
      }
    } else {
      if (node) {
        existingNodes.delete(key);
        node.remove();
      }
      node = buildMediaListItem(media, { markAsCurrent: shouldMarkAsCurrent });
      node.dataset.entryHash = entryHash;
    }

    if (shouldMarkAsCurrent) {
      hasMarkedCurrent = true;
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
  bindText(li, "noPosts");
  return li;
}

function getMediaEntryHash(media) {
  const parts = [
    media.videoId || media.id || "",
    media.authorId || "",
    media.desc || "",
    media.downloaderHasLowConfidence ? "1" : "0",
    media.isAd ? "1" : "0",
    media.qualityLabel || "?",
    getExperimentalHdSource(media)?.url || "",
    media.isImage
      ? `img:${(media.imagePostImages || []).join("|")}`
      : `vid:${media.url || ""}`,
  ];
  return parts.join("|");
}

function buildMediaListItem(media, options = {}) {
  const { markAsCurrent = false } = options;
  const item = document.createElement("li");
  item.className = "ettpd-li";
  item.dataset.videoId = media.videoId || media.id || "";

  const textContainer = document.createElement("div");
  textContainer.className = "ettpd-text-container";

  const authorWrapper = document.createElement("div");
  authorWrapper.className = "ettpd-author-wrapper";

  if (markAsCurrent) {
    const liveEmoji = document.createElement("span");
    bindText(liveEmoji, "currentPost", {}, "title");
    liveEmoji.className = "ettpd-emoji";
    liveEmoji.dataset.role = "current-video";
    const playIcon = createIcon("play", 14);
    liveEmoji.appendChild(playIcon);
    authorWrapper.appendChild(liveEmoji);
  }

  if (media?.downloaderHasLowConfidence) {
    const lowConfidenceEmoji = document.createElement("span");
    bindText(lowConfidenceEmoji, "incompleteMetadata", {}, "title");
    lowConfidenceEmoji.className = "ettpd-emoji";
    const infoIcon = createIcon("info", 14);
    lowConfidenceEmoji.appendChild(infoIcon);
    authorWrapper.appendChild(lowConfidenceEmoji);
  }

  if (media?.isAd) {
    const adEmoji = document.createElement("span");
    adEmoji.textContent = "📣";
    bindText(adEmoji, "adContent", {}, "title");
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

  if (fullDesc.length > 100) {
    descSpan.classList.add("ettpd-desc-expandable");
    descSpan.style.cursor = "pointer";
    bindText(descSpan, "expandCollapse", {}, "title");
  } else {
    descSpan.style.cursor = "default";
    bindText(descSpan, "field_desc", {}, "title");
  }
  descSpan.onclick = () => {
    expanded = !expanded;
    descSpan.innerText = expanded ? fullDesc : shortDesc;
    // Remove expandable styling when expanded, add it back when collapsed
    if (expanded) {
      descSpan.classList.remove("ettpd-desc-expandable");
      descSpan.classList.add("ettpd-desc-expanded");
    } else {
      descSpan.classList.remove("ettpd-desc-expanded");
      descSpan.classList.add("ettpd-desc-expandable");
    }
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
    bindText(tiktokBtnContainer, "openPost", {}, "title");
    tiktokBtnContainer.onclick = (e) => {
      e.stopPropagation();
      if (media?.videoId && media?.authorId)
        window.open(
          `https://tiktok.com/@${media.authorId}/photo/${media.videoId}`,
          "_blank",
        );
    };
    const tiktokBtn = document.createElement("span");
    tiktokBtnContainer.appendChild(tiktokBtn);
    downloadAllBtnContainer.appendChild(tiktokBtnContainer);
    setLocalizedButton(downloadAllBtn, "downloadImages", "down");
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
      bindText(downloadBtn, "download");
      downloadBtn.className = "ettpd-download-btn";

      downloadBtn.onclick = async (e) => {
        e.stopPropagation();

        const originalContent = downloadBtn.cloneNode(true);
        downloadBtn.textContent = "";
        const downloadingIcon3 = createIcon("hourglass", 16);
        downloadingIcon3.style.marginRight = "4px";
        downloadBtn.appendChild(downloadingIcon3);
        downloadBtn.appendChild(document.createTextNode(t("fetch")));

        const delayBeforeStart = 600;
        const minDisplayAfter = 1000;
        const startedAt = Date.now();

        await new Promise((r) => setTimeout(r, delayBeforeStart));

        try {
          await downloadSingleMedia(media, { imageIndex: i });

          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, minDisplayAfter - elapsed);

          setTimeout(() => {
            downloadBtn.textContent = "";
            const doneIcon3 = createIcon("check", 16);
            doneIcon3.style.marginRight = "4px";
            downloadBtn.appendChild(doneIcon3);
            downloadBtn.appendChild(document.createTextNode(t("saved")));
            setTimeout(() => {
              downloadBtn.replaceWith(originalContent.cloneNode(true));
            }, 3000);
          }, remaining);
        } catch (err) {
          console.error("Image download failed:", err);
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, minDisplayAfter - elapsed);

          setTimeout(() => {
            downloadBtn.textContent = "";
            const failedIcon3 = createIcon("error", 16);
            failedIcon3.style.marginRight = "4px";
            downloadBtn.appendChild(failedIcon3);
            downloadBtn.appendChild(document.createTextNode(t("saveFailed")));
            setTimeout(() => {
              downloadBtn.replaceWith(originalContent.cloneNode(true));
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
    bindText(tiktokBtnContainer, "openPost", {}, "title");
    const tiktokBtn = document.createElement("span");

    tiktokBtn.onclick = (e) => {
      e.stopPropagation();
      if (media?.videoId && media?.authorId)
        window.open(
          `https://tiktok.com/@${media.authorId}/video/${media.videoId}`,
          "_blank",
        );
    };
    tiktokBtnContainer.appendChild(tiktokBtn);
    const viewBtnContainer = document.createElement("div");
    viewBtnContainer.className = "ettpd-download-btn ettpd-view-btn";
    bindText(viewBtnContainer, "openSource", {}, "title");
    const viewBtn = document.createElement("span");
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      if (media?.url) window.open(media.url, "_blank");
    };
    viewBtnContainer.appendChild(viewBtn);

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "ettpd-download-btn ettpd-compact-quality-download";
    setCompactStandardDownloadContent(downloadBtn, media);
    const experimentalHdSource = getExperimentalHdSource(media);
    const experimentalHdBtn = experimentalHdSource
      ? createExperimentalHdButton(
          "ettpd-download-btn ettpd-experimental-hd-list-btn",
          "HD",
        )
      : null;
    if (experimentalHdBtn) {
      experimentalHdBtn.dataset.compact = "true";
      setExperimentalHdIdleContent(experimentalHdBtn);
      experimentalHdBtn.style.display = "inline-flex";
      experimentalHdBtn.title = getExperimentalHdTitle(experimentalHdSource);
      experimentalHdBtn.dataset.defaultTitle = experimentalHdBtn.title;
      experimentalHdBtn.onclick = (event) => {
        event.stopPropagation();
        void runExperimentalHdDownload(experimentalHdBtn, media);
      };
    }

    downloadBtn.onclick = (e) => {
      e.stopPropagation();
      void runStandardDownload(downloadBtn, media, {
        reset: () => setCompactStandardDownloadContent(downloadBtn, media),
      });
    };

    const holderEl = document.createElement("div");
    holderEl.className = "ettpd-download-btns-container";
    holderEl.append(tiktokBtnContainer, viewBtnContainer, downloadBtn);
    if (experimentalHdBtn) holderEl.appendChild(experimentalHdBtn);
    downloadBtnHolder.append(holderEl);
  }

  item.append(textContainer, downloadBtnHolder);
  return item;
}

/**
 * Constrain wrapper to viewport, accounting for extended elements (header, footer, close button)
 * Similar to constrainToViewport() for the show button
 */
function constrainWrapperToViewport(wrapper) {
  if (!wrapper || !wrapper.parentElement) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const wrapperRect = wrapper.getBoundingClientRect();

  // Account for extended elements:
  // Header (ettpd-stats) extends top: -37px above wrapper
  // Footer (ettpd-copyright) extends bottom: -17px below wrapper
  // Close button extends top: -8px, right: -8px beyond wrapper
  const headerExtension = 37;
  const footerExtension = 17;
  const closeButtonExtension = 8;

  // Calculate effective bounds including extended elements
  const effectiveTop = wrapperRect.top - headerExtension;
  const effectiveBottom = wrapperRect.bottom + footerExtension;
  const effectiveHeight = effectiveBottom - effectiveTop;
  const effectiveWidth = wrapperRect.width + closeButtonExtension;

  // Get current position style values
  const currentLeft = wrapperRect.left;
  const currentTop = wrapperRect.top;
  const currentRight = viewportWidth - wrapperRect.right;
  const currentBottom = viewportHeight - wrapperRect.bottom;

  // Determine if using left/top (custom) or corner positioning
  const isCustomPosition =
    wrapper.style.left &&
    wrapper.style.left !== "" &&
    wrapper.style.top &&
    wrapper.style.top !== "" &&
    (wrapper.style.bottom === "" || wrapper.style.bottom === "auto") &&
    (wrapper.style.right === "" || wrapper.style.right === "auto");

  if (isCustomPosition) {
    // Custom position: constrain using left/top
    const minLeft = 0;
    const maxLeft = viewportWidth - wrapperRect.width;
    const minTop = headerExtension; // Ensure header doesn't go above viewport
    const maxTop = viewportHeight - wrapperRect.height - footerExtension; // Ensure footer doesn't go below viewport

    let constrainedLeft = Math.max(minLeft, Math.min(maxLeft, currentLeft));
    let constrainedTop = Math.max(minTop, Math.min(maxTop, currentTop));

    // Apply constrained position
    wrapper.style.left = `${constrainedLeft}px`;
    wrapper.style.top = `${constrainedTop}px`;
    wrapper.style.bottom = "auto";
    wrapper.style.right = "auto";

    // Update live position state
    AppState.ui.live_ETTPD_CUSTOM_POS = JSON.stringify({
      left: constrainedLeft,
      top: constrainedTop,
    });

    return { left: constrainedLeft, top: constrainedTop };
  } else {
    // Corner position: ensure extended elements stay visible
    // For corner positions, check if wrapper bounds would cause extended elements to go out of viewport
    const hasTop = wrapper.style.top && wrapper.style.top !== "";
    const hasBottom = wrapper.style.bottom && wrapper.style.bottom !== "";
    const hasLeft = wrapper.style.left && wrapper.style.left !== "";
    const hasRight = wrapper.style.right && wrapper.style.right !== "";

    // Check if header would go above viewport
    if (hasTop && wrapperRect.top < headerExtension) {
      const currentTop = parseFloat(wrapper.style.top) || 20;
      wrapper.style.top = `${Math.max(headerExtension, currentTop)}px`;
    }

    // Check if footer would go below viewport
    if (hasBottom && wrapperRect.bottom > viewportHeight - footerExtension) {
      const currentBottom = parseFloat(wrapper.style.bottom) || 80;
      wrapper.style.bottom = `${Math.max(footerExtension, currentBottom)}px`;
    }

    // Check if close button would go beyond right edge
    if (hasRight && wrapperRect.right > viewportWidth - closeButtonExtension) {
      const currentRight = parseFloat(wrapper.style.right) || 20;
      wrapper.style.right = `${Math.max(closeButtonExtension, currentRight)}px`;
    }

    // Check if wrapper would go beyond left edge
    if (hasLeft && wrapperRect.left < 0) {
      wrapper.style.left = "0px";
    }
  }
}

function makeElementDraggable(wrapper, handle) {
  console.log(" AppState.ui.isDragging 12orubt init", AppState.ui.isDragging);

  let offsetX = 0,
    offsetY = 0;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;

  // Start dragging
  handle.addEventListener("mousedown", (e) => {
    console.log(
      " AppState.ui.isDragging 12orubt mousedown",
      AppState.ui.isDragging,
    );

    AppState.ui.isDragging = true;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    console.log(
      " AppState.ui.isDragging 12orubt mousedown 2",
      AppState.ui.isDragging,
    );
    const rect = wrapper.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = "none";
  });

  //Dragging in motion
  const handleMouseMove = (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) <= 2 && Math.abs(e.clientY - startY) <= 2 && !moved) return;
    moved = true;
    AppState.ui.downloaderPositionType = "custom";
    wrapper._setCornerValue?.("");

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const wrapperRect = wrapper.getBoundingClientRect();

    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Account for extended elements when constraining
    const headerExtension = 37;
    const footerExtension = 17;
    const minLeft = 0;
    const maxLeft = Math.max(0, viewportWidth - wrapperRect.width);
    const minTop = headerExtension; // Ensure header doesn't go above viewport
    const maxTop = Math.max(minTop, viewportHeight - wrapperRect.height - footerExtension); // Ensure footer doesn't go below viewport

    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
    newTop = Math.max(minTop, Math.min(maxTop, newTop));

    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
    wrapper.style.bottom = "auto";
    wrapper.style.right = "auto";

    // Update live position state with constrained values
    AppState.ui.live_ETTPD_CUSTOM_POS = JSON.stringify({
      left: newLeft,
      top: newTop,
    });
  };
  document.addEventListener("mousemove", handleMouseMove);

  // Ensure wrapper stays in viewport on window resize
  const handleResize = () => {
    if (wrapper && wrapper.parentElement) {
      constrainWrapperToViewport(wrapper);

      // If using custom position, save the constrained position
      const positionType = localStorage.getItem(
        STORAGE_KEYS.DOWNLOADER_POSITION_TYPE,
      );
      if (positionType === "custom") {
        const pos = constrainWrapperToViewport(wrapper);
        if (pos) {
          AppState.ui.live_ETTPD_CUSTOM_POS = JSON.stringify(pos);
          localStorage.setItem(
            STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION,
            AppState.ui.live_ETTPD_CUSTOM_POS,
          );
        }
      }
    }
  };

  window.addEventListener("resize", handleResize);

  // Stop dragging
  const handleMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    AppState.ui.isDragging = false;
    document.body.style.userSelect = "";
    if (!moved) return;

    // Ensure final position is constrained
    constrainWrapperToViewport(wrapper);

    // Save final position if using custom position
    const positionType = AppState.ui.downloaderPositionType;
    if (positionType === "custom") {
      localStorage.setItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE, "custom");
      const pos = constrainWrapperToViewport(wrapper);
      if (pos) {
        AppState.ui.live_ETTPD_CUSTOM_POS = JSON.stringify(pos);
        localStorage.setItem(
          STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION,
          AppState.ui.live_ETTPD_CUSTOM_POS,
        );
      }
    }
  };
  document.addEventListener("mouseup", handleMouseUp);

  // Store cleanup function on wrapper for later removal if needed
  wrapper._cleanupDraggable = () => {
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    if (dragging) {
      AppState.ui.isDragging = false;
      document.body.style.userSelect = "";
    }
    dragging = false;
  };
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
    if (!hasMoved) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const buttonRect = button.getBoundingClientRect();

    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Constrain to viewport bounds - ensure button never goes offscreen
    const minLeft = 0;
    const maxLeft = Math.max(0, viewportWidth - buttonRect.width);
    const minTop = 0;
    const maxTop = Math.max(0, viewportHeight - buttonRect.height);

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
        const rect = button.getBoundingClientRect();
        const position = JSON.stringify({ left: rect.left, top: rect.top });
        localStorage.setItem(STORAGE_KEYS.SHOW_BUTTON_POSITION, position);
        button._savePositionTimeout = null;
      }, 100);
    }
  };

  // Ensure button stays in viewport on window resize
  const handleResize = () => {
    if (button && button.parentElement) {
      if (!readStoredPosition(localStorage.getItem(STORAGE_KEYS.SHOW_BUTTON_POSITION))) return;
      const pos = constrainToViewport();
      localStorage.setItem(
        STORAGE_KEYS.SHOW_BUTTON_POSITION,
        JSON.stringify(pos),
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
      if (hasMoved) {
        const buttonRect = button.getBoundingClientRect();
        const position = JSON.stringify({ left: buttonRect.left, top: buttonRect.top });
        localStorage.setItem(STORAGE_KEYS.SHOW_BUTTON_POSITION, position);
      }

      // Reset after a short delay
      setTimeout(() => {
        button.dataset.wasDragging = "false";
      }, 100);
    }
  };

  document.addEventListener("mouseup", handleMouseUp);

  // Store cleanup on button for later removal if needed
  button._cleanupDraggable = () => {
    clearTimeout(button._savePositionTimeout);
    button._savePositionTimeout = null;
    if (isDragging) document.body.style.userSelect = "";
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
    showBtn.style.left = "20px";
    showBtn.style.top = "auto";
    showBtn.style.bottom = "50px";
    showBtn.style.right = "auto";
  }
}

export function hideDownloader() {
  const wrapper = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
  // Clean up event listeners before removing to prevent memory leak
  if (wrapper && typeof wrapper._cleanupDraggable === "function") {
    wrapper._cleanupDraggable();
  }
  wrapper?.remove();

  // Check if button already exists - if it does, ensure it's visible
  const existingBtn = document.getElementById(DOM_IDS.SHOW_DOWNLOADER);
  if (existingBtn) {
    // Ensure button is visible and in the DOM
    existingBtn.style.display = "inline-flex";
    existingBtn.style.visibility = "visible";
    existingBtn.style.opacity = "1";
    existingBtn.style.zIndex = "99998";
    // Ensure it's in the body (in case it was moved or removed)
    if (!document.body.contains(existingBtn)) {
      document.body.appendChild(existingBtn);
    }
    return;
  }

  const showBtn = document.createElement("button");
  showBtn.id = DOM_IDS.SHOW_DOWNLOADER;
  showBtn.className = "ettpd-show-btn";
  bindText(showBtn, "dragMove", {}, "title");
  bindText(showBtn, "dragMove", {}, "aria-label");

  // Create SVG drag-handle + download icon
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

  // Drag dots (grip) to hint draggability
  const dragGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  dragGroup.setAttribute("fill", "currentColor");
  [
    [9, 7],
    [9, 11],
    [9, 15],
    [13, 7],
    [13, 11],
    [13, 15],
  ].forEach(([cx, cy]) => {
    const dot = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", "0.7");
    dragGroup.appendChild(dot);
  });
  svgIcon.appendChild(dragGroup);

  // Set button content - icon + label
  showBtn.appendChild(svgIcon);
  const textSpan = document.createElement("span");
  bindText(textSpan, "open");
  showBtn.appendChild(textSpan);

  // Add Discord icon as a small clickable element
  const discordLink = document.createElement("a");
  discordLink.href = "https://discord.gg/UVEBcbMAqZ";
  discordLink.target = "_blank";
  discordLink.rel = "noopener noreferrer";
  bindText(discordLink, "joinDiscord", {}, "title");
  discordLink.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 6px;
    padding: 2px;
    opacity: 0.8;
    transition: opacity 0.2s;
    cursor: pointer;
  `;
  discordLink.onmouseenter = () => {
    discordLink.style.opacity = "1";
  };
  discordLink.onmouseleave = () => {
    discordLink.style.opacity = "0.8";
  };
  discordLink.onclick = (e) => {
    e.stopPropagation(); // Prevent triggering the button click
  };

  const discordIcon = createIcon("discord", 14);
  discordIcon.style.display = "inline-block";
  discordIcon.style.verticalAlign = "middle";
  discordLink.appendChild(discordIcon);
  showBtn.appendChild(discordLink);

  // One-time attention animation on first render
  if (!AppState.ui.hasSeenShowButtonHint) {
    showBtn.classList.add("ettpd-show-btn-pop");
    AppState.ui.hasSeenShowButtonHint = true;
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_BUTTON_HINT_SEEN, "true");
    } catch {}
    setTimeout(() => {
      showBtn.classList.remove("ettpd-show-btn-pop");
    }, 900);
  }

  // Apply theme class
  if (getResolvedThemeMode() === "dark") {
    showBtn.classList.add("ettpd-theme-dark");
  }

  // Restore saved position and ensure it's within viewport
  const savedPosition = localStorage.getItem(STORAGE_KEYS.SHOW_BUTTON_POSITION);
  if (savedPosition) {
    try {
      const pos = JSON.parse(savedPosition);
      if (Number.isFinite(pos?.left) && Number.isFinite(pos?.top)) {
        // Ensure position is within viewport bounds
        // We'll measure the button after it's added to DOM, but set initial position
        showBtn.style.left = `${pos.left}px`;
        showBtn.style.top = `${pos.top}px`;
        showBtn.style.bottom = "auto";
        showBtn.style.right = "auto";

        // After button is added to DOM, constrain it to viewport
        setTimeout(() => {
          const buttonRect = showBtn.getBoundingClientRect();
          const minLeft = 0;
          const maxLeft = Math.max(0, window.innerWidth - buttonRect.width);
          const minTop = 0;
          const maxTop = Math.max(0, window.innerHeight - buttonRect.height);

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
              }),
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
            t("disabledHint"),
          );
          return;
        }

        localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "false");
        AppState.ui.isDownloaderClosed = false;
        AppState.ui.isPreferenceBoxOpen = false;
        displayFoundUrls({ forced: true });
        if (document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER)) {
          showBtn._cleanupDraggable?.();
          showBtn.remove();
        } else {
          AppState.ui.isDownloaderClosed = true;
          localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "true");
        }
      }
    }, 50);
  });

  // Make draggable
  makeShowButtonDraggable(showBtn);

  document.body?.appendChild(showBtn);
}

export function showRateUsPopUpLegacy() {
  if (!shouldShowRatePopupLegacy() || !claimAutomaticPopup()) return false;
  const reviewTarget = getExtensionReviewTarget();
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
  replaceElementHtml(
    box,
    `
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
    <h2 style="margin-bottom: 15px; font-size: 1.5em; color: #1da1f2;" data-i18n="thanks"></h2>
    <p style="margin-bottom: 20px; font-size: 1em; line-height: 1.5; color: #555555;" data-i18n="reviewInvitation"></p>
    <a
      href="${escapeHtml(reviewTarget.url)}"
      target="_blank"
      rel="noopener noreferrer"
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
      <span data-i18n="rate"></span>
    </a>
  </div>
`,
  );
  overlay.appendChild(box);

  box.querySelector("a")?.addEventListener("click", () => {
    AppState.rateDonate.lastRatedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.RATE_DONATE_DATA, JSON.stringify(AppState.rateDonate));
  });
  overlay.onclick = () => {
    AppState.ui.isRatePopupOpen = false;

    overlay.remove();
  };
  AppState.rateDonate.lastShownAt = Date.now();
  AppState.rateDonate.shownCount += 1;
  localStorage.setItem(
    STORAGE_KEYS.RATE_DONATE_DATA,
    JSON.stringify(AppState.rateDonate),
  );
  document.body.appendChild(overlay);
  return true;
}

export function showStatsPopUp() {
  if (AppState.downloading.isDownloadingAll || AppState.downloading.isActive) {
    showToast(
      t("busy"),
      t("busyMessage"),
    );
    return;
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
    { key: "downloads", label: "downloads", icon: "down" },
    { key: "recommendations", label: "recommendations", icon: "star" },
  ];

  const tabButtons = tabs.map(({ key, label, icon }) => {
    const btn = document.createElement("button");
    btn.className = "ettpd-tab-btn";
    if (icon) {
      setLocalizedButton(btn, label, icon);
    } else {
      bindText(btn, label);
    }
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
              const safeUsername = escapeHtml(username);
              return `
            <li class="ettpd-leaderboard-item">
              <div class="ettpd-leaderboard-rank">${i + 1}</div>
              <div class="ettpd-leaderboard-meta">
                <a class="ettpd-leaderboard-name" href="https://tiktok.com/@${safeUsername}" target="_blank" rel="noopener noreferrer">@${safeUsername}</a>
                <span class="ettpd-leaderboard-handle">tiktok.com/@${safeUsername}</span>
              </div>
              <div class="ettpd-leaderboard-count" title="${item.count.toLocaleString()}">
                ${formatCompactNumberWithTooltip(item.count)}
                <span class="ettpd-leaderboard-count-label" data-i18n="posts"></span>
              </div>
            </li>`;
            })
            .join("")
        : `<li class="ettpd-leaderboard-empty" data-i18n="noEntries"></li>`;

      return `
        <section class="ettpd-stats-card">
          <div class="ettpd-stats-card__header">
            <div class="ettpd-stats-card__title">${label}</div>
            <div class="ettpd-stats-card__total" title="${count.toLocaleString()}">
              <span class="ettpd-total-label" data-i18n="total"></span>
              <span class="ettpd-total-value">${formatCompactNumberWithTooltip(
                count,
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
      ? `<div class="ettpd-stats-banner" data-i18n="jokeSaved2"></div>`
      : "";

    replaceElementHtml(
      content,
      `
    <div class="ettpd-summary-line black-text">
      <span data-i18n="${tabKey}"></span>: <strong title="${totalCount.toLocaleString()}">${formatCompactNumberWithTooltip(
        totalCount,
      )}</strong> · ${tierLabel}
    </div>
    ${
      sameCount
        ? section(`${t("weekly")} · ${t("allTime")}`, weeklyList, weeklyCount) +
          funMessage
        : section(t("weekly"), weeklyList, weeklyCount) +
          section(t("allTime"), allTimeList, allTimeCount)
    }
    <p class="alert ettpd-disclaimer" data-i18n="statsLocal"></p>
  `,
    );
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

  const reviewTarget = getExtensionReviewTarget();
  const rateBtn = document.createElement("a");
  rateBtn.href = reviewTarget.url;
  rateBtn.target = "_blank";
  rateBtn.rel = "noopener noreferrer";
  rateBtn.className = "ettpd-modal-button";
  setLocalizedButton(rateBtn, "rate", "star");

  const coffeeBtn = document.createElement("button");
  coffeeBtn.type = "button";
  coffeeBtn.className = "ettpd-modal-button";
  coffeeBtn.textContent = "☕ Tip/Coffee Jar";
  coffeeBtn.onclick = () => showPayItForwardDialog({ dark: getResolvedThemeMode() === "dark" });

  const resetBtn = document.createElement("button");
  resetBtn.className = "ettpd-modal-button reset-leaderboard";
  bindText(resetBtn, "reset");
  resetBtn.addEventListener("click", () => {
    const confirmed = confirm(
      t("statsResetWarning"),
    );
    if (!confirmed) return;

    const doubleCheck = confirm(
      t("irreversible"),
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

    showToast(t("leaderboard"), t("statsReset"));
    document.getElementById(DOM_IDS.MODAL_CONTAINER)?.remove();
    displayFoundUrls({ forced: true });
  });

  actionBtnContainer.appendChild(resetBtn);
  actionBtnContainer.appendChild(rateBtn);
  actionBtnContainer.appendChild(coffeeBtn);

  contentWrapper.appendChild(tabNav);
  contentWrapper.appendChild(content);

  const unsubscribe = onLanguageChange(() => renderTab(tabButtons.find(button => button.classList.contains("active"))?.dataset.key || "downloads"));
  createModal({
    children: [contentWrapper, actionBtnContainer],
    onClose: unsubscribe,
  });
}

export function createModal({ children = [], onClose = null }) {
  const overlay = document.createElement("div");
  overlay.id = DOM_IDS.MODAL_CONTAINER;
  overlay.className = "ettpd-modal-overlay";
  overlay.classList.add(
    getResolvedThemeMode() === "dark"
      ? "ettpd-theme-dark"
      : "ettpd-theme-classic",
  );

  // === Container to hold both close btn and modal box ===
  const container = document.createElement("div");
  container.className = "ettpd-modal-box-container";

  // === Close Button ===
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.id = "ettpd-close";
  bindText(btn, "close", {}, "aria-label");
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
      modal.appendChild(createHtmlFragment(child));
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
  if (!shouldShowRateDonatePopup()) return false;
  const reviewStopCount = AppState.ui.reviewStopCount || 0;
  const reviewTarget = getExtensionReviewTarget();
  AppState.ui.isRatePopupOpen = true;
  hideDownloader();
  showCelebration("mindblown");
  setTimeout(() => {
    AppState.ui.isRatePopupOpen = false;
    if (reviewStopCount !== (AppState.ui.reviewStopCount || 0) || !shouldShowRateDonatePopup() || !claimAutomaticPopup()) return;
    AppState.ui.isRatePopupOpen = true;
    createModalMorpheus({
      message: `<div class="ettpd-morpheus-message">
  You've just seen how good this downloader is.<br>
  Now it's your turn to support the mission.<br><br>
  <strong>Take the red pill ☕ — fuel us.<br>
  Take the blue pill ⭐ — rate us.</strong>
</div>`,
      redPillClick: (e, overlay) => {
        AppState.rateDonate.lastShownAt = Date.now();
        localStorage.setItem(
          STORAGE_KEYS.RATE_DONATE_DATA,
          JSON.stringify(AppState.rateDonate),
        );
        overlay?.remove();
        AppState.ui.isRatePopupOpen = false;
        showPayItForwardDialog({ dark: getResolvedThemeMode() === "dark" });
      },
      bluePillClick: (e, overlay) => {
        console.log("✅ User took the blue pill — rated us.");
        window.open(reviewTarget.url, "_blank");
        AppState.rateDonate.lastShownAt = Date.now();
        AppState.rateDonate.lastRatedAt = Date.now();
        localStorage.setItem(
          STORAGE_KEYS.RATE_DONATE_DATA,
          JSON.stringify(AppState.rateDonate),
        );
        overlay?.remove();
        AppState.ui.isRatePopupOpen = false;
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
      JSON.stringify(AppState.rateDonate),
    );
  }, 3500);
  return true;
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
      : "ettpd-theme-classic",
  );

  const modal = document.createElement("div");
  modal.className = "ettpd-morpheus-modal";

  const btn = document.createElement("button");
  btn.textContent = "x";
  btn.className = "ettpd-close-morpheus";
  bindText(btn, "close", {}, "aria-label");
  btn.onclick = () => {
    overlay.remove();
    if (typeof onClose === "function") onClose();
  };

  // 📜 Message in the center
  const msg = document.createElement("div");
  msg.className = "ettpd-morpheus-message";
  if (message) {
    replaceElementHtml(msg, message);
  } else {
    msg.textContent =
      "You take the blue pill… You wake up in your bed and believe whatever you want to believe.";
  }

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
  const templates = getSavedTemplates();
  const presetTemplates = getPresetTemplates();

  const savedTemplateObj = AppState.downloadPreferences.fullPathTemplate || {};
  const savedFullTemplate = savedTemplateObj.template || "";
  const savedLabel = savedTemplateObj.label || "";

  const layout = document.createElement("div");
  layout.className = "layout";
  layout.classList.add("ettpd-template-modal");

  const templateHero = document.createElement("div");
  templateHero.className = "ettpd-template-hero";

  const templateTitle = document.createElement("div");
  templateTitle.className = "ettpd-template-title";
  bindText(templateTitle, "templateTitle");

  const templateHeroCopy = document.createElement("p");
  templateHeroCopy.className = "ettpd-template-hero-copy";
  bindText(templateHeroCopy, "templateIntro");

  templateHero.append(templateTitle, templateHeroCopy);

  const locationNote = document.createElement("div");
  locationNote.className = "ettpd-template-location";
  replaceElementHtml(
    locationNote,
    `
    <strong data-i18n="templateLocation"></strong>
    <span data-i18n="${AppState.downloadPreferences.showFolderPicker ? "templatePickerLocation" : "templateDefaultLocation"}"></span>
    <span data-i18n="templateSafePath"></span>
    <code>@.dernful → @_dernful</code>
    <code>Downloads/${escapeHtml(DOWNLOAD_FOLDER_DEFAULT)}/...</code>
  `,
  );

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
    "quality",
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
      label: "guide",
      body: `
        <p class="ettpd-template-subtitle" data-i18n="templateSyntax"></p>
        <code>{field} / {field|fallback} / {field:maxLen|fallback}</code>
        <details class="ettpd-template-accordion">
          <summary class="ettpd-template-summary" data-i18n="templateRules"></summary>
          <ul class="ettpd-template-list">
            <li><span data-i18n="templateExtensions"></span> <code>.jpeg / .mp4</code></li>
            <li><span data-i18n="templateNumbering"></span> <code>{sequenceNumber|required}</code></li>
            <li><span data-i18n="templateLength"></span> <code>{desc:40|no-desc} / {videoId:-4}</code></li>
            <li><span data-i18n="templateSafePath"></span> <code>.name → _name</code></li>
            <li><span data-i18n="templateContext"></span> <code>{ad}: ad / {mediaType}: image, video / {quality}: HD, SD / {tabName}: Videos, Reposts, Liked, Favorited</code></li>
          </ul>
        </details>
      `,
    },
    {
      key: "fields",
      label: "fields",
      body: `
        <p class="ettpd-template-subtitle" data-i18n="templateSyntax"></p>
        <p><strong data-i18n="fields"></strong></p>
        <code class="ettpd-template-code">${knownFields.join(", ")}</code>
        <div class="ettpd-template-grid">
          ${knownFields.map(field => `<div><strong>{${field}}</strong><span data-i18n="field_${field}"></span></div>`).join("")}
        </div>
      `,
    },
  ];

  const tabButtons = tabConfig.map((tab) => {
    const btn = document.createElement("button");
    btn.className = "ettpd-template-tab";
    btn.dataset.key = tab.key;
    bindText(btn, tab.label);
    btn.onclick = () => renderTab(tab.key);
    tabNav.appendChild(btn);
    return btn;
  });

  const renderTab = (key) => {
    tabButtons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.key === key),
    );
    const section = tabConfig.find((tab) => tab.key === key);
    replaceElementHtml(tabContent, section?.body || "");
    localizeMarkup(tabContent);
  };

  instructions.append(tabNav, tabContent);
  renderTab("guide");

  const pickerLabel = document.createElement("div");
  pickerLabel.className = "ettpd-template-section-label";
  bindText(pickerLabel, "templateChoose");

  const comboSelect = document.createElement("select");
  comboSelect.className = "ettpd-template-select";

  const appendTemplateOptions = (selectEl, activeLabel) => {
    selectEl.querySelectorAll("option").forEach((opt) => opt.remove());

    const placeholder = document.createElement("option");
    bindText(placeholder, "templateChoose");
    placeholder.value = "";
    selectEl.appendChild(placeholder);

    getSavedTemplates().forEach((template, index) => {
      const opt = document.createElement("option");
      opt.value = `user-${index}`;
      bindText(opt, template.label === activeLabel ? "templateActive" : "displayName", () => ({ name: templateDisplayName(template) }));
      if (template.label === activeLabel) opt.selected = true;
      selectEl.appendChild(opt);
    });

    if (presetTemplates.length) {
      const sep = document.createElement("option");
      bindText(sep, "presets");
      sep.disabled = true;
      selectEl.appendChild(sep);

      presetTemplates.forEach((template, index) => {
        const opt = document.createElement("option");
        opt.value = `preset-${index}`;
        bindText(opt, template.label === activeLabel ? "templateActive" : "displayName", () => ({ name: templateDisplayName(template) }));
        if (template.label === activeLabel) opt.selected = true;
        opt.title = template.example;
        selectEl.appendChild(opt);
      });
    }
  };

  appendTemplateOptions(comboSelect, savedLabel);

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.name = "label";
  bindText(labelInput, "templateLabel", {}, "placeholder");
  bindText(labelInput, "templateLabel", {}, "aria-label");
  labelInput.value = savedLabel;
  labelInput.className = "ettpd-modal-input";

  const inputPathTemplate = document.createElement("input");
  inputPathTemplate.type = "text";
  inputPathTemplate.name = "template";
  inputPathTemplate.placeholder =
    "@/@{authorUsername|:profile:}/{tabName}/{videoId}-{desc|no-desc}.mp4";
  inputPathTemplate.value = savedFullTemplate;
  inputPathTemplate.className = "ettpd-modal-input";

  const error = document.createElement("div");
  error.className = "ettpd-modal-error";

  const preview = document.createElement("div");
  preview.className = "ettpd-template-preview";

  const activeFullPathTemplate = document.createElement("div");
  activeFullPathTemplate.className = "ettpd-template-active";
  if (savedLabel && savedLabel === savedTemplateObj.label) {
    bindText(activeFullPathTemplate, "templateActive", () => ({ name: templateDisplayName(savedTemplateObj) }));
  }

  const presetExample = document.createElement("code");
  presetExample.className = "ettpd-template-example";

  const saveBtn = document.createElement("button");
  saveBtn.className = "ettpd-pref-btn";
  bindText(saveBtn, "saveApply");

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "ettpd-pref-btn danger";
  setLocalizedButton(deleteBtn, "templateDelete", "delete");
  deleteBtn.style = "margin-right:15px;";
  deleteBtn.disabled = !savedLabel;

  const validatePathTemplate = (tpl) => {
    const errs = [];
    if (tpl.startsWith("/") && !tpl.startsWith("@/@")) {
      errs.push(t("templateSafePath"));
    }
    if (/\.\.|^[a-zA-Z]:/.test(tpl)) {
      errs.push(t("templateSafePath"));
    }
    const tokenRe = /\{(\w+)(\|[^}]+)?\}/g;
    let match;
    while ((match = tokenRe.exec(tpl))) {
      if (!knownFields.includes(match[1])) {
        errs.push(t("templateUnknownField", { field: match[1] }));
      }
    }
    return errs;
  };

  function renderPreviewAndErrors() {
    const tpl = inputPathTemplate.value.trim();
    const errors = validatePathTemplate(tpl);

    if (!tpl) {
      error.textContent = "";
      bindText(preview, "templatePreviewEmpty");
      return;
    }

    if (errors.length) {
      error.textContent = "";
      const warningIcon = createIcon("warning", 16);
      warningIcon.style.marginRight = "4px";
      error.appendChild(warningIcon);
      error.appendChild(document.createTextNode(errors.join("; ")));
      clearText(preview);
      return;
    }

    error.textContent = "";

    const sample = {
      videoId: "7557564294825626893",
      authorId: "coolguy",
      authorUsername: "coolguy",
      authorNickname: "coolguy",
      desc: "My best post ever that should be trimmed",
      createTime: new Date(2020, 7, 23, 12, 1),
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
      quality: "HD",
    };

    const filename = getDownloadFilePath(sample, {
      imageIndex: 3,
      options: { template: tpl, tabName: sample.tabName, quality: sample.quality },
    });
    bindText(preview, "templatePreview", { path: filename });
  }

  comboSelect.onchange = () => {
    const value = comboSelect.value;
    if (!value) return;

    const [type, indexStr] = value.split("-");
    const index = Number.parseInt(indexStr, 10);

    let selected = null;
    if (type === "user") {
      selected = getSavedTemplates()[index];
      deleteBtn.disabled = false;
    } else {
      selected = getPresetTemplates()[index];
      deleteBtn.disabled = true;
    }

    if (!selected) {
      console.warn("Invalid template selection:", value);
      return;
    }

    inputPathTemplate.value = selected.template || selected.fullPathTemplate;
    labelInput.value = selected.label;
    bindText(activeFullPathTemplate, "templateSelected", () => ({ name: templateDisplayName(selected) }));
    presetExample.textContent = selected.example
      ? selected.example
      : "";

    renderPreviewAndErrors();
  };

  renderPreviewAndErrors();

  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "ettpd-reset-feedback";
  feedbackContainer.style.textAlign = "center";

  function showFeedback(text) {
    replaceElementHtml(feedbackContainer, '<span data-i18n="applying"></span>');
    layout.appendChild(feedbackContainer);
    return new Promise((resolve) => {
      setTimeout(() => {
        replaceElementHtml(
          feedbackContainer,
          `<span>${escapeHtml(text)}</span>`,
        );
        setTimeout(() => {
          feedbackContainer.remove();
          displayFoundUrls({ forced: true });
          resolve();
        }, 1500);
      }, 1500);
    });
  }

  saveBtn.onclick = async () => {
    renderPreviewAndErrors();
    if (error.textContent) {
      showToast(t("errorTitle"), t("fixErrors"));
      return;
    }
    if (!labelInput.value.trim()) {
      showToast(t("errorTitle"), t("nameRequired"));
      return;
    }

    const trimmedLabel = labelInput.value.trim();
    const recommendedTemplate = getRecommendedPresetTemplate();

    if (recommendedTemplate && trimmedLabel === recommendedTemplate.label) {
      showToast(
        t("templateLabel"),
        t("templateReserved"),
        8000,
      );
    }

    const newTemplate = {
      label: trimmedLabel,
      template: inputPathTemplate.value.trim(),
    };
    const updatedTemplates = getSavedTemplates().filter(
      (template) => template.label !== newTemplate.label,
    );
    updatedTemplates.push(newTemplate);

    AppState.downloadPreferences.fullPathTemplate = newTemplate;
    saveTemplates(updatedTemplates);
    saveSelectedTemplate();
    bindText(activeFullPathTemplate, "templateActive", () => ({ name: templateDisplayName(newTemplate) }));
    presetExample.textContent = "";
    deleteBtn.disabled = false;

    appendTemplateOptions(comboSelect, newTemplate.label);
    await showFeedback(t("templateSaved"));
  };

  deleteBtn.onclick = async () => {
    const value = comboSelect.value;
    if (!value) {
      showToast(t("errorTitle"), t("templateDeleteHint"));
      return;
    }
    const [type, indexStr] = value.split("-");
    const index = Number.parseInt(indexStr, 10);
    if (type !== "user") {
      showToast(t("errorTitle"), t("templateDeleteHint"));
      return;
    }

    const currentTemplates = getSavedTemplates();
    const removed = currentTemplates.splice(index, 1)[0];
    if (!removed) {
      showToast(t("errorTitle"), t("templateDeleteHint"));
      return;
    }

    saveTemplates(currentTemplates);
    labelInput.value = "";
    inputPathTemplate.value = "";
    clearText(activeFullPathTemplate);
    presetExample.textContent = "";
    comboSelect.value = "";
    deleteBtn.disabled = true;
    appendTemplateOptions(comboSelect, "");
    renderPreviewAndErrors();
    await showFeedback(t("templateDeleted", { name: removed.label }));
  };

  const inputsLabel = document.createElement("span");
  inputsLabel.className = "ettpd-template-section-label";
  bindText(inputsLabel, "templateEdit");

  inputPathTemplate.addEventListener("input", renderPreviewAndErrors);
  labelInput.addEventListener("input", () => (deleteBtn.disabled = false));

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

  layout.append(
    templateHero,
    locationNote,
    instructions,
    pickerLabel,
    comboSelect,
    presetExample,
    inputsLabel,
    labelInput,
    inputPathTemplate,
    error,
    preview,
    templateActionsContainer,
  );

  const unsubscribe = onLanguageChange(() => { if (layout.isConnected) renderPreviewAndErrors(); });
  createModal({ children: [layout], onClose: unsubscribe });
  localizeMarkup(locationNote);
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
  bindText(prefLabel, "options");

  // 🔄 Create button container
  const btnContainer = document.createElement("div");
  btnContainer.className = "ettpd-options-buttons";

  // 🔄 Reset Downloader button
  const resetBtn = document.createElement("button");
  resetBtn.className = "ettpd-pref-btn danger";
  setLocalizedButton(resetBtn, "reset", "refresh");
  resetBtn.onclick = async (e) => {
    e.stopPropagation();
    resetAppStateToDefaults();
    await showFeedback(t("settingsReset"));
    AppState.ui.isPreferenceBoxOpen = false;
    AppState.ui.isScrapperBoxOpen = false;
    const wrapper = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
    wrapper?._cleanupDraggable?.();
    wrapper?.remove();
    const showButton = document.getElementById(DOM_IDS.SHOW_DOWNLOADER);
    showButton?._cleanupDraggable?.();
    showButton?.remove();
    pollInitialData();
    displayFoundUrls({ forced: true });
  };

  // 🧹 Clear List button
  const clearListBtn = document.createElement("button");
  clearListBtn.className = "ettpd-pref-btn";
  setLocalizedButton(clearListBtn, "clearList", "delete");
  clearListBtn.onclick = (e) => {
    e.stopPropagation();
    if (
      AppState.downloading.isActive ||
      AppState.downloading.isDownloadingAll
    ) {
      showToast(
        t("busy"),
        t("busyMessage"),
      );
      return;
    }
    AppState.downloadedURLs = [];
    AppState.allDirectLinks = [];
    AppState.allItemsEverSeen = {};
    AppState.displayedState.itemsHash = "";
    AppState.displayedState.path = window.location.pathname;
    AppState.ui.isPreferenceBoxOpen = false;
    AppState.ui.isScrapperBoxOpen = false;
    showToast(
      t("clearList"),
      t("listCleared"),
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

  // Advanced checkboxes
  const advancedLabel = document.createElement("div");
  advancedLabel.className = "ettpd-pref-label";
  bindText(advancedLabel, "settings");

  const skipFailedCheckbox = createCheckbox(
    "skipFailed",
    "skipFailedDownloads",
    () => {
      AppState.downloadPreferences.skipFailedDownloads =
        !AppState.downloadPreferences.skipFailedDownloads;
    },
    AppState.downloadPreferences.skipFailedDownloads,
  );
  const skipAdsCheckbox = createCheckbox(
    "skipAds",
    "skipAds",
    () => {
      AppState.downloadPreferences.skipAds =
        !AppState.downloadPreferences.skipAds;
    },
    AppState.downloadPreferences.skipAds,
    "skipAdsHint",
  );
  const includeCSVFile = createCheckbox(
    "includeCsv",
    "includeCSV",
    () => {
      AppState.downloadPreferences.includeCSV =
        !AppState.downloadPreferences.includeCSV;
    },
    AppState.downloadPreferences.includeCSV,
  );

  const downloadMessagesCheckbox = createCheckbox(
    "funnyMessages",
    "showDownloadMessages",
    (event) => {
      AppState.downloadPreferences.showDownloadMessages = event.target.checked;
      localStorage.setItem(
        STORAGE_KEYS.SHOW_DOWNLOAD_MESSAGES,
        String(event.target.checked),
      );
    },
    AppState.downloadPreferences.showDownloadMessages,
    "funnyMessagesHint",
  );

  const disableConfetti = createCheckbox(
    "confetti",
    "disableConfetti",
    (event) => {
      AppState.downloadPreferences.disableConfetti = !event.target.checked;
      localStorage.setItem(
        STORAGE_KEYS.DISABLE_CELEBRATION_CONFETTI,
        AppState.downloadPreferences.disableConfetti,
      );
    },
    !AppState.downloadPreferences.disableConfetti,
  );

  const experimentalHdCheckbox = createCheckbox(
    "experimentalHd",
    "experimentalHd",
    (event) => {
      AppState.downloadPreferences.experimentalHd = event.target.checked;
      localStorage.setItem(
        STORAGE_KEYS.EXPERIMENTAL_HD,
        String(AppState.downloadPreferences.experimentalHd),
      );
      if (event.target.checked) {
        AppState.ui.hasDismissedExperimentalHdBanner = true;
        localStorage.setItem(
          STORAGE_KEYS.EXPERIMENTAL_HD_BANNER_DISMISSED,
          "true",
        );
        document.querySelector(".ettpd-experimental-hd-banner")?.remove();
      }
      displayFoundUrls({ forced: true });
    },
    AppState.downloadPreferences.experimentalHd,
    "experimentalHdHint",
  );
  experimentalHdCheckbox.dataset.setting = "experimental-hd";

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
    bindText(label, "theme");
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
      { value: "dark", label: "themeDark" },
      { value: "light", label: "themeLight" },
      { value: "system", label: "themeSystem" },
    ];

    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      bindText(opt, label);
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
      showFeedback(t("settingsSaved"));
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
    bindText(label, "extensionStatus");
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
          replaceElementHtml(
            message,
            '<p data-i18n="disableWarning"></p>',
          );

          const actionsContainer = document.createElement("div");
          actionsContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 20px;
            justify-content: center;
          `;

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "ettpd-modal-button secondary";
          bindText(cancelBtn, "cancel");
          cancelBtn.onclick = () => {
            const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
            if (overlay) overlay.remove();
            resolve(false);
          };

          const disableBtn = document.createElement("button");
          disableBtn.className = "ettpd-modal-button danger";
          bindText(disableBtn, "disable");
          disableBtn.onclick = async () => {
            console.log("[EXT_POWER] disabling via modal");
            await setExtensionEnabled(false);
            toggle.classList.remove("ettpd-power-toggle-on");
            toggle.classList.add("ettpd-power-toggle-off");
            toggleIcon.textContent = "🔌";

            showFeedback(
              t("disabling"),
            );

            const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
            if (overlay) overlay.remove();
            setTimeout(() => {
              try {
                window.location.reload();
              } catch {}
            }, 300);
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
          t("refreshHint"),
        );
      }
    };

    container.appendChild(label);
    container.appendChild(toggleContainer);

    return container;
  }

  const autoScrollSettingUI = createScrollModeSelector();

  // Feedback container
  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "ettpd-reset-feedback";
  // Utility function to show feedback
  function showFeedback(text) {
    replaceElementHtml(feedbackContainer, '<span data-i18n="applying"></span>');
    preferencesBox.appendChild(feedbackContainer);
    // Then show the actual message after displayFoundUrls finishes
    return new Promise((resolve) => {
      setTimeout(() => {
        replaceElementHtml(
          feedbackContainer,
          `<span>${escapeHtml(text)}</span>`,
        );
        // Then remove the message after a short delay
        setTimeout(() => {
          feedbackContainer.remove();
          displayFoundUrls({ forced: true });
          resolve();
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
    title = "",
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
      showFeedback(t("settingsSaved"));
    };

    const span = document.createElement("span");
    bindText(span, label);
    if (title) bindText(span, title, {}, "title");
    container.appendChild(checkbox);
    container.appendChild(span);
    return container;
  }

  function createScrollModeSelector() {
    const label = document.createElement("label");
    label.className = "ettpd-label";

    // Self-updating label that polls state every 2 seconds
    let intervalId = null;
    const updateLabel = () => {
      const isAvailable = !listScrollingCompleted() || canClickNextButton();
      label.textContent = `${t("autoScroll")} (${t(isAvailable ? "available" : "notAvailable")})`;
    };
    updateLabel();

    // Start polling when element is in DOM, stop when removed
    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(updateLabel, 2000);
      }
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Use MutationObserver to detect when element is added/removed from DOM
    const observer = new MutationObserver(() => {
      if (document.contains(label)) {
        startPolling();
      } else {
        stopPolling();
        observer.disconnect();
      }
    });

    // Start observing once label is added to DOM
    requestAnimationFrame(() => {
      if (document.contains(label)) {
        startPolling();
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });

    const select = document.createElement("select");
    select.name = "scrollMode";
    select.className = "ettpd-select";
    const options = [
      { value: "onVideoEnd", label: "onVideoEnd", icon: "repost" },
      { value: "always", label: "loadMore", icon: "refresh" },
      { value: "off", label: "off", icon: "stop" },
    ];

    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      bindText(opt, label);
      select.appendChild(opt);
    });

    select.value = AppState.downloadPreferences.autoScrollMode;
    select.onchange = (e) => {
      AppState.downloadPreferences.autoScrollMode = e.target.value;
      showFeedback(
        t("settingsSaved"),
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
  setLocalizedButton(templateEditorBtn, "templateTitle", "settings");
  templateEditorBtn.onclick = (e) => {
    e.stopPropagation();
    createFilenameTemplateModal();
  };

  preferencesBox.append(
    advancedLabel,
    skipFailedCheckbox,
    skipAdsCheckbox,
    includeCSVFile,
    downloadMessagesCheckbox,
    disableConfetti,
    experimentalHdCheckbox,
    themeToggle,
    autoScrollSettingUI,
    prefLabel,
    templateEditorBtn,
    btnContainer,
  );

  return preferencesBox;
}

export function createSettingsToggle(preferencesBox) {
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "ettpd-settings-toggle";
  setLocalizedButton(settingsBtn, "settings", "settings");
  bindText(settingsBtn, "settings", {}, "title");
  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    // Close Scrapper if open
    AppState.ui.isScrapperBoxOpen = false;
    if (document.getElementById(DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER)) {
      document.getElementById(
        DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER,
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
          DOM_IDS.DOWNLOADER_SCRAPPER_CONTAINER,
        ).style.display = AppState.ui.isScrapperBoxOpen ? "flex" : "none";

      settingsBtn.classList.add("ettpd-settings-open");

      // Update Scrapper button state
      const allButtons = document.querySelectorAll(".ettpd-settings-toggle");
      allButtons.forEach((btn) => {
        if (btn !== settingsBtn && btn.textContent.includes("Scrapper")) {
          btn.classList.remove("ettpd-settings-open");
        }
      });
    } else {
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
    /^\/@[^/]+\/(photo|video)\/([A-Za-z0-9]+)$/,
  );
  const activeId = match?.[2];

  document.querySelectorAll(".download-btn-container, .photo-download-btn-container").forEach((el) => {
    const hasActiveButton = activeId
      ? el.querySelector(`button.download-btn.${CSS.escape(activeId)}`)
      : null;

    const isInsideActiveHoverSelection = isInsideActiveHoverSelectionRoot(el);

    const isFeedControl = !!el.closest('section[data-e2e="feed-video"]');
    if (hasActiveButton || isInsideActiveHoverSelection || isFeedControl) {
      return;
    }

    removeIdleDownloadControl(el);
  });
}

function removeIdleDownloadControl(container) {
  if (container.querySelector('[data-download-active="true"]')) return;
  container.remove();
}

function isInsideActiveHoverSelectionRoot(container) {
  const exploreItem = container.closest('[data-e2e="explore-item"]');
  if (exploreItem?.matches(":hover")) return true;
  const activeRoots = [
    activeProfileGridItem,
    activeSideGridItem,
    activeCreatorVideosSidebarCard,
    activeYouMayLikeGridCard,
    activeMainVideoSideGridCard,
  ];

  return activeRoots.some(
    (root) =>
      root instanceof Element &&
      root.isConnected &&
      root.matches(":hover") &&
      root.contains(container),
  );
}

export function getReadyVideoDownloadMedia(videoId, candidates = []) {
  for (const media of candidates) {
    if (!media || media.isImage || String(media.videoId || media.id) !== String(videoId)) continue;
    const sources = (media.videoSources || []).filter(source =>
      !source.experimentalOnly && source.audioStatus === "muxed" &&
      /^https?:\/\//i.test(source.url || ""),
    );
    if (sources.length) return { ...media, url: sources[0].url, videoSources: sources };
  }
  return null;
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
  getPhotoIndex,
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
  const getOverlayMedia = () =>
    AppState.allDirectLinks?.find(
      (media) => String(media?.videoId) === String(videoId),
    ) || { isImage, qualityLabel: "?", qualityTier: "unknown" };
  const getReadyMedia = () => getReadyVideoDownloadMedia(videoId, [
    getOverlayMedia(),
    buildVideoLinkMeta(AppState.allItemsEverSeen[videoId]),
    buildVideoLinkMeta(findFiberItemById(parentEl, videoId, 40)?.item),
  ]);
  const buildDefaultMarkup = () => {
    const media = (!isImage && getReadyMedia()) || getOverlayMedia();
    return `<span class="download-btn-icon" aria-hidden="true"></span><span class="download-btn-label">${getDownloadActionLabel(media)}</span>`;
  };

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
  btn.title = getStandardDownloadTitle(getOverlayMedia());
  bindText(btn, isImage ? "downloadImages" : "download", {}, "aria-label");
  const preparationWindowMs = 20000;
  let preparing = false;
  let preparationAttempts = 0;
  let windowAttempts = 0;
  let retryAfter = 0;
  let preparationDeadline = null;
  let preparationTimer = null;
  const refreshReadiness = () => {
    if (btn.dataset.downloadActive === "true") return true;
    if (isImage) return true;
    const ready = getReadyMedia();
    const unavailable = preparationDeadline !== null && Date.now() >= preparationDeadline && !preparing;
    if (ready && preparationTimer !== null) {
      clearTimeout(preparationTimer);
      preparationTimer = null;
    }
    btn.dataset.sourceState = ready ? "ready" : unavailable ? "unavailable" : "loading";
    btn.disabled = !ready && !unavailable;
    btn.classList.toggle("is-source-loading", !ready && !unavailable);
    btn.setAttribute("aria-busy", String(!ready && !unavailable));
    clearText(btn);
    bindText(btn, "displayName", () => ({ name: ready ? getStandardDownloadTitle(ready) : t(unavailable ? "retry" : "sourcePreparing") }), "title");
    if (ready) replaceElementHtml(btn, buildDefaultMarkup());
    else {
      const label = document.createElement("span");
      label.className = "download-btn-label";
      bindText(label, unavailable ? "notAvailable" : "prepare");
      btn.replaceChildren(label);
    }
    return !!ready;
  };
  const prepareSource = async ({ restart = false } = {}) => {
    if (isImage || preparing || refreshReadiness()) return;
    const expired = preparationDeadline !== null && Date.now() >= preparationDeadline;
    if (expired && !restart || !expired && Date.now() < retryAfter) return;
    if (preparationDeadline === null || expired) {
      preparationDeadline = Date.now() + preparationWindowMs;
      windowAttempts = 0;
      if (preparationTimer !== null) clearTimeout(preparationTimer);
      preparationTimer = setTimeout(() => {
        preparationTimer = null;
        if (btn.isConnected) refreshReadiness();
      }, preparationWindowMs);
    }
    preparing = true;
    preparationAttempts += 1;
    windowAttempts += 1;
    refreshReadiness();
    try {
      const localItem = findFiberItemById(parentEl, videoId, 40)?.item;
      if (getReadyVideoDownloadMedia(videoId, [buildVideoLinkMeta(localItem)])) {
        handleFoundItems([localItem]);
        return;
      }
      const username = /^[\w.]+$/.test(author || "") ? author : "";
      const item = await hydrateTikTokVideoDetail(videoId, username, { signal: AbortSignal.timeout(Math.max(1, Math.min(12000, preparationDeadline - Date.now()))), refresh: preparationAttempts > 1 });
      if (item && String(item.id) === String(videoId)) handleFoundItems([item]);
    } finally {
      preparing = false;
      retryAfter = Date.now() + 3000;
      if (btn.isConnected) refreshReadiness();
    }
  };
  btn._refreshSourceReadiness = () => {
    const ready = refreshReadiness();
    if (!ready && !preparing && windowAttempts < 3 && Date.now() >= retryAfter && (preparationDeadline === null || Date.now() < preparationDeadline)) {
      const rect = parentEl.getBoundingClientRect();
      const player = parentEl.querySelector("video");
      if (player && !player.paused && rect.bottom > 0 && rect.top < window.innerHeight) {
        void prepareSource().catch(error => console.warn("[Download] source-readiness-failed", { videoId, error: error.message }));
      }
    }
    return ready;
  };
  container.addEventListener("pointerenter", () => { void prepareSource({ restart: true }).catch(error => console.warn("[Download] source-readiness-failed", { videoId, error: error.message })); });
  const resetButtonToDefault = () => {
    btn.disabled = false;
    replaceElementHtml(btn, buildDefaultMarkup());
    btn.title = getStandardDownloadTitle(getOverlayMedia());
    refreshReadiness();
  };
  resetButtonToDefault();

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isImage) {
      const ready = getReadyMedia();
      if (!ready) {
        refreshReadiness();
        void prepareSource({ restart: true }).catch(error => console.warn("[Download] source-readiness-failed", { videoId, error: error.message }));
        return;
      }
      btn.dataset.sourceState = "downloading";
      btn.classList.remove("is-source-loading");
      void runStandardDownload(btn, ready, { reset: resetButtonToDefault });
      return;
    }

    const toMatchingMedia = (candidate) => {
      const media = buildVideoLinkMeta(candidate);
      if (!media?.videoId) return null;
      return String(media.videoId) === String(videoId) ? media : null;
    };

    const resolveDownloadTarget = () => {
      const fiberItem = findFiberItemById(parentEl, videoId, 40)?.item;
      const fiberMedia = toMatchingMedia(fiberItem);
      const cachedMedia = toMatchingMedia(AppState.allItemsEverSeen[videoId]);
      const media = fiberMedia ||
        cachedMedia || {
          videoId,
          authorId: author,
        };

      const liveSource = getVideoSrc();
      const directSrcCandidates = [
        liveSource,
        fiberMedia?.url,
        cachedMedia?.url,
        getSrcById(videoId),
      ];

      const src =
        directSrcCandidates.find(
          (candidate) =>
            typeof candidate === "string" && /^https?:/i.test(candidate),
        ) ||
        directSrcCandidates.find(
          (candidate) =>
            typeof candidate === "string" && /^blob:/i.test(candidate),
        ) ||
        null;

      return {
        src,
        media,
        liveSource,
      };
    };

    let resolvedTarget = resolveDownloadTarget();
    const src = resolvedTarget.src;
    const media = resolvedTarget.media;

    console.log("IMAGES_DL ⏬ Clicked, source:", src);
    const isDownloadableSrc =
      typeof src === "string" && /^(https?:|blob:)/.test(src);
    if (!isDownloadableSrc) {
      if (AppState.debug.active) {
        console.warn("IMAGES_DL ❌ Invalid source", { src, videoId, from });
      }
      showToast(
        t("errorTitle"),
        t("unavailable"),
      );
      return;
    }

    const activePhotoIndex = getPhotoIndex?.() ?? photoIndex ?? 0;
    if (isImage) {
      media.isImage = true;
      media.imagePostImages = Array.isArray(media.imagePostImages)
        ? media.imagePostImages
        : [];
      media.imagePostImages[activePhotoIndex] = src;
    } else {
      const videoSources = Array.isArray(media.videoSources)
        ? media.videoSources
        : [];
      if (!videoSources.some((source) => source?.url === src)) {
        videoSources.push({
          url: src,
          qualityLabel: "?",
          qualityTier: "unknown",
          resolutionLabel: null,
          sourcePriority: -1,
        });
      }
      media.videoSources = videoSources;
      media.url = videoSources[0]?.url || src;
      media.qualityLabel = videoSources[0]?.qualityLabel || "?";
      media.qualityTier = videoSources[0]?.qualityTier || "unknown";
      media.resolutionLabel = videoSources[0]?.resolutionLabel || null;
    }

    void runStandardDownload(btn, media, {
      imageIndex: activePhotoIndex,
      reset: resetButtonToDefault,
    });
  });

  // Style the container

  container.appendChild(btn);
  syncOverlayExperimentalHdButton(container, videoId);

  parentEl.appendChild(container);
  if (!isImage) btn._refreshSourceReadiness();

  console.log("IMAGES_DL ✅ Button injected", {
    injectedInto: parentEl,
    container,
    from,
  });
}

function syncOverlayExperimentalHdButton(container, videoId) {
  const media = AppState.allDirectLinks?.find(
    (candidate) => String(candidate?.videoId) === String(videoId),
  );
  const source = getExperimentalHdSource(media);
  let button = container.querySelector(".ettpd-experimental-hd-overlay-btn");

  if (!source) {
    if (button?.dataset.downloadActive !== "true") button?.remove();
    if (
      AppState.downloadPreferences.experimentalHd &&
      media &&
      !experimentalHdHydrationState.has(String(videoId))
    ) {
      experimentalHdHydrationState.set(String(videoId), "loading");
      void hydrateTikTokVideoDetail(videoId, media.authorId).then((item) => {
        experimentalHdHydrationState.set(
          String(videoId),
          item ? "loaded" : "unavailable",
        );
        if (item) handleFoundItems([item]);
        displayFoundUrls({ forced: true });
      });
    }
    return;
  }
  if (button) return;

  button = createExperimentalHdButton(
    "download-btn ettpd-experimental-hd-overlay-btn",
    "HD",
  );
  button.dataset.overlayCompact = "true";
  setExperimentalHdIdleContent(button);
  button.style.display = "inline-flex";
  button.title = getExperimentalHdTitle(source);
  button.dataset.defaultTitle = button.title;
  bindText(button, "experimentalHdHint", {}, "aria-label");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const latestMedia = AppState.allDirectLinks?.find(
      (candidate) => String(candidate?.videoId) === String(videoId),
    );
    if (getExperimentalHdSource(latestMedia)) {
      void runExperimentalHdDownload(button, latestMedia);
    }
  });
  container.appendChild(button);
}

function syncShortDramaDownloadButton() {
  const seriesId = getShortDramaId();
  const existing = document.getElementById("ettpd-episode-download");
  if (!seriesId) { existing?.remove(); return; }
  const heading = [...document.querySelectorAll("h3")].find(element => element.textContent.trim() === "Episodes") ||
    document.querySelector('h3[class*="HSectionTitle"]');
  if (!heading) return;
  if (existing?.dataset.seriesId === seriesId && heading.contains(existing)) {
    existing.disabled = existing.dataset.loading === "true";
    return;
  }
  existing?.remove();
  const button = document.createElement("button");
  button.id = "ettpd-episode-download";
  button.className = "ettpd-episode-download";
  button.type = "button";
  button.dataset.seriesId = seriesId;
  bindText(button, "episodesTitle", {}, "title");
  bindText(button, "episodesTitle", {}, "aria-label");
  button.appendChild(createIcon("download", 18));
  button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    if (!notifyDownloadBusy()) void showShortDramaBatchDialog(seriesId, button);
  };
  heading.appendChild(button);
}

async function showShortDramaBatchDialog(seriesId, trigger) {
  if (trigger.dataset.loading === "true" || document.getElementById(DOM_IDS.MODAL_CONTAINER)) return;
  trigger.dataset.loading = "true";
  trigger.disabled = true;
  const controller = new AbortController();
  const content = document.createElement("div");
  content.className = "ettpd-episode-dialog";
  const title = document.createElement("h3");
  bindText(title, "episodesTitle");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  bindText(status, "episodesLoading");
  const form = document.createElement("form");
  form.hidden = true;
  const range = document.createElement("div");
  range.className = "ettpd-episode-range";
  const createNumber = text => {
    const label = document.createElement("label");
    const caption = document.createElement("span");
    bindText(caption, text);
    label.appendChild(caption);
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.required = true;
    label.appendChild(input);
    range.appendChild(label);
    return input;
  };
  const first = createNumber("episodeFirst");
  const last = createNumber("episodeLast");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "ettpd-action-btn";
  setLocalizedButton(submit, "episodesTitle", "download");
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ettpd-action-btn secondary";
  bindText(cancel, "cancel");
  form.append(range, submit);
  content.append(title, status, form, cancel);
  const close = () => {
    controller.abort();
    trigger.dataset.loading = "false";
    trigger.disabled = AppState.downloading.isDownloadingAll;
  };
  const modal = createModal({ children: [content], onClose: close });
  modal.style.boxSizing = "border-box";
  const box = modal.querySelector(".ettpd-modal-box");
  box.style.boxSizing = "border-box";
  box.style.maxWidth = "calc(100vw - 48px)";
  cancel.onclick = () => { close(); modal.remove(); };
  try {
    const requestUrl = resolveShortDramaRequest(seriesId);
    const discovered = await collectShortDramaEpisodes({
      seriesId, requestUrl, signal: controller.signal,
      onProgress: ({ loaded, total }) => {
        if (getShortDramaId() !== seriesId || !modal.isConnected) { close(); modal.remove(); return; }
        bindText(status, "episodesLoaded", { count: loaded });
      },
    });
    if (controller.signal.aborted || getShortDramaId() !== seriesId) return;
    const available = discovered.episodes.map(item => {
      const number = getEpisodeNumber(item);
      const media = buildVideoLinkMeta(item, number - 1);
      const ready = getReadyVideoDownloadMedia(item.id, [media]);
      return ready ? { item, number, media: { ...media, episodeNumber: number } } : null;
    }).filter(Boolean);
    if (discovered.title) bindText(title, "title", { list: discovered.title });
    if (!available.length) throw Object.assign(new Error("No available episodes"), { code: "EPISODES_EMPTY" });
    const highest = Math.max(discovered.total, ...available.map(entry => entry.number));
    first.value = "1";
    last.value = String(highest);
    first.max = last.max = String(highest);
    const updateSelection = () => {
      const start = Number(first.value);
      const end = Number(last.value);
      const valid = Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= highest;
      const selected = valid ? available.filter(entry => entry.number >= start && entry.number <= end) : [];
      submit.disabled = !valid || !selected.length;
      const omitted = valid ? end - start + 1 - selected.length : 0;
      bindText(status, valid ? "episodeSelection" : "episodeRange", valid ? { count: selected.length, skipped: omitted } : {});
      return selected;
    };
    first.oninput = last.oninput = updateSelection;
    form.hidden = false;
    updateSelection();
    form.onsubmit = event => {
      event.preventDefault();
      const selected = updateSelection();
      if (submit.disabled || getShortDramaId() !== seriesId || AppState.downloading.isDownloadingAll) return;
      for (const entry of selected) AppState.allItemsEverSeen[entry.item.id] = entry.item;
      AppState.ui.isDownloaderClosed = false;
      displayFoundUrls({ forced: true });
      close();
      modal.remove();
      void downloadAllLinks(document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON), {
        links: selected.map(entry => entry.media), batchType: "episodes",
      });
    };
  } catch (error) {
    if (!controller.signal.aborted) {
      bindText(status, error.code === "EPISODES_EMPTY" ? "episodesEmpty" : "unavailable");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "ettpd-action-btn";
      setLocalizedButton(retry, "episodesRetry", "refresh");
      retry.onclick = () => {
        close();
        modal.remove();
        if (getShortDramaId() === seriesId) void showShortDramaBatchDialog(seriesId, trigger);
      };
      content.appendChild(retry);
    }
  }
}

let accountControlsSyncing = false;

function findAccountTab(kind, tabs) {
  const known = tabs[kind]?.closest('[role="tab"]');
  if (known) return known;
  const videos = tabs.videos?.closest('[role="tab"]') || document.querySelector('[data-e2e="videos-tab"]');
  const root = videos?.closest('[role="tablist"]') || videos?.parentElement;
  const aliases = { videos: ["Videos"], reposts: ["Reposts"], liked: ["Liked", "Likes"], favorites: ["Favorites"] };
  return [...(root?.querySelectorAll('[role="tab"]') || [])].find(tab => aliases[kind]?.includes(tab.textContent.trim()));
}

function getAccountListNotice(tab) {
  if (tab?.getAttribute("aria-selected") !== "true") return null;
  for (const element of document.querySelectorAll('[class*="DivErrorContainer"], [class*="DivEmptyContainer"]')) {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const text = element.textContent?.trim() || "";
    if (/private|currently hidden/i.test(text)) return { code: "LIST_PRIVATE", message: "This list is private. There are no accessible posts to download." };
    if (/no (?:liked |reposted |saved )?(?:videos|posts)|hasn.t posted|haven.t posted|nothing here|no content|upload your first/i.test(text)) {
      return { code: "LIST_EMPTY", message: "This list has no posts to download." };
    }
  }
  return null;
}

function waitForAccountListChange(condition, signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve(false);
    if (condition()) return resolve(true);
    const finish = result => { observer.disconnect(); clearTimeout(timer); signal.removeEventListener("abort", aborted); resolve(result); };
    const observer = new MutationObserver(() => { if (condition()) finish(true); });
    const aborted = () => finish(false);
    const timer = setTimeout(() => finish(false), 12000);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected", "class"] });
    signal.addEventListener("abort", aborted, { once: true });
  });
}

async function inspectAccountList(kind, signal) {
  const tab = findAccountTab(kind, await getTabSpans(0));
  if (!tab || tab.getAttribute("aria-disabled") === "true") return { code: "LIST_UNAVAILABLE", message: "This list is not available in TikTok." };
  const cardType = { liked: "user-liked-item", favorites: "favorites-item", reposts: "user-repost-item" }[kind] || "user-post-item";
  const signature = () => [...document.querySelectorAll(`div[data-e2e="${cardType}"]`)]
    .filter(card => { const box = card.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
    .map(card => card.querySelector('a[href*="/video/"],a[href*="/photo/"]')?.getAttribute("href") || "").filter(Boolean).join(",");
  const alreadySelected = tab.getAttribute("aria-selected") === "true";
  const before = signature();
  if (!alreadySelected) tab.click();
  const ready = await waitForAccountListChange(() => tab.getAttribute("aria-selected") === "true" &&
    (getAccountListNotice(tab) || signature() && (alreadySelected || signature() !== before)), signal);
  if (!ready) return { code: "LIST_UNAVAILABLE", message: "TikTok has not made this list available. Open its tab and complete any sign-in or verification, then try again." };
  return getAccountListNotice(tab);
}

function createNativeAccountPageLoader(source) {
  let selected = false;
  const cardType = { liked: "user-liked-item", favorites: "favorites-item", reposts: "user-repost-item" }[source.kind] || "user-post-item";
  const cardSelector = `div[data-e2e="${cardType}"]`;
  const cards = () => [...document.querySelectorAll(cardSelector)].filter(card => {
    const box = card.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  const idOf = card => card.querySelector('a[href*="/video/"],a[href*="/photo/"]')?.getAttribute("href")?.match(/\/(?:video|photo)\/(\d+)/)?.[1];
  const signature = () => cards().map(idOf).filter(Boolean).join(",");
  return async (cursor, count, signal) => {
    signal.throwIfAborted();
    if (getAccountUsername() !== source.username) throw new Error("The account page changed. Saved batches are retained.");
    const tab = findAccountTab(source.kind, await getTabSpans(0));
    if (!tab || tab.getAttribute("aria-disabled") === "true") throw new Error("This account list is not available in TikTok.");
    if (!selected) {
      const alreadySelected = tab.getAttribute("aria-selected") === "true";
      const before = signature();
      if (!alreadySelected) tab.click();
      const ready = alreadySelected || await waitForAccountListChange(() => tab.getAttribute("aria-selected") === "true" && (signature() !== before || getAccountListNotice(tab)), signal);
      if (!ready) throw new Error("TikTok has not opened that list. Check its access or verification, then resume.");
      selected = true;
    }
    if (tab.getAttribute("aria-selected") !== "true") throw new Error("The selected account tab changed. Saved batches are retained.");
    const notice = getAccountListNotice(tab);
    if (notice?.code === "LIST_PRIVATE") throw Object.assign(new Error(notice.message), { code: notice.code });
    if (notice?.code === "LIST_EMPTY") return { items: [], cursor, hasMore: false };
    const checkpoint = getProgressiveListCheckpoint(source.scope);
    const done = new Set([...(checkpoint?.completed || []), ...(checkpoint?.skipped || [])]);
    const read = () => {
      const result = [];
      const seen = new Set();
      for (const card of cards()) {
        const id = idOf(card);
        if (!id || done.has(id) || seen.has(id)) continue;
        seen.add(id);
        const item = AppState.allItemsEverSeen[id] || findFiberItemById(card, id, 40)?.item;
        if (item && String(item.id) === id) result.push(item);
        if (result.length >= Math.min(30, count)) break;
      }
      return result;
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      signal.throwIfAborted();
      const items = read();
      if (items.length) return { items, cursor: `native:${items.at(-1).id}`, hasMore: true };
      const before = signature();
      cards().at(-1)?.scrollIntoView({ block: "end" });
      if (!await waitForAccountListChange(() => signature() !== before || getAccountListNotice(tab), signal)) break;
      const nextNotice = getAccountListNotice(tab);
      if (nextNotice?.code === "LIST_PRIVATE") throw Object.assign(new Error(nextNotice.message), { code: nextNotice.code });
      if (nextNotice?.code === "LIST_EMPTY") return { items: [], cursor, hasMore: false };
    }
    throw new Error("TikTok did not load more posts. Your saved batches are retained; resume later or check whether the list has ended.");
  };
}

function notifyDownloadBusy() {
  if (!AppState.downloading.isActive && !AppState.downloading.isDownloadingAll && !AppState.downloading.accountBatch) return false;
  showToast(t("busy"), t("busyMessage"));
  return true;
}

function getCurrentProfileIdentity(username) {
  const title = document.querySelector?.('[data-e2e="user-title"]');
  if (!title) return null;
  let fiber = getReactFiberNode(title);
  for (let depth = 0; fiber && depth < 24; depth += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps || fiber.pendingProps;
    const profile = props?.detailInfo?.user;
    if (profile?.secUid && profile.uniqueId?.toLowerCase() === username.toLowerCase()) return profile;
  }
  return null;
}

async function showAccountBatchDialog(descriptor) {
  if (notifyDownloadBusy() || document.getElementById(DOM_IDS.MODAL_CONTAINER)) return;
  const originUrl = window.location.href;
  const content = document.createElement("div");
  content.className = "ettpd-episode-dialog ettpd-account-download-dialog";
  const title = document.createElement("h3");
  bindText(title, "title", () => ({ list: ["videos", "liked", "reposts", "favorites"].includes(descriptor.kind) ? t(descriptor.kind) : descriptor.title }));
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  bindText(status, "preparing");
  const form = document.createElement("form");
  form.className = "ettpd-account-download-form";
  form.hidden = true;
  const limitLabel = document.createElement("label");
  limitLabel.className = "ettpd-account-batch-size";
  const limitTitle = document.createElement("span"); bindText(limitTitle, "maxPosts"); limitLabel.append(limitTitle);
  const limit = document.createElement("input");
  limit.type = "number"; limit.name = "maxPosts"; limit.min = "1"; limit.step = "1";
  bindText(limit, "all", {}, "placeholder");
  limitLabel.appendChild(limit);
  const label = document.createElement("label");
  const batchTitle = document.createElement("span"); bindText(batchTitle, "batchSize"); label.append(batchTitle);
  const size = document.createElement("input");
  size.type = "number"; size.min = "1"; size.max = "100"; size.step = "1"; size.value = String(DEFAULT_BATCH_SIZE); size.required = true;
  label.className = "ettpd-account-batch-size";
  label.appendChild(size);
  const advanced = document.createElement("details");
  const advancedTitle = document.createElement("summary");
  bindText(advancedTitle, "advanced");
  advanced.append(advancedTitle, label);
  const resumeLabel = document.createElement("label");
  resumeLabel.className = "ettpd-checkbox-container";
  const resume = document.createElement("input");
  resume.type = "checkbox";
  const resumeText = document.createElement("span");
  bindText(resumeText, "resumeSaved");
  resumeLabel.append(resume, resumeText);
  const submit = document.createElement("button");
  submit.type = "submit"; submit.className = "ettpd-action-btn";
  const updateSubmitLabel = () => setLocalizedButton(submit,
    resume.checked ? "resume" : limit.value.trim() ? "download" : "downloadAll", "download");
  limit.value = "";
  updateSubmitLabel();
  form.append(limitLabel, advanced, resumeLabel, submit);
  const cancel = document.createElement("button");
  cancel.type = "button"; cancel.className = "ettpd-action-btn secondary"; bindText(cancel, "cancel");
  content.append(title, status, form, cancel);
  const controller = new AbortController();
  const modal = createModal({ children: [content], onClose: () => controller.abort() });
  modal.style.boxSizing = "border-box";
  const box = modal.querySelector(".ettpd-modal-box");
  box.style.boxSizing = "border-box"; box.style.maxWidth = "calc(100vw - 48px)";
  cancel.onclick = () => { controller.abort(); modal.remove(); };
  try {
    if (["videos", "liked", "reposts", "favorites"].includes(descriptor.kind)) {
      const notice = await inspectAccountList(descriptor.kind, controller.signal);
      if (controller.signal.aborted) return;
      if (notice) {
        bindText(status, notice.code === "LIST_PRIVATE" ? "private" : notice.code === "LIST_EMPTY" ? "empty" : "unavailable");
        bindText(cancel, "close");
        return;
      }
    }
    if (descriptor.username) {
      const username = descriptor.username.toLowerCase();
      const cachedPost = Object.values(AppState.allItemsEverSeen || {}).find(item =>
        item?.author?.secUid && item.author.uniqueId?.toLowerCase() === username);
      if (cachedPost) rememberAccountIdentity(cachedPost.author);
      try {
        const scope = JSON.parse(document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__")?.textContent || "{}").__DEFAULT_SCOPE__;
        const runtimeScope = window.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
        const profiles = [scope?.["webapp.user-detail"]?.userInfo?.user, scope?.["webapp.app-context"]?.user, runtimeScope?.["webapp.user-detail"]?.userInfo?.user, getCurrentProfileIdentity(username)];
        for (const profile of profiles) {
          if (profile?.uniqueId?.toLowerCase() === username) rememberAccountIdentity(profile);
        }
      } catch {}
    }
    let source;
    try { source = resolveAccountList(descriptor); }
    catch (error) {
      if (!descriptor.username) throw error;
      const url = new URL("/api/user/detail/", location.origin);
      url.search = new URLSearchParams({ aid: "1988", app_name: "tiktok_web", uniqueId: descriptor.username }).toString();
      const response = await fetch(url, { credentials: "include", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
      if (!response.ok) throw new Error(`TikTok could not load this account's details (HTTP ${response.status}). Refresh the profile and try again.`);
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error("TikTok returned no usable account details. Refresh this profile and complete any sign-in or verification, then try again."); }
      const profile = payload?.userInfo?.user;
      if (profile?.uniqueId?.toLowerCase() !== descriptor.username.toLowerCase()) throw error;
      source = resolveAccountList({ ...descriptor, profile });
    }
    if (controller.signal.aborted) return;
    if (window.location.href !== originUrl) { bindText(status, "pageChanged"); return; }
    source.title = descriptor.title;
    const saved = getProgressiveListCheckpoint(source.scope);
    const restartWarning = document.createElement("p");
    bindText(restartWarning, "restartWarning");
    const limitHint = document.createElement("p");
    limitHint.className = "ettpd-limit-hint";
    bindText(limitHint, "limitNote");
    limitLabel.append(limitHint);
    const allowance = document.createElement("p");
    const updateAllowance = () => {
      const maximum = Number(limit.value);
      if (limit.value.trim() && Number.isSafeInteger(maximum) && maximum > 0) bindText(allowance, "remainingLimit", { count: Math.max(0, maximum - (resume.checked ? saved?.completed.length || 0 : 0)) });
      else bindText(allowance, "all");
    };
    limitLabel.append(allowance);
    limit.addEventListener("input", () => { updateSubmitLabel(); updateAllowance(); });
    resumeLabel.hidden = !saved;
    resume.checked = !!saved && !saved.finished;
    if (saved) {
      size.value = String(saved.batchSize);
      limit.value = saved.maxPosts == null ? "" : String(saved.maxPosts);
    }
    size.disabled = resume.checked;
    resume.onchange = () => {
      size.disabled = resume.checked;
      if (resume.checked) {
        size.value = String(saved.batchSize);
        limit.value = saved.maxPosts == null ? "" : String(saved.maxPosts);
      }
      updateSubmitLabel();
      bindText(limitTitle, resume.checked ? "totalLimit" : "maxPosts");
      updateAllowance();
      restartWarning.hidden = resume.checked;
    };
    updateSubmitLabel();
    bindText(limitTitle, resume.checked ? "totalLimit" : "maxPosts");
    updateAllowance();
    restartWarning.hidden = resume.checked;
    bindText(status, saved ? saved.finished ? "summaryFinished" : "summaryPaused" : "ready");
    if (saved) {
      content.insertBefore(renderResumeSummary(saved), form);
      content.insertBefore(restartWarning, form);
    }
    form.hidden = false;
    form.onsubmit = event => {
      event.preventDefault();
      const batchSize = Number(size.value);
      const maxPosts = limit.value.trim() ? Number(limit.value) : null;
      if (maxPosts !== null && (!Number.isSafeInteger(maxPosts) || maxPosts < 1)) { bindText(status, "invalidLimit"); return; }
      if (resume.checked && maxPosts !== null && maxPosts < saved.completed.length) { bindText(status, "lowerLimit", { count: saved.completed.length }); return; }
      if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) { bindText(status, "invalidBatch"); return; }
      if (window.location.href !== originUrl) { bindText(status, "pageChanged"); return; }
      if (notifyDownloadBusy()) { bindText(status, "busyMessage"); return; }
      if (["videos", "liked", "reposts", "favorites"].includes(source.kind)) source.nativePage = createNativeAccountPageLoader(source);
      controller.abort(); modal.remove();
      AppState.ui.isDownloaderClosed = false;
      displayFoundUrls({ forced: true });
      void downloadAccountListBatches(source, { batchSize, maxPosts, resume: resume.checked }).then(result => {
        if (result.finished && !result.completed.length) showToast(t("noPosts"), t("empty"));
        else showToast(t(result.limitReached ? "limitReached" : result.finished ? "finished" : "paused"), `${t("savedCount", { count: result.completed.length })}. ${t(result.finished ? "summaryFinished" : "summaryPaused")}`);
      }).catch(error => {
        if (error.name !== "AbortError") showToast(t("paused"), t(error.code === "LIST_PRIVATE" ? "private" : "unavailable"));
      });
    };
  } catch (error) {
    if (!controller.signal.aborted) bindText(status, "unavailable");
  }
}

function makeAccountDownloadControl(descriptor, className = "ettpd-account-download") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  const titleValues = () => ({ list: ["videos", "liked", "reposts", "favorites"].includes(descriptor.kind) ? t(descriptor.kind) : descriptor.title });
  bindText(button, "title", titleValues, "title");
  bindText(button, "title", titleValues, "aria-label");
  button.appendChild(createIcon("download", 16));
  button.onclick = event => { event.preventDefault(); event.stopPropagation(); void showAccountBatchDialog(descriptor); };
  return button;
}

async function syncAccountDownloadControls() {
  const username = getAccountUsername();
  if (!username || accountControlsSyncing) return;
  accountControlsSyncing = true;
  try {
    const tabs = await getTabSpans(0);
    if (getAccountUsername() !== username) return;
    const titles = { videos: "Videos", reposts: "Reposts", liked: "Likes", favorites: "Favorites" };
    for (const [kind, title] of Object.entries(titles)) {
      const tab = findAccountTab(kind, tabs);
      if (!tab || tab.getAttribute("aria-disabled") === "true") continue;
      const existing = document.getElementById(`ettpd-account-${kind}-download`);
      if (existing?.dataset.accountUsername === username && (tab.contains(existing) || existing.previousElementSibling === tab)) continue;
      existing?.remove();
      const button = makeAccountDownloadControl({ kind, username, title });
      button.id = `ettpd-account-${kind}-download`;
      button.dataset.kind = kind;
      button.dataset.accountUsername = username;
      if (tab.tagName === "BUTTON") tab.parentElement.insertBefore(button, tab.nextSibling);
      else tab.appendChild(button);
    }
    document.querySelectorAll('a[href*="/playlist/"],a[href*="/collection/"]').forEach(anchor => {
      if (anchor.closest(`#${DOM_IDS.DOWNLOADER_WRAPPER},#${DOM_IDS.MODAL_CONTAINER}`)) return;
      const match = anchor.getAttribute("href")?.match(/\/(playlist|collection)\/([^/?#]+)-(\d+)/);
      if (!match) return;
      const existing = anchor.querySelector(".ettpd-account-card-download");
      const key = `${match[1]}:${match[3]}`;
      if (existing?.dataset.listKey === key) return;
      existing?.remove();
      let title; try { title = decodeURIComponent(match[2]); } catch { return; }
      const button = makeAccountDownloadControl({ kind: match[1], id: match[3], title }, "ettpd-account-download ettpd-account-card-download");
      button.dataset.listKey = key;
      anchor.classList.add("ettpd-account-list-card");
      anchor.appendChild(button);
    });
  } finally { accountControlsSyncing = false; }
}

function syncCollectionDownloadButton() {
  const collection = getCollectionContext();
  const existing = document.getElementById("ettpd-collection-download");
  if (!collection) { existing?.remove(); return; }
  const heading = document.querySelector('h1[class*="H1ShareTitle"]') || document.querySelector("h1");
  if (!heading?.parentElement) return;
  if (existing?.dataset.collectionId === collection.id && heading.parentElement.contains(existing)) {
    existing.disabled = existing.dataset.loading === "true";
    return;
  }
  existing?.remove();
  const button = document.createElement("button");
  button.id = "ettpd-collection-download";
  button.type = "button";
  button.className = "ettpd-collection-download";
  button.dataset.collectionId = collection.id;
  bindText(button, "title", { list: collection.name }, "title");
  setLocalizedButton(button, "collectionDownload", "download");
  button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    void showAccountBatchDialog({ kind: "collection", id: collection.id, title: collection.name });
  };
  heading.parentElement.appendChild(button);
}

async function showCollectionDownloadDialog(collection, trigger) {
  if (trigger.dataset.loading === "true" || document.getElementById(DOM_IDS.MODAL_CONTAINER)) return;
  trigger.dataset.loading = "true";
  trigger.disabled = true;
  const controller = new AbortController();
  const content = document.createElement("div");
  content.className = "ettpd-episode-dialog";
  const title = document.createElement("h3");
  title.textContent = collection.name;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  bindText(status, "collectionLoading");
  const start = document.createElement("button");
  start.type = "button";
  start.className = "ettpd-action-btn";
  start.hidden = true;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ettpd-action-btn secondary";
  bindText(cancel, "cancel");
  content.append(title, status, start, cancel);
  const close = () => {
    controller.abort();
    trigger.dataset.loading = "false";
    trigger.disabled = AppState.downloading.isDownloadingAll;
  };
  const modal = createModal({ children: [content], onClose: close });
  modal.style.boxSizing = "border-box";
  const box = modal.querySelector(".ettpd-modal-box");
  box.style.boxSizing = "border-box";
  box.style.maxWidth = "calc(100vw - 48px)";
  cancel.onclick = () => { close(); modal.remove(); };
  try {
    const items = await collectCollectionItems({
      collectionId: collection.id,
      requestUrl: resolveCollectionRequest(collection.id),
      signal: controller.signal,
      onProgress: ({ loaded }) => {
        if (getCollectionContext()?.id !== collection.id || !modal.isConnected) { close(); modal.remove(); return; }
        bindText(status, "postsFound", { count: loaded });
      },
    });
    if (controller.signal.aborted || getCollectionContext()?.id !== collection.id) return;
    const available = items.map((item, index) => {
      const media = buildVideoLinkMeta(item, index);
      if (!media || AppState.downloadPreferences.skipAds && item.isAd) return null;
      const ready = media.isImage
        ? media.imagePostImages?.length && media.imagePostImages.every(url => /^https?:\/\//i.test(url))
        : getReadyVideoDownloadMedia(item.id, [media]);
      return ready ? { item, media } : null;
    }).filter(Boolean);
    if (!available.length) throw new Error("This collection has no downloadable posts available to this account.");
    const omitted = items.length - available.length;
    bindText(status, "postsSelection", { count: available.length, skipped: omitted });
    setLocalizedButton(start, "downloadCount", "download", { count: available.length });
    start.hidden = false;
    start.onclick = () => {
      if (getCollectionContext()?.id !== collection.id || AppState.downloading.isDownloadingAll) return;
      for (const entry of available) AppState.allItemsEverSeen[entry.item.id] = entry.item;
      AppState.ui.isDownloaderClosed = false;
      displayFoundUrls({ forced: true });
      close();
      modal.remove();
      void downloadAllLinks(document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON), {
        links: available.map(entry => entry.media), batchType: "collection",
      });
    };
  } catch (error) {
    if (controller.signal.aborted) return;
    bindText(status, "unavailable");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "ettpd-action-btn";
    setLocalizedButton(retry, "retry", "refresh");
    retry.onclick = () => {
      close(); modal.remove();
      if (getCollectionContext()?.id === collection.id) void showCollectionDownloadDialog(collection, trigger);
    };
    content.appendChild(retry);
  }
}

function refreshDownloadButtonQualityBadges() {
  void syncAccountDownloadControls().catch(error => console.warn("[Download] account-controls-unavailable", error));
  syncCollectionDownloadButton();
  syncShortDramaDownloadButton();
  document.querySelectorAll("button.download-btn").forEach((button) => {
    if (button.classList.contains("ettpd-experimental-hd-overlay-btn")) return;
    if (["loading", "unavailable"].includes(button.dataset.sourceState)) {
      button._refreshSourceReadiness?.();
      return;
    }
    if (button.disabled) return;
    const videoId = Array.from(button.classList).find((className) =>
      /^\d{5,}$/.test(className),
    );
    if (!videoId) return;

    const media = AppState.allDirectLinks?.find(
      (candidate) => String(candidate?.videoId) === videoId,
    );
    const qualityLabel = getDownloadActionLabel(media);
    const label = button.querySelector(".download-btn-label");
    if (!qualityLabel || !label) return;

    label.textContent = qualityLabel;
    button.title = getStandardDownloadTitle(media);
    const container = button.closest(".download-btn-container");
    if (container) syncOverlayExperimentalHdButton(container, videoId);
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
        wrapperEl.querySelector("video source")?.src ||
        wrapperEl.querySelector("video")?.src ||
        getSrcById(postId)
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
  if (getComputedStyle(exploreItem).position === "static") exploreItem.style.position = "relative";

  const author =
    getVideoUsernameFromAllDirectLinks(videoId) ||
    exploreItem
      .querySelector('[data-e2e="explore-card-user-unique-id"]')
      ?.textContent?.trim() ||
    getPostInfoFrom(
      exploreItem.closest('[data-e2e="explore-item"]')?.parentElement,
      {
        origin: "createExploreDownloadButton",
      },
    )?.username ||
    getUsernameFromPlayingArticle() ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    wrapper.querySelector("video source")?.src ||
    wrapper.querySelector("video")?.src ||
    getSrcById(videoId);

  createDownloadButton({
    wrapperId: `explore-${videoId}`,
    author,
    videoId,
    getVideoSrc,
    parentEl: exploreItem,
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
        parentEl.className.includes("DivPhotoPlayerContainer") ||
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
    if (!item.matches(":hover")) {
      removeAllInjectedDownloadButtons(item);
      return;
    }
    const href = item.querySelector("a[href*='/video/']")?.getAttribute("href");
    const m = href?.match(/\/video\/(\d+)/);
    if (m && !item.querySelector("button.download-btn")) {
      createExploreDownloadButton(item, m[1]);
    }
  });
}

function getRelevantFeedWrappers() {
  const isMediaDetailPath = /^\/@[^/]+\/(photo|video)\/[A-Za-z0-9]+$/.test(
    window.location.pathname,
  );

  if (!isMediaDetailPath) {
    return Array.from(document.querySelectorAll("div[id^='xgwrapper-']"));
  }

  const roots = [];
  const currentArticle = getCurrentPlayingArticle();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 0;

  const pushRoot = (root) => {
    if (!(root instanceof Element) || roots.includes(root)) return;
    roots.push(root);
  };

  pushRoot(currentArticle);

  Array.from(document.querySelectorAll("article"))
    .filter((article) => {
      if (!(article instanceof HTMLElement)) return false;
      const rect = article.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }

      return (
        rect.bottom > viewportHeight * -0.25 && rect.top < viewportHeight * 1.25
      );
    })
    .slice(0, 3)
    .forEach(pushRoot);

  if (!roots.length) {
    return Array.from(document.querySelectorAll("div[id^='xgwrapper-']"));
  }

  const seen = new Set();
  const wrappers = [];

  roots.forEach((root) => {
    root.querySelectorAll("div[id^='xgwrapper-']").forEach((wrapper) => {
      if (!seen.has(wrapper)) {
        seen.add(wrapper);
        wrappers.push(wrapper);
      }
    });
  });

  return wrappers;
}

function injectFeedWrapperDownloadButtons() {
  getRelevantFeedWrappers().forEach((wrapper) => {
    if (
      wrapper.closest('div[data-e2e="explore-item"]') ||
      wrapper.closest('div[data-e2e="user-post-item"]') ||
      wrapper.closest("div[id^='column-item-video-container-']") ||
      getCreatorVideosSidebarCard(wrapper) ||
      getYouMayLikeGridCard(wrapper) ||
      getMainVideoSideGridCard(wrapper)
    ) {
      return;
    }

    const m = wrapper.id.match(/xgwrapper-\d+-(\d+)/);
    if (m && !wrapper.querySelector("button.download-btn")) {
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
      if (idMatch && !item.querySelector("button.download-btn")) {
        createImageDownloadButton(item, idMatch[1]);
      }
    });
}

function removeInjectedDownloadButton(item, postId) {
  item
    ?.querySelectorAll(`button.download-btn.${CSS.escape(postId)}`)
    .forEach((button) => {
      const container = button.closest(".download-btn-container");
      if (container) removeIdleDownloadControl(container);
    });
}

function removeAllInjectedDownloadButtons(item) {
  item
    ?.querySelectorAll(".download-btn-container, .photo-download-btn-container")
    .forEach(removeIdleDownloadControl);
}

function getProfileGridPostId(item) {
  const href = item
    ?.querySelector('a[href*="/video/"], a[href*="/photo/"]')
    ?.getAttribute("href");
  return href?.match(/\/(?:video|photo)\/(\d+)/)?.[1] || null;
}

function isProfileGridItemHovered(item) {
  return !!item?.matches(":hover");
}

let activeProfileGridItem = null;

function syncProfileGridDownloadButton(item) {
  if (activeProfileGridItem && activeProfileGridItem !== item) {
    removeAllInjectedDownloadButtons(activeProfileGridItem);
    activeProfileGridItem = null;
  }

  const postId = getProfileGridPostId(item);
  if (!postId) return;

  if (!isProfileGridItemHovered(item)) {
    removeAllInjectedDownloadButtons(item);
    if (activeProfileGridItem === item) {
      activeProfileGridItem = null;
    }
    return;
  }

  const playerContainer = getImageDivPlayerContainerDownward(item);
  const wrapper =
    playerContainer?.parentElement?.parentElement || playerContainer;
  if (!wrapper) {
    removeAllInjectedDownloadButtons(item);
    if (activeProfileGridItem === item) {
      activeProfileGridItem = null;
    }
    return;
  }

  if (wrapper.querySelector(`button.download-btn.${CSS.escape(postId)}`)) {
    activeProfileGridItem = item;
    return;
  }

  createMediaDownloadButtonForWrapper(wrapper, postId);
  activeProfileGridItem = item;
}

let profileGridHoverListenersBound = false;

function ensureProfileGridHoverListeners() {
  if (profileGridHoverListenersBound || !document?.addEventListener) {
    return;
  }

  const getClosestProfileGridItem = (node) =>
    node instanceof Element
      ? node.closest('div[data-e2e="user-post-item"]')
      : null;

  document.addEventListener("mouseover", (event) => {
    const item = getClosestProfileGridItem(event.target);
    if (!item) return;

    const relatedItem = getClosestProfileGridItem(event.relatedTarget);
    if (relatedItem === item) return;

    syncProfileGridDownloadButton(item);
  });

  document.addEventListener("mouseout", (event) => {
    const item = getClosestProfileGridItem(event.target);
    if (!item) return;

    const relatedItem = getClosestProfileGridItem(event.relatedTarget);
    if (relatedItem === item) return;

    removeAllInjectedDownloadButtons(item);
    if (activeProfileGridItem === item) {
      activeProfileGridItem = null;
    }
  });

  profileGridHoverListenersBound = true;
}

function injectProfileGridDownloadButtons() {
  ensureProfileGridHoverListeners();
}

ensureProfileGridHoverListeners();

function getSideGridPostId(item) {
  const href = item
    ?.querySelector("a[href*='/video/'], a[href*='/photo/']")
    ?.getAttribute("href");
  return href?.match(/\/(?:video|photo)\/(\d+)/)?.[1] || null;
}

let activeSideGridItem = null;

function syncSideGridDownloadButton(item) {
  if (activeSideGridItem && activeSideGridItem !== item) {
    removeAllInjectedDownloadButtons(activeSideGridItem);
    activeSideGridItem = null;
  }

  const postId = getSideGridPostId(item);
  if (!postId) return;

  if (!item.matches(":hover")) {
    removeAllInjectedDownloadButtons(item);
    if (activeSideGridItem === item) {
      activeSideGridItem = null;
    }
    return;
  }

  const playerDiv = item.querySelector("div[class*='DivPlayerContainer']");
  if (!playerDiv) {
    removeAllInjectedDownloadButtons(item);
    if (activeSideGridItem === item) {
      activeSideGridItem = null;
    }
    return;
  }

  const parentEl = Array.from(item.children)?.at(0);
  if (!parentEl) {
    removeAllInjectedDownloadButtons(item);
    if (activeSideGridItem === item) {
      activeSideGridItem = null;
    }
    return;
  }

  if (item.querySelector(`button.download-btn.${CSS.escape(postId)}`)) {
    activeSideGridItem = item;
    return;
  }

  createMediaDownloadButtonForWrapper(parentEl, postId);
  activeSideGridItem = item;
}

let sideGridHoverListenersBound = false;

function ensureSideGridHoverListeners() {
  if (sideGridHoverListenersBound || !document?.addEventListener) {
    return;
  }

  const getClosestSideGridItem = (node) =>
    node instanceof Element
      ? node.closest("div[id^='column-item-video-container-']")
      : null;

  document.addEventListener("mouseover", (event) => {
    const item = getClosestSideGridItem(event.target);
    if (!item) return;

    const relatedItem = getClosestSideGridItem(event.relatedTarget);
    if (relatedItem === item) return;

    syncSideGridDownloadButton(item);
  });

  document.addEventListener("mouseout", (event) => {
    const item = getClosestSideGridItem(event.target);
    if (!item) return;

    const relatedItem = getClosestSideGridItem(event.relatedTarget);
    if (relatedItem === item) return;

    removeAllInjectedDownloadButtons(item);
    if (activeSideGridItem === item) {
      activeSideGridItem = null;
    }
  });

  sideGridHoverListenersBound = true;
}

function injectSideGridDownloadButtons() {
  ensureSideGridHoverListeners();
}

function getPostLinkHrefFromElement(element) {
  if (!(element instanceof Element)) return null;

  return (
    element
      .closest("a[href*='/video/'], a[href*='/photo/']")
      ?.getAttribute("href") ||
    element
      .querySelector("a[href*='/video/'], a[href*='/photo/']")
      ?.getAttribute("href") ||
    null
  );
}

function normalizeMediaAssetUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0] || null;
  }
}

function collectMediaUrlHints(element) {
  const hints = new Set();

  const addHint = (value) => {
    const normalized = normalizeMediaAssetUrl(value);
    if (normalized) {
      hints.add(normalized);
    }
  };

  const addSrcSetHints = (srcset) => {
    if (typeof srcset !== "string") return;

    srcset
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .forEach(addHint);
  };

  if (!(element instanceof Element)) return hints;

  element.querySelectorAll("img").forEach((img) => {
    addHint(img.currentSrc || img.src);
    addSrcSetHints(img.srcset);
  });

  element.querySelectorAll("source").forEach((source) => {
    addHint(source.src);
    addSrcSetHints(source.srcset);
  });

  element.querySelectorAll("video").forEach((video) => {
    addHint(video.currentSrc || video.src);
    addHint(video.poster);
  });

  return hints;
}

function mediaMatchesElementHints(media, hints) {
  if (!media?.videoId || !hints?.size) return false;

  const candidates = [
    media.url,
    media.coverImage,
    media.dynamicCover,
    media.originCover,
    ...(Array.isArray(media.imagePostImages) ? media.imagePostImages : []),
  ];

  return candidates.some((candidate) => {
    const normalized = normalizeMediaAssetUrl(candidate);
    return normalized ? hints.has(normalized) : false;
  });
}

function getReactFiberNode(element) {
  if (!(element instanceof Element)) return null;

  for (const key in element) {
    if (key.startsWith("__reactFiber$")) {
      return element[key];
    }
  }

  return null;
}

function scoreFiberMediaCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return -1;

  let score = 0;
  if (typeof candidate.id === "string" && candidate.id) score += 10;
  if (candidate.video?.playAddr || candidate.video?.downloadAddr) score += 5;
  if (candidate.imagePost?.images?.length) score += 4;
  if (candidate.author?.uniqueId || candidate.author?.nickname) score += 3;
  if (candidate.stats || candidate.statsV2) score += 2;
  if (candidate.desc || candidate.createTime) score += 1;

  return score;
}

function findFiberMediaForElement(element) {
  const hints = collectMediaUrlHints(element);
  let current = element instanceof Element ? element : null;
  let bestMedia = null;
  let bestScore = -1;

  for (
    let hop = 0;
    current && hop < 5;
    hop += 1, current = current.parentElement
  ) {
    const fiber = getReactFiberNode(current);
    if (!fiber) continue;

    const queue = [{ value: fiber, depth: 0 }];
    const seen = new WeakSet();
    let visits = 0;

    while (queue.length && visits < 160) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== "object" || seen.has(value)) continue;

      seen.add(value);
      visits += 1;

      const candidatePool = [
        value,
        value.item,
        value.props?.item,
        value.pendingProps?.item,
        value.memoizedProps?.item,
      ];

      candidatePool.forEach((candidate) => {
        const candidateScore = scoreFiberMediaCandidate(candidate);
        if (candidateScore <= 0) return;

        const media = buildVideoLinkMeta(candidate);
        if (!media?.videoId) return;

        const score =
          candidateScore +
          (mediaMatchesElementHints(media, hints) ? 50 : 0) -
          depth -
          hop;

        if (score > bestScore) {
          bestScore = score;
          bestMedia = media;
        }
      });

      if (depth >= 4) continue;

      [
        value.pendingProps,
        value.memoizedProps,
        value.props,
        value.children,
        value.child,
        value.sibling,
      ].forEach((nextValue) => {
        if (nextValue && typeof nextValue === "object") {
          queue.push({ value: nextValue, depth: depth + 1 });
        }
      });
    }
  }

  return bestMedia;
}

function findKnownMediaForElement(element) {
  const gridMedia = findVideoListGridMediaForElement(element);
  if (gridMedia?.videoId) {
    return gridMedia;
  }

  const hints = collectMediaUrlHints(element);

  const knownDirectLinks = Array.isArray(AppState.allDirectLinks)
    ? AppState.allDirectLinks
    : [];

  if (hints.size) {
    for (const media of knownDirectLinks) {
      if (mediaMatchesElementHints(media, hints)) {
        return media;
      }
    }

    for (const rawMedia of Object.values(AppState.allItemsEverSeen || {})) {
      const media = buildVideoLinkMeta(rawMedia);
      if (mediaMatchesElementHints(media, hints)) {
        return media;
      }
    }
  }

  return findFiberMediaForElement(element);
}

function findVideoListGridMediaForElement(element) {
  if (!(element instanceof Element)) return null;

  const gridContainer = element.closest("div[class*='DivVideoListContainer']");
  if (!gridContainer) return null;

  const gridChildren = Array.from(gridContainer.children).filter(
    (child) => child instanceof Element,
  );
  if (!gridChildren.length) return null;

  const gridChild =
    gridChildren.find(
      (child) => child === element || child.contains(element),
    ) || null;
  if (!gridChild) return null;

  const itemIndex = gridChildren.indexOf(gridChild);
  if (itemIndex < 0) return null;

  const fiberItems = findFiberItemsInContainer(
    gridContainer,
    Math.max(300, gridChildren.length * 40),
    18,
  );
  if (!fiberItems.length) return null;

  const hints = collectMediaUrlHints(gridChild);
  const orderedCandidates = [
    fiberItems[itemIndex],
    fiberItems[itemIndex - 1],
    fiberItems[itemIndex + 1],
  ].filter(Boolean);

  for (const candidate of orderedCandidates) {
    const media = buildVideoLinkMeta(candidate);
    if (!media?.videoId) continue;
    if (!hints.size || mediaMatchesElementHints(media, hints)) {
      return media;
    }
  }

  const fallbackCandidate = fiberItems[itemIndex];
  return fallbackCandidate ? buildVideoLinkMeta(fallbackCandidate) : null;
}

function getCreatorVideosSidebarPostData(card) {
  const href = getPostLinkHrefFromElement(card);
  const matchedMedia = findKnownMediaForElement(card);
  const videoId = extractVideoIdFromURL(href) || matchedMedia?.videoId || null;
  const authorId = extractAuthorFromURL(href) || matchedMedia?.authorId || null;
  const resolvedHref =
    href ||
    (videoId && authorId
      ? `/@${authorId}/${matchedMedia?.isImage ? "photo" : "video"}/${videoId}`
      : null);

  return {
    href: resolvedHref,
    videoId,
    authorId,
    media: matchedMedia,
  };
}

function getCreatorVideosSidebarCard(node) {
  let current = node instanceof Element ? node : null;

  while (current && current !== document.body) {
    if (current.matches?.("div[id^='column-item-video-container-']")) {
      return null;
    }

    if (current.tagName === "DIV") {
      const className = String(current.className || "");
      const wrapper = getImageDivPlayerContainerDownward(current);
      const hasItemContainer = className.includes("DivItemContainer");
      const hasCoverContainer = !!current.querySelector(
        "div[class*='DivCoverContainer']",
      );
      const hasCoverMedia = !!current.querySelector(
        "img[class*='ImgCover'], picture, video",
      );
      const hasPlayCount = !!current.querySelector(
        "div[class*='DivPlayCount']",
      );

      if (
        hasItemContainer &&
        hasCoverContainer &&
        (wrapper?.className.includes("DivPlayerWrapper") ||
          hasCoverMedia ||
          hasPlayCount)
      ) {
        return current;
      }
    }

    current = current.parentElement;
  }

  return null;
}

function getCreatorVideosSidebarPostHref(card) {
  return getCreatorVideosSidebarPostData(card).href;
}

function getCreatorVideosSidebarPostId(card) {
  return getCreatorVideosSidebarPostData(card).videoId;
}

let activeCreatorVideosSidebarCard = null;

function syncCreatorVideosSidebarDownloadButton(card) {
  if (
    activeCreatorVideosSidebarCard &&
    activeCreatorVideosSidebarCard !== card
  ) {
    removeAllInjectedDownloadButtons(activeCreatorVideosSidebarCard);
    activeCreatorVideosSidebarCard = null;
  }

  const postData = getCreatorVideosSidebarPostData(card);
  const videoId = postData.videoId;
  if (!videoId) return;

  if (!card.matches(":hover")) {
    removeAllInjectedDownloadButtons(card);
    if (activeCreatorVideosSidebarCard === card) {
      activeCreatorVideosSidebarCard = null;
    }
    return;
  }

  const wrapper = getImageDivPlayerContainerDownward(card);

  const parentEl =
    wrapper?.closest("div[class*='DivCoverContainer']") ||
    card.querySelector("div[class*='DivCoverContainer']") ||
    wrapper?.parentElement?.parentElement ||
    wrapper?.parentElement ||
    card;
  if (!parentEl) {
    removeAllInjectedDownloadButtons(card);
    if (activeCreatorVideosSidebarCard === card) {
      activeCreatorVideosSidebarCard = null;
    }
    return;
  }

  if (card.querySelector(`button.download-btn.${CSS.escape(videoId)}`)) {
    activeCreatorVideosSidebarCard = card;
    return;
  }

  const author =
    postData.authorId ||
    getVideoUsernameFromAllDirectLinks(videoId) ||
    getPostInfoFrom(card, {
      origin: "creatorVideosSidebar",
    })?.username ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    getImageDivPlayerContainerDownward(card)?.querySelector("video source")
      ?.src ||
    getImageDivPlayerContainerDownward(card)?.querySelector("video")?.src ||
    getSrcById(videoId) ||
    (postData.media?.url?.startsWith("http") ? postData.media.url : "");

  createDownloadButton({
    wrapperId: `creator-sidebar-${videoId}`,
    author,
    videoId,
    getVideoSrc,
    parentEl,
    isSmallView: true,
    from: "creatorVideosSidebar",
  });
  activeCreatorVideosSidebarCard = card;
}

let creatorVideosSidebarHoverListenersBound = false;

function ensureCreatorVideosSidebarHoverListeners() {
  if (creatorVideosSidebarHoverListenersBound || !document?.addEventListener) {
    return;
  }

  document.addEventListener("mouseover", (event) => {
    const card = getCreatorVideosSidebarCard(event.target);
    if (!card) return;

    const relatedCard = getCreatorVideosSidebarCard(event.relatedTarget);
    if (relatedCard === card) return;

    syncCreatorVideosSidebarDownloadButton(card);
  });

  document.addEventListener("mouseout", (event) => {
    const card = getCreatorVideosSidebarCard(event.target);
    if (!card) return;

    const relatedCard = getCreatorVideosSidebarCard(event.relatedTarget);
    if (relatedCard === card) return;

    removeAllInjectedDownloadButtons(card);
    if (activeCreatorVideosSidebarCard === card) {
      activeCreatorVideosSidebarCard = null;
    }
  });

  creatorVideosSidebarHoverListenersBound = true;
}

function injectCreatorVideosSidebarDownloadButtons() {
  ensureCreatorVideosSidebarHoverListeners();
}

function getYouMayLikeGridCard(node) {
  const card =
    node instanceof Element
      ? node.closest("div[class*='DivCoverContainer']")
      : null;

  if (!card) return null;

  if (card.closest('div[data-e2e="user-post-item"]')) {
    return null;
  }

  if (card.closest("div[id^='column-item-video-container-']")) {
    return null;
  }

  if (card.closest('div[data-e2e="explore-item"]')) {
    return null;
  }

  if (getCreatorVideosSidebarCard(card)) {
    return null;
  }

  if (getMainVideoSideGridCard(card)) {
    return null;
  }

  const href = getPostLinkHrefFromElement(card);
  if (!href?.includes("/video/")) {
    return null;
  }

  if (!card.querySelector("a[href*='/video/']")) {
    return null;
  }

  if (!card.querySelector("picture, img, video")) {
    return null;
  }

  return card;
}

function getYouMayLikeGridPostHref(card) {
  return getPostLinkHrefFromElement(card);
}

function getYouMayLikeGridPostId(card) {
  return extractVideoIdFromURL(getYouMayLikeGridPostHref(card));
}

let activeYouMayLikeGridCard = null;

function syncYouMayLikeGridDownloadButton(card) {
  if (activeYouMayLikeGridCard && activeYouMayLikeGridCard !== card) {
    removeAllInjectedDownloadButtons(activeYouMayLikeGridCard);
    activeYouMayLikeGridCard = null;
  }

  const videoId = getYouMayLikeGridPostId(card);
  if (!videoId) return;

  if (!card.matches(":hover")) {
    removeAllInjectedDownloadButtons(card);
    if (activeYouMayLikeGridCard === card) {
      activeYouMayLikeGridCard = null;
    }
    return;
  }

  if (card.querySelector(`button.download-btn.${CSS.escape(videoId)}`)) {
    activeYouMayLikeGridCard = card;
    return;
  }

  const href = getYouMayLikeGridPostHref(card);
  const author =
    extractAuthorFromURL(href) ||
    getVideoUsernameFromAllDirectLinks(videoId) ||
    getPostInfoFrom(card, {
      origin: "youMayLikeGrid",
    })?.username ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    card.querySelector("video source")?.src ||
    card.querySelector("video")?.src ||
    getSrcById(videoId) ||
    "";

  createDownloadButton({
    wrapperId: `you-may-like-${videoId}`,
    author,
    videoId,
    getVideoSrc,
    parentEl: card,
    isSmallView: true,
    from: "youMayLikeGrid",
  });
  activeYouMayLikeGridCard = card;
}

let youMayLikeGridHoverListenersBound = false;

function ensureYouMayLikeGridHoverListeners() {
  if (youMayLikeGridHoverListenersBound || !document?.addEventListener) {
    return;
  }

  document.addEventListener("mouseover", (event) => {
    const card = getYouMayLikeGridCard(event.target);
    if (!card) return;

    const relatedCard = getYouMayLikeGridCard(event.relatedTarget);
    if (relatedCard === card) return;

    syncYouMayLikeGridDownloadButton(card);
  });

  document.addEventListener("mouseout", (event) => {
    const card = getYouMayLikeGridCard(event.target);
    if (!card) return;

    const relatedCard = getYouMayLikeGridCard(event.relatedTarget);
    if (relatedCard === card) return;

    removeAllInjectedDownloadButtons(card);
    if (activeYouMayLikeGridCard === card) {
      activeYouMayLikeGridCard = null;
    }
  });

  youMayLikeGridHoverListenersBound = true;
}

function injectYouMayLikeGridDownloadButtons() {
  ensureYouMayLikeGridHoverListeners();
}

function getMainVideoSideGridCard(node) {
  let current = node instanceof Element ? node : null;

  while (current && current !== document.body) {
    if (current.matches?.("div[id^='column-item-video-container-']")) {
      return null;
    }

    if (current.tagName === "DIV") {
      const link = current.querySelector("a[href*='/video/']");
      const wrapper = getImageDivPlayerContainerDownward(current);

      if (link && wrapper?.className.includes("DivPlayerWrapper")) {
        return current;
      }
    }

    current = current.parentElement;
  }

  return null;
}

function getMainVideoSideGridPostId(card) {
  const href = card?.querySelector("a[href*='/video/']")?.getAttribute("href");
  return href?.match(/\/video\/(\d+)/)?.[1] || null;
}

let activeMainVideoSideGridCard = null;

function syncMainVideoSideGridDownloadButton(card) {
  if (activeMainVideoSideGridCard && activeMainVideoSideGridCard !== card) {
    removeAllInjectedDownloadButtons(activeMainVideoSideGridCard);
    activeMainVideoSideGridCard = null;
  }

  const videoId = getMainVideoSideGridPostId(card);
  if (!videoId) return;

  if (!card.matches(":hover")) {
    removeAllInjectedDownloadButtons(card);
    if (activeMainVideoSideGridCard === card) {
      activeMainVideoSideGridCard = null;
    }
    return;
  }

  const wrapper = getImageDivPlayerContainerDownward(card);
  if (!wrapper || !wrapper.className.includes("DivPlayerWrapper")) {
    removeAllInjectedDownloadButtons(card);
    if (activeMainVideoSideGridCard === card) {
      activeMainVideoSideGridCard = null;
    }
    return;
  }

  const parentEl = wrapper.parentElement?.parentElement;
  if (!parentEl) {
    removeAllInjectedDownloadButtons(card);
    if (activeMainVideoSideGridCard === card) {
      activeMainVideoSideGridCard = null;
    }
    return;
  }

  const existingDownloadButton = parentEl.querySelector(
    `button.download-btn.${CSS.escape(videoId)}`,
  );
  if (existingDownloadButton) {
    const container = existingDownloadButton.closest(
      ".download-btn-container",
    );
    if (container) syncOverlayExperimentalHdButton(container, videoId);
    activeMainVideoSideGridCard = card;
    return;
  }

  const author =
    getVideoUsernameFromAllDirectLinks(videoId) ||
    getPostInfoFrom(card, {
      origin: "safeGridObserver",
    })?.username ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    wrapper.querySelector("video source")?.src ||
    wrapper.querySelector("video")?.src ||
    getSrcById(videoId);

  createDownloadButton({
    wrapperId: `grid-${videoId}`,
    author,
    videoId,
    getVideoSrc,
    parentEl,
    isSmallView: true,
    from: "safeGridObserver",
  });
  activeMainVideoSideGridCard = card;
}

let mainVideoSideGridHoverListenersBound = false;

function ensureMainVideoSideGridHoverListeners() {
  if (mainVideoSideGridHoverListenersBound || !document?.addEventListener) {
    return;
  }

  document.addEventListener("mouseover", (event) => {
    const card = getMainVideoSideGridCard(event.target);
    if (!card) return;

    const relatedCard = getMainVideoSideGridCard(event.relatedTarget);
    if (relatedCard === card) return;

    syncMainVideoSideGridDownloadButton(card);
  });

  document.addEventListener("mouseout", (event) => {
    const card = getMainVideoSideGridCard(event.target);
    if (!card) return;

    const relatedCard = getMainVideoSideGridCard(event.relatedTarget);
    if (relatedCard === card) return;

    removeAllInjectedDownloadButtons(card);
    if (activeMainVideoSideGridCard === card) {
      activeMainVideoSideGridCard = null;
    }
  });

  mainVideoSideGridHoverListenersBound = true;
}

function downloadBtnInjectorForMainVideoSideGrid() {
  ensureMainVideoSideGridHoverListeners();
}

ensureSideGridHoverListeners();
ensureCreatorVideosSidebarHoverListeners();
ensureYouMayLikeGridHoverListeners();
ensureMainVideoSideGridHoverListeners();
/**
 * Scans the current TikTok page for various post containers (explore items, feed wrappers, and side grid)
 * and attaches appropriate download buttons to each, if not already present.
 *
 * The function delegates the actual logic to specialized helpers for each layout type:
 * - `injectExploreDownloadButtons` handles explore page grid items.
 * - `injectFeedWrapperDownloadButtons` handles feed-style video wrappers.
 * - `injectSideGridDownloadButtons` handles main video/photo containers in side grid view.
 * - `injectCreatorVideosSidebarDownloadButtons` handles the creator videos sidebar preview cards.
 * - `injectYouMayLikeGridDownloadButtons` handles static You May Like cover-grid cards.
 * - `downloadBtnInjectorForMainVideoSideGrid` handles download button injection for the floating side grid.
 *
 * This method is intended to be called periodically or in response to DOM changes (e.g., scroll, navigation)
 * to ensure buttons are added as new content loads.
 */
export function attachDownloadButtons() {
  injectExploreDownloadButtons();
  injectFeedWrapperDownloadButtons();
  injectProfileGridDownloadButtons();
  injectSideGridDownloadButtons();
  injectCreatorVideosSidebarDownloadButtons();
  injectYouMayLikeGridDownloadButtons();
  // injectImageFeedDownloadButtons(); // optional
  downloadBtnInjectorForMainVideoSideGrid();
  refreshDownloadButtonQualityBadges();
  schedulePlaylistHeaderSync();
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
  bindText(timerText, "nextIn", { count: 0 });

  const pauseBtn = document.createElement("button");
  pauseBtn.id = "pauseSwipeBtn";
  bindText(pauseBtn, "pause");
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

    bindText(pauseBtn, AppState.downloadPreferences.autoScrollMode != "off" ? "pause" : "resume");

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
    swiper
      .querySelector(".swiper-slide-active")
      ?.getAttribute("data-swiper-slide-index") || "0",
  );

  const isFeedVideo = section.getAttribute("data-e2e") === "feed-video";
  if (!isPhotoLink && !isFeedVideo && section.tagName === "SECTION") return;
  console.log("IMAGES_DL handleSwiper section isPhoto/video...", {
    section,
  });
  let videoId = isPhotoLink ? extractVideoIdFromURL(linkHref) : null;
  let authorId = isPhotoLink ? extractAuthorFromURL(linkHref) : null;
  if (!isPhotoLink && isFeedVideo) {
    const article = swiper.closest("article");
    let fiber = getReactFiberNode(article);
    for (let depth = 0; fiber && depth < 12; depth += 1, fiber = fiber.return) {
      const id = String(fiber.memoizedProps?.id || fiber.pendingProps?.id || "");
      if (/^\d+$/.test(id)) { videoId = id; break; }
    }
    const item = videoId && (AppState.allItemsEverSeen[videoId] || findFiberItemById(article, videoId, 40)?.item);
    authorId = item?.author?.uniqueId || extractAuthorFromURL(article?.querySelector('a[href^="/@"]')?.getAttribute("href") || "");
    if (item && !AppState.allItemsEverSeen[videoId]) {
      AppState.allItemsEverSeen[videoId] = item;
      displayFoundUrls({ forced: true });
    }
  }
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
    parentEl: getImageDivPlayerContainer(swiper) || section,
    isSmallView: false,
    isImage: true,
    photoIndex,
    getPhotoIndex: () => Number(swiper.querySelector(".swiper-slide-active")?.getAttribute("data-swiper-slide-index") || "0"),
    from: "handleSwiper",
  });
}

export function handleSingleImage(picture) {
  const img = picture.querySelector("img");
  if (!img?.src) return;

  const wrapper = findAncestor(
    picture,
    (el) => el.getAttribute("data-e2e") === "user-post-item",
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
  if (AppState.debug.active) {
    console.log("IMAGES_DL scanAndInject init...");
  }
  const swipers = Array.from(document.querySelectorAll("div.swiper"));
  const activeSwiper = document.querySelector("div.swiper.swiper-initialized");
  if (AppState.debug.active) {
    console.log("IMAGES_DL scanAndInject init...", { swipers, activeSwiper });
  }

  if (
    /^\/@[^\/]+\/(photo|video)\/[A-Za-z0-9]+$/.test(window.location.pathname) &&
    activeSwiper
  ) {
    if (AppState.debug.active) {
      console.log("IMAGES_DL photo/video match found init...");
    }

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
  if (AppState.debug.active) {
    console.log(
      "IMAGES_DL photo/video match cleaning buttons...",
      document.querySelectorAll(
        ".photo-download-btn-container, .download-btn-container",
      ),
    );
  }

  clearDownloadBtnContainers();
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
      el.className.includes("DivPlayerContainer") && el.offsetParent !== null, // visible in layout flow
  );

  return container;
}

function clearPendingResumeDownload() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_RESUME_DOWNLOAD);
  } catch {}
}

function processResumeDownloadPayload(payload) {
  clearPendingResumeDownload();

  const { username, tabName, isCollection, collectionUrl } = payload || {};
  console.log("[Resume Download] Received resume request:", {
    username,
    tabName,
    isCollection,
    collectionUrl,
  });

  // If we have a collection URL and we're not on that page, navigate to it
  if (
    isCollection &&
    collectionUrl &&
    window.location.pathname !== collectionUrl
  ) {
    console.log(
      "[Resume Download] Navigating to collection URL:",
      collectionUrl,
    );

    // Set the state before navigation so it persists after page reload
    AppState.scrapperDetails.selectedTab = "collection";
    AppState.scrapperDetails.selectedCollectionName = tabName;
    AppState.scrapperDetails.originalUsername = username;
    AppState.scrapperDetails.scrappingStage = "initiated";
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails),
    );

    window.location.href = `https://www.tiktok.com${collectionUrl}`;
    return;
  }

  // Use handler for business logic
  const result = handleResumeDownload(username, tabName, isCollection);

  if (!result.success) {
    console.warn("[Resume Download]", result.error);
    showToast(
      t("errorTitle"),
      result.needsNavigation
        ? `Please navigate to @${username}'s profile first.`
        : result.error,
    );
    return;
  }

  // Set the selected tab in AppState before starting scrapping
  AppState.scrapperDetails.selectedTab = result.tabKey;
  if (isCollection && result.collectionName) {
    AppState.scrapperDetails.selectedCollectionName = result.collectionName;
  }

  // Persist state to localStorage
  localStorage.setItem(
    STORAGE_KEYS.SCRAPPER_DETAILS,
    JSON.stringify(AppState.scrapperDetails),
  );

  // Start the scrapping process (UI action)
  startScrappingProcess(result.tabKey, result.pageInfo).catch((err) => {
    console.error("[Resume Download] Failed to start:", err);
    showToast(t("errorTitle"), t("resumeFailed"));
  });
}

function consumePendingResumeDownload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_RESUME_DOWNLOAD);
    if (!raw) return;

    const payload = JSON.parse(raw);
    if (!payload?.username || !payload?.tabName) {
      clearPendingResumeDownload();
      return;
    }

    setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEYS.PENDING_RESUME_DOWNLOAD)) {
        return;
      }
      processResumeDownloadPayload(payload);
    }, 0);
  } catch (error) {
    console.warn("[Resume Download] Failed to consume pending request:", error);
    clearPendingResumeDownload();
  }
}

// Listen for resume download messages from popup
window.addEventListener("message", (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const data = event.data;
  if (data?.type === "RESUME_DOWNLOAD") {
    processResumeDownloadPayload(data.payload);
  }
});

consumePendingResumeDownload();
