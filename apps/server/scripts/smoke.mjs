// End-to-end check against a RUNNING Worker (wrangler dev or the deployed URL): node scripts/smoke.mjs https://gain-sync.example.workers.dev
// Creates a throwaway account, pushes/pulls/replays, checks the coach link when present, then deletes the account.
import { randomUUID } from "node:crypto";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failed++;
};
const call = async (method, path, token, body) => {
  const res = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
};
const canon = (row) => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map((k) => [k, row[k]])));
const event = (id, fields, t, del = null) => ({ eventId: randomUUID(), table: "gym", rowId: id, updatedAt: t, deletedAt: del, data: canon({ id, created_at: 1, ...fields, updated_at: t, deleted_at: del }) });

const health = await call("GET", "/health");
ok(health.status === 200, "health");
const acct = await call("POST", "/v1/account", null, { label: "smoke" });
ok(acct.status === 201 && acct.json?.deviceToken, "create anonymous account");
const tok = acct.json.deviceToken;
const t0 = Date.now() - 1000;
const a = event("smoke-g1", { name: "one" }, t0);
const p1 = await call("POST", "/v1/sync/push", tok, { events: [a, event("smoke-g2", { name: "two" }, t0)] });
ok(p1.json?.results?.map((r) => r.status).join() === "applied,applied", "push applies");
const p2 = await call("POST", "/v1/sync/push", tok, { events: [a] });
ok(p2.json?.results?.[0]?.status === "duplicate", "replay is a duplicate");
const p3 = await call("POST", "/v1/sync/push", tok, { events: [event("smoke-g1", { name: "older" }, t0 - 500)] });
ok(p3.json?.results?.[0]?.status === "stale", "older write is stale");
const p4 = await call("POST", "/v1/sync/push", tok, { events: [event("smoke-g2", { name: "two" }, t0 + 5, t0 + 5)] });
ok(p4.json?.results?.[0]?.status === "applied", "tombstone applies");
const pull = await call("GET", "/v1/sync/pull?since=0", tok);
ok(pull.json?.rows?.length === 2 && pull.json.rows.some((r) => r.rowId === "smoke-g2" && r.deletedAt), "pull returns both rows, one tombstone");
const rec = await call("POST", "/v1/auth/recover", null, { recoveryCode: acct.json.recoveryCode });
ok(rec.status === 200 && rec.json.accountId === acct.json.accountId, "recovery code signs in a second phone");
const noauth = await call("GET", "/v1/sync/pull?since=0");
ok(noauth.status === 401, "no token is refused");
const email = await call("POST", "/v1/auth/email/start", null, { email: "smoke@example.invalid" });
console.log(`INFO email sign-in: HTTP ${email.status} ${email.json?.error ?? (email.json?.sent === false ? "dev-mode" : "sent")}`);

if (process.env.SKIP_COACH !== "1") {
  const card = { lang: "en", dir: "ltr", title: "Smoke <b>card</b>", date: "2026-10-03", blocks: [{ heading: "Done", lines: ["Squat: 100 x 5"] }], footer: "smoke" };
  const link = await call("POST", "/v1/coach-links", tok, { card, expiresInDays: 1 });
  if (link.status === 404) console.log("INFO coach links not deployed in this build");
  else {
    ok(link.status === 201 && link.json?.url, "coach link created");
    const page = await fetch(link.json.url);
    const html = await page.text();
    ok(page.status === 200 && html.includes("Squat: 100 x 5") && !html.includes("<b>card</b>"), "coach page renders and escapes");
    const rev = await call("DELETE", `/v1/coach-links/${link.json.id}`, tok);
    ok(rev.status === 200, "revoke");
    ok((await fetch(link.json.url)).status === 404, "revoked link is gone");
  }
}

const del = await call("DELETE", "/v1/account", tok);
ok(del.status === 200, "delete account");
ok((await call("GET", "/v1/me", tok)).status === 401, "token dead after delete");
console.log(failed === 0 ? "ALL PASSED" : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
