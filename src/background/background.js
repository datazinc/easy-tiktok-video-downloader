// background.js
const AppStateETTVD = globalThis?.AppStateETTVD || { debug: { active: false } };
if (globalThis) globalThis.AppStateETTVD = AppStateETTVD;

const DEBUG = () => !!AppStateETTVD?.debug?.active;
const EXTENSION_ENABLED_KEY = "tik.tok::extensionEnabled";
const PROGRESS_KEY = "tik.tok::downloadProgress";

// Seed enabled flag on install if missing
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await idbDataGet(EXTENSION_ENABLED_KEY);
    if (existing === undefined || existing === null) {
      await idbDataSet(EXTENSION_ENABLED_KEY, "true");
      if (DEBUG())
        console.log("[COM_EXT] seeded enabled=true on install (IDB)");
    }
  } catch (err) {
    console.warn("[COM_EXT] seed failed", err);
  }
});

function sendOnceFactory(sendResponse) {
  let sent = false;
  return (payload) => {
    if (sent) return;
    sent = true;
    try {
      sendResponse(payload);
    } catch (e) {
      console.warn("sendResponse failed:", e);
    }
  };
}

function makeError(code, message, extra = {}) {
  // include both `error` and `message` for callers that expect either
  return { success: false, code, error: message, message, ...extra };
}

function detectBrowserUA() {
  const ua =
    typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
      ? navigator.userAgent
      : "";

  if (/firefox/i.test(ua)) return "firefox";
  if (/edge|edg/i.test(ua)) return "edge";
  if (/opr|opera/i.test(ua)) return "opera";
  if (/chrome|chromium|crios/i.test(ua) && !/edge|edg|opr|opera/i.test(ua))
    return "chrome";
  if (/safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua)) return "safari";

  return "unknown";
}

function detectBrowserFromRuntime() {
  const runtime =
    typeof chrome !== "undefined" && chrome?.runtime
      ? chrome.runtime
      : typeof browser !== "undefined" && browser?.runtime
        ? browser.runtime
        : null;

  if (!runtime || typeof runtime.getURL !== "function") {
    return null;
  }

  try {
    const extensionUrl = runtime.getURL("/");

    if (typeof extensionUrl === "string") {
      if (extensionUrl.startsWith("moz-extension://")) return "firefox";
      if (extensionUrl.startsWith("chrome-extension://")) return "chrome";
      if (extensionUrl.startsWith("safari-web-extension://")) return "safari";
    }
  } catch {}

  return null;
}

// Optional: simple browser detector (useful for debug logs)
function detectBrowser() {
  return detectBrowserFromRuntime() || detectBrowserUA();
}

function supportsUninstallTelemetry() {
  return detectBrowser() !== "firefox";
}

function isArrayBuffer(value) {
  return (
    value instanceof ArrayBuffer ||
    Object.prototype.toString.call(value) === "[object ArrayBuffer]"
  );
}

function getArrayBuffer(value) {
  if (isArrayBuffer(value)) {
    return value;
  }

  if (ArrayBuffer.isView(value) && isArrayBuffer(value.buffer)) {
    const start = value.byteOffset || 0;
    const end = start + value.byteLength;
    return start === 0 && end === value.buffer.byteLength
      ? value.buffer
      : value.buffer.slice(start, end);
  }

  if (value && isArrayBuffer(value.buffer)) {
    const start =
      typeof value.byteOffset === "number" && value.byteOffset >= 0
        ? value.byteOffset
        : 0;
    const end =
      typeof value.byteLength === "number" && value.byteLength >= 0
        ? start + value.byteLength
        : value.buffer.byteLength;
    return start === 0 && end === value.buffer.byteLength
      ? value.buffer
      : value.buffer.slice(start, end);
  }

  return null;
}

function describeBinaryPayload(value) {
  return {
    type: value == null ? String(value) : typeof value,
    tag: value == null ? null : Object.prototype.toString.call(value),
    constructorName: value?.constructor?.name || null,
    isView: ArrayBuffer.isView(value),
    byteLength: typeof value?.byteLength === "number" ? value.byteLength : null,
    hasBuffer: !!value?.buffer,
    bufferTag:
      value?.buffer == null
        ? null
        : Object.prototype.toString.call(value.buffer),
    ownKeysSample:
      value && typeof value === "object"
        ? Object.keys(value).slice(0, 8)
        : null,
  };
}

