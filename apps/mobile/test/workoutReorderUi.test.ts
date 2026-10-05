import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (file: string) => readFileSync(join(__dirname, "..", "src", file), "utf8");
const screen = src("screens/WorkoutScreen.tsx");
const parts = src("components/LogParts.tsx");

describe("mid-workout reorder controls", () => {
  it("moves from the bottom exercise menu with TalkBack labels, not a drag gesture", () => {
    expect(screen).toContain("buildMoveActions(order, exState, completedSlots, menuEx.slot");
    expect(screen).toContain("moveExerciseToday(menuEx.slot, action.direction)");
    expect(screen).toContain('t(direction === "up" ? "workout.move.upA11y" : "workout.move.downA11y"');
    expect(screen).toContain('t("workout.menu.moveUp")');
    expect(screen).toContain('t("workout.menu.moveDown")');
    const moveFn = screen.slice(screen.indexOf("async function moveExerciseToday"), screen.indexOf("async function applySuperset"));
    const awaitAt = moveFn.indexOf("await workout.moveExercise(loaded.sessionId, slot, direction)");
    const applyAt = moveFn.indexOf("applyMovePositions(current, result.order, NO_STATE)");
    expect(awaitAt).toBeGreaterThanOrEqual(0);
    expect(applyAt).toBeGreaterThan(awaitAt);
    expect(moveFn.slice(moveFn.indexOf("catch")).includes("applyMovePositions")).toBe(false);
    expect(screen).not.toMatch(/PanResponder|draggable|onDragEnd/);
    const menu = parts.slice(parts.indexOf("export function MenuSheet"));
    expect(menu).toContain('accessibilityRole="button"');
    expect(menu).toContain("accessibilityLabel={it.accessibilityLabel ?? it.label}");
    expect(menu).toContain("minHeight: 56");
  });
});
