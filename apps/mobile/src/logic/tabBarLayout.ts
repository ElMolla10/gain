import { scaleFor } from "../fonts";

export const TAB_LABEL_MAX_SCALE = 1.4;
export const TAB_ICON_HEIGHT = 32;
// BottomTabItem's vertical UIKit button has 5 dp of padding above and below its children.
const ITEM_VERTICAL_PADDING = 10;
const BORDER_HEIGHT = 1;
const TOP_PADDING = 4;

/** Budget for the actual icon and scaled AppText, including the bottom safe area exactly once. */
export function tabBarLayout(fontScale: number, bottomInset: number, arabic: boolean) {
  const scale = Math.min(TAB_LABEL_MAX_SCALE, Math.max(1, fontScale));
  // The four short labels fit one line at standard size; large text gets room to wrap to two.
  const labelLines = fontScale > 1.2 ? 2 : 1;
  const labelHeight = Math.ceil(scaleFor(13, arabic).lineHeight * scale * labelLines);
  const itemHeight = TAB_ICON_HEIGHT + labelHeight + ITEM_VERTICAL_PADDING;
  return {
    height: BORDER_HEIGHT + TOP_PADDING + itemHeight + bottomInset,
    itemHeight,
    paddingTop: TOP_PADDING,
  };
}
