// background.js
const AppStateETTVD = globalThis?.AppStateETTVD || { debug: { active: false } };
if (globalThis) globalThis.AppStateETTVD = AppStateETTVD;

const DEBUG = () => !!(AppStateETTVD?.debug?.active);

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

// Optional: simple browser detector (useful for debug logs)
function detectBrowser() {
  if (typeof browser !== "undefined" && typeof browser.runtime !== "undefined") return "firefox";
  if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") return "chrome";
  return "unknown";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message?.action;
  const respond = sendOnceFactory(sendResponse);
  let watchdogId = null;

  if (DEBUG()) console.info("BACKGROUND onMessage:", action, "from", detectBrowser());

  function finish(result) {
    if (watchdogId) clearTimeout(watchdogId);
    respond(result);
  }

  // Keep channel open for async branches
  const KEEP_ALIVE = true;

  // ---- download via ArrayBuffer (works in both Chrome and Firefox) ----
  if (action === "downloadArrayBuffer") {
    try {
      const payload = message?.payload ?? {};
      const { buffer, filename, showFolderPicker } = payload;

      if (!(buffer instanceof ArrayBuffer) && !(buffer?.buffer instanceof ArrayBuffer)) {
        return finish(makeError("ERR_INVALID_BUFFER", "payload.buffer must be an ArrayBuffer"));
      }
      if (typeof filename !== "string" || !filename.trim()) {
        return finish(makeError("ERR_INVALID_FILENAME", "A non-empty filename string is required."));
      }
      if (showFolderPicker != null && typeof showFolderPicker !== "boolean") {
        return finish(makeError("ERR_INVALID_SAVEAS_FLAG", "showFolderPicker must be a boolean when provided."));
      }

      const blob = new Blob([buffer instanceof ArrayBuffer ? buffer : buffer.buffer]);
      const objUrl = URL.createObjectURL(blob);

      // Watchdog in case the downloads callback never fires
      watchdogId = setTimeout(() => {
        try { URL.revokeObjectURL(objUrl); } catch {}
        finish(makeError("ERR_DOWNLOAD_TIMEOUT", "Timed out waiting for chrome.downloads.download callback (20s)."));
      }, 20000);

      if (DEBUG()) console.info("DOWNLOAD (ArrayBuffer) →", filename);

      chrome.downloads.download(
        {
          url: objUrl,
          filename,
          saveAs: showFolderPicker === undefined ? true : !!showFolderPicker,
          // conflictAction: "uniquify", // or "overwrite" | "prompt"
        },
        (downloadId) => {
          const lastErr = chrome.runtime.lastError;

          if (lastErr) {
            try { URL.revokeObjectURL(objUrl); } catch {}
            return finish(makeError("ERR_CHROME_DOWNLOADS", lastErr.message || "Download failed"));
          }

          if (typeof downloadId !== "number") {
            try { URL.revokeObjectURL(objUrl); } catch {}
            return finish(makeError("ERR_NO_DOWNLOAD_ID", "chrome.downloads.download did not return a downloadId."));
          }

          // Revoke our background-owned blob URL shortly after success
          setTimeout(() => {
            try { URL.revokeObjectURL(objUrl); } catch (e) {
              if (DEBUG()) console.warn("revokeObjectURL (ArrayBuffer) failed:", e);
            }
          }, 5000);

          finish({ success: true, downloadId });
        }
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
      const { blobUrl, filename, showFolderPicker } = payload;

      if (typeof blobUrl !== "string" || !blobUrl.startsWith("blob:")) {
        return finish(
          makeError("ERR_INVALID_BLOB_URL", "Invalid blob URL. Expected a 'blob:' URL string.", {
            received: typeof blobUrl === "string" ? blobUrl.slice(0, 64) : typeof blobUrl,
          })
        );
      }
      if (typeof filename !== "string" || !filename.trim()) {
        return finish(makeError("ERR_INVALID_FILENAME", "A non-empty filename string is required."));
      }
      if (showFolderPicker != null && typeof showFolderPicker !== "boolean") {
        return finish(makeError("ERR_INVALID_SAVEAS_FLAG", "showFolderPicker must be a boolean when provided."));
      }

      // Note: This blob URL belongs to the page context; background CAN’T revoke it.
      // We simply attempt the download; if Firefox or Chrome rejects, the caller can fallback.

      watchdogId = setTimeout(() => {
        finish(makeError("ERR_DOWNLOAD_TIMEOUT", "Timed out waiting for chrome.downloads.download callback (20s)."));
      }, 20000);

      if (DEBUG()) console.info("DOWNLOAD (blob URL) →", filename);

      chrome.downloads.download(
        {
          url: blobUrl,
          filename,
          saveAs: showFolderPicker === undefined ? true : !!showFolderPicker,
          // conflictAction: "uniquify",
        },
        (downloadId) => {
          const lastErr = chrome.runtime.lastError;

          if (DEBUG()) {
            console.log("DOWNLOAD CALLBACK:", { downloadId, lastErr });
          }

          if (lastErr) {
            // Surface precise error so the content script can decide to fallback
            return finish(makeError("ERR_CHROME_DOWNLOADS", lastErr.message || "Download failed"));
          }

          if (typeof downloadId !== "number") {
            return finish(makeError("ERR_NO_DOWNLOAD_ID", "chrome.downloads.download did not return a downloadId."));
          }

          finish({ success: true, downloadId });
        }
      );
    } catch (e) {
      finish(makeError("ERR_HANDLER_THROW", e?.message || String(e), { stack: e?.stack }));
    }

    return KEEP_ALIVE;
  }

  // Unknown action → ignore (do not keep the channel open)
  return false;
});

if (DEBUG()) console.log("✅ Background loaded (cross-browser downloads enabled)");

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
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("uninstall-meta", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const store = tx.objectStore("kv");
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
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
  await ensureInstallMeta();
});

async function refreshUninstallURL() {
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
