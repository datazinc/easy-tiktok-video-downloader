// utils.js
import AppState from "../state/state.js";
import { STORAGE_KEYS, DOWNLOAD_FOLDER_DEFAULT } from "../state/constants.js";

// Extract username from URL path
export function getCurrentPageUsername() {
  const parts = window.location.pathname.split("/");
  const at = parts.find((p) => p.startsWith("@"));
  return at ? at.slice(1) : "😃";
}

// Simple hash by concatenating IDs
export function getPostsHash(items = []) {
  return items.map((i) => i.id).join("");
}

// Find "Liked" tab element
export function getLikedTab() {
  return Array.from(document.querySelectorAll('p[role="tab"]')).find(
    (tab) => tab.textContent.trim() === "Liked"
  );
}

export function getAuthorInfoFrom(startElement) {
  function findUsername(el) {
    // Direct match on <a href="/@username">
    if (el.tagName === "A" && el.href?.includes("/@")) {
      const match = el.getAttribute("href")?.match(/^\/@([\w.-]+)$/);
      if (match) return match[1];
    }

    // Match fallback TikTok spans
    if (
      el.dataset?.e2e === "video-author-uniqueid" ||
      el.dataset?.e2e === "explore-card-user-unique-id"
    ) {
      return el.textContent?.trim() || null;
    }

    // Recurse on children
    for (const child of el.children) {
      const result = findUsername(child);
      if (result) return result;
    }

    return null;
  }

  function findDescription(el) {
    const descEl = el.querySelector('[data-e2e="new-desc-span"]');
    return descEl?.textContent?.trim() || null;
  }

  let current = startElement;

  while (current) {
    const username = findUsername(current);
    const description = findDescription(current);

    if (username || description) {
      return {
        username: username || null,
        description: description || null,
      };
    }

    current = current.parentElement;
  }

  return { username: null, description: null };
}

export function setDownloadFolderName(folderName) {
  if (typeof folderName !== "string") {
    throw new Error("Folder name must be a string.");
  }

  let cleaned = folderName.trim().replace(/^\.\/+/, ""); // remove leading './'
  // remove end slashes
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  const segments = cleaned.split("/");

  if (segments.length === 0 || segments[0] === "") {
    throw new Error("Invalid folder name: Empty or root segment.");
  }

  // Validate each segment
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      /[<>:"\\|?*\x00-\x1F]/.test(segment)
    ) {
      throw new Error(
        "Invalid folder name: Contains invalid characters or segments."
      );
    }
  }

  // Final validated relative path
  let safePath = segments.map((s) => s.trim()).join("/");

  if (!safePath.endsWith("/")) {
    safePath += "/";
  }

  localStorage.setItem(STORAGE_KEYS.DOWNLOAD_FOLDER, safePath);
  AppState.downloadPreferences.folderName = safePath;
}

export function getDownloadFilePath(media) {
  console.log("getDownloadFilePath", media);
  const rawId =
    media.id ||
    media.videoId ||
    media.desc ||
    Math.random().toString(36).slice(2, 10);
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 50);
  const targetFolder =
    AppState.downloadPreferences.folderName?.trim() ||
    `${DOWNLOAD_FOLDER_DEFAULT}/@${
      media.authorId || "missing-username-videos"
    }/`;
  return `${targetFolder}tiktok-${media.authorId || "video"}-${cleanId}.mp4`;
}

export function getSrcById(id) {
  try {
    for (const key in AppState.postItems) {
      const item = AppState.postItems[key].find((item) => item.id == id);
      if (
        item &&
        item.video &&
        item.video.playAddr &&
        item.video.playAddr.startsWith("http")
      ) {
        return item.video.playAddr;
      }
    }
  } catch (error) {
    console.warn("Error in getting src by id (AppState)", error);
  }

  try {
    const defaultScope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
    const videoDetail = defaultScope?.["webapp.video-detail"];
    const videoItem = videoDetail?.itemInfo?.itemStruct;
    if (videoItem?.id == id) {
      return videoItem.video.playAddr;
    }
  } catch (error) {
    console.warn("Error in getting src by id (UNIVERSAL_DATA)", error);
  }

  try {
    const video = window?.MultiMediaPreloader?.preloader?.video;
    const offsetParent = video?.offsetParent;
    if (offsetParent) {
      const fiberKey = Object.keys(offsetParent).find((k) =>
        k.startsWith("__reactFiber$")
      );
      const fiberNode = offsetParent[fiberKey];
      const fiberItem = fiberNode?.child?.pendingProps;
      console.log("Fiber Item:", fiberItem?.id, id);
      // Check if the fiber

      if (fiberItem?.id == id && fiberItem && fiberItem.url) {
        return fiberItem.url;
      } else {
        console.warn(
          "reactFiber No valid video source found in fiber item",
          fiberItem.id,
          id,
          fiberItem,
          fiberItem.url
        );
      }
    }
  } catch (error) {
    console.warn("reactFiber Error in getting src by id (React Fiber)", error);
  }
  console.warn("reactFiber No valid video source found for ID:", id);
  return null;
}

function getCurrentPlayingArticle() {
  console.log("ttkdebugger: Looking for video with non-zero progress...");
  const progressBar = document.querySelector(
    'div[role="slider"][aria-valuenow]:not([aria-valuenow="0"])'
  );
  if (progressBar) {
    console.log("ttkdebugger: Found progressBar with value > 0");
    return progressBar.closest("article");
  }

  console.log("ttkdebugger: Trying to find active <video> element...");
  const playingVideo = document.querySelector('video[src^="blob:"]');
  if (playingVideo) {
    console.log("ttkdebugger: Found <video> with blob src");
    return playingVideo.closest("article");
  }

  console.log("ttkdebugger: Checking for unmuted video sound button...");
  const unmuted = document.querySelector(
    'div[data-e2e="video-sound"][aria-pressed="true"]'
  );
  if (unmuted) {
    console.log("ttkdebugger: Found unmuted video (aria-pressed=true)");
    return unmuted.closest("article");
  }

  console.warn("ttkdebugger: No playing article found");
  return null;
}

export function getUsernameFromPlayingArticle() {
  return getAuthorInfoFrom(getCurrentPlayingArticle())?.username;
}

export function expectSmallViewer() {
  try {
    const path = window.location.pathname;

    // Remove trailing slashes
    const cleanPath = path.replace(/\/+$/, "");

    // Split and filter path segments
    const parts = cleanPath.split("/").filter(Boolean);

    // Root or profile (e.g. "/")
    if (parts.length === 0) {
      return false;
    }
    if (parts.length > 1 && parts[0].startsWith("@")) return false;
    // Everything else (e.g. "/@user/video-id", "/explore", etc.)
    return true;
  } catch (error) {
    console.warn("Invalid URL in isExploreItemFromUrl", error);
    return false;
  }
}

export function getVideoUsernameFromAllDirectLinks(videoId) {
  try {
    const match = AppState.allDirectLinks?.find(
      (item) => item.videoId === videoId
    );
    return match?.authorId || null;
  } catch (error) {
    console.warn("Failed to get username from allDirectLinks", error);
    return null;
  }
}
