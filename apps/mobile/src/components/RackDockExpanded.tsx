import React from "react";
import { HERO_H } from "../logic/barArt";
import type { HeroWarmupStep } from "../logic/todayHero";
import type { Unit } from "../logic/units";
import { Sheet } from "../ui";
import { BarArt } from "./today/BarArt";
import { LoadPath } from "./today/LoadPath";
import { PlateEngraving } from "./today/PlateEngraving";

export interface ExpandInfo {
  title: string;
  perSide: number[];
  unit: Unit;
  /** The warm-up ramp before the first working set ([] once a work set is logged, or when none is offered). */
  warmups: HeroWarmupStep[];
  work: HeroWarmupStep;
  skippedHint: boolean;
}

/**
 * The expanded dock (spec §2.1): the Today hero bar with its engraving, plus the load path before the first working set. It is the app's
 * existing Sheet (list dimmed behind, swipe down / scrim / Close, Android back, Reduce Motion), not a new modal.
 */
export function RackDockExpanded({ info, onClose }: { info: ExpandInfo; onClose: () => void }) {
  return (
    <Sheet visible title={info.title} onClose={onClose}>
      <BarArt perSide={info.perSide} unit={info.unit} height={HERO_H} />
      <PlateEngraving perSide={info.perSide} />
      {info.warmups.length > 0 ? <LoadPath steps={info.warmups} work={info.work} skippedHint={info.skippedHint} onClose={onClose} /> : null}
    </Sheet>
  );
}
