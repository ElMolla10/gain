import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useI18n } from "../i18n";

/**
 * The GAIN icon family: 24 px grid, 1.8 stroke, round caps and joins. The first twelve are the identity kit's SVGs (assets/icon-*.svg)
 * drawn with the same path data; `close`, `plus`, `minus`, `alert`, `phone`, `cloud`, `play` and `edit` are additions in the same style
 * (listed in docs/DESIGN.md). Icons are decoration: the label beside them carries the meaning, so they are hidden from TalkBack.
 * Direction arrows (`chevron`) mirror in right-to-left; the brand arrow, check, timer and charts never do.
 */
export type IconName =
  | "today" | "plan" | "progress" | "settings" | "dumbbell" | "timer" | "why" | "check" | "chevron" | "arrowUp" | "export" | "more"
  | "close" | "plus" | "minus" | "alert" | "phone" | "cloud" | "play" | "edit";

type Shape = { t: "p"; d: string } | { t: "c"; cx: number; cy: number; r: number } | { t: "r"; x: number; y: number; w: number; h: number; rx: number };
const p = (d: string): Shape => ({ t: "p", d });
const c = (cx: number, cy: number, r: number): Shape => ({ t: "c", cx, cy, r });

export const ICONS: Record<IconName, Shape[]> = {
  today: [p("M4 10 12 3l8 7v10h-6v-6h-4v6H4Z")],
  plan: [{ t: "r", x: 4, y: 5, w: 16, h: 16, rx: 2 }, p("M8 3v4m8-4v4M4 11h16m-12 4h2m4 0h2")],
  progress: [p("M4 4v16h16M7 15l4-4 4 2 5-7")],
  settings: [p("M4 7h16M4 17h16"), c(9, 7, 3), c(15, 17, 3)],
  dumbbell: [p("M8 12h8M5 7v10m3-12v14m8-14v14m3-12v10")],
  timer: [c(12, 13, 8), p("M9 2h6m-3 3V2m0 11V8m6-2 2-2")],
  why: [c(12, 12, 9), p("M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01")],
  check: [p("m5 12 4 4L19 6")],
  chevron: [p("m9 5 7 7-7 7")],
  arrowUp: [p("M12 20V4m-7 7 7-7 7 7")],
  export: [p("M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7")],
  more: [c(12, 5, 1), c(12, 12, 1), c(12, 19, 1)],
  close: [p("M6 6l12 12M18 6 6 18")],
  plus: [p("M12 5v14M5 12h14")],
  minus: [p("M5 12h14")],
  alert: [p("M12 3.5 2.8 19.5h18.4Z"), p("M12 10v4m0 3h.01")],
  phone: [p("M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Z"), p("M11 18.5h2")],
  cloud: [p("M7 18.5a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9a4.75 4.75 0 0 1 .5 9.5Z")],
  play: [p("M8 4.5v15l12-7.5Z")],
  edit: [p("M4 20h4L19 9l-4-4L4 16Z"), p("m13.5 6.5 4 4")],
};

export function Icon({ name, color, size = 24, mirror }: { name: IconName; color: string; size?: number; /** Flip in right-to-left (direction arrows only). */ mirror?: boolean }) {
  const { isRTL } = useI18n();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={mirror && isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name].map((s, i) => (s.t === "p" ? <Path key={i} d={s.d} /> : s.t === "c" ? <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} /> : <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} />))}
    </Svg>
  );
}
