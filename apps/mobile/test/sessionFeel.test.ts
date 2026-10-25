import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MIGRATIONS, migrate } from "../src/db/migrations";
import { recentSessionFeels } from "../src/db/sessionFeel";
import { ar, en } from "../src/i18n/strings";
import { nextFeel, persistFeel } from "../src/logic/finishFeel";
import { loadTableInfo } from "../src/sync/schema";
import { freshDb } from "./helpers";
import { openNodeDb } from "./nodeDriver";

async function finishedSession() {
  const c = await freshDb();
  await c.repos.seedIfNeeded();
  const gymId = (await c.repos.getActiveGymId())!;
  const gym = await c.repos.loadGymFingerprint(gymId);
  const next = (await c.repos.getNextDay())!;
  const ex = (await c.repos.listDayExercises(next.day.id))[0]!;
  const { id } = await c.workout.startOrResumeSession(next.day.id, gymId);
  await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
  c.deps.tick(1000);
  await c.workout.finishSession(id);
  return { ...c, id };
}

describe("Finish session feel is saved (batch item 22)", () => {
  it("migration 19 adds a nullable session.feel; older rows stay null", async () => {
    const db = openNodeDb();
    await migrate(db, MIGRATIONS.filter((m) => m.version <= 18));
    await migrate(db);
    const cols = await db.all<{ name: string; notnull: number }>("PRAGMA table_info(session)");
    expect(cols.find((c) => c.name === "feel")).toMatchObject({ notnull: 0 });
  });

  it("set, read back, clear; invalid values clear; updated_at moves so it syncs", async () => {
    const c = await finishedSession();
    expect((await c.workout.getSession(c.id))!.feel).toBeNull();
    const before = (await c.db.get<{ updated_at: number }>("SELECT updated_at FROM session WHERE id = ?", [c.id]))!.updated_at;
    c.deps.tick(5000);
    await c.workout.setSessionFeel(c.id, "heavy");
    expect((await c.workout.getSession(c.id))!.feel).toBe("heavy");
    expect((await c.db.get<{ updated_at: number }>("SELECT updated_at FROM session WHERE id = ?", [c.id]))!.updated_at).toBeGreaterThan(before);
    expect((await c.history.getSession(c.id))!.feel).toBe("heavy");
    expect(await recentSessionFeels(c.db, 0)).toEqual([{ sessionId: c.id, finishedAt: expect.any(Number), feel: "heavy" }]);
    await c.workout.setSessionFeel(c.id, null);
    expect((await c.workout.getSession(c.id))!.feel).toBeNull();
    await c.workout.setSessionFeel(c.id, "nope" as never);
    expect((await c.history.getSession(c.id))!.feel).toBeNull();
    expect(await recentSessionFeels(c.db, 0)).toEqual([]);
  });

  it("backup round-trip keeps it; a backup without the column restores as null", async () => {
    const c = await finishedSession();
    await c.workout.setSessionFeel(c.id, "smooth");
    const json = await c.data.exportJson();
    await c.workout.setSessionFeel(c.id, null);
    await c.data.restoreJson(json);
    expect((await c.workout.getSession(c.id))!.feel).toBe("smooth");
    const old = JSON.parse(json) as { tables: Record<string, Record<string, unknown>[]> };
    for (const r of old.tables.session!) delete r.feel;
    await c.data.restoreJson(JSON.stringify(old));
    expect((await c.workout.getSession(c.id))!.feel).toBeNull();
  });

  it("sync uploads it: session.feel is one of the columns a synced row carries", async () => {
    const db = openNodeDb();
    await migrate(db);
    expect((await loadTableInfo(db)).get("session")!.cols).toContain("feel");
  });

  it("Finish: tapping again clears; a failing write never throws and is only reported", async () => {
    expect(nextFeel(null, "heavy")).toBe("heavy");
    expect(nextFeel("heavy", "heavy")).toBeNull();
    expect(nextFeel("heavy", "smooth")).toBe("smooth");
    const report = vi.fn();
    await expect(persistFeel(() => Promise.reject(new Error("disk")), report)).resolves.toBe(false);
    expect(report).toHaveBeenCalledOnce();
    await expect(persistFeel(() => Promise.reject(new Error("x")), () => { throw new Error("y"); })).resolves.toBe(false);
    await expect(persistFeel(() => Promise.resolve(), report)).resolves.toBe(true);
    const src = readFileSync(join(__dirname, "../src/screens/FinishScreen.tsx"), "utf8");
    expect(src).toContain("<FinishRpeCheck value={rpe} onChange={pickFeel} />");
    expect(src).toContain("void persistFeel(() => workout.setSessionFeel(sessionId, next)");
  });

  it("each option has a spoken label in EN and AR; Session detail shows the saved feel", () => {
    expect(en["finish.rpe.a11y"]).toContain("{option}");
    expect(ar["finish.rpe.a11y"]).toContain("{option}");
    expect(readFileSync(join(__dirname, "../src/components/FinishRpeCheck.tsx"), "utf8")).toContain('accessibilityLabel={t("finish.rpe.a11y", { option: opt.label })}');
    expect(readFileSync(join(__dirname, "../src/screens/SessionDetailScreen.tsx"), "utf8")).toContain("detail.feel ?");
  });
});
