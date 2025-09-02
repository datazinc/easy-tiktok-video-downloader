// Utils.js
import AppState from "../state/state.js";
import {
  STORAGE_KEYS,
  DOWNLOAD_FOLDER_DEFAULT,
  DOM_IDS,
  FILE_STORAGE_LOCATION_TEMPLATE_PRESETS,
  DATA_PRUNE_MAX_WEEKS_TO_KEEP,
  PRUNE_AFTER_MAX_WEEKS_OF_LOW_DOWNLOADS,
  PRUNE_LOW_DOWNLOADS_COUNT,
  DOWNLOAD_TIER_THRESHOLDS,
  RECOMMENDATION_TIER_THRESHOLDS,
  DOWNLOAD_SUCCESS_MESSAGES,
  SCRAPER_DONE_MESSAGES,
  HYPE_TEMPLATES,
} from "../state/constants.js";
import {
  updateDownloaderList,
  hideDownloader,
  showMorpheusRateUsPage,
  updateDownloadButtonLabelSimple,
  updateDownloadButtonLabel,
  showStatsSpan,
  createDownloaderWrapper,
  createModal,
} from "../downloader/ui.js";

// Extract username from URL path
export function getCurrentPageUsername() {
  const parts = window.location.pathname.split("/");
  const at = parts.find((p) => p.startsWith("@"));
  return at ? at.slice(1) : "😃";
}

// Simple hash by concatenating IDs
export function getDisplayedItemsHash(items = []) {
  return items
    .filter((it) => !(AppState.downloadPreferences.skipAds && it.isAd))
    .map((i) => i.id)
    .join("");
}

// Find "Liked" tab element
export function getLikedTab() {
  return Array.from(document.querySelectorAll('p[role="tab"]')).find(
    (tab) => tab.textContent.trim() === "Liked"
  );
}

export function getPostInfoFrom(startElement, options) {
  function logStrategy(name, value) {
    if (value) {
      console.log(
        `ETTVD_INFO_DEBUG-${options?.origin} strategy-${name}: ${value}`
      );
    }
  }

  function findUsername(el) {
    if (!el) return null;

    // Strategy 1: <a href="/@username">
    if (el.tagName === "A" && el.href?.includes("/@")) {
      const match = el.getAttribute("href")?.match(/\/@([\w._-]+)/)[1];
      if (match) {
        logStrategy("1-a-tag-href", match[1]);
        return match[1];
      }
    }

    // Strategy 2: TikTok e2e username markers
    if (
      el.dataset?.e2e === "video-author-uniqueid" ||
      el.dataset?.e2e === "explore-card-user-unique-id"
    ) {
      const text = el.textContent?.trim() || null;
      logStrategy("2-e2e-username-marker", text);
      return text;
    }

    return null;
  }

  function findAuthorUsernameUsingAvatarBlock(container) {
    if (!container) return;
    const avatarAnchor = container.querySelector(
      'a[data-e2e="browse-user-avatar"]'
    );
    if (!avatarAnchor) return null;

    const containerDiv = avatarAnchor.closest("div");
    const usernameAnchor = containerDiv?.querySelector('a[href^="/@"]');
    const href = usernameAnchor?.getAttribute("href");
    const match = href?.match(/^\/@([\w.-]+)$/);
    const username = match ? match[1] : null;
    logStrategy("3-avatar-profile-block", username);
    return username;
  }

  function findAuthorUsernameByFYP(container) {
    if (!container) return;

    const el = container.querySelector('[data-e2e="video-author-uniqueid"]');
    const text = el?.textContent?.trim() || null;
    logStrategy("4-fyp-author", text);
    return text;
  }

  function findDescription(el) {
    if (!el) return null;

    const descEl =
      el.querySelector('[data-e2e="explore-card-desc"]') ||
      el.querySelector('[data-e2e="new-desc-span"]') ||
      el.querySelector('[data-e2e="video-desc"]') ||
      el.querySelector(".css-1clj8ti-DivVideoExploreCardDesc");

    const description = descEl?.textContent?.trim() || null;
    if (description) {
      console.log(
        `ETTVD_INFO_DEBUG-${options?.origin}  description-found: ${description}`
      );
    }
    return description;
  }

  function deepSearch(el) {
    if (!el) return {};
    let username = findUsername(el);
    let description = findDescription(el);

    for (const child of el.children || []) {
      if (!username || !description) {
        const childResult = deepSearch(child);
        username ||= childResult.username;
        description ||= childResult.description;
      }
    }

    return { username, description };
  }

  let current = startElement;
  if (!current) {
    console.log(
      `ETTVD_INFO_DEBUG-${options?.origin}  strategy-5-no-explore-item, fallback to startElement`
    );
    current = startElement;
  }
  // Step 1: fallback global strategies
  const fallback1 = findAuthorUsernameUsingAvatarBlock(current);
  const fallback2 = findAuthorUsernameByFYP(current);

  // Step 2: Go up until we find explore container

  while (current && !current.dataset?.e2e?.includes("explore-item")) {
    current = current.parentElement;
  }

  if (!current) {
    console.log(
      `ETTVD_INFO_DEBUG-${options?.origin}  strategy-5-no-explore-item, fallback to startElement`
    );
    current = startElement;
  }

  // Step 3: Search downward in the scoped card/container
  const queue = [current];
  let username = null;
  let description = null;

  while (queue.length && (!username || !description)) {
    const el = queue.shift();
    if (!el) continue;
    const info = deepSearch(el);
    username ||= info.username;
    description ||= info.description;

    for (const child of el.children || []) {
      queue.push(child);
    }
  }

  const finalUsername = username || fallback1 || fallback2 || null;
  logStrategy(`final`, finalUsername);

  return {
    username: finalUsername,
    description,
  };
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

export function getDownloadFilePath(
  media,
  { imageIndex = 0, options = {} } = {}
) {
  try {
    const template =
      AppState.downloadPreferences.fullPathTemplate?.template ||
      getDefaultPresetTemplate();
    function getFieldMaxLength(template, fieldName) {
      const regex = new RegExp(`\\{${fieldName}:(\\d+)`);
      const match = template?.match(regex);
      return match ? Number(match[1]) : undefined;
    }

    const sanitize = (val) =>
      (val ?? "")
        .toString()
        .replace(/[^\p{L}\p{N}_\-.]+/gu, "-")
        .slice(0, 100);

    const formattedDate = (date) => {
      if (!date || typeof date != "object") return;
      return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0") +
        "_" +
        String(date.getHours()).padStart(2, "0") +
        String(date.getMinutes()).padStart(2, "0")
      );
    };

    const extension = media?.isImage ? ".jpeg" : ".mp4";
    const sequenceNumber = imageIndex + 1;
    const isMultiImage = media?.imagePostImages?.length > 1;
    const descMaxLen = getFieldMaxLength(template, "desc");
    const isDescMaxLenDefined = descMaxLen !== undefined;
    const fieldValues = {
      videoId: sanitize(media.videoId || media.id),
      authorUsername: media.authorId,
      authorNickname: sanitize(media.authorNickname),
      desc: sanitize(
        media.desc?.slice(0, isDescMaxLenDefined ? descMaxLen : 40)
      ),
      musicTitle: sanitize(media.musicTitle),
      musicAuthor: sanitize(media.musicAuthor),
      views: sanitize(media.views),
      duration: sanitize(media.duration),
      hashtags: (media?.hashtags || [])
        .map((tag) => sanitize(tag.name || tag))
        .join("-"),
      createTime: sanitize(
        media.createTime
          ? formattedDate(media.createTime)
          : "-"
      ),
      downloadTime: formattedDate(new Date()),
      isImage: media.isImage,
      isAd: media.isAd,
    };

    const fullTemplate = template?.trim();

    const resolvedPath = fullTemplate
      ? applyTemplate(
          fullTemplate.startsWith("@/")
            ? `${DOWNLOAD_FOLDER_DEFAULT}${fullTemplate.slice(1)}`
            : fullTemplate,
          fieldValues,
          {
            sequenceNumber,
            isMultiImage,
            collectionName: sanitize(
              AppState.scrapperDetails.selectedCollectionName || "collection"
            ),
          }
        )
      : `${DOWNLOAD_FOLDER_DEFAULT}@${
          fieldValues.authorUsername || "unknown"
        }/${fieldValues.authorUsername || "user"}-${fieldValues.videoId}`;

    return `${cleanupPath(resolvedPath) || "download"}${extension}`;
  } catch (err) {
    console.error(err);
    return `tiktok-${media?.isImage ? "image.jpeg" : "video.mp4"}`;
  }
}

export const applyTemplate = (
  tpl,
  fieldValues,
  { sequenceNumber, isMultiImage, collectionName }
) => {
  const tplHasTabName = /\{tabName(?:[:|}])/.test(tpl);

  return tpl.replace(
    /\{(\w+)(?::(\d+))?(?:\|([^}]+))?\}/g,
    (_, key, maxLenRaw, fallbackRaw) => {
      const maxLen = Number(maxLenRaw) || undefined;
      const isRequiredSequence =
        key === "sequenceNumber" && fallbackRaw === "required";

      if (key === "sequenceNumber") {
        if (isRequiredSequence || (fieldValues.isImage && isMultiImage))
          return sequenceNumber;
        return "";
      }

      if (key === "ad") return fieldValues.isAd ? "ad" : "";
      if (key === "mediaType") return fieldValues.isImage ? "image" : "video";

      if (
        key === "tabName" &&
        AppState.scrapperDetails.scrappingStage == "downloading"
      ) {
        const val =
          toTitleCase(AppState.scrapperDetails.selectedTab || "") ||
          fallbackRaw ||
          "";
        if (AppState.scrapperDetails.selectedTab == "collection") {
          return `${val}s/${collectionName}`;
        } else {
          return val;
        }
      } else if (key === "tabName") {
        return "";
      }

      // Normal value lookup
      let val = fieldValues[key];

      // Special fallback for authorUsername when tpl has {tabName} and fallback is :profile:
      if (
        key === "authorUsername" &&
        fallbackRaw === ":profile:" &&
        tplHasTabName &&
        AppState.scrapperDetails.scrappingStage == "downloading"
      ) {
        val = getCurrentPageUsername() || val;
      }

      if (val == null || val === "") {
        val = fallbackRaw ?? `missing-${key}`;
      }
      if (maxLen) val = val.slice(0, maxLen);
      return val;
    }
  );
};

export const cleanupPath = (path) =>
  path
    // Remove known extensions from last segment
    .replace(
      /\/?([^/]+)\.(jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|tiff|bmp|svg)$/i,
      "/$1"
    )
    // Collapse multiple slashes
    .replace(/\/+/g, "/")
    // Collapse multiple dashes or underscores
    .replace(/--+/g, "-")
    .replace(/__+/g, "_")
    // Reduce mixed dash/underscore groups
    .replace(/[-_]+/g, (m) => m[0])
    // Trim -/_ at start of each segment
    .replace(/(^|\/)[-_]+/g, "$1")
    // Trim -/_ at end of each segment
    .replace(/[-_]+($|\/)/g, "$1")
    // Remove leading/trailing slashes
    .replace(/^\/+|\/+$/g, "");

