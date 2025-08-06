// Cleaned-up imports
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
} from "../state/constants.js";
import {
  updateDownloaderList,
  hideDownloader,
  showMorpheusRateUsPage,
  updateDownloadButtonLabelSimple,
  updateDownloadButtonLabel,
  showStatsSpan,
  createDownloaderWrapper,
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
      const match = el.getAttribute("href")?.match(/^\/@([\w.-]+)/);
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
  const template = AppState.downloadPreferences.fullPathTemplate?.template;
  function getFieldMaxLength(template, fieldName) {
    const regex = new RegExp(`\\{${fieldName}:(\\d+)`);
    const match = template.match(regex);
    return match ? Number(match[1]) : undefined;
  }

  const sanitize = (val) =>
    (val ?? "")
      .toString()
      .replace(/[^\p{L}\p{N}_\-.]+/gu, "-")
      .slice(0, 100);

  const extension = media?.isImage ? ".jpeg" : ".mp4";
  const sequenceNumber = imageIndex + 1;
  const isMultiImage = media?.imagePostImages?.length > 1;
  const descMaxLen = getFieldMaxLength(template, "desc");
  const isDescMaxLenDefined = getFieldMaxLength(template, "desc") !== undefined;
  const fieldValues = {
    videoId: sanitize(media.videoId || media.id),
    authorUsername: sanitize(media.authorId),
    authorNickname: sanitize(media.authorNickname),
    desc: sanitize(media.desc?.slice(0, isDescMaxLenDefined ? descMaxLen : 40)),
    createTime: sanitize(media.createTime),
    musicTitle: sanitize(media.musicTitle),
    musicAuthor: sanitize(media.musicAuthor),
    views: sanitize(media.views),
    duration: sanitize(media.duration),
    hashtags: (media?.hashtags || [])
      .map((tag) => sanitize(tag.name || tag))
      .join("-"),
  };

  const applyTemplate = (tpl) =>
    tpl.replace(
      /\{(\w+)(?::(\d+))?(?:\|([^}]+))?\}/g,
      (_, key, maxLenRaw, fallbackRaw) => {
        const maxLen = Number(maxLenRaw) || undefined;
        const fallback = fallbackRaw;
        const isRequiredSequence =
          key === "sequenceNumber" && fallback === "required";

        if (key === "sequenceNumber") {
          if (isRequiredSequence || (media.isImage && isMultiImage)) {
            return sequenceNumber;
          }
          return "";
        }

        if (key === "ad") return media.isAd ? "ad" : "";
        if (key === "mediaType") return media.isImage ? "image" : "video";

        let val = fieldValues[key];

        if (val == null || val === "") {
          val = fallback ?? `missing-${key}`;
        }

        val = sanitize(val);

        if (maxLen) {
          val = val.slice(0, maxLen);
        }

        return val;
      }
    );

  const fullTemplate = template?.trim();
  const cleanupPath = (path) =>
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

  const resolvedPath = fullTemplate
    ? applyTemplate(
        fullTemplate.startsWith("@/")
          ? `${DOWNLOAD_FOLDER_DEFAULT}${fullTemplate.slice(1)}`
          : fullTemplate
      )
    : `${DOWNLOAD_FOLDER_DEFAULT}@${fieldValues.authorId || "unknown"}/${
        fieldValues.authorId || "user"
      }-${fieldValues.videoId}`;

  return `${cleanupPath(resolvedPath)}${extension}`;
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

  return { list: null, items: [], strategy: null };
}

export function canScrollTheList() {
  const { list, items } = getPostListContext();
  if (!list || items.length === 0) return false;

  const lastItem = items[items.length - 1];
  const rect = lastItem.getBoundingClientRect();
  const withinViewport =
    rect.top >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight);

  return !withinViewport; // scroll if not fully visible
}

export function scrollToLastUserPost() {
  if (
    AppState.downloadPreferences.autoScrollMode != "always" ||
    !canScrollTheList()
  ) {
    if (AppState.debug.active)
      console.warn("❌ Cannot scroll the list — not available or disabled.");
    return;
  }

  const { items } = getPostListContext();
  const lastItem = items[items.length - 1];
  lastItem.scrollIntoView({ behavior: "smooth", block: "center" });
}


/**
 * Finds the spinner <svg> inside the parent of the user post list
 * and returns true if it's visible in the viewport.
 */
function isSpinnerInPostListParentVisible() {
  const postList = document.querySelector('[data-e2e="user-post-item-list"]');
  if (!postList || !postList.parentElement) return false;

  const spinner = postList.parentElement.querySelector('svg[class*="SvgContainer"]');
  return spinner ? isElementInViewport(spinner) : false;
}

