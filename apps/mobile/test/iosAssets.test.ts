import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** App Store icon rules (docs/IOS-RELEASE.md): 1024x1024 PNG, no alpha channel. Read straight from the PNG IHDR so no image library is needed. */
function ihdr(file: string) {
  const b = readFileSync(join(__dirname, "..", "assets", file));
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25], hasTrns: b.includes(Buffer.from("tRNS")) };
}

describe("iOS icon and splash assets", () => {
  it("icon.png is 1024x1024 truecolour with no alpha channel or transparency chunk", () => {
    const h = ihdr("icon.png");
    expect([h.width, h.height]).toEqual([1024, 1024]);
    expect(h.colorType).toBe(2); // 2 = RGB; 6 = RGBA would be rejected by App Store Connect for the icon
    expect(h.hasTrns).toBe(false);
  });
  for (const file of ["splash-icon-dark.png", "splash-icon-light.png"]) {
    it(`${file} is 1024x1024 with transparency, so it sits on either splash background`, () => {
      const h = ihdr(file);
      expect([h.width, h.height]).toEqual([1024, 1024]);
      expect(h.colorType).toBe(6);
    });
  }
  it("the splash has a light and a dark variant at 128pt", () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, "..", "app.json"), "utf8")).expo;
    const entry = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
    expect(entry).toMatchObject({ image: "./assets/splash-icon-light.png", backgroundColor: "#F5F6EF", imageWidth: 128, dark: { image: "./assets/splash-icon-dark.png", backgroundColor: "#10120E" } });
  });
});
