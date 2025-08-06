(function injectResources() {
  const resources = [
    {
      type: "script",
      src: "src/modules/networking/networkInterceptor.js",
      isModule: true,
    },
    {
      type: "script",
      src: "src/js/confetti.browser.min.js",
      isModule: true,
    },
    { type: "link", href: "src/styles/injex.css" },
    { type: "script", src: "src/index.js", isModule: true },
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
