// content.js
(() => {
  const DEBUG = () => globalThis?.AppStateETTVD?.debug?.active ?? false;

  // -------- Browser detection (API-first, UA fallback) --------
  function detectBrowserUA() {
    const ua = navigator.userAgent || "";
    if (/firefox/i.test(ua)) return "firefox";
    if (/chrome|chromium|crios/i.test(ua) && !/edge|edg|opr|opera/i.test(ua))
      return "chrome";
    return "unknown";
  }
  function detectBrowser() {
    // Prefer API presence in extension contexts
    if (
      typeof browser !== "undefined" &&
      typeof browser.runtime !== "undefined"
    )
      return "firefox";
    if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined")
      return "chrome";
    // Fallback to UA (useful in page-like contexts)
    return detectBrowserUA();
  }

  // -------- Utilities --------
  function respondOnce(id) {
    let sent = false;
    return (payload) => {
      if (sent) return;
      sent = true;
      try {
        window.postMessage(
          { type: "BLOB_DOWNLOAD_RESPONSE", id, ...payload },
          "*"
        );
      } catch (e) {
        try {
          window.postMessage(
            {
              type: "BLOB_DOWNLOAD_RESPONSE",
              id,
              success: false,
              code: "ERR_POSTMESSAGE",
              error: String(e?.message || e),
            },
            "*"
          );
        } catch {}
      }
    };
  }

  function sendMessage(action, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action, payload }, (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            resolve({ __transportError: lastErr.message });
            return;
          }
          resolve(response);
        });
      } catch (e) {
        resolve({ __transportError: e?.message || String(e) });
      }
    });
  }

  function fetchBlobAsArrayBuffer(blobUrl) {
    return fetch(blobUrl).then((r) => {
      if (!r.ok) throw new Error(`Fetch failed with status ${r.status}`);
      return r.arrayBuffer();
    });
  }

  function shouldFallbackFromBlobResp(resp) {
    const msg = (resp?.error || resp?.__transportError || "").toLowerCase();
    // Firefox error surface; also catch Chrome oddities
    return (
      /access denied/.test(msg) ||
      /type error/.test(msg) ||
      /blob:/.test(msg) ||
      /invalid url/i.test(msg) ||
      /error processing url/i.test(msg)
    );
  }

  // -------- Main bridge: page -> content -> background --------
  window.addEventListener("message", (event) => {
    // Only accept messages from the page itself
    if (event.source !== window) return;

    const data = event.data;

    // Handle extension state (enable/disable) bridge
    if (data?.type === "EXT_STATE_REQUEST") {
      const { id, action, enabled } = data;
      const reply = (response) =>
        window.postMessage(
          { type: "EXT_STATE_RESPONSE", id, ...response },
          "*"
        );

      if (action === "GET") {
        chrome.runtime.sendMessage({ action: "getState" }, (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            reply({ success: false, error: lastErr.message });
            return;
          }
          reply({ success: true, enabled: response?.enabled });
        });
        return;
      }

      if (action === "SET") {
        chrome.runtime.sendMessage(
          { action: "toggleState", enabled: !!enabled },
          () => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) {
              reply({ success: false, error: lastErr.message });
              return;
            }
            reply({ success: true, enabled: !!enabled });
          }
        );
        return;
      }

      reply({ success: false, error: `Unknown action: ${action}` });
      return;
    }

    // Handle progress storage requests (bridge to background)
    if (data?.type?.startsWith("PROGRESS_REQUEST_")) {
      const action = data.type.replace("PROGRESS_REQUEST_", "");
      const { id, data: payload } = data;

      function reply(response) {
        window.postMessage(
          {
            type: `PROGRESS_RESPONSE_${action}`,
            id,
            ...response,
          },
          "*"
        );
      }

      // Map page actions to background actions
      const backgroundActionMap = {
        GET: "getProgress",
        SET: "setProgress",
        CLEAR: "clearProgress",
      };

      const backgroundAction = backgroundActionMap[action];
      if (!backgroundAction) {
        reply({ success: false, error: `Unknown action: ${action}` });
        return;
      }

      // Forward to background script via chrome.runtime.sendMessage
      const messagePayload =
        action === "SET"
          ? { action: backgroundAction, progress: payload?.progress }
          : { action: backgroundAction };

      // Use chrome.runtime.sendMessage directly (like the blob download code does)
      chrome.runtime.sendMessage(messagePayload, (response) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          reply({
            success: false,
            error: lastErr.message || "Background script error",
          });
          return;
        }

        if (action === "GET") {
          reply({
            success: response?.success !== false,
            progress: response?.progress || {},
            error: response?.error,
          });
        } else {
          reply({
            success: response?.success !== false,
            error: response?.error,
          });
        }
      });

      return;
    }

    // Handle blob download requests
    if (!data || data.type !== "BLOB_DOWNLOAD_REQUEST") return;

    const { id, payload } = data || {};
    const reply = respondOnce(id);

    // 25s watchdog to avoid hangs if bg never answers
    const watchdog = setTimeout(() => {
      reply({
        success: false,
        code: "ERR_CONTENT_TIMEOUT",
        error: "Timed out waiting for background response (25s)",
      });
    }, 25000);

    const finish = (out) => {
      clearTimeout(watchdog);
      reply(out);
    };

    try {
      const browserName = detectBrowser();
      const { blobUrl, filename, showFolderPicker } = payload || {};

      // Validate minimal payload (we tolerate missing blobUrl if future modes appear)
      if (typeof filename !== "string" || !filename.trim()) {
        const errorMsg = `Invalid filename in BLOB_DOWNLOAD_REQUEST: expected non-empty string, got ${typeof filename}${
          filename ? ` (length: ${filename.length})` : ""
        }`;
        console.error("[Content Script] ❌ Filename validation failed:", {
          filename,
          type: typeof filename,
          trimmed: filename?.trim(),
          error: errorMsg,
        });
        finish({
          success: false,
          code: "ERR_INVALID_FILENAME",
          error: errorMsg,
        });
        return;
      }

      // --- FIREFOX: always go ArrayBuffer -> background ---
      if (browserName === "firefox") {
        if (typeof blobUrl !== "string" || !blobUrl.startsWith("blob:")) {
          finish({
            success: false,
            code: "ERR_INVALID_BLOB_URL",
            error: "Invalid blob URL. Expected a 'blob:' URL string.",
          });
          return;
        }

        fetchBlobAsArrayBuffer(blobUrl)
          .then((buffer) =>
            sendMessage("downloadArrayBuffer", {
              buffer,
              filename,
              showFolderPicker,
            })
          )
          .then((resp) => {
            if (!resp || typeof resp.success !== "boolean") {
              finish({
                success: false,
                code: "ERR_NO_RESPONSE",
                error:
                  resp?.__transportError ||
                  "Background returned no/invalid response",
              });
              return;
            }
            finish({
              success: resp.success,
              code: resp.code || (resp.success ? "OK" : "ERR_BACKGROUND"),
              error: resp.error || null,
              downloadId: resp.downloadId,
            });
          })
          .catch((e) => {
            finish({
              success: false,
              code: "ERR_FETCH_BLOB",
              error: e?.message || String(e),
            });
          });

        return;
      }

      // --- CHROME (and others): try blob URL first, then fallback to ArrayBuffer on failure ---
      if (typeof blobUrl === "string" && blobUrl.startsWith("blob:")) {
        // Attempt direct blob URL path
        sendMessage("downloadBlobUrl", {
          blobUrl,
          filename,
          showFolderPicker,
        }).then((resp) => {
          // Successful background response
          if (resp && resp.success === true) {
            finish({
              success: true,
              code: resp.code || "OK",
              error: null,
              downloadId: resp.downloadId,
            });
            return;
          }

          // Decide if we should fallback to ArrayBuffer route
          const shouldFallback =
            browserName !== "firefox" && // already handled above
            shouldFallbackFromBlobResp(resp);

          if (!shouldFallback) {
            // return the error we got
            finish({
              success: false,
              code: resp?.code || "ERR_BACKGROUND",
              error:
                resp?.error ||
                resp?.__transportError ||
                "Background returned no/invalid response",
            });
            return;
          }

          // Fallback: fetch blob content and send ArrayBuffer
          fetchBlobAsArrayBuffer(blobUrl)
            .then((buffer) =>
              sendMessage("downloadArrayBuffer", {
                buffer,
                filename,
                showFolderPicker,
              })
            )
            .then((resp2) => {
              if (!resp2 || typeof resp2.success !== "boolean") {
                finish({
                  success: false,
                  code: "ERR_NO_RESPONSE",
                  error:
                    resp2?.__transportError ||
                    "Background returned no/invalid response",
                });
                return;
              }
              finish({
                success: resp2.success,
                code: resp2.code || (resp2.success ? "OK" : "ERR_BACKGROUND"),
                error: resp2.error || null,
                downloadId: resp2.downloadId,
              });
            })
            .catch((e) => {
              finish({
                success: false,
                code: "ERR_FETCH_BLOB",
                error: e?.message || String(e),
              });
            });
        });

        return;
      }

      // If we reach here, we have no usable blobUrl
      finish({
        success: false,
        code: "ERR_INVALID_BLOB_URL",
        error: "Invalid or missing blob URL.",
      });
    } catch (e) {
      finish({
        success: false,
        code: "ERR_CONTENT_THROW",
        error: e?.message || String(e),
      });
    }
  });
})();

