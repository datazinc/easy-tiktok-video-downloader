// downloader.js
import AppState from "../state/state.js";
import { DOM_IDS, DOWNLOAD_FOLDER_DEFAULT } from "../state/constants.js";
import { getCurrentPageUsername, getPostsHash } from "../utils/utils.js";
import {
  createDownloaderWrapper,
  updateDownloaderList,
  showEmptyState,
  buildVideoLinkMeta,
  updateDownloadButtonLabel,
  hideDownloader,
  showRateUsPopUp,
} from "./ui.js";
import { getDownloadFilePath } from "../utils/utils.js";
console.log("ettvdebugger: AppState reinitialized", AppState);

// Renders/freshens the floating panel
export function displayFoundUrls({ forced } = {}) {
  console.log("ettvdebugger: displayFoundUrls called", { forced });
  if (AppState.ui.isDownloaderClosed) return hideDownloader();
  // Think about cases the user moves to another page while downloading
  // They are not seing any progress on the downloader, re-render it
  if (
    (AppState.downloading.isActive || AppState.downloading.isDownloadingAll) &&
    document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER)
  ) {
    console.log(
      "ettvdebugger: Downloader is active or downloading all, not re-rendering",
      {
        forced,
        isActive: AppState.downloading.isActive,
        isDownloadingAll: AppState.downloading.isDownloadingAll,
      }
    );
    return;
  }
  console.log("ettvdebugger: Current downloader state", AppState.downloading);

  let items = [];
  if (AppState.filters.currentProfile) {
    items = AppState.postItems[getCurrentPageUsername()] || [];
  } else if (AppState.filters.likedVideos) {
    items = AppState.likedVideos[getCurrentPageUsername()] || [];
  } else {
    items = Object.values(AppState.postItems).flat();
  }
  console.log("ettvdebugger: Found items", items);

  const hash = getPostsHash(items);
  const path = window.location.pathname;
  console.log("ettvdebugger: Current hash and path", { forced, hash, path });
  if (
    !forced &&
    AppState.displayedState.itemsHash === hash &&
    AppState.displayedState.path === path
  ) {
    console.log("ettvdebugger: No changes detected, skipping re-render");
    return;
  } else {
    // console why changes are detected
    console.log("ettvdebugger: Changes", { forced, hash, path });
    if (forced) {
      console.log("ettvdebugger: Forced re-render");
    }
    if (AppState.displayedState.itemsHash !== hash) {
      console.log("ettvdebugger: Items hash changed", {
        old: AppState.displayedState.itemsHash,
        new: hash,
      });
    } else if (AppState.displayedState.path !== path) {
      console.log("ettvdebugger: Path changed", {
        old: AppState.displayedState.path,
        new: path,
      });
    } else {
      // This is a fallback, should not happen if the logic is correct
      console.warn("ettvdebugger: Unexpected state, re-rendering anyway");
    }
    console.log("ettvdebugger: Changes detected, re-rendering");
  }

  console.log("ettvdebugger: Setting itemsHash to:", hash);
  AppState.displayedState.itemsHash = hash;
  console.log(
    "ettvdebugger: Current itemsHash:",
    AppState.displayedState.itemsHash
  );
  AppState.displayedState.path = path;

  console.log(
    "ettvdebugger: Creating downloader wrapper",
    structuredClone(AppState)
  );
  console.log("ettvdebugger: Creating downloader wrapper", AppState);
  const wrapper = createDownloaderWrapper();

  console.log("ettvdebugger: Downloader wrapper created", wrapper);
  if (items.length === 0) {
    updateDownloaderList(wrapper, [], () => {});
    document.body?.appendChild(wrapper);
    return;
  }

  AppState.allDirectLinks = [];
  console.log("ettvdebugger: Building video link metas");
  const metas = items.map((media, idx) => {
    const meta = buildVideoLinkMeta(media, idx);

    AppState.allDirectLinks.push(meta);

    return meta;
  });

  console.log("ettvdebugger: Video link metas built", metas);
  updateDownloaderList(wrapper, metas, downloadSingleVideo);
  console.log("ettvdebugger: Downloader list updated");
  document.body?.appendChild(wrapper);
  console.log("ettvdebugger: Downloader wrapper appended to body");
}

