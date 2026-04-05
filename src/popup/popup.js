/* main.js */
// Initialize theme
(function () {
  const THEME_MODE_KEY = "tik.tok::themeMode";
  const themeMode = localStorage.getItem(THEME_MODE_KEY) || "system";

  // Resolve system theme to actual theme
  let resolvedTheme = themeMode;
  if (themeMode === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    resolvedTheme = prefersDark ? "dark" : "light";
  }

  if (resolvedTheme === "dark") {
    document.body.classList.add("theme-dark");
    document.documentElement.classList.add("theme-dark");
  } else {
    document.body.classList.remove("theme-dark");
    document.documentElement.classList.remove("theme-dark");
  }
})();

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.().version || "unknown";
  } catch {
    return "unknown";
  }
}

function renderFooterMeta() {
  const footerMeta = document.getElementById("footerMeta");
  if (!footerMeta) return;

  const year = new Date().getFullYear();
  const version = getExtensionVersion();

  footerMeta.replaceChildren();
  footerMeta.append(`v${version} © ${year} `);

  const link = document.createElement("a");
  link.href = "https://linktr.ee/aimuhire";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "linktr.ee/aimuhire";
  footerMeta.appendChild(link);
}

renderFooterMeta();

// Check extension state and show appropriate UI
const EXTENSION_ENABLED_KEY = "tik.tok::extensionEnabled";

// Helper to get extension state from chrome.storage
async function getExtensionState() {
  const normalize = (val) => !(val === "false" || val === false);
  console.log("[EXT_POWER] popup getExtensionState() called");

  // Ask background first (authoritative - IndexedDB)
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getState" }, (r) => {
          if (chrome.runtime?.lastError) {
            console.warn(
              "Error reading extension state via message:",
              chrome.runtime.lastError,
            );
            return resolve(null);
          }
          resolve(r);
        });
      });
      if (resp && typeof resp.enabled !== "undefined") {
        console.log("[EXT_POWER] popup bg getState:", resp.enabled);
        try {
          localStorage.setItem(
            EXTENSION_ENABLED_KEY,
            resp.enabled ? "true" : "false",
          );
        } catch {}
        return !!resp.enabled;
      }
    }
  } catch (err) {
    console.warn("Failed to read from background:", err);
  }

  // Fallback to localStorage (default enabled)
  try {
    const stored = localStorage.getItem(EXTENSION_ENABLED_KEY);
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

  let success = false;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "toggleState", enabled: !!enabled },
          (r) => {
            if (chrome.runtime?.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve(r);
          },
        );
      });
      if (resp?.success === false) {
        console.warn("Failed to write via messaging:", resp?.error);
      } else {
        success = true;
      }
    }
  } catch (err) {
    console.warn("Failed to write via messaging:", err);
  }

  if (!success) return;

  // Sync to localStorage once background confirms
  try {
    localStorage.setItem(EXTENSION_ENABLED_KEY, storageValue);
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }
}

