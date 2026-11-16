import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** apps/mobile/eas.json: sideload, store, testflight-live and play profiles; store builds auto-increment; no secret is ever committed. */
const raw = readFileSync(join(__dirname, "..", "eas.json"), "utf8");
const eas = JSON.parse(raw) as { cli: Record<string, unknown>; build: Record<string, any>; submit: Record<string, any> };

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
  it("testflight-live is the store profile plus the Live Activity flag, and submits to the same app", () => {
    const live = eas.build["testflight-live"];
    expect(live.extends).toBe("production");
    expect(live.env).toEqual({ GAIN_IOS_LIVE_ACTIVITY: "1", GAIN_IOS_APP_GROUP: "group.com.mohamedelmolla.gain" });
    expect(eas.submit["testflight-live"].ios).toEqual({ ascAppId: "6827498090" });
  });
  it("play builds an Android app bundle with GAIN_DISTRIBUTION=play; sideload stays the default", () => {
    expect(eas.build.play.extends).toBe("production");
    expect(eas.build.play.android).toEqual({ buildType: "app-bundle" });
    expect(eas.build.play.env).toEqual({ GAIN_DISTRIBUTION: "play" });
    expect(eas.build.base.env.GAIN_DISTRIBUTION).toBe("sideload");
    expect(eas.build.production.env).toBeUndefined();
  });
});