export function detectScrollEnd(onEnd, wait = 1000) {
  const { items: initialItems } = getPostListContext();
  const initialCount = initialItems.length;

  setTimeout(() => {
    const { items: currentItems } = getPostListContext();
    const newCount = currentItems.length;

    const spinnerVisible = isSpinnerInPostListParentVisible();

    if (newCount === initialCount && !spinnerVisible) {
      console.log("✅ Scroll ended — no new items and no parent spinner.");
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
      media?.video?.originCover ||
      media?.video?.cover,
    authorId: media?.author?.uniqueId,
    authorNickname: media?.author?.nickname,
    desc: media?.desc,
    isImage: Boolean(media.imagePost),
    // Extras
    hashtags,
    createTime: media?.createTime
      ? new Date(Number(media.createTime) * 1000).toISOString()
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
    downloadedAt: new Date().toISOString(),
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
            downloadAllBtn.textContent = `⏳ Downloading ${i + 1}/${
              media.imagePostImages.length
            }...`;
          await downloadSingleMedia(media, { imageIndex: i });
          successfulDownloads += 1;
        } catch (err) {
          console.error(`Download failed for image ${i + 1}`, err);
          if (downloadAllBtn)
            downloadAllBtn.textContent = `⏳ Failed at ${i + 1}/${
              media.imagePostImages.length
            }...`;
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

export function downloadURLToDisk(url, filename, options = {}) {
  return new Promise((resolve, reject) => {
    const maxRetries = 3;
    let attempt = options.retryCount || 1;

    function attemptDownload(omitCookies) {
      AppState.downloading.isActive = true;
      displayFoundUrls({ forced: true });

      fetch(url, { credentials: omitCookies ? "omit" : "include" })
        .then((resp) => {
          AppState.downloading.isActive = false;
          displayFoundUrls({ forced: true });

          if (!resp.ok) throw new Error(resp.statusText);
          return resp.blob();
        })
        .then((blob) => {
          if (blob.size === 0) throw new Error("Empty file");

          const blobUrl = URL.createObjectURL(blob);

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
            } catch (e) {
              if (AppState.debug.active)
                console.warn("⚠️ Failed to revoke blob URL:", e);
            }

            if (event.data.success) {
              resolve(true);
              AppState.sessionHasConfirmedDownloads = true;
            } else {
              reject(new Error(event.data.error || "Unknown download error"));
            }
          }

          window.addEventListener("message", handleResponse);

          sendBasicBlobDownloadRequest({
            blobUrl,
            filename,
            showFolderPicker: AppState.downloadPreferences.showFolderPicker,
          });
        })
        .catch((err) => {
          AppState.downloading.isActive = false;
          displayFoundUrls({ forced: true });

          if (AppState.debug.active)
            console.warn(`❌ Download error [attempt ${attempt}]:`, err);

          if (attempt < maxRetries) {
            attempt++;
            const nextOmit = attempt === 2;
            if (AppState.debug.active)
              console.warn("⚠️ Retrying download attempt", attempt);
            attemptDownload(nextOmit);
          } else {
            if (AppState.debug.active)
              console.warn("⚠️ All attempts failed. Falling back...");

            if (AppState.downloadPreferences.skipFailedDownloads) {
              if (AppState.debug.active)
                console.warn(
                  "⚠️ All attempts failed. Skipped as failed download."
                );
              return reject(err);
            }

            alert(
              "This will attempt to save the video to your device's download folder or open it in a new tab."
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.target = "_blank";
            document.body?.appendChild(a);
            a.click();
            document.body?.removeChild(a);

            // Do NOT resolve or reject — just let the user handle it manually
          }
        });
    }

    attemptDownload(options.omitCookies || false);
  });
}

export function displayFoundUrls({ forced } = {}) {
  try {
    if (AppState.debug.active) {
      console.log("ettvdebugger: displayFoundUrls called", { forced });
    }

    // Update the button regardless.
    // TODO: If this causes some bugs, remove it
    if (forced) updateDownloadButtonLabelSimple();
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
      items = AppState.postItems[getCurrentPageUsername()] || [];
    } else if (AppState.filters.likedVideos) {
      items = AppState.likedVideos[getCurrentPageUsername()] || [];
    } else {
      items = Object.values(AppState.postItems).flat();
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
          const meta = buildVideoLinkMeta(media, idx);
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
      alert("Body missing....");
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

  const links = AppState.allDirectLinks || [];
  let newVideoDownloadedCount = 0;
  let hasImage = false;
  try {
    console.log("DEBUG_DL_ALLA before loop ", links.length);
    for (let i = 0; i < links.length; i++) {
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
        AppState.leaderboard.newlyConfirmedUrls.push(media);
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
    showCelebration(
      "downloads",
      getRandomDownloadSuccessMessage(
        !hasImage ? "video" : "post",
        newVideoDownloadedCount
      ),
      newVideoDownloadedCount
    );
  }
  AppState.downloading.isDownloadingAll = false;
  AppState.downloading.isActive = false;
  if (shouldShowRateDonatePopup()) showMorpheusRateUsPage();
  showStatsSpan();
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
    const newlyConfirmed = AppState.leaderboard.newlyConfirmedUrls || [];
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

    newlyConfirmed.forEach((media) => {
      if (media.isTrackedAsDownloaded) return;
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
    console.log("STATEUS ", AppState.currentTierProgress, AppState);
    const currentProgressLevel =
      AppState.currentTierProgress.recommendations || 0;
    const newTierLevel =
      getUserRecommendationsCurrentTier(currentProgressLevel).min;
    if (newTierLevel > currentProgressLevel) {
      // Save state
      try {
        AppState.currentTierProgress.recommendations = newTierLevel;
        localStorage.setItem(
          STORAGE_KEYS.CURRENT_TIER_PROGRESS,
          JSON.stringify(AppState.currentTierProgress)
        );
        showProgressConfetti(newTier);
      } catch (err) {
        console.log("Error displaying confetti");
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
      name: "Noob 🫠",
      emoji: "🍑",
      min: 0,
    }
  );
}

export function getUserRecommendationsCurrentTier(totalCount) {
  return (
    [...RECOMMENDATION_TIER_THRESHOLDS]
      .reverse()
      .find((t) => totalCount >= t.min) || {
      name: "Noob 🫠",
      emoji: "🍑",
      min: 0,
    }
  );
}

export function showCelebration(type = "tier", message, count = 10) {
  //tier or downloads
  if (type === "tier") {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 99999, // 🔥 HIGH z-index here
    };

    const overlay = document.createElement("div");
    overlay.className = "ettpd-celebration-overlay";
    overlay.textContent = message || "🎉 You've unlocked a new tier!";
    document.body.appendChild(overlay);

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        overlay.remove();
        return;
      }

      const particleCount = Math.min(1000, 10 * count) * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: Math.random() * 0.2, y: Math.random() * 0.4 },
      });
      confetti({
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
      zIndex: 99999, // 🔥 HIGH z-index here
    };

    function shoot() {
      confetti({
        ...defaults,
        particleCount: Math.min(5 * count, 1000),
        scalar: 1.2,
        shapes: ["star"],
      });
      confetti({
        ...defaults,
        particleCount: Math.min(2 * count, 4000),
        scalar: 0.75,
        shapes: ["circle"],
      });
    }

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);

    if (message) {
      const overlay = document.createElement("div");
      overlay.className = "ettpd-celebration-overlay";
      overlay.textContent = message;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 10000);
    }
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

      confetti({
        ...defaults,
        particleCount: 150,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
      });
    }, 150);
  }
}

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

