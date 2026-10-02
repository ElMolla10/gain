import { classifyLift, resolveProgression, type RepCeilings } from "@gain/engine";

/** The default rep ceiling (top of the range) for a lift by name, from the progression policy and the lifter's app-wide ceilings. */
export function ceilingForName(nameEn: string, ceilings: RepCeilings): number {
  return resolveProgression(classifyLift(nameEn).bodyRegion, {}, { name: nameEn, ceilings }).repCeiling;
}
