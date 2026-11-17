import type { BadgeDefinition } from "./achievements";

/** Permanent collection v2. Thresholds and artwork keys are owned here. */
export const COLLECTION_VERSION = 2;
export const COLLECTION_TIERS = {
  first_workout: [1], showing_up: [4, 12, 26, 52], dedicated_days: [10, 25, 50, 100],
  first_pr: [1], across_the_board: [3, 5, 10], called_it: [1], back_at_it: [1],
  lifetime_plate: [10, 50, 100, 250, 500, 1000],
} as const;
export type CollectionFamily = keyof typeof COLLECTION_TIERS;
const families: Record<CollectionFamily, BadgeDefinition["family"]> = {
  first_workout: "first_session", showing_up: "qualified_weeks", dedicated_days: "dedicated",
  first_pr: "strength_pr", across_the_board: "across_the_board", called_it: "pin_target",
  back_at_it: "comeback", lifetime_plate: "hundred_club",
};
export interface CollectionDefinition extends BadgeDefinition {
  artFamily: CollectionFamily;
  requirementKey: string;
  category: "medal" | "plate";
}
export const COLLECTION_CATALOG: readonly CollectionDefinition[] = (Object.keys(COLLECTION_TIERS) as CollectionFamily[]).flatMap(artFamily =>
  COLLECTION_TIERS[artFamily].map(tier => {
    const id = COLLECTION_TIERS[artFamily].length === 1 ? artFamily : `${artFamily}_${tier}`;
    return { id, version: COLLECTION_VERSION, family: families[artFamily], tier, artFamily,
      i18nKey: `collection.${id}`, requirementKey: `collection.rule.${artFamily}`, category: artFamily === "lifetime_plate" ? "plate" : "medal" };
  }));
export const COLLECTION_IDS = new Set(COLLECTION_CATALOG.map(x => x.id));
export const MEDAL_IDS = new Set(COLLECTION_CATALOG.filter(x => x.category === "medal").map(x => x.id));
export const PLATE_IDS = new Set(COLLECTION_CATALOG.filter(x => x.category === "plate").map(x => x.id));
export const collectionDefinition = (id: string): CollectionDefinition | undefined => COLLECTION_CATALOG.find(x => x.id === id);
