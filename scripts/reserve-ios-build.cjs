// Reconcile Apple inventory with EAS reservations before generating/signing bundles.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
function selectBuild(appleNumbers, easNumber) {
  const values = [...appleNumbers, easNumber];
  if (values.some(v => !/^\d+$/.test(String(v)))) throw Error('Non-integer build counter');
  const selected = Math.max(0, ...values.map(Number)) + 1;
  if (!Number.isSafeInteger(selected) || selected > 9999) throw Error('Build number out of range');
  return String(selected);
}
function readEas() {
  return JSON.parse(execFileSync('eas', ['build:version:get', '-p', 'ios', '-e', 'testflight-live', '--json', '--non-interactive'], { cwd: 'apps/mobile', encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })).buildNumber;
}
async function main() {
  const reportPath = 'apps/mobile/build/testflight-preflight.json';
  const inventory = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const configPath = 'apps/mobile/app.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const before = readEas();
  const selected = selectBuild(inventory.numbers, before);
  // Same mutation as EAS build:version:set, without an interactive CI prompt.
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.EXPO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'mutation ReserveVersion($appVersionInput: AppVersionInput!) { appVersion { createAppVersion(appVersionInput: $appVersionInput) { id } } }', variables: { appVersionInput: { appId: config.expo.extra.eas.projectId, platform: 'IOS', applicationIdentifier: config.expo.ios.bundleIdentifier, storeVersion: config.expo.version, buildVersion: selected } } }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok || result.errors || !result.data?.appVersion?.createAppVersion?.id) throw Error(`EAS version reservation failed: ${JSON.stringify(result.errors || response.status)}`);
  if (readEas() !== selected) throw Error('EAS reserved counter changed unexpectedly');
  // expo-widgets reads these during prebuild, before Xcode signing.
  config.expo.ios.buildNumber = selected;
  config.expo.ios.version = config.expo.version;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  Object.assign(inventory, { easBefore: before, selected, next: Number(selected), version: config.expo.version });
  fs.writeFileSync(reportPath, JSON.stringify(inventory, null, 2) + '\n');
  console.log(`Reserved build ${selected}; EAS was ${before}; Apple maximum was ${Math.max(0, ...inventory.numbers.map(Number))}. App and ExpoWidgetsTarget will use ${config.expo.version} (${selected}).`);
}
module.exports = { selectBuild };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
