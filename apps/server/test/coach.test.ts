import { describe, expect, it } from "vitest";
import { makeWorld } from "./harness";

const card = (over: Record<string, unknown> = {}) => ({
  lang: "en", dir: "ltr", title: "Push day", date: "2026-10-03",
  blocks: [{ heading: "Done", lines: ["Bench: 100 kg × 5", "Row: 80 kg × 8"] }, { heading: "Next", lines: ["Bench: 102.5 kg × 5"] }],
  footer: "A training aid, not medical advice.", ...over,
});

async function setup() {
  const w = makeWorld();
  const a = await w.newAccount();
  return { w, tok: a.deviceToken };
}
const tokenOf = (url: string) => url.split("/c/")[1]!;

describe("coach link: create and view", () => {
  it("serves the card to someone with NO account, only text, with private headers", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card(), expiresInDays: 3 } });
    expect(r.status).toBe(201);
    expect(r.body.url).toMatch(/^https:\/\/gain\.test\/c\/[A-Za-z0-9_-]{32}$/);
    expect(r.body.expiresAt).toBe(w.now + 3 * 86400_000);
    const page = await w.call("GET", `/c/${tokenOf(r.body.url)}`, { ip: "8.8.8.8" }); // no Authorization header
    expect(page.status).toBe(200);
    expect(page.text).toContain("Bench: 100 kg × 5");
    expect(page.text).toContain("Bench: 102.5 kg × 5");
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(page.headers.get("x-robots-tag")).toContain("noindex");
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    expect(page.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(page.text).not.toMatch(/<script/i);
  });

  it("stores only a hash of the token, and the page shows no account or phone identifiers", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    const token = tokenOf(r.body.url);
    expect(JSON.stringify(w.db.raw.prepare("SELECT * FROM coach_link").all())).not.toContain(token);
    const page = await w.call("GET", `/c/${token}`);
    const acct = (w.db.raw.prepare("SELECT id FROM account").get() as { id: string }).id;
    expect(page.text).not.toContain(acct);
  });

  it("Arabic cards render right-to-left", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card({ lang: "ar", dir: "rtl", title: "يوم الدفع", blocks: [{ heading: "تم", lines: ["بنش: ١٠٠ × ٥"] }] }) } });
    const page = await w.call("GET", `/c/${tokenOf(r.body.url)}`);
    expect(page.text).toContain('lang="ar" dir="rtl"');
    expect(page.text).toContain("بنش: ١٠٠ × ٥");
  });

  it("escapes everything: markup in any field never becomes markup", async () => {
    const { w, tok } = await setup();
    const evil = `<img src=x onerror=alert(1)>"'&`;
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card({ title: evil, date: evil, footer: evil, blocks: [{ heading: evil, lines: [evil] }] }) } });
    const page = await w.call("GET", `/c/${tokenOf(r.body.url)}`);
    expect(page.text).not.toContain("<img");
    expect(page.text).toContain("&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;");
  });

  it("default expiry is 7 days; counts views", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    expect(r.body.expiresAt).toBe(w.now + 7 * 86400_000);
    await w.call("GET", `/c/${tokenOf(r.body.url)}`);
    await w.call("GET", `/c/${tokenOf(r.body.url)}`);
    const list = await w.call("GET", "/v1/coach-links", { token: tok });
    expect(list.body.links[0].views).toBe(2);
    expect(list.body.links[0].active).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain(tokenOf(r.body.url)); // tokens are never listed
  });
});

describe("coach link: expiry and revoke", () => {
  it("stops working at expiry and gives the same page as an unknown link", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card(), expiresInDays: 1 } });
    const token = tokenOf(r.body.url);
    expect((await w.call("GET", `/c/${token}`)).status).toBe(200);
    w.tick(86400_000 - 1);
    expect((await w.call("GET", `/c/${token}`)).status).toBe(200);
    w.tick(1);
    const gone = await w.call("GET", `/c/${token}`);
    const unknown = await w.call("GET", `/c/${"A".repeat(32)}`);
    expect(gone.status).toBe(404);
    expect(gone.text).toBe(unknown.text);
    expect(gone.text).not.toContain("Bench");
  });

  it("revoke kills the link at once and wipes the stored card", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    const token = tokenOf(r.body.url);
    expect((await w.call("DELETE", `/v1/coach-links/${r.body.id}`, { token: tok })).status).toBe(200);
    expect((await w.call("GET", `/c/${token}`)).status).toBe(404);
    expect((w.db.raw.prepare("SELECT payload FROM coach_link").get() as { payload: string }).payload).toBe("{}");
    expect((await w.call("DELETE", `/v1/coach-links/${r.body.id}`, { token: tok })).status).toBe(404); // already gone
  });

  it("creator-only: another account cannot revoke or list someone else's link", async () => {
    const w = makeWorld();
    const a = await w.newAccount("1.1.1.1");
    const b = await w.newAccount("2.2.2.2");
    const r = await w.call("POST", "/v1/coach-links", { token: a.deviceToken, body: { card: card() } });
    expect((await w.call("DELETE", `/v1/coach-links/${r.body.id}`, { token: b.deviceToken })).status).toBe(404);
    expect((await w.call("GET", `/c/${tokenOf(r.body.url)}`)).status).toBe(200);
    expect((await w.call("GET", "/v1/coach-links", { token: b.deviceToken })).body.links).toHaveLength(0);
    expect((await w.call("DELETE", `/v1/coach-links/${r.body.id}`)).status).toBe(401);
  });

  it("deleting the account removes its links", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    await w.call("DELETE", "/v1/account", { token: tok });
    expect((await w.call("GET", `/c/${tokenOf(r.body.url)}`)).status).toBe(404);
    expect((w.db.raw.prepare("SELECT COUNT(*) AS n FROM coach_link").get() as { n: number }).n).toBe(0);
  });
});

