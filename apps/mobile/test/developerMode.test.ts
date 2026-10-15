import { describe, expect, it, vi } from "vitest";
import { SYNCED_SETTING_KEYS } from "@gain/sync";
import { createDeveloperMode, DEVELOPER_MODE_KEY, developerUnlock } from "../src/logic/developerMode";

function storage(value: string | null = null) {
  return { getSetting: vi.fn(async () => value), setSetting: vi.fn(async (_key: string, next: string) => { value = next; }) };
}
describe("local Developer Mode", () => {
  it("defaults hidden, persists explicit enable/disable and does not cloud-sync", async () => {
    const db = storage(), mode = createDeveloperMode(db);
    expect(mode.getSnapshot().enabled).toBe(false);
    await mode.load();
    expect(mode.getSnapshot()).toMatchObject({enabled:false,ready:true});
    await mode.setEnabled(true);
    expect(db.setSetting).toHaveBeenCalledWith(DEVELOPER_MODE_KEY, "1");
    const reopened = createDeveloperMode(db);
    await reopened.load();
    expect(reopened.getSnapshot().enabled).toBe(true);
    await reopened.setEnabled(false);
    expect(reopened.getSnapshot().enabled).toBe(false);
    expect(SYNCED_SETTING_KEYS as readonly string[]).not.toContain(DEVELOPER_MODE_KEY);
  });
  it("failed reads keep tools hidden and still allow an explicit retry", async () => {
    const db = storage("1");
    db.getSetting.mockRejectedValueOnce(Error("disk"));
    const mode = createDeveloperMode(db);
    await expect(mode.load()).rejects.toThrow("disk");
    expect(mode.getSnapshot()).toMatchObject({enabled:false,ready:true});
    await mode.load();
    expect(mode.getSnapshot().enabled).toBe(true);
  });
  it("failed writes preserve the actual mode and leave a retry possible", async () => {
    const db = storage(), mode = createDeveloperMode(db);
    await mode.load();
    db.setSetting.mockRejectedValueOnce(Error("full"));
    await expect(mode.setEnabled(true)).rejects.toThrow("full");
    expect(mode.getSnapshot()).toMatchObject({enabled:false,saving:false});
    await mode.setEnabled(true);
    db.setSetting.mockRejectedValueOnce(Error("full"));
    await expect(mode.setEnabled(false)).rejects.toThrow("full");
    expect(mode.getSnapshot()).toMatchObject({enabled:true,saving:false});
  });
  it("a delayed load cannot undo an explicit choice; only one preference write runs at once", async () => {
    let finishRead!: (value: string | null) => void, finishWrite!: () => void;
    const db = { getSetting: vi.fn(() => new Promise<string | null>(resolve => { finishRead = resolve; })),
      setSetting: vi.fn(() => new Promise<void>(resolve => { finishWrite = resolve; })) };
    const mode = createDeveloperMode(db), load = mode.load(), write = mode.setEnabled(true);
    await mode.setEnabled(false);
    expect(db.setSetting).toHaveBeenCalledTimes(1);
    finishWrite(); await write;
    finishRead("0"); await load;
    expect(mode.getSnapshot()).toMatchObject({enabled:true,saving:false});
  });
  it("notifies consumers and releases subscriptions", async () => {
    const mode = createDeveloperMode(storage()), listener = vi.fn();
    const unsubscribe = mode.subscribe(listener);
    await mode.load();
    expect(listener).toHaveBeenCalled();
    unsubscribe(); listener.mockClear();
    await mode.setEnabled(true);
    expect(listener).not.toHaveBeenCalled();
  });
  it("requires seven deliberate taps and resets an expired sequence", () => {
    const tap = developerUnlock();
    for (let i = 0; i < 6; i++) expect(tap(i * 100)).toBe(false);
    expect(tap(600)).toBe(true);
    expect(tap(700)).toBe(false);
    expect(tap(7000)).toBe(false);
    for (let i = 1; i < 6; i++) expect(tap(7000 + i * 100)).toBe(false);
    expect(tap(7600)).toBe(true);
  });
});
