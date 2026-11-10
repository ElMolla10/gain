import { describe, expect, it, vi } from "vitest";
import { retrySqliteOpen } from "../src/db/openRetry";

describe("native SQLite open recovery", () => {
  it("retries a transient native open error against the same database", async () => {
    const db = { id: "existing database" };
    const open = vi.fn().mockRejectedValueOnce(new Error("Error [E_SQLITE_OPEN_DATABASE]: Could not open database")).mockResolvedValue(db);
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(await retrySqliteOpen(open, wait)).toBe(db);
    expect(open).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(200);
  });

  it("does not retry a different error, including a failed PRAGMA", async () => {
    const error = new Error("SQLITE_NOTADB");
    const open = vi.fn().mockRejectedValue(error);
    const wait = vi.fn();
    await expect(retrySqliteOpen(open, wait)).rejects.toBe(error);
    expect(open).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("stops after three attempts and exposes the final native error", async () => {
    const error = Object.assign(new Error("Could not open database"), { code: "E_SQLITE_OPEN_DATABASE" });
    const open = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(retrySqliteOpen(open, wait)).rejects.toBe(error);
    expect(open).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[200], [800]]);
  });
});
