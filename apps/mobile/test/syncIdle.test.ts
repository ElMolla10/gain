import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en, ar } from "../src/i18n/strings";

// Plan 2.9 (ST-3): idle step = summary → decision → details → draft notice. No copy lost.
const f = readFileSync(join(__dirname, "..", "src", "screens", "SyncScreen.tsx"), "utf8");
const idle = f.slice(f.indexOf("{idle ? ("), f.indexOf(") : (", f.indexOf("{idle ? (")));

describe("sync idle step", () => {
  it("orders the three bullets, then Turn on, then the Full details disclosure, then the draft notice", () => {
    const bullets = idle.indexOf('"sync.sum.what"');
    const cta = idle.indexOf('<BigButton hero label={t("sync.on")}');
    const details = idle.indexOf('t("sync.fullDetails")');
    const draft = idle.indexOf('t("sync.draft")');
    expect(bullets).toBeGreaterThan(-1);
    expect(bullets).toBeLessThan(cta);
    expect(cta).toBeLessThan(details);
    expect(details).toBeLessThan(draft);
  });
  it("the not-encrypted bullet uses the alert icon in the warn colour, text in the text colour", () => {
    expect(idle).toContain('["alert", "sync.sum.e2e"]');
    expect(idle).toContain('color={icon === "alert" ? p.warn : p.muted}');
    expect(f).toMatch(/<AppText style=\{\{ flex: 1, fontSize: ty\.body \}\}>\{text\}<\/AppText>/);
  });
  it("the disclosure is a 56 dp row with an expanded state and a mirrored chevron, revealing the long text unchanged", () => {
    expect(idle).toContain("accessibilityState={{ expanded: detailsOpen }}");
    expect(idle).toContain("minHeight: 56");
    expect(idle).toContain('<Icon name="chevron" color={p.muted} size={20} mirror />');
    expect(idle).toMatch(/\{detailsOpen \? \([\s\S]*t\("sync\.privacy\.body"\)[\s\S]*t\("sync\.privacy\.body2"\)/);
  });
  it("every previously rendered idle string still renders", () => {
    for (const k of ["sync.draft", "sync.privacy.title", "sync.privacy.body", "sync.privacy.body2", "sync.on", "sync.restoreTitle", "sync.restoreNote", "sync.codeField", "sync.restore", "sync.email.title", "sync.email.send", "sync.email.verify"]) expect(f).toContain(`t("${k}")`);
    expect(f.match(/<BigButton hero label=\{t\("sync\.on"\)\}/g)).toHaveLength(1);
  });
  it("summary strings exist in both languages and mention Cloudflare", () => {
    expect(en["sync.sum.where"]).toContain("Cloudflare");
    expect(ar["sync.sum.where"]).toContain("Cloudflare");
    expect(ar["sync.fullDetails"]).toBe("التفاصيل كاملة");
  });
});
