#!/usr/bin/env bash
# One-time GitHub side of CI/CD (see docs/CI-CD.md). Needs GH_TOKEN in the
# environment (fine-grained: Administration, Contents, Secrets, Workflows
# read-write on Ashe-Oro) and the Vercel CLI logged in to ashe-oros-projects.
# Creates the PRIVATE repo, sets the four Actions secrets, then publishes a
# snapshot of local main with tools/publish-main.sh (no local history).
# Secret values are piped straight into `gh secret set`; nothing is printed.
set -euo pipefail
REPO="${REPO:-Ashe-Oro/cel-village}"
SCOPE=ashe-oros-projects
ORG_ID=team_gy43mG9eyO8X2UmagfFdSA2b
PROJECT_ID=prj_Lu97wG3cHSyRRY7dEqt6K49qoNDF
cd "$(git rev-parse --show-toplevel)"
: "${GH_TOKEN:?GH_TOKEN must be set}"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --private --description "Cel-shaded Three.js village (models in private Vercel Blob, never in git)"
fi
test "$(gh repo view "$REPO" --json visibility -q .visibility)" = PRIVATE || { echo "$REPO is not private; stopping"; exit 1; }
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"

printf %s "$ORG_ID" | gh secret set VERCEL_ORG_ID --repo "$REPO"
printf %s "$PROJECT_ID" | gh secret set VERCEL_PROJECT_ID --repo "$REPO"

tmp=$(mktemp -d); chmod 700 "$tmp"; trap 'rm -rf "$tmp"' EXIT
( cd "$tmp" && npx --yes vercel@65.17.0 link --project cel-village --scope "$SCOPE" --yes >/dev/null 2>&1 \
  && npx --yes vercel@65.17.0 env pull .env.dev --environment development --yes >/dev/null 2>&1 )
blob=$(node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").split("\n").find(x=>x.startsWith("BLOB_READ_WRITE_TOKEN="));if(!l)process.exit(2);process.stdout.write(l.slice(22).replace(/^"|"$/g,""))' "$tmp/.env.dev")
[ -n "$blob" ] || { echo "BLOB_READ_WRITE_TOKEN not found"; exit 1; }
printf %s "$blob" | gh secret set BLOB_READ_WRITE_TOKEN --repo "$REPO"; unset blob

if [ "${SKIP_VERCEL_TOKEN:-0}" != 1 ]; then
  tok=$(npx --yes vercel@65.17.0 tokens create "cel-village GitHub Actions" --scope "$SCOPE" --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.slice(s.indexOf("{")));const t=j.bearerToken||j.token?.bearerToken||j.token;if(typeof t!=="string")process.exit(3);process.stdout.write(t)})')
  [ -n "$tok" ] || { echo "Could not create a Vercel token from the CLI; create one in the dashboard and run: gh secret set VERCEL_TOKEN --repo $REPO"; exit 1; }
  printf %s "$tok" | gh secret set VERCEL_TOKEN --repo "$REPO"; unset tok
fi
gh secret list --repo "$REPO"
tools/publish-main.sh
