// progress.js
// Storage helper functions for tracking downloaded videoIds by username and tab
// NOTE: This runs in page context (injected script), so we MUST use chrome.runtime.sendMessage
// to communicate with background script which has access to IndexedDB (ettvd-data)

let progressCache = null;
let progressCacheLastLoadedAt = 0;

/**
 * Send message via window.postMessage to content script (bridge to background)
 * This is needed because we're in page context, not extension context
 */
function sendProgressMessage(action, data) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random()}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Progress message timeout"));
    }, 10000);

    function handler(event) {
      if (event.source !== window) return;
      const response = event.data;
      if (
        response?.type === `PROGRESS_RESPONSE_${action}` &&
        response?.id === id
      ) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        if (response.success === false) {
          reject(new Error(response.error || "Unknown error"));
        } else {
          resolve(response);
        }
      }
    }

    window.addEventListener("message", handler);
    window.postMessage(
      {
        type: `PROGRESS_REQUEST_${action}`,
        id,
        data,
      },
      "*"
    );
  });
}

/**
 * Load the entire progress object from background script's IndexedDB
 * Background script uses IndexedDB (ettvd-data), not localStorage
 * We're in page context, so we use window.postMessage to communicate with content script
 * @returns {Promise<Object>} The progress object
 */
export async function loadProgressObject() {
  try {
    const resp = await sendProgressMessage("GET", null);
    const progress = resp.progress || {};
    progressCache = progress;
    progressCacheLastLoadedAt = Date.now();
    console.log(
      "[Progress Storage] ✅ Loaded from background (IndexedDB):",
      Object.keys(progress).length,
      progress,
      "users"
    );
    return progress;
  } catch (err) {
    console.error("[Progress Storage] Failed to load progress:", err);
    return {};
  }
}

/**
 * Save the entire progress object to background script's IndexedDB
 * We're in page context, so we use window.postMessage to communicate with content script
 * @param {Object} progress - The progress object to save
 */
async function saveProgressObject(progress) {
  try {
    const resp = await sendProgressMessage("SET", { progress });
    console.log(
      "[Progress Storage] ✅ Saved progress to background (IndexedDB):",
      Object.keys(progress).length,
      "users"
    );
    progressCache = progress;
    progressCacheLastLoadedAt = Date.now();
  } catch (err) {
    console.error("[Progress Storage] Failed to save progress:", err);
    throw err; // Re-throw so caller knows it failed
  }
}

/**
 * Normalize username to lowercase for consistent storage
 * @param {string} username - Username to normalize
 * @returns {string} Normalized username
 */
function normalizeUsername(username) {
  if (!username || typeof username !== "string") return "";
  return username.toLowerCase().trim();
}

/**
 * Build videoId key (videoId or videoId:sequence for images)
 * @param {string} videoId - The video ID
 * @param {number|null} imageIndex - Image index (0-based) or null for videos
 * @returns {string} The key to store
 */
function buildVideoIdKey(videoId, imageIndex = null) {
  if (!videoId) return "";
  if (imageIndex !== null && imageIndex !== undefined) {
    const sequenceNumber = imageIndex + 1; // Convert to 1-based
    return `${videoId}:${sequenceNumber}`;
  }
  return videoId;
}

/**
 * Load progress for a specific username and tab
 * @param {string} username - The username
 * @param {string} tabName - The tab name (videos, reposts, liked, favorites, collection)
 * @returns {Promise<string[]>} Array of videoIds (or videoId:sequence for images)
 */
export async function loadProgress(username, tabName) {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !tabName) return [];

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    return progress[normalizedUsername]?.[tabName] || [];
  } catch (err) {
    console.warn("[Progress Storage] Failed to load progress:", err);
    return [];
  }
}

/**
 * Get collection URL for a specific username and tab
 * @param {string} username - The username
 * @param {string} tabName - The tab name (collection name)
 * @returns {Promise<string|null>} Collection URL path or null if not found
 */
export async function getCollectionUrl(username, tabName) {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !tabName) return null;

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    const metadataKey = `_${tabName}_url`;
    return progress[normalizedUsername]?._metadata?.[metadataKey] || null;
  } catch (err) {
    console.warn("[Progress Storage] Failed to get collection URL:", err);
    return null;
  }
}

/**
 * Save progress for a specific username and tab (replaces existing)
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 * @param {string[]} videoIdsArray - Array of videoIds to save
 * @param {string} collectionUrl - Optional collection URL path (for collections only)
 */
export async function saveProgress(
  username,
  tabName,
  videoIdsArray,
  collectionUrl = null
) {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !tabName) return;

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    if (!progress[normalizedUsername]) {
      progress[normalizedUsername] = {};
    }
    progress[normalizedUsername][tabName] = Array.isArray(videoIdsArray)
      ? videoIdsArray
      : [];

    // Store collection URL metadata if provided
    if (collectionUrl) {
      const metadataKey = `_${tabName}_url`;
      if (!progress[normalizedUsername]._metadata) {
        progress[normalizedUsername]._metadata = {};
      }
      progress[normalizedUsername]._metadata[metadataKey] = collectionUrl;
    }

    await saveProgressObject(progress);
  } catch (err) {
    console.warn("[Progress Storage] Failed to save progress:", err);
  }
}

