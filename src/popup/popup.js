/* main.js */
// Initialize theme
(function () {
  const THEME_MODE_KEY = "tik.tok::themeMode";
  const themeMode = localStorage.getItem(THEME_MODE_KEY) || "dark";

  if (themeMode === "dark") {
    document.body.classList.add("theme-dark");
    document.documentElement.classList.add("theme-dark");
  } else {
    document.body.classList.remove("theme-dark");
    document.documentElement.classList.remove("theme-dark");
  }
})();

// Check extension state and show appropriate UI
const EXTENSION_ENABLED_KEY = "tik.tok::extensionEnabled";

// Helper to get extension state from chrome.storage
async function getExtensionState() {
  const normalize = (val) => !(val === "false" || val === false);
  console.log("[EXT_POWER] popup getExtensionState() called");

  // Prefer explicit localStorage false (content scripts write here immediately)
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    if (stored === "false") {
      console.log("[EXT_POWER] popup localStorage forces disabled");
      return false;
    }
  } catch {}
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([EXTENSION_ENABLED_KEY], (items) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Error reading extension state:",
              chrome.runtime.lastError
            );
            resolve(null);
          } else {
            resolve(items[EXTENSION_ENABLED_KEY]);
          }
        });
      });
      console.log("[EXT_POWER] popup storage read:", result);
      if (result == null) {
        const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
        console.log("[EXT_POWER] popup storage missing, fallback local:", stored);
        if (stored != null) return normalize(stored);
        return true;
      }
      return normalize(result); // Default to true if not set
    }
  } catch (err) {
    console.warn("Failed to read from chrome.storage:", err);
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
    console.log("[EXT_POWER] popup localStorage read:", stored);
    if (stored === null) return true;
    return normalize(stored);
  } catch (err) {
    return true; // Default to enabled
  }
}

// Helper to set extension state
async function setExtensionState(enabled) {
  const storageValue = enabled ? "true" : "false";
  console.log("[EXT_POWER] popup setExtensionState:", storageValue);

  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
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

  // Also sync to localStorage
  try {
    localStorage.setItem(EXTENSION_ENABLED_KEY, storageValue);
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }
}

(async function () {
  async function checkAndUpdateUI() {
    console.log("[EXT_POWER] popup checkAndUpdateUI start");
    const isEnabled = await getExtensionState();
    console.log("[EXT_POWER] popup state:", isEnabled);

    const disabledState = document.getElementById("disabled-state");
    const normalState = document.getElementById("normal-state");
    const turnOnBtn = document.getElementById("turnOnBtn");

    if (!isEnabled) {
      // Show disabled state
      if (disabledState) disabledState.style.display = "block";
      if (normalState) normalState.style.display = "none";
    } else {
      // Show normal state
      if (disabledState) disabledState.style.display = "none";
      if (normalState) normalState.style.display = "block";
    }

    // Handle Turn On button
    if (turnOnBtn && !isEnabled) {
      // Remove existing listeners by cloning
      const newBtn = turnOnBtn.cloneNode(true);
      turnOnBtn.parentNode.replaceChild(newBtn, turnOnBtn);

      newBtn.addEventListener("click", async () => {
        console.log("[EXT_POWER] popup Turn On clicked");
        await setExtensionState(true);

        // Show success message
        newBtn.textContent = "✅ Enabled!";
        newBtn.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
        newBtn.disabled = true;

        // Show message about refreshing
        const message = document.createElement("p");
        message.textContent =
          "Extension enabled! Refresh any open TikTok tabs for changes to take effect.";
        message.style.cssText =
          "margin-top: 15px; color: #22c55e; font-weight: bold;";
        if (disabledState) {
          disabledState.appendChild(message);
        }

        // Switch to normal state after a delay
        setTimeout(() => {
          checkAndUpdateUI();
        }, 2000);
      });
    }
  }

  // Expose checkAndUpdateUI globally for force reset button
  window.checkAndUpdateUI = checkAndUpdateUI;

  // Run on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndUpdateUI);
  } else {
    checkAndUpdateUI();
  }

  // Refresh when popup regains focus/visibility
  window.addEventListener("focus", () => {
    console.log("[EXT_POWER] popup focus -> recheck");
    checkAndUpdateUI();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      console.log("[EXT_POWER] popup visible -> recheck");
      checkAndUpdateUI();
    }
  });

  // Listen for storage changes to update UI dynamically
  if (
    typeof chrome !== "undefined" &&
    chrome.storage &&
    chrome.storage.onChanged
  ) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[EXTENSION_ENABLED_KEY]) {
        console.log(
          "[EXT_POWER] popup onChanged",
          changes[EXTENSION_ENABLED_KEY].oldValue,
          "->",
          changes[EXTENSION_ENABLED_KEY].newValue
        );
        checkAndUpdateUI();
      }
    });
  }
})();

document.getElementById("startBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  const input = document.getElementById("username");
  let username = input.value.trim();
  const tiktokHostUrl = "https://tiktok.com/";

  if (username.startsWith("@")) username = username.slice(1);
  if (
    username.startsWith("https://tiktok.com") ||
    username.startsWith("https://www.tiktok.com")
  ) {
    window.open(username);
    return;
  }
  if (
    username.startsWith("tiktok.com") ||
    username.startsWith("www.tiktok.com")
  ) {
    window.open("https://" + username);
    return;
  }

  if (!username) {
    window.open(tiktokHostUrl, "_blank");
    return;
  }

  window.open(`${tiktokHostUrl}@${username}`, "_blank");
});

// Force Reset Button - Enable extension if disabled
(function () {
  const forceResetBtn = document.getElementById("forceResetBtn");
  if (!forceResetBtn) return;

  forceResetBtn.addEventListener("click", async () => {
    // Enable extension if disabled
    await setExtensionState(true);

    // Update UI to reflect the change
    if (typeof window.checkAndUpdateUI === "function") {
      await window.checkAndUpdateUI();
    }
  });
})();
