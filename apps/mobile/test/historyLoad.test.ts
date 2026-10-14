import { describe, expect, it, vi } from "vitest";
import { createHistoryLoader, type HistoryLoadState } from "../src/logic/historyLoad";
import type { SessionListItem } from "../src/db/historyRepo";
const source = () => ({ listSessions: vi.fn(async () => [] as SessionListItem[]), countSessions: vi.fn(async () => 0), listLifts: vi.fn(async () => []) });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
describe("history load and retry", () => {
  it("distinguishes a successful empty history from a failed read and retries cleanly", async () => {
    const repo = source(); const states: HistoryLoadState[] = [];
    const loader = createHistoryLoader(repo, state => states.push(state));
    repo.countSessions.mockRejectedValueOnce(Error("read failed"));
    await loader.load();
    expect(states.at(-1)).toEqual({ data: null, loading: false, failed: true });
    await loader.load();
    expect(states.at(-1)).toEqual({ data: { sessions: [], total: 0, lifts: [] }, loading: false, failed: false });
  });
  it("keeps the last complete page when pagination fails, then retries the requested page", async () => {
    const repo = source(); const states: HistoryLoadState[] = [];
    const saved = [{ id: "saved" }] as SessionListItem[];
    repo.listSessions.mockResolvedValue(saved); repo.countSessions.mockResolvedValue(50);
    const loader = createHistoryLoader(repo, state => states.push(state));
    await loader.load();
    repo.listLifts.mockRejectedValueOnce(Error("failed lifts"));
    await loader.load(60);
    expect(states.at(-1)).toMatchObject({ data: { sessions: saved, total: 50 }, failed: true, loading: false });
    await loader.load();
    expect(repo.listSessions).toHaveBeenLastCalledWith(60, 0);
    expect(states.at(-1)?.failed).toBe(false);
  });
  it("ignores a slower older request after a newer page wins", async () => {
    const repo = source(); const states: HistoryLoadState[] = [];
    const old = deferred<SessionListItem[]>();
    repo.listSessions.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ id: "new" }] as SessionListItem[]);
    const loader = createHistoryLoader(repo, state => states.push(state));
    const pending = loader.load(); await loader.load(60);
    old.resolve([{ id: "old" }] as SessionListItem[]); await pending;
    expect(states.at(-1)?.data?.sessions[0]?.id).toBe("new");
  });
  it("does not update a blurred/unmounted screen, and can refresh when focused again", async () => {
    const repo = source(); const change = vi.fn(); const old = deferred<SessionListItem[]>();
    repo.listSessions.mockReturnValueOnce(old.promise);
    const loader = createHistoryLoader(repo, change);
    const pending = loader.load(); loader.cancel();
    old.resolve([]); await pending;
    expect(change).toHaveBeenCalledTimes(1);
    await loader.load();
    expect(change).toHaveBeenLastCalledWith({ data: { sessions: [], total: 0, lifts: [] }, loading: false, failed: false });
  });
});
