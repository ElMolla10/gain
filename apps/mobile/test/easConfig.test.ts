import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** apps/mobile/eas.json (docs/IOS-RELEASE.md): three build profiles, store builds auto-increment, and no secret is ever committed. */
const raw = readFileSync(join(__dirname, "..", "eas.json"), "utf8");
const eas = JSON.parse(raw) as { cli: Record<string, unknown>; build: { development: Record<string, any>; preview: Record<string, any>; production: Record<string, any> }; submit: Record<string, any> };

describe("eas.json", () => {
  it("has development, preview (internal) and production (store) profiles", () => {
    expect(Object.keys(eas.build)).toEqual(expect.arrayContaining(["development", "preview", "production"]));
    expect(eas.build.preview.distribution).toBe("internal");
    expect(eas.build.production.distribution).toBe("store");
  });
  it("production auto-increments the build number, tracked remotely by EAS", () => {
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.cli.appVersionSource).toBe("remote");
  });
  it("commits no App Store Connect key or issuer (those come from EXPO_ASC_* env / EAS secrets); only the public ASC app id", () => {
    expect(raw).not.toMatch(/ascApiKey|appleId|BEGIN PRIVATE KEY|\.p8/);
    expect(eas.submit.production.ios).toEqual({ ascAppId: "6827498090" });
  });
});
