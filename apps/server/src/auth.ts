import { HttpError, type Env } from "./types";
import { rateLimit } from "./ratelimit";
import { sendSignInCode } from "./email";
import { clientIp, json, normaliseEmail, normaliseRecoveryCode, randomDigits, randomRecoveryCode, randomToken, readJson, sha256Hex, uuid } from "./util";

export interface Auth {
  accountId: string;
  deviceId: string;
}

const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const CODE_TTL = 10 * MINUTE;
const MAX_CODE_ATTEMPTS = 5;

export async function authenticate(req: Request, env: Env, now: number): Promise<Auth> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(h);
  if (!m) throw new HttpError(401, "unauthorized");
  const hash = await sha256Hex(m[1]!);
  const row = await env.DB.prepare("SELECT id, account_id, last_seen_at FROM device WHERE token_hash = ?").bind(hash).first<{ id: string; account_id: string; last_seen_at: number }>();
  if (!row) throw new HttpError(401, "unauthorized");
  if (now - row.last_seen_at > HOUR) await env.DB.prepare("UPDATE device SET last_seen_at = ? WHERE id = ?").bind(now, row.id).run();
  return { accountId: row.account_id, deviceId: row.id };
}

async function newDevice(env: Env, accountId: string, label: unknown, now: number): Promise<string> {
  const token = randomToken();
  const clean = typeof label === "string" ? label.slice(0, 40) : null;
  await env.DB.prepare("INSERT INTO device (id, account_id, token_hash, label, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(uuid(), accountId, await sha256Hex(token), clean, now, now)
    .run();
  return token;
}

/** POST /v1/account: a new anonymous account. The recovery code is shown ONCE; only its hash is kept. */
export async function createAccount(req: Request, env: Env, now: number): Promise<Response> {
  await rateLimit(env.DB, `acct:${clientIp(req)}`, 20, HOUR, now);
  const body = (await readJson(req).catch(() => ({}))) as { label?: unknown };
  const id = uuid();
  const recovery = randomRecoveryCode();
  await env.DB.prepare("INSERT INTO account (id, created_at, recovery_hash) VALUES (?, ?, ?)").bind(id, now, await sha256Hex(recovery)).run();
  const token = await newDevice(env, id, body?.label, now);
  return json({ accountId: id, deviceToken: token, recoveryCode: recovery }, 201);
}

/** POST /v1/auth/recover {recoveryCode}: a new phone signs in to the account that code belongs to. */
export async function recover(req: Request, env: Env, now: number): Promise<Response> {
  await rateLimit(env.DB, `recover:${clientIp(req)}`, 10, HOUR, now);
  const body = (await readJson(req)) as { recoveryCode?: unknown; label?: unknown };
  if (typeof body.recoveryCode !== "string" || body.recoveryCode.length > 64) throw new HttpError(400, "bad_request");
  const norm = normaliseRecoveryCode(body.recoveryCode);
  const acct = await env.DB.prepare("SELECT id FROM account WHERE recovery_hash = ?").bind(await sha256Hex(norm)).first<{ id: string }>();
  if (!acct) throw new HttpError(401, "bad_recovery_code");
  return json({ accountId: acct.id, deviceToken: await newDevice(env, acct.id, body.label, now) });
}

/** POST /v1/auth/email/start {email}: sends a short one-time code. 501 when no email provider is configured. */
export async function emailStart(req: Request, env: Env, now: number, fetchFn: typeof fetch = fetch): Promise<Response> {
  const body = (await readJson(req)) as { email?: unknown };
  const email = normaliseEmail(body.email);
  if (!email) throw new HttpError(400, "bad_email");
  await rateLimit(env.DB, `emailip:${clientIp(req)}`, 10, HOUR, now);
  await rateLimit(env.DB, `email:${email}`, 5, HOUR, now);
  const code = randomDigits(8);
  // Send first: a failed send must not leave a usable code behind.
  const mode = await sendSignInCode(env, email, code, fetchFn);
  await env.DB.prepare(
    `INSERT INTO email_code (email, code_hash, expires_at, attempts, created_at) VALUES (?1, ?2, ?3, 0, ?4)
     ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at`,
  )
    .bind(email, await sha256Hex(`${email}|${code}`), now + CODE_TTL, now)
    .run();
  return json(mode === "dev" ? { sent: false, devCode: code } : { sent: true }, 202);
}

/**
 * POST /v1/auth/email/verify {email, code}. With a bearer token the email is LINKED to that account; without one the caller signs in
 * to the account that owns the email (created on first use). An email already linked to a different account is refused when linking.
 */
export async function emailVerify(req: Request, env: Env, now: number): Promise<Response> {
  const body = (await readJson(req)) as { email?: unknown; code?: unknown; label?: unknown };
  const email = normaliseEmail(body.email);
  if (!email || typeof body.code !== "string" || !/^\d{8}$/.test(body.code)) throw new HttpError(400, "bad_request");
  await rateLimit(env.DB, `verifyip:${clientIp(req)}`, 30, HOUR, now);
  const row = await env.DB.prepare("SELECT code_hash, expires_at, attempts FROM email_code WHERE email = ?").bind(email).first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at < now || row.attempts >= MAX_CODE_ATTEMPTS) throw new HttpError(401, "bad_code");
  if ((await sha256Hex(`${email}|${body.code}`)) !== row.code_hash) {
    await env.DB.prepare("UPDATE email_code SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    throw new HttpError(401, "bad_code");
  }
  await env.DB.prepare("DELETE FROM email_code WHERE email = ?").bind(email).run(); // one use only
  const owner = await env.DB.prepare("SELECT id FROM account WHERE email = ?").bind(email).first<{ id: string }>();
  if (req.headers.get("authorization")) {
    const me = await authenticate(req, env, now);
    if (owner && owner.id !== me.accountId) throw new HttpError(409, "email_in_use");
    await env.DB.prepare("UPDATE account SET email = ?, email_verified_at = ? WHERE id = ?").bind(email, now, me.accountId).run();
    return json({ accountId: me.accountId, linked: true });
  }
  let accountId = owner?.id;
  let recoveryCode: string | undefined;
  if (!accountId) {
    accountId = uuid();
    recoveryCode = randomRecoveryCode();
    await env.DB.prepare("INSERT INTO account (id, created_at, recovery_hash, email, email_verified_at) VALUES (?, ?, ?, ?, ?)")
      .bind(accountId, now, await sha256Hex(recoveryCode), email, now)
      .run();
  }
  return json({ accountId, deviceToken: await newDevice(env, accountId, body.label, now), ...(recoveryCode ? { recoveryCode } : {}) });
}

/** POST /v1/auth/logout: this phone's token stops working. The account and its data stay. */
export async function logout(auth: Auth, env: Env): Promise<Response> {
  await env.DB.prepare("DELETE FROM device WHERE id = ?").bind(auth.deviceId).run();
  return json({ ok: true });
}

export async function me(auth: Auth, env: Env): Promise<Response> {
  const a = await env.DB.prepare("SELECT id, email, created_at FROM account WHERE id = ?").bind(auth.accountId).first<{ id: string; email: string | null; created_at: number }>();
  const d = await env.DB.prepare("SELECT COUNT(*) AS n FROM device WHERE account_id = ?").bind(auth.accountId).first<{ n: number }>();
  const h = await env.DB.prepare("SELECT COALESCE(MAX(seq), 0) AS head, COUNT(*) AS rows FROM sync_row WHERE account_id = ?").bind(auth.accountId).first<{ head: number; rows: number }>();
  return json({ accountId: a?.id, email: a?.email ?? null, createdAt: a?.created_at, devices: d?.n ?? 0, head: h?.head ?? 0, rows: h?.rows ?? 0 });
}

/** DELETE /v1/account: everything the server holds for this account is removed (rows, devices, links, the account itself). */
export async function deleteAccount(auth: Auth, env: Env): Promise<Response> {
  const id = auth.accountId;
  const stmts = [
    env.DB.prepare("DELETE FROM sync_row WHERE account_id = ?").bind(id),
    env.DB.prepare("DELETE FROM coach_link WHERE account_id = ?").bind(id),
    env.DB.prepare("DELETE FROM device WHERE account_id = ?").bind(id),
    env.DB.prepare("DELETE FROM account WHERE id = ?").bind(id),
  ];
  await env.DB.batch(stmts);
  return json({ deleted: true });
}
