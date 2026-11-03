export const DEFAULT_BATCH_SIZE = 30;
export const PROGRESSIVE_BATCH_KEY = "tik.tok::progressiveBatch";
const CHUNK_KEY = "tik.tok::progressiveChunk";
const MAX_AGE_MS = 30 * 60 * 1000;

export class ProgressiveBatch {
  constructor(storage, now = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  read(scope) {
    try {
      const state = JSON.parse(this.storage.getItem(`${PROGRESSIVE_BATCH_KEY}:${scope}`) || "null");
      if (!state) return null;
      if (state.version !== 1 || state.expiresAt <= this.now() || state.expiresAt > this.now() + MAX_AGE_MS ||
        !Array.isArray(state.completed) || !Array.isArray(state.pending) || state.pending.length > 100 ||
        !Array.isArray(state.skipped || []) || !(state.skipped || []).every(id => /^\d+$/.test(id)) ||
        !state.completed.every(id => /^\d+$/.test(id)) || !state.pending.every(id => /^\d+$/.test(id)) ||
        !Number.isInteger(state.batchSize) || state.batchSize < 1 || state.batchSize > 100) {
        this.storage.removeItem(`${PROGRESSIVE_BATCH_KEY}:${scope}`);
        return null;
      }
      return state.scope === scope ? state : null;
    } catch { return null; }
  }

  save(state) {
    const previous = this.read(state.scope);
    state.refreshCount = Math.max(state.refreshCount || 0, previous?.refreshCount || 0);
    state.expiresAt = this.now() + MAX_AGE_MS;
    const serialized = JSON.stringify(state);
    this.storage.setItem(`${PROGRESSIVE_BATCH_KEY}:${state.scope}`, serialized);
    if (this.storage.getItem(`${PROGRESSIVE_BATCH_KEY}:${state.scope}`) !== serialized) throw new Error("Could not save batch progress. Downloads paused.");
  }

  recordChunk(operation, saves) {
    if (!operation?.context?.progressiveScope) return;
    try {
      if (operation.refreshCount === 1) {
        const checkpoint = this.read(operation.context.progressiveScope);
        if (checkpoint) { checkpoint.refreshCount = 1; this.save(checkpoint); }
      }
      this.storage.setItem(`${CHUNK_KEY}:${operation.context.progressiveScope}`, JSON.stringify({
        scope: operation.context.progressiveScope,
        queue: operation.queue,
        saves,
        unsafe: !!operation.unsafe,
        expiresAt: this.now() + MAX_AGE_MS,
      }));
    } catch (error) {
      this.storage.removeItem(`${PROGRESSIVE_BATCH_KEY}:${operation.context.progressiveScope}`);
      this.storage.removeItem(`${CHUNK_KEY}:${operation.context.progressiveScope}`);
      throw error;
    }
  }

  readChunk(scope) {
    const raw = this.storage.getItem(`${CHUNK_KEY}:${scope}`);
    if (!raw) return null;
    const chunk = JSON.parse(raw);
    if (chunk.scope !== scope || chunk.expiresAt <= this.now()) return null;
    if (!Array.isArray(chunk.queue) || !Array.isArray(chunk.saves) || chunk.queue.length > 10000 ||
      !chunk.queue.every(entry => /^\d+$/.test(entry.videoId)) ||
      chunk.saves.some(save => !chunk.queue.some(entry => entry.key === save.key))) {
      throw new Error("The interrupted batch checkpoint is invalid. Check Downloads before starting a new batch.");
    }
    return chunk;
  }

  clearChunk(scope) { this.storage.removeItem(`${CHUNK_KEY}:${scope}`); }

  async run({ scope, batchSize = DEFAULT_BATCH_SIZE, fetchPage, downloadBatch, onProgress, signal, resume = false, beforePage }) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error("Choose a batch size from 1 to 100.");
    const state = resume ? this.read(scope) : null;
    if (!resume) { this.storage.removeItem(`${PROGRESSIVE_BATCH_KEY}:${scope}`); this.clearChunk(scope); }
    const checkpoint = state || {
      version: 1, scope, batchSize, cursor: "0", completed: [], skipped: [], pending: [],
      batches: 0, finished: false, refreshCount: 0,
    };
    const completed = new Set(checkpoint.completed);
    const skipped = new Set(checkpoint.skipped || []);
    const visited = new Set();
    this.save(checkpoint);
    while (!checkpoint.finished) {
      signal?.throwIfAborted();
      await beforePage?.();
      signal?.throwIfAborted();
      const pageCursor = checkpoint.cursor;
      if (visited.has(pageCursor)) throw new Error("TikTok repeated a page cursor. Completed downloads are saved; resume after checking the list.");
      visited.add(pageCursor);
      onProgress?.({ phase: "load", batches: checkpoint.batches, saved: completed.size });
      const page = await fetchPage(pageCursor, checkpoint.batchSize, signal);
      if (!Array.isArray(page?.items)) throw new Error("TikTok did not provide this list's posts.");
      const seen = new Set();
      const items = page.items.filter(item => {
        const id = String(item?.id || item?.videoId || "");
        if (!/^\d+$/.test(id) || completed.has(id) || skipped.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      for (let offset = 0; offset < items.length; offset += checkpoint.batchSize) {
        signal?.throwIfAborted();
        const batch = items.slice(offset, offset + checkpoint.batchSize);
        checkpoint.pending = batch.map(item => String(item.id || item.videoId));
        this.save(checkpoint);
        onProgress?.({ phase: "download", batches: checkpoint.batches, saved: completed.size, size: batch.length });
        const result = await downloadBatch(batch, checkpoint);
        for (const id of result?.completed || []) {
          if (checkpoint.pending.includes(String(id))) completed.add(String(id));
        }
        for (const id of result?.skipped || []) {
          if (checkpoint.pending.includes(String(id))) skipped.add(String(id));
        }
        checkpoint.completed = [...completed];
        checkpoint.skipped = [...skipped];
        checkpoint.pending = checkpoint.pending.filter(id => !completed.has(id) && !skipped.has(id));
        this.save(checkpoint);
        if (!result || result.stopped || checkpoint.pending.length) {
          onProgress?.({ phase: "paused", batches: checkpoint.batches, saved: completed.size });
          return checkpoint;
        }
        this.clearChunk(scope);
        checkpoint.batches += 1;
        this.save(checkpoint);
      }
      signal?.throwIfAborted();
      const next = String(page.cursor ?? "");
      if (page.hasMore && (!next || next === pageCursor)) throw new Error("TikTok did not advance this list's cursor. Completed downloads are saved.");
      checkpoint.cursor = next;
      checkpoint.finished = !page.hasMore;
      checkpoint.pending = [];
      this.save(checkpoint);
      onProgress?.({ phase: checkpoint.finished ? "complete" : "load", batches: checkpoint.batches, saved: completed.size });
    }
    return checkpoint;
  }
}