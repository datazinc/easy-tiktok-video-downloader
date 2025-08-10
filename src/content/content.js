window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "BLOB_DOWNLOAD_REQUEST") {
    try {
      chrome.runtime.sendMessage(
        {
          action: "downloadBlobUrl",
          payload: event.data.payload,
        },
        (response) => {
          // Send result back to page
          window.postMessage(
            {
              type: "BLOB_DOWNLOAD_RESPONSE",
              success: response?.success || false,
              error: response?.error || null,
            },
            "*"
          );
        }
      );
    } catch (error) {
      console.warn("SOME MAJOR LEAGUE ERROR:  ", error);
      try {
        const response = { success: false, error: error };
        window.postMessage(
            {
              type: "BLOB_DOWNLOAD_RESPONSE",
              success: response?.success || false,
              error: response?.error || null,
            },
            "*"
          );
      } catch (err) {
      console.warn("SOME MAJOR LEAGUE ERROR sending back:  ", error);
        
      }
    }
  }
});

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
