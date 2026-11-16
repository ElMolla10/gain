import { exerciseDemoImageId } from "./exerciseDemos";

/** Coordinates are fractions of the ORIGINAL image, never the sheet or RTL layout. */
export type MotionPoint = readonly [number, number];
export type DemoMotionArrow = { from: MotionPoint; to: MotionPoint; controls?: readonly [MotionPoint, MotionPoint] };
export type DemoMotion = { width: number; height: number; arrows: readonly DemoMotionArrow[] };

// Individually placed after reviewing all 45 bundled stills. The path shows the moving body,
// implement or limb from the pictured pose; it is not a generic "up" instruction.
// See assets/exercise-demos/MOTION-REVIEW.md for the three intentionally unannotated images.
const MOTION_BY_IMAGE: Readonly<Record<string, DemoMotion>> = {
  "assisted-pull-up": { width: 768, height: 1024, arrows: [
    { from: [0.77, 0.60], to: [0.77, 0.36] },
  ] },
  "barbell-curl": { width: 886, height: 886, arrows: [
    { from: [0.72, 0.57], controls: [[0.86, 0.51], [0.85, 0.35]], to: [0.71, 0.29] },
  ] },
  "bench-press": { width: 1536, height: 512, arrows: [
    { from: [0.49, 0.16], to: [0.49, 0.46] },
  ] },
  "bent-over-row": { width: 990, height: 792, arrows: [
    { from: [0.66, 0.66], to: [0.55, 0.45] },
  ] },
  "biceps-curl": { width: 768, height: 1024, arrows: [
    { from: [0.31, 0.55], controls: [[0.24, 0.49], [0.25, 0.36]], to: [0.34, 0.31] },
    { from: [0.75, 0.55], controls: [[0.82, 0.49], [0.80, 0.36]], to: [0.70, 0.31] },
  ] },
  "bulgarian-split-squat": { width: 886, height: 886, arrows: [
    { from: [0.79, 0.46], to: [0.79, 0.68] },
  ] },
  "cable-crunch": { width: 768, height: 1024, arrows: [
    { from: [0.65, 0.35], controls: [[0.73, 0.40], [0.75, 0.51]], to: [0.68, 0.59] },
  ] },
  "cable-curl": { width: 768, height: 1024, arrows: [
    { from: [0.65, 0.58], controls: [[0.78, 0.53], [0.80, 0.39]], to: [0.67, 0.33] },
  ] },
  "cable-overhead-triceps-extension": { width: 886, height: 886, arrows: [
    { from: [0.49, 0.20], controls: [[0.47, 0.08], [0.62, 0.04]], to: [0.76, 0.09] },
  ] },
  "chest-press-machine": { width: 990, height: 792, arrows: [
    { from: [0.64, 0.38], to: [0.82, 0.38] },
  ] },
  "close-grip-bench-press": { width: 1024, height: 768, arrows: [
    { from: [0.72, 0.19], to: [0.72, 0.41] },
  ] },
  "deadlift": { width: 930, height: 844, arrows: [
    { from: [0.73, 0.72], to: [0.73, 0.42] },
  ] },
  "dips": { width: 768, height: 1024, arrows: [
    { from: [0.75, 0.39], to: [0.75, 0.57] },
  ] },
  "dumbbell-romanian-deadlift": { width: 886, height: 886, arrows: [
    { from: [0.68, 0.57], to: [0.70, 0.77] },
  ] },
  "dumbbell-row": { width: 970, height: 808, arrows: [
    { from: [0.65, 0.62], to: [0.56, 0.44] },
  ] },
  "dumbbell-shoulder-press": { width: 768, height: 1024, arrows: [
    { from: [0.25, 0.34], to: [0.29, 0.12] },
    { from: [0.75, 0.34], to: [0.70, 0.12] },
  ] },
  "dumbbell-shrug": { width: 768, height: 1024, arrows: [
    { from: [0.27, 0.34], to: [0.27, 0.26] },
    { from: [0.73, 0.34], to: [0.73, 0.26] },
  ] },
  "face-pulls": { width: 886, height: 886, arrows: [
    { from: [0.61, 0.21], controls: [[0.52, 0.22], [0.43, 0.22]], to: [0.36, 0.17] },
  ] },
  "front-squat": { width: 886, height: 886, arrows: [
    { from: [0.74, 0.46], to: [0.74, 0.72] },
  ] },
  "goblet-squat": { width: 886, height: 886, arrows: [
    { from: [0.71, 0.45], to: [0.71, 0.72] },
  ] },
  "hack-squat": { width: 886, height: 886, arrows: [
    { from: [0.65, 0.31], to: [0.77, 0.50] },
  ] },
  "hammer-curls": { width: 886, height: 886, arrows: [
    { from: [0.33, 0.55], controls: [[0.27, 0.46], [0.29, 0.37]], to: [0.37, 0.32] },
    { from: [0.68, 0.55], controls: [[0.75, 0.46], [0.73, 0.37]], to: [0.64, 0.32] },
  ] },
  "hip-thrusts": { width: 990, height: 792, arrows: [
    { from: [0.47, 0.74], to: [0.47, 0.55] },
  ] },
  "incline-bench-press": { width: 1536, height: 512, arrows: [
    { from: [0.50, 0.17], to: [0.52, 0.46] },
  ] },
  "incline-dumbbell-press": { width: 1024, height: 768, arrows: [
    { from: [0.60, 0.19], to: [0.62, 0.42] },
  ] },
  "lat-pulldown": { width: 886, height: 886, arrows: [
    { from: [0.30, 0.20], to: [0.30, 0.43] },
  ] },
  "lateral-raises": { width: 990, height: 792, arrows: [
    { from: [0.35, 0.58], controls: [[0.21, 0.56], [0.12, 0.43]], to: [0.13, 0.28] },
    { from: [0.68, 0.58], controls: [[0.82, 0.56], [0.91, 0.43]], to: [0.89, 0.28] },
  ] },
  "leg-extension": { width: 990, height: 792, arrows: [
    { from: [0.71, 0.82], controls: [[0.88, 0.81], [0.94, 0.70]], to: [0.92, 0.54] },
  ] },
  "leg-press": { width: 768, height: 1024, arrows: [
    { from: [0.84, 0.35], to: [0.66, 0.54] },
  ] },
  "machine-row": { width: 886, height: 886, arrows: [
    { from: [0.67, 0.42], to: [0.48, 0.40] },
  ] },
  "overhead-press": { width: 768, height: 1024, arrows: [
    { from: [0.80, 0.31], to: [0.80, 0.10] },
  ] },
  "pec-deck": { width: 886, height: 886, arrows: [
    { from: [0.20, 0.40], controls: [[0.25, 0.46], [0.35, 0.48]], to: [0.43, 0.40] },
    { from: [0.80, 0.40], controls: [[0.75, 0.46], [0.65, 0.48]], to: [0.57, 0.40] },
  ] },
  "pull-up": { width: 768, height: 1024, arrows: [
    { from: [0.73, 0.65], to: [0.73, 0.40] },
  ] },
  "rear-delt-fly": { width: 990, height: 792, arrows: [
    { from: [0.65, 0.59], controls: [[0.79, 0.56], [0.85, 0.42]], to: [0.84, 0.28] },
  ] },
  "romanian-deadlift": { width: 970, height: 808, arrows: [
    { from: [0.68, 0.58], to: [0.68, 0.79] },
  ] },
  "seated-cable-row": { width: 990, height: 792, arrows: [
    { from: [0.64, 0.43], to: [0.47, 0.40] },
  ] },
  "seated-calf-raise-machine": { width: 768, height: 1024, arrows: [
    { from: [0.32, 0.77], controls: [[0.29, 0.74], [0.29, 0.70]], to: [0.35, 0.68] },
  ] },
  "seated-leg-curl": { width: 940, height: 836, arrows: [
    { from: [0.92, 0.61], controls: [[0.93, 0.74], [0.80, 0.85]], to: [0.66, 0.81] },
  ] },
  "shoulder-press-machine": { width: 768, height: 1024, arrows: [
    { from: [0.27, 0.36], controls: [[0.25, 0.29], [0.28, 0.20]], to: [0.34, 0.14] },
    { from: [0.78, 0.36], controls: [[0.80, 0.29], [0.77, 0.20]], to: [0.71, 0.14] },
  ] },
  "squat": { width: 768, height: 1024, arrows: [
    { from: [0.67, 0.47], to: [0.67, 0.68] },
  ] },
  "straight-arm-pulldown": { width: 940, height: 836, arrows: [
    { from: [0.68, 0.30], controls: [[0.77, 0.44], [0.68, 0.57]], to: [0.54, 0.63] },
  ] },
  "tricep-pushdowns": { width: 768, height: 1024, arrows: [
    { from: [0.64, 0.40], controls: [[0.72, 0.45], [0.70, 0.54]], to: [0.62, 0.60] },
  ] },
};