// ----------------- Resource Injection (unchanged, just scoped tidy) -----------------
(() => {
  // Helper function to check if extension is enabled
  // Note: This runs at document_start, so we use localStorage as immediate fallback
  // The state will be synced from background by the content script
  function isExtensionEnabled() {
    try {
      const stored = localStorage.getItem("tik.tok::extensionEnabled");
      return stored !== "false"; // Default to true if not set
    } catch (err) {
      return true; // Default to enabled
    }
  }

  const resources = [
    { type: "script", src: "js/confetti.browser.min.js", isModule: true },
    { type: "script", src: "js/injex.js", isModule: true },
    { type: "link", href: "styles/injex.css" },
  ];

  const inject = () => {
    // Check if extension is disabled before injecting resources
    if (!isExtensionEnabled()) {
      console.log(
        "[Extension] Extension is disabled. Skipping resource injection."
      );
      return;
    }
    resources.forEach(({ type, href, src, isModule }) => {
      const existing = document.querySelector(
        `${href ? `${type}[href="${chrome.runtime.getURL(href)}"]` : ""}${
          href && src ? ", " : ""
        }${src ? `${type}[src="${chrome.runtime.getURL(src)}"]` : ""}`
      );
      if (existing) return;

      const el = document.createElement(type);
      el.setAttribute("data-injected", "true");

      if (type === "link") {
        el.rel = "stylesheet";
        if (href) el.href = chrome.runtime.getURL(href);
      } else if (type === "script") {
        if (src) {
          el.src = chrome.runtime.getURL(src);
          el.type = isModule ? "module" : "text/javascript";
        }
      }
      (document.head || document.documentElement).appendChild(el);
    });
  };

  inject();

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (
        Array.from(m.addedNodes).some(
          (node) => node.nodeType === 1 && node.tagName === "HEAD"
        )
      ) {
        inject();
        break;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Sync extension state from background (IndexedDB) into localStorage
  // so early page checks see the authoritative value
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    const STATE_KEY = "tik.tok::extensionEnabled";
    let lastKnownEnabled = (() => {
      try {
        const stored = localStorage.getItem(STATE_KEY);
        if (stored === null) return true;
        return stored !== "false";
      } catch {
        return true;
      }
    })();

    const syncFromBackground = () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getState" }, (resp) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            console.warn("Failed to read state from background:", lastErr);
            resolve();
            return;
          }
          if (resp && typeof resp.enabled !== "undefined") {
            const newState = !!resp.enabled;
            lastKnownEnabled = newState;
            try {
              localStorage.setItem(STATE_KEY, resp.enabled ? "true" : "false");
              console.log(
                "[EXT_POWER] content.js synced initial state:",
                newState
              );
            } catch (err) {
              console.warn(
                "Failed to sync extension state to localStorage:",
                err
              );
            }
          }
          resolve();
        });
      });
    };

    const handleStateChange = (enabledNow) => {
      const previousState = lastKnownEnabled;
      lastKnownEnabled = enabledNow;

      try {
        localStorage.setItem(STATE_KEY, enabledNow ? "true" : "false");
      } catch (err) {
        console.warn(
          "Failed to sync extension state change to localStorage:",
          err
        );
      }

      // If extension was disabled and gets enabled again, refresh the page so scripts reattach
      if (previousState === false && enabledNow === true) {
        console.log(
          "[EXT_POWER] content.js triggering page reload (disabled -> enabled transition detected)"
        );
        try {
          setTimeout(() => {
            console.log("[EXT_POWER] content.js executing page reload now");
            window.location.reload();
          }, 200);
        } catch (err) {
          console.warn("[EXT_POWER] Failed to reload page:", err);
        }
      }
    };

    // Set up message listener FIRST before syncing, to catch any broadcasts
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (
          msg?.action === "stateBroadcast" &&
          typeof msg.enabled !== "undefined"
        ) {
          const enabledNow = !!msg.enabled;

          console.log("[EXT_POWER] content.js received stateBroadcast:", {
            enabledNow,
            lastKnownEnabled,
            sender: sender?.id,
          });

          handleStateChange(enabledNow);

          // Respond to acknowledge receipt (for background script)
          if (sendResponse) {
            try {
              sendResponse({ success: true });
            } catch {}
          }
          return true; // Keep channel open for async response
        }

        // Handle resume download action from popup
        if (msg?.action === "resumeDownload") {
          const { payload } = msg;
          const { username, tabName, isCollection, collectionUrl } = payload || {};
          console.log("[Content Script] Received resume request:", {
            username,
            tabName,
            isCollection,
            collectionUrl,
          });

          // Forward to page script via window.postMessage
          window.postMessage(
            {
              type: "RESUME_DOWNLOAD",
              payload: {
                username,
                tabName,
                isCollection,
                collectionUrl,
              },
            },
            "*"
          );

          if (sendResponse) {
            try {
              sendResponse({ success: true });
            } catch {}
          }
          return true;
        }
      });
      console.log("[EXT_POWER] content.js message listener registered");
    }

    // Also listen for chrome.storage changes as a secondary signal
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[STATE_KEY]) return;

        const newVal = changes[STATE_KEY].newValue;
        const enabledNow = !(newVal === "false" || newVal === false);

        console.log("[EXT_POWER] content.js storage.onChanged:", {
          newVal,
          enabledNow,
          lastKnownEnabled,
        });

        handleStateChange(enabledNow);
      });
    }

    // Sync immediately after setting up listener
    syncFromBackground();
  }
})();