function summarizeDownloadPayload(payload) {
  const arrayBuffer = getArrayBuffer(payload?.buffer);

  return {
    requestId: payload?.requestId || null,
    filename: payload?.filename || null,
    filenameLength:
      typeof payload?.filename === "string" ? payload.filename.length : null,
    showFolderPicker:
      typeof payload?.showFolderPicker === "boolean"
        ? payload.showFolderPicker
        : null,
    blobUrlPrefix:
      typeof payload?.blobUrl === "string"
        ? payload.blobUrl.slice(0, 32)
        : null,
    bufferBytes: arrayBuffer ? arrayBuffer.byteLength : null,
  };
}

function summarizeSender(sender) {
  return {
    frameId: sender?.frameId ?? null,
    tabId: sender?.tab?.id ?? null,
    url: sender?.url || sender?.tab?.url || null,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message?.action;
  const respond = sendOnceFactory(sendResponse);
  let watchdogId = null;

  if (DEBUG())
    console.info("BACKGROUND onMessage:", action, "from", detectBrowser());

  function finish(result) {
    if (watchdogId) clearTimeout(watchdogId);
    respond(result);
  }

  // Keep channel open for async branches
  const KEEP_ALIVE = true;

  if (action === "getState") {
    (async () => {
      try {
        const val = await idbDataGet(EXTENSION_ENABLED_KEY);
        const enabled = !(val === "false" || val === false);
        if (DEBUG())
          console.log("[COM_EXT] background getState ->", enabled, "raw:", val);
        finish({ enabled });
      } catch (err) {
        console.warn("[COM_EXT] getState failed", err);
        finish({ enabled: true });
      }
    })();
    return KEEP_ALIVE;
  }

  if (action === "toggleState") {
    const enabled = !!message?.enabled;
    (async () => {
      try {
        await idbDataSet(EXTENSION_ENABLED_KEY, enabled ? "true" : "false");

        // Also mirror state into chrome.storage for cross-context updates
        try {
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(
              { [EXTENSION_ENABLED_KEY]: enabled ? "true" : "false" },
              () => {
                if (chrome.runtime?.lastError && DEBUG()) {
                  console.warn(
                    "[COM_EXT] storage.set error (non-fatal):",
                    chrome.runtime.lastError,
                  );
                }
              },
            );
          }
        } catch (err) {
          if (DEBUG())
            console.warn("[COM_EXT] storage.set failed (non-fatal):", err);
        }

        if (DEBUG())
          console.log("[COM_EXT] background toggleState ->", enabled);

        const broadcastMsg = { action: "stateBroadcast", enabled };

        // Broadcast via runtime.sendMessage for popup and all listeners
        try {
          chrome.runtime.sendMessage(broadcastMsg, () => {
            // Ignore errors - some listeners might not be ready
            if (chrome.runtime.lastError && DEBUG()) {
              console.log(
                "[COM_EXT] runtime.sendMessage error (expected):",
                chrome.runtime.lastError.message,
              );
            }
          });
        } catch (err) {
          if (DEBUG())
            console.warn("[COM_EXT] runtime.sendMessage failed", err);
        }

        finish({ success: true, enabled });
      } catch (err) {
        console.warn("[COM_EXT] toggleState failed", err);
        finish({ success: false, error: String(err) });
      }
    })();
    return KEEP_ALIVE;
  }

  if (action === "getProgress") {
    (async () => {
      try {
        const data = (await idbDataGet(PROGRESS_KEY)) || {};
        if (DEBUG()) console.log("[COM_EXT] background getProgress", data);
        finish({ success: true, progress: data });
      } catch (err) {
        console.warn("[COM_EXT] getProgress failed", err);
        finish({ success: false, error: String(err) });
      }
    })();
    return KEEP_ALIVE;
  }

  if (action === "setProgress") {
    (async () => {
      try {
        const progress = message?.progress || {};
        await idbDataSet(PROGRESS_KEY, progress);
        if (DEBUG())
          console.log("[COM_EXT] background setProgress saved", progress);
        finish({ success: true });
      } catch (err) {
        console.warn("[COM_EXT] setProgress failed", err);
        finish({ success: false, error: String(err) });
      }
    })();
    return KEEP_ALIVE;
  }

  if (action === "clearProgress") {
    (async () => {
      try {
        await idbDataSet(PROGRESS_KEY, {});
        if (DEBUG()) console.log("[COM_EXT] background clearProgress");
        finish({ success: true });
      } catch (err) {
        console.warn("[COM_EXT] clearProgress failed", err);
        finish({ success: false, error: String(err) });
      }
    })();
    return KEEP_ALIVE;
  }

  if (action === "getCollectionUrl") {
    (async () => {
      try {
        const { username, tabName } = message || {};
        if (!username || !tabName) {
          finish({ success: false, error: "Missing username or tabName" });
          return;
        }

        const progress = (await idbDataGet(PROGRESS_KEY)) || {};
        const normalizedUsername = username.toLowerCase().trim();
        const metadataKey = `_${tabName}_url`;
        const collectionUrl =
          progress[normalizedUsername]?._metadata?.[metadataKey] || null;

        if (DEBUG())
          console.log("[COM_EXT] background getCollectionUrl", {
            username: normalizedUsername,
            tabName,
            collectionUrl,
          });
        finish({ success: true, collectionUrl });
      } catch (err) {
        console.warn("[COM_EXT] getCollectionUrl failed", err);
        finish({ success: false, error: String(err) });
      }
    })();
    return KEEP_ALIVE;
  }

  // ---- download via ArrayBuffer (works in both Chrome and Firefox) ----
  if (action === "downloadArrayBuffer") {
    try {
      const payload = message?.payload ?? {};
      const { buffer, filename, requestId, showFolderPicker } = payload;
      const senderSummary = summarizeSender(sender);
      const arrayBuffer = getArrayBuffer(buffer);

      if (!arrayBuffer) {
        console.error("[Background] ❌ Invalid ArrayBuffer payload:", {
          ...summarizeDownloadPayload(payload),
          buffer: describeBinaryPayload(buffer),
          sender: senderSummary,
        });
        return finish(
          makeError(
            "ERR_INVALID_BUFFER",
            "payload.buffer must be an ArrayBuffer",
          ),
        );
      }
      if (typeof filename !== "string" || !filename.trim()) {
        const errorMsg = `Invalid filename in downloadArrayBuffer: expected non-empty string, got ${typeof filename}${
          filename
            ? ` (length: ${filename.length}, contains: "${String(
                filename,
              ).slice(0, 50)}")`
            : ""
        }`;
        console.error(
          "[Background] ❌ Filename validation failed (ArrayBuffer):",
          {
            requestId,
            filename,
            type: typeof filename,
            trimmed: filename?.trim(),
            error: errorMsg,
            sender: senderSummary,
          },
        );
        return finish(makeError("ERR_INVALID_FILENAME", errorMsg));
      }
      if (showFolderPicker != null && typeof showFolderPicker !== "boolean") {
        return finish(
          makeError(
            "ERR_INVALID_SAVEAS_FLAG",
            "showFolderPicker must be a boolean when provided.",
          ),
        );
      }

      const blob = new Blob([arrayBuffer]);
      const objUrl = URL.createObjectURL(blob);
      const saveAs = showFolderPicker === undefined ? true : !!showFolderPicker;

      if (DEBUG()) {
        console.warn(
          "[Background] Starting chrome.downloads.download from ArrayBuffer",
          {
            ...summarizeDownloadPayload(payload),
            saveAs,
            browser: detectBrowser(),
            sender: senderSummary,
          },
        );
      }

      // Watchdog in case the downloads callback never fires
      watchdogId = setTimeout(() => {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {}
        console.error(
          "[Background] ❌ chrome.downloads.download timed out (ArrayBuffer):",
          {
            requestId,
            filename,
            saveAs,
            sender: senderSummary,
          },
        );
        finish(
          makeError(
            "ERR_DOWNLOAD_TIMEOUT",
            "Timed out waiting for chrome.downloads.download callback (20s).",
          ),
        );
      }, 20000);

      if (DEBUG()) console.info("DOWNLOAD (ArrayBuffer) →", filename);

      chrome.downloads.download(
        {
          url: objUrl,
          filename,
          saveAs,
          // conflictAction: "uniquify", // or "overwrite" | "prompt"
        },
        (downloadId) => {
          const lastErr = chrome.runtime.lastError;

          if (lastErr) {
            try {
              URL.revokeObjectURL(objUrl);
            } catch {}
            const errorMsg = `Chrome downloads API error: ${
              lastErr.message || "Download failed"
            }${filename ? ` (filename: "${filename.slice(0, 100)}")` : ""}`;
            console.error(
              "[Background] ❌ Chrome downloads.download failed (ArrayBuffer):",
              {
                requestId,
                error: lastErr.message,
                filename,
                filenameLength: filename?.length,
                hasUnicode: filename ? /[^\x00-\x7F]/.test(filename) : false,
                saveAs,
                sender: senderSummary,
              },
            );
            return finish(makeError("ERR_CHROME_DOWNLOADS", errorMsg));
          }

          if (typeof downloadId !== "number") {
            try {
              URL.revokeObjectURL(objUrl);
            } catch {}
            console.error(
              "[Background] ❌ chrome.downloads.download returned no downloadId (ArrayBuffer):",
              {
                requestId,
                filename,
                saveAs,
                sender: senderSummary,
              },
            );
            return finish(
              makeError(
                "ERR_NO_DOWNLOAD_ID",
                "chrome.downloads.download did not return a downloadId.",
              ),
            );
          }

          // Revoke our background-owned blob URL shortly after success
          setTimeout(() => {
            try {
              URL.revokeObjectURL(objUrl);
            } catch (e) {
              if (DEBUG())
                console.warn("revokeObjectURL (ArrayBuffer) failed:", e);
            }
          }, 5000);

          finish({ success: true, downloadId });
        },
      );
    } catch (e) {
      finish(makeError("ERR_HANDLER_THROW", e?.message || String(e)));
    }

    return KEEP_ALIVE;
  }

  // ---- download via page-provided blob: URL (Chrome-friendly; Firefox will reject) ----
  if (action === "downloadBlobUrl") {
    try {
      const payload = message?.payload ?? {};
      const { blobUrl, filename, requestId, showFolderPicker } = payload;
      const senderSummary = summarizeSender(sender);

      if (typeof blobUrl !== "string" || !blobUrl.startsWith("blob:")) {
        console.error("[Background] ❌ Invalid blob URL payload:", {
          ...summarizeDownloadPayload(payload),
          sender: senderSummary,
        });
        return finish(
          makeError(
            "ERR_INVALID_BLOB_URL",
            "Invalid blob URL. Expected a 'blob:' URL string.",
            {
              received:
                typeof blobUrl === "string"
                  ? blobUrl.slice(0, 64)
                  : typeof blobUrl,
            },
          ),
        );
      }
      if (typeof filename !== "string" || !filename.trim()) {
        const errorMsg = `Invalid filename in downloadBlobUrl: expected non-empty string, got ${typeof filename}${
          filename
            ? ` (length: ${filename.length}, contains: "${String(
                filename,
              ).slice(0, 50)}")`
            : ""
        }`;
        console.error("[Background] ❌ Filename validation failed (BlobUrl):", {
          requestId,
          filename,
          type: typeof filename,
          trimmed: filename?.trim(),
          error: errorMsg,
          sender: senderSummary,
        });
        return finish(makeError("ERR_INVALID_FILENAME", errorMsg));
      }
      if (showFolderPicker != null && typeof showFolderPicker !== "boolean") {
        return finish(
          makeError(
            "ERR_INVALID_SAVEAS_FLAG",
            "showFolderPicker must be a boolean when provided.",
          ),
        );
      }

      // Note: This blob URL belongs to the page context; background CAN’T revoke it.
      // We simply attempt the download; if Firefox or Chrome rejects, the caller can fallback.

      const saveAs = showFolderPicker === undefined ? true : !!showFolderPicker;

      if (DEBUG()) {
        console.warn(
          "[Background] Starting chrome.downloads.download from blob URL",
          {
            ...summarizeDownloadPayload(payload),
            saveAs,
            browser: detectBrowser(),
            sender: senderSummary,
          },
        );
      }

      watchdogId = setTimeout(() => {
        console.error(
          "[Background] ❌ chrome.downloads.download timed out (BlobUrl):",
          {
            requestId,
            filename,
            saveAs,
            sender: senderSummary,
          },
        );
        finish(
          makeError(
            "ERR_DOWNLOAD_TIMEOUT",
            "Timed out waiting for chrome.downloads.download callback (20s).",
          ),
        );
      }, 20000);

      if (DEBUG()) console.info("DOWNLOAD (blob URL) →", filename);

      chrome.downloads.download(
        {
          url: blobUrl,
          filename,
          saveAs,
          // conflictAction: "uniquify",
        },
        (downloadId) => {
          const lastErr = chrome.runtime.lastError;

          if (DEBUG()) {
            console.log("DOWNLOAD CALLBACK:", { downloadId, lastErr });
          }

          if (lastErr) {
            // Surface precise error so the content script can decide to fallback
            const errorMsg = `Chrome downloads API error: ${
              lastErr.message || "Download failed"
            }${filename ? ` (filename: "${filename.slice(0, 100)}")` : ""}`;
            console.error(
              "[Background] ❌ Chrome downloads.download failed (BlobUrl):",
              {
                requestId,
                error: lastErr.message,
                filename,
                filenameLength: filename?.length,
                hasUnicode: filename ? /[^\x00-\x7F]/.test(filename) : false,
                saveAs,
                sender: senderSummary,
              },
            );
            return finish(makeError("ERR_CHROME_DOWNLOADS", errorMsg));
          }

          if (typeof downloadId !== "number") {
            console.error(
              "[Background] ❌ chrome.downloads.download returned no downloadId (BlobUrl):",
              {
                requestId,
                filename,
                saveAs,
                sender: senderSummary,
              },
            );
            return finish(
              makeError(
                "ERR_NO_DOWNLOAD_ID",
                "chrome.downloads.download did not return a downloadId.",
              ),
            );
          }

          finish({ success: true, downloadId });
        },
      );
    } catch (e) {
      finish(
        makeError("ERR_HANDLER_THROW", e?.message || String(e), {
          stack: e?.stack,
        }),
      );
    }

    return KEEP_ALIVE;
  }

  // Unknown action → ignore (do not keep the channel open)
  return false;
});

if (DEBUG())
  console.log("✅ Background loaded (cross-browser downloads enabled)");

// background.js (MV3) — no chrome.storage, uses IndexedDB

const FORM = {
  ID: "1FAIpQLSffgRV8RnpECLl-S2GiS-ChMvlO-KKWzIrP9fF6TipKcGtNfQ",
  entries: {
    reason: "entry.639071765",
    comments: "entry.1143690280",
    nps: "entry.2017892424",

    extension_version: "entry.237420762",
    installed_at: "entry.1114905105",
    days_used: "entry.736618219",
    platform: "entry.1118263614",
    ui_language: "entry.499043465",
    anon_id: "entry.1638558729",
  },
};

const STORAGE_KEYS = {
  installedAt: "tik.tok::installedAt",
  anonId: "tik.tok::anonId",
};

/* -------------------- tiny IndexedDB KV -------------------- */
function openDB(name = "uninstall-meta") {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB("uninstall-meta");
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const store = tx.objectStore("kv");
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB("uninstall-meta");
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function idbDataGet(key) {
  const db = await openDB("ettvd-data");
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const store = tx.objectStore("kv");
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbDataSet(key, value) {
  const db = await openDB("ettvd-data");
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
/* ----------------------------------------------------------- */

// ——— utils ———
function genAnonId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function ensureInstallMeta() {
  let installedAt = await idbGet(STORAGE_KEYS.installedAt);
  let anonId = await idbGet(STORAGE_KEYS.anonId);

  if (!installedAt) {
    installedAt = Date.now();
    await idbSet(STORAGE_KEYS.installedAt, installedAt);
  }
  if (!anonId) {
    anonId = genAnonId();
    await idbSet(STORAGE_KEYS.anonId, anonId);
  }

  return { installedAt, anonId };
}

function daysBetween(msThen, msNow = Date.now()) {
  return Math.max(0, Math.floor((msNow - msThen) / 86400000));
}

function buildFormURL(params) {
  const base = `https://docs.google.com/forms/d/e/${FORM.ID}/viewform?usp=pp_url`;
  const q = new URLSearchParams();

  const set = (k, v) => v != null && q.set(FORM.entries[k], String(v));

  set("extension_version", params.extension_version);
  set("installed_at", params.installed_at); // ISO string
  set("days_used", params.days_used);
  set("ui_language", params.ui_language);
  set("platform", params.platform);
  set("anon_id", params.anon_id);

  // leave visible fields for user
  // set("reason", "Too slow");
  // set("nps", "10");
  // set("comments", "…");

  return `${base}&${q.toString()}`;
}

// ——— lifecycle ———
chrome.runtime.onInstalled.addListener(async () => {
  if (!supportsUninstallTelemetry()) {
    return;
  }

  await ensureInstallMeta();
});

async function refreshUninstallURL() {
  if (!supportsUninstallTelemetry()) {
    return;
  }

  const { installedAt, anonId } = await ensureInstallMeta();

  const version = chrome.runtime.getManifest().version;
  const uiLang = chrome.i18n.getUILanguage();
  const plat = await chrome.runtime.getPlatformInfo(); // { os, arch, nacl_arch }
  const platformStr = `${plat.os}/${plat.arch}`;

  const url = buildFormURL({
    extension_version: version,
    installed_at: new Date(installedAt).toISOString(),
    days_used: daysBetween(installedAt),
    ui_language: uiLang,
    platform: platformStr,
    anon_id: anonId,
  });

  chrome.runtime.setUninstallURL(url);
  console.log("[uninstall] URL set:", url);
}

chrome.runtime.onStartup?.addListener(() => {
  refreshUninstallURL().catch((e) => console.error(e));
});

// run once on load
refreshUninstallURL().catch((e) => console.error(e));
