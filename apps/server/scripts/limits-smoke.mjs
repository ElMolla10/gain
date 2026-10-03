// Live exercise of the account quota and the kill switch against a RUNNING Worker (the unit/e2e tests cover the same rules with injected env).
//   node scripts/limits-smoke.mjs <base-url> quota [expectedQuota]        fills a throwaway account until 413 quota_exceeded, then deletes it
//   node scripts/limits-smoke.mjs <base-url> kill prepare <state.json>     creates a throwaway account and saves its token (keep the file off the repo)
//   node scripts/limits-smoke.mjs <base-url> kill 0|writes|1 <state.json>  checks the behaviour of that KILL_SWITCH value on the deployed Worker
//   node scripts/limits-smoke.mjs <base-url> kill cleanup <state.json>     deletes the throwaway account (needs KILL_SWITCH off)
// The quota run writes up to the account quota (25 MB by default) of fake gym rows to ONE throwaway account; the account is deleted at the end.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const mode = process.argv[3];
if (!/^https?:\/\//.test(base) || !["quota", "kill"].includes(mode)) {
  console.error("usage: limits-smoke.mjs <base-url> quota [expectedQuota] | kill prepare|0|writes|1|cleanup <state.json>");
  process.exit(2);
}
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
  return { status: res.status, json, text };
};
const canon = (row) => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map((k) => [k, row[k]])));
const event = (id, fields, t) => ({ eventId: randomUUID(), table: "gym", rowId: id, updatedAt: t, deletedAt: null, data: canon({ id, created_at: 1, ...fields, updated_at: t, deleted_at: null }) });

async function quota() {
  const expected = Number(process.argv[4] ?? 25_000_000);
  const acct = await call("POST", "/v1/account", null, { label: "limits-smoke" });
  ok(acct.status === 201 && acct.json?.deviceToken, "create throwaway account");
  const tok = acct.json.deviceToken;
  try {
    const rowChars = Math.min(60_000, Math.floor(expected / 20)); // below the 64 KB single-row cap
    const perPush = 10; // keep each request small (Cloudflare's free Worker plan has a tiny CPU budget per request)
    const t0 = Date.now() - 60_000;
    let stored = 0, n = 0, refused = null;
    for (let push = 0; push < Math.ceil(expected / (rowChars * perPush)) + 5 && !refused; push++) {
      const events = Array.from({ length: perPush }, () => event(`q-${n++}`, { name: "x".repeat(rowChars) }, t0 + n));
      const r = await call("POST", "/v1/sync/push", tok, { events });
      if (r.status === 413 && r.json?.error === "quota_exceeded") refused = r.json;
      else if (r.status === 200 && r.json?.results?.every((x) => x.status === "applied")) stored += events.reduce((s, e) => s + e.data.length, 0);
      else { ok(false, `unexpected push answer ${r.status} ${r.text.slice(0, 200)}`); break; }
    }
    ok(refused !== null, "a push past the quota is refused with 413 quota_exceeded");
    if (refused) {
      ok(refused.quota === expected, `the answer reports quota ${expected} (got ${refused.quota})`);
      ok(refused.used === stored, `server counted exactly what was stored (${stored} chars; server says ${refused.used})`);
      ok(stored <= expected && expected - stored < rowChars * perPush + 1000, `account filled to within one batch of the quota (${stored} of ${expected})`);
      const pull = await call("GET", "/v1/sync/pull?since=0&limit=5", tok);
      ok(pull.status === 200, "reads still work at the quota");
      const shrink = await call("POST", "/v1/sync/push", tok, { events: [event("q-0", { name: "small" }, Date.now())] });
      ok(shrink.status === 200 && shrink.json?.results?.[0]?.status === "applied", "an edit that shrinks a row still fits");
      const over = await call("POST", "/v1/sync/push", tok, { events: [event("q-new-0", { name: "x".repeat(rowChars) }, Date.now()), ...Array.from({ length: perPush }, (_, i) => event(`q-new-${i + 1}`, { name: "x".repeat(rowChars) }, Date.now()))] });
      ok(over.status === 413 && over.json?.error === "quota_exceeded", "new rows past the quota are still refused after the shrink");
    }
  } finally {
    const del = await call("DELETE", "/v1/account", tok);
    ok(del.status === 200, "throwaway account deleted");
    ok((await call("GET", "/v1/me", tok)).status === 401, "token dead after delete");
  }
}

async function kill() {
  const what = process.argv[4];
  const file = process.argv[5];
  if (!file) { console.error("need a state file path"); process.exit(2); }
  if (what === "prepare") {
    const acct = await call("POST", "/v1/account", null, { label: "kill-smoke" });
    ok(acct.status === 201, "create throwaway account");
    writeFileSync(file, JSON.stringify({ token: acct.json.deviceToken, recovery: acct.json.recoveryCode }), { mode: 0o600 });
    return;
  }
  const st = JSON.parse(readFileSync(file, "utf8"));
  const tok = st.token;
  if (what === "0") {
    ok((await call("GET", "/health")).status === 200, "health 200");
    ok((await call("GET", "/v1/me", tok)).status === 200, "me 200");
    ok((await call("POST", "/v1/sync/push", tok, { events: [] })).status === 200, "push 200");
  } else if (what === "writes") {
    ok((await call("GET", "/health")).status === 200, "health 200");
    const np = await call("POST", "/v1/account", null, { label: "should-be-refused" });
    ok(np.status === 503 && np.json?.error === "service_paused", "new account refused (503 service_paused)");
    ok((await call("POST", "/v1/sync/push", tok, { events: [event("k1", { name: "n" }, Date.now())] })).status === 503, "push refused (503)");
    ok((await call("POST", "/v1/coach-links", tok, {})).status === 503, "coach link create refused (503)");
    ok((await call("POST", "/v1/auth/email/start", null, { email: "a@example.invalid" })).status === 503, "email code refused (503)");
    ok((await call("GET", "/v1/sync/pull?since=0", tok)).status === 200, "pull still works");
    ok((await call("GET", "/v1/me", tok)).status === 200, "me still works");
    ok((await call("POST", "/v1/auth/recover", null, { recoveryCode: st.recovery })).status === 200, "recover still works");
  } else if (what === "1") {
    ok((await call("GET", "/health")).status === 200, "health still 200");
    for (const [m, p] of [["GET", "/v1/me"], ["GET", "/v1/sync/pull?since=0"], ["POST", "/v1/account"], ["DELETE", "/v1/account"]]) {
      const r = await call(m, p, tok, m === "POST" ? {} : undefined);
      ok(r.status === 503 && r.json?.error === "service_paused", `${m} ${p.split("?")[0]} is 503 service_paused`);
    }
  } else if (what === "cleanup") {
    const del = await call("DELETE", "/v1/account", tok);
    ok(del.status === 200, "throwaway account deleted");
    rmSync(file, { force: true });
  }
}

await (mode === "quota" ? quota() : kill());
console.log(failed === 0 ? "ALL PASSED" : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
