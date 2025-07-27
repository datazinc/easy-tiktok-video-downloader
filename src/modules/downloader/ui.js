// ui.js
import AppState from "../state/state.js";
import {
  STORAGE_KEYS,
  DOM_IDS,
  DOWNLOAD_FOLDER_DEFAULT_PLACEHOLDER,
} from "../state/constants.js";
import { displayFoundUrls, downloadAllLinks } from "./downloader.js";
import {
  setDownloadFolderName,
  getDownloadFilePath,
  getSrcById,
  getAuthorInfoFrom,
  getUsernameFromPlayingArticle,
  getCurrentPageUsername,
  expectSmallViewer,
  getVideoUsernameFromAllDirectLinks,
} from "../utils/utils.js";

import { downloadURLToDisk } from "../downloader/downloader.js";

export function createDownloaderWrapper() {
  const wrapper = document.createElement("div");
  wrapper.id = "ttk-downloader-wrapper";
  wrapper.className = "ettpd-wrapper";
  return wrapper;
}
function createDownloadAllButton(enabled = true) {
  const btn = document.createElement("button");
  btn.id = DOM_IDS.DOWNLOAD_ALL_BUTTON;
  btn.className = "ettpd-btn download-all-btn";
  btn.textContent = enabled
    ? "Download All Links"
    : "Download All Links (empty)";
  btn.disabled = !enabled;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (!enabled) return;
    AppState.downloading.isDownloadingAll = true;
    downloadAllLinks(btn);
  };
  return btn;
}

export function updateDownloadButtonLabel(btnElement, text) {
  const btn =
    btnElement || document.getElementById(DOM_IDS.DOWNLOAD_ALL_BUTTON);
  console.log("ettpdebugger: updateDownloadButtonLabel called", { text, btn });

  if (btn) {
    btn.innerText = text;
  } else {
    console.warn("Download All button not found in the DOM.");
  }
}

function createCurrentVideoButton(items, onDownload) {
  const btn = document.createElement("button");
  btn.className = "ettpd-btn ettpd-current-video-btn";
  btn.textContent = "Download Current Video";
  const currentVideoId = document.location.pathname.split("/")[3];
  const currentMedia = items.find(
    (media) => currentVideoId && media.videoId === currentVideoId
  );
  btn.onclick = () => {
    if (currentMedia) {
      const filename = getDownloadFilePath(currentMedia);
      onDownload(currentMedia, filename);
    }
  };
  console.log("ettpdebugger: createCurrentVideoButton called", {
    currentMedia,
    currentVideoId,
    items,
  });
  return currentMedia ? btn : document.createElement("span");
}

function createReportBugButton() {
  const reportBugBtn = document.createElement("button");
  reportBugBtn.className = "ettpd-btn ettpd-report-bug";
  reportBugBtn.innerText = "Report Bugs (Quick fix: Refresh/Login/Logout😉)";

  const reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.href = "https://forms.gle/Up1JaQJjxSBNYsZw5";
  reportBugBtnLink.appendChild(reportBugBtn);

  return reportBugBtnLink;
}

function createCreditsSpan() {
  const span = document.createElement("span");
  span.className = "ettpd-span ettpd-copyright";
  span.innerHTML = `&copy; ${new Date().getFullYear()} - Made by <strong>DataZinc💛</strong>`;
  span.onclick = hideDownloader;
  return span;
}

function createCloseButton() {
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.id = "ettpd-close";
  btn.onclick = () => {
    AppState.ui.isDownloaderClosed = true;
    localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "true");
    hideDownloader();
  };
  return btn;
}

// export function showEmptyState(wrapper) {
//   const message = document.createElement("p");
//   message.innerText = "No videos found to display 😔";
//   message.className = "ettpd-span ettpd-empty";
//   wrapper.appendChild(message);
// }

// export function updateDownloaderList(wrapper, items, onDownload) {
//   const _id = "ttk-downloader-wrapper";
//   document.getElementById(_id)?.remove(); // Clean up old list
//   AppState.allDirectLinks = [];

