const endpoints = {
  videos: "/api/post/item_list/",
  liked: "/api/favorite/item_list/",
  reposts: "/api/repost/item_list/",
  favorites: "/api/user/collect/item_list/",
  collection: "/api/collection/item_list/",
  playlist: "/api/mix/item_list/",
};
const identities = new Map();
const requests = new Map();
const progressiveRequests = new Set();
let nativeProgressivePrefix = null;

export function setNativeProgressiveList(source) {
  nativeProgressivePrefix = source
    ? `${source.kind}:${source.subject}:${listOrder(new URL(source.url))}:`
    : null;
}

function listOrder(url) {
  return ["sortType", "sort_type", "order", "order_by", "post_item_list_request_type"]
    .filter(key => url.searchParams.has(key))
    .map(key => `${key}=${encodeURIComponent(url.searchParams.get(key))}`).join("&");
}

function progressiveRequestKey(value, origin) {
  try {
    const url = new URL(value, origin);
    const kind = Object.keys(endpoints).find(kind => endpoints[kind] === url.pathname);
    const subject = url.searchParams.get(kind === "collection" ? "collectionId" : kind === "playlist" ? "mixId" : "secUid");
    return url.origin === origin && kind && subject
      ? `${kind}:${subject}:${listOrder(url)}:${url.searchParams.get("cursor") || "0"}:${url.searchParams.get("count") || "30"}` : null;
  } catch { return null; }
}

export function getAccountUsername(pathname = window.location.pathname) {
  const match = pathname.match(/^\/@([^/]+)\/?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function rememberAccountIdentity(user) {
  if (!user?.uniqueId || !user?.secUid) return;
  identities.delete(String(user.uniqueId).toLowerCase());
  identities.set(String(user.uniqueId).toLowerCase(), String(user.secUid));
  if (identities.size > 20) identities.delete(identities.keys().next().value);
}

export function rememberAccountListResponse(payload, rawUrl, origin = window.location.origin) {
  try {
    const url = new URL(rawUrl, origin);
    if (url.origin !== origin) return;
    if (url.pathname === "/api/user/detail/") rememberAccountIdentity(payload?.userInfo?.user);
    const kind = Object.keys(endpoints).find(kind => endpoints[kind] === url.pathname);
    if (!kind) return;
    const subject = url.searchParams.get(kind === "collection" ? "collectionId" : kind === "playlist" ? "mixId" : "secUid");
    if (!subject) return;
    requests.set(`${kind}:${subject}`, url.href);
    if (requests.size > 50) requests.delete(requests.keys().next().value);
  } catch {}
}

export function isProgressiveListRequest(rawUrl, origin = window.location.origin) {
  const key = progressiveRequestKey(rawUrl, origin);
  return progressiveRequests.has(key) || !!key && !!nativeProgressivePrefix && key.startsWith(nativeProgressivePrefix);
}

export function resolveAccountList({ kind, username, id, origin = window.location.origin, profile, resources = globalThis.performance?.getEntriesByType?.("resource") || [] }) {
  if (!endpoints[kind]) throw new Error("This list is not supported.");
  rememberAccountIdentity(profile);
  const subject = ["collection", "playlist"].includes(kind) ? String(id || "") : identities.get(String(username || "").toLowerCase());
  if (!subject || ["collection", "playlist"].includes(kind) && !/^\d+$/.test(subject)) {
    throw new Error("Open this account's tab once so TikTok can load its account details, then retry.");
  }
  let known = requests.get(`${kind}:${subject}`);
  if (!known) {
    const identityKey = kind === "collection" ? "collectionId" : kind === "playlist" ? "mixId" : "secUid";
    for (const entry of resources.slice().reverse()) {
      try {
        const candidate = new URL(entry.name, origin);
        if (candidate.origin !== origin || candidate.pathname !== endpoints[kind] || candidate.searchParams.get(identityKey) !== subject) continue;
        rememberAccountListResponse(null, candidate.href, origin);
        known = candidate.href;
        break;
      } catch {}
    }
  }
  const url = known ? new URL(known) : new URL(endpoints[kind], origin);
  url.searchParams.set(kind === "collection" ? "collectionId" : kind === "playlist" ? "mixId" : "secUid", subject);
  if (!known) {
    url.searchParams.set("aid", "1988");
    url.searchParams.set("app_name", "tiktok_web");
    url.searchParams.set("device_platform", "web_pc");
  }
  const order = listOrder(url);
  return { kind, username, subject, scope: `${kind}:${subject}${order ? `:${order}` : ""}`, url: url.href, origin };
}

export async function fetchAccountListPage(source, cursor, count, signal, fetchPage = fetch) {
  const url = new URL(source.url);
  const identityKey = source.kind === "collection" ? "collectionId" : source.kind === "playlist" ? "mixId" : "secUid";
  if (url.origin !== source.origin || url.pathname !== endpoints[source.kind] || url.searchParams.get(identityKey) !== source.subject) {
    throw new Error("The requested page does not match the selected account or list.");
  }
  url.searchParams.set("cursor", cursor);
  url.searchParams.set("count", String(Math.min(30, count)));
  for (const key of ["X-Bogus", "X-Gnarly", "_signature"]) url.searchParams.delete(key);
  progressiveRequests.add(progressiveRequestKey(url.href, source.origin));
  if (progressiveRequests.size > 8) progressiveRequests.delete(progressiveRequests.values().next().value);
  const response = await fetchPage(url.href, {
    credentials: "include",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`List request failed (HTTP ${response.status}). Your completed batches are saved.`);
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("TikTok returned no usable list data. Complete any sign-in or verification, then resume; earlier batches are saved."); }
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  const items = data?.itemList || data?.item_list || (Array.isArray(payload?.data) ? payload.data.map(entry => entry.item).filter(Boolean) : null);
  if (!Array.isArray(items) || Number(payload?.statusCode || payload?.status_code || 0) !== 0) {
    throw new Error("TikTok did not make this list available. It may be private or require sign-in or verification. Completed batches are saved.");
  }
  return {
    items: items.filter(item => /^\d+$/.test(String(item?.id || "")) && item.isProhibited !== true),
    cursor: data.cursor ?? data.minCursor ?? data.min_cursor,
    hasMore: !!(data.hasMore ?? data.has_more),
  };
}