function shouldShowRateDonatePopup() {
  // If nothing was downloaded this week. The downloader must be broken, no, don't even try suggesting they rate us.
  if (!AppState.leaderboard.newlyConfirmedUrls.length) return false;
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


export function getTabSpans() {
  const tabs = document.querySelectorAll('[role="tab"]');
  const result = {
    videos: null,
    reposts: null,
    liked: null,
    favorites: null,
  };

  tabs.forEach((tab) => {
    const span = tab.querySelector("span");
    const svgPath = tab.querySelector("svg path")?.getAttribute("d") || "";

    if (!span) return;

    // SVG-based detection (primary)
    if (
      svgPath.includes("M11 8") &&
      // svgPath.includes("V27") &&
      !result.videos
    ) {
      result.videos = span;
    } else if (
      svgPath.includes("6.26 6.66") &&
      // svgPath.includes("l3.48-3.7") &&
      !result.reposts
    ) {
      result.reposts = span;
    } else if (
      svgPath.includes("14.23-14.12") &&
      // svgPath.includes("M24 12.19") &&
      !result.liked
    ) {
      result.liked = span;
    } else if (
      svgPath.includes("l9.67-5") &&
      // svgPath.includes("M30.5 7.15") &&
      !result.favorites
    ) {
      result.favorites = span;
    }

    // Fallback: text-based matching (locale-agnostic heuristics)
    const label = span.textContent.trim().toLowerCase();

    if (!result.videos && /video/.test(label)) {
      result.videos = span;
    } else if (!result.reposts && /repost/.test(label)) {
      result.reposts = span;
    } else if (!result.liked && /like/.test(label)) {
      result.liked = span;
    } else if (!result.favorites && /favorite/.test(label)) {
      result.favorites = span;
    }
  });

  return result;
}