export function getSrcById(id) {
  try {
    const item = Object.values(AppState.allItemsEverSeen)
      .flat()
      .find((item) => item.id == id);
    if (
      item &&
      item.video &&
      item.video.playAddr &&
      item.video.playAddr.startsWith("http")
    ) {
      return item.video.playAddr;
    }
  } catch (error) {
    if (AppState.debug.active)
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
    if (AppState.debug.active)
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
      if (AppState.debug.active) console.log("Fiber Item:", fiberItem?.id, id);
      // Check if the fiber

      if (fiberItem?.id == id && fiberItem && fiberItem.url) {
        return fiberItem.url;
      } else {
        if (AppState.debug.active)
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
    if (AppState.debug.active)
      console.warn(
        "reactFiber Error in getting src by id (React Fiber)",
        error
      );
  }
  if (AppState.debug.active)
    console.warn("reactFiber No valid video source found for ID:", id);
  return null;
}

export function getCurrentPlayingArticle() {
  const progressBar = document.querySelector(
    'div[role="slider"][aria-valuenow]:not([aria-valuenow="0"])'
  );
  if (progressBar) {
    return progressBar.closest("article");
  }

  const playingVideo = document.querySelector('video[src^="blob:"]');
  if (playingVideo) {
    return playingVideo.closest("article");
  }

  const unmuted = document.querySelector(
    'div[data-e2e="video-sound"][aria-pressed="true"]'
  );
  if (unmuted) {
    return unmuted.closest("article");
  }
  if (AppState.debug.active)
    console.warn("ttkdebugger: No playing article found");
  return null;
}

export function getUsernameFromPlayingArticle() {
  return getPostInfoFrom(getCurrentPlayingArticle(), {
    origin: "getUsernameFromPlayingArticle",
  })?.username;
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
    if (AppState.debug.active)
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
    if (AppState.debug.active)
      console.warn("Failed to get username from allDirectLinks", error);
    return null;
  }
}

function getPostListContext(options) {
  // Strategy A: user-post-item-list
  let list = document.querySelector('[data-e2e="user-post-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="user-post-item"]');
    if (items.length > 0) {
      console.log(`ETTVD_INFO_DEBUG strategy-user-post-list`);
      return { list, items, strategy: "user-post-list" };
    }
  }

  // Strategy B: challenge-item-list
  list = document.querySelector('[data-e2e="challenge-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="challenge-item"]');
    if (items.length > 0) {
      console.log(
        `ETTVD_INFO_DEBUG-${options?.origin} strategy-challenge-list`
      );
      return { list, items, strategy: "challenge-list" };
    }
  }

  // Strategy C: explore-item-list
  list = document.querySelector('[data-e2e="explore-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="explore-item"]');
    if (items.length > 0) {
      console.log(`ETTVD_INFO_DEBUG-${options?.origin} strategy-explore-list`);
      return { list, items, strategy: "explore-list" };
    }
  }

  // Strategy D: reposts-item-list
  list = document.querySelector('[data-e2e="user-repost-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="user-repost-item"]');
    if (items.length > 0) {
      console.log(`ETTVD_INFO_DEBUG-${options?.origin} user-repost-item`);
      return { list, items, strategy: "repost-list" };
    }
  }

  // Strategy E: liked-item-list
  list = document.querySelector('[data-e2e="user-liked-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="user-liked-item"]');
    if (items.length > 0) {
      console.log(`ETTVD_INFO_DEBUG-${options?.origin} user-liked-item`);
      return { list, items, strategy: "liked-list" };
    }
  }

  // Strategy F: favorites-item-list
  list = document.querySelector('[data-e2e="favorites-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="favorites-item"]');
    if (items.length > 0) {
      console.log(`ETTVD_INFO_DEBUG-${options?.origin} favorites-item`);
      return { list, items, strategy: "favorites-list" };
    }
  }

  // Strategy G: collection-item-list
  list = document.querySelector('[data-e2e="collection-item-list"]');
  if (list) {
    const items = list.querySelectorAll('[data-e2e="collection-item"]');
    if (items.length > 0) {
      console.log(`ETTVD_INFO_DEBUG-${options?.origin} collection-item`);
      return { list, items, strategy: "collection-list" };
    }
  }

  return { list: null, items: [], strategy: null };
}

export function listScrollingCompleted() {
  const { list, items } = getPostListContext();
  if (!list || items.length === 0) return true;

  const lastItem = items[items.length - 1];
  const rect = lastItem.getBoundingClientRect();

  const isInViewport =
    rect.top >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight);

  const fullyLoaded =
    list.scrollHeight - list.scrollTop <= list.clientHeight + 5;

  return isInViewport && fullyLoaded && !isSpinnerInPostListParentVisible();
}

function computeScrollDone() {
  const { list, items } = getPostListContext();
  if (!list || !items?.length) return false;

  const lastItem = items[items.length - 1];
  const rect = lastItem.getBoundingClientRect();

  const isInViewport =
    rect.top >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight);

  const fullyLoaded =
    list.scrollHeight - list.scrollTop <= list.clientHeight + 5;

  return isInViewport && fullyLoaded && !isSpinnerInPostListParentVisible();
}

