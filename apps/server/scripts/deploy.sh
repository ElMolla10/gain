#!/usr/bin/env bash
# Deploys the GAIN sync Worker to the Cloudflare account wrangler is logged in to. Free tier only (1 Worker + 1 D1 database).
# Idempotent: re-running updates the code and applies any new migrations. Nothing secret is written to the repo.
#   apps/server/scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
W="npx --yes wrangler@4.147.0"
DB=gain-sync

$W whoami | sed -n '1,12p'
find_id() { $W d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s).find(d=>d.name===process.argv[1]);console.log(x?x.uuid:"")})' "$DB"; }
ID=$(find_id)
if [ -z "$ID" ]; then
  echo "Creating D1 database $DB (free tier)"
  $W d1 create $DB >/dev/null
  ID=$(find_id)
fi
echo "D1 database id: $ID"
sed -i "s/^database_id = .*/database_id = \"$ID\"/" wrangler.toml
$W d1 migrations apply $DB --remote
$W deploy
echo "Now run: node scripts/smoke.mjs <the workers.dev URL printed above>"
