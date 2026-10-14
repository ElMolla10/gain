import { describe, expect, it, vi } from "vitest";
import { createOnboardingSaver } from "../src/logic/onboardingSave";
describe("first-run writes", () => {
  it("keeps a failed save on screen and permits a retry", async () => {
    const onSaving = vi.fn(), onError = vi.fn(), done = vi.fn();
    const saver = createOnboardingSaver({ onSaving, onError });
    const error = Error("disk full");
    await expect(saver.save(async () => { throw error; }, done)).resolves.toBeUndefined();
    expect(done).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    expect(onSaving.mock.calls).toEqual([[true], [false]]);
    await saver.save(async () => undefined, done);
    expect(done).toHaveBeenCalledOnce();
  });
  it("rejects concurrent quick-start/import/setup taps until the first write settles", async () => {
    const write = vi.fn(); let release!: () => void;
    write.mockImplementation(() => new Promise<void>(r => { release = r; }));
    const saver = createOnboardingSaver({ onSaving: vi.fn(), onError: vi.fn() });
    const done = vi.fn();
    const pending = saver.save(write, done);
    await saver.save(write, done);
    expect(write).toHaveBeenCalledOnce();
    release(); await pending;
    expect(done).toHaveBeenCalledOnce();
  });
});
