// Pure layout rules for sheets and collapsible cards (no React Native import, so tests can check them).

/** Height cap of a ChoiceSheet's option list: about 60% of the screen, so the bottom options stay within thumb reach (T-8). */
export const choiceListMaxHeight = (screenHeight: number): number => Math.round(screenHeight * 0.6);

/**
 * True when a collapsible's measured content has something to show. A card whose children all render nothing is not drawn at all
 * (no empty "This week" shell).
 */
export const hasCollapsibleContent = (measuredHeight: number): boolean => measuredHeight > 0.5;

/** A sheet opens at its content height up to 60% of the screen (thumb reach, N-3); dragged up it may grow to 90%. */
export const sheetMaxHeight = (screenHeight: number, expanded: boolean): number => Math.round(screenHeight * (expanded ? 0.9 : 0.6));

/** How far (dp) or how fast an upward drag on the handle must go to expand; a short downward drag from expanded returns to 60%. */
export const SHEET_EXPAND_DRAG = 60;
export const SHEET_COLLAPSE_DRAG = 40;

/**
 * What a released drag on the sheet's handle does. Up past the threshold (or a fast flick up) expands; from expanded, a short drag
 * down returns to 60%; a long drag or a fast flick down dismisses (the #233 rule, `dismiss` = past 30% of the card or vy > 1).
 */
export function sheetRelease(dy: number, vy: number, expanded: boolean, dismiss: boolean): "expand" | "collapse" | "dismiss" | "stay" {
  if (dy < 0) return !expanded && (dy <= -SHEET_EXPAND_DRAG || vy < -1) ? "expand" : "stay";
  if (expanded) return dismiss && dy > SHEET_COLLAPSE_DRAG * 4 ? "dismiss" : dy > SHEET_COLLAPSE_DRAG || vy > 1 ? "collapse" : "stay";
  return dismiss ? "dismiss" : "stay";
}
