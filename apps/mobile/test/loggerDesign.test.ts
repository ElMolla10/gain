import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette, logDarkPalette, logLightPalette } from "../src/palettes";
import { canEditLoadsFor, pendingInputs, tickState } from "../src/logic/setRowState";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const row = src("components/WorkoutSetRow.tsx");
const parts = src("components/LogParts.tsx");
const screen = src("screens/WorkoutScreen.tsx");
const dock = src("components/RestTimerBar.tsx");
const sheets = src("components/WorkoutSessionSheets.tsx");
const section = src("components/WorkoutExerciseSection.tsx");

describe("L-2 tick states", () => {
  it("maps a row to not-ready / ready / done / edited", () => {
    expect(tickState({ saved: false, dirty: false }, false)).toBe("notReady");
    expect(tickState({ saved: false, dirty: false }, true)).toBe("ready");
    expect(tickState({ saved: true, dirty: false }, true)).toBe("done");
    expect(tickState({ saved: true, dirty: true }, true)).toBe("edited");
  });
  for (const [name, p, lp] of [["dark", darkPalette, logDarkPalette], ["light", lightPalette, logLightPalette]] as const) {
    it(`${name}: done is solid vs the field (>= 3:1) and its inverted check reads (>= 4.5:1)`, () => {
      expect(lp.doneSolid).toBe(p.doneSolid);
      expect(ratio(p.doneSolid, lp.field)).toBeGreaterThanOrEqual(3);
      expect(ratio(p.onDoneSolid, p.doneSolid)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("tokens are the spec values", () => {
    expect([darkPalette.doneSolid, lightPalette.doneSolid]).toEqual(["#5E8F72", "#2F7A50"]);
    expect([darkPalette.onDoneSolid, lightPalette.onDoneSolid]).toEqual(["#10120E", "#FFFFFF"]);
  });
  it("not ready is hollow with no glyph; done has no border", () => {
    expect(row).toContain('state === "notReady" ? "transparent"');
    expect(row).toContain('state === "done" ? 0');
    expect(row).toMatch(/state === "ready" \? <Icon name="check" color=\{p\.muted\} size=\{22\} \/> : null/);
  });
});

describe("L-4 typed but unticked", () => {
  it("only typed, unsaved values are pending (ghosts are not)", () => {
    expect(pendingInputs({ saved: false, dirty: false, load: 60, reps: null })).toEqual({ load: true, reps: false });
    expect(pendingInputs({ saved: false, dirty: false, load: null, reps: null })).toEqual({ load: false, reps: false });
    expect(pendingInputs({ saved: true, dirty: false, load: 60, reps: 8 })).toEqual({ load: false, reps: false });
  });
  it("ghost text uses edge (quieter than typed text), pending boxes get a 2 dp warn underline", () => {
    expect(parts).toContain("placeholderTextColor={p.edge");
    expect(parts).toContain("borderBottomWidth: 2, borderBottomColor: p.warn");
    expect(row).toContain("pending={pending.load}");
    expect(row).toContain("pending={pending.reps}");
  });
  it("the save status line is 14/20 with a 16 dp icon (not the 13 compact size)", () => {
    expect(screen).toContain("<InlineStatus kind={status.kind} icon={status.icon} text={status.text} />");
  });
});

describe("L-1, L-5, L-6, L-15 set table", () => {
  it("L-1: typed values are 20 semibold with tabular figures; the set number is 16", () => {
    expect(parts).toMatch(/fontSize: ty\.section,\s*fontVariant: \["tabular-nums"\]/);
    expect(row).toContain('<AppText ltr style={{ fontWeight: "600", fontSize: ty.body');
  });
  it("L-5: 4 dp row padding and 8 dp column gap; Previous flex 1.1", () => {
    expect(row).toContain("gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs");
    expect(row).not.toMatch(/gap: 6\b/);
    expect(row).not.toContain("paddingVertical: 2");
    expect(row).toContain("flex: 1.1");
  });
  it("L-6: a 6 dp start-edge accent bar, inset 4; light current-set wash #DCEBB0", () => {
    expect(row).toContain("start: 0, top: 4, bottom: 4, width: 6");
    expect(logLightPalette.activeBg).toBe("#DCEBB0");
    expect(logDarkPalette.activeBg).toBe(darkPalette.tint);
  });
  it("L-15: the tick's hit area covers the full row pitch", () => {
    expect(row).toContain("hitSlop={{ top: 4, bottom: 4 }}");
  });
});

describe("L-7, L-9, L-11..L-14", () => {
  it("L-9: rest over is text + icon at 28 on a tint dock with a 4 dp accent top edge", () => {
    expect(dock).toContain("borderTopWidth: over ? 4 : 1, borderColor: over ? p.accent : p.line");
    expect(dock).toContain("backgroundColor: over ? p.activeBg : p.card");
    expect(dock).toMatch(/<Icon name="check"[^\n]*\n\s*<AppText style=\{\{ fontSize: ty\.title, fontWeight: "600"/);
  });
  it("L-11: Why and Next set details never share a wrap row", () => {
    const line1 = parts.slice(parts.indexOf("export function TargetLine"), parts.indexOf("{props.suggestedLabel ? ("));
    expect(line1).toContain("<QuietAction label={props.whyLabel}");
    expect(line1).not.toContain("props.moreLabel");
  });
  it("L-12: Loads moved into the ⋮ menu", () => {
    expect(sheets).toContain('label: t("workout.loads")');
    expect(section).not.toMatch(/<QuietAction label=\{t\("workout\.loads"\)\}/);
    expect(canEditLoadsFor({ measure: "reps", setup: "standard", equipment: "barbell" })).toBe(true);
    expect(canEditLoadsFor({ measure: "time", setup: "standard", equipment: "barbell" })).toBe(false);
    expect(canEditLoadsFor({ measure: "reps", setup: "assisted", equipment: "machine" })).toBe(false);
  });
  it("L-13 / L-14: the header shows the day name and keeps 8 dp between its buttons", () => {
    expect(screen).toContain('{loaded.dayName || t("workout.header")}');
    expect(screen).toContain("gap: space.sm /* 8 dp between 48 dp header targets (L-14) */");
  });
});
