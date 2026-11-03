export const RECOVERY_KEY = "tik.tok::downloadRecovery";
export const RECOVERY_TTL_MS = 30 * 60 * 1000;

export class DownloadRecovery {
  constructor(storage, now = () => Date.now(), onUpdate = () => {}) {
    this.storage = storage;
    this.now = now;
    this.onUpdate = onUpdate;
    this.operation = null;
    this.runningFiles = 0;
    this.currentKey = null;
    this.saves = new Map();
  }

  key(media, imageIndex = null) {
    return `${media.videoId || media.id}:${media.isImage ? imageIndex : "video"}`;
  }

  async run(mediaList, options, context, callback) {
    if (this.operation) return callback();
    const queue = mediaList.flatMap((media) => {
      const indexes = media.isImage
        ? options.single ? [options.imageIndex || 0] : (media.imagePostImages || []).map((imageUrl, index) => index)
        : [null];
      return indexes.map((imageIndex) => ({
        key: this.key(media, imageIndex),
        videoId: String(media.videoId || media.id || ""),
        authorId: /^[\w.]+$/.test(media.authorId || "") ? media.authorId : "_",
        isImage: !!media.isImage,
        imageIndex,
        index: media.index,
        experimentalHd: options.experimentalHd ?? context.preferences.experimentalHd,
        status: "pending",
      }));
    });
    this.operation = {
      version: 1,
      id: `${this.now()}-${Math.random()}`,
      createdAt: this.now(),
      expiresAt: this.now() + RECOVERY_TTL_MS,
      refreshCount: 0,
      phase: "running",
      kind: options.kind || "single",
      url: context.url,
      context,
      queue: [...new Map(queue.map(entry => [entry.key, entry])).values()],
    };
    try {
      return await callback();
    } finally {
      this.finish();
    }
  }

  async file(media, options, callback) {
    const operation = this.operation;
    const key = this.key(media, options.imageIndex || 0);
    const entry = operation?.queue.find(candidate => candidate.key === key);
    if (entry?.status === "complete" || entry?.status === "skipped") return false;
    this.runningFiles += 1;
    if (operation && (!entry || this.runningFiles > 1)) operation.unsafe = true;
    this.currentKey = key;
    try {
      const result = await callback();
      if (entry) entry.status = result === false ? "skipped" : "saved";
      return result;
    } catch (error) {
      if (entry && ["ERR_SKIP_FILE", "ERR_FALLBACK_MANUAL"].includes(error?.code)) entry.status = "skipped";
      throw error;
    } finally {
      this.runningFiles -= 1;
      if (!this.runningFiles) this.currentKey = null;
      this.persistPaused();
      if (!this.runningFiles && this.operation?.ownerFinished) this.finish();
    }
  }

  filename(filename) {
    const entry = this.operation?.queue.find(candidate => candidate.key === this.currentKey);
    if (entry) entry.filename = filename;
  }

  saveStarted(requestId) {
    if (this.operation) this.saves.set(requestId, { key: this.currentKey, downloadId: null });
    this.persistPaused();
  }

  saveResponded(requestId, response) {
    const save = this.saves.get(requestId);
    if (!save) return;
    if (response?.success && Number.isInteger(response.downloadId)) save.downloadId = response.downloadId;
    else this.operation.unsafe = true;
    this.persistPaused();
  }

  skip(media) {
    this.operation?.queue.filter(entry => entry.videoId === String(media.videoId || media.id))
      .forEach(entry => { entry.status = "skipped"; });
    this.persistPaused();
  }

  persistPaused() {
    try { this.onUpdate(this.operation, [...this.saves.values()]); }
    catch { if (this.operation) this.operation.unsafe = true; }
    if (this.operation?.refreshCount !== 1 || this.operation.phase === "refreshing") return;
    try {
      this.storage().setItem(RECOVERY_KEY, JSON.stringify({
        ...this.operation,
        phase: "paused",
        paused: true,
        saves: [...this.saves.values()],
      }));
    } catch {
      this.operation.unsafe = true;
      try { this.storage().removeItem(RECOVERY_KEY); } catch {}
    }
  }

