import { weightText, type Unit } from "./units";

export type JumpPart =
  | { kind: "load"; dir: "harder" | "easier"; deltaKg: number }
  | { kind: "effort"; rir: number }
  | { kind: "quality"; change: "pause" | "slow_eccentric" | "extra_set" }
  | { kind: "unknown"; raw: string };

/** Parse the engine's jump kind string (`load:harder:2.5`, `effort:rir1`, `quality:pause`). Never throws. */
export function parseJumpKind(kind: string): JumpPart {
  const load = /^load:(harder|easier):(\d+(?:\.\d+)?)$/.exec(kind);
  if (load) return { kind: "load", dir: load[1] as "harder" | "easier", deltaKg: Number(load[2]) };
  const eff = /^effort:rir(\d+(?:\.\d+)?)$/.exec(kind);
  if (eff) return { kind: "effort", rir: Number(eff[1]) };
  const q = /^quality:(pause|slow_eccentric|extra_set)$/.exec(kind);
  if (q) return { kind: "quality", change: q[1] as "pause" | "slow_eccentric" | "extra_set" };
  return { kind: "unknown", raw: kind };
}

type T = (key: never, params?: Record<string, string | number>) => string;

/** Plain-language text for a jump kind, in the lifter's unit. `t` is the i18n translate function. */
export function jumpKindText(kind: string, unit: Unit, t: (key: string, params?: Record<string, string | number>) => string): string {
  const j = parseJumpKind(kind);
  const tr = t as unknown as T;
  switch (j.kind) {
    case "load":
      return tr((j.dir === "harder" ? "stop.jump.heavier" : "stop.jump.lighter") as never, { delta: `${weightText(j.deltaKg, unit)} ${unit}` });
    case "effort":
      return tr("stop.jump.effort" as never, { rir: j.rir });
    case "quality":
      return tr(`stop.jump.${j.change}` as never);
    default:
      return j.raw;
  }
}
