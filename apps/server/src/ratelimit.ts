import { HttpError } from "./types";

/** Fixed-window counter in D1. Throws 429 when `limit` is exceeded within `windowMs`. */
export async function rateLimit(db: D1Database, key: string, limit: number, windowMs: number, now: number): Promise<void> {
  const windowStart = now - (now % windowMs);
  const row = await db
    .prepare(
      `INSERT INTO rate_limit (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start < ?2 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start < ?2 THEN ?2 ELSE window_start END
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 1) > limit) throw new HttpError(429, "rate_limited", { retryAfterMs: windowStart + windowMs - now });
}

/** Drops counters from finished windows. Cheap enough to call now and then. */
export async function pruneRateLimits(db: D1Database, now: number): Promise<void> {
  await db.prepare("DELETE FROM rate_limit WHERE window_start < ?").bind(now - 24 * 3600 * 1000).run();
}
