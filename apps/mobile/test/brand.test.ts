import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const cfg = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo;

function pngInfo(rel: string) {
  const b = readFileSync(join(root, rel));
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] as number };
}

describe("brand wiring", () => {
  it("references only files that exist", () => {
    const refs = [
      cfg.icon,
      cfg.android.adaptiveIcon.foregroundImage,
      cfg.android.adaptiveIcon.monochromeImage,
      cfg.web.favicon,
      cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1].image,
    ];
    for (const r of refs) expect(existsSync(join(root, r)), r).toBe(true);
  });

  it("uses black for adaptive background and splash", () => {
    expect(cfg.android.adaptiveIcon.backgroundColor).toBe("#000000");
    expect(cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1].backgroundColor).toBe("#000000");
  });

  it("icon.png is 1024 square with no alpha channel (iOS)", () => {
    const i = pngInfo("assets/icon.png");
    expect([i.w, i.h]).toEqual([1024, 1024]);
    expect([0, 2]).toContain(i.colorType); // grey / RGB, never RGBA(6) or grey+alpha(4)
  });

  it("adaptive layers are 1024 square; foreground keeps alpha", () => {
    expect(pngInfo("assets/adaptive-icon-foreground.png")).toMatchObject({ w: 1024, h: 1024, colorType: 6 });
    expect(pngInfo("assets/adaptive-icon-monochrome.png")).toMatchObject({ w: 1024, h: 1024, colorType: 6 });
  });

  it("in-app logo has 1x/2x/3x variants", () => {
    expect(pngInfo("assets/gain-logo.png").w).toBe(48);
    expect(pngInfo("assets/gain-logo@2x.png").w).toBe(96);
    expect(pngInfo("assets/gain-logo@3x.png").w).toBe(144);
  });
});
