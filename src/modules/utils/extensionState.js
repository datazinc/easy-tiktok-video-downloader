// extensionState.js
// Shared toggle state with background as source of truth (chrome.storage + messaging)

const EXTENSION_ENABLED_KEY = "tik.tok::extensionEnabled";

let cachedState = null;

function sendStateMessage(action, payload = {}) {
  if (typeof window === "undefined" || typeof window.postMessage === "undefined")
    return Promise.resolve(null);

  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random()}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 8000);

    function handler(event) {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.type !== "EXT_STATE_RESPONSE" || data?.id !== id) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(data);
    }

    window.addEventListener("message", handler);
    window.postMessage(
      {
        type: "EXT_STATE_REQUEST",
        action,
        id,
        ...payload,
      },
      "*"
    );
  });
}

function writeLocal(enabled) {
  try {
    localStorage.setItem(EXTENSION_ENABLED_KEY, enabled ? "true" : "false");
  } catch {}
  cachedState = enabled;
}

// Keep cache/localStorage synced when storage changes elsewhere
(() => {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.action === "stateBroadcast" && typeof msg.enabled !== "undefined") {
          const val = !!msg.enabled;
          writeLocal(val);
          console.log("[EXT_POWER] broadcast -> cache", val);
        }
      });
    }
  } catch (err) {
    console.warn("EXT_POWER listener failed", err);
  }
})();

async function queryBackgroundState() {
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getState" }, (resp) => {
        if (chrome.runtime?.lastError) {
          console.warn("EXT_POWER getState error:", chrome.runtime.lastError);
          return resolve(null);
        }
        resolve(resp?.enabled);
      });
    });
  }

  const bridged = await sendStateMessage("GET");
  if (bridged && bridged.success !== false && typeof bridged.enabled !== "undefined") {
    return bridged.enabled;
  }
  return null;
}

export async function isExtensionEnabled() {
  if (cachedState !== null) return cachedState;

  // Background is source of truth; try there first
  const bgState = await queryBackgroundState();
  if (bgState !== null && bgState !== undefined) {
    writeLocal(!!bgState);
    return !!bgState;
  }

  // Fallback to localStorage (fast path for content scripts)
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === "false") return false;
    if (stored === "true") return true;
  } catch {}

  return true; // default to enabled if everything fails
}

export async function setExtensionEnabled(enabled) {
  let success = false;
  let resolvedState = !!enabled;
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "toggleState", enabled: !!enabled },
          (response) => resolve(response)
        );
      });
      if (!chrome.runtime?.lastError && resp?.success !== false) {
        success = true;
        resolvedState =
          typeof resp?.enabled !== "undefined" ? !!resp.enabled : !!enabled;
      }
    } catch (err) {
      console.warn("EXT_POWER toggle error:", err);
    }
  }

  if (!success) {
    const bridged = await sendStateMessage("SET", { enabled: !!enabled });
    if (bridged && bridged.success !== false) {
      success = true;
      resolvedState =
        typeof bridged.enabled !== "undefined"
          ? !!bridged.enabled
          : !!enabled;
    } else {
      console.warn("EXT_POWER toggle via bridge failed", bridged?.error);
    }
  }

  if (success) {
    writeLocal(resolvedState);
  }
}

export function isExtensionEnabledSync() {
  if (cachedState !== null) return cachedState;
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === "false") return false;
    if (stored === "true") return true;
  } catch {}
  return true;
}