// Helper to wait for state confirmation with polling
async function waitForStateConfirmation(
  expectedState,
  maxRetries = 20,
  delayMs = 150,
) {
  console.log(
    "[EXT_POWER] popup waitForStateConfirmation: waiting for",
    expectedState,
  );

  for (let i = 0; i < maxRetries; i++) {
    const currentState = await getExtensionState();
    if (currentState === expectedState) {
      console.log(
        "[EXT_POWER] popup state confirmed:",
        currentState,
        "after",
        i + 1,
        "attempts",
      );
      // Small additional delay to ensure background has fully processed
      await new Promise((resolve) => setTimeout(resolve, 50));
      return true;
    }

    // Wait before next attempt
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.warn(
    "[EXT_POWER] popup state confirmation timeout: expected",
    expectedState,
    "but got",
    await getExtensionState(),
  );
  return false;
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

        // Get fresh references to UI elements
        const currentDisabledState = document.getElementById("disabled-state");
        const currentNormalState = document.getElementById("normal-state");

        // Disable button and show loading state
        newBtn.disabled = true;
        const originalText = newBtn.textContent;
        newBtn.textContent = "Turning on...";

        try {
          // Set up a one-time listener for state broadcast (if available)
          let stateUpdatePromise = null;
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.onMessage
          ) {
            stateUpdatePromise = new Promise((resolve) => {
              const listener = (msg) => {
                if (msg?.action === "stateBroadcast" && msg.enabled === true) {
                  try {
                    chrome.runtime.onMessage.removeListener(listener);
                  } catch {}
                  resolve(true);
                }
              };
              try {
                chrome.runtime.onMessage.addListener(listener);
              } catch {
                // If we fail to attach, fall back to polling only
                resolve(false);
                return;
              }

              // Timeout after 3 seconds
              setTimeout(() => {
                try {
                  chrome.runtime.onMessage.removeListener(listener);
                } catch {}
                resolve(false);
              }, 3000);
            });
          }

          // Set the state
          await setExtensionState(true);
          console.log("[EXT_POWER] popup setExtensionState(true) completed");

          // Start polling confirmation in parallel
          const pollPromise = waitForStateConfirmation(true, 15, 100);

          let broadcastReceived = false;
          let pollConfirmed = false;

          if (stateUpdatePromise) {
            // Prefer whichever confirms first; only wait for the second
            // if the first did not positively confirm.
            const first = await Promise.race([
              stateUpdatePromise.then((ok) => ({
                source: "broadcast",
                ok,
              })),
              pollPromise.then((ok) => ({
                source: "poll",
                ok,
              })),
            ]);

            if (first.source === "broadcast") {
              broadcastReceived = first.ok;
              if (!first.ok) {
                // Broadcast timed out or failed → fall back to polling result
                pollConfirmed = await pollPromise;
              }
            } else {
              pollConfirmed = first.ok;
              if (!first.ok) {
                // Polling failed to confirm → wait for broadcast (if any)
                broadcastReceived = await stateUpdatePromise;
              }
            }
          } else {
            // No broadcast listener available; rely solely on polling
            pollConfirmed = await pollPromise;
          }

          const confirmed = broadcastReceived || pollConfirmed;
          console.log(
            "[EXT_POWER] popup state update - broadcast:",
            broadcastReceived,
            "poll:",
            pollConfirmed,
          );

          if (confirmed) {
            // Update UI immediately - directly manipulate for instant feedback
            // This ensures the UI updates right away without waiting for checkAndUpdateUI
            if (currentDisabledState) {
              currentDisabledState.style.display = "none";
            }
            if (currentNormalState) {
              currentNormalState.style.display = "block";
            }

            // Verify the state one more time and update UI if needed
            // Use a small delay to ensure background has fully processed
            setTimeout(async () => {
              if (typeof window.checkAndUpdateUI === "function") {
                await window.checkAndUpdateUI();
              }
            }, 200);
          } else {
            // State confirmation failed - re-enable button
            newBtn.disabled = false;
            newBtn.textContent = originalText;
            console.error("[EXT_POWER] popup failed to confirm state change");

            const errorMessage = document.createElement("p");
            errorMessage.textContent =
              "Failed to enable extension. Please try again.";
            errorMessage.style.cssText =
              "margin-top: 15px; color: #ef4444; font-weight: bold;";
            if (currentDisabledState) {
              // Remove any existing messages
              const existingMessages =
                currentDisabledState.querySelectorAll("p");
              existingMessages.forEach((msg) => {
                if (msg !== currentDisabledState.querySelector(".footnote")) {
                  msg.remove();
                }
              });
              currentDisabledState.appendChild(errorMessage);
            }
          }
        } catch (err) {
          console.error("[EXT_POWER] popup error enabling extension:", err);
          newBtn.disabled = false;
          newBtn.textContent = originalText;

          const errorMessage = document.createElement("p");
          errorMessage.textContent =
            "Error enabling extension. Please try again.";
          errorMessage.style.cssText =
            "margin-top: 15px; color: #ef4444; font-weight: bold;";
          if (currentDisabledState) {
            // Remove any existing messages
            const existingMessages = currentDisabledState.querySelectorAll("p");
            existingMessages.forEach((msg) => {
              if (msg !== currentDisabledState.querySelector(".footnote")) {
                msg.remove();
              }
            });
            currentDisabledState.appendChild(errorMessage);
          }
        }
      });
    }
  }

  // Expose checkAndUpdateUI globally
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
          changes[EXTENSION_ENABLED_KEY].newValue,
        );
        checkAndUpdateUI();
      }
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.action === "stateBroadcast") {
        console.log("[EXT_POWER] popup stateBroadcast", msg.enabled);
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

// Past Downloads UI
(async function () {
  // Progress storage via background script (IndexedDB)
  // Popup runs in extension context, so we can use chrome.runtime.sendMessage directly
  const progressStorage = {
    getAllProgress: async () => {
      try {
        console.log("[Past Downloads] Fetching from background (IndexedDB)...");
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "getProgress" }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[Past Downloads] Failed to load progress:",
                chrome.runtime.lastError,
              );
              resolve({});
              return;
            }
            const progress = response?.progress || {};
            console.log("[Past Downloads] Loaded progress:", progress);
            console.log(
              "[Past Downloads] Progress keys:",
              Object.keys(progress),
            );
            resolve(progress);
          });
        });
      } catch (err) {
        console.warn("[Past Downloads] Failed to load progress:", err);
        return {};
      }
    },
    clearUser: async (username) => {
      try {
        // Load current progress
        const progress = await progressStorage.getAllProgress();
        const normalizedUsername = username.toLowerCase().trim();

        if (progress[normalizedUsername]) {
          delete progress[normalizedUsername];

          // Save updated progress back to IndexedDB
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { action: "setProgress", progress },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.warn(
                    "Failed to clear user:",
                    chrome.runtime.lastError,
                  );
                } else {
                  console.log("✅ Cleared user:", normalizedUsername);
                }
                resolve();
              },
            );
          });
        }
      } catch (err) {
        console.warn("Failed to clear user:", err);
      }
    },
    clearTab: async (username, tabName) => {
      try {
        // Load current progress
        const progress = await progressStorage.getAllProgress();
        const normalizedUsername = username.toLowerCase().trim();

        if (progress[normalizedUsername]?.[tabName]) {
          delete progress[normalizedUsername][tabName];

          // Save updated progress back to IndexedDB
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { action: "setProgress", progress },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.warn(
                    "Failed to clear tab:",
                    chrome.runtime.lastError,
                  );
                } else {
                  console.log("✅ Cleared tab:", normalizedUsername, tabName);
                }
                resolve();
              },
            );
          });
        }
      } catch (err) {
        console.warn("Failed to clear tab:", err);
      }
    },
    clearAllProgress: async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: "clearProgress" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "Failed to clear all progress:",
                  chrome.runtime.lastError,
                );
              } else {
                console.log("✅ Cleared all progress");
              }
              resolve();
            },
          );
        });
      } catch (err) {
        console.warn("Failed to clear all progress:", err);
      }
    },
    getProgress: async (username, tabName) => {
      try {
        const progress = await progressStorage.getAllProgress();
        const normalizedUsername = username.toLowerCase().trim();
        return progress[normalizedUsername]?.[tabName] || [];
      } catch (err) {
        console.warn("Failed to get progress:", err);
        return [];
      }
    },
  };

  const pastDownloadsBtn = document.getElementById("pastDownloadsBtn");
  const pastDownloadsModal = document.getElementById("pastDownloadsModal");
  const closePastDownloadsBtn = document.getElementById(
    "closePastDownloadsBtn",
  );
  const pastDownloadsContent = document.getElementById("pastDownloadsContent");

  if (
    !pastDownloadsBtn ||
    !pastDownloadsModal ||
    !closePastDownloadsBtn ||
    !pastDownloadsContent
  ) {
    return;
  }

  function closeModal() {
    pastDownloadsModal.style.display = "none";
  }

  function openModal() {
    pastDownloadsModal.style.display = "flex";
    renderPastDownloads();
  }

  pastDownloadsBtn.addEventListener("click", openModal);
  closePastDownloadsBtn.addEventListener("click", closeModal);
  pastDownloadsModal.addEventListener("click", (e) => {
    if (e.target === pastDownloadsModal) {
      closeModal();
    }
  });

  const tabNameMap = {
    videos: "Videos",
    reposts: "Reposts",
    liked: "Liked",
    favorites: "Favorites",
  };

  function formatTabName(tabName) {
    return (
      tabNameMap[tabName] || tabName.charAt(0).toUpperCase() + tabName.slice(1)
    );
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitForTabComplete(tabId, expectedUrl, timeoutMs = 20000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const tab = await chrome.tabs.get(tabId);
      const tabUrl = tab?.url || "";
      const urlMatches = !expectedUrl || tabUrl.startsWith(expectedUrl);

      if (tab?.status === "complete" && urlMatches) {
        return true;
      }

      await wait(400);
    }

    return false;
  }

  async function sendResumeMessageWithRetry(tabId, payload) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const wasSent = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tabId,
          {
            action: "resumeDownload",
            payload,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                `[Resume Download] sendMessage attempt ${attempt + 1} failed:`,
                chrome.runtime.lastError,
              );
              resolve(false);
              return;
            }

            resolve(response?.success !== false);
          },
        );
      });

      if (wasSent) {
        return true;
      }

      await wait(500);
    }

    return false;
  }

  async function renderPastDownloads() {
    try {
      pastDownloadsContent.replaceChildren();
      const loading = document.createElement("p");
      loading.style.textAlign = "center";
      loading.style.color = "#666";
      loading.style.padding = "20px";
      loading.textContent = "Loading...";
      pastDownloadsContent.appendChild(loading);

      console.log("[Past Downloads] Loading progress from storage...");
      const progress = await progressStorage.getAllProgress();
      console.log("[Past Downloads] Loaded progress:", progress);
      console.log("[Past Downloads] Progress keys:", Object.keys(progress));
      console.log("[Past Downloads] Progress values:", Object.values(progress));

      const usernames = Object.keys(progress).sort();
      console.log("[Past Downloads] Usernames found:", usernames);

      if (usernames.length === 0) {
        pastDownloadsContent.replaceChildren();

        const emptyState = document.createElement("div");
        emptyState.style.textAlign = "center";
        emptyState.style.padding = "40px 20px";
        emptyState.style.color = "#666";

        const title = document.createElement("p");
        title.style.fontSize = "16px";
        title.style.marginBottom = "10px";
        title.textContent = "No downloads yet";

        const subtitle = document.createElement("p");
        subtitle.style.fontSize = "13px";
        subtitle.textContent = "Start downloading videos to see them here!";

        emptyState.append(title, subtitle);
        pastDownloadsContent.appendChild(emptyState);
        return;
      }

      const scrollContainer = document.createElement("div");
      scrollContainer.className = "past-downloads-scroll";

      usernames.forEach((username) => {
        const userData = progress[username];
        const tabs = Object.keys(userData)
          .filter((key) => key !== "_metadata")
          .sort();

        const userSection = document.createElement("div");
        userSection.className = "past-downloads-user";

        const userHead = document.createElement("div");
        userHead.className = "past-downloads-user-head";

        const usernameLabel = document.createElement("div");
        usernameLabel.className = "past-downloads-username";
        usernameLabel.textContent = `@${username}`;

        const clearUserBtn = document.createElement("button");
        clearUserBtn.className = "clear-user-btn ghost";
        clearUserBtn.dataset.username = username;
        clearUserBtn.textContent = "🗑️ Clear All";

        userHead.append(usernameLabel, clearUserBtn);

        const tabsContainer = document.createElement("div");
        tabsContainer.className = "past-downloads-tabs";

        tabs.forEach((tabName) => {
          const videoIds = userData[tabName] || [];
          const count = Array.isArray(videoIds) ? videoIds.length : 0;

          const tabSection = document.createElement("div");
          tabSection.className = "past-downloads-tab";

          const tabMeta = document.createElement("div");
          tabMeta.className = "past-downloads-tab-meta";

          const tabLabel = document.createElement("span");
          tabLabel.className = "past-downloads-tab-label";
          tabLabel.textContent = formatTabName(tabName);

          const tabCount = document.createElement("span");
          tabCount.className = "past-downloads-tab-count";
          tabCount.textContent = `${count} items`;

          tabMeta.append(tabLabel, tabCount);

          const actions = document.createElement("div");
          actions.className = "past-downloads-tab-actions";

          const downloadCsvBtn = document.createElement("button");
          downloadCsvBtn.className = "download-csv-btn ghost";
          downloadCsvBtn.dataset.username = username;
          downloadCsvBtn.dataset.tab = tabName;
          downloadCsvBtn.title = "Download CSV";
          downloadCsvBtn.textContent = "📥 CSV";

          const resumeDownloadBtn = document.createElement("button");
          resumeDownloadBtn.className = "resume-download-btn ghost";
          resumeDownloadBtn.dataset.username = username;
          resumeDownloadBtn.dataset.tab = tabName;
          resumeDownloadBtn.title = "Resume Download";
          resumeDownloadBtn.textContent = "▶️ Resume";

          const clearTabBtn = document.createElement("button");
          clearTabBtn.className = "clear-tab-btn ghost";
          clearTabBtn.dataset.username = username;
          clearTabBtn.dataset.tab = tabName;
          clearTabBtn.textContent = "Clear";

          actions.append(downloadCsvBtn, resumeDownloadBtn, clearTabBtn);
          tabSection.append(tabMeta, actions);
          tabsContainer.appendChild(tabSection);
        });

        userSection.append(userHead, tabsContainer);
        scrollContainer.appendChild(userSection);
      });

      const footer = document.createElement("div");
      footer.className = "past-downloads-footer";

      const clearAllBtn = document.createElement("button");
      clearAllBtn.id = "clearAllBtn";
      clearAllBtn.className = "btn danger";
      clearAllBtn.textContent = "🗑️ Clear All Downloads";
      footer.appendChild(clearAllBtn);

      pastDownloadsContent.replaceChildren(scrollContainer, footer);

      // Attach event listeners
      pastDownloadsContent
        .querySelectorAll(".clear-user-btn")
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const username = e.target.dataset.username;
            if (confirm(`Clear all downloads for @${username}?`)) {
              await progressStorage.clearUser(username);
              renderPastDownloads();
            }
          });
        });

      // CSV Download buttons
      pastDownloadsContent
        .querySelectorAll(".download-csv-btn")
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const username = e.target.dataset.username;
            const tabName = e.target.dataset.tab;
            try {
              const videoIds = await progressStorage.getProgress(
                username,
                tabName,
              );

              if (!videoIds || videoIds.length === 0) {
                alert("No items to export");
                return;
              }

              // Create CSV content
              const headers = [
                "index",
                "videoId",
                "imageIndex",
                "username",
                "tab",
              ];
              const rows = videoIds.map((videoId, index) => {
                // Handle image posts with sequence numbers (videoId:sequence)
                let baseVideoId = videoId;
                let imageIndex = "";
                if (videoId.includes(":")) {
                  const parts = videoId.split(":");
                  baseVideoId = parts[0];
                  imageIndex = parts[1] || "";
                }

                const row = [
                  index + 1,
                  baseVideoId,
                  imageIndex,
                  username,
                  tabName,
                ];
                return row
                  .map((val) => `"${String(val).replace(/"/g, '""')}"`)
                  .join(",");
              });

              const csvContent = [headers.join(","), ...rows].join("\n");
              const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const sanitizedUsername = username.replace(/[^a-zA-Z0-9_]/g, "_");
              const sanitizedTab = tabName.replace(/[^a-zA-Z0-9_]/g, "_");
              const filename = `downloads_${sanitizedUsername}_${sanitizedTab}_${new Date().toISOString().split("T")[0]}.csv`;

              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);

              // Close popup after successful CSV download
              setTimeout(() => {
                window.close();
              }, 100);
            } catch (err) {
              console.error("Failed to export CSV:", err);
              alert(
                "Failed to export CSV: " + (err.message || "Unknown error"),
              );
            }
          });
        });

      // Resume Download buttons
      pastDownloadsContent
        .querySelectorAll(".resume-download-btn")
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const username = e.target.dataset.username;
            const tabName = e.target.dataset.tab;

            try {
              // Get the active tab
              const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (!tabs[0]) {
                alert("Please open a TikTok page first");
                return;
              }

              const currentUrl = tabs[0].url;
              const isCollection =
                tabName !== "videos" &&
                tabName !== "liked" &&
                tabName !== "favorites" &&
                tabName !== "reposts";

              // Get collection URL if this is a collection
              let collectionUrl = null;
              if (isCollection) {
                try {
                  // Request collection URL from background script
                  const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage(
                      { action: "getCollectionUrl", username, tabName },
                      (resp) => {
                        if (chrome.runtime.lastError) {
                          console.warn(
                            "Failed to get collection URL:",
                            chrome.runtime.lastError,
                          );
                          resolve(null);
                        } else {
                          resolve(resp?.collectionUrl || null);
                        }
                      },
                    );
                  });
                  collectionUrl = response;
                } catch (err) {
                  console.warn("Failed to retrieve collection URL:", err);
                }
              }

              // Determine target URL
              let targetUrl;
              if (isCollection && collectionUrl) {
                // Use the stored collection URL
                targetUrl = `https://www.tiktok.com${collectionUrl}`;
              } else {
                // Fall back to profile URL
                targetUrl = `https://www.tiktok.com/@${username}`;
              }

              const resumePayload = {
                username,
                tabName,
                isCollection,
                collectionUrl,
              };

              // Navigate to the target URL if not already there
              if (
                !currentUrl.includes(
                  targetUrl.replace("https://www.tiktok.com", ""),
                )
              ) {
                await chrome.tabs.update(tabs[0].id, { url: targetUrl });
                const pageReady = await waitForTabComplete(
                  tabs[0].id,
                  targetUrl,
                );
                if (!pageReady) {
                  alert(
                    "The TikTok page took too long to load. Please try again once it finishes loading.",
                  );
                  return;
                }

                const sent = await sendResumeMessageWithRetry(
                  tabs[0].id,
                  resumePayload,
                );

                if (!sent) {
                  alert(
                    "Failed to trigger resume after navigation. Please refresh the page and try again.",
                  );
                  return;
                }

                window.close();
              } else {
                const sent = await sendResumeMessageWithRetry(
                  tabs[0].id,
                  resumePayload,
                );

                if (!sent) {
                  alert(
                    "Failed to trigger download. Please refresh the page and try again.",
                  );
                  return;
                }

                window.close();
              }
            } catch (err) {
              console.error("Failed to resume download:", err);
              alert("Failed to resume download. Please try again.");
            }
          });
        });

      pastDownloadsContent.querySelectorAll(".clear-tab-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username;
          const tabName = e.target.dataset.tab;
          if (
            confirm(
              `Clear ${formatTabName(tabName)} downloads for @${username}?`,
            )
          ) {
            await progressStorage.clearTab(username, tabName);
            renderPastDownloads();
          }
        });
      });

      if (clearAllBtn) {
        clearAllBtn.addEventListener("click", async () => {
          if (confirm("Clear ALL downloads history? This cannot be undone.")) {
            await progressStorage.clearAllProgress();
            renderPastDownloads();
          }
        });
      }
    } catch (err) {
      console.error("Failed to render past downloads:", err);
      pastDownloadsContent.replaceChildren();

      const errorState = document.createElement("div");
      errorState.style.textAlign = "center";
      errorState.style.padding = "20px";
      errorState.style.color = "#ff3b30";

      const errorText = document.createElement("p");
      errorText.textContent = "Error loading downloads history";
      errorState.appendChild(errorText);

      pastDownloadsContent.appendChild(errorState);
    }
  }
})();
