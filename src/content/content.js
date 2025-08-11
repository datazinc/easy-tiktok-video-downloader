// content.js
(function () {
  const DEBUG = () => globalThis?.AppStateETTVD?.debug?.active ?? false;

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
        // last-ditch best effort
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

  window.addEventListener("message", (event) => {
    // Only accept messages from the page itself
    if (event.source !== window) return;

    const data = event.data;
    if (!data || data.type !== "BLOB_DOWNLOAD_REQUEST") return;

    const { id, payload } = data;
    const reply = respondOnce(id);

    // 25s watchdog to avoid hangs if bg never answers
    const watchdog = setTimeout(() => {
      reply({
        success: false,
        code: "ERR_CONTENT_TIMEOUT",
        error: "Timed out waiting for background response (25s)",
      });
    }, 25000);

    try {
      chrome.runtime.sendMessage(
        { action: "downloadBlobUrl", payload },
        (response) => {
          clearTimeout(watchdog);
          const lastErr = chrome.runtime.lastError;

          if (lastErr) {
            if (DEBUG())
              console.warn("sendMessage lastError:", lastErr.message);
            return reply({
              success: false,
              code: "ERR_RUNTIME_SENDMESSAGE",
              error: lastErr.message,
            });
          }

          if (!response || typeof response.success !== "boolean") {
            return reply({
              success: false,
              code: "ERR_NO_RESPONSE",
              error: "Background returned no/invalid response",
            });
          }

          reply({
            success: response.success,
            code: response.code || (response.success ? "OK" : "ERR_BACKGROUND"),
            error: response.error || null,
            downloadId: response.downloadId,
          });
        }
      );
    } catch (e) {
      clearTimeout(watchdog);
      reply({
        success: false,
        code: "ERR_CONTENT_THROW",
        error: e?.message || String(e),
      });
    }
  });
})();

(function injectResources() {
  const resources = [
    {
      type: "script",
      src: "js/confetti.browser.min.js",
      isModule: true,
    },
    {
      type: "script",
      src: "js/injex.js",
      isModule: true,
    },
    { type: "link", href: "styles/injex.css" },
  ];

  const inject = () => {
    resources.forEach(({ type, href, src, isModule }) => {
      const existing = document.querySelector(
        `${href ? `${type}[href="${chrome.runtime.getURL(href)}"]` : ""}${
          href && src ? ", " : ""
        }${src ? `${type}[src="${chrome.runtime.getURL(src)}"]` : ""}`
      );
      if (existing) return; // Skip if already injected

      const element = document.createElement(type);
      element.setAttribute("data-injected", "true"); // Mark as injected

      if (type === "link") {
        element.rel = "stylesheet";
        if (href) {
          element.href = chrome.runtime.getURL(href);
        }
      } else if (type === "script") {
        if (src) {
          element.src = chrome.runtime.getURL(src);
          element.type = isModule ? "module" : "text/javascript";
        }
      }

      (document.head || document.documentElement).appendChild(element);
    });
  };

  inject();

  // Observe DOM changes only for specific cases
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        Array.from(mutation.addedNodes).some(
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
