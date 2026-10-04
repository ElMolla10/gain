import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { darkPalette, lightPalette, logDarkPalette, logLightPalette } from "../src/palettes";
import { SAMPLE_PROGRAMME } from "../src/db/seedData";
import { freshDb } from "./helpers";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");
const screen = src("screens/WorkoutScreen.tsx");
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { r: r!, g: g!, b: b! };
};

describe("done tick: muted green, not lime (shared palette tokens)", () => {
  for (const [name, p, lp] of [["dark", darkPalette, logDarkPalette], ["light", lightPalette, logLightPalette]] as const) {
    it(`${name}: tokens are shared by the app palette and the logger palette`, () => {
      expect(lp.doneFill).toBe(p.doneFill);
      expect(lp.doneEdge).toBe(p.doneEdge);
      expect(lp.onDone).toBe(p.onDone);
    });
    it(`${name}: the check is readable on the done fill (4.5:1) and the done outline is a 3:1 boundary on the done row`, () => {
      expect(ratio(p.onDone, p.doneFill)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.doneEdge, lp.doneBg)).toBeGreaterThanOrEqual(3);
      expect(ratio(p.doneEdge, p.bg)).toBeGreaterThanOrEqual(3);
    });
    it(`${name}: the done fill is green and far from the brand lime, which stays the primary fill`, () => {
      expect(p.doneFill.toLowerCase()).not.toBe(p.fill.toLowerCase());
      const d = hue(p.doneFill);
      expect(d.g).toBeGreaterThan(d.r);
      expect(d.g).toBeGreaterThan(d.b);
      const lime = hue(p.fill);
      const chroma = (x: { r: number; g: number; b: number }) => Math.max(x.r, x.g, x.b) - Math.min(x.r, x.g, x.b);
      expect(chroma(d)).toBeLessThan(chroma(lime) / 2); // muted: far less saturated than the lime
    });
  }
  it("the tick button uses the done tokens, keeps the check icon, checkbox state and a 48 dp box", () => {
    const tick = screen.slice(screen.indexOf('accessibilityRole="checkbox"'), screen.indexOf("<SwipeRow key"));
    expect(tick).toContain("p.doneFill");
    expect(tick).toContain("p.doneEdge");
    expect(tick).toContain("p.onDone");
    expect(tick).not.toMatch(/done \? p\.fill/);
    expect(tick).toContain("accessibilityState={{ checked: done");
    expect(tick).toContain('name="check"');
    expect(tick).toContain("width: 48, height: 48");
  });
});

describe("logger spacing uses the shared tokens", () => {
  it("exercise block, target line and set table sit tighter, with only token values", () => {
    expect(screen).toContain("paddingTop: space.md, borderStartWidth");
    expect(screen).toContain("marginTop: space.xs }}>\n          <View style={colSet}>");
    expect(screen).not.toContain("gap: space.xs, paddingTop: space.lg, borderStartWidth");
  });
});

describe("starter program: structure only, never fabricated history", () => {
  it("Today says 'Starter program · Edit it to match your routine.' in English; Egyptian Arabic (draft) is Arabic and the old placeholder wording is gone", () => {
    expect(en["today.starterNote"]).toBe("Starter program · Edit it to match your routine.");
    expect(ar["today.starterNote"]).toMatch(/[\u0600-\u06FF]/);
    expect(JSON.stringify(en)).not.toMatch(/placeholder program|are placeholders/i);
    expect(en["ob.skipNote"]).toContain("starter program");
    expect(ar["ob.skipNote"]).toContain("مبدئي");
    expect(en["prog.sampleTag"]).toContain("Starter");
    expect(ar["prog.sampleTag"]).toContain("مبدئي");
  });
  it("the seed is a plain program: no sessions, no sets, no targets with numbers, no decisions", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const n = async (sql: string) => Number((await c.db.get<{ n: number }>(sql))?.n);
    expect(await n("SELECT COUNT(*) AS n FROM session")).toBe(0);
    expect(await n("SELECT COUNT(*) AS n FROM workout_set")).toBe(0);
    expect(await n("SELECT COUNT(*) AS n FROM target")).toBe(0);
    expect(SAMPLE_PROGRAMME.days.length).toBeGreaterThan(1);
    const next = await c.repos.getNextDay();
    const gymId = (await c.repos.getActiveGymId())!;
    const planned = await c.finish.planDay(next!.day.id, gymId);
    const targets = await c.finish.getTargets(planned!.sessionId);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.load).toBeNull(); // no demo weights: a first-ever lift has no number until the lifter logs one
      expect(t.reps).toBeNull();
    }
    expect(await n("SELECT COUNT(*) AS n FROM session WHERE status = 'finished'")).toBe(0);
  });
});