//   const list = document.createElement("ol");
//   list.className = "ettpd-ol";

//   if (items.length > 0) {
//     items.forEach((media, idx) => {
//       const item = document.createElement("li");
//       item.className = "ettpd-li";

//       const anchor = document.createElement("a");
//       anchor.className = "ettpd-a";
//       anchor.target = "_blank";
//       anchor.href = media?.url;

//       const currentVideoId = document.location.pathname.split("/")[3];
//       anchor.innerText = `${
//         currentVideoId === media?.videoId ? "🔴 " : ""
//       }${media?.authorId ? `@${media.authorId} ` : ""}${media?.desc || ""}`;

//       const downloadBtn = document.createElement("button");
//       downloadBtn.textContent = "Download";
//       downloadBtn.className = "ettpd-download-btn";
//       downloadBtn.onclick = (e) => {
//         e.stopPropagation();
//         const filename = `tiktok-${media?.authorId || "video"}-${media?.videoId || media?.desc?.slice(0, 10) || Math.random().toString(36).slice(2)}-${idx + 1}.mp4`;
//         onDownload(media, filename);
//       };

//       item.append(anchor, downloadBtn);
//       list.appendChild(item);
//     });
//   } else {
//     showEmptyState(wrapper);
//   }

//   wrapper.append(
//     createDownloadAllButton(items),
//     createCurrentVideoButton(items, onDownload),
//     createReportBugButton(),
//     createCreditsSpan(),
//     list,
//     createCloseButton()
//   );
// }
export function updateDownloaderList(wrapper, items, onDownload) {
  const _id = DOM_IDS.DOWNLOADER_WRAPPER;
  document.getElementById(_id)?.remove();
  // AppState.allDirectLinks = [];
  // ettpd-download-btn-holder

  // Preferences box
  const preferencesBox = createPreferencesBox();
  const settingsBtn = createSettingsToggle(preferencesBox);
  // === Create the main wrapper ===

  const list = document.createElement("ol");
  list.className = "ettpd-ol";
  let downloadAllBtn = null;
  if (items.length > 0) {
    downloadAllBtn = createDownloadAllButton(items.length > 0);
    // Update the download button label

    updateDownloadButtonLabel(
      downloadAllBtn,
      `Download All ${items.length} Videos!`
    );
    // Populate the list with items
    items.forEach((media, idx) => {
      const item = document.createElement("li");
      item.className = "ettpd-li";

      const currentVideoId = document.location.pathname.split("/")[3];

      // Container for author and desc
      const textContainer = document.createElement("div");
      textContainer.className = "ettpd-text-container";

      // Author link
      const authorAnchor = document.createElement("a");
      authorAnchor.className = "ettpd-a ettpd-author-link";
      authorAnchor.target = "_blank";
      authorAnchor.href = `https://www.tiktok.com/@${media?.authorId}`;
      authorAnchor.innerText =
        `${currentVideoId === media?.videoId ? "🔴 " : ""}` +
        (media?.authorId ? `@${media.authorId}` : "Unknown Author");

      // Description link
      const descAnchor = document.createElement("a");
      descAnchor.className = "ettpd-a ettpd-desc-link";
      descAnchor.target = "_blank";
      descAnchor.href = media?.url;
      descAnchor.innerText = media?.desc || "No Description";

      textContainer.append(authorAnchor, descAnchor);

      // Download button
      const downloadBtnHolder = document.createElement("div");
      downloadBtnHolder.className = "ettpd-download-btn-holder";

      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = "Download";
      downloadBtn.className = "ettpd-download-btn";
      downloadBtn.onclick = async (e) => {
        e.stopPropagation();
        const filename = getDownloadFilePath(media);
        await onDownload(media, filename);
      };

      downloadBtnHolder.appendChild(downloadBtn);
      item.append(textContainer, downloadBtnHolder);
      list.appendChild(item);
    });
  } else {
    showEmptyState(list); // place the empty message inside the list area
  }
  // === Persistent controls ===
  wrapper.append(
    settingsBtn,
    preferencesBox,
    downloadAllBtn,
    createCurrentVideoButton(items, onDownload),
    createReportBugButton(),
    createCreditsSpan(),
    list,
    createCloseButton()
  );
}

