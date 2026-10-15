#!/usr/bin/env node
/** Read-only Mac archive inspection. Does not sign, export, upload, or certify App Store readiness. */
const { execFileSync } = require("node:child_process");
const { existsSync, statSync } = require("node:fs");
const { resolve, sep } = require("node:path");

function inspectMetadata(info, privacy, expectedBundle, expectedBuild) {
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  check(info.CFBundleIdentifier === expectedBundle, "Bundle ID differs from the intended app; verify upgrade identity.");
  check(info.CFBundleVersion === expectedBuild, "Build number differs from the intended upload number.");
  check(typeof info.CFBundleShortVersionString === "string" && /^\d+\.\d+\.\d+$/.test(info.CFBundleShortVersionString), "Missing/invalid marketing version.");
  check(Array.isArray(info.CFBundleSupportedPlatforms) && info.CFBundleSupportedPlatforms.includes("iPhoneOS"), "Archive is not an iPhone device build.");
  check(Array.isArray(info.UIDeviceFamily) && info.UIDeviceFamily.length === 1 && info.UIDeviceFamily[0] === 1, "Expected an iPhone-only app.");
  check(info.ITSAppUsesNonExemptEncryption === false, "Expected the reviewed exempt-encryption declaration.");
  check(info.NSAppTransportSecurity?.NSAllowsArbitraryLoads !== true, "Unrestricted HTTP loads are enabled.");
  check(privacy.NSPrivacyTracking === false && Array.isArray(privacy.NSPrivacyTrackingDomains) && privacy.NSPrivacyTrackingDomains.length === 0, "Privacy manifest must declare no tracking/domains.");
  const collected = privacy.NSPrivacyCollectedDataTypes;
  for (const type of ["Fitness", "Health", "OtherUserContent", "UserID", "DeviceID", "OtherDataTypes"]) {
    const entry = Array.isArray(collected) ? collected.find(x => x.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${type}`) : null;
    check(entry?.NSPrivacyCollectedDataTypeLinked === true && entry?.NSPrivacyCollectedDataTypeTracking === false
      && Array.isArray(entry.NSPrivacyCollectedDataTypePurposes) && entry.NSPrivacyCollectedDataTypePurposes.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality"), `Missing reviewed optional-server declaration: ${type}.`);
  }
  for (const type of ["FileTimestamp", "UserDefaults", "SystemBootTime", "DiskSpace"]) {
    const entry = privacy.NSPrivacyAccessedAPITypes?.find(x => x.NSPrivacyAccessedAPIType === `NSPrivacyAccessedAPICategory${type}`);
    check(Array.isArray(entry?.NSPrivacyAccessedAPITypeReasons) && entry.NSPrivacyAccessedAPITypeReasons.length > 0, `Missing required-reason API declaration: ${type}.`);
  }
  return failures;
}
function archiveReport(archivePath, expectedBundle, expectedBuild) {
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(expectedBundle) || !/^[1-9][0-9]{0,3}$/.test(expectedBuild)) throw new Error("Provide the intended bundle ID and positive integer build number.");
  const readPlist = path => JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  const archive = resolve(archivePath);
  const metadata = readPlist(resolve(archive, "Info.plist"));
  const applicationPath = metadata.ApplicationProperties?.ApplicationPath;
  if (typeof applicationPath !== "string") throw new Error("Archive has no application path.");
  const products = resolve(archive, "Products");
  const app = resolve(products, applicationPath);
  if (!app.startsWith(products + sep) || !app.endsWith(".app")) throw new Error("Invalid archive application path.");
  const info = readPlist(resolve(app, "Info.plist"));
  const privacy = readPlist(resolve(app, "PrivacyInfo.xcprivacy"));
  const failures = inspectMetadata(info, privacy, expectedBundle, expectedBuild);
  const bundle = resolve(app, "main.jsbundle");
  if (!existsSync(bundle) || statSync(bundle).size === 0) failures.push("Missing/empty bundled JavaScript; verify a standalone Release archive.");
  return { archive, bundleIdentifier: info.CFBundleIdentifier, version: info.CFBundleShortVersionString, buildNumber: info.CFBundleVersion,
    minimumOS: info.MinimumOSVersion, failures, passed: failures.length === 0,
    remaining: ["Validate signing/provisioning and the complete SDK privacy report in Xcode Organizer.",
      "Record real iPhone QA for this exact build and verify production Worker deployment.",
      "Complete privacy policy/contact, App Store Connect answers, screenshots and review information.",
      "This report does not run the app, validate signatures, upload a build, or prove App Store acceptance."] };
}
if (require.main === module) {
  try {
    if (process.argv.length !== 5) throw new Error("Usage (Mac): node scripts/ios-archive-report.cjs <archive.xcarchive> <intended-bundle-id> <intended-build-number>");
    const result = archiveReport(...process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!result.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspectMetadata, archiveReport };
