export function summarizeResume(checkpoint, chunk = null) {
  const saved = new Set(checkpoint?.completed || []);
  const skipped = new Set(checkpoint?.skipped || []);
  const pending = new Set((checkpoint?.pending || []).filter(id => !saved.has(id) && !skipped.has(id)));
  const unconfirmed = new Set();
  const failed = new Set();
  for (const entry of chunk?.queue || []) {
    if (saved.has(entry.videoId) || skipped.has(entry.videoId)) continue;
    if (entry.status === "failed" || entry.lastFailure === true) failed.add(entry.videoId);
    if (["saved", "complete"].includes(entry.status) || chunk.saves?.some(save => save.key === entry.key)) unconfirmed.add(entry.videoId);
  }
  for (const id of unconfirmed) { pending.delete(id); failed.delete(id); }
  for (const id of failed) pending.delete(id);
  return {
    saved: saved.size, skipped: skipped.size, pending: pending.size,
    failed: failed.size || (pending.size || unconfirmed.size ? null : 0), unconfirmed: unconfirmed.size,
    remaining: checkpoint?.finished ? 0 : null,
    maxPosts: checkpoint?.maxPosts ?? null,
    remainingLimit: checkpoint?.maxPosts == null ? null : Math.max(0, checkpoint.maxPosts - saved.size),
  };
}