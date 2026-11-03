const rememberedCollectionRequests = new Map();

export function getCollectionContext(pathname = window.location.pathname) {
  const match = pathname.match(/^\/@([^/]+)\/collection\/([^/]+)-(\d+)\/?$/);
  if (!match) return null;
  try {
    return { id: match[3], name: decodeURIComponent(match[2]), author: decodeURIComponent(match[1]) };
  } catch { return null; }
}

function parseCollectionRequest(value, origin) {
  try {
    const url = new URL(value, origin);
    const id = url.searchParams.get("collectionId");
    if (url.origin === origin && url.pathname === "/api/collection/item_list/" && /^\d+$/.test(id || "")) return { url, id };
  } catch {}
  return null;
}

export function rememberCollectionRequest(value, origin = window.location.origin) {
  const request = parseCollectionRequest(value, origin);
  if (!request) return null;
  rememberedCollectionRequests.delete(request.id);
  rememberedCollectionRequests.set(request.id, request.url.href);
  if (rememberedCollectionRequests.size > 20) rememberedCollectionRequests.delete(rememberedCollectionRequests.keys().next().value);
  return request.url.href;
}

export function resolveCollectionRequest(collectionId, resources = performance.getEntriesByType("resource"), origin = window.location.origin) {
  if (!/^\d+$/.test(collectionId || "")) throw new Error("This page does not identify a valid collection.");
  const remembered = rememberedCollectionRequests.get(collectionId);
  if (remembered && parseCollectionRequest(remembered, origin)) return remembered;
  for (const entry of resources.slice().reverse()) {
    const request = parseCollectionRequest(entry.name, origin);
    if (request?.id === collectionId) return request.url.href;
  }
  const url = new URL("/api/collection/item_list/", origin);
  url.search = new URLSearchParams({
    aid: "1988", app_name: "tiktok_web", device_platform: "web_pc",
    collectionId, count: "30", cursor: "0",
  }).toString();
  return url.href;
}

export async function collectCollectionItems({ collectionId, requestUrl, origin = window.location.origin, signal, onProgress, fetchPage = fetch, targetVideoId = null }) {
  const request = parseCollectionRequest(requestUrl, origin);
  if (!request || request.id !== collectionId) throw new Error("The collection request does not match this page.");
  const items = new Map();
  const seenCursors = new Set();
  let cursor = "0";
  for (let page = 0; page < 100; page += 1) {
    signal?.throwIfAborted();
    if (seenCursors.has(cursor)) throw new Error("TikTok repeated the collection cursor. No downloads were started.");
    seenCursors.add(cursor);
    const url = new URL(request.url);
    url.searchParams.set("cursor", cursor);
    const response = await fetchPage(url.href, {
      credentials: "include",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Collection request failed (HTTP ${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload?.itemList) || Number(payload.statusCode || payload.status_code || 0) !== 0 ||
      payload.collectionId != null && String(payload.collectionId) !== collectionId) {
      throw new Error("TikTok did not provide this collection's posts. Check access or complete any verification, then retry.");
    }
    for (const item of payload.itemList) {
      if (/^\d+$/.test(String(item?.id || "")) && item.isProhibited !== true) items.set(String(item.id), item);
    }
    onProgress?.({ loaded: items.size });
    if (targetVideoId && items.has(String(targetVideoId))) return [items.get(String(targetVideoId))];
    if (!payload.hasMore) return [...items.values()];
    if (payload.cursor == null) throw new Error("TikTok returned an incomplete collection page. No downloads were started.");
    cursor = String(payload.cursor);
  }
  throw new Error("The collection exceeded the safety limit. No downloads were started.");
}