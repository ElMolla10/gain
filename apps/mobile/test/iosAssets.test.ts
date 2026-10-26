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
  for (const file of ["icon.png", "splash-icon.png"]) {
    it(`${file} is 1024x1024 truecolour with no alpha channel or transparency chunk`, () => {
      const h = ihdr(file);
      expect([h.width, h.height]).toEqual([1024, 1024]);
      expect(h.colorType).toBe(2); // 2 = RGB; 6 = RGBA would be rejected by App Store Connect for the icon
      expect(h.hasTrns).toBe(false);
    });
  }
});
