import { describe, expect, it, vi } from "vitest";
import { applyDrafts, getWorkoutDraftStore, createWorkoutDraftView } from "../src/logic/draftPersist";
import { acknowledgeSavedRow, editRow, mergeRows, unlogRow, type SetRowDraft } from "../src/logic/workoutRows";
const row = (patch: Partial<SetRowDraft> = {}): SetRowDraft => ({ key: "set", load: 60, reps: 8, rir: null, saved: true, dirty: false, warmup: false, tags: [], ghostLoad: null, ghostReps: null, ...patch });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
function storage() {
  const values = new Map<string, string>();
  return { getSetting: vi.fn(async (key: string) => values.get(key) ?? null), setSetting: vi.fn(async (key: string, text: string) => { values.set(key, text); }) };
}
describe("foreground logger departure and save ordering", () => {
  it("remount waits for departing logger snapshot before resuming", async () => {
    const db = storage(), wait = deferred();
    const write = db.setSetting.getMockImplementation()!;
    db.setSetting.mockImplementationOnce(async (key, text) => { await wait.promise; await write(key, text); });
    void getWorkoutDraftStore(db).snapshot("s", { bench: [row({ saved: false, load: 75 })] });
    let read = false;
    const resumed = getWorkoutDraftStore(db).read("s").then(d => { read = true; return d; });
    await Promise.resolve(); expect(read).toBe(false);
    wait.resolve();
    expect(applyDrafts({ bench: [row({ key: "new", saved: false })] }, await resumed).bench![0]).toMatchObject({ load: 75, saved: false });
  });
  it("successful update removes an older dirty snapshot", async () => {
    const drafts = getWorkoutDraftStore(storage());
    await drafts.snapshot("s", { bench: [row({ load: 70, dirty: true })] });
    const updated = acknowledgeSavedRow([row({ load: 80, dirty: true })], row({ load: 80, dirty: true }));
    await drafts.snapshot("s", { bench: updated });
    expect(await drafts.read("s")).toEqual([]);
    expect(applyDrafts({ bench: updated }, await drafts.read("s")).bench![0]).toMatchObject({ load: 80, dirty: false });
  });
  it("terminal clear follows delayed snapshots and blocks later background/cleanup snapshots", async () => {
    const db = storage(), wait = deferred();
    const write = db.setSetting.getMockImplementation()!;
    db.setSetting.mockImplementationOnce(async (key, text) => { await wait.promise; await write(key, text); });
    const drafts = getWorkoutDraftStore(db);
    void drafts.snapshot("s", { bench: [row({ load: 70, dirty: true })] });
    const cleared = drafts.clear("s");
    void drafts.snapshot("s", { bench: [row({ load: 80, dirty: true })] });
    wait.resolve(); await cleared;
    expect(await getWorkoutDraftStore(db).read("s")).toEqual([]);
    expect(db.setSetting.mock.calls.at(-1)?.[1]).toBe("");
  });
  it("failed snapshot reports error without poisoning later writes", async () => {
    const db = storage(), onError = vi.fn(), failure = new Error("full");
    db.setSetting.mockRejectedValueOnce(failure);
    const drafts = getWorkoutDraftStore(db, onError);
    await drafts.snapshot("s", { bench: [row({ dirty: true })] });
    expect(onError).toHaveBeenCalledWith(failure);
    await drafts.snapshot("s", { bench: [row({ load: 80, dirty: true })] });
    expect((await drafts.read("s"))[0]?.load).toBe(80);
    await drafts.clear("s"); expect(await drafts.read("s")).toEqual([]);
  });
});
describe("edits during a set save", () => {
  it.each([false, true])("preserves later edit when saved=%s", saved => {
    const submitted = row({ load: 70, saved, dirty: saved });
    const acknowledged = acknowledgeSavedRow(editRow([submitted], submitted.key, { load: 80 }), submitted);
    const refreshed = mergeRows(acknowledged, [{ id: submitted.key, load: 70, reps: 8, rir: null, warmup: false, tags: [] }]);
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]).toMatchObject({ load: 80, saved: true, dirty: true });
  });
  it("accepts ghost values when no later edit exists", () => {
    const submitted = row({ load: null, reps: null, ghostLoad: 70, ghostReps: 8, saved: false });
    expect(acknowledgeSavedRow([submitted], submitted)[0]).toMatchObject({ load: 70, reps: 8, saved: true, dirty: false });
  });
});

it("resume waits for an in-flight set save and its newer snapshot after foreground cleanup", async () => {
  const db = storage(), wait = deferred();
  const drafts = getWorkoutDraftStore(db);
  let rows = [row({ load: 70, dirty: true })];
  const submitted = rows[0]!;
  const saving = drafts.save("s", async () => {
    await wait.promise;
    rows = acknowledgeSavedRow(rows, submitted);
  }, () => ({ bench: rows }));
  // Navigation cleanup happens before the row write resolves.
  void drafts.snapshot("s", { bench: rows });
  let resumed = false;
  const reopening = getWorkoutDraftStore(db).read("s").then(value => { resumed = true; return value; });
  await Promise.resolve(); expect(resumed).toBe(false);
  wait.resolve(); await saving;
  expect(await reopening).toEqual([]);
  expect(rows[0]).toMatchObject({ load: 70, saved: true, dirty: false });
});