export function scrollToLastUserPost() {
  if (
    AppState.downloadPreferences.autoScrollMode != "always" ||
    listScrollingCompleted()
  ) {
    if (AppState.debug.active)
      console.warn("❌ Cannot scroll the list — not available or disabled.");
    return;
  }

  const { items } = getPostListContext();
  const lastItem = items[items.length - 1];
  lastItem?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Finds the spinner <svg> inside the parent of the user post list
 * and returns true if it's visible in the viewport.
 */
function isSpinnerInPostListParentVisible() {
  const postList = document.querySelector('[data-e2e="user-post-item-list"]');
  if (!postList || !postList.parentElement) return false;

  const spinner = postList.parentElement.querySelector(
    'svg[class*="SvgContainer"]'
  );
  return spinner ? isElementInViewport(spinner) : false;
}

function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

export function detectScrollEnd(onEnd, wait = 10 * 1000) {
  const { items: initialItems } = getPostListContext();
  const initialCount = initialItems.length;

  setTimeout(() => {
    const { items: currentItems } = getPostListContext();
    const newCount = currentItems.length;

    const spinnerVisible = isSpinnerInPostListParentVisible();
    const scrollEnded = listScrollingCompleted();
    if (newCount === initialCount && !spinnerVisible && scrollEnded) {
      console.log("✅ Scroll ended — no new posts and no parent spinner.");
      onEnd?.();
    } else {
      if (spinnerVisible) {
        console.log("⏳ Still loading — spinner in parent is visible.");
      } else {
        console.log("🔁 More items loaded — keep scrolling.");
      }
    }
  }, wait);
}

export function isVideoAd(videoEl) {
  if (!videoEl) return false;

  // Climb up to the post container
  let el = videoEl;
  while (el && el.getAttribute("data-e2e") !== "feed-video") {
    el = el.parentElement;
  }
  if (!el) return false;

  // Look for the word "Sponsored" somewhere in author/metadata area
  const sponsoredTextNode = Array.from(el.querySelectorAll("*")).find(
    (node) => node.textContent?.trim().toLowerCase() === "sponsored"
  );

  // Also catch common marketing terms in description or music link
  const descText =
    el.querySelector('[data-e2e="video-desc"]')?.textContent?.toLowerCase() ||
    "";
  const musicText =
    el.querySelector('[data-e2e="video-music"]')?.textContent?.toLowerCase() ||
    "";

  const keywords = ["sponsored", "promoted", "partnered"];
  const containsAdKeywords = keywords.some(
    (k) => descText.includes(k) || musicText.includes(k)
  );

  // Additional fallback: links in author anchor
  const authorLink =
    el.querySelector('[data-e2e="video-author-uniqueid"]')?.closest("a")
      ?.href || "";
  const hasExternalAdUtm =
    /utm_source=|utm_campaign=|discount|ref|ttclid/i.test(authorLink);

  return Boolean(sponsoredTextNode || containsAdKeywords || hasExternalAdUtm);
}

export function canClickNextButton() {
  // Primary selector
  const buttons = document.querySelectorAll(
    "button.TUXButton--capsule.action-item"
  );

  for (const btn of buttons) {
    const svgPath = btn.querySelector("svg path");
    if (svgPath?.getAttribute("d")?.includes("13.17-13.17")) {
      return true;
    }
  }

  // Fallback selector
  const fallback = document.querySelector('button[data-e2e="arrow-right"]');
  return !!fallback;
}

export function clickNextButton() {
  if (
    AppState.downloadPreferences.autoScrollMode == "off" ||
    !canClickNextButton()
  ) {
    if (AppState.debug.active)
      console.warn(
        "SWIPE UP❌ Cannot click swipe button — not available or disabled.",
        AppState.downloadPreferences.autoScrollMode,
        !canClickNextButton()
      );
    return;
  }

  let target = null;

  // Try primary button
  const buttons = document.querySelectorAll(
    "button.TUXButton--capsule.action-item"
  );
  buttons.forEach((btn) => {
    const svgPath = btn.querySelector("svg path");
    if (svgPath?.getAttribute("d")?.includes("13.17-13.17")) {
      target = btn;
    }
  });

  // Fallback button if primary not found
  if (!target) {
    target = document.querySelector('button[data-e2e="arrow-right"]');
  }

  if (!target) {
    return;
  }

  const delay = Math.floor(Math.random() * 900) + 300;
  setTimeout(() => {
    target.click();
    if (AppState.debug.active)
      console.log("✅ SWIPE UP BUTTON CLICKED after", delay, "ms");
  }, delay);
}

function escapeCSV(value) {
  if (value == null) return '""';
  const str = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
  return `"${str}"`; // Always wrap in double quotes
}

export function saveCSVFile(dataArray) {
  if (!dataArray.length) return;

  // Gather all unique keys across all objects
  const standardFields = ["filename", "filepath"];
  const dynamicFields = Array.from(
    new Set(dataArray.flatMap((item) => Object.keys(item)))
  ).filter((key) => !standardFields.includes(key));

  const headers = ["index", ...dynamicFields.sort(), ...standardFields];

  const rows = dataArray.map((video) => {
    const filepath = getDownloadFilePath(video);
    const filename = filepath.split("/").pop();

    return headers
      .map((key) => {
        let value = "";

        if (key in video) {
          const v = video[key];
          value = Array.isArray(v) ? v.join(", ") : v;
        } else if (key === "filename") {
          value = filename;
        } else if (key === "filepath") {
          value = filepath;
        }

        return escapeCSV(value);
      })
      .join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });

  // Generate filename
  const date = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  const recordCount = dataArray.length;
  const authorIds = new Set(dataArray.map((v) => v.authorId));
  const sameAuthor = authorIds.size === 1 ? [...authorIds][0] : null;

  let filename = `video_export_${date}_${recordCount}_items`;
  if (sameAuthor) filename += `_${sameAuthor}`;
  filename += `.csv`;

  // Trigger download
  const blobUrl = URL.createObjectURL(blob);
  const filepath = `${
    AppState.downloadPreferences.folderName || DOWNLOAD_FOLDER_DEFAULT + "/"
  }${filename}`;
  sendBasicBlobDownloadRequest({
    blobUrl,
    filename: filepath,
    showFolderPicker: AppState.downloadPreferences.showFolderPicker,
  });
}

export function convertTikTokRawToMediaObject(tiktokRaw) {
  if (!tiktokRaw) return;
  const defaultBitrate = tiktokRaw.defaultBitrate;
  const mainBitrateInfo =
    tiktokRaw.bitrateInfo?.find((b) => b.Bitrate === defaultBitrate) ||
    tiktokRaw.bitrateInfo?.[0];

  return {
    id: tiktokRaw.id,
    author: {
      authorId: tiktokRaw.teaParams?.author_id || null,
    },
    video: {
      playAddr:
        tiktokRaw.url || mainBitrateInfo?.PlayAddr?.UrlList?.[0] || null,
      duration: tiktokRaw.duration,
      bitrate: defaultBitrate,
      definition: tiktokRaw.defaultDefinition,
      volumeInfo: {
        Loudness: tiktokRaw.volumeInfo?.Loudness,
        Peak: tiktokRaw.volumeInfo?.Peak,
      },
      subtitleInfos: tiktokRaw.subtitleList || [],
    },

    stats: {
      playCount:
        tiktokRaw.metrics?._videoPlayHandleParams?.video_vv_history || null,
      diggCount:
        tiktokRaw.metrics?._videoPlayHandleParams?.video_like_history || null,
      commentCount:
        tiktokRaw.metrics?._videoPlayHandleParams?.video_comment_history ||
        null,
      shareCount:
        tiktokRaw.metrics?._videoPlayHandleParams?.video_share_history || null,
    },
    isAd: tiktokRaw.teaParams?.isAd || false,
    downloaderHasLowConfidence: true,
  };
}

export function buildVideoLinkMeta(media, index) {
  if (!media) return;
  const hashtags =
    media?.textExtra?.map((tag) => tag?.hashtagName).filter(Boolean) || [];
  const subtitles =
    media?.video?.subtitleInfos
      ?.map((sub) => sub?.LanguageCodeName)
      .filter(Boolean) || [];

  return {
    // Super required
    index,
    videoId: media?.id,
    url:
      media?.video?.playAddr ||
      AppState.allItemsEverSeen[media?.id]?.video?.playAddr ||
      media?.video?.originCover ||
      media?.video?.cover,
    authorId:
      typeof media?.author == "string"
        ? media?.author
        : media?.author?.uniqueId,
    authorNickname:
      typeof media?.author == "string"
        ? media?.author
        : media?.author?.nickname,
    desc: media?.desc,
    isImage: Boolean(media.imagePost),
    // Extras
    hashtags,
    createTime: media?.createTime
      ? new Date(Number(media.createTime) * 1000)
      : "",
    imagePostImages: media?.imagePost?.images.map((it) =>
      it.imageURL.urlList?.at(0)
    ),
    duration: media?.video?.duration,
    videoRatio: media?.video?.ratio,
    videoBitrate: media?.video?.bitrate,
    definition: media?.video?.definition,
    coverImage: media?.video?.cover,
    dynamicCover: media?.video?.dynamicCover,
    originCover: media?.video?.originCover,
    loudness: media?.video?.volumeInfo?.Loudness,
    peakVolume: media?.video?.volumeInfo?.Peak,
    musicTitle: media?.music?.title,
    musicAuthor: media?.music?.authorName,
    musicUrl: media?.music?.playUrl,
    subtitleLanguages: subtitles,
    location: media?.locationCreated,
    views: media?.stats?.playCount,
    likes: media?.stats?.diggCount,
    comments: media?.stats?.commentCount,
    shares: media?.stats?.shareCount,
    authorFollowers: media?.authorStats?.followerCount,
    authorLikesTotal: media?.authorStats?.heart,
    downloadTime: null,
    isAd: media?.isAd, // High confidence when true, false can be misleading.
    downloaderHasLowConfidence: media?.downloaderHasLowConfidence ?? false,
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function downloadAllPostImagesHandler(e, media) {
  return new Promise(async (resolve) => {
    if (e) e.stopPropagation();

    const downloadAllBtn = e?.currentTarget;
    let originalText;
    if (downloadAllBtn) {
      originalText = downloadAllBtn.textContent;
      downloadAllBtn.textContent = "⏳ Downloading...";
      downloadAllBtn.disabled = true;

      AppState.downloading.isActive = true;
      AppState.downloading.isDownloadingAll = true;
    }

    try {
      let successfulDownloads = 0;
      for (let i = 0; i < media.imagePostImages.length; i++) {
        console.log(
          "DEBUG_DL_ALLA Inside loop images dl ",
          i,
          media.imagePostImages.length
        );
        try {
          if (downloadAllBtn)
            downloadAllBtn.textContent = `⏳ Downloading ${i}/${media.imagePostImages.length}...`;
          await downloadSingleMedia(media, { imageIndex: i });
          successfulDownloads += 1;
        } catch (err) {
          console.error(`Download failed for image ${i}`, err);
          if (downloadAllBtn)
            downloadAllBtn.textContent = `⏳ Failed at ${i}/${media.imagePostImages.length}...`;
          await sleep(2000);
        }
      }
      if (successfulDownloads && !AppState.downloading.isDownloadingAll) {
        showCelebration(
          "downloads",
          getRandomDownloadSuccessMessage("photo", successfulDownloads),
          successfulDownloads
        );
      }
    } catch (error) {
      console.warn("Unexpected error during bulk download:", error);
    } finally {
      if (downloadAllBtn) {
        AppState.downloading.isActive = false;
        AppState.downloading.isDownloadingAll = false;
        downloadAllBtn.textContent = "✅ All Done!";
        setTimeout(() => {
          downloadAllBtn.textContent = originalText;
          downloadAllBtn.disabled = false;
          displayFoundUrls({ forced: true });
          resolve();
        }, 3000);
      } else {
        resolve();
      }
    }
  });
}

export async function downloadSingleMedia(
  media,
  { imageIndex = 0 } = { imageIndex: 0 }
) {
  console.log("DEBUG_DL_ALLA ondownload received ", {
    imageIndex,
  });

  const filename = getDownloadFilePath(media, { imageIndex });
  try {
    let url = media.url;
    if (media.isImage && media.imagePostImages)
      url = media.imagePostImages[imageIndex];
    await downloadURLToDisk(url, filename);
    if (!AppState.downloading.isDownloadingAll) {
      showCelebration(
        "downloads",
        getRandomDownloadSuccessMessage(media.isImage ? "photo" : "video", 1)
      );
    }
  } catch (err) {
    AppState.debug.active ? console.warn(err) : null;
    console.log("DEBUG_DL_ALLA ondownload errored ", {
      imageIndex,
      media,
      err,
    });
  }
}

// export function downloadURLToDisk(url, filename, options = {}) {
//   return new Promise((resolve, reject) => {
//     const maxRetries = 3;
//     let attempt = options.retryCount || 1;

//     function attemptDownload(omitCookies) {
//       AppState.downloading.isActive = true;
//       displayFoundUrls({ forced: true });

//       fetch(url, { credentials: omitCookies ? "omit" : "include" })
//         .then((resp) => {
//           AppState.downloading.isActive = false;
//           displayFoundUrls({ forced: true });

//           if (!resp.ok) throw new Error(resp.statusText);
//           return resp.blob();
//         })
//         .then((blob) => {
//           if (blob.size === 0) throw new Error("Empty file");

//           const blobUrl = URL.createObjectURL(blob);

//           function handleResponse(event) {
//             if (
//               event.source !== window ||
//               !event.data ||
//               event.data.type !== "BLOB_DOWNLOAD_RESPONSE"
//             )
//               return;

//             window.removeEventListener("message", handleResponse);

//             try {
//               URL.revokeObjectURL(blobUrl);
//             } catch (e) {
//               if (AppState.debug.active)
//                 console.warn("⚠️ Failed to revoke blob URL:", e);
//             }

//             if (event.data.success) {
//               resolve(true);
//               AppState.sessionHasConfirmedDownloads = true;
//             } else {
//               reject(new Error(event.data.error || "Unknown download error"));
//             }
//           }

//           window.addEventListener("message", handleResponse);

//           sendBasicBlobDownloadRequest({
//             blobUrl,
//             filename,
//             showFolderPicker: AppState.downloadPreferences.showFolderPicker,
//           });
//         })
//         .catch(async (err) => {
//           AppState.downloading.isActive = false;
//           displayFoundUrls({ forced: true });

//           if (AppState.debug.active)
//             console.warn(`❌ Download error [attempt ${attempt}]:`, err);

//           if (attempt < maxRetries) {
//             attempt++;
//             const nextOmit = attempt === 2;
//             if (AppState.debug.active)
//               console.warn("⚠️ Retrying download attempt", attempt);
//             attemptDownload(nextOmit);
//           } else {
//             if (AppState.debug.active)
//               console.warn("⚠️ All attempts failed. Falling back...");

//             if (AppState.downloadPreferences.skipFailedDownloads) {
//               if (AppState.debug.active)
//                 console.warn(
//                   "⚠️ All attempts failed. Skipped as failed download."
//                 );
//               return reject(err);
//             }
//             await showAlertModal(
//               `⚠️ <b>Something went wrong.</b><br><br>
//   We'll try saving the video to your device's Downloads folder, or opening it in a new tab.<br><br>
//   If it opens in a new tab, please right-click and choose “Save As” to download it manually.<br><br>
//   This issue often happens if the post's privacy is set to <b>Only Me</b> or similar — in those cases, the downloader can't access it directly, but “Save As” in your browser may still work.<br><br>
//   <b>File:</b> ${filename.split("/").pop() || "Unknown"}`
//             );

//             const a = document.createElement("a");
//             a.href = url;
//             a.download = filename;
//             a.target = "_blank";
//             document.body?.appendChild(a);
//             a.click();
//             document.body?.removeChild(a);

//             // Do NOT resolve or reject — just let the user handle it manually
//             reject(true);
//           }
//         });
//     }

//     attemptDownload(options.omitCookies || false);
//   });
// }

// page script
function uuid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function postBlobDownloadRequest({ id, blobUrl, filename, showFolderPicker }) {
  console.error("File name", filename);
  window.postMessage(
    {
      type: "BLOB_DOWNLOAD_REQUEST",
      id,
      payload: {
        blobUrl,
        filename: filename.replace(/[{}]/g, ""),
        showFolderPicker: !!showFolderPicker,
      },
    },
    "*"
  );
}

function waitForBlobDownloadResponse(id, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
      resolve(val);
    };

    function onMsg(ev) {
      const d = ev?.data;
      if (
        ev.source !== window ||
        !d ||
        d.type !== "BLOB_DOWNLOAD_RESPONSE" ||
        d.id !== id
      )
        return;
      finish(d);
    }

    const timer = setTimeout(() => {
      finish({
        success: false,
        code: "ERR_PAGE_TIMEOUT",
        error: "No content-script response within 25s",
      });
    }, timeoutMs);

    window.addEventListener("message", onMsg);
  });
}