export function exerciseDemoMotion(seedKey: string | null | undefined): DemoMotion | null {
  const imageId = exerciseDemoImageId(seedKey);
  return imageId ? MOTION_BY_IMAGE[imageId] ?? null : null;
}

/** One static path including its open arrowhead, tangent to the end of a straight line or cubic arc. */
export function demoArrowPath(arrow: DemoMotionArrow, width: number, height: number): string {
  const project = ([x, y]: MotionPoint) => [x * width, y * height] as const;
  const start = project(arrow.from);
  const end = project(arrow.to);
  const controls = arrow.controls?.map(project);
  const beforeEnd = controls?.[1] ?? start;
  const dx = end[0] - beforeEnd[0], dy = end[1] - beforeEnd[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length;
  const head = Math.max(width, height) * 0.025;
  const n = (v: number) => Number(v.toFixed(2));
  const point = (p: readonly number[]) => p.map(n).join(" ");
  const shaft = controls ? `C ${point(controls[0]!)} ${point(controls[1]!)} ${point(end)}` : `L ${point(end)}`;
  const left = [end[0] - head * ux - head * 0.55 * uy, end[1] - head * uy + head * 0.55 * ux];
  const right = [end[0] - head * ux + head * 0.55 * uy, end[1] - head * uy - head * 0.55 * ux];
  return `M ${point(start)} ${shaft} M ${point(left)} L ${point(end)} L ${point(right)}`;
}