  async confirmSaves(getStatuses) {
    const operation = this.operation;
    const saves = [...this.saves.values()];
    if (operation.unsafe || saves.some(save => !Number.isInteger(save.downloadId))) {
      throw new Error("A save has an unknown outcome. Stop this recovery and check Downloads before starting another operation.");
    }
    const ids = [...new Set(saves.map(save => save.downloadId))];
    const statuses = ids.length ? await getStatuses(ids) : [];
    const byId = new Map(statuses.map(status => [status.id, status]));
    for (const save of saves) {
      if (!["complete", "interrupted"].includes(byId.get(save.downloadId)?.state)) {
        throw new Error("A file is still saving or its status is unknown. Wait for it to finish before continuing.");
      }
    }
    return operation.queue.map(entry => {
      const fileSaves = saves.filter(save => save.key === entry.key);
      const complete = entry.status === "complete" || fileSaves.some(save => byId.get(save.downloadId)?.state === "complete");
      if (entry.status === "saved" && !fileSaves.length) throw new Error("A saved file could not be verified. Recovery was paused to avoid duplicates.");
      return { ...entry, status: complete ? "complete" : entry.status === "skipped" ? "skipped" : "pending" };
    });
  }

  canRefresh() {
    const operation = this.operation;
    return !!operation && operation.refreshCount === 0 && !operation.unsafe &&
      this.runningFiles === 1 && operation.queue.length > 0 && operation.queue.length <= 10000 &&
      operation.queue.every(entry => /^\d+$/.test(entry.videoId)) &&
      [...this.saves.values()].every(save => Number.isInteger(save.downloadId));
  }

  async prepareRefresh(getStatuses, paused, isCancelled = () => false) {
    if (!this.canRefresh()) throw new Error("Refresh is unavailable for this operation. Retry, skip this file, or stop instead.");
    const operation = this.operation;
    const queue = await this.confirmSaves(getStatuses);
    if (isCancelled() || !this.canRefresh() || operation !== this.operation) throw new Error("The download state changed. Refresh was canceled.");
    const checkpoint = {
      ...operation,
      queue,
      refreshCount: 1,
      phase: "ready",
      saves: [],
      paused: !!paused,
      expiresAt: this.now() + RECOVERY_TTL_MS,
    };
    const serialized = JSON.stringify(checkpoint);
    this.storage().setItem(RECOVERY_KEY, serialized);
    if (this.storage().getItem(RECOVERY_KEY) !== serialized) throw new Error("Could not save the resume checkpoint. Refresh was canceled.");
    operation.refreshCount = 1;
    operation.phase = "refreshing";
    this.persistPaused();
    return checkpoint;
  }

  read(url) {
    try {
      const serialized = this.storage().getItem(RECOVERY_KEY);
      if (!serialized) return null;
      const checkpoint = JSON.parse(serialized);
      if (checkpoint.version !== 1 || checkpoint.refreshCount !== 1 ||
        !Number.isFinite(checkpoint.expiresAt) || checkpoint.expiresAt <= this.now() ||
        checkpoint.expiresAt > this.now() + RECOVERY_TTL_MS ||
        !["ready", "paused"].includes(checkpoint.phase) ||
        !Array.isArray(checkpoint.queue) || !checkpoint.queue.length || checkpoint.queue.length > 10000 ||
        !checkpoint.context?.preferences || !checkpoint.context?.scrapperDetails ||
        !checkpoint.queue.every(entry => /^\d+$/.test(entry.videoId) &&
          typeof entry.authorId === "string" && /^[\w.]+$/.test(entry.authorId) &&
          typeof entry.isImage === "boolean" &&
          (!entry.isImage || Number.isInteger(entry.imageIndex) && entry.imageIndex >= 0) &&
          entry.key === this.key(entry, entry.imageIndex) &&
          ["pending", "saved", "complete", "skipped"].includes(entry.status)) ||
        !Array.isArray(checkpoint.saves) || checkpoint.saves.some(save =>
          !checkpoint.queue.some(entry => entry.key === save.key) ||
          (save.downloadId !== null && !Number.isInteger(save.downloadId)))) {
        this.storage().removeItem(RECOVERY_KEY);
        return null;
      }
      return checkpoint.url === url ? checkpoint : null;
    } catch {
      return null;
    }
  }

  adopt(checkpoint) {
    this.storage().setItem(RECOVERY_KEY, JSON.stringify({ ...checkpoint, phase: "paused", paused: true }));
    this.operation = { ...checkpoint, phase: "running" };
    this.saves.clear();
    checkpoint.saves.forEach((save, index) => this.saves.set(`restored-${index}`, save));
  }

  finish() {
    if (this.runningFiles > 0 && this.operation) {
      this.operation.ownerFinished = true;
      this.operation.unsafe = true;
      return;
    }
    if (this.operation?.phase !== "refreshing") {
      try { this.storage().removeItem(RECOVERY_KEY); } catch {}
    }
    this.operation = null;
    this.saves.clear();
    this.currentKey = null;
    this.runningFiles = 0;
  }
}