export async function downloadURLToDisk(url, filename, options = {}) {
  const maxRetries = 3;
  let attempt = options.retryCount || 1;

  const setActive = (val) => {
    try {
      AppState.downloading.isActive = !!val;
      displayFoundUrls({ forced: true });
    } catch {}
  };

  while (attempt <= maxRetries) {
    const omitCookies = options.omitCookies ?? attempt === 2; // 2nd try: omit cookies
    try {
      setActive(true);
      const resp = await fetch(url, {
        credentials: omitCookies ? "omit" : "include",
      });
      setActive(false);

      if (!resp.ok) {
        const err = new Error(
          `HTTP ${resp.status} ${resp.statusText || ""}`.trim()
        );
        err.code = "ERR_HTTP";
        throw err;
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        const err = new Error("Empty file");
        err.code = "ERR_EMPTY_BLOB";
        throw err;
      }

      const blobUrl = URL.createObjectURL(blob);
      const id = uuid();

      try {
        // ask background to save to disk
        postBlobDownloadRequest({
          id,
          blobUrl,
          filename,
          showFolderPicker: AppState?.downloadPreferences?.showFolderPicker,
        });

        const res = await waitForBlobDownloadResponse(id, 25000);

        // always revoke, regardless of result
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          if (AppState?.debug?.active)
            console.warn("⚠️ Failed to revoke blob URL:", e);
        }

        if (res?.success) {
          AppState.sessionHasConfirmedDownloads = true;
          return true;
        }

        const err = new Error(res?.error || "Unknown download error");
        err.code = res?.code || "ERR_UNKNOWN";
        throw err;
      } catch (e) {
        // ensure blobUrl is revoked if inner try failed before revoke
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
        throw e;
      }
    } catch (err) {
      console.error(err);
      setActive(false);
      if (AppState?.debug?.active)
        console.warn(
          `❌ Download error [attempt ${attempt}/${maxRetries}]`,
          err
        );

      if (attempt < maxRetries) {
        attempt += 1;
        continue; // retry
      }

      // final failure path -> optional fallback
      if (AppState?.downloadPreferences?.skipFailedDownloads) {
        // propagate the real error up
        throw err;
      }

      // user-visible fallback + propagate a structured error
      const shouldContinue = await showAlertModal(
        `⚠️ <b>Download failed.</b><br><br>
We couldn't save this file automatically, but we'll open it in a new tab so you can use <b>Right-click → Save As</b>.<br><br>
This often happens with <b>private</b> or <b>Only Me</b> posts.<br><br>
<b>File:</b> ${filename.split("/").pop() || "Unknown"}<br><br>
Tip: You can skip failed downloads automatically for the rest of this session.`,
        "Skip Failed Downloads",
        () => {
          AppState.downloadPreferences.skipFailedDownloads = true;
          showAlertModal(
            "✅ Failed downloads will now be skipped for this session."
          );
        }
      );
      if (!shouldContinue) throw new Error("Couldn't save this one file!");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      document.body?.appendChild(a);
      a.click();
      document.body?.removeChild(a);

      const fallErr = new Error("Fell back to manual save");
      fallErr.code = "ERR_FALLBACK_MANUAL";
      throw fallErr;
    }
  }

  // should be unreachable
  const unreachable = new Error("Unreachable state");
  unreachable.code = "ERR_UNREACHABLE";
  throw unreachable;
}

export function displayFoundUrls({ forced } = {}) {
  try {
    if (AppState.debug.active) {
      console.log("ettvdebugger: displayFoundUrls called", { forced });
    }

    // Anti flickering
    if (
      !forced &&
      document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER) &&
      !document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER).querySelector("ol")
        ?.innerHTML &&
      !AppState.allDirectLinks.length &&
      !Object.keys(AppState.allItemsEverSeen).length
    ) {
      return;
    }
    if (forced)
      // Update the button regardless.
      // TODO: If this causes some bugs, remove it
      updateDownloadButtonLabelSimple();
    console.log("UI CLOSED: ", AppState.ui);
    if (AppState.ui.isDownloaderClosed) return hideDownloader();
    // Think about cases the user moves to another page while downloading
    // They are not seing any progress on the downloader, re-render it
    if (
      (AppState.downloading.isActive ||
        AppState.downloading.isDownloadingAll) &&
      document.getElementById(DOM_IDS.DOWNLOADER_WRAPPER)
    ) {
      if (AppState.debug.active) {
        console.log(
          "ettvdebugger: Downloader is active or downloading all, not re-rendering",
          {
            forced,
            isActive: AppState.downloading.isActive,
            isDownloadingAll: AppState.downloading.isDownloadingAll,
          }
        );
      }
      return;
    }

    let items = [];
    if (AppState.filters.currentProfile && getCurrentPageUsername() != "😃") {
      items = Object.values(AppState.allItemsEverSeen)
        .flat()
        .filter(
          (it) =>
            it.author === getCurrentPageUsername() ||
            it.author?.uniqueId === getCurrentPageUsername()
        );
    } else {
      items = Object.values(AppState.allItemsEverSeen).flat();
    }
    if (getCurrentPageUsername() === "😃") {
      AppState.filters.currentProfile = false;
    }
    const hashToDisplay = getDisplayedItemsHash(items);
    const path = window.location.pathname;
    if (
      !forced &&
      AppState.displayedState.itemsHash === hashToDisplay &&
      AppState.displayedState.path === path
    ) {
      if (AppState.debug.active) {
        console.log("ettvdebugger: No changes detected, skipping re-render", {
          forced,
          isEqHash: AppState.displayedState.itemsHash === hashToDisplay,
          itemHash: AppState.displayedState.itemsHash,
          hashToDisplay,
          path: AppState.displayedState.path,
          items,
        });
      }
      return;
    } else {
      // console why changes are detected

      if (AppState.debug.active) {
        if (forced) {
          console.log("ettvdebugger: Forced re-render");
        }
        if (AppState.displayedState.itemsHash !== hashToDisplay) {
          console.log("ettvdebugger: Items hashToDisplay changed", {
            old: AppState.displayedState.itemsHash,
            new: hashToDisplay,
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
    }

    if (document.body instanceof Node) {
      if (items.length === 0) {
        const emptyListEl =
          updateDownloaderList([], hashToDisplay) || createDownloaderWrapper();
        console.warn("Returned empty list Element ", emptyListEl);

        if (emptyListEl instanceof Node) {
          document.body?.appendChild(emptyListEl);
        } else {
          console.warn(
            "❌ updateDownloaderList did not return a Node emptyListEl",
            emptyListEl
          );
        }
        return;
      }

      AppState.allDirectLinks = [];
      const metas = items
        .filter((it) => !(AppState.downloadPreferences.skipAds && it.isAd))
        .map((media, idx) => {
          console.log("Build meta for ", media);
          const meta = buildVideoLinkMeta(media, idx);
          console.log("Build meta for result ", meta);

          AppState.allDirectLinks.push(meta);

          return meta;
        });

      const listEl = updateDownloaderList(metas, hashToDisplay);
      console.warn("Returned list Element ", listEl);

      if (listEl instanceof Node) {
        document.body?.appendChild(listEl);
      } else {
        console.warn(
          "❌ updateDownloaderList did not return a Node listEl",
          listEl
        );
      }
    } else {
      console.warn(
        "Something very unexpected happened(Document Body Not Available). If downloader fails, refresh this page!",
        document?.body
      );
    }
  } catch (err) {
    console.warn("Display found urls crashed =============== ", err);
  }
}

export function sendBasicBlobDownloadRequest(payload) {
  window.postMessage(
    {
      type: "BLOB_DOWNLOAD_REQUEST",
      payload,
    },
    "*"
  );
}

// Batch download
export async function downloadAllLinks(mainBtn) {
  if (AppState.debug.active)
    console.log("ettvdebugger: Starting batch download");

  AppState.downloading.isActive = true;
  AppState.downloading.isDownloadingAll = true;
  AppState.downloadPreferences.autoScrollMode = "off"; // Turn off scroll for now.

  const links = AppState.allDirectLinks || [];
  let newVideoDownloadedCount = 0;
  let hasImage = false;
  try {
    console.log("DEBUG_DL_ALLA before loop ", links.length);
    for (let i = 0; i < links.length; i++) {
      while (AppState.scrapperDetails.paused) await sleep(800);

      const media = links[i];
      if (AppState.downloadedURLs.includes(media.url)) {
        console.log(
          "DEBUG_DL_ALLA inside loop url already downloaded for",
          media.videoId,
          media.isImage
        );
        continue;
      }
      AppState.downloadedURLs.push(media.url);

      try {
        updateDownloadButtonLabelSimple();
        await (!media.isImage
          ? downloadSingleMedia(media)
          : downloadAllPostImagesHandler(null, media));
        // Load confirmed downloaded urls
        AppState.leaderboard.newlyConfirmedMedia.push(media);
        console.log(
          "DEBUG_DL_ALLA inside loop strategy: ",
          media.isImage,
          !media.isImage
            ? downloadSingleMedia.name
            : downloadAllPostImagesHandler.name
        );
        if (media.isImage) hasImage = true;
        newVideoDownloadedCount += 1;
      } catch (err) {
        console.log("DEBUG_DL_ALLA inside loop failed: ", err);
        if (AppState.debug.active) console.warn(err);
        updateDownloadButtonLabel(mainBtn, `Error at ${i + 1}/${links.length}`);
      }
    }

    AppState.downloading.isActive = false;
    AppState.downloading.isDownloadingAll = false;
  } catch (error) {
    if (newVideoDownloadedCount) {
      updateAllTimeDownloadsAndLeaderBoard(AppState.displayedState.itemsHash);
    }

    console.log("DEBUG_DL_ALLA outside failed: ", media.isImage, err);

    AppState.downloading.isActive = false;
    AppState.downloading.isDownloadingAll = false;
    if (AppState.debug.active) console.warn(error);
  }

  console.log("DEBUG_DL_ALLA exited loop 2 ", links.length);

  if (!newVideoDownloadedCount && AppState.downloadedURLs.length > 0) {
    updateDownloadButtonLabel(
      mainBtn,
      `All ${AppState.downloadedURLs.length} Post${
        AppState.downloadedURLs.length > 1 ? "s" : ""
      } Already Downloaded!`
    );
  } else {
    updateDownloadButtonLabel(
      mainBtn,
      `Downloaded ${AppState.downloadedURLs.length} Posts!`
    );
    if (AppState.downloadPreferences.includeCSV) {
      saveCSVFile(AppState.allDirectLinks);
    }
    updateAllTimeDownloadsAndLeaderBoard(AppState.displayedState.itemsHash);
    if (
      AppState.scrapperDetails.scrappingStage != "downloading" &&
      newVideoDownloadedCount &&
      AppState.sessionHasConfirmedDownloads
    ) {
      showCelebration(
        "downloads",
        getRandomDownloadSuccessMessage(
          !hasImage ? "video" : "post",
          newVideoDownloadedCount
        ),
        newVideoDownloadedCount
      );
    }
  }
  AppState.downloading.isDownloadingAll = false;
  AppState.downloading.isActive = false;
  const showRateDonateOn = shouldShowRateDonatePopup();
  if (showRateDonateOn) {
    setTimeout(() => {
      showMorpheusRateUsPage();
    }, 10_000);
  }
  showStatsSpan();

  if (AppState.scrapperDetails.scrappingStage == "downloading") {
    AppState.scrapperDetails.scrappingStage = "completed";
    AppState.scrapperDetails.selectedTab = null;
    localStorage.setItem(
      STORAGE_KEYS.SCRAPPER_DETAILS,
      JSON.stringify(AppState.scrapperDetails)
    );
    if (!showRateDonateOn)
      showCelebration("downloads", showRandomScraperDone());
  }
}

export function getSavedTemplates() {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE_KEYS.FULL_PATH_TEMPLATES)) || []
    );
  } catch {
    return [];
  }
}

export function getPresetTemplates() {
  return FILE_STORAGE_LOCATION_TEMPLATE_PRESETS;
}

