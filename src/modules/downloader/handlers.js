// handlers.js
import AppState from "../state/state.js";
import { displayFoundUrls } from "./downloader.js";
import { getCurrentPageUsername } from "../utils/utils.js";

export function handleFoundItems(newItems) {
  try {
    if (!Array.isArray(newItems) || !newItems.length) return;

    // Handle video-detail struct
    const defaultScope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
    const struct = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;
    if (struct?.id) {
      const aid = struct.author?.uniqueId;
      if (aid) {
        AppState.postItems[aid] = AppState.postItems[aid] || [];
        if (!AppState.postItems[aid].some((i) => i.id === struct.id)) {
          AppState.postItems[aid].push(struct);
        }
      }
    }

    const updatedItems = defaultScope?.["webapp.updated-items"] || [];
    if (updatedItems.length) {
      updatedItems.forEach((item) => {
        const aid = item.author?.uniqueId;
        if (aid && item.id) {
          AppState.postItems[aid] = AppState.postItems[aid] || [];
          if (!AppState.postItems[aid].some((i) => i.id === item.id)) {
            AppState.postItems[aid].push(item);
          }
        }
      });
    }


    let forceRerender = false;

    // ———————————————————————————————————————
    // 1) (Optional) Build low-confidence stub map for debug/reference
    // ———————————————————————————————————————
    const lowMap = {};
    for (const [authorKey, arr] of Object.entries(AppState.postItems)) {
      arr.forEach((it) => {
        if (it.hasLowConfidence) {
          const vid = String(it.id ?? it.videoId);
          if (!vid) return;
          lowMap[vid] = lowMap[vid] || [];
          lowMap[vid].push(authorKey);
        }
      });
    }

    // ———————————————————————————————————————
    // 2) Process incoming items
    // ———————————————————————————————————————
    for (const item of newItems) {
      const id = String(item.id ?? item.videoId);
      if (!id) continue;

      const isFullItem = !item.hasLowConfidence;
      const realAuthor = item.author?.uniqueId;
      if (!realAuthor) continue;

      // ———————— PHASE A ————————
      // If this is a full item, remove all stubs from all authors
      if (isFullItem) {
        for (const [author, entries] of Object.entries(AppState.postItems)) {
          const beforeLength = entries.length;
          AppState.postItems[author] = entries.filter(
            (entry) =>
              !(
                entry.hasLowConfidence &&
                String(entry.id ?? entry.videoId) === id
              )
          );
          if (AppState.postItems[author].length !== beforeLength) {
            forceRerender = true;
          }
        }
      }

      // ———————— PHASE B ————————
      // Add to correct author bucket if appropriate
      AppState.postItems[realAuthor] = AppState.postItems[realAuthor] || [];
      const bucket = AppState.postItems[realAuthor];

      const hasFull = bucket.some(
        (i) => String(i.id ?? i.videoId) === id && !i.hasLowConfidence
      );
      const hasStub = bucket.some(
        (i) => String(i.id ?? i.videoId) === id && i.hasLowConfidence
      );
      const hasAny = hasFull || hasStub;

      if (!item.hasLowConfidence) {
        if (hasFull) {
          // Already present — skip
        } else if (hasStub) {
          // Replace stub with full item
          AppState.postItems[realAuthor] = bucket.map((i) =>
            String(i.id ?? i.videoId) === id ? item : i
          );
          forceRerender = true;
        } else {
          // No existing entry — add full item
          bucket.push(item);
          forceRerender = true;
        }
      } else {
        // Low-confidence stub
        // Block if any full item exists globally
        let fullExistsGlobally = false;
        for (const entries of Object.values(AppState.postItems)) {
          if (
            entries.some(
              (entry) =>
                String(entry.id ?? entry.videoId) === id &&
                !entry.hasLowConfidence
            )
          ) {
            fullExistsGlobally = true;
            break;
          }
        }

        if (!hasAny && !fullExistsGlobally) {
          bucket.push(item);
          forceRerender = true;
        }
      }

      // ———————— PHASE C ————————
      // Add to likedVideos list (if active)
      if (AppState.filters.likedVideos) {
        const user = getCurrentPageUsername();
        AppState.likedVideos[user] = AppState.likedVideos[user] || [];
        if (
          !AppState.likedVideos[user].some(
            (i) => String(i.id ?? i.videoId) === id
          )
        ) {
          AppState.likedVideos[user].push(item);
        }
      }
    }

    // ———————————————————————————————————————
    // 3) Refresh the downloader UI
    // ———————————————————————————————————————
    displayFoundUrls({ forced: forceRerender });

    


  } catch (err) {
    console.warn("handleFoundItems error", err);
  }
}