export function showEmptyState(container) {
  const p = document.createElement("p");
  p.className = "ettpd-span ettpd-empty";
  p.innerText = "No videos found to display 😔";
  container.appendChild(p);
}

export function buildVideoLinkMeta(media, index) {
  return {
    url: media?.video?.playAddr,
    desc: media?.desc,
    videoId: media?.id,
    authorId: media?.author?.uniqueId,
    index,
    hasLowConfidence: media.hasLowConfidence ?? false,
  };
}

export function hideDownloader() {
  document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER)?.remove();
  if (document.getElementById(DOM_IDS.SHOW_DOWNLOADER)) return;

  const showBtn = document.createElement("button");
  showBtn.id = DOM_IDS.SHOW_DOWNLOADER;
  showBtn.textContent = "Open Video Downloader";
  showBtn.id = DOM_IDS.SHOW_DOWNLOADER;
  showBtn.onclick = () => {
    localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "false");
    AppState.ui.isDownloaderClosed = false;
    document.getElementById(DOM_IDS.SHOW_DOWNLOADER)?.remove();
    import("./downloader.js").then((m) => m.displayFoundUrls({ forced: true }));
  };

  document.body?.appendChild(showBtn);
}

// export function showRateUsPopUp() {
//   if (AppState.ui.hasRated || AppState.ui.isRatePopupOpen) return;
//   AppState.ui.isRatePopupOpen = true;
//   hideDownloader();

//   const overlay = document.createElement("div");
//   Object.assign(overlay.style, {
//     position: "fixed",
//     top: 0,
//     left: 0,
//     width: "100%",
//     height: "100%",
//     backgroundColor: "rgba(0,0,0,0.4)",
//     display: "flex",
//     justifyContent: "center",
//     alignItems: "center",
//     zIndex: 9999,
//   });

//   const box = document.createElement("div");
//   box.style.position = "fixed";
//   box.style.top = "0";
//   box.style.left = "0";
//   box.style.width = "100%";
//   box.style.height = "100%";
//   box.style.zIndex = "999";
//   box.style.backgroundColor = "rgba(31, 26, 26, 0.5)";
//   box.innerHTML = `
//   <div style="
//     position: absolute;
//     top: 50%;
//     left: 50%;
//     transform: translate(-50%, -50%);
//     width: 400px;
//     max-width: 90%;
//     background-color: #ffffff;
//     color: #333333;
//     border-radius: 12px;
//     padding: 20px;
//     box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
//     font-family: Arial, sans-serif;
//     text-align: center;
//   ">
//     <h2 style="margin-bottom: 15px; font-size: 1.5em; color: #1da1f2;">Download Complete! 🎉</h2>
//     <p style="margin-bottom: 20px; font-size: 1em; line-height: 1.5; color: #555555;">
//       Your video has been successfully downloaded! 🎥<br>
//       We'd love your support—rate us 5 ⭐ on the Chrome Web Store to help us grow! 🥰
//     </p>
//     <a
//       href="https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg"
//       target="_blank"
//       style="
//         display: inline-block;
//         background-color: #1da1f2;
//         color: white;
//         padding: 12px 20px;
//         font-size: 1em;
//         border-radius: 8px;
//         text-decoration: none;
//         font-weight: bold;
//         box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
//         transition: background-color 0.3s ease;
//       "
//       onmouseover="this.style.backgroundColor='#0a84d6';"
//       onmouseout="this.style.backgroundColor='#1da1f2';"
//     >
//       Rate Now
//     </a>
//   </div>
// `;
//   overlay.appendChild(box);

//   overlay.onclick = () => {
//     localStorage.setItem(STORAGE_KEYS.HAS_RATED, "true");
//     AppState.ui.hasRated = true;
//     overlay.remove();
//   };

//   document.body.appendChild(overlay);
// }

