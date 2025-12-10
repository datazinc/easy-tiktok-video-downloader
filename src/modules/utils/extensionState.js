// extensionState.js
// Utility functions for managing extension enabled/disabled state using chrome.storage
// This ensures state is shared between content scripts and popup

const EXTENSION_ENABLED_KEY = "tik.tok::extensionEnabled";

const normalize = (val) => !(val === "false" || val === false);

/**
 * Get extension enabled state from chrome.storage
 * Falls back to localStorage if chrome.storage is not available
 * @returns {Promise<boolean>}
 */
export async function isExtensionEnabled() {
  // Prefer an explicit localStorage "false" (content scripts can set this immediately)
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === "false") return false;
  } catch {}

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([EXTENSION_ENABLED_KEY], (items) => {
          if (chrome.runtime.lastError) {
            console.warn("Error reading extension state:", chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(items[EXTENSION_ENABLED_KEY]);
          }
        });
      });
      // If not set in chrome.storage, fall back to localStorage before defaulting
      if (result == null) {
        const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
        if (stored != null) return normalize(stored);
        return true;
      }
      return normalize(result);
    }
  } catch (err) {
    console.warn("Failed to read from chrome.storage:", err);
  }

  // Fallback to localStorage (for content scripts on the page)
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === null) return true;
    return normalize(stored);
  } catch (err) {
    console.warn("Failed to read from localStorage:", err);
    return true; // Default to enabled
  }
}

/**
 * Set extension enabled state in chrome.storage
 * Also syncs to localStorage for content scripts
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export async function setExtensionEnabled(enabled) {
  const storageValue = enabled ? "true" : "false";

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [EXTENSION_ENABLED_KEY]: storageValue }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  } catch (err) {
    console.warn("Failed to write to chrome.storage:", err);
  }

  // Also sync to localStorage for content scripts
  try {
    localStorage.setItem(EXTENSION_ENABLED_KEY, storageValue);
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }
}

/**
 * Synchronous version for immediate checks (uses localStorage as fallback)
 * Use this only when you need immediate synchronous access
 * @returns {boolean}
 */
export function isExtensionEnabledSync() {
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === "false") return false;
  } catch {}

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      // For sync access, we can't use chrome.storage, so fall back to localStorage
      // This is mainly for content scripts that need immediate checks
      const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
      if (stored === null) return true;
      return normalize(stored);
    }
  } catch (err) {
    console.warn("Error in sync check:", err);
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === null) return true;
    return normalize(stored);
  } catch (err) {
    return true; // Default to enabled
  }
}
