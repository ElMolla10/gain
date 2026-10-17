import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Plan 2.10 (N-2, S-12, N-6): one title per screen, screen-reader hints, a taller tab bar at large text.
const dir = join(__dirname, "..", "src", "screens");
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const CHANGED = ["ProgrammeShareScreen", "PlateCalcScreen", "LiftersLedgerScreen", "GymsScreen", "GymEditScreen", "AchievementsScreen", "ExerciseLoadsScreen", "SessionDetailScreen", "LiftTrendView"];

describe("one title per screen", () => {
  it("no stack screen passes title= to <Screen> (only tab roots do)", () => {
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
      const s = readFileSync(join(dir, f), "utf8");
      for (const m of s.matchAll(/<Screen\b[^>]*>/g)) {
        if (/\btitle=/.test(m[0])) expect(m[0], f).toMatch(/\btab\b/);
      }
    }
  });
  it("the changed screens keep a single title: native header, plus a 20/26 exercise heading where the title was long", () => {
    for (const n of CHANGED) expect(src(`src/screens/${n}.tsx`)).not.toMatch(/<Screen[^>]*title=/);
    expect(src("src/screens/GymEditScreen.tsx")).toContain('nav.setOptions({ title: gymId ? t("gyms.edit") : t("gyms.add") })');
    expect(src("src/screens/SessionDetailScreen.tsx")).toContain("navigation.setOptions({ title: headerTitle })");
    for (const n of ["ExerciseLoadsScreen", "LiftTrendView"]) expect(src(`src/screens/${n}.tsx`)).toMatch(/<AppText accessibilityRole="header" style=\{\{ fontSize: ty\.section, fontWeight: "600" \}\}>/);
  });
  it("header title is 17 on iOS and 20 on Android", () => {
    expect(src("App.tsx")).toContain("fontSize: Platform.select({ ios: 17, default: 20 })");
  });
});

describe("screen-reader hints and the tab bar", () => {
  const ui = src("src/ui.tsx");
  it("ListRow and ListCard accept accessibilityHint and are buttons when pressable", () => {
    const row = ui.slice(ui.indexOf("export function ListRow"), ui.indexOf("export function ListRow") + 2500);
    expect(row).toContain("accessibilityHint?: string");
    expect(row).toContain('accessibilityRole="button" accessibilityLabel={props.accessibilityLabel} accessibilityHint={props.accessibilityHint}');
    const card = ui.slice(ui.indexOf("export function ListCard"), ui.indexOf("export function ListCard") + 800);
    expect(card).toContain('accessibilityRole="button" accessibilityHint={accessibilityHint}');
  });
  it("hints are passed where the destination is not obvious", () => {
    expect(src("src/screens/HistoryScreen.tsx")).toContain('accessibilityHint={t("history.sessionHint")}');
    expect(src("src/screens/HistoryScreen.tsx")).toContain('accessibilityHint={t("history.liftHint")}');
    expect(src("src/screens/ProgrammeScreen.tsx")).toContain('accessibilityHint={t("prog.workoutSettingsHint")}');
  });
  it("tab items grow to 64 dp above 1.2x text", () => {
    expect(src("App.tsx")).toContain("tabBarItemStyle: { minHeight: fontScale > 1.2 ? 64 : 56 }");
  });
});