// src/modules/ui/modal.js
// src/modules/ui/modal.js

export function showRateUsPopUp() {
  if (AppState.ui.hasRated || AppState.ui.isRatePopupOpen) return;
  AppState.ui.isRatePopupOpen = true;

  const title = document.createElement("h2");
  title.className = "ettpd-modal-title";
  title.textContent = "Download Complete! 🎉";

  const msg = document.createElement("p");
  msg.className = "ettpd-modal-message";
  msg.innerHTML = `
    Your video has been successfully downloaded! 🎥<br>
    We'd love your support — rate us 5 ⭐ on the Chrome Web Store to help us grow! 🥰
  `;

  const rateBtn = document.createElement("a");
  rateBtn.href =
    "https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg";
  rateBtn.target = "_blank";
  rateBtn.className = "ettpd-modal-button";
  rateBtn.textContent = "Rate Now";

  createModal({
    children: [title, msg, rateBtn],
    onClose: () => {
      localStorage.setItem(STORAGE_KEYS.HAS_RATED, "true");
      AppState.ui.hasRated = true;
    },
  });
}

export function createModal({ children = [], onClose = null }) {
  const overlay = document.createElement("div");
  overlay.className = "ettpd-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "ettpd-modal-box";

  children.forEach((child) => {
    if (typeof child === "string") {
      modal.insertAdjacentHTML("beforeend", child);
    } else if (child instanceof HTMLElement) {
      modal.appendChild(child);
    }
  });

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (typeof onClose === "function") onClose();
    }
  };

  overlay.appendChild(modal);
  document.body?.appendChild(overlay);
  return overlay;
}

export function showDownloadFolderPathModal() {
  const title = document.createElement("h2");
  title.className = "ettpd-modal-title";
  title.textContent = "📂 Set Download Folder";

  const msg = document.createElement("p");
  msg.className = "ettpd-modal-message";
  msg.innerHTML = `
    Choose a folder to save your downloaded TikTok videos and images.<br>
    <span style="font-size: 0.95em; color: #777;">Only relative folder paths allowed (e.g. <code>myvideos/${new Date().getFullYear()}/</code>)</span>
    <br>
    <span style="font-size: 0.95em; color: #777; width: 100%; display: block; margin-top: 5px;">
      Defaults to <code style="color: #fe2c55; width: 100%; display: block">${DOWNLOAD_FOLDER_DEFAULT_PLACEHOLDER}</code> if not set.
      <br>
      <strong>Note:</strong> If you set a folder name, it will be used
      as a subfolder inside the default download location. For example, if you set "My TikToks", it will save all downloads to it.
      <br>
    </span>
  `;

  const currentPathElement = document.createElement("div");
  currentPathElement.className = "ettpd-modal-current-path";
  currentPathElement.innerHTML = `
    <strong>Current Path:</strong>
    <span class="ettpd-modal-current-path-value">
      ${
        AppState.downloadPreferences.folderName ||
        DOWNLOAD_FOLDER_DEFAULT_PLACEHOLDER
      }
    </span>
  `;
  const input = document.createElement("input");
  input.id = "ettpd-folder-input";
  input.type = "text";
  input.placeholder = "Folder name (e.g. 'My TikTok Videos')";
  input.className = "ettpd-modal-input";
  input.autofocus = true;
  input.value = AppState.downloadPreferences.folderName || "";

  const feedback = document.createElement("div");
  feedback.className = "ettpd-modal-feedback";

  const error = document.createElement("div");
  error.className = "ettpd-modal-error";

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "ettpd-modal-button-group";

  const setLoadingState = (btn, isLoading, title) => {
    btn.disabled = isLoading;
    btn.innerText = title;
  };

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾 Save Folder";
  saveBtn.className = "ettpd-modal-button primary";
  saveBtn.onclick = () => {
    try {
      feedback.textContent = "";
      error.textContent = "";
      setLoadingState(saveBtn, true, "💾 Saving...");
      setDownloadFolderName(input.value.trim());

      console.log(
        "✅ Folder path set:",
        AppState.downloadPreferences.folderName
      );
      currentPathElement.querySelector(
        ".ettpd-modal-current-path-value"
      ).textContent =
        AppState.downloadPreferences.folderName ||
        DOWNLOAD_FOLDER_DEFAULT_PLACEHOLDER;

      setTimeout(() => {
        setLoadingState(saveBtn, false, "💾 Save Folder");
        feedback.textContent = "✅ Folder saved successfully.";
        // setTimeout(() => {
        //   feedback.textContent = "";
        // }, 1000);
      }, 600); // enough for spinner feel
    } catch (e) {
      feedback.textContent = "";
      error.textContent = e.message;
      setLoadingState(saveBtn, false, "💾 Save Folder");
    }
  };

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "🧹 Reset";
  resetBtn.className = "ettpd-modal-button danger";
  resetBtn.onclick = () => {
    feedback.textContent = "";
    error.textContent = "";
    setLoadingState(resetBtn, true, "🧹 Resetting...");
    localStorage.removeItem(STORAGE_KEYS.DOWNLOAD_FOLDER);
    AppState.downloadPreferences.folderName = "";
    input.value = "";

    console.log("🧹 Folder path reset.");
    currentPathElement.querySelector(
      ".ettpd-modal-current-path-value"
    ).textContent = DOWNLOAD_FOLDER_DEFAULT_PLACEHOLDER;

    setTimeout(() => {
      setLoadingState(resetBtn, false, "🧹 Reset");
      feedback.textContent = "✅ Folder reset.";
      // setTimeout(() => {
      //   feedback.textContent = "";
      // }, 1000);
    }, 600);
  };

  buttonGroup.append(saveBtn, resetBtn);

  const modal = createModal({
    children: [
      title,
      msg,
      currentPathElement,
      input,
      error,
      feedback,
      buttonGroup,
    ],
  });
}

