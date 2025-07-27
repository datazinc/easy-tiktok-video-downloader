(function injectResources() {
  const s = document.createElement("script");
  s.type = "module";
  s.src = chrome.runtime.getURL("src/modules/networking/networkInterceptor.js");
  (document.head || document.documentElement).appendChild(s);

  const resources = [
    { type: "link", href: "src/styles/injex.css" },
    // { type: "link", href: "src/styles/style.css" },
    { type: "script", src: "src/index.js", isModule: true },
  ];

  const inject = () => {
    console.log("ettvdebugger: Injecting resources...");
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
      console.log(`ettvdebugger Injected ${type}: ${href || src}`, element);
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