describe("coach link: abuse cases", () => {
  it("needs a token to create; refuses bad cards and expiries", async () => {
    const { w, tok } = await setup();
    expect((await w.call("POST", "/v1/coach-links", { body: { card: card() } })).status).toBe(401);
    for (const bad of [null, {}, card({ lang: "fr" }), card({ blocks: [] }), card({ title: "x".repeat(601) }), card({ blocks: [{ heading: "h", lines: [{ a: 1 }] }] })]) {
      expect((await w.call("POST", "/v1/coach-links", { token: tok, body: { card: bad } })).status).toBe(400);
    }
    for (const days of [0, 31, 1.5, "7", -1]) expect((await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card(), expiresInDays: days } })).status).toBe(400);
    const huge = card({ blocks: Array.from({ length: 12 }, () => ({ heading: "h", lines: Array.from({ length: 5 }, () => "x".repeat(600)) })) });
    expect((await w.call("POST", "/v1/coach-links", { token: tok, body: { card: huge } })).body.reason).toBe("too_big");
  });

  it("caps active links per account", async () => {
    const { w, tok } = await setup();
    for (let i = 0; i < 20; i++) expect((await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } })).status).toBe(201);
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("too_many_links");
  });

  it("link guessing: wrong, malformed and near-miss tokens are all the same 404, and guessing is rate limited per address", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    const good = tokenOf(r.body.url);
    const near = good.slice(0, -1) + (good.endsWith("A") ? "B" : "A");
    const bodies = new Set<string>();
    for (const t of [near, "A".repeat(32), "short", good + "x", good.toLowerCase() === good ? good.toUpperCase() : good.toLowerCase(), "../v1/me", "%00"]) {
      const res = await w.call("GET", `/c/${encodeURIComponent(t)}`, { ip: "7.7.7.7" });
      if (t !== good.toLowerCase() || good.toLowerCase() === good) expect(res.status).toBe(404);
      bodies.add(res.text);
    }
    expect(bodies.size).toBe(1);
    let limited = 0;
    for (let i = 0; i < 130; i++) if ((await w.call("GET", `/c/${"B".repeat(32)}`, { ip: "6.6.6.6" })).status === 429) limited++;
    expect(limited).toBe(10);
    // a different address is unaffected, and the real link still works
    expect((await w.call("GET", `/c/${good}`, { ip: "5.5.5.5" })).status).toBe(200);
  });

  it("tokens carry 192 bits: no two of 200 links collide", async () => {
    const { w, tok } = await setup();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      w.db.raw.exec("DELETE FROM coach_link");
      seen.add(tokenOf((await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } })).body.url));
      w.tick(1);
      if (i % 25 === 0) w.tick(3600_000);
    }
    expect(seen.size).toBe(200);
  });

  it("a stored payload that was tampered with never renders", async () => {
    const { w, tok } = await setup();
    const r = await w.call("POST", "/v1/coach-links", { token: tok, body: { card: card() } });
    w.db.raw.exec(`UPDATE coach_link SET payload = '{"lang":"en","dir":"ltr","title":1,"date":"","blocks":[],"footer":""}'`);
    expect((await w.call("GET", `/c/${tokenOf(r.body.url)}`)).status).toBe(404);
  });

  it("PUBLIC_BASE_URL decides the link origin", async () => {
    const w = makeWorld({ PUBLIC_BASE_URL: "https://gain.example/" });
    const a = await w.newAccount();
    const r = await w.call("POST", "/v1/coach-links", { token: a.deviceToken, body: { card: card() } });
    expect(r.body.url.startsWith("https://gain.example/c/")).toBe(true);
  });
});
