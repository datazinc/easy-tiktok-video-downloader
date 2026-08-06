// handlers.js
import AppState from "../state/state.js";
import {
  displayFoundUrls,
  getBestVideoRendition,
  getCurrentPageUsername,
  isOnProfileOrCollectionPage,
} from "../utils/utils.js";

// ———————————————————————————————————————
// Helpers
// ———————————————————————————————————————
const normId = (it) => String(it?.id ?? it?.videoId ?? "");
const isFull = (it) => !!(it && !it.downloaderHasLowConfidence);
const hasPlay = (it) => !!(it?.video?.playAddr || it?.url);

let cachedUniversalDataText = null;
let cachedUniversalScope = null;

function getUniversalDataScope() {
  const runtimeScope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
  const script = document.getElementById(
    "__UNIVERSAL_DATA_FOR_REHYDRATION__",
  );
  const scriptText = script?.textContent || "";

  if (scriptText && scriptText !== cachedUniversalDataText) {
    cachedUniversalDataText = scriptText;
    try {
      cachedUniversalScope = JSON.parse(scriptText)?.__DEFAULT_SCOPE__ || null;
    } catch (error) {
      cachedUniversalScope = null;
      if (AppState.debug.active) {
        console.warn("Failed to parse TikTok universal video data", error);
      }
    }
  }

  const mergedScope = {
    ...(cachedUniversalScope || {}),
    ...(runtimeScope || {}),
  };
  const inlineVideoDetail = cachedUniversalScope?.["webapp.video-detail"];
  const runtimeVideoDetail = runtimeScope?.["webapp.video-detail"];
  const inlineItem = inlineVideoDetail?.itemInfo?.itemStruct;
  const runtimeItem = runtimeVideoDetail?.itemInfo?.itemStruct;
  const getItemRichness = (item) =>
    (item?.video?.bitrateInfo?.length || 0) * 10 +
    (item?.video?.PlayAddrStruct?.UrlList?.length || 0) +
    (item?.video?.playAddr ? 1 : 0);

  if (getItemRichness(inlineItem) > getItemRichness(runtimeItem)) {
    mergedScope["webapp.video-detail"] = inlineVideoDetail;
  }

  return mergedScope;
}

function compareVideoQuality(left, right) {
  const leftRendition = getBestVideoRendition(left?.video);
  const rightRendition = getBestVideoRendition(right?.video);
  const getQuality = (rendition) => {
    const width = Number(rendition?.width) || 0;
    const height = Number(rendition?.height) || 0;
    return [
      width && height ? Math.min(width, height) : 0,
      width * height,
      Number(rendition?.bitrate) || 0,
    ];
  };
  const leftQuality = getQuality(leftRendition);
  const rightQuality = getQuality(rightRendition);

  for (let index = 0; index < leftQuality.length; index += 1) {
    if (leftQuality[index] !== rightQuality[index]) {
      return leftQuality[index] - rightQuality[index];
    }
  }

  return 0;
}

/** Return true if `next` is a better copy than `curr` */
function isBetterCopy(next, curr) {
  if (!curr) return true; // brand new
  if (isFull(next) && !isFull(curr)) return true; // full beats stub
  if (!isFull(next) && isFull(curr)) return false;
  // prefer one that actually has a playable URL
  if (hasPlay(next) && !hasPlay(curr)) return true;
  if (!hasPlay(next) && hasPlay(curr)) return false;
  if (compareVideoQuality(next, curr) > 0) return true;
  // otherwise keep existing (stable)
  return false;
}

// Keep your existing name, but make it robust
export function isVisitedItemBetterOrNew(it) {
  if (AppState.debug.active) {
    console.log("CHECKING_NEW_ITEM", it.author, it.downloaderHasLowConfidence);
  }
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
    const scope = getUniversalDataScope();
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