it("an in-flight save cannot recreate drafts after finish or discard", async () => {
  const drafts = getWorkoutDraftStore(storage()), wait = deferred();
  const saving = drafts.save("s", () => wait.promise, () => ({ bench: [row({ dirty: true })] }));
  await drafts.clear("s");
  wait.resolve(); await saving;
  expect(await drafts.read("s")).toEqual([]);
});

it("failed in-flight set save rejects to the logger and keeps departing drafts available on resume", async () => {
  const drafts = getWorkoutDraftStore(storage()), wait = deferred(), failure = new Error("database full");
  const rows = { bench: [row({ load: 75, dirty: true })] };
  const saving = drafts.save("s", async () => { await wait.promise; throw failure; }, () => rows);
  const rejection = expect(saving).rejects.toBe(failure);
  void drafts.snapshot("s", rows);
  const reopening = drafts.read("s");
  wait.resolve(); await rejection;
  expect((await reopening)[0]).toMatchObject({ load: 75, saved: true });
});

it("later rep/effort/kind edits remain pending through save acknowledgment and draft round-trip", async () => {
  const submitted = row({ load: 70 });
  const changed = editRow([submitted], submitted.key, { reps: 10, rir: 2, warmup: true, tags: ["custom"] });
  const acknowledged = acknowledgeSavedRow(changed, submitted);
  expect(acknowledged[0]).toMatchObject({ reps: 10, rir: 2, warmup: true, tags: ["custom"], dirty: true });
  const drafts = getWorkoutDraftStore(storage());
  await drafts.snapshot("s", { bench: acknowledged });
  expect(applyDrafts({ bench: [submitted] }, await drafts.read("s")).bench![0]).toMatchObject({ reps: 10, rir: 2, warmup: true, tags: ["custom"], dirty: true });
});


it("departure while restoration is pending never wipes existing drafts or activates the cancelled view", async () => {
  const db = storage(), wait = deferred();
  const drafts = getWorkoutDraftStore(db);
  await drafts.snapshot("s", { bench: [row({ load: 75, dirty: true })] });
  const read = db.getSetting.getMockImplementation()!;
  db.getSetting.mockImplementationOnce(async key => { await wait.promise; return read(key); });
  const view = createWorkoutDraftView(drafts, () => ({}));
  const loading = view.begin();
  const restoration = drafts.read("s").then(() => view.restore(loading, "s"));
  await view.snapshot("s"); // App backgrounds before restore completes.
  view.cancel(loading);
  await view.snapshot("s"); // Foreground navigation cleanup.
  wait.resolve();
  expect(await restoration).toBe(false);
  await view.snapshot("s"); // A late completion must not activate the abandoned view.
  expect((await drafts.read("s"))[0]?.load).toBe(75);
  expect(db.setSetting).toHaveBeenCalledTimes(1);
});

it("snapshots are tied to the initialized session and cancelled loads cannot activate a replacement", async () => {
  const db = storage(), drafts = getWorkoutDraftStore(db);
  const view = createWorkoutDraftView(drafts, () => ({ bench: [row({ load: 80, dirty: true })] }));
  const first = view.begin(); view.cancel(first);
  const second = view.begin();
  expect(view.restore(first, "old")).toBe(false);
  await view.snapshot("old"); expect(db.setSetting).not.toHaveBeenCalled();
  expect(view.restore(second, "new")).toBe(true);
  await view.snapshot("old"); expect(db.setSetting).not.toHaveBeenCalled();
  await view.snapshot("new"); expect((await drafts.read("new"))[0]?.load).toBe(80);
});

it("resume waits for pending untick deletion and restores retained numbers under a new unlogged key", async () => {
  const db = storage(), drafts = getWorkoutDraftStore(db), wait = deferred();
  let rows = [row({ load: 75, reps: 9 })];
  let committed = [{ id: "set", load: 75, reps: 9, rir: null, warmup: false }];
  const unticking = drafts.save("s", async () => {
    await wait.promise;
    committed = [];
    rows = unlogRow(rows, "set", "unticked");
  }, () => ({ bench: rows }));
  void drafts.snapshot("s", { bench: rows }); // Departure still sees the clean saved row.
  let resumed = false;
  const reopening = drafts.read("s").then(saved => { resumed = true; return { saved, committed }; });
  await Promise.resolve(); expect(resumed).toBe(false);
  wait.resolve(); await unticking;
  const after = await reopening;
  expect(after.committed).toEqual([]);
  expect(applyDrafts({ bench: [] }, after.saved).bench).toEqual([expect.objectContaining({ key: "unticked", load: 75, reps: 9, saved: false })]);
});
