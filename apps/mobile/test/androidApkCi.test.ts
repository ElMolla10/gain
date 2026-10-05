import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The pull-request APK job must build the exact head and must not be able to publish or use the release key. */
const workflow = readFileSync(join(__dirname, "../../../.github/workflows/android-apk.yml"), "utf8");
const upload = workflow.slice(workflow.indexOf("uses: actions/upload-artifact@v4"));

describe("Android test APK workflow", () => {
  it("builds the pull request head and uploads a short-lived artifact", () => {
    expect(workflow).toMatch(/^on:\n  pull_request:\n/m);
    expect(workflow).not.toMatch(/^  push:/m);
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).not.toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain('if: github.event.pull_request.head.repo.full_name == github.repository');
    expect(workflow).toContain("retention-days: 7");
    expect(workflow).toContain("if-no-files-found: error");
    expect(workflow).toContain("name: gain-android-${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a");
    expect(workflow).not.toContain("assembleDebug");
    expect(upload).toContain("${{ runner.temp }}/apk/gain-${{ github.event.pull_request.head.sha }}.apk");
    expect(upload).toContain("${{ runner.temp }}/apk/BUILD.txt");
    expect(upload).not.toContain("debug.keystore");
  });

  it("rejects the release signing key and keeps the disposable debug key", () => {
    expect(workflow).toContain("571bc5a8ce699054ae7bffe0fc912fd1faf9de7dfd3d3eb962b1b8578315c5b2");
    expect(workflow).toContain("fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c");
    expect(workflow).toContain("CN=Android Debug");
    expect(workflow).toContain("signingConfigs.debug");
    expect(workflow).toContain('stores != ["debug.keystore"]');
    expect(workflow).toContain('names != ["debug.keystore"]');
    expect(workflow).toContain("name='app.gain.mobile'");
    expect(workflow).toContain("native-code: 'arm64-v8a'");
    expect(workflow).toContain("cannot-update-release-install: yes");
    expect(workflow).not.toContain("gain-release.jks");
    expect(workflow).not.toMatch(/secrets\./);
  });
});
