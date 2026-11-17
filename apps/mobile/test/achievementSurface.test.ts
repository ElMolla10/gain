import { describe, expect, it } from "vitest";
import type { AchievementEvidence, AchievementFamily } from "@gain/engine";
import { LRI, PDI, translate } from "../src/i18n/format";
import { evidenceLine } from "../src/logic/achievementEvidence";
import {
  buildCabinet,
  DEFAULT_SHARE_PRIVACY,
  evidenceSheetContent,
  filterCabinet,
  formatShareCard,
  ledgerItems,
  pickHero,
  pickNextUp,
  prestigeForBadge,
  shareCardCopy,
  type SurfaceBadge,
} from "../src/logic/achievementSurface";

function badge(partial: Partial<SurfaceBadge> & Pick<SurfaceBadge, "id" | "badgeId">): SurfaceBadge {
  const family: AchievementFamily =
    partial.family ??
    (partial.badgeId.startsWith("qualified_weeks")
      ? "qualified_weeks"
      : partial.badgeId === "strength_pr"
        ? "strength_pr"
        : partial.badgeId === "comeback"
          ? "comeback"
          : "first_session");
  return {
    i18nKey: partial.i18nKey ?? "achv.firstSession",
    family,
    status: partial.status ?? "earned",
    earnedAtUtc: partial.earnedAtUtc ?? 1,
    earnedLocalDate: partial.earnedLocalDate ?? "2026-01-05",
    primarySessionId: partial.primarySessionId ?? "s1",
    evidence: partial.evidence ?? null,
    progressCurrent: partial.progressCurrent ?? null,
    progressTarget: partial.progressTarget ?? null,
    isBackfilled: partial.isBackfilled ?? false,
    exerciseNameEn: partial.exerciseNameEn ?? null,
    exerciseNameAr: partial.exerciseNameAr ?? null,
    ...partial,
    id: partial.id,
    badgeId: partial.badgeId,
  };
}

const prEvidence = (loadDelta = 2.5, repsDelta = 0): AchievementEvidence => ({
  kind: "strength_pr",
  path: "A",
  identity: { exerciseId: "ex1", equipment: "barbell", setup: "free" },
  previousBest: { setId: "a", sessionId: "s0", load: 60, reps: 8, localDate: "2026-01-05" },
  newBest: { setId: "b", sessionId: "s1", load: 60 + loadDelta, reps: 8 + repsDelta, localDate: "2026-01-12" },
  deltas: { load: loadDelta, reps: repsDelta, e1rmPct: 0.04 },
});

describe("hero selection priority", () => {
  it("picks Long Horizon over Consistent Year over Verified PR over other", () => {
    const rows = [
      badge({ id: "a", badgeId: "first_session", i18nKey: "achv.firstSession" }),
      badge({ id: "b", badgeId: "strength_pr", i18nKey: "achv.strengthPr" }),
      badge({ id: "c", badgeId: "consistent_year", i18nKey: "achv.weeks12" }),
      badge({ id: "d", badgeId: "long_horizon", i18nKey: "achv.weeks12" }),
    ];
    expect(pickHero(rows).hero?.badgeId).toBe("long_horizon");
    expect(pickHero(rows.filter((r) => r.badgeId !== "long_horizon")).hero?.badgeId).toBe("consistent_year");
    expect(pickHero(rows.filter((r) => r.badgeId === "first_session" || r.badgeId === "strength_pr")).hero?.badgeId).toBe("strength_pr");
    expect(pickHero(rows.filter((r) => r.badgeId === "first_session")).hero?.badgeId).toBe("first_session");
  });

  it("picks a verified PR over a 12-week badge (weeks are other, not long horizon)", () => {
    const rows = [
      badge({ id: "w", badgeId: "qualified_weeks_12", i18nKey: "achv.weeks12" }),
      badge({ id: "p", badgeId: "strength_pr", i18nKey: "achv.strengthPr" }),
    ];
    const picked = pickHero(rows);
    expect(picked.hero?.badgeId).toBe("strength_pr");
    expect(picked.rest.map((r) => r.badgeId)).toEqual(["qualified_weeks_12"]);
  });

  it("skips backfilled rows and returns null when nothing live unlocked", () => {
    expect(pickHero([badge({ id: "a", badgeId: "first_session", isBackfilled: true })]).hero).toBeNull();
    expect(pickHero([]).hero).toBeNull();
  });

  it("breaks a same-class tie with catalog order", () => {
    const picked = pickHero([
      badge({ id: "c", badgeId: "comeback", i18nKey: "achv.comeback" }),
      badge({ id: "a", badgeId: "first_session", i18nKey: "achv.firstSession" }),
    ]);
    expect(picked.hero?.badgeId).toBe("first_session");
    expect(picked.rest.map((r) => r.badgeId)).toEqual(["comeback"]);
  });
});

describe("collection Cabinet filtering",()=>{
 it("provides exactly 21 permanent slots, keeps earned legacy and PR records, and hides retired locked goals",()=>{
  const cab=buildCabinet([badge({id:"first",badgeId:"first_workout"}),badge({id:"legacy",badgeId:"workhorse"}),badge({id:"pr",badgeId:"strength_pr_v2"})]);
  expect(cab).toHaveLength(23);expect(cab.filter(r=>r.status==="locked")).toHaveLength(20);
  expect(filterCabinet(cab,"earned","all")).toHaveLength(3);
  expect(cab.some(r=>r.badgeId==="multi_year_2")).toBe(false);
 });
 it("picks measured canonical milestones only",()=>{
  expect(pickNextUp([{badgeId:"showing_up_4",current:2,target:4},{badgeId:"dedicated_days_10",current:4,target:10},{badgeId:"workhorse",current:2,target:3}],[]).map(x=>x.badgeId)).toEqual(["showing_up_4","dedicated_days_10"]);
 });
});

