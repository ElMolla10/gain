import type { GymLoadSpec } from "@gain/engine";
import { plateMachineSteps, presetForExercise } from "./gymStepPreset";
import { parseStoredLoads, serializeLoads } from "./exerciseLoads";

export type MachineLoadKind = "pin" | "plate";
export type PinMachineStep = 2.5 | 5;
export const pinMachineSteps: GymLoadSpec = { equipment: "machine", increment: 5, min: 5 };
export const pinMachineSpec = (step: PinMachineStep): GymLoadSpec => ({ equipment: "machine", increment: step, min: step });

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

export function machinePinStep(json: string | null): PinMachineStep {
  try {
    const raw = json ? JSON.parse(json) as { pinStep?: unknown; increment?: unknown } : null;
    return raw?.pinStep === 2.5 || (explicitMachineKind(json) === "pin" && raw?.increment === 2.5) ? 2.5 : 5;
  } catch { return 5; }
}

export function machineLoads(json: string | null): GymLoadSpec | null {
  const own = parseStoredLoads(json, "machine");
  if (own) return own;
  const kind = explicitMachineKind(json);
  return kind === "plate" ? plateMachineSteps : kind === "pin" ? pinMachineSpec(machinePinStep(json)) : null;
}

export function machineKindJson(kind: MachineLoadKind, pinStep: PinMachineStep = 5): string {
  return JSON.stringify({ ...JSON.parse(serializeLoads(kind === "plate" ? plateMachineSteps : pinMachineSpec(pinStep))), machineKind: kind, ...(kind === "pin" ? { pinStep } : {}) });
}

export function loadsJsonWithKind(spec: GymLoadSpec | null, previous: string | null): string | null {
  const kind = explicitMachineKind(previous);
  if (!kind) return spec ? serializeLoads(spec) : null;
  const marker = kind === "pin" ? { machineKind: kind, pinStep: machinePinStep(previous) } : { machineKind: kind };
  return spec ? JSON.stringify({ ...JSON.parse(serializeLoads(spec)), ...marker }) : JSON.stringify(marker);
}
