import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(join(__dirname, "..", "App.tsx"), "utf8");

describe("native splash held until boot is ready (iOS audit 11)", () => {
  it("prevents auto-hide at module scope", () => {
    expect(app).toMatch(/^SplashScreen\.preventAutoHideAsync\(\)\.catch\(\(\) => undefined\);$/m);
  });
  it("hides once (ref guard) when fonts and boot are ready, error or migration blocked", () => {
    expect(app).toMatch(/if \(splashHidden\.current\) return;\s*splashHidden\.current = true;\s*SplashScreen\.hideAsync\(\)/);
    expect(app).toMatch(/if \(fontsReady && boot !== null\) hideSplash\(\);/);
  });
  it("has a safety timeout so the splash never stays forever", () => {
    expect(app).toMatch(/const SPLASH_MAX_MS = 8000;/);
    expect(app).toMatch(/setTimeout\(hideSplash, SPLASH_MAX_MS\)/);
  });
});