export function getDefaultPresetTemplate() {
  return FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find((it) => it.isDefault);
}
export function getRecommendedPresetTemplate() {
  return FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find((it) => it.isRecommended);
}
export function saveTemplates(templates) {
  localStorage.setItem(
    STORAGE_KEYS.FULL_PATH_TEMPLATES,
    JSON.stringify(templates)
  );
}

export function saveSelectedTemplate() {
  localStorage.setItem(
    STORAGE_KEYS.SELECTED_FULL_PATH_TEMPLATE,
    JSON.stringify(AppState.downloadPreferences.fullPathTemplate)
  );
}

export function updateAllTimeDownloadsAndLeaderBoard(dataHash) {
  console.log("LEADERBOARD 🚀 started", dataHash);

  if (AppState.leaderboard.currentlyUpdating) {
    if (AppState.debug.active) {
      console.log(
        "LEADERBOARD ⚠️ Skipping — update already in progress",
        AppState.leaderboard.lastUpdateHash,
        dataHash
      );
    }
    return;
  }

  if (
    AppState.leaderboard.lastUpdateHash &&
    AppState.leaderboard.lastUpdateHash === dataHash
  ) {
    if (AppState.debug.active) {
      console.log(
        "LEADERBOARD ⚠️ Skipping — hash already processed",
        AppState.leaderboard.lastUpdateHash,
        dataHash
      );
    }
    return;
  }

  AppState.leaderboard.currentlyUpdating = true;
  AppState.leaderboard.lastUpdateHash = dataHash;

  try {
    const weekId = getCurrentWeekId();
    const newlyConfirmed = AppState.leaderboard.newlyConfirmedMedia || [];
    const newCount = newlyConfirmed.length;

    // All-time count
    const prevAllTime = Number(
      localStorage.getItem(STORAGE_KEYS.DOWNLOADS_ALL_TIME_COUNT) || 0
    );
    const updatedAllTime = prevAllTime + newCount;
    AppState.leaderboard.allTimeDownloadsCount = updatedAllTime;
    localStorage.setItem(STORAGE_KEYS.DOWNLOADS_ALL_TIME_COUNT, updatedAllTime);

    // === FIX: Weekly counter as object { weekId, count }
    const weekDataRaw = localStorage.getItem(
      STORAGE_KEYS.DOWNLOADS_WEEKLY_DATA
    );
    let weekData = { count: 0, weekId };

    if (weekDataRaw) {
      try {
        const parsed = JSON.parse(weekDataRaw);
        if (parsed.weekId === weekId) {
          weekData = parsed;
        }
      } catch {
        // Fallback to reset if invalid JSON
      }
    }

    weekData.count += newCount;

    AppState.leaderboard.weekDownloadsData = weekData;
    localStorage.setItem(
      STORAGE_KEYS.DOWNLOADS_WEEKLY_DATA,
      JSON.stringify(weekData)
    );

    // Leaderboards
    const allTimeMap = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.DOWNLOADS_LEADERBOARD_ALL_TIME) || "{}"
    );
    const weeklyMap = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.DOWNLOADS_LEADERBOARD_WEEKLY) || "{}"
    );

    newlyConfirmed
      .filter((it) => !it.isTrackedAsDownloaded)
      .forEach((media) => {
        media.isTrackedAsDownloaded = true;

        const authorId = media.authorId || "--unknown--";
        const username = authorId;

        // All-time leaderboard
        if (allTimeMap[authorId]) {
          allTimeMap[authorId].count += 1;
          allTimeMap[authorId].lastUpdatedAt = weekId;
        } else {
          allTimeMap[authorId] = {
            count: 1,
            username,
            lastUpdatedAt: weekId,
          };
        }

        // Weekly leaderboard
        if (!weeklyMap[weekId]) weeklyMap[weekId] = {};
        if (weeklyMap[weekId][authorId]) {
          weeklyMap[weekId][authorId].count += 1;
        } else {
          weeklyMap[weekId][authorId] = { count: 1, username };
        }
      });

    // === Trim old weeks
    const sortedWeekIds = Object.keys(weeklyMap).sort();
    if (sortedWeekIds.length > DATA_PRUNE_MAX_WEEKS_TO_KEEP) {
      const weeksToDelete = sortedWeekIds.slice(
        0,
        sortedWeekIds.length - DATA_PRUNE_MAX_WEEKS_TO_KEEP
      );
      for (const oldWeek of weeksToDelete) {
        delete weeklyMap[oldWeek];
      }
    }

    // === Prune inactive authors
    for (const [authorId, authorData] of Object.entries(allTimeMap)) {
      const { count, lastUpdatedAt } = authorData;
      const isLowCount = count < PRUNE_LOW_DOWNLOADS_COUNT;
      const isStale =
        weeksSince(lastUpdatedAt, weekId) >
        PRUNE_AFTER_MAX_WEEKS_OF_LOW_DOWNLOADS;

      if (isLowCount && isStale) {
        delete allTimeMap[authorId];
        for (const wId of Object.keys(weeklyMap)) {
          delete weeklyMap[wId][authorId];
        }
        if (AppState.debug.active) {
          console.log(
            `LEADERBOARD 🧹 Pruned ${authorId} — count=${count}, last active ${lastUpdatedAt}`
          );
        }
      }
    }

    // Save updated maps
    localStorage.setItem(
      STORAGE_KEYS.DOWNLOADS_LEADERBOARD_ALL_TIME,
      JSON.stringify(allTimeMap)
    );
    localStorage.setItem(
      STORAGE_KEYS.DOWNLOADS_LEADERBOARD_WEEKLY,
      JSON.stringify(weeklyMap)
    );

    // Did this user get into another all time tier?
    const currentProgressLevel = AppState.currentTierProgress.downloads || 0;
    const newTier = getUserDownloadsCurrentTier(
      AppState.leaderboard.allTimeDownloadsCount
    );
    const newTierLevel = newTier.min;
    if (newTierLevel > currentProgressLevel) {
      // Save state
      try {
        AppState.currentTierProgress.downloads = newTierLevel;
        localStorage.setItem(
          STORAGE_KEYS.CURRENT_TIER_PROGRESS,
          JSON.stringify(AppState.currentTierProgress)
        );

        showCelebration(
          "tier",
          getTierHypeMessageDownloads(newTier),
          newTier.min
        );
      } catch (err) {
        console.log("Error displaying confetti", err);
      }
    }

    if (AppState.debug.active) {
      console.log("LEADERBOARD ✅ Update complete", {
        allTime: allTimeMap,
        weekly: weeklyMap[weekId],
        updatedAllTime,
        updatedWeekly: weekData.count,
        weekId,
      });
    }
  } catch (err) {
    if (AppState.debug.active) {
      console.error("LEADERBOARD ❌ Error during update", err);
    }
  } finally {
    AppState.leaderboard.currentlyUpdating = false;
  }
}

export function updateAllTimeRecommendationsLeaderBoard(dataHash) {
  console.log("RECOMMENDATIONS 🚀 started", dataHash);

  if (AppState.recommendationsLeaderboard.currentlyUpdating) {
    if (AppState.debug.active) {
      console.log(
        "RECOMMENDATIONS ⚠️ Skipping — update already in progress",
        AppState.recommendationsLeaderboard.lastUpdateHash,
        dataHash
      );
    }
    return;
  }

  if (
    AppState.recommendationsLeaderboard.lastUpdateHash &&
    AppState.recommendationsLeaderboard.lastUpdateHash === dataHash
  ) {
    if (AppState.debug.active) {
      console.log(
        "RECOMMENDATIONS ⚠️ Skipping — hash already processed",
        dataHash
      );
    }
    return;
  }

  AppState.recommendationsLeaderboard.currentlyUpdating = true;
  AppState.recommendationsLeaderboard.lastUpdateHash = dataHash;

  try {
    const weekId = getCurrentWeekId();
    const newlyRecommended =
      AppState.recommendationsLeaderboard.newlyRecommendedUrls || [];
    const newCount = newlyRecommended.length;

    const prevAllTime = Number(
      localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS_ALL_TIME_COUNT) || 0
    );
    const updatedAllTime = prevAllTime + newCount;

    // === FIX: Weekly object instead of just number
    const weekDataRaw = localStorage.getItem(
      STORAGE_KEYS.RECOMMENDATIONS_WEEKLY_DATA
    );
    let weekData = { count: 0, weekId };

    if (weekDataRaw) {
      try {
        const parsed = JSON.parse(weekDataRaw);
        if (parsed.weekId === weekId) {
          weekData = parsed;
        }
      } catch {
        // invalid json, fall back to reset
      }
    }

    weekData.count += newCount;
    AppState.recommendationsLeaderboard.allTimeRecommendationsCount =
      updatedAllTime;
    AppState.recommendationsLeaderboard.weekRecommendationsData = weekData;

    localStorage.setItem(
      STORAGE_KEYS.RECOMMENDATIONS_ALL_TIME_COUNT,
      updatedAllTime
    );
    if (weekData.weekId == "missing")
      throw Error("Tried to save missing to db::");
    localStorage.setItem(
      STORAGE_KEYS.RECOMMENDATIONS_WEEKLY_DATA,
      JSON.stringify(weekData)
    );

    const allTimeMap = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_ALL_TIME) ||
        "{}"
    );
    const weeklyMap = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_WEEKLY) ||
        "{}"
    );

    // === Apply updates
    newlyRecommended.forEach((media) => {
      if (media.isTrackedAsRecommended) return;
      media.isTrackedAsRecommended = true;

      const authorId = media.authorId || "--unknown--";
      const username = authorId;

      // All-time
      if (allTimeMap[authorId]) {
        allTimeMap[authorId].count += 1;
        allTimeMap[authorId].lastUpdatedAt = weekId;
      } else {
        allTimeMap[authorId] = {
          count: 1,
          username,
          lastUpdatedAt: weekId,
        };
      }

      // Weekly
      if (!weeklyMap[weekId]) weeklyMap[weekId] = {};
      if (weeklyMap[weekId][authorId]) {
        weeklyMap[weekId][authorId].count += 1;
      } else {
        weeklyMap[weekId][authorId] = { count: 1, username };
      }
    });

    // === Trim old weeks
    const sortedWeekIds = Object.keys(weeklyMap).sort();
    if (sortedWeekIds.length > DATA_PRUNE_MAX_WEEKS_TO_KEEP) {
      const weeksToDelete = sortedWeekIds.slice(
        0,
        sortedWeekIds.length - DATA_PRUNE_MAX_WEEKS_TO_KEEP
      );
      for (const oldWeek of weeksToDelete) {
        delete weeklyMap[oldWeek];
      }
    }

    // === Prune stale users
    for (const [authorId, authorData] of Object.entries(allTimeMap)) {
      const { count, lastUpdatedAt } = authorData;
      const isLowCount = count < PRUNE_LOW_DOWNLOADS_COUNT;
      const isStale =
        weeksSince(lastUpdatedAt, weekId) >
        PRUNE_AFTER_MAX_WEEKS_OF_LOW_DOWNLOADS;

      if (isLowCount && isStale) {
        delete allTimeMap[authorId];
        for (const wId of Object.keys(weeklyMap)) {
          delete weeklyMap[wId][authorId];
        }
        if (AppState.debug.active) {
          console.log(
            `RECOMMENDATIONS 🧹 Pruned ${authorId} — count=${count}, last active ${lastUpdatedAt}`
          );
        }
      }
    }

    // Persist updates
    localStorage.setItem(
      STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_ALL_TIME,
      JSON.stringify(allTimeMap)
    );
    localStorage.setItem(
      STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_WEEKLY,
      JSON.stringify(weeklyMap)
    );

    // Did this user get into another all time tier?
    const currentProgressLevel =
      AppState.currentTierProgress.recommendations || 0;
    const newTier = getUserRecommendationsCurrentTier(
      AppState.recommendationsLeaderboard.allTimeRecommendationsCount
    );
    const newTierLevel = newTier.min;
    if (newTierLevel > currentProgressLevel) {
      // Save state
      try {
        AppState.currentTierProgress.recommendations = newTierLevel;
        localStorage.setItem(
          STORAGE_KEYS.CURRENT_TIER_PROGRESS,
          JSON.stringify(AppState.currentTierProgress)
        );
        showCelebration(
          "tier",
          getTierHypeMessageRecommendations(newTier),
          newTier.min
        );
      } catch (err) {
        console.log("Error displaying confetti", err);
      }
    }

    if (AppState.debug.active) {
      console.log("RECOMMENDATIONS ✅ Update complete", {
        allTime: allTimeMap,
        weekly: weeklyMap[weekId],
        updatedAllTime,
        updatedWeekly: weekData.count,
        weekId,
      });
    }
  } catch (err) {
    if (AppState.debug.active) {
      console.error("RECOMMENDATIONS ❌ Error during update", err);
    }
  } finally {
    AppState.recommendationsLeaderboard.currentlyUpdating = false;
  }
}

