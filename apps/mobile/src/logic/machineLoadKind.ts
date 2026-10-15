import type { GymLoadSpec } from "@gain/engine";
import { plateMachineSteps, presetForExercise } from "./gymStepPreset";
import { parseStoredLoads, serializeLoads } from "./exerciseLoads";

export type MachineLoadKind = "pin" | "plate";

/** Stored beside the optional exercise weights so the choice survives backup and sync. */
export function explicitMachineKind(json: string | null): MachineLoadKind | null {
  try {
    const kind = json ? (JSON.parse(json) as { machineKind?: unknown }).machineKind : null;
    return kind === "pin" || kind === "plate" ? kind : null;
  } catch { return null; }
}

export function machineKind(json: string | null, name: string): MachineLoadKind {
  return explicitMachineKind(json) ?? (presetForExercise(name, "machine") ? "plate" : "pin");
}

export function machineLoads(json: string | null): GymLoadSpec | null {
  return parseStoredLoads(json, "machine") ?? (explicitMachineKind(json) === "plate" ? plateMachineSteps : null);
}

export function machineKindJson(kind: MachineLoadKind): string {
  return kind === "plate"
    ? JSON.stringify({ ...JSON.parse(serializeLoads(plateMachineSteps)), machineKind: kind })
    : JSON.stringify({ machineKind: kind });
}

export function loadsJsonWithKind(spec: GymLoadSpec | null, previous: string | null): string | null {
  const kind = explicitMachineKind(previous);
  if (!kind) return spec ? serializeLoads(spec) : null;
  return spec ? JSON.stringify({ ...JSON.parse(serializeLoads(spec)), machineKind: kind }) : JSON.stringify({ machineKind: kind });
}