export function createPreferencesBox() {
  const preferencesBox = document.createElement("div");
  preferencesBox.className = "ettpd-preferences-box";
  preferencesBox.style.display = "none";

  const prefLabel = document.createElement("div");
  prefLabel.className = "ettpd-pref-label";
  prefLabel.textContent = "Options:";

  const folderBtn = document.createElement("button");
  folderBtn.className = "ettpd-pref-btn";
  folderBtn.textContent = "📁 Set Download Folder";
  folderBtn.onclick = (e) => {
    e.stopPropagation();
    showDownloadFolderPathModal();
  };

  const resetBtn = document.createElement("button");
  resetBtn.className = "ettpd-pref-btn danger";
  resetBtn.textContent = "🔄 Reset Downloader";
  resetBtn.onclick = (e) => {
    e.stopPropagation();
    AppState.postItems = {};
    AppState.allDirectLinks = [];
    AppState.downloadedURLs = [];
    AppState.displayedState = { itemsHash: "", path: "" };
    console.log("✅ Downloader state has been reset.");
    // Feedback to user
    const feedback = document.createElement("div");
    feedback.className = "ettpd-reset-feedback";
    feedback.textContent = "✅ Downloader state has been reset.";
    preferencesBox.appendChild(feedback);
    setTimeout(() => {
      feedback.remove();
    }, 2000); // Remove feedback after 2 seconds
    displayFoundUrls({ forced: true }); // Refresh the UI
  };

  preferencesBox.append(prefLabel, folderBtn, resetBtn);
  return preferencesBox;
}

export function createSettingsToggle(preferencesBox) {
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "ettpd-settings-toggle";
  settingsBtn.textContent = "⚙️ Preferences (Advanced Settings)";
  settingsBtn.title = "Click to toggle settings";
  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    preferencesBox.style.display =
      preferencesBox.style.display === "none" ? "flex" : "none";
  };
  return settingsBtn;
}

/**
 * Remove every existing “.download-btn-container” from the DOM.
 */
export function clearDownloadBtnContainers() {
  return;
  document
    .querySelectorAll(".download-btn-container")
    .forEach((el) => el.remove());
}

