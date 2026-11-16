import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** .github/workflows/ios-testflight.yml — manual local TestFlight build. Must not run from a fork push or pull request. */
const raw = readFileSync(join(__dirname, "..", "..", "..", ".github", "workflows", "ios-testflight.yml"), "utf8");

describe("iOS TestFlight workflow", () => {
  it("is manual only, on the app-store environment, and uses the testflight-live profile", () => {
    expect(raw).toMatch(/^on:\n {2}workflow_dispatch:\n/m);
    expect(raw).not.toMatch(/^\s*(push|pull_request)\s*:/m);
    expect(raw).toContain("runs-on: macos-26");
    expect(raw).toContain("environment: app-store");
    expect(raw).toContain("--profile testflight-live");
    expect(raw).toContain("--local");
    expect(raw).toContain("--output build/gain.ipa");
    expect(raw).toContain("eas submit -p ios --profile testflight-live --path build/gain.ipa --non-interactive");
  });
  it("does not pin a build number; EAS remote autoIncrement does that", () => {
    expect(raw).not.toMatch(/GAIN_IOS_BUILD_NUMBER=/);
    expect(raw).not.toMatch(/buildNumber/);
  });
  it("selects Xcode 26.4.1 and passes the App Store Connect env vars EAS reads", () => {
    expect(raw).toContain("/Applications/Xcode_26.4.1.app");
    expect(raw).toContain("xcode-select");
    expect(raw).toContain("EXPO_ASC_API_KEY_PATH");
    expect(raw).toContain("EXPO_ASC_KEY_ID");
    expect(raw).toContain("EXPO_ASC_ISSUER_ID");
    expect(raw).toContain("EXPO_APPLE_TEAM_ID");
  });
});
