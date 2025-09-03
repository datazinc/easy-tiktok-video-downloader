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
        finish({
          success: false,
          code: "ERR_INVALID_FILENAME",
          error: "A non-empty filename string is required.",
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
  const resources = [
    { type: "script", src: "js/confetti.browser.min.js", isModule: true },
    { type: "script", src: "js/injex.js", isModule: true },
    { type: "link", href: "styles/injex.css" },
  ];

  const inject = () => {
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
})();
