// Uses only the existing CI App Store Connect key. Never submits for App Review.
const fs = require('node:fs');
const crypto = require('node:crypto');
const root = 'https://api.appstoreconnect.apple.com';
const app = '6827498090';
async function request(path, method = 'GET', body) {
  const url = new URL(path, root);
  if (url.origin !== root) throw Error('Unexpected API origin');
  const now = Math.floor(Date.now() / 1000);
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned = `${encode({ alg: 'ES256', kid: process.env.EXPO_ASC_KEY_ID, typ: 'JWT' })}.${encode({ iss: process.env.EXPO_ASC_ISSUER_ID, iat: now - 5, exp: now + 900, aud: 'appstoreconnect-v1' })}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), { key: fs.readFileSync(process.env.EXPO_ASC_API_KEY_PATH), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${unsigned}.${signature}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`ASC ${method} ${url.pathname}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? {} : response.json();
}
async function list(path) {
  const items = [];
  do { const page = await request(path); items.push(...page.data); path = page.links?.next; } while (path);
  return items;
}
async function main() {
  const mode = process.argv[2];
  const directory = 'apps/mobile/build';
  fs.mkdirSync(directory, { recursive: true });
  const groups = await list(`/v1/betaGroups?filter[app]=${app}&limit=200`);
  const group = groups.find(g => g.attributes.name === 'Team (Expo)' && g.attributes.isInternalGroup);
  if (!group) throw Error('Existing internal Team (Expo) group not found');
  if (mode === 'preflight') {
    const builds = await list(`/v1/builds?filter[app]=${app}&limit=200`);
    const numbers = builds.map(b => b.attributes.version);
    fs.writeFileSync(`${directory}/testflight-preflight.json`, JSON.stringify({ groupId: group.id, numbers, next: Math.max(0, ...numbers.filter(n => /^\d+$/.test(n)).map(Number)) + 1 }, null, 2));
    console.log('Verified existing internal group and reserved-build inventory');
    return;
  }
  if (mode !== 'verify') throw Error('Expected preflight or verify');
  const ipa = JSON.parse(fs.readFileSync(`${directory}/ipa-verification.json`, 'utf8'));
  const deadline = Date.now() + 45 * 60 * 1000;
  while (Date.now() < deadline) {
    const builds = await list(`/v1/builds?filter[app]=${app}&filter[version]=${ipa.build}&include=preReleaseVersion&limit=200`);
    for (const build of builds) {
      const version = await request(`/v1/builds/${build.id}/preReleaseVersion`);
      if (version.data.attributes.version !== ipa.version) continue;
      const state = build.attributes.processingState;
      if (['FAILED', 'INVALID'].includes(state)) throw Error(`Apple processing ${state}`);
      if (state !== 'VALID') continue;
      let memberships = await list(`/v1/betaGroups/${group.id}/relationships/builds?limit=200`);
      if (!memberships.some(b => b.id === build.id)) {
        await request(`/v1/builds/${build.id}/relationships/betaGroups`, 'POST', { data: [{ type: 'betaGroups', id: group.id }] });
        memberships = await list(`/v1/betaGroups/${group.id}/relationships/builds?limit=200`);
      }
      const detail = await request(`/v1/builds/${build.id}/buildBetaDetail`);
      const internal = detail.data.attributes.internalBuildState;
      if (memberships.some(b => b.id === build.id) && ['READY_FOR_BETA_TESTING', 'IN_BETA_TESTING'].includes(internal)) {
        const report = { ...ipa, appleBuildId: build.id, processing: 'Complete', processingState: state, internalBuildState: internal, group: group.attributes.name, groupId: group.id, groupMembershipVerified: true };
        fs.writeFileSync(`${directory}/testflight-verification.json`, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        return;
      }
      console.log(`Apple processing Complete; internal state ${internal}; awaiting group availability`);
    }
    console.log(`Waiting for Apple build ${ipa.version} (${ipa.build})`);
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  throw Error('Timed out waiting for Apple processing and internal group availability');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