function weeksSince(pastWeekId, currentWeekId) {
  const [pastY, pastW] = pastWeekId.split("-W").map(Number);
  const [currY, currW] = currentWeekId.split("-W").map(Number);
  return (currY - pastY) * 52 + (currW - pastW);
}

export function getAllTimeLeaderBoardList(top = 5) {
  const raw = localStorage.getItem(STORAGE_KEYS.DOWNLOADS_LEADERBOARD_ALL_TIME);
  if (!raw) return [];

  try {
    const leaderboardMap = JSON.parse(raw);

    return Object.entries(leaderboardMap)
      .map(([authorId, data]) => ({
        authorId,
        username: data.username || authorId,
        count: Number(data.count) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
  } catch (err) {
    console.error("LEADERBOARD ❌ Failed to parse all-time leaderboard", err);
    return [];
  }
}

export function getWeeklyLeaderBoardList(weekId = getCurrentWeekId(), top = 5) {
  const raw = localStorage.getItem(STORAGE_KEYS.DOWNLOADS_LEADERBOARD_WEEKLY);
  if (!raw) return [];

  try {
    const weeklyMap = JSON.parse(raw);
    const weekData = weeklyMap[weekId] || {};

    return Object.entries(weekData)
      .map(([authorId, data]) => ({
        authorId,
        username: data.username || authorId,
        count: Number(data.count) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
  } catch (err) {
    console.error("LEADERBOARD ❌ Failed to parse weekly leaderboard", err);
    return [];
  }
}

// Accurate ISO week-based ID (e.g., "2025-W32")
export function getCurrentWeekId() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now - start + 86400000) / 86400000); // +1 day to fix UTC offset
  const jan1Day = start.getUTCDay() || 7;
  const week = Math.ceil((dayOfYear + jan1Day - 1) / 7);
  return `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getAllTimeRecommendationsLeaderBoardList(top = 5) {
  const raw = localStorage.getItem(
    STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_ALL_TIME
  );
  if (!raw) return [];

  try {
    const leaderboardMap = JSON.parse(raw);
    return Object.entries(leaderboardMap)
      .map(([authorId, data]) => ({
        authorId,
        username: data.username || authorId,
        count: Number(data.count) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
  } catch (err) {
    console.error("RECOMMENDATION LEADERBOARD ❌ parse failed", err);
    return [];
  }
}

export function getWeeklyRecommendationsLeaderBoardList(
  weekId = getCurrentWeekId(),
  top = 5
) {
  const raw = localStorage.getItem(
    STORAGE_KEYS.RECOMMENDATIONS_LEADERBOARD_WEEKLY
  );
  if (!raw) return [];

  try {
    const weeklyMap = JSON.parse(raw);
    const weekData = weeklyMap[weekId] || {};

    return Object.entries(weekData)
      .map(([authorId, data]) => ({
        authorId,
        username: data.username || authorId,
        count: Number(data.count) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
  } catch (err) {
    console.error("RECOMMENDATION WEEKLY ❌ parse failed", err);
    return [];
  }
}

export function getUserDownloadsCurrentTier(totalCount) {
  return (
    [...DOWNLOAD_TIER_THRESHOLDS]
      .reverse()
      .find((t) => totalCount >= t.min) || {
      name: "Novice 🫠",
      emoji: "🌱",
      min: 0,
    }
  );
}

export function getUserRecommendationsCurrentTier(totalCount) {
  return (
    [...RECOMMENDATION_TIER_THRESHOLDS]
      .reverse()
      .find((t) => totalCount >= t.min) || {
      name: "Apprentice 🫠",
      emoji: "🐤",
      min: 0,
    }
  );
}

// ---- confetti singleton (no workers) ----
let _etvdConfetti = null;
let _etvdCanvas = null;

function getConfetti() {
  // ensure canvas
  _etvdCanvas =
    _etvdCanvas && _etvdCanvas.isConnected
      ? _etvdCanvas
      : document.getElementById("etvd-confetti") ||
        Object.assign(document.createElement("canvas"), {
          id: "etvd-confetti",
        });

  if (!_etvdCanvas.isConnected) {
    Object.assign(_etvdCanvas.style, {
      position: "fixed",
      inset: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 2147483647, // sit on top of everything
    });
    document.documentElement.appendChild(_etvdCanvas);
  }

  // kill any pooled worker from previous libs (defensive)
  try {
    window.confetti?.reset?.();
  } catch {}

  // create instance that NEVER uses a worker
  _etvdConfetti =
    _etvdConfetti ||
    window.confetti?.create(_etvdCanvas, { resize: true, useWorker: false });
  return _etvdConfetti;
}

export function makeOverlay(message) {
  if (!message) return null;
  const overlay = document.createElement("div");
  overlay.className = "ettpd-celebration-overlay";
  // If you don't need HTML, prefer textContent to avoid accidental markup:
  // overlay.textContent = message;
  overlay.innerHTML = message;
  document.body.appendChild(overlay);
  return overlay;
}

// ---- your API ----
export function showCelebration(type = "tier", message, count = 10) {
  if (AppState.downloadPreferences.disableConfetti) return;
  const conf = getConfetti();
  if (!conf) return; // library not loaded

  // Respect reduced motion (optional)
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    const o = makeOverlay(message || "🎉");
    setTimeout(() => o?.remove(), 2500);
    return;
  }

  if (type === "tier") {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 99999,
    };

    const overlay = makeOverlay(message || "🎉 You’ve unlocked a new tier!");
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        overlay?.remove();
        return;
      }
      const particleBase = Math.min(1000, 10 * count);
      const particleCount = Math.max(
        1,
        Math.round(particleBase * (timeLeft / duration))
      );

      conf({
        ...defaults,
        particleCount,
        origin: { x: Math.random() * 0.2, y: Math.random() * 0.4 },
      });
      conf({
        ...defaults,
        particleCount,
        origin: { x: 0.8 + Math.random() * 0.2, y: Math.random() * 0.4 },
      });
    }, 250);
  } else if (type === "downloads") {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
      zIndex: 99999,
    };

    const overlay = makeOverlay(message);
    const shoot = () => {
      conf({
        ...defaults,
        particleCount: Math.min(5 * count, 1000),
        scalar: 1.2,
        shapes: ["star"],
      });
      conf({
        ...defaults,
        particleCount: Math.min(2 * count, 4000),
        scalar: 0.75,
        shapes: ["circle"],
      });
    };

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
    if (overlay) setTimeout(() => overlay.remove(), 10000);
  } else if (type === "mindblown") {
    const duration = 4000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      spread: 720,
      startVelocity: 60,
      ticks: 80,
      gravity: 0.5,
      decay: 0.91,
      scalar: 1.4,
      zIndex: 99999,
      shapes: ["square", "circle", "star"],
      colors: [
        "#00FFF7",
        "#FF61F6",
        "#FFE600",
        "#FF5E3A",
        "#7CFF4C",
        "#00C6FF",
        "#FF94C2",
        "#D5FF00",
      ],
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      conf({
        ...defaults,
        particleCount: 150,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
      });
    }, 150);
  }
}

window.rerender = displayFoundUrls;
export function getRandomDownloadSuccessMessage(mediaType = "file", count = 1) {
  const messages = [...DOWNLOAD_SUCCESS_MESSAGES];
  const template = messages[Math.floor(Math.random() * messages.length)];

  const isPlural = count > 1;
  const media = isPlural
    ? mediaType.toLowerCase() + "s"
    : mediaType.toLowerCase();
  const countDisplay = isPlural ? `${count}` : "1";

  return typeof template === "string"
    ? template.replace("{media}", media).replace("{count}", countDisplay)
    : template(); // for static ones
}

export function showRandomScraperDone() {
  const msg =
    SCRAPER_DONE_MESSAGES[
      Math.floor(Math.random() * SCRAPER_DONE_MESSAGES.length)
    ];
  return msg;
}

function shouldShowRateDonatePopup() {
  if (AppState.ui.isRatePopupOpen) return false;
  // If nothing was downloaded this week. The downloader must be broken, no, don't even try suggesting they rate us.
  if (!AppState.leaderboard.newlyConfirmedMedia.length) return false;
  const now = Date.now();
  const { lastRatedAt, lastDonatedAt, lastShownAt, shownCount } =
    AppState.rateDonate;

  // 1. Never shown before → show immediately
  if (!lastShownAt) return true;

  // 2. Skip if rated in the last 14 days
  const ratedCooldownMs = 14 * 24 * 60 * 60 * 1000;
  if (lastRatedAt && now - lastRatedAt < ratedCooldownMs) {
    return false;
  }

  // 3. Skip if donated in the last 30 days
  const donatedCooldownMs = 30 * 24 * 60 * 60 * 1000;
  if (lastDonatedAt && now - lastDonatedAt < donatedCooldownMs) {
    return false;
  }

  // 4. Determine base cooldown by how many times it's been shown
  const cooldownDays = (() => {
    if (shownCount <= 1) return 1;
    if (shownCount === 2) return 3;
    if (shownCount <= 4) return 7;
    return 14;
  })();

  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  // 5. Check if enough time has passed since last shown
  return now - lastShownAt >= cooldownMs;
}

export async function getTabSpans(timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  const path = window.location.pathname;

  const isProfile = /^\/@[^/]+\/?$/.test(path);

  let isCurrentUserPageOwner = false;
  let collection = "";

  try {
    const currentUserName = getCurrentPageUsername();
    const user = JSON.parse(window.__UNIVERSAL_DATA_FOR_REHYDRATION__.innerHTML)
      .__DEFAULT_SCOPE__["webapp.app-context"].user;

    const loggedInUsername = user ? user.uniqueId : null;
    isCurrentUserPageOwner = currentUserName === loggedInUsername;

    const m = path.match(/\/@[^/]+\/collection\/([^/]+)/);
    if (m) {
      const raw = decodeURIComponent(m[1]);
      collection = raw.replace(/-\d+$/, "");
    }
  } catch (e) {
    console.warn(e);
  }

  // 🚪 Not a profile? Return immediately
  if (!isProfile) {
    return {
      videos: null,
      reposts: null,
      liked: null,
      favorites: null,
      collection,
    };
  }

  const sig = {
    videos: "M11 8",
    reposts: "6.26 6.66",
    liked: "14.23-14.12",
    favorites: "l9.67-5",
    likedPrivateA: "M8.71 10.56",
    likedPrivateB: "L24 36.89",
  };

  const hasAny = (r) =>
    r.videos || r.reposts || r.liked || r.favorites || r.collection;

  const immediateScan = () => {
    const result = {
      videos: null,
      reposts: null,
      liked: null,
      favorites: null,
      collection,
    };

    if (result.collection) {
      return result;
    }

    // svg-path scan
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => {
      const style = window.getComputedStyle(tab);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        tab.getAttribute("aria-disabled") === "true"
      )
        return;

      const span = tab.querySelector("span");
      if (!span) return;

      const d = tab.querySelector("svg path")?.getAttribute("d") || "";
      if (!result.videos && d.includes(sig.videos)) result.videos = span;
      else if (!result.reposts && d.includes(sig.reposts))
        result.reposts = span;
      else if (!result.favorites && d.includes(sig.favorites))
        result.favorites = span;

      // Public liked tab (visible to anyone if account exposes it)
      if (!result.liked && d.includes(sig.liked)) {
        result.liked = span;
      }
      // Private liked tab (only valid if you're the owner)
      if (d.includes(sig.likedPrivateA) || d.includes(sig.likedPrivateB)) {
        result.liked = isCurrentUserPageOwner ? span : null;
      }
    });

    return result;
  };

  // 1) Try immediate
  let first = immediateScan();
  if (hasAny(first)) return first;

  // 2) Two frames wait
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))
  );
  first = immediateScan();
  if (hasAny(first)) return first;

  // 3) Observer quick try
  const foundViaObserver = await new Promise((resolve) => {
    let done = false;
    const obs = new MutationObserver(() => {
      const res = immediateScan();
      if (hasAny(res)) {
        done = true;
        obs.disconnect();
        resolve(res);
      }
    });
    if (document.body)
      obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      if (!done) {
        obs.disconnect();
        resolve(null);
      }
    }, Math.min(800, timeoutMs));
  });
  if (foundViaObserver) return foundViaObserver;

  // 4) Timed polling
  return new Promise((resolve) => {
    const tick = () => {
      const res = immediateScan();
      if (hasAny(res)) {
        resolve(res);
      } else if (Date.now() - start >= timeoutMs) {
        resolve(res);
      } else {
        setTimeout(tick, intervalMs);
      }
    };
    setTimeout(tick, intervalMs);
  });
}

export function getRenderedPostsMetadata() {
  const getUsernameNear = (el) => {
    const a = el.closest('a[href*="/@"]') || el.querySelector('a[href*="/@"]');
    return a?.getAttribute("href")?.match(/\/@([\w._-]+)/)?.[1] || null;
  };

  const getFiber = (el) => {
    for (const k in el) if (k.startsWith("__reactFiber$")) return el[k];
    return null;
  };

  const containers = Array.from(
    document.querySelectorAll('[class*="DivPlayerContainer"]')
  );

  const pickBestItemFromChildren = (children) => {
    if (!Array.isArray(children)) return null;

    // 1) Strong heuristics: explicitly check the known “good” slots
    const candidates = [];
    [6, 5].forEach((idx) => {
      const c = children[idx];
      if (c?.props?.item) candidates.push(c.props.item);
    });

    // 2) Generic scan: any child.props.item or child.item that looks like media
    for (const c of children) {
      if (c?.props?.item) candidates.push(c.props.item);
      else if (c?.item) candidates.push(c.item);
      else if (c?.props && typeof c.props === "object")
        candidates.push(c.props);
    }

    // Score candidates: prefer objects with AIGCDescription/music/stats etc
    const score = (obj) => {
      if (!obj || typeof obj !== "object") return -1;
      let s = 0;
      if (typeof obj.id === "string" && obj.id.length) s += 10;
      if ("AIGCDescription" in obj) s += 5;
      if ("music" in obj) s += 3;
      if ("stats" in obj || "statsV2" in obj) s += 3;
      if ("video" in obj) s += 2;
      if ("desc" in obj) s += 1;
      return s;
    };

    let best = null,
      bestScore = -1;
    for (const cand of candidates) {
      const sc = score(cand);
      if (sc > bestScore) {
        best = cand;
        bestScore = sc;
      }
    }
    return best;
  };

  const posts = containers
    .map((el) => {
      const fiber = getFiber(el);
      if (!fiber) return null;

      // Try pendingProps first, then memoizedProps
      const propsSources = [fiber?.pendingProps, fiber?.memoizedProps].filter(
        Boolean
      );

      // Try to extract the rich media object
      let media = null;
      for (const p of propsSources) {
        media = pickBestItemFromChildren(p?.children);
        if (media?.id) break;
      }

      // Last‑ditch fallback: walk shallowly for any object with a string id
      if (!media || !media.id) {
        const tryObj = (o) => (o && typeof o.id === "string" ? o : null);
        for (const p of propsSources) {
          if (tryObj(p)) {
            media = p;
            break;
          }
          if (tryObj(p?.props)) {
            media = p.props;
            break;
          }
          if (tryObj(p?.props?.item)) {
            media = p.props.item;
            break;
          }
        }
      }

      if (!media || typeof media.id !== "string") return null;

      // Username fallback
      if (!media.authorId) {
        const u = getUsernameNear(el);
        if (u) media.authorId = u;
      }
      return media;
    })
    .filter(Boolean);

  return posts;
}

export function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function showAlertModal(message, actionText = "OK", onAction = null) {
  return new Promise((resolve, _) => {
    const alertDiv = Object.assign(document.createElement("div"), {
      className: "alert",
      innerHTML: message,
    });

    const actionBtn = Object.assign(document.createElement("button"), {
      className: "ettpd-action-btn",
      textContent: actionText,
    });

    actionBtn.addEventListener("click", () => {
      if (typeof onAction === "function") {
        try {
          onAction();
          return resolve(false);
        } catch (e) {
          console.warn("Action callback failed:", e);
        }
      }
      resolve(true);
    });

    createModal({
      children: [
        alertDiv,
        onAction ? actionBtn : document.createElement("span"),
      ],
      onClose: () => resolve(false), // resolve false if closed without clicking button
    });
  });
}

/**
 * Find a React fiber object attached to a DOM element.
 */
function getReactFiber(el) {
  if (!el) return null;
  for (const k in el) {
    if (k.startsWith("__reactFiber$")) return el[k];
  }
  return null;
}

/**
 * Normalize a children value into an array.
 */
function toArray(children) {
  if (!children) return [];
  return Array.isArray(children) ? children : [children];
}

/**
 * Score object "media-ish-ness" like your pickBestItemFromChildren
 */
function scoreMediaObj(obj) {
  if (!obj || typeof obj !== "object") return -1;
  let s = 0;
  if (typeof obj.id === "string" && obj.id.length) s += 10;
  if ("AIGCDescription" in obj) s += 5;
  if ("music" in obj) s += 3;
  if ("stats" in obj || "statsV2" in obj) s += 3;
  if ("video" in obj) s += 2;
  if ("desc" in obj) s += 1;
  return s;
}

/**
 * Given a "children" array-ish, produce an ordered list of candidates to explore.
 * 1) Prefer slots 6 and 5 if they look promising (your known good paths)
 * 2) Then everything else, sorted by media score
 */
function rankChildren(children) {
  const arr = toArray(children);

  const picks = [];
  [6, 5].forEach((idx) => {
    const c = arr[idx];
    if (c) picks.push({ c, idx, bonus: 100 }); // huge bonus to force priority
  });

  // Add the rest with their score
  arr.forEach((c, idx) => {
    // Skip duplicates if we already queued 6 or 5
    if (idx === 6 || idx === 5) return;
    // Try to score the most "item-ish" view of c
    const maybe = (c && (c.props?.item || c.item || (c.props && c.props))) || c;
    picks.push({ c, idx, bonus: scoreMediaObj(maybe) });
  });

  picks.sort((a, b) => b.bonus - a.bonus);
  return picks.map((p) => ({ node: p.c, idx: p.idx }));
}

/**
 * Extract a list of "child containers" we should traverse from a node-like object.
 * We look at common React places: pendingProps, memoizedProps, props, children, etc.
 */
function enumerateTraversalTargets(node) {
  const targets = [];

  // Most useful containers first
  if (node?.pendingProps)
    targets.push({ obj: node.pendingProps, path: ".pendingProps" });
  if (node?.memoizedProps)
    targets.push({ obj: node.memoizedProps, path: ".memoizedProps" });
  if (node?.props) targets.push({ obj: node.props, path: ".props" });
  if (node?.children) targets.push({ obj: node.children, path: ".children" });

  // Also consider node directly (some fibers stash data at top-level)
  targets.push({ obj: node, path: "" });

  return targets;
}

/**
 * Try to read an item and its id from a container-like object
 */
function extractItemCandidate(obj) {
  if (!obj || typeof obj !== "object") return null;
  return obj.props?.item || obj.item || null;
}

/**
 * Get children array and how to display path fragments
 */
function getChildrenAndPath(obj) {
  if (!obj || typeof obj !== "object") return { children: [], basePath: "" };

  let children =
    obj.props?.children ?? obj.children ?? obj.pendingProps?.children ?? null;

  // Also treat the object itself as a child container if it looks "component-like"
  if (!children && obj.props) children = obj.props.children ?? null;

  return { children: toArray(children), basePath: "" };
}

/**
 * Depth-first limited traversal for a matching props.item (by id)
 * Returns { item, path } or null
 */
function searchFiberForItem(fiber, itemId, maxVisits = 20) {
  if (!fiber) return null;

  // Stack of { node, path }
  const stack = [];
  let visits = 0;

  // Seed with fiber containers likely to hold children/props
  enumerateTraversalTargets(fiber).forEach(({ obj, path }) => {
    if (obj) stack.push({ node: obj, path });
  });

  while (stack.length && visits < maxVisits) {
    const { node, path } = stack.pop();
    visits++;

    // Direct item on this node?
    const directItem = extractItemCandidate(node);
    if (directItem?.id === itemId) {
      return { item: directItem, path: `${path}.props.item` };
    }

    // If node.props.item exists but id doesn't match, still consider it as a candidate
    // but keep traversing children to find the exact id
    // Rank children using the "good slots" + media score
    const { children } = getChildrenAndPath(node);
    const ranked = rankChildren(children);

    for (const { node: child, idx } of ranked) {
      if (!child || typeof child !== "object") continue;

      // Fast path: if this child directly has a useful item, check it first
      const quick = extractItemCandidate(child);
      if (quick?.id === itemId) {
        return { item: quick, path: `${path}.children[${idx}].props.item` };
      }

      // Otherwise, push deeper traversal targets for this child
      enumerateTraversalTargets(child).forEach(({ obj, path: p2 }) => {
        if (obj)
          stack.push({ node: obj, path: `${path}.children[${idx}]${p2}` });
      });
    }
  }

  return null;
}

/**
 * Main entry:
 * 1) Search downward from the element's fiber
 * 2) If not found, walk upward (fiber.return or DOM parent) and retry, still bounded by maxVisits
 */
export function findFiberItemById(startEl, itemId, maxVisits = 20) {
  let el = startEl;
  let fiber = getReactFiber(el);

  // Try descending from the starting element
  let found = searchFiberForItem(fiber, itemId, maxVisits);
  if (found) return found;

  // Fallback upward: climb fiber.return chain first (cheap), then DOM parents
  let guard = 0;
  while (guard++ < 5) {
    // 1) climb fiber.return if available
    if (fiber?.return) {
      fiber = fiber.return;
      found = searchFiberForItem(fiber, itemId, maxVisits);
      if (found) return found;
      continue;
    }

    // 2) climb the DOM and switch to that element's fiber
    el = el?.parentElement || null;
    if (!el) break;
    fiber = getReactFiber(el);
    if (!fiber) continue;

    found = searchFiberForItem(fiber, itemId, maxVisits);
    if (found) return found;
  }

  return null;
}

// Extract a TikTok video id from many common DOM shapes
function extractIdFromEl(el) {
  if (!el) return null;

  // 1) xgwrapper-* pattern
  const idAttr = el.getAttribute?.("id") || "";
  let m = idAttr.match(/xgwrapper-\d+-(\d+)/);
  if (m) return m[1];

  // 2) anchor href like /video/7531841678139755832
  const a = el.tagName === "A" ? el : el.querySelector?.("a[href*='/video/']");
  const href = a?.getAttribute?.("href") || "";
  m = href.match(/\/video\/(\d{10,})/);
  if (m) return m[1];

  // 3) data attributes occasionally stash ids
  const ds = el.dataset || {};
  for (const v of Object.values(ds)) {
    if (typeof v === "string") {
      m = v.match?.(/(\d{10,})/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * Given an <article>, find the closest video id nearby.
 * Strategy:
 *  - Check the article subtree
 *  - Check siblings (± up to N)
 *  - Check ancestor containers and their nearby children
 * Hard cap on DOM probes to avoid burning CPU
 */
function getNearById(article, maxSiblingRadius = 4, maxVisits = 50) {
  if (!article) return null;
  let visits = 0;

  const tryEl = (el) => {
    if (!el || visits++ >= maxVisits) return null;
    return extractIdFromEl(el);
  };

  // 1) Inside the article
  const insideId =
    tryEl(article) ||
    tryEl(article.querySelector?.('[id^="xgwrapper-"]')) ||
    (() => {
      // Quick scan for any hint inside the article
      const hits = article.querySelectorAll?.(
        '[id^="xgwrapper-"], a[href*="/video/"], [data-e2e*="video"], [data-video-id]'
      );
      for (const h of hits) {
        const id = tryEl(h);
        if (id) return id;
      }
      return null;
    })();
  if (insideId) return insideId;

  // 2) Check siblings around the article
  const parent = article.parentElement;
  if (parent) {
    const kids = Array.from(parent.children);
    const idx = kids.indexOf(article);
    for (let r = 1; r <= maxSiblingRadius; r++) {
      const left = kids[idx - r];
      const right = kids[idx + r];
      const idL =
        tryEl(left) ||
        (left?.querySelector &&
          tryEl(left.querySelector('[id^="xgwrapper-"]'))) ||
        null;
      if (idL) return idL;

      const idR =
        tryEl(right) ||
        (right?.querySelector &&
          tryEl(right.querySelector('[id^="xgwrapper-"]'))) ||
        null;
      if (idR) return idR;
    }
  }

  // 3) Walk up a few ancestors; in each, scan for nearby xgwrapper containers
  let anc = article.parentElement;
  let hops = 0;
  while (anc && hops++ < 4 && visits < maxVisits) {
    const idHere =
      tryEl(anc) ||
      (() => {
        const wrappers = anc.querySelectorAll?.('[id^="xgwrapper-"]');
        for (const w of wrappers) {
          const id = tryEl(w);
          if (id) return id;
        }
        return null;
      })();
    if (idHere) return idHere;
    anc = anc.parentElement;
  }

  // 4) Last-ditch: scan a small neighborhood around the article in the document
  const nearby = document.querySelectorAll?.('[id^="xgwrapper-"]');
  let closest = null;
  let closestDist = Infinity;

  // Compute a simple vertical distance to the article
  const artRect = article.getBoundingClientRect?.();
  for (const el of nearby || []) {
    if (visits++ >= maxVisits) break;
    const id = extractIdFromEl(el);
    if (!id) continue;
    const r = el.getBoundingClientRect?.();
    if (!r || !artRect) continue;
    const dist = Math.abs(
      (r.top + r.bottom) / 2 - (artRect.top + artRect.bottom) / 2
    );
    if (dist < closestDist) {
      closestDist = dist;
      closest = id;
    }
  }
  return closest || null;
}

// Convenience: get current playing article and resolve nearest id
export function getClosestPlayingVideoId() {
  const article = getCurrentPlayingArticle();
  if (!article) return null;
  return getNearById(article);
}

export function shouldShowRatePopupLegacy() {
  const { lastRatedAt, lastShownAt } = AppState.userMeta || {};
  const { leaderboard } = AppState;

  const daysSinceRated = getDaysSince(lastRatedAt);
  const daysSinceShown = getDaysSince(lastShownAt);

  // hard cooldown on last shown: every ~3 months max
  if (daysSinceShown < 90) return false;

  // only enforce 90-day "since rated" if they have *ever* rated
  if (Number.isFinite(daysSinceRated) && daysSinceRated < 90) return false;

  // milestone vibes: big week or nice round lifetime totals
  const lifetime = leaderboard.allTimeDownloadsCount || 0;
  const weekly = leaderboard.weekDownloadsData?.count || 0;

  const lifetimeMilestones = [25, 50, 100, 200, 500, 1000, 2500, 5000];
  const hitLifetime = lifetimeMilestones.includes(lifetime);
  const hitWeekly = weekly >= 25 && weekly % 25 === 0; // gentle cadence

  if (!(hitLifetime || hitWeekly)) return false;

  // rarity: deterministic-ish ~20% per calendar week to avoid streaky RNG
  const weekId =
    leaderboard.weekDownloadsData?.weekId ||
    new Date().toISOString().slice(0, 10);
  const seed = `${weekId}:${lifetime}:${weekly}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rarity = (h % 100) / 100;

  return rarity < 0.2;
}

function getDaysSince(tsMs) {
  if (!tsMs) return Infinity;
  const now = Date.now();
  if (tsMs > now) return 0; // future-safe
  return (now - tsMs) / 86400000;
}

// 🧰 2) Tiny util: replace {{tokens}} via regex targeting
export function renderHypeTemplate(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val == null ? "" : String(val);
  });
}

// 🎲 3) Helper to pick a random template
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ✅ 4) Public APIs you asked for
export function getTierHypeMessageRecommendations({ emoji, name, min }) {
  const tpl = pick(HYPE_TEMPLATES.recommendations);
  return renderHypeTemplate(tpl, {
    emoji,
    name,
    min: Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(min),
  });
}

