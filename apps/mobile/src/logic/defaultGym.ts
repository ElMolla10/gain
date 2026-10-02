import type { GymLoadSpec } from "@gain/engine";
import { unitToKg, type Unit } from "./units";

/**
 * The gym onboarding creates silently, and the "standard loads" the gym editor can fill in. Standard defaults for a typical
 * commercial gym, NOT a measurement of the lifter's gym: the lifter refines them in the Gym tab.
 * Always returned in kilograms (the engine's unit), already snapped to the unit's friendly numbers:
 *  - kg: 2.5 kg barbell steps from a 20 kg bar, dumbbells 5-50 kg in 2.5 kg steps (up to 35, then 5), 5 kg cable / machine / assist jumps.
 *  - lb: 5 lb barbell steps from a 45 lb bar (2.5 lb plates each side), dumbbells 5-100 lb in 5 lb steps, 5 lb cable jumps,
 *        10 lb machine / assist jumps, 2.5 lb added-load plates.
 */
export function defaultGymLoads(unit: Unit): GymLoadSpec[] {
  if (unit === "lb") {
    const k = (lb: number) => unitToKg(lb, "lb");
    const range = (a: number, b: number, step: number) => {
      const out: number[] = [];
      for (let x = a; x <= b + 1e-9; x += step) out.push(k(x));
      return out;
    };
    return [
      { equipment: "dumbbell", loads: range(5, 100, 5) },
      { equipment: "barbell", increment: k(5), min: k(45), max: k(600) },
      { equipment: "plate", increment: k(2.5), min: k(2.5), max: k(135) },
      { equipment: "cable", increment: k(5), min: k(5), max: k(220) },
      { equipment: "machine", increment: k(10), min: k(10), max: k(350) },
      { equipment: "assisted", increment: k(10), min: 0, max: k(150) },
    ];
  }
  return [
    { equipment: "dumbbell", loads: [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 40, 45, 50] },
    { equipment: "barbell", increment: 2.5, min: 20, max: 200 },
    { equipment: "plate", increment: 2.5, min: 2.5, max: 60 },
    { equipment: "cable", increment: 5, min: 5, max: 100 },
    { equipment: "machine", increment: 5, min: 5, max: 160 },
    { equipment: "assisted", increment: 5, min: 0, max: 70 },
  ];
}

/** Name of the gym onboarding creates. Arabic is a draft. */
export const defaultGymName = (lang: "en" | "ar"): string => (lang === "ar" ? "الجيم بتاعي" : "My gym");