// Download one video
async function downloadSingleVideo(media) {
  const filename = getDownloadFilePath(media);
  try {
    return await downloadURLToDisk(media.url, filename);
  } catch (err) {
    return console.warn(err);
  }
}

// Batch download
export async function downloadAllLinks(mainBtn) {
  console.log("ettvdebugger: Starting batch download");
  AppState.downloading.isDownloadingAll = true;
  const links = AppState.allDirectLinks || [];
  console.log("ettvdebugger: Batch download links", links.length, links);
  let newVideoDownloaded = false;
  for (let i = 0; i < links.length; i++) {
    const media = links[i];
    if (AppState.downloadedURLs.includes(media.url)) continue;
    AppState.downloadedURLs.push(media.url);
    newVideoDownloaded = true;
    const filepath = getDownloadFilePath(media);
    console.log("ettvdebugger: Downloading", {
      url: media.url,
      filepath,
    });
    try {
      updateDownloadButtonLabel(
        mainBtn,
        `Downloading ${i + 1} of ${links.length}`
      );

      await downloadURLToDisk(media.url, filepath);
    } catch (err) {
      console.warn(err);
      updateDownloadButtonLabel(mainBtn, `Error at ${i + 1}/${links.length}`);
    }
  }
  if (!newVideoDownloaded && AppState.downloadedURLs.length > 0) {
    updateDownloadButtonLabel(
      mainBtn,
      `All ${AppState.downloadedURLs.length} Videos Already Downloaded!`
    );
  } else {
    updateDownloadButtonLabel(mainBtn, `Downloaded ${links.length} Videos!`);
  }
  console.log("ettvdebugger: Batch download completed");
  AppState.downloading.isDownloadingAll = false;
  showRateUsPopUp();
}

// // Low‑level fetch+blob download
// export async function downloadURLToDisk(url, filename) {
//   AppState.downloading.isActive = true;
//   displayFoundUrls({ forced: true });

//   try {
//     const resp = await fetch(url, { credentials: "include" });
//     if (!resp.ok) throw new Error(resp.statusText);
//     const blob = await resp.blob();
//     const blobUrl = URL.createObjectURL(blob);

//     const folder = AppState.downloadPreferences.folderName?.trim();
//     const finalFilename = folder ? `${folder}/${filename}` : filename;

//     chrome.downloads.download(
//       {
//         url: blobUrl,
//         filename: finalFilename,
//         saveAs: false, // set to true if you want to show folder picker
//       },
//       (downloadId) => {
//         if (chrome.runtime.lastError) {
//           console.error("Download error:", chrome.runtime.lastError.message);
//         } else {
//           console.log("Download started with ID:", downloadId);
//         }
//         URL.revokeObjectURL(blobUrl);
//         AppState.downloading.isActive = false;
//         displayFoundUrls({ forced: true });
//         showRateUsPopUp();
//       }
//     );
//   } catch (err) {
//     AppState.downloading.isActive = false;
//     displayFoundUrls({ forced: true });
//     return await Promise.reject(err);
//   }
// }

// export function downloadURLToDisk(url, filename) {
//   const folder = AppState.downloadPreferences.folderName?.trim();
//   const finalFilename = folder ? `${folder}/${filename}` : filename;

//   chrome.runtime.sendMessage({
//     action: "download",
//     payload: { url, filename: finalFilename },
//   });
// }

// export async function downloadURLToDisk(url, filename) {
//   AppState.downloading.isActive = true;
//   displayFoundUrls({ forced: true });

//   try {
//     const resp = await fetch(url, { credentials: "include" });
//     AppState.downloading.isActive = false;
//     displayFoundUrls({ forced: true });

//     if (!resp.ok) throw new Error(resp.statusText);
//     const blob = await resp.blob();
//     if (blob.size === 0) throw new Error("Empty file");

//     const blobUrl = URL.createObjectURL(blob);

//     // Send to background for actual file save
//     window.postMessage(
//       {
//         type: "BLOB_DOWNLOAD_REQUEST",
//         payload: {
//           blobUrl,
//           filename,
//           showFolderPicker: AppState.downloadPreferences.showFolderPicker,
//         },
//       },
//       "*"
//     );

