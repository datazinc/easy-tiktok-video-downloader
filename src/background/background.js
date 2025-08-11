const AppStateETTVD = globalThis?.AppStateETTVD || { debug: { active: false } };
if (globalThis) globalThis.AppStateETTVD = AppStateETTVD;

const DEBUG = () => AppStateETTVD?.debug?.active;

function sendOnceFactory(sendResponse) {
  let sent = false;
  return (payload) => {
    if (sent) return;
    sent = true;
    try {
      sendResponse(payload);
    } catch (e) {
      // Last resort: nothing else we can do here
      console.warn("sendResponse failed:", e);
    }
  };
}

function makeError(code, message, extra = {}) {
  return { success: false, code, message, ...extra };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "downloadBlobUrl") return; // not our message

  const respond = sendOnceFactory(sendResponse);

  // Keep the message channel open for async work
  let cleanupTimerId = null;
  let watchdogId = null;
  let blobUrlToRevoke = null;

  const finish = (result) => {
    // Revoke the blob URL shortly after responding (success or failure)
    if (blobUrlToRevoke) {
      cleanupTimerId = setTimeout(() => {
        try {
          if (typeof URL?.revokeObjectURL === "function") {
            URL.revokeObjectURL(blobUrlToRevoke);
          }
        } catch (e) {
          if (DEBUG()) console.warn("Failed to revoke blob URL:", e);
        }
      }, 1500);
    }
    if (watchdogId) clearTimeout(watchdogId);
    respond(result);
  };

  try {
    const payload = message?.payload ?? {};
    const { blobUrl, filename, showFolderPicker } = payload;

    // Validate payload with explicit, user-readable errors
    if (typeof blobUrl !== "string" || !blobUrl.startsWith("blob:")) {
      return finish(
        makeError(
          "ERR_INVALID_BLOB_URL",
          "Invalid blob URL. Expected a 'blob:' URL string.",
          {
            received:
              typeof blobUrl === "string"
                ? blobUrl.slice(0, 64)
                : typeof blobUrl,
          }
        )
      );
    }
    if (typeof filename !== "string" || !filename.trim()) {
      return finish(
        makeError(
          "ERR_INVALID_FILENAME",
          "A non-empty filename string is required."
        )
      );
    }
    if (showFolderPicker != null && typeof showFolderPicker !== "boolean") {
      return finish(
        makeError(
          "ERR_INVALID_SAVEAS_FLAG",
          "showFolderPicker must be a boolean when provided."
        )
      );
    }

    // Keep a reference for later cleanup
    blobUrlToRevoke = blobUrl;

    // Watchdog: ensure we respond even if Chrome never calls the callback
    // (rare, but defensive). 20s is generous for big blobs / slow disks.
    watchdogId = setTimeout(() => {
      finish(
        makeError(
          "ERR_DOWNLOAD_TIMEOUT",
          "Timed out waiting for Chrome.downloads.download callback (20s)."
        )
      );
    }, 20000);
    // Kick off the download
    chrome.downloads.download(
      {
        url: blobUrl,
        filename,
        saveAs: !!showFolderPicker,
        // You can add conflictAction if you want explicit behavior:
        // conflictAction: "uniquify" | "overwrite" | "prompt"
      },
      (downloadId) => {
        const lastErr = chrome.runtime.lastError;

        if (DEBUG()) {
          console.log("DOWNLOAD CALLBACK:", { downloadId, lastErr });
        }

        if (lastErr) {
          return finish(
            makeError(
              "ERR_CHROME_DOWNLOADS",
              lastErr.message || "Download failed"
            )
          );
        }

        if (typeof downloadId !== "number") {
          return finish(
            makeError(
              "ERR_NO_DOWNLOAD_ID",
              "Chrome did not return a downloadId."
            )
          );
        }

        // Success
        finish({ success: true, downloadId });
      }
    );
  } catch (e) {
    // Catch any synchronous throw and propagate details
    const message =
      e && typeof e.message === "string" ? e.message : "Unknown error";
    const stack = e && typeof e.stack === "string" ? e.stack : undefined;
    finish(makeError("ERR_HANDLER_THROW", message, { stack }));
  }

  return true; // keep sendResponse alive for async path
});

if (DEBUG())
  console.log("✅ Background loaded (robust error-propagation enabled)");


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
