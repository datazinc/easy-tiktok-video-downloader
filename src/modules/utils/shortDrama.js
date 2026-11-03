export function getShortDramaId(pathname = window.location.pathname) {
  return pathname.match(/^\/shortdrama\/episode\/(\d+)\/\d+(?:\/|$)/)?.[1] || null;
}

const rememberedEpisodeRequests = new Map();

export function rememberShortDramaRequest(requestUrl, origin = window.location.origin) {
  try {
    const url = new URL(requestUrl, origin);
    const seriesId = url.searchParams.get("dramaID") || url.searchParams.get("drama_id");
    if (url.origin !== origin || url.pathname !== "/api/drama/episode/item_list/" || !/^\d+$/.test(seriesId || "")) return null;
    rememberedEpisodeRequests.delete(seriesId);
    rememberedEpisodeRequests.set(seriesId, url.href);
    if (rememberedEpisodeRequests.size > 20) rememberedEpisodeRequests.delete(rememberedEpisodeRequests.keys().next().value);
    return url.href;
  } catch { return null; }
}

export function findShortDramaRequest(seriesId, resources = performance.getEntriesByType("resource"), origin = window.location.origin) {
  const remembered = rememberedEpisodeRequests.get(seriesId);
  if (remembered) {
    const url = new URL(remembered);
    if (url.origin === origin) return remembered;
  }
  for (const entry of resources.slice().reverse()) {
    try {
      const url = new URL(entry.name);
      const requestSeries = url.searchParams.get("dramaID") || url.searchParams.get("drama_id");
      if (url.origin === origin && url.pathname === "/api/drama/episode/item_list/" && requestSeries === seriesId) return url.href;
    } catch {}
  }
  return null;
}

export function resolveShortDramaRequest(seriesId, resources = performance.getEntriesByType("resource"), origin = window.location.origin) {
  if (!/^\d+$/.test(seriesId || "")) throw new Error("This page does not identify a valid series.");
  const observed = findShortDramaRequest(seriesId, resources, origin);
  if (observed) return observed;
  const url = new URL("/api/drama/episode/item_list/", origin);
  url.search = new URLSearchParams({
    aid: "1988", app_name: "tiktok_web", device_platform: "web_pc",
    dramaID: seriesId, count: "24", cursor: "0",
  }).toString();
  return url.href;
}

export function getEpisodeNumber(item) {
  const number = Number(item?.dramaInfo?.DramaVideoData?.EpisodeNumber);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function isSeriesEpisode(item, seriesId) {
  const info = item?.dramaInfo;
  return /^\d+$/.test(String(item?.id || "")) && String(info?.dramaID || "") === seriesId &&
    !!getEpisodeNumber(item) && info.DramaVideoData.IsPreview !== true &&
    info.DramaVideoData.IsHighlight !== true && item.isProhibited !== true;
}

export async function collectShortDramaEpisodes({ seriesId, requestUrl, origin = window.location.origin, signal, onProgress, fetchPage = fetch }) {
  const template = new URL(requestUrl);
  const requestSeries = template.searchParams.get("dramaID") || template.searchParams.get("drama_id");
  if (template.origin !== origin || template.pathname !== "/api/drama/episode/item_list/" || requestSeries !== seriesId) {
    throw new Error("Open the series episode list first, then try again.");
  }
  const episodes = new Map();
  const seenCursors = new Set();
  let cursor = "0";
  let total = 0;
  let title = "Episodes";
  for (let page = 0; page < 100; page += 1) {
    signal?.throwIfAborted();
    if (seenCursors.has(cursor)) throw new Error("TikTok repeated the episode cursor. No downloads were started.");
    seenCursors.add(cursor);
    const url = new URL(template);
    url.searchParams.set("cursor", cursor);
    const response = await fetchPage(url.href, {
      credentials: "include",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Episode list request failed (HTTP ${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload?.itemList) || Number(payload.statusCode || payload.status_code || 0) !== 0) {
      throw new Error("TikTok did not provide an episode list. Complete any verification and try again.");
    }
    const before = episodes.size;
    for (const item of payload.itemList) {
      if (!isSeriesEpisode(item, seriesId)) continue;
      episodes.set(String(item.id), item);
      title = item.dramaInfo.dramaName || title;
      total = Math.max(total, Number(item.dramaInfo.numVideos) || 0);
    }
    total = Math.max(total, Number(payload.totalEpisodeCount) || 0);
    onProgress?.({ loaded: episodes.size, total });
    if (!payload.hasMore) {
      return {
        seriesId, title, total,
        episodes: [...episodes.values()].sort((left, right) => getEpisodeNumber(left) - getEpisodeNumber(right)),
      };
    }
    if (episodes.size === before || payload.cursor == null) {
      throw new Error("TikTok returned an incomplete episode page. No downloads were started.");
    }
    cursor = String(payload.cursor);
  }
  throw new Error("The episode list exceeded the safety limit. No downloads were started.");
}