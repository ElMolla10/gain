import { describe, expect, it } from "vitest";
import type { SessionSummary, TargetRow } from "../src/db/finishRepo";
import { buildCardModel, cardHtml, cardPaceLine } from "../src/logic/coachCard";
import type { PaceContext } from "../src/logic/paceText";
import { translate } from "../src/i18n/format";

const summary: SessionSummary = {
  sessionId: "s1",
  exercises: [
    { exerciseId: "bench", nameEn: "Bench <Press>", nameAr: "بنش برس", counted: 3, warmups: 2, dropSets: 0, unconfirmed: 1, top: { load: 60, reps: 10 }, records: ["load"], firstTime: false },
    { exerciseId: "row", nameEn: "Row", nameAr: "تجديف", counted: 3, warmups: 0, dropSets: 0, unconfirmed: 0, top: { load: 40, reps: 8 }, records: [], firstTime: true },
  ],
  totals: { exercises: 2, counted: 6, warmups: 2, unconfirmed: 1, records: 1 },
};
const target = (over: Partial<TargetRow>): TargetRow => ({
  id: "t", sessionId: "n", exerciseId: "bench", lineId: "l", nameEn: "Bench <Press>", nameAr: "بنش برس", load: 62.5, reps: 8, targetRir: 2, quality: null, plannedSets: 3,
  currency: "reps", jumpKind: null, ruleVersion: "r1", path: "rule", status: "proposed", reason: { key: "reps.progress", params: {} } as never, confidence: "high", editedLoad: null, effectiveLoad: 62.5, ...over,
});
const base = { unit: "kg" as const, date: "2026-10-03", summary, paceLine: "On pace" };

describe("coach card (Step 13)", () => {
  it("English card: sections, loads, status and the not-a-doctor line", () => {
    const m = buildCardModel({ ...base, lang: "en", next: { dayName: "Push A", targets: [target({})] } });
    expect(m.dir).toBe("ltr");
    const text = JSON.stringify(m);
    expect(text).toContain("Bench <Press>");
    expect(text).toContain("62.5");
    expect(m.blocks.map((b) => b.heading)).toEqual(["What I did", "Next targets: \u2066Push A\u2069", "Goal pace"]);
    expect(m.footer).toMatch(/not medical advice/);
    // the record claim only appears for the line that had history; first time claims none
    const done = m.blocks[0]!.lines;
    expect(done[0]).toMatch(/Heaviest working load/);
    expect(done[1]).toMatch(/no record is claimed/);
    expect(done[1]).not.toMatch(/Heaviest/);
    expect(done[0]).toMatch(/Not counted/);
  });

  it("Arabic card is right-to-left, uses Arabic text, and the same numbers", () => {
    const m = buildCardModel({ ...base, lang: "ar", next: { dayName: "دفع", targets: [target({})] } });
    expect(m.dir).toBe("rtl");
    expect(m.title).toMatch(/[\u0600-\u06FF]/);
    expect(m.footer).toMatch(/[\u0600-\u06FF]/);
    expect(JSON.stringify(m)).toContain("بنش برس");
    expect(JSON.stringify(m)).toContain("62.5");
    const html = cardHtml(m);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });

  it("lb unit shows lb numbers", () => {
    const m = buildCardModel({ ...base, unit: "lb", lang: "en", next: { dayName: "A", targets: [target({ effectiveLoad: 61.235 })] } });
    expect(JSON.stringify(m)).toContain("135");
    expect(JSON.stringify(m)).toContain("lb");
  });

  it("rejected, no-target and no-next cases say so", () => {
    const m = buildCardModel({ ...base, lang: "en", paceLine: null, next: { dayName: "A", targets: [target({ status: "rejected", effectiveLoad: null }), target({ currency: "none", effectiveLoad: null, id: "x" })] } });
    const lines = m.blocks[1]!.lines;
    expect(lines[0]).toMatch(/choose your own weight/);
    expect(lines[1]).toMatch(/No target yet/);
    expect(m.blocks).toHaveLength(2);
    const none = buildCardModel({ ...base, lang: "en", next: null });
    expect(none.blocks[1]!.lines).toEqual([translate("en", "card.noNext")]);
  });

  it("HTML escapes names and keeps the page self-contained", () => {
    const html = cardHtml(buildCardModel({ ...base, lang: "en", next: null }));
    expect(html).toContain("Bench &lt;Press&gt;");
    expect(html).not.toContain("<Press>");
    expect(html).not.toMatch(/<script|<img|http/);
  });

  it("pace line: lift and muscle only, never a bodyweight or empty goal", () => {
    const ctx: PaceContext = { t: (k) => k, fmt: (kg) => `${kg} kg`, exerciseName: "Bench", muscleName: (m) => m };
    expect(cardPaceLine({ kind: "none" }, ctx)).toBeNull();
    expect(cardPaceLine({ kind: "bodyweight", goal: { kind: "bodyweight", targetWeightKg: 80, targetDate: null }, pace: {} as never }, ctx)).toBeNull();
  });

  it("no bodyweight word anywhere on a card", () => {
    for (const lang of ["en", "ar"] as const) {
      const html = cardHtml(buildCardModel({ ...base, lang, next: { dayName: "A", targets: [target({})] } }));
      expect(html.toLowerCase()).not.toMatch(/bodyweight|body weight|وزن الجسم/);
    }
  });
});
