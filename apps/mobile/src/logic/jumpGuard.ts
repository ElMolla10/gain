/**
 * P04: confirm before a big load jump. A proposed load more than `thresholdPct` (default 10%) above what the lifter did last time is not
 * applied silently: the lifter confirms it or picks a smaller step (repeat the load, add a rep, or a microload). Pure; loads are kg.
 */
export const DEFAULT_JUMP_CONFIRM_PCT = 10;
export const JUMP_SETTING_KEY = "jump_confirm_pct";

export type JumpAlternativeKind = "repeat" | "reps" | "microload";
export interface JumpAlternative {
  kind: JumpAlternativeKind;
  load: number;
  reps: number;
}
export interface JumpCheck {
  needsConfirm: boolean;
  /** Increase over the previous load, in percent (one decimal). 0 when there is nothing to compare. */
  pct: number;
  alternatives: JumpAlternative[];
}

export function jumpPct(prevLoad: number, nextLoad: number): number {
  if (!(prevLoad > 0) || !Number.isFinite(nextLoad)) return 0;
  return Math.round(((nextLoad - prevLoad) / prevLoad) * 1000) / 10;
}

/** The lifter's threshold from the stored setting: a number 1-100, "0" switches the check off, anything else is the default. */
export function parseJumpThreshold(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_JUMP_CONFIRM_PCT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_JUMP_CONFIRM_PCT;
}

export function checkJump(i: {
  prevLoad: number | null;
  prevReps: number | null;
  targetLoad: number | null;
  targetReps: number | null;
  /** Only free-weight style loads: for assisted / bodyweight setups a share of "the load" is not meaningful. */
  setup: string;
  thresholdPct?: number;
  /** The smallest real step above the previous load (null when unknown). Offered only when it is smaller than the proposed jump. */
  microLoad?: number | null;
}): JumpCheck {
  const none: JumpCheck = { needsConfirm: false, pct: 0, alternatives: [] };
  const threshold = i.thresholdPct ?? DEFAULT_JUMP_CONFIRM_PCT;
  if (threshold <= 0 || i.setup !== "free") return none;
  if (i.prevLoad === null || i.targetLoad === null || !(i.prevLoad > 0) || !(i.targetLoad > i.prevLoad)) return none;
  const pct = jumpPct(i.prevLoad, i.targetLoad);
  if (!(pct > threshold + 1e-9)) return { ...none, pct };
  const reps = i.prevReps ?? i.targetReps ?? 1;
  const alternatives: JumpAlternative[] = [
    { kind: "repeat", load: i.prevLoad, reps },
    { kind: "reps", load: i.prevLoad, reps: reps + 1 },
  ];
  const micro = i.microLoad ?? null;
  if (micro !== null && micro > i.prevLoad + 1e-9 && micro < i.targetLoad - 1e-9) alternatives.push({ kind: "microload", load: micro, reps });
  return { needsConfirm: true, pct, alternatives };
}

export interface JumpOption {
  kind: "anyway" | JumpAlternativeKind;
  load: number;
  reps: number;
  label: string;
}

/** The choices shown in the confirmation: the proposed jump first ("anyway"), then the smaller steps. `fmtLoad` formats kg in the lifter's unit. */
export function jumpOptions(
  check: JumpCheck,
  target: { load: number; reps: number },
  t: (key: "jump.anyway" | "jump.repeat" | "jump.reps" | "jump.micro", params: { load: string; reps: number }) => string,
  fmtLoad: (kg: number) => string,
): JumpOption[] {
  const key = { repeat: "jump.repeat", reps: "jump.reps", microload: "jump.micro" } as const;
  return [
    { kind: "anyway", load: target.load, reps: target.reps, label: t("jump.anyway", { load: fmtLoad(target.load), reps: target.reps }) },
    ...check.alternatives.map((a) => ({ kind: a.kind, load: a.load, reps: a.reps, label: t(key[a.kind], { load: fmtLoad(a.load), reps: a.reps }) })),
  ];
}
