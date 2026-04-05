// ui.js
import AppState, { resetAppStateToDefaults } from "../state/state.js";
import { createHtmlFragment, replaceElementHtml } from "../utils/html.js";
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
  shouldShowRatePopupLegacy,
  getRecommendedPresetTemplate,
  showShareOptions,
  buildVideoLinkMeta,
  cleanupPath,
  applyTemplate,
  findRecentPlaylistRequestUrl,
  isOnProfileOrCollectionPage,
  rememberCurrentPlaylistItems,
  saveCSVFile,
  stopActiveBatchDownload,
  findFiberItemById,
  findFiberItemsInContainer,
  detectBrowserType,
  syncPlaylistStateWithLocation,
} from "../utils/utils.js";
import {
  startAutoSwipeLoop,
  startAutoBatchDownloads,
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
let lastTrackedUsername = null;

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
  closeBtn.setAttribute("aria-label", "Dismiss notification");
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
  button.textContent = "";

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
  button.title = "Turn extension off";
  button.setAttribute("aria-label", "Turn extension off");

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
    button.title = enabled ? "Turn extension off" : "Turn extension on";
    button.setAttribute(
      "aria-label",
      enabled ? "Turn extension off" : "Turn extension on",
    );
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
          "⚠️ <b>Disable Extension?</b><br><br>" +
            "The extension will be completely disabled. No scripts will run, no polling will occur, and no downloads will be processed.<br><br>" +
            "To re-enable, click the extension icon and select 'Turn On'.",
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
          console.log("[EXT_POWER] disabling via header modal");
          await setExtensionEnabled(false);
          applyState(false);

          showToast(
            "Extension disabled",
            "Reloading the page to stop the downloader...",
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
      "Extension enabled",
      "Reload the page for changes to take effect.",
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
  dragHandle.title = "Press & hold, then drag to move";
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
    { value: "", icon: "corner-none", label: "Free" },
    { value: "top-left", icon: "corner-top-left", label: "Top Left" },
    { value: "top-right", icon: "corner-top-right", label: "Top Right" },
    { value: "bottom-left", icon: "corner-bottom-left", label: "Bottom Left" },
    {
      value: "bottom-right",
      icon: "corner-bottom-right",
      label: "Bottom Right",
    },
  ];

  let selectedCornerValue = "";

  // Toggle button that shows the currently selected icon
  const cornerToggle = document.createElement("button");
  cornerToggle.type = "button";
  cornerToggle.className = "ettpd-corner-toggle";
  cornerToggle.title = "Snap to corner";
  cornerToggle.setAttribute("aria-label", "Snap to corner");
  cornerToggle.setAttribute("aria-haspopup", "listbox");
  cornerToggle.setAttribute("aria-expanded", "false");

  let cornerIcon = createIcon("corner-bottom-right", 14);
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
    item.title = label;

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
  leaderboardBtn.title = "View Leaderboard";
  leaderboardBtn.setAttribute("aria-label", "View leaderboard");
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
  shareBtn.title = "Share Extension!";
  shareBtn.setAttribute("aria-label", "Share extension");
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
  controlBar.appendChild(powerButton);
  wrapper.appendChild(controlBar);
  if (!wrapper || !wrapper.style) return;
  console.warn(wrapper, "STYLE", wrapper.style);
  // Restore pinned position if exists
  const saved =
    localStorage.getItem(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE) ||
    "bottom-right";

  // Set initial select value and icon
  if (saved && saved !== "custom") {
    setCornerValue(saved);
  }

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
    title.textContent = "Resume Downloads:";
    container.appendChild(title);

    // List of resumable downloads
    const list = document.createElement("div");
    list.className = "ettpd-resume-downloads-list";

    for (const tab of resumableTabs) {
      const item = document.createElement("div");
      item.className = "ettpd-resume-download-item";

      const label = document.createElement("span");
      label.className = "ettpd-resume-download-label";
      label.textContent = `${tab.label} (saved ${tab.count})`;
      item.appendChild(label);

      const resumeBtn = document.createElement("button");
      setButtonWithIcon(resumeBtn, "Resume", "play");
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
  const tabDisplay = toTitleCase(
    AppState.scrapperDetails.selectedTab || "Scrapper",
  );
  tabName.textContent =
    tabDisplay.length > 12 ? tabDisplay.slice(0, 12) + "..." : tabDisplay;
  if (tabDisplay.length > 12) {
    tabName.title = tabDisplay;
  }

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
  pauseBtn.title = AppState.scrapperDetails.paused ? "Resume" : "Pause";
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
      pauseBtn.title = "Resume";
      pauseBtn.style.background = "#007AFF";
    } else {
      AppState.downloadPreferences.autoScrollMode = "always";
      setButtonWithIcon(pauseBtn, "", "pause");
      pauseBtn.title = "Pause";
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

    let statusText = "";
    if (AppState.scrapperDetails.paused) {
      // When paused, show percentage if skipDownloaded is enabled and discovering
      if (skipDownloaded && isDiscovering) {
        let percentage =
          maxCount > 0 ? Math.round((downloaded / maxCount) * 100) : 0;
        if (percentage >= 100) {
          percentage = 99;
        }
        statusText = `Paused | ${downloaded}/${maxCount} (${percentage}%) discovering...`;
      } else {
        statusText = `Paused | ${downloaded}/${discovered}`;
      }
    } else if (isDownloading && isAutoBatch) {
      // When downloading in batches
      let percentage =
        maxCount > 0 ? Math.round((downloaded / maxCount) * 100) : 0;

      if (skipDownloaded && isDiscovering) {
        // Still discovering - cap percentage at 99% (never show 100% while discovering)
        if (percentage >= 100) {
          percentage = 99;
        }
        statusText = `Batch #${currentBatch} | ${downloaded}/${maxCount} (${percentage}%) discovering...`;
      } else {
        // Done discovering, show normal progress with percentage
        statusText = `Batch #${currentBatch} | ${downloaded}/${discovered} (${percentage}%)`;
      }
    } else if (discovered > 0) {
      // Not downloading yet, but have discovered items
      if (skipDownloaded && isDiscovering) {
        // Still discovering with skipDownloaded enabled - show percentage but cap at 99%
        let percentage =
          maxCount > 0 ? Math.round((downloaded / maxCount) * 100) : 0;
        if (percentage >= 100) {
          percentage = 99;
        }
        statusText = `${downloaded}/${maxCount} (${percentage}%) discovering...`;
      } else {
        // Normal display
        statusText = `${downloaded}/${discovered}`;
      }
    } else {
      statusText = "Discovering...";
    }

    statusInfo.textContent = statusText;
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
      pauseBtn.title = shouldBePaused ? "Resume" : "Pause";
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
  setButtonWithIcon(continueBtn, "Continue Scrapping", "play");
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
  setButtonWithIcon(csvBtn, "Download CSV", "download");
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
        "No items to export",
        "No downloaded items found to export to CSV.",
      );
      return;
    }

    saveCSVFile(downloadedItems);
    showToast(
      "CSV Export Started",
      `Exporting ${downloadedItems.length} downloaded items to CSV file.`,
    );
  };

  const endBtn = document.createElement("button");
  endBtn.className = "ettpd-scrapper-continue-btn";
  endBtn.textContent = "End Scrapping";
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
      { key: "videos", label: "Scrape Videos", icon: "video" },
      { key: "reposts", label: "Scrape Reposts", icon: "repost" },
      { key: "liked", label: "Scrape Likes", icon: "heart" },
      { key: "favorites", label: "Scrape Favorites", icon: "star" },
      {
        key: "collection",
        label: `Scrape: ${
          spans.collection || pageInfo.collectionName || "Collection"
        }`,
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
      otherTabsTitle.textContent = "Scrape Another Tab:";
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
        btn.appendChild(document.createTextNode(label.replace("Scrape ", "")));

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
        <strong>Where do your downloads go?</strong><br><br>
        By default, files are saved to your browser's <b>Downloads</b> folder using a flat naming format like:<br>
        <code style="font-size:11px;background:var(--ettpd-bg-secondary,#eee);padding:2px 6px;border-radius:4px;display:inline-block;margin:6px 0;">
          @username-Videos-2025-01-01-cool-video-12345.mp4
        </code><br><br>
        You can organise downloads into <b>folders by username, tab, date</b> and more using file path templates.<br><br>
        <span style="font-size:11px;color:var(--ettpd-text-secondary,#888);">You can always change this later in Settings → File Path Templates.</span>
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
    continueBtn.textContent = "Continue with Defaults";
    continueBtn.onclick = () => {
      const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
      if (overlay) overlay.remove();
      resolve("continue");
    };

    const configureBtn = document.createElement("button");
    configureBtn.className = "ettpd-modal-button primary";
    setButtonWithIcon(configureBtn, "Configure File Paths", "settings");
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
      "<strong>⚠️ Heads up:</strong> Please navigate to a profile or collection page first. If you download from other pages, you may end up downloading random posts. Reload the page if you don't see any tabs.",
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
      newDownloadsTitle.textContent = "Download Other Tabs:";
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
      setButtonWithIcon(refreshTabsBtn, "Check for More Tabs", "refresh");
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
        updateButtonWithIcon(refreshTabsBtn, "Checking...", "hourglass");
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
            updateButtonWithIcon(refreshTabsBtn, "Found More!", "check");
            setTimeout(() => {
              showScrapperControls(); // Re-render with new tabs
            }, 500);
          } else {
            updateButtonWithIcon(
              refreshTabsBtn,
              "Check for More Tabs",
              "refresh",
            );
            refreshTabsBtn.style.background = "#f0f0f0";
            // Show a brief message
            const originalContent = refreshTabsBtn.cloneNode(true);
            refreshTabsBtn.textContent = "No new tabs found";
            setTimeout(() => {
              refreshTabsBtn.replaceWith(originalContent);
            }, 2000);
          }
        } catch (err) {
          console.error("Error checking for tabs:", err);
          updateButtonWithIcon(
            refreshTabsBtn,
            "Check for More Tabs",
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
    step2Label.textContent = "Select Tab:";
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
      setButtonWithIcon(refreshTabsBtn, "Check for More Tabs", "refresh");
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
        updateButtonWithIcon(refreshTabsBtn, "Checking...", "hourglass");
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
            updateButtonWithIcon(refreshTabsBtn, "Found More!", "check");
            setTimeout(() => {
              showScrapperControls(); // Re-render with new tabs
            }, 500);
          } else {
            updateButtonWithIcon(
              refreshTabsBtn,
              "Check for More Tabs",
              "refresh",
            );
            refreshTabsBtn.style.background = "#f0f0f0";
            // Show a brief message
            const originalContent = refreshTabsBtn.cloneNode(true);
            refreshTabsBtn.textContent = "No new tabs found";
            setTimeout(() => {
              refreshTabsBtn.replaceWith(originalContent);
            }, 2000);
          }
        } catch (err) {
          console.error("Error checking for tabs:", err);
          updateButtonWithIcon(
            refreshTabsBtn,
            "Check for More Tabs",
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
    step3Label.textContent = `Selected: ${selectedTabLabel}`;
    step3.appendChild(step3Label);

    const actionsRow = document.createElement("div");
    actionsRow.className = "ettpd-stepper-actions";

    const startBtn = document.createElement("button");
    startBtn.className = "ettpd-scrapper-start";
    setButtonWithIcon(startBtn, "Start", "play");
    startBtn.onclick = async () => {
      await startScrappingProcess(selectedTabKey, pageInfo);
    };

    const infoBtn = document.createElement("button");
    infoBtn.className = "ettpd-scrapper-learn";
    setButtonWithIcon(infoBtn, "Info", "info");
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
    { key: "videos", label: "Scrape Videos", icon: "video" },
    { key: "reposts", label: "Scrape Reposts", icon: "repost" },
    { key: "liked", label: "Scrape Likes", icon: "heart" },
    { key: "favorites", label: "Scrape Favorites", icon: "star" },
    {
      key: "collection",
      label: `Scrape: ${
        spans.collection || pageInfo.collectionName || "Collection"
      }`,
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
    replaceElementHtml(
      contentDiv,
      `
      <p style="margin-bottom: 15px; font-size: 14px;">
        You've previously scraped <strong>@${safeUsername}</strong>'s <strong>${safeTabName}</strong>.
      </p>
      <p style="margin-bottom: 20px; font-size: 14px;">
        Found <strong>${count}</strong> previously downloaded items.
      </p>
      <p style="margin-bottom: 20px; font-size: 13px; color: #666;">
        What would you like to do?
      </p>
    `,
    );

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText =
      "display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;";

    const redownloadBtn = document.createElement("button");
    redownloadBtn.className = "ettpd-pref-btn";
    setButtonWithIcon(redownloadBtn, "Re-download All", "refresh");
    redownloadBtn.onclick = () => {
      modal.remove();
      resolve("redownload");
    };

    const skipBtn = document.createElement("button");
    skipBtn.className = "ettpd-pref-btn";
    setButtonWithIcon(skipBtn, "Skip Downloaded", "skip");
    skipBtn.onclick = () => {
      modal.remove();
      resolve("skip");
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ettpd-pref-btn danger";
    setButtonWithIcon(cancelBtn, "Cancel", "error");
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
    `
    <div class="alert">
      <div class="ettpd-scrapper-message-title">
        💡 Let the Scrapper handle it
      </div>
      <div class="ettpd-scrapper-steps">
        <div class="ettpd-scrapper-message-body">
          <span class="ettpd-scrapper-message-step">1.</span>
          <span>Choose a tab above (for example <strong>Scrape Videos</strong>).</span>
        </div>
        <div class="ettpd-scrapper-message-body">
          <span class="ettpd-scrapper-message-step">2.</span>
          <span>Click <strong>Start</strong> to reload the page and auto-scroll every post under
          <strong>@${safeUsername} <em>${safeTab}</em></strong>.</span>
        </div>
        <div class="ettpd-scrapper-message-body">
          <span class="ettpd-scrapper-message-step">3.</span>
          <span>Use <strong>Pause</strong> or <strong>Download Now</strong> anytime if you want to jump in early.</span>
        </div>
      </div>
    </div>
    <blockquote class="black-text" style="margin: 10px 0;">
      If you can't <strong>see</strong> the posts, you can't <strong>download</strong> them. <br/>
      If a tab (Likes, Reposts, etc.) is missing, click it once or refresh the page.
    </blockquote>
    <p class="alert">
      Want full control? Customize where your downloads go under
      <strong>Settings → File Paths</strong> with your own <strong>File Path Templates</strong>. 🛠️
    </p>
  `,
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
  recommendedLabel.appendChild(document.createTextNode("Recommended Template"));

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
  setButtonWithIcon(applyBtn, "Use This Template", "sparkles");
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
    successMessage.appendChild(
      document.createTextNode("Template applied successfully!"),
    );
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
  setButtonWithIcon(configBtn, "Customize File Paths", "settings");
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
      setButtonWithIcon(pauseBtn, "Resume", "play");
      console.log(`[Scrapper] Paused "${tabKey}"`);
    } else {
      // Resume logic
      AppState.downloadPreferences.autoScrollMode = "always";
      setButtonWithIcon(pauseBtn, "Pause", "pause");
      console.log(`[Scrapper] Resumed "${tabKey}"`);
    }
  };
  const learnBtn = document.createElement("button");
  learnBtn.className = "ettpd-scrapper-learn";
  setButtonWithIcon(learnBtn, "Info", "info");
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
  setButtonWithIcon(btn, "Download", "down");
  btn.disabled = true;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    downloadAllLinks(btn);
  };

  const pauseBtn = document.createElement("button");
  pauseBtn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-pause";
  pauseBtn.className = "ettpd-btn download-all-btn-pause";
  setButtonWithIcon(pauseBtn, "Pause", "pause");
  pauseBtn.disabled = true;
  pauseBtn.style.display = "none";
  pauseBtn.title = "Pause downloading";
  pauseBtn.onclick = (e) => {
    e.stopPropagation();
    if (!AppState.downloading.isDownloadingAll) return;
    AppState.downloading.pausedAll = !AppState.downloading.pausedAll;
    if (AppState.downloading.pausedAll) {
      setButtonWithIcon(pauseBtn, "Resume", "play");
      pauseBtn.title = "Resume downloading";
    } else {
      setButtonWithIcon(pauseBtn, "Pause", "pause");
      pauseBtn.title = "Pause downloading";
    }
  };

  const stopBtn = document.createElement("button");
  stopBtn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON + "-stop";
  stopBtn.className = "ettpd-btn download-all-btn-stop";
  setButtonWithIcon(stopBtn, "Stop", "stop");
  stopBtn.disabled = true;
  stopBtn.style.display = "none";
  stopBtn.title = "Stop downloading";
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

  return AppState.downloading.batchType === "playlist" ? "playlist" : "all";
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
  title.textContent = "Quick Start Scrapper";
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
    { key: "videos", label: "Videos", icon: "video" },
    { key: "reposts", label: "Reposts", icon: "repost" },
    { key: "liked", label: "Likes", icon: "heart" },
    { key: "favorites", label: "Favorites", icon: "star" },
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
    hint.textContent = "Navigate to a profile page to see available tabs.";
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
      "⚠️ <b>Abandon Current Scrapping?</b><br><br>" +
        "A scrapping session is already in progress. Starting a new one will <b>abandon</b> the current session.<br><br>" +
        "Any unsaved progress from the current session may be lost.",
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
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => {
      const overlay = document.getElementById(DOM_IDS.MODAL_CONTAINER);
      if (overlay) overlay.remove();
      resolve(false);
    };

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "ettpd-modal-button danger";
    confirmBtn.textContent = "Abandon & Start New";
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
    setButtonWithIcon(actualBtn, "Nothing to download", "stop");
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
            ? `Downloading playlist ${done} of ${total} posts…`
            : `Playlist download complete (${total})`,
        ),
      );
    } else if (done < total) {
      actualBtn.textContent = "";
      const hourglassIcon = createIcon("hourglass", 16);
      hourglassIcon.style.marginRight = "4px";
      actualBtn.appendChild(hourglassIcon);
      actualBtn.appendChild(
        document.createTextNode(
          `Downloading ${done} of ${total} post${total !== 1 ? "s" : ""}…`,
        ),
      );
    } else {
      actualBtn.textContent = "";
      const checkIcon = createIcon("check", 16);
      checkIcon.style.marginRight = "4px";
      actualBtn.appendChild(checkIcon);
      actualBtn.appendChild(
        document.createTextNode(
          `All ${total} post${total !== 1 ? "s" : ""} downloaded`,
        ),
      );
    }
    actualBtn.disabled = true;
    if (pauseBtn) {
      pauseBtn.style.display = "inline-flex";
      pauseBtn.disabled = false;
      setButtonWithIcon(
        pauseBtn,
        isPausedAll ? "Resume" : "Pause",
        isPausedAll ? "play" : "pause",
      );
      pauseBtn.title = isPausedAll ? "Resume downloading" : "Pause downloading";
    }
    if (stopBtn) {
      stopBtn.style.display = "inline-flex";
      stopBtn.disabled = false;
    }
    syncPlaylistButton();
    return;
  }

  setButtonWithIcon(
    actualBtn,
    `Download ${total > 1 ? `all ${total}` : "1"} post${
      total !== 1 ? "s" : ""
    }`,
    "down",
  );
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
  if (AppState.debug.active)
    if (btn) {
      btn.innerText = text;
    } else {
      console.warn("Download All button not found in the DOM.");
    }
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
      downloadAllBtn.textContent = `Downloaded: ${done} of ${total} items discovered`;
    } else {
      downloadAllBtn.textContent = `Downloading item ${currentItem} of ${total} items discovered`;
    }
    downloadAllBtn.disabled = true;
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
    setButtonWithIcon(downloadAllBtn, "Nothing to download", "stop");
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
            ? `Downloading playlist ${done} of ${total} posts…`
            : `Playlist download complete (${total})`,
        ),
      );
      downloadAllBtn.disabled = true;
      if (pauseBtn) {
        pauseBtn.style.display = "inline-flex";
        pauseBtn.disabled = false;
        setButtonWithIcon(
          pauseBtn,
          AppState.downloading.pausedAll ? "Resume" : "Pause",
          AppState.downloading.pausedAll ? "play" : "pause",
        );
        pauseBtn.title = AppState.downloading.pausedAll
          ? "Resume downloading"
          : "Pause downloading";
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
          `Downloading ${done} of ${total} Post${total !== 1 ? "s" : ""}…`,
        ),
      );
      downloadAllBtn.disabled = true;
      if (pauseBtn) {
        pauseBtn.style.display = "inline-flex";
        pauseBtn.disabled = false;
        setButtonWithIcon(
          pauseBtn,
          AppState.downloading.pausedAll ? "Resume" : "Pause",
          AppState.downloading.pausedAll ? "play" : "pause",
        );
        pauseBtn.title = AppState.downloading.pausedAll
          ? "Resume downloading"
          : "Pause downloading";
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
          `Downloaded all ${total} Post${total !== 1 ? "s" : ""}`,
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
    setButtonWithIcon(
      downloadAllBtn,
      `Download ${total > 1 ? "All " + total : "1"} Post${
        total !== 1 ? "s" : ""
      }`,
      "down",
    );
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
        label: "Download in progress",
        icon: "hourglass",
        disabled: true,
      };
    }

    if (!total) {
      return {
        label: "Downloading Playlist…",
        icon: "hourglass",
        disabled: true,
      };
    }

    return {
      label:
        done < total ? `Downloading ${done}/${total}` : `Downloaded ${total}`,
      icon: done < total ? "hourglass" : "check",
      disabled: true,
    };
  }

  if (!total) {
    return {
      label: "Loading Playlist…",
      icon: "hourglass",
      disabled: true,
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

  if (
    pageInfo.playlistId &&
    !playlistLinks.length &&
    !AppState.playlist.isHydrating
  ) {
    // IMPORTANT: schedule on an animation frame, NOT a microtask.
    // ensurePlaylistLinksHydrated is async and may resolve instantly
    // (e.g. when no request URL exists yet). A .then() on a resolved
    // promise fires as a microtask — calling sync directly from that
    // creates an infinite microtask loop that freezes the tab.
    void ensurePlaylistLinksHydrated(pageInfo).then(() => {
      schedulePlaylistHeaderSync();
    });
  }

  let button = document.getElementById(PLAYLIST_HEADER_BUTTON_ID);
  if (!button) {
    button = document.createElement("button");
    button.id = PLAYLIST_HEADER_BUTTON_ID;
    button.type = "button";
    button.className = "ettpd-playlist-header-btn";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (AppState.downloading.isDownloadingAll) {
        return;
      }

      const playlistLinks = getCurrentPlaylistDirectLinks(
        getPlaylistButtonContext(),
      );
      if (!playlistLinks.length) {
        showToast(
          "Playlist still loading",
          "Wait a moment for the playlist posts to load, then try again.",
        );
        return;
      }

      await downloadAllLinks(button, {
        links: playlistLinks,
        batchType: "playlist",
      });
      displayFoundUrls({ forced: true });
      schedulePlaylistHeaderSync();
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
  button.disabled = state.disabled;
  button.dataset.playlistId = pageInfo.playlistId || "";
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
  btn.style.display = "none"; // Hidden by default, shown when there's a current item
  return btn;
}

function updateCurrentVideoButton(btn, items = []) {
  if (!btn) return;
  const currentVideoId = document.location.pathname.split("/")[3];
  const currentMedia = items.find(
    (media) => currentVideoId && media.videoId === currentVideoId,
  );

  if (!currentMedia) {
    // Hide the button when there's no current item
    btn.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Download Current";
    btn.onclick = () => {};
    return;
  }

  // Show the button when there's a current item
  btn.style.display = "block";

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
      const originalContent = btn.cloneNode(true);
      btn.textContent = "";
      const downloadingIcon = createIcon("hourglass", 16);
      downloadingIcon.style.marginRight = "4px";
      btn.appendChild(downloadingIcon);
      btn.appendChild(document.createTextNode("Downloading..."));
      try {
        await downloadSingleMedia(currentMedia);
        btn.textContent = "";
        const doneIcon = createIcon("check", 16);
        doneIcon.style.marginRight = "4px";
        btn.appendChild(doneIcon);
        btn.appendChild(document.createTextNode("Done!"));
      } catch (err) {
        console.warn("Download current failed", err);
        btn.textContent = "";
        const failedIcon = createIcon("error", 16);
        failedIcon.style.marginRight = "4px";
        btn.appendChild(failedIcon);
        btn.appendChild(document.createTextNode("Failed"));
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
  const discordUrl = "https://discord.gg/KpT7xdUUbM";
  const reportBugBtn = document.createElement("button");
  reportBugBtn.className = "ettpd-btn ettpd-report-bug";
  reportBugBtn.innerText = "Report Bugs (Quick fix: Refresh/Login/Logout😉)";

  const reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.rel = "noopener noreferrer";
  reportBugBtnLink.href = discordUrl;
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
        getUserRecommendationsCurrentTier,
      )}
      <div class="ettpd-stat-line-bottom" title="You're in a downloading mood 😏">📦 Fresh streak</div>
    `;
  } else {
    newHTML = `
      ${formatStatsLine(
        "Downloads this week",
        weeklyCount,
        "top",
        getUserDownloadsCurrentTier,
      )}
      ${formatStatsLine(
        "All time recommendations",
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
  const coffeeLink = document.createElement("a");
  coffeeLink.href = "https://linktr.ee/aimuhire";
  coffeeLink.target = "_blank";
  coffeeLink.rel = "noopener noreferrer";
  coffeeLink.textContent = "buy me a coffee ☕";
  coffeeLink.style.cssText = `
    color: inherit;
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
  };

  // Add Discord link (replaces "no refunds lol")
  const discordLink = document.createElement("a");
  discordLink.href = "https://discord.gg/KpT7xdUUbM";
  discordLink.target = "_blank";
  discordLink.rel = "noopener noreferrer";
  discordLink.title = "Join Our Discord";
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
  setButtonWithIcon(userPostsBtn, "Scrapper", "folder");
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
    "#" + DOM_IDS.DOWNLOAD_ALL_BUTTON,
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
    closeBtn,
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
          liveEmoji.title = "Currently playing video";
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
    liveEmoji.title = "Currently playing video";
    liveEmoji.className = "ettpd-emoji";
    liveEmoji.dataset.role = "current-video";
    const playIcon = createIcon("play", 14);
    liveEmoji.appendChild(playIcon);
    authorWrapper.appendChild(liveEmoji);
  }

  if (media?.downloaderHasLowConfidence) {
    const lowConfidenceEmoji = document.createElement("span");
    lowConfidenceEmoji.title = "Low confidence data";
    lowConfidenceEmoji.className = "ettpd-emoji";
    const infoIcon = createIcon("info", 14);
    lowConfidenceEmoji.appendChild(infoIcon);
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

  if (fullDesc.length > 100) {
    descSpan.classList.add("ettpd-desc-expandable");
    descSpan.style.cursor = "pointer";
    descSpan.title = "Click to expand/collapse";
  } else {
    descSpan.style.cursor = "default";
    descSpan.title = "Description";
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
    tiktokBtnContainer.title = "Open on TikTok";
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
    setButtonWithIcon(downloadAllBtn, "Download All Images", "down");
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

        const originalContent = downloadBtn.cloneNode(true);
        downloadBtn.textContent = "";
        const downloadingIcon3 = createIcon("hourglass", 16);
        downloadingIcon3.style.marginRight = "4px";
        downloadBtn.appendChild(downloadingIcon3);
        downloadBtn.appendChild(document.createTextNode("Downloading..."));

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
            downloadBtn.appendChild(document.createTextNode("Done!"));
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
            downloadBtn.appendChild(document.createTextNode("Failed!"));
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
    tiktokBtnContainer.title = "Open on TikTok";
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

      const originalContent2 = downloadBtn.cloneNode(true);
      downloadBtn.textContent = "";
      const downloadingIcon4 = createIcon("hourglass", 16);
      downloadingIcon4.style.marginRight = "4px";
      downloadBtn.appendChild(downloadingIcon4);
      downloadBtn.appendChild(document.createTextNode("Downloading..."));
      const delayBeforeStart = 600;
      const minDisplayAfter = 1000;
      const startedAt = Date.now();

      await new Promise((r) => setTimeout(r, delayBeforeStart));

      try {
        await downloadSingleMedia(media);

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minDisplayAfter - elapsed);

        setTimeout(() => {
          downloadBtn.textContent = "";
          const doneIcon4 = createIcon("check", 16);
          doneIcon4.style.marginRight = "4px";
          downloadBtn.appendChild(doneIcon4);
          downloadBtn.appendChild(document.createTextNode("Done!"));
          setTimeout(() => {
            downloadBtn.replaceWith(originalContent2.cloneNode(true));
          }, 3000);
        }, remaining);
      } catch (err) {
        console.error("Download failed:", err);
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minDisplayAfter - elapsed);

        setTimeout(() => {
          downloadBtn.textContent = "";
          const failedIcon4 = createIcon("error", 16);
          failedIcon4.style.marginRight = "4px";
          downloadBtn.appendChild(failedIcon4);
          downloadBtn.appendChild(document.createTextNode("Failed!"));
          setTimeout(() => {
            downloadBtn.replaceWith(originalContent2.cloneNode(true));
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

  // Start dragging
  handle.addEventListener("mousedown", (e) => {
    console.log(
      " AppState.ui.isDragging 12orubt mousedown",
      AppState.ui.isDragging,
    );

    AppState.ui.isDragging = true;
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
  document.addEventListener("mousemove", (e) => {
    if (
      localStorage.getItem(STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION) !==
      AppState.ui.live_ETTPD_CUSTOM_POS
    ) {
      // Persist location:
      AppState.ui.downloaderPositionType = "custom";
      localStorage.setItem(
        STORAGE_KEYS.DOWNLOADER_POSITION_TYPE,
        AppState.ui.downloaderPositionType,
      );
      localStorage.setItem(
        STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION,
        AppState.ui.live_ETTPD_CUSTOM_POS,
      );

      // Reset corner selector to "free" since user is now using custom positioning
      const wrapperEl = document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER);
      if (wrapperEl?._setCornerValue) {
        wrapperEl._setCornerValue("");
      }
    }

    if (!AppState.ui.isDragging) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const wrapperRect = wrapper.getBoundingClientRect();

    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Account for extended elements when constraining
    const headerExtension = 37;
    const footerExtension = 17;
    const minLeft = 0;
    const maxLeft = viewportWidth - wrapperRect.width;
    const minTop = headerExtension; // Ensure header doesn't go above viewport
    const maxTop = viewportHeight - wrapperRect.height - footerExtension; // Ensure footer doesn't go below viewport

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
  });

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
  document.addEventListener("mouseup", () => {
    AppState.ui.isDragging = false;
    document.body.style.userSelect = "";

    // Ensure final position is constrained
    constrainWrapperToViewport(wrapper);

    // Save final position if using custom position
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
  });

  // Store cleanup function on wrapper for later removal if needed
  wrapper._cleanupDraggable = () => {
    window.removeEventListener("resize", handleResize);
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
  showBtn.title = "Drag to move me anywhere";
  showBtn.setAttribute(
    "aria-label",
    "Open downloader (drag to move me anywhere)",
  );

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
  textSpan.textContent = "Open";
  showBtn.appendChild(textSpan);

  // Add Discord icon as a small clickable element
  const discordLink = document.createElement("a");
  discordLink.href = "https://discord.gg/KpT7xdUUbM";
  discordLink.target = "_blank";
  discordLink.rel = "noopener noreferrer";
  discordLink.title = "Join Our Discord";
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
            "Extension is disabled. Please enable it from the extension popup to use the downloader.",
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

  document.body?.appendChild(showBtn);
}

export function showRateUsPopUpLegacy() {
  if (!shouldShowRatePopupLegacy()) return;
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
    <h2 style="margin-bottom: 15px; font-size: 1.5em; color: #1da1f2;">Download Complete! 🎉</h2>
    <p style="margin-bottom: 20px; font-size: 1em; line-height: 1.5; color: #555555;">
      Your video has been successfully downloaded! 🎥<br>
      We'd love your support—rate us 5 ⭐ on ${escapeHtml(reviewTarget.storeLabel)} to help us grow! 🥰
    </p>
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
      Rate Now
    </a>
  </div>
`,
  );
  overlay.appendChild(box);

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
}

export function showStatsPopUp() {
  if (AppState.downloading.isDownloadingAll || AppState.downloading.isActive) {
    showToast(
      "Download in progress",
      "Wait for the download to be over or refresh 🙂",
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
    { key: "downloads", label: "Downloads", icon: "down" },
    { key: "recommendations", label: "Recommendations", icon: "star" },
  ];

  const tabButtons = tabs.map(({ key, label, icon }) => {
    const btn = document.createElement("button");
    btn.className = "ettpd-tab-btn";
    if (icon) {
      setButtonWithIcon(btn, label, icon);
    } else {
      btn.textContent = label;
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
      ? `<div class="ettpd-stats-banner">You peaked this week 😮‍💨</div>`
      : "";

    replaceElementHtml(
      content,
      `
    <div class="ettpd-summary-line black-text">
      You've ${
        tabKey === "downloads" ? "downloaded" : "been recommended"
      } <strong title="${totalCount.toLocaleString()}">${formatCompactNumberWithTooltip(
        totalCount,
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
  setButtonWithIcon(rateBtn, "Rate Us", "star");

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
      "⚠️ This will wipe your local leaderboard stats (downloads + recommendations). Nothing else will be touched. Want to proceed with the reset?",
    );
    if (!confirmed) return;

    const doubleCheck = confirm(
      "🚨 Just making sure — this can't be undone. All your leaderboard stats will be gone. Still want to do it?",
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

    showToast("Success", "✅ All leaderboard data has been reset.");
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
      : "ettpd-theme-classic",
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
  const reviewTarget = getExtensionReviewTarget();
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
          JSON.stringify(AppState.rateDonate),
        );
        overlay?.remove();
        if (typeof onClose === "function") onClose();
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
      JSON.stringify(AppState.rateDonate),
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
      : "ettpd-theme-classic",
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
  templateTitle.textContent = "Download Folder Templates";

  const templateHeroCopy = document.createElement("p");
  templateHeroCopy.className = "ettpd-template-hero-copy";
  templateHeroCopy.textContent =
    "Choose how your files are named and organized when they are saved.";

  templateHero.append(templateTitle, templateHeroCopy);

  const locationNote = document.createElement("div");
  locationNote.className = "ettpd-template-location";
  replaceElementHtml(
    locationNote,
    `
    <strong>Where files go</strong>
    <span>${
      AppState.downloadPreferences.showFolderPicker
        ? "Your browser can still ask where to save each file. This template controls the suggested folder path and filename."
        : "Files are saved inside your browser's default Downloads folder. This template controls the folders and filename inside that location."
    }</span>
    <span><strong>Name cleanup</strong>: if a folder or file segment would start with <code>.</code>, the downloader rewrites it so it stays visible and browser-safe. Example: <code>@.dernful</code> becomes <code>@_dernful</code>.</span>
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
        <p class="ettpd-template-subtitle">Templates build the relative path inside your Downloads folder. Use <code>{field}</code>, <code>{field|fallback}</code>, or <code>{field:maxLen|fallback}</code>.</p>
        <details class="ettpd-template-accordion">
          <summary class="ettpd-template-summary">Show examples and rules</summary>
          <ul class="ettpd-template-list">
            <li><strong>Save location</strong>: your files go to <code>Downloads/${DOWNLOAD_FOLDER_DEFAULT}/...</code> unless you changed your browser save location.</li>
            <li><strong>Extensions</strong>: auto-added (<code>.jpeg</code> / <code>.mp4</code>).</li>
            <li><strong>Numbering</strong>: <code>{sequenceNumber}</code> only on multi-image unless forced with <code>{sequenceNumber|required}</code>.</li>
            <li><strong>Length</strong>: trim with <code>{desc:40|no-desc}</code> or any field. Use negative numbers for last N chars: <code>{videoId:-4}</code> takes last 4 characters.</li>
            <li><strong>Paths</strong>: keep them relative; no leading <code>/</code> or <code>..</code>. If a filename would be invalid, the downloader cleans it automatically.</li>
            <li><strong>Leading dots</strong>: browsers can hide or reject dot-prefixed names, so <code>.name</code> is rewritten to <code>_name</code>. Example: <code>@.dernful</code> becomes <code>@_dernful</code>.</li>
            <li><strong>Ads & media</strong>: <code>{ad}</code> adds "ad"; <code>{mediaType}</code> is <em>image</em>/<em>video</em>.</li>
            <li><strong>Context</strong>: <code>{tabName}</code> follows the scrapper tab (Videos, Reposts, Liked, Favorited).</li>
          </ul>
        </details>
      `,
    },
    {
      key: "fields",
      label: "Supported fields",
      body: `
        <p class="ettpd-template-subtitle">These values can be used in folder names and file names.</p>
        <p><strong>Supported fields</strong></p>
        <code class="ettpd-template-code">${knownFields.join(", ")}</code>
        <div class="ettpd-template-grid">
          <div><strong>{videoId}</strong><span>Unique post ID</span></div>
          <div><strong>{authorUsername}</strong><span>@handle of the creator</span></div>
          <div><strong>{authorNickname}</strong><span>Display name when available</span></div>
          <div><strong>{desc}</strong><span>Caption or description text</span></div>
          <div><strong>{createTime}</strong><span>Original post timestamp</span></div>
          <div><strong>{downloadTime}</strong><span>When you downloaded it</span></div>
          <div><strong>{musicTitle}</strong><span>Track title</span></div>
          <div><strong>{musicAuthor}</strong><span>Track artist</span></div>
          <div><strong>{views}</strong><span>View count when available</span></div>
          <div><strong>{duration}</strong><span>Length in seconds</span></div>
          <div><strong>{hashtags}</strong><span>Hashtags with the # symbol</span></div>
          <div><strong>{sequenceNumber}</strong><span>Index for multi-asset posts</span></div>
          <div><strong>{ad}</strong><span>"ad" when marked as ad</span></div>
          <div><strong>{mediaType}</strong><span>image or video</span></div>
          <div><strong>{tabName}</strong><span>Videos, Reposts, Liked, or Favorited</span></div>
        </div>
      `,
    },
  ];

  const tabButtons = tabConfig.map((tab) => {
    const btn = document.createElement("button");
    btn.className = "ettpd-template-tab";
    btn.dataset.key = tab.key;
    btn.textContent = tab.label;
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
  };

  instructions.append(tabNav, tabContent);
  renderTab("guide");

  const pickerLabel = document.createElement("div");
  pickerLabel.className = "ettpd-template-section-label";
  pickerLabel.textContent =
    "Start from a built-in preset or one of your saved templates";

  const comboSelect = document.createElement("select");
  comboSelect.className = "ettpd-template-select";

  const appendTemplateOptions = (selectEl, activeLabel) => {
    selectEl.querySelectorAll("option").forEach((opt) => opt.remove());

    const placeholder = document.createElement("option");
    placeholder.text = "Choose a template or preset...";
    placeholder.value = "";
    selectEl.appendChild(placeholder);

    getSavedTemplates().forEach((template, index) => {
      const opt = document.createElement("option");
      opt.value = `user-${index}`;
      opt.text =
        template.label === activeLabel
          ? `(Active) ${template.label}`
          : template.label;
      if (template.label === activeLabel) opt.selected = true;
      selectEl.appendChild(opt);
    });

    if (presetTemplates.length) {
      const sep = document.createElement("option");
      sep.text = "-- Presets --";
      sep.disabled = true;
      selectEl.appendChild(sep);

      presetTemplates.forEach((template, index) => {
        const opt = document.createElement("option");
        opt.value = `preset-${index}`;
        opt.text =
          template.label === activeLabel
            ? `(Active) ${template.label}`
            : template.label;
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
  labelInput.placeholder = "Template label shown in the list";
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
    activeFullPathTemplate.textContent = `Currently in use: ${savedLabel}`;
  }

  const presetExample = document.createElement("code");
  presetExample.className = "ettpd-template-example";

  const saveBtn = document.createElement("button");
  saveBtn.className = "ettpd-pref-btn";
  saveBtn.textContent = "Save & Apply";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "ettpd-pref-btn danger";
  setButtonWithIcon(deleteBtn, "Delete Template", "delete");
  deleteBtn.style = "margin-right:15px;";
  deleteBtn.disabled = !savedLabel;

  const sanitize = (val) =>
    (val ?? "")
      .toString()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .slice(0, 100);

  const validatePathTemplate = (tpl) => {
    const errs = [];
    if (tpl.startsWith("/") && !tpl.startsWith("@/@")) {
      errs.push("Path must be relative (no leading / or drive letters)");
    }
    if (/\.\.|^[a-zA-Z]:/.test(tpl)) {
      errs.push("No '..' or drive letters allowed");
    }
    const tokenRe = /\{(\w+)(\|[^}]+)?\}/g;
    let match;
    while ((match = tokenRe.exec(tpl))) {
      if (!knownFields.includes(match[1])) {
        errs.push(`Unknown field: ${match[1]}`);
      }
    }
    return errs;
  };

  function renderPreviewAndErrors() {
    const tpl = inputPathTemplate.value.trim();
    const errors = validatePathTemplate(tpl);

    if (!tpl) {
      error.textContent = "";
      preview.textContent =
        "Add a relative path template to preview where files will land inside Downloads.";
      return;
    }

    if (errors.length) {
      error.textContent = "";
      const warningIcon = createIcon("warning", 16);
      warningIcon.style.marginRight = "4px";
      error.appendChild(warningIcon);
      error.appendChild(document.createTextNode(errors.join("; ")));
      preview.textContent = "";
      return;
    }

    error.textContent = "";

    const sample = {
      videoId: "7557564294825626893",
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

    const sanitizeDesc = (val, maxLen = 100) => {
      const str = (val ?? "").toString();
      const sanitized = str.replace(/[^\p{L}\p{N}_\-.#]+/gu, "-");
      return sanitized.length > maxLen ? sanitized.slice(0, maxLen) : sanitized;
    };

    const sanitizeHashtag = (val) => {
      const str = (val ?? "").toString();
      const sanitized = str
        .split("")
        .map((char) => {
          if (/[\p{L}\p{N}_\-.]/u.test(char) || char === "#") {
            return char;
          }
          return "-";
        })
        .join("")
        .replace(/-+/g, "-");
      return sanitized.slice(0, 100);
    };

    const getFieldMaxLength = (fieldName) => {
      const regex = new RegExp(`\\{${fieldName}:(-?\\d+)`);
      const match = tpl.match(regex);
      return match ? Number(match[1]) : undefined;
    };

    const sequenceNumber = 4;
    const isMultiImage = sample.imagePostImages?.length > 1;
    const descMaxLen = getFieldMaxLength("desc");
    const isDescMaxLenDefined = descMaxLen !== undefined;

    const fieldValues = {
      videoId: sanitize(sample.videoId),
      authorUsername: sanitize(sample.authorUsername),
      authorNickname: sanitize(sample.authorNickname),
      desc: sanitizeDesc(
        sample.desc,
        isDescMaxLenDefined ? (descMaxLen > 0 ? descMaxLen : 100) : 100,
      ),
      createTime: sample.createTime,
      musicTitle: sanitize(sample.musicTitle),
      musicAuthor: sanitize(sample.musicAuthor),
      views: sanitize(sample.views),
      duration: sanitize(sample.duration),
      hashtags: (sample.hashtags || [])
        .map((tag) => {
          const tagName = tag.name || tag;
          const prefixedTag = tagName.startsWith("#") ? tagName : `#${tagName}`;
          return sanitizeHashtag(prefixedTag);
        })
        .join(""),
      tabName: sample.tabName,
      downloadTime: sample.downloadTime,
      isAd: sample.isAd,
      isImage: sample.isImage,
    };

    const previewTemplate = tpl.startsWith("@/")
      ? `${DOWNLOAD_FOLDER_DEFAULT}${tpl.slice(1)}`
      : tpl;
    const replaced = applyTemplate(previewTemplate, fieldValues, {
      sequenceNumber,
      isMultiImage,
      collectionName: "sample-collection",
    });
    const cleaned = cleanupPath(replaced);
    preview.textContent = `Preview in Downloads: ${cleaned}.mp4`;
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
    activeFullPathTemplate.textContent = `Selected template: ${selected.label}`;
    presetExample.textContent = selected.example
      ? `Preset example: ${selected.example}`
      : "";

    renderPreviewAndErrors();
  };

  renderPreviewAndErrors();

  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "ettpd-reset-feedback";
  feedbackContainer.style.textAlign = "center";

  function showFeedback(text) {
    replaceElementHtml(feedbackContainer, "<span>Applying...</span>");
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
      showToast("Error", "Fix errors before saving.");
      return;
    }
    if (!labelInput.value.trim()) {
      showToast("Error", "Please enter a name.");
      return;
    }

    const trimmedLabel = labelInput.value.trim();
    const recommendedTemplate = getRecommendedPresetTemplate();

    if (recommendedTemplate && trimmedLabel === recommendedTemplate.label) {
      showToast(
        "⚠️ Template Name Warning",
        `The name "${trimmedLabel}" will be automatically updated on next reload. Please rename your template to avoid automatic overrides.`,
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
    activeFullPathTemplate.textContent = `Now using: ${newTemplate.label}`;
    presetExample.textContent = "";
    deleteBtn.disabled = false;

    appendTemplateOptions(comboSelect, newTemplate.label);
    await showFeedback("✅ Template saved and applied!");
  };

  deleteBtn.onclick = async () => {
    const value = comboSelect.value;
    if (!value) {
      showToast("Error", "Select a user template to delete.");
      return;
    }
    const [type, indexStr] = value.split("-");
    const index = Number.parseInt(indexStr, 10);
    if (type !== "user") {
      showToast("Error", "Cannot delete built-in presets.");
      return;
    }

    const currentTemplates = getSavedTemplates();
    const removed = currentTemplates.splice(index, 1)[0];
    if (!removed) {
      showToast("Error", "That template could not be found.");
      return;
    }

    saveTemplates(currentTemplates);
    labelInput.value = "";
    inputPathTemplate.value = "";
    activeFullPathTemplate.textContent = "";
    presetExample.textContent = "";
    comboSelect.value = "";
    deleteBtn.disabled = true;
    appendTemplateOptions(comboSelect, "");
    renderPreviewAndErrors();
    await showFeedback(`🗑️ Deleted template '${removed.label}'.`);
  };

  const inputsLabel = document.createElement("span");
  inputsLabel.className = "ettpd-template-section-label";
  inputsLabel.textContent = "Edit the template label and relative save path";

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

  createModal({
    children: [layout],
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
  btnContainer.className = "ettpd-options-buttons";

  // 🔄 Reset Downloader button
  const resetBtn = document.createElement("button");
  resetBtn.className = "ettpd-pref-btn danger";
  setButtonWithIcon(resetBtn, "Factory Reset", "refresh");
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
      showToast(
        "Download in progress",
        "Please wait for the download to be over or refresh!",
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
      "🔄 All set!",
      "The download list now shows only the posts visible on the main screen — nothing from the sidebar.<br><br>💡 <b>Tip:</b> To scrape this page, scroll all the way down, then click <b>Download All</b> once you're happy with your list.",
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
  advancedLabel.textContent = "Downloader Preferences:";

  const skipFailedCheckbox = createCheckbox(
    "Skip Failed Downloads",
    "skipFailedDownloads",
    () => {
      AppState.downloadPreferences.skipFailedDownloads =
        !AppState.downloadPreferences.skipFailedDownloads;
    },
    AppState.downloadPreferences.skipFailedDownloads,
  );
  const skipAdsCheckbox = createCheckbox(
    "Skip Ads",
    "skipAds",
    () => {
      AppState.downloadPreferences.skipAds =
        !AppState.downloadPreferences.skipAds;
    },
    AppState.downloadPreferences.skipAds,
    "Will not download ads, buy you will still see ads.",
  );
  const includeCSVFile = createCheckbox(
    "Include CSV File",
    "includeCSV",
    () => {
      AppState.downloadPreferences.includeCSV =
        !AppState.downloadPreferences.includeCSV;
    },
    AppState.downloadPreferences.includeCSV,
  );

  const disableConfetti = createCheckbox(
    "Hide Confetti 🎉",
    "disableConfetti",
    () => {
      AppState.downloadPreferences.disableConfetti =
        !AppState.downloadPreferences.disableConfetti;
      localStorage.setItem(
        STORAGE_KEYS.DISABLE_CELEBRATION_CONFETTI,
        AppState.downloadPreferences.disableConfetti,
      );
    },
    AppState.downloadPreferences.disableConfetti,
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
          replaceElementHtml(
            message,
            "⚠️ <b>Disable Extension?</b><br><br>" +
              "The extension will be completely disabled. No scripts will run, no polling will occur, and no downloads will be processed.<br><br>" +
              "To re-enable, click the extension icon and select 'Turn On'.",
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

            showFeedback(
              "Extension disabled. Reloading the page to stop the downloader...",
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
          "Extension enabled. Reload the page for changes to take effect.",
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
    replaceElementHtml(feedbackContainer, "<span>Applying...</span>");
    preferencesBox.appendChild(feedbackContainer);
    // Then show the actual message after displayFoundUrls finishes
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        replaceElementHtml(
          feedbackContainer,
          `<span>${escapeHtml(text)}</span>`,
        );
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
      showFeedback(`${label} saved!`);
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

    // Self-updating label that polls state every 2 seconds
    let intervalId = null;
    const updateLabel = () => {
      const isAvailable = !listScrollingCompleted() || canClickNextButton();
      label.textContent = `Auto Scroll Mode (${isAvailable ? "Available" : "Unavailable"})`;
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
      { value: "onVideoEnd", label: "On Video End", icon: "repost" },
      { value: "always", label: "Anytime (Load More)", icon: "refresh" },
      { value: "off", label: "Off", icon: "stop" },
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
        `Auto Scroll Mode set to "${e.target.selectedOptions[0].text}"`,
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
    advancedLabel,
    skipFailedCheckbox,
    skipAdsCheckbox,
    includeCSVFile,
    disableConfetti,
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
  setButtonWithIcon(settingsBtn, "Settings", "settings");
  settingsBtn.title = "Click to toggle settings";
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

  document.querySelectorAll(".download-btn-container").forEach((el) => {
    const hasActiveButton = activeId
      ? el.querySelector(`button.download-btn.${CSS.escape(activeId)}`)
      : null;

    const isInsideActiveHoverSelection = isInsideActiveHoverSelectionRoot(el);

    if (hasActiveButton || isInsideActiveHoverSelection) {
      console.log("✅ Skipping active download-btn-container", el);
      return;
    }

    console.log("🧹 Removing download-btn-container", el);
    el.remove();
  });
}

function isInsideActiveHoverSelectionRoot(container) {
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
    replaceElementHtml(btn, buildDefaultMarkup());
  };
  resetButtonToDefault();

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

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
        "Save Failed",
        "This video source is not ready yet. Try again in a moment.",
      );
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
        }),
        {
          getFreshUrl: async ({ url, error, attempt }) => {
            const staleBlobError =
              typeof url === "string" &&
              /^blob:/i.test(url) &&
              (error?.code === "ERR_BLOB_FETCH" ||
                /Failed to fetch|ERR_FILE_NOT_FOUND/i.test(
                  error?.message || "",
                ));

            if (!staleBlobError) {
              return null;
            }

            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(150 * attempt, 500)),
            );

            const nextTarget = resolveDownloadTarget();
            const nextSrc = nextTarget.src;

            if (AppState.debug.active) {
              console.warn("IMAGES_DL 🔄 Retrying stale blob source", {
                videoId,
                from,
                attempt,
                previousSrc: typeof url === "string" ? url.slice(0, 96) : url,
                nextSrc:
                  typeof nextSrc === "string" ? nextSrc.slice(0, 96) : nextSrc,
                changed: nextSrc !== url,
              });
            }

            if (
              typeof nextSrc === "string" &&
              /^(https?:|blob:)/.test(nextSrc)
            ) {
              resolvedTarget = nextTarget;
              return nextSrc;
            }

            return null;
          },
        },
      );
      btn.textContent = "";
      const savedIcon = createIcon("check", 16);
      savedIcon.style.marginRight = "4px";
      btn.appendChild(savedIcon);
      btn.appendChild(document.createTextNode("Saved"));
      showCelebration(
        "downloads",
        getRandomDownloadSuccessMessage(isImage ? "photo" : "video"),
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
    if (m && !item.querySelector("button.download-btn")) {
      createExploreDownloadButton(item, m[1]);
    }
  });
}

function injectFeedWrapperDownloadButtons() {
  document.querySelectorAll("div[id^='xgwrapper-']").forEach((wrapper) => {
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
      button.closest(".download-btn-container")?.remove();
    });
}

function removeAllInjectedDownloadButtons(item) {
  item
    ?.querySelectorAll(".download-btn-container, .photo-download-btn-container")
    .forEach((container) => {
      container.remove();
    });
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

  if (parentEl.querySelector(`button.download-btn.${CSS.escape(videoId)}`)) {
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
      ?.getAttribute("data-swiper-slide-index") || "0",
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
      ".photo-download-btn-container, .download-btn-container",
    ),
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
      "Resume Failed",
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
    showToast("Resume Failed", "Failed to start download process.");
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
