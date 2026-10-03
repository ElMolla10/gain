import { COACH_LIMITS, validateCoachCard, type CoachCardPayload } from "@gain/sync";
import type { Auth } from "./auth";
import { rateLimit } from "./ratelimit";
import { HttpError, type Env } from "./types";
import { clientIp, json, randomToken, readJson, sha256Hex, uuid } from "./util";

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/; // 24 random bytes = 192 bits

function baseUrl(req: Request, env: Env): string {
  return (env.PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

/**
 * POST /v1/coach-links {card, expiresInDays?}: the lifter publishes ONE coach card behind a private link.
 * The token is returned once; only its hash is stored. The card is plain text blocks (validated), never HTML.
 */
export async function createLink(req: Request, env: Env, auth: Auth, now: number): Promise<Response> {
  await rateLimit(env.DB, `coachnew:${auth.accountId}`, 30, HOUR, now);
  const body = (await readJson(req, 64 * 1024)) as { card?: unknown; expiresInDays?: unknown };
  const why = validateCoachCard(body.card);
  if (why) throw new HttpError(400, "bad_card", { reason: why });
  const daysRaw = body.expiresInDays === undefined ? COACH_LIMITS.defaultDays : body.expiresInDays;
  if (typeof daysRaw !== "number" || !Number.isInteger(daysRaw) || daysRaw < 1 || daysRaw > COACH_LIMITS.maxDays) throw new HttpError(400, "bad_expiry");

  // Old finished links are cleaned up here, so the table does not grow without bound.
  await env.DB.prepare("DELETE FROM coach_link WHERE account_id = ? AND (expires_at < ? OR revoked_at IS NOT NULL) AND created_at < ?").bind(auth.accountId, now - 30 * DAY, now - 30 * DAY).run();
  const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM coach_link WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ?").bind(auth.accountId, now).first<{ n: number }>();
  if ((active?.n ?? 0) >= COACH_LIMITS.maxActiveLinks) throw new HttpError(409, "too_many_links", { max: COACH_LIMITS.maxActiveLinks });

  const token = randomToken(24);
  const id = uuid();
  const expiresAt = now + daysRaw * DAY;
  await env.DB.prepare("INSERT INTO coach_link (id, account_id, token_hash, payload, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, auth.accountId, await sha256Hex(token), JSON.stringify(body.card), now, expiresAt)
    .run();
  return json({ id, url: `${baseUrl(req, env)}/c/${token}`, expiresAt }, 201);
}

/** GET /v1/coach-links: the lifter's own links (never the tokens: those cannot be recovered, only revoked). */
export async function listLinks(env: Env, auth: Auth, now: number): Promise<Response> {
  const rows = await env.DB.prepare("SELECT id, created_at, expires_at, revoked_at, views FROM coach_link WHERE account_id = ? ORDER BY created_at DESC LIMIT 50")
    .bind(auth.accountId)
    .all<{ id: string; created_at: number; expires_at: number; revoked_at: number | null; views: number }>();
  return json({
    links: rows.results.map((r) => ({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, views: r.views, active: r.revoked_at === null && r.expires_at > now })),
  });
}

/** DELETE /v1/coach-links/:id: only the account that created the link can revoke it; for anyone else it does not exist. */
export async function revokeLink(env: Env, auth: Auth, id: string, now: number): Promise<Response> {
  const r = await env.DB.prepare("UPDATE coach_link SET revoked_at = ?, payload = '{}' WHERE id = ? AND account_id = ? AND revoked_at IS NULL").bind(now, id, auth.accountId).run();
  if ((r.meta?.changes ?? 0) === 0) throw new HttpError(404, "not_found");
  return json({ revoked: true });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/** The page a coach opens. Text only, escaped, Arabic/English, RTL aware. No script, no external requests. */
export function renderCard(c: CoachCardPayload): string {
  const blocks = c.blocks
    .map((b) => `<section><h2>${esc(b.heading)}</h2><ul>${b.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>`)
    .join("");
  return `<!doctype html><html lang="${c.lang}" dir="${c.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(c.title)}</title><style>
body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Naskh Arabic",sans-serif;margin:0;background:#f4f5f7;color:#111}
main{max-width:640px;margin:0 auto;padding:20px 16px 40px}
h1{font-size:22px;margin:0 0 4px}.date{color:#555;margin:0 0 16px}
section{background:#fff;border-radius:12px;padding:12px 16px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.08)}
h2{font-size:16px;margin:0 0 6px;color:#0a58ca}ul{margin:0;padding-inline-start:20px}li{margin:4px 0}
footer{color:#555;font-size:13px;margin-top:20px}
@media (prefers-color-scheme:dark){body{background:#000;color:#eee}section{background:#16181c}h2{color:#6ea8fe}.date,footer{color:#aaa}}
</style></head><body><main><h1>${esc(c.title)}</h1><p class="date">${esc(c.date)}</p>${blocks}<footer>${esc(c.footer)}</footer></main></body></html>`;
}

const GONE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>GAIN</title></head><body style="font:16px system-ui;margin:40px 16px"><p>This link is not available. It may have expired or been withdrawn.</p><p dir="rtl">هذا الرابط غير متاح. ربما انتهت صلاحيته أو تم سحبه.</p></body></html>`;

/** GET /c/:token. An unknown, expired and revoked token all give the same 404 page, so the page reveals nothing about which links exist. */
export async function viewCard(req: Request, env: Env, token: string, now: number): Promise<Response> {
  await rateLimit(env.DB, `coachview:${clientIp(req)}`, 120, MINUTE, now);
  const notFound = () => new Response(GONE, { status: 404, headers: HEADERS });
  if (!TOKEN_RE.test(token)) return notFound();
  const row = await env.DB.prepare("SELECT id, payload, expires_at, revoked_at FROM coach_link WHERE token_hash = ?").bind(await sha256Hex(token)).first<{ id: string; payload: string; expires_at: number; revoked_at: number | null }>();
  if (!row || row.revoked_at !== null || row.expires_at <= now) return notFound();
  let card: CoachCardPayload;
  try {
    card = JSON.parse(row.payload) as CoachCardPayload;
    if (validateCoachCard(card)) return notFound();
  } catch {
    return notFound();
  }
  await env.DB.prepare("UPDATE coach_link SET views = views + 1 WHERE id = ?").bind(row.id).run();
  return new Response(renderCard(card), { status: 200, headers: HEADERS });
}