// /**
//  * Create & append a “Download Video” button for a feed wrapper.
//  * @param {HTMLElement} wrapperEl  the <div id="xgwrapper-…">
//  * @param {string} videoId
//  */
// export function createVideoDownloadButtonForWrapper(wrapperEl, videoId) {
//   // console.log("STARTING POINT createVideoDownloadButtonForWrapper", wrapperEl);
//   const author =
//     wrapperEl.querySelector('a[href*="/@"]')?.textContent?.slice(1) ||
//     getUsernameFromPlayingArticle() ||
//     getCurrentPageUsername() ||
//     "username";
//   const container = document.createElement("div");
//   container.className = "download-btn-container";
//   container.style.position = "absolute";
//   container.style.bottom = "10px";
//   container.style.right = "10px";
//   container.style.zIndex = "1000";

//   const btn = document.createElement("button");
//   btn.textContent = "Download Video";
//   btn.className = "download-btn";
//   btn.dataset.wrapperId = wrapperEl.id;

//   btn.addEventListener("click", (e) => {
//     e.stopPropagation();
//     const src =
//       getSrcById(videoId) ||
//       wrapperEl.querySelector("video source")?.src ||
//       wrapperEl.querySelector("video")?.src;
//     if (src?.startsWith("http")) {
//       downloadURLToDisk(
//         src,
//         getDownloadFilePath({
//           videoId,
//           authorId: author,
//         })
//       ).catch((err) => {
//         console.warn("downloadURLToDisk error:", err);
//         alert("Failed to download video.");
//       });
//     } else {
//       alert("No valid video source found.");
//     }
//   });

//   container.appendChild(btn);
//   wrapperEl.appendChild(container);
// }

// /**
//  * Similar for “Explore” items.
//  * @param {HTMLElement} exploreItem  the div[data-e2e="explore-item"]
//  * @param {string} videoId
//  */
// export function createExploreDownloadButton(exploreItem, videoId) {
//   // console.log("STARTING POINT createExploreDownloadButton", exploreItem);

//   const wrapper = exploreItem.querySelector(".xgplayer-container");
//   if (!wrapper) return;

//   const author =
//     exploreItem
//       .querySelector('[data-e2e="explore-card-user-unique-id"]')
//       ?.textContent?.trim() ||
//     getAuthorInfoFrom(
//       exploreItem.closest('[data-e2e="explore-item"]')?.parentElement
//     )?.username ||
//     "username";

//   const container = document.createElement("div");
//   container.className = "download-btn-container";
//   container.style.position = "absolute";
//   container.style.bottom = "10px";
//   container.style.right = "10px";
//   container.style.zIndex = "1000";

//   const btn = document.createElement("button");
//   btn.textContent = "Download Video";
//   btn.className = "download-btn";
//   btn.dataset.wrapperId = `explore-${videoId}`;

//   btn.addEventListener("click", (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     const src =
//       getSrcById(videoId) ||
//       wrapper.querySelector("video source")?.src ||
//       wrapper.querySelector("video")?.src;
//     if (src?.startsWith("http")) {
//       downloadURLToDisk(
//         src,
//         getDownloadFilePath({
//           videoId,
//           authorId: author,
//         })
//       ).catch(() => alert("Failed to download video."));
//     } else {
//       alert("No valid video source found.");
//     }
//   });

//   container.appendChild(btn);
//   wrapper.appendChild(container);
// }

