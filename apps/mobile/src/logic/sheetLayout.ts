// Pure layout rules for sheets and collapsible cards (no React Native import, so tests can check them).

/** Height cap of a ChoiceSheet's option list: about 60% of the screen, so the bottom options stay within thumb reach (T-8). */
export const choiceListMaxHeight = (screenHeight: number): number => Math.round(screenHeight * 0.6);

/**
 * True when a collapsible's measured content has something to show. A card whose children all render nothing is not drawn at all
 * (no empty "This week" shell).
 */
export const hasCollapsibleContent = (measuredHeight: number): boolean => measuredHeight > 0.5;