describe("evidence-sheet content", () => {
  it("returns the first-session rule, supporting workout, and no next tier", () => {
    const sheet = evidenceSheetContent({ badgeId: "first_session", primarySessionId: "s1", qualifiedWeeksLifetime: 0, weeks12Earned: false });
    expect(sheet.ruleKey).toBe("achv.rule.firstSession");
    expect(sheet.ruleParams).toEqual({ sets: 3 });
    expect(sheet.supportingSessionId).toBe("s1");
    expect(sheet.nextTier).toBeNull();
  });

  it("points 4-week toward 12-week progress until that tier is earned", () => {
    const open = evidenceSheetContent({ badgeId: "qualified_weeks_4", primarySessionId: "s4", qualifiedWeeksLifetime: 6, weeks12Earned: false });
    expect(open.ruleKey).toBe("achv.rule.weeks");
    expect(open.nextTier).toEqual({ badgeId: "qualified_weeks_12", i18nKey: "achv.weeks12", current: 6, target: 12 });
    expect(evidenceSheetContent({ badgeId: "qualified_weeks_4", primarySessionId: "s4", qualifiedWeeksLifetime: 12, weeks12Earned: true }).nextTier).toBeNull();
    expect(evidenceSheetContent({ badgeId: "qualified_weeks_12", primarySessionId: "s12", qualifiedWeeksLifetime: 12, weeks12Earned: true }).nextTier).toBeNull();
  });

  it("states the verified-PR rule and keeps the supporting session", () => {
    const sheet = evidenceSheetContent({ badgeId: "strength_pr", primarySessionId: "s9", qualifiedWeeksLifetime: 4, weeks12Earned: false });
    expect(sheet.ruleKey).toBe("achv.rule.pr");
    expect(sheet.supportingSessionId).toBe("s9");
    expect(sheet.nextTier).toBeNull();
  });
});

describe("privacy-first share card", () => {
  const pr = badge({
    id: "p",
    badgeId: "strength_pr",
    i18nKey: "achv.strengthPr",
    evidence: prEvidence(2.5, 0),
    exerciseNameEn: "Bench Press",
    exerciseNameAr: "بنش برس",
  });

  it("omits absolute weight until the lifter turns it on, in English and Arabic", () => {
    const offEn = shareCardCopy(pr, { privacy: DEFAULT_SHARE_PRIVACY, lang: "en", unit: "kg", t: (k, p) => translate("en", k, p) });
    expect(offEn.title).toBe("Verified strength PR");
    expect(offEn.exercise).toBe("Bench Press");
    expect(offEn.delta).toBe("Heavier than last verified best");
    expect(offEn.delta).not.toMatch(/\d/);
    const onEn = shareCardCopy(pr, { privacy: { ...DEFAULT_SHARE_PRIVACY, absoluteWeight: true }, lang: "en", unit: "kg", t: (k, p) => translate("en", k, p) });
    expect(onEn.delta).toContain("62.5");
    expect(onEn.delta).toContain("×");
    const offAr = shareCardCopy(pr, { privacy: DEFAULT_SHARE_PRIVACY, lang: "ar", unit: "kg", t: (k, p) => translate("ar", k, p) });
    expect(offAr.title).toMatch(/[\u0600-\u06FF]/);
    expect(offAr.exercise).toBe("بنش برس");
    expect(offAr.delta).toMatch(/[\u0600-\u06FF]/);
    expect(offAr.delta).not.toMatch(/\d/);
  });

  it("never adds bodyweight, gym, or the full log even when those toggles are on", () => {
    const card = formatShareCard(
      shareCardCopy(pr, {
        privacy: { absoluteWeight: false, bodyweight: true, gymLocation: true, fullLog: true },
        lang: "en",
        unit: "kg",
        t: (k, p) => translate("en", k, p),
      }),
    );
    expect(card).toBe("Verified strength PR\nBench Press\nHeavier than last verified best");
    expect(card.toLowerCase()).not.toMatch(/gym|body|kg|log|set 1/);
  });
});

describe("Arabic plurals and isolates", () => {
  it("uses the dual week form and isolates the count", () => {
    const line = evidenceLine(
      { kind: "qualified_weeks", tier: 4, lifetimeCount: 2, consecutiveRun: 2, weekStart: "2026-03-02", sessionId: "s1" },
      (k, p) => translate("ar", k, p),
      "ar",
      "kg",
      { nameEn: null, nameAr: null },
    );
    expect(line).toContain("أسبوعان");
    expect(line).toContain(`${LRI}2${PDI}`);
    expect(line).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("unknown achievement IDs",()=>{
 it("does not claim the PR rule for an unknown award",()=>{
  expect(evidenceSheetContent({badgeId:"unknown",primarySessionId:null,qualifiedWeeksLifetime:0,weeks12Earned:false}).ruleKey).toBe("collection.rule.unknown");
 });
});