export function getTierHypeMessageDownloads({ emoji, name, min }) {
  const tpl = pick(HYPE_TEMPLATES.downloads);
  return renderHypeTemplate(tpl, {
    emoji,
    name,
    min: Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(min),
  });
}

// share.js
// Simple Share button + modal (no inline styles; icons via CSS classes)

// ---- public API -------------------------------------------------------------

export function showShareOptions(options = {}) {
  const data = {
    url: "https://chromewebstore.google.com/detail/fclobfmgolhdcfcmpbjahiiifilhamcg?utm_source=tiktok-ext",
    title: "Dude, you have to check out this TikTok downloader...",
    text: "Simply beautiful!",
  };

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "ettpd-share-content";

  const heading = document.createElement("div");
  heading.className = "ettpd-share-heading";
  heading.textContent = "Share Extension 😃";
  contentWrapper.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "ettpd-share-list";
  contentWrapper.appendChild(list);

  getShareTargets(data, options.platforms).forEach((t) => {
    const li = document.createElement("li");

    const a = document.createElement("a");
    a.className = "ettpd-share-item";
    a.href = t.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", t.label);

    const icon = document.createElement("span");
    // IMPORTANT: icon image comes from CSS (no JS blob here)
    icon.className = `ettpd-share-icon icon-${t.key}`;

    const text = document.createElement("span");
    text.className = "ettpd-share-text";
    text.textContent = t.label;

    a.appendChild(icon);
    a.appendChild(text);
    li.appendChild(a);
    list.appendChild(li);
  });

  // Actions
  const actionBtnContainer = document.createElement("div");
  actionBtnContainer.className = "ettpd-share-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ettpd-share-action ettpd-tab-btn";
  copyBtn.textContent = "Copy link";
  copyBtn.addEventListener("click", async () => {
    await copyToClipboard(data.url);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy link"), 1200);
  });
  actionBtnContainer.appendChild(copyBtn);

  if (navigator.share) {
    const systemBtn = document.createElement("button");
    systemBtn.type = "button";
    systemBtn.className = "ettpd-share-action ettpd-tab-btn";
    systemBtn.textContent = "System share…";
    systemBtn.addEventListener("click", async () => {
      try {
        await navigator.share({
          url: data.url,
          title: data.title,
          text: data.text,
        });
      } catch {
        /* canceled */
      }
    });
    actionBtnContainer.appendChild(systemBtn);
  }

  createModal({
    children: [contentWrapper, actionBtnContainer],
    onClose: () => {},
  });
}

