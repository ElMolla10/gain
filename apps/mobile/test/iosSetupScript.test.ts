import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// Stand-in Mac tools only: no Xcode, Apple account, network, or phone is used here.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "gain-ios-helper-"));
  for (const dir of ["scripts", "apps/mobile/ios/GAIN.xcodeproj", "bin"]) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, "scripts/ios-setup.sh"), readFileSync(join(__dirname, "../../../scripts/ios-setup.sh")));
  writeFileSync(join(root, "apps/mobile/app.json"), "{}");
  const tool = (name: string, body: string) => writeFileSync(join(root, "bin", name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  tool("uname", "echo Darwin"); tool("sw_vers", "echo 15.0");
  tool("xcodebuild", 'if [ "$1" = "-version" ]; then echo "Xcode 26.4"; fi');
  tool("xcode-select", "echo /Applications/Xcode.app/Contents/Developer");
  tool("pod", "echo 1.16"); tool("npm", "exit 0");
  tool("npx", 'printf "%s|%s|%s\\n" "$*" "$GAIN_IOS_BUNDLE_ID" "$GAIN_IOS_TEAM_ID" >> "$GAIN_TEST_LOG"');
  const project = join(root, "apps/mobile/ios/GAIN.xcodeproj/project.pbxproj");
  const saved = join(root, "apps/mobile/.env.ios");
  const run = (...args: string[]) => {
    execFileSync("bash", [join(root, "scripts/ios-setup.sh"), ...args], { env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, GAIN_IOS_BUNDLE_ID: "", GAIN_IOS_TEAM_ID: "", GAIN_TEST_LOG: join(root, "log") }, stdio: "pipe" });
    return readFileSync(join(root, "log"), "utf8");
  };
  return { root, project, saved, run };
}
describe("iOS local install helper", () => {
  it("preserves an existing Xcode identity and installs Release by default", () => {
    const f = fixture();
    try {
      writeFileSync(f.project, 'PRODUCT_BUNDLE_IDENTIFIER = "com.mo.gain";\nDEVELOPMENT_TEAM = ABCDE12345;\n');
      const log = f.run("--run");
      expect(log).toContain("run:ios --device --configuration Release|com.mo.gain|ABCDE12345");
      expect(readFileSync(f.saved, "utf8")).toContain("GAIN_IOS_BUNDLE_ID=com.mo.gain");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it("uses saved identity and permits an explicit debug build", () => {
    const f = fixture();
    try {
      writeFileSync(f.saved, "GAIN_IOS_BUNDLE_ID=com.saved.gain\nGAIN_IOS_TEAM_ID=ABCDE12345\n");
      expect(f.run("--run", "--debug")).toContain("run:ios --device --configuration Debug|com.saved.gain|ABCDE12345");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it("lets explicit command-line identity override saved values", () => {
    const f = fixture();
    try {
      writeFileSync(f.saved, "GAIN_IOS_BUNDLE_ID=com.saved.gain\nGAIN_IOS_TEAM_ID=ABCDE12345\n");
      expect(f.run("--run", "--bundle-id", "com.explicit.gain", "--team-id", "ZXCVB12345")).toContain("Release|com.explicit.gain|ZXCVB12345");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});