function createDownloadButton({
  wrapperId,
  author,
  videoId,
  getVideoSrc,
  parentEl,
  isSmallView,
}) {
  const className = `download-btn ${videoId}`;

  // Prevent duplicate buttons
  if (parentEl.querySelector(`.${CSS.escape(videoId)}`)) return;
  console.log("createDownloadButton", {
    wrapperId,
    author,
    videoId,
    getVideoSrc,
    parentEl,
    isSmallView,
  });
  const container = document.createElement("div");
  container.className = "download-btn-container";
  Object.assign(container.style, {
    // position: "absolute",
    // bottom: "10px",
    // right: "10px",
    zIndex: "1000",
  });

  const btn = document.createElement("button");
  btn.textContent = isSmallView ? "⬇️ Download" : "⬇️ Download Video";
  btn.className = className;
  btn.dataset.wrapperId = wrapperId;

  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.style.display = "none";
  spinner.style.marginLeft = "8px";
  spinner.innerHTML = "⏳";

  btn.appendChild(spinner);

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const src = getVideoSrc();
    if (!src?.startsWith("http")) {
      console.warn("No valid source found");
      // alert("No valid video source found.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Downloading…";
    spinner.style.display = "inline-block";

    try {
      await downloadURLToDisk(
        src,
        getDownloadFilePath({
          videoId,
          authorId: author,
        })
      );
      btn.textContent = "✅ Downloaded!";
    } catch (err) {
      console.warn("Download error:", err);
      // alert("Failed to download video.");
      btn.textContent = "Download Failed";
    } finally {
      spinner.style.display = "none";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = isSmallView ? "⬇️ Download" : "⬇️ Download Video";
      }, 5000);
    }
  });

  container.appendChild(btn);
  parentEl.appendChild(container);
}

export function createVideoDownloadButtonForWrapper(wrapperEl, videoId) {
  const author =
    getVideoUsernameFromAllDirectLinks(videoId) ||
    wrapperEl.querySelector('a[href*="/@"]')?.textContent?.slice(1) ||
    getUsernameFromPlayingArticle() ||
    getAuthorInfoFrom(wrapperEl)?.username ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    getSrcById(videoId) ||
    wrapperEl.querySelector("video source")?.src ||
    wrapperEl.querySelector("video")?.src;

  createDownloadButton({
    wrapperId: wrapperEl.id,
    author,
    videoId,
    getVideoSrc,
    parentEl: wrapperEl,
    isSmallView: expectSmallViewer(),
  });
}

export function createExploreDownloadButton(exploreItem, videoId) {
  const wrapper = exploreItem.querySelector(".xgplayer-container");
  if (!wrapper) return;

  const author =
    getVideoUsernameFromAllDirectLinks(videoId) ||
    exploreItem
      .querySelector('[data-e2e="explore-card-user-unique-id"]')
      ?.textContent?.trim() ||
    getAuthorInfoFrom(
      exploreItem.closest('[data-e2e="explore-item"]')?.parentElement
    )?.username ||
    getUsernameFromPlayingArticle() ||
    getCurrentPageUsername() ||
    "username";

  const getVideoSrc = () =>
    getSrcById(videoId) ||
    wrapper.querySelector("video source")?.src ||
    wrapper.querySelector("video")?.src;

  createDownloadButton({
    wrapperId: `explore-${videoId}`,
    author,
    videoId,
    getVideoSrc,
    parentEl: wrapper,
    isSmallView: expectSmallViewer(),
  });
}

/**
 * Scan the page for feed‐wrappers and explore‐items,
 * and attach download buttons via your two helpers.
 */
export function attachDownloadButtons() {
  // const exploreVideoIds = new Set();

  // Handle explore items and track their video IDs
  document.querySelectorAll('div[data-e2e="explore-item"]').forEach((item) => {
    const href = item.querySelector("a[href*='/video/']")?.getAttribute("href");
    const m = href?.match(/\/video\/(\d+)/);
    if (m && !item.querySelector(".ettpd-download-btn")) {
      // exploreVideoIds.add(m[1]);
      createExploreDownloadButton(item, m[1]);
    }
  });

  // Handle feed wrappers (only if not in explore and button not already present)
  document.querySelectorAll("div[id^='xgwrapper-']").forEach((wrapper) => {
    const m = wrapper.id.match(/xgwrapper-\d+-(\d+)/);
    if (
      m &&
      // !exploreVideoIds.has(m[1]) &&
      !wrapper.querySelector(".ettpd-download-btn")
    ) {
      createVideoDownloadButtonForWrapper(wrapper, m[1]);
    }
  });
}