// You can control order with `platforms` option (array of keys). Defaults below.
function getShareTargets({ url, title, text, mediaUrl }, platforms) {
  const e = encodeURIComponent;
  const msg = text || title || "";
  const mailBody = `${msg ? e(msg) + "%0A%0A" : ""}${e(url)}`;

  const map = {
    telegram: {
      key: "telegram",
      label: "Share on Telegram",
      href: `https://t.me/share/url?url=${e(url)}&text=${e(msg || title)}`,
    },

    linkedin: {
      key: "linkedin",
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
    },
    reddit: {
      key: "reddit",
      label: "Share on Reddit",
      href: `https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}`,
    },
    pinterest: {
      key: "pinterest",
      label: "Share on Pinterest",
      href: `https://www.pinterest.com/pin/create/button/?url=${e(url)}${
        mediaUrl ? `&media=${e(mediaUrl)}` : ""
      }&description=${e(msg || title)}`,
    },
    line: {
      key: "line",
      label: "Share on Line",
      href: `https://social-plugins.line.me/lineit/share?url=${e(url)}`,
    },
    email: {
      key: "email",
      label: "Share on Email",
      href: `mailto:?subject=${e(title)}&body=${mailBody}`,
    },
    whatsapp: {
      key: "whatsapp",
      label: "Share on WhatsApp",
      href: `https://api.whatsapp.com/send?text=${e(
        msg ? msg + " " + url : url
      )}`,
    },
    facebook: {
      key: "facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
    },
    x: {
      key: "x",
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(
        msg || title
      )}`,
    },
    messenger: {
      key: "messenger",
      label: "Share on Messenger",
      href: `https://www.facebook.com/dialog/send?link=${e(
        url
      )}&redirect_uri=${e(url)}`,
    },
  };

  const defaultOrder = [
    "telegram",
    "linkedin",
    "reddit",
    "pinterest",
    "line",
    "email",
  ];
  const order =
    Array.isArray(platforms) && platforms.length ? platforms : defaultOrder;

  return order.filter((k) => map[k]).map((k) => map[k]);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
