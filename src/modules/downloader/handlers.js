// handlers.js
import AppState from "../state/state.js";
import {
  displayFoundUrls,
  getCurrentPageUsername,
  isOnProfileOrCollectionPage,
} from "../utils/utils.js";

// ———————————————————————————————————————
// Helpers
// ———————————————————————————————————————
const normId = (it) => String(it?.id ?? it?.videoId ?? "");
const isFull = (it) => !!(it && !it.downloaderHasLowConfidence);
const hasPlay = (it) => !!(it?.video?.playAddr || it?.url);

/** Return true if `next` is a better copy than `curr` */
function isBetterCopy(next, curr) {
  if (!curr) return true; // brand new
  if (isFull(next) && !isFull(curr)) return true; // full beats stub
  if (!isFull(next) && isFull(curr)) return false;
  // prefer one that actually has a playable URL
  if (hasPlay(next) && !hasPlay(curr)) return true;
  if (!hasPlay(next) && hasPlay(curr)) return false;
  // otherwise keep existing (stable)
  return false;
}

// Keep your existing name, but make it robust
export function isVisitedItemBetterOrNew(it) {
  console.log("CHECKING_NEW_ITEM", it.author, it.downloaderHasLowConfidence);
  const id = normId(it);
  if (!id) return false;
  const curr = AppState.allItemsEverSeen[id];
  return isBetterCopy(it, curr);
}

// ———————————————————————————————————————
// Main: update allItemsEverSeen, then rebuild buckets from it
// ———————————————————————————————————————
export function handleFoundItems(newItems) {
  try {
    if (!Array.isArray(newItems) || newItems.length === 0) return;

    let changed = false;

    // 1) Update source of truth with the best copy we've seen
    for (const it of newItems) {
      const id = normId(it);
      if (!id) continue;
      if (isVisitedItemBetterOrNew(it)) {
        AppState.allItemsEverSeen[id] = it;
        changed = true;
      }
    }

    // Opportunistically fold in video-detail + updated-items if present
    const scope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
    const struct = scope?.["webapp.video-detail"]?.itemInfo?.itemStruct;
    if (normId(struct)) {
      const id = normId(struct);
      if (isBetterCopy(struct, AppState.allItemsEverSeen[id])) {
        AppState.allItemsEverSeen[id] = struct;
        changed = true;
      }
    }
    const updatedItems = scope?.["webapp.updated-items"] || [];
    for (const it of updatedItems) {
      const id = normId(it);
      if (!id) continue;
      if (isBetterCopy(it, AppState.allItemsEverSeen[id])) {
        AppState.allItemsEverSeen[id] = it;
        changed = true;
      }
    }

    if (!changed) {
      // Nothing improved; still might need to show found URLs for first-time UI
      displayFoundUrls({ forced: false });
      return;
    }
    // 4) Refresh UI
    displayFoundUrls({ forced: true });
  } catch (err) {
    if (AppState.debug.active) console.warn("handleFoundItems error", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  displayFoundUrls({ forced: true });
});

window.ettpd__handleFoundItems = handleFoundItems;

// ———————————————————————————————————————
// Resume Download Handler
// ———————————————————————————————————————
/**
 * Handle resume download request from popup
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 * @param {boolean} isCollection - Whether this is a collection tab
 * @returns {Object} Result with success status and any error message
 */
export function handleResumeDownload(username, tabName, isCollection) {
  try {
    // Get current page info
    const pageInfo = isOnProfileOrCollectionPage();
    const currentUsername = getCurrentPageUsername();

    // Verify we're on the correct profile
    if (currentUsername !== username && currentUsername !== "😃") {
      return {
        success: false,
        error: `Wrong profile page. Current: ${currentUsername}, Expected: ${username}`,
        needsNavigation: true,
      };
    }

    // Determine the tab key
    let tabKey = tabName;
    let collectionName = null;
    if (isCollection) {
      tabKey = "collection";
      // Try to find the collection name from the page
      if (pageInfo.isCollection && pageInfo.collectionName) {
        collectionName = pageInfo.collectionName;
        AppState.scrapperDetails.selectedCollectionName = collectionName;
      } else {
        // Use the tabName as collection name if we can't detect it
        collectionName = tabName;
        AppState.scrapperDetails.selectedCollectionName = tabName;
      }
    }

    return {
      success: true,
      tabKey,
      pageInfo,
      collectionName,
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "Unknown error",
    };
  }
}
