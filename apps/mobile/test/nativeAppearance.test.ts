import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ setColorScheme: vi.fn() }));
vi.mock("react-native", () => ({ Appearance: { setColorScheme: native.setColorScheme }, useColorScheme: () => "light" }));

describe("native UI follows GAIN's appearance (iOS audit 8)", () => {
  beforeEach(() => { vi.resetModules(); native.setColorScheme.mockClear(); });
  it("dark/light/system map to dark/light/unspecified, also for the boot call with the default", async () => {
    const { setAppearance } = await import("../src/theme");
    setAppearance("dark");
    setAppearance("light");
    setAppearance("system");
    expect(native.setColorScheme.mock.calls).toEqual([["dark"], ["light"], ["unspecified"]]);
  });
  it("a repeated value doesn't call it twice", async () => {
    const { setAppearance } = await import("../src/theme");
    setAppearance("light");
    setAppearance("light");
    expect(native.setColorScheme).toHaveBeenCalledTimes(1);
  });
});