//     showRateUsPopUp();
//   } catch (err) {
//     AppState.downloading.isActive = false;
//     displayFoundUrls({ forced: true });
//     return Promise.reject(err);
//   }
// }

// export function downloadURLToDisk(url, filename) {
//   AppState.downloading.isActive = true;
//   displayFoundUrls({ forced: true });

//   return fetch(url, { credentials: "include" }) // 🔹 Start of promise chain
//     .then((resp) => {
//       AppState.downloading.isActive = false;
//       displayFoundUrls({ forced: true });

//       if (!resp.ok) throw new Error(resp.statusText);
//       return resp.blob(); // 🔹 Chain to get blob
//     })
//     .then((blob) => {
//       if (blob.size === 0) throw new Error("Empty file");

//       const blobUrl = URL.createObjectURL(blob);

//       return new Promise((resolve, reject) => {
//         function handleResponse(event) {
//           if (
//             event.source !== window ||
//             !event.data ||
//             event.data.type !== "BLOB_DOWNLOAD_RESPONSE"
//           )
//             return;

//           window.removeEventListener("message", handleResponse);

//           // ✅ Revoke blob now that download completed
//           try {
//             URL.revokeObjectURL(blobUrl);
//             console.log("✅ Blob URL revoked:", blobUrl);
//           } catch (e) {
//             console.warn("⚠️ Failed to revoke blob URL:", e);
//           }

//           if (event.data.success) {
//             resolve(true);
//           } else {
//             reject(new Error(event.data.error || "Unknown download error"));
//           }
//         }

//         window.addEventListener("message", handleResponse);

//         window.postMessage(
//           {
//             type: "BLOB_DOWNLOAD_REQUEST",
//             payload: {
//               blobUrl,
//               filename,
//               showFolderPicker: AppState.downloadPreferences.showFolderPicker,
//             },
//           },
//           "*"
//         );
//       });
//     })
//     .catch((err) => {
//       AppState.downloading.isActive = false;
//       displayFoundUrls({ forced: true });
//       console.error("❌ Download error:", err);
//     });

// }

export async function downloadURLToDisk(url, filename, options) {
  AppState.downloading.isActive = true;
  displayFoundUrls({ forced: true });

  return fetch(url, { credentials: options?.omitCookies ? "omit" : "include" })
    .then((resp) => {
      AppState.downloading.isActive = false;
      displayFoundUrls({ forced: true });

      if (!resp.ok) throw new Error(resp.statusText);
      return resp.blob();
    })
    .then((blob) => {
      if (blob.size === 0) throw new Error("Empty file");

      const blobUrl = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        function handleResponse(event) {
          if (
            event.source !== window ||
            !event.data ||
            event.data.type !== "BLOB_DOWNLOAD_RESPONSE"
          )
            return;

          window.removeEventListener("message", handleResponse);

          try {
            URL.revokeObjectURL(blobUrl);
            console.log("✅ Blob URL revoked:", blobUrl);
          } catch (e) {
            console.warn("⚠️ Failed to revoke blob URL:", e);
          }

          if (event.data.success) {
            resolve(true);
          } else {
            reject(new Error(event.data.error || "Unknown download error"));
          }
        }

        window.addEventListener("message", handleResponse);

        window.postMessage(
          {
            type: "BLOB_DOWNLOAD_REQUEST",
            payload: {
              blobUrl,
              filename,
              showFolderPicker: AppState.downloadPreferences.showFolderPicker,
            },
          },
          "*"
        );
      });
    })
    .catch((err) => {
      AppState.downloading.isActive = false;
      displayFoundUrls({ forced: true });

      console.error("❌ Download error:", err);

      // Optional fallback
      if (
        options?.isRetrying ||
        AppState.downloadPreferences.skipFailedDownloads
      )
        throw err;
      setTimeout(() => {
        if (
          confirm(
            `Oops! Something went wrong. If a new tab opened, please close it & download again. Do you want to try downloading again? \nHide this error in the preferences under 'Skip Failed Downloads'.\nDownload Location: ${filename}`
          )
        ) {
          downloadURLToDisk(url, filename, {
            omitCookies: true,
            isRetrying: true,
          });
        }
      }, 1000);
      console.warn("⚠️ Falling back to direct download link");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      throw err;
    });
}