/**
 * Append a videoId to the progress for a username/tab (only if not already present)
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 * @param {string} videoId - The video ID
 * @param {number|null} imageIndex - Image index (0-based) or null for videos
 */
export async function appendVideoId(
  username,
  tabName,
  videoId,
  imageIndex = null
) {
  try {
    console.log("[Progress Tracking] appendVideoId called:", {
      username,
      tabName,
      videoId,
      imageIndex,
    });

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !tabName || !videoId) {
      console.warn("[Progress Tracking] Missing required params:", {
        normalizedUsername,
        tabName,
        videoId,
      });
      return;
    }

    const key = buildVideoIdKey(videoId, imageIndex);
    if (!key) {
      console.warn("[Progress Tracking] Failed to build key from:", {
        videoId,
        imageIndex,
      });
      return;
    }

    console.log("[Progress Tracking] Built key:", key);

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    if (!progress[normalizedUsername]) {
      progress[normalizedUsername] = {};
      console.log(
        "[Progress Tracking] Created new user entry:",
        normalizedUsername
      );
    }
    if (!progress[normalizedUsername][tabName]) {
      progress[normalizedUsername][tabName] = [];
      console.log("[Progress Tracking] Created new tab entry:", tabName);
    }

    // Only add if not already present
    if (!progress[normalizedUsername][tabName].includes(key)) {
      progress[normalizedUsername][tabName].push(key);
      console.log("[Progress Tracking] Added videoId to progress:", {
        username: normalizedUsername,
        tabName,
        key,
        totalCount: progress[normalizedUsername][tabName].length,
      });
      await saveProgressObject(progress);
      // Update cache immediately so subsequent checks see the new entry
      progressCache = progress;
      progressCacheLastLoadedAt = Date.now();
    } else {
      console.log("[Progress Tracking] VideoId already exists, skipping:", key);
      // Still update cache to ensure it's fresh
      progressCache = progress;
      progressCacheLastLoadedAt = Date.now();
    }
  } catch (err) {
    console.warn("[Progress Storage] Failed to append videoId:", err);
  }
}

/**
 * Check if a videoId exists in a cached progress object (no IndexedDB call)
 * @param {Object} cachedProgress - Cached progress object
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 * @param {string} videoId - The video ID
 * @param {number|null} imageIndex - Image index (0-based) or null for videos
 * @returns {boolean} True if videoId exists
 */
export function hasVideoIdInCache(
  cachedProgress,
  username,
  tabName,
  videoId,
  imageIndex = null
) {
  try {
    const normalizedUsername = normalizeUsername(username);
    const cache = cachedProgress || progressCache;
    if (!normalizedUsername || !tabName || !videoId || !cache) return false;

    const key = buildVideoIdKey(videoId, imageIndex);
    if (!key) return false;

    const list = cache[normalizedUsername]?.[tabName] || [];
    return list.includes(key);
  } catch (err) {
    console.warn("[Progress Storage] Failed to check videoId in cache:", err);
    return false;
  }
}

/**
 * Check if a videoId exists in progress for a username/tab
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 * @param {string} videoId - The video ID
 * @param {number|null} imageIndex - Image index (0-based) or null for videos
 * @returns {Promise<boolean>} True if videoId exists
 */
export async function hasVideoId(
  username,
  tabName,
  videoId,
  imageIndex = null
) {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !tabName || !videoId) return false;

    const key = buildVideoIdKey(videoId, imageIndex);
    if (!key) return false;

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    const list = progress[normalizedUsername]?.[tabName] || [];
    return list.includes(key);
  } catch (err) {
    console.warn("[Progress Storage] Failed to check videoId:", err);
    return false;
  }
}

/**
 * Clear all progress for a specific username
 * @param {string} username - The username
 */
export async function clearUser(username) {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return;

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    if (progress[normalizedUsername]) {
      delete progress[normalizedUsername];
      await saveProgressObject(progress);
    }
  } catch (err) {
    console.warn("[Progress Storage] Failed to clear user:", err);
  }
}

/**
 * Clear progress for a specific username and tab
 * @param {string} username - The username
 * @param {string} tabName - The tab name
 */
export async function clearTab(username, tabName) {
  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !tabName) return;

    const progress =
      progressCache && progressCacheLastLoadedAt
        ? progressCache
        : await loadProgressObject();
    if (progress[normalizedUsername]?.[tabName]) {
      delete progress[normalizedUsername][tabName];
      await saveProgressObject(progress);
    }
  } catch (err) {
    console.warn("[Progress Storage] Failed to clear tab:", err);
  }
}

/**
 * Get all progress data (for UI display)
 * @returns {Promise<Object>} The entire progress object
 */
export async function getAllProgress() {
  try {
    return await loadProgressObject();
  } catch (err) {
    console.warn("[Progress Storage] Failed to get all progress:", err);
    return {};
  }
}

/**
 * Clear all progress data from IndexedDB via background script
 */
export async function clearAllProgress() {
  try {
    await sendProgressMessage("CLEAR", null);
    progressCache = {};
    progressCacheLastLoadedAt = Date.now();
    console.log("[Progress Storage] ✅ Cleared all progress from IndexedDB");
  } catch (err) {
    console.error("[Progress Storage] Failed to clear all progress:", err);
  }
}
