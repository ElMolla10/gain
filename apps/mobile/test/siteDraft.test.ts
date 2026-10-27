import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/strings";

/**
 * docs/site: the static pages (privacy, terms, delete-account, support, pilot guide). These tests do not judge the legal wording; they keep the pages honest about the code and keep them from becoming tracking or "final" by accident.
 */
const repo = join(__dirname, "..", "..", "..");
const site = join(repo, "docs/site");
const pub = join(site, "public");
const pages = readdirSync(pub).filter((f) => f.endsWith(".html")).sort();
const read = (f: string) => readFileSync(join(pub, f), "utf8");
const text = (p: string) => readFileSync(p, "utf8");

describe("docs/site drafts", () => {
  it("has the pages the Play listing and the pilot need", () => {
    expect(pages).toEqual(["delete-account.html", "index.html", "pilot-guide.html", "privacy.html", "support.html", "terms.html"]);
    for (const f of ["style.css", "_headers", "robots.txt"]) expect(existsSync(join(pub, f)), f).toBe(true);
  });
  it("every page is English with an Arabic RTL section, is no longer a DRAFT or noindex page, and has no script, inline style, form or tracker", () => {
    for (const f of pages) {
      const h = read(f);
      expect(h, f).toMatch(/<html lang="en">/);
      expect(h, f).not.toMatch(/noindex/);
      expect(h, f).not.toMatch(/class="draft"|DRAFT/);
      expect(h, f).not.toMatch(/\[(Reviewer|To be written)[^\]]*\]/i);
      expect(h, f).toMatch(/<section id="ar" lang="ar" dir="rtl">/);
      expect(h, f).toMatch(/[\u0600-\u06FF]{3,}/);
      expect(h, f).not.toMatch(/<script|<iframe|<form|<img|\sstyle=|\son[a-z]+=|<link rel="(?!stylesheet)|googletagmanager|google-analytics|facebook|hotjar|fonts\.googleapis/i);
      // The only absolute URLs are GitHub links (source, issues, releases) and the app's own sync host named as text.
      for (const m of h.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) expect(m[1]!.toLowerCase(), `${f}: ${m[0]}`).toMatch(/^(github\.com|api\.github\.com)$/);
    }
  });
  it("the contact and operator are placeholders, not invented values", () => {
    for (const f of ["privacy.html", "terms.html", "delete-account.html", "support.html"]) {
      expect(read(f), f).toMatch(/data-ph="support-email">\[support email not set yet\]/);
      expect(read(f), f).not.toMatch(/mailto:/);
    }
    expect(read("privacy.html")).toMatch(/data-ph="operator">\[operator name and address not set yet\]/);
  });
  it("the privacy page states what the code makes true", () => {
    const h = read("privacy.html");
    expect(h).toContain("api.github.com");
    expect(h).toContain("github.com");
    const sync = /https:\/\/([a-z0-9.-]+)/i.exec(text(join(repo, "apps/mobile/src/sync/transport.ts")))![1]!;
    expect(h).toContain(sync);
    expect(h).toMatch(/OFF until you turn it on/);
    expect(h).toMatch(/not end-to-end encrypted/);
    expect(h).toMatch(/7 days by default, 30 at most/);
    expect(h).toMatch(/no analytics events, no crash upload, no advertising, no data selling/);
    expect(h).toMatch(/up to 7 days/);
    expect(h).toMatch(/at least 13/);
    expect(h).toContain("Optional email sign-in");
    expect(h).toMatch(/only when the server's email service is switched on/);
    expect(h).toContain("GAIN: Workout Tracker");
    expect(h).toMatch(/no remote AI provider/);
    expect(h).toMatch(/Frozen forecasts and matched outcomes stay local, outside sync/);
    expect(h).toMatch(/Android's own backup/);
    // Same limits as the in-app text.
    expect(en["privacy.leaves.link"]).toMatch(/7 days/);
    expect(en["privacy.leaves.sync"]).toMatch(/OFF until you turn it on/);
  });
  it("the update-check statement is limited to test builds, because the Play build has no updater", () => {
    expect(read("privacy.html")).toMatch(/test builds only/);
    expect(read("privacy.html")).toMatch(/will not contain this feature/);
  });
  it("the index and terms describe the free launch and the not-a-doctor line, with no purchase offers", () => {
    for (const f of pages) {
      expect(read(f), f).not.toMatch(/subscribe now|premium|upgrade to|free trial|\bpricing\b|\$\d/i);
    }
    expect(read("index.html")).toMatch(/free at launch: no subscriptions, in-app purchases or paid tiers are currently offered/);
    expect(read("terms.html")).toMatch(/Free at launch.*currently has no subscriptions, in-app purchases or paid feature tiers/);
    expect(read("index.html")).toMatch(/not a doctor or a coach/);
    expect(read("privacy.html")).toMatch(/not a doctor, a physiotherapist or a certified coach/);
  });
  it("the delete-account page names the in-app paths that exist in the strings", () => {
    const h = read("delete-account.html");
    expect(h).toContain("Turn off and delete my backup");
    expect(h).toContain("Delete all my data");
    expect(en["sync.offDelete"]).toBe("Turn off and delete my backup");
    expect(en["data.delete"]).toBe("Delete all my data");
    expect(existsSync(join(repo, "docs/ACCOUNT-DELETION-SPEC.md"))).toBe(true);
  });
  it("the pilot guide uses the app's own labels (so a lifter can find them)", () => {
    const h = read("pilot-guide.html");
    for (const k of ["update.check", "finish.accept", "finish.edit", "finish.reject", "today.start", "workout.finish", "diag.feedback", "data.exportJson"] as const) {
      const label = en[k].replace(/\s*\{.*$/, "").replace(/\?$/, "").replace(/\s*\(JSON\)$/, "").trim();
      expect(h, `${k}: ${label}`).toContain(label);
    }
  });
  it("headers block everything except the page's own files, and the pages are indexable on purpose", () => {
    expect(text(join(pub, "_headers"))).not.toMatch(/X-Robots-Tag/);
    expect(text(join(pub, "_headers"))).toMatch(/default-src 'none'/);
    expect(text(join(pub, "robots.txt"))).not.toMatch(/Disallow: \//);
  });
  it("terms name the governing law and the minimum age", () => {
    expect(read("terms.html")).toMatch(/Egyptian law governs/);
    expect(read("terms.html")).toMatch(/at least 13/);
  });
  it("wrangler.jsonc serves only public/ as static assets (no code, no bindings)", () => {
    const w = text(join(site, "wrangler.jsonc")).replace(/\/\/.*$/gm, "");
    const cfg = JSON.parse(w) as Record<string, unknown>;
    expect(cfg.name).toBe("gain-site");
    expect(cfg.assets).toMatchObject({ directory: "./public" });
    expect(Object.keys(cfg).sort()).toEqual(["assets", "compatibility_date", "name", "workers_dev"]);
  });
  it("fill-contact.mjs fills the placeholders into a copy and leaves the committed pages alone", () => {
    const out = mkdtempSync(join(tmpdir(), "gain-site-"));
    const run = execFileSync("node", [join(site, "fill-contact.mjs"), "--email", "help@example.org", "--operator", "Test <Op> & Co", "--contact", "WhatsApp", "--out", out], { encoding: "utf8" });
    expect(run).toMatch(/placeholders filled/);
    for (const f of ["privacy.html", "support.html", "pilot-guide.html"]) {
      const h = text(join(out, f));
      expect(h, f).not.toMatch(/\[[^\]]*not set yet\]/);
      expect(h, f).toContain(f === "pilot-guide.html" ? "WhatsApp" : "mailto:help@example.org");
    }
    expect(text(join(out, "privacy.html"))).toContain("Test &lt;Op&gt; &amp; Co");
    expect(read("privacy.html")).toMatch(/\[[^\]]*not set yet\]/);
    expect(() => execFileSync("node", [join(site, "fill-contact.mjs"), "--email", "nope", "--out", out], { stdio: "pipe" })).toThrow();
  });
});
