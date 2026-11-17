#!/usr/bin/env bash
# Publish local `main` to GitHub as a snapshot commit on `github-main`.
# Local history (including "Local only, not for GitHub" commits) never leaves
# the box: each run takes main's current tree, drops the paths below, commits
# it on top of `github-main` (one new commit, parent = previous snapshot) and
# pushes github-main -> origin/main as a fast-forward. Never force-pushes.
#
# Usage: GH_TOKEN=... tools/publish-main.sh [--dry-run]
#   GH_TOKEN comes from the environment only; it is handed to git through a
#   one-shot credential helper and is never written to config, URLs or output.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SRC=${SRC:-main}
BRANCH=github-main
REMOTE=${REMOTE:-origin}
DRY=${1:-}
# Paths kept local only (renders/videos of licensed models; ~550 MB).
EXCLUDE=(shots)
IGNORE_BLOCK=$'\n# GitHub snapshot (tools/publish-main.sh): kept local only\n/shots/\n'

src_sha=$(git rev-parse --verify "$SRC^{commit}")
idx=$(mktemp); trap 'rm -f "$idx"' EXIT
export GIT_INDEX_FILE=$idx
git read-tree "$src_sha"
for p in "${EXCLUDE[@]}"; do git rm -r -q --cached --ignore-unmatch -- "$p"; done
ign=$( { git show "$src_sha:.gitignore"; printf %s "$IGNORE_BLOCK"; } | git hash-object -w --stdin)
git update-index --add --cacheinfo "100644,$ign,.gitignore"
tree=$(git write-tree)
unset GIT_INDEX_FILE

# Safety scan of the snapshot tree: no model/texture binaries, no env files,
# no big files, no token-looking strings.
bad=$(git ls-tree -r -l "$tree" | awk '{p=$5; for(i=6;i<=NF;i++)p=p" "$i}
  p ~ /\.(glb|gltf|fbx|obj|ktx2|bin|drc|hdr|exr|blend|zip|tar|gz)$/ || p ~ /(^|\/)(licensed|threejs-assets|\.models-pack|dist)\// || p ~ /(^|\/)\.env/ || $4 > 20000000 {print p}' \
  | grep -v '^public/draco/' || true)
[ -z "$bad" ] || { echo "Refusing to publish; disallowed paths:"; echo "$bad"; exit 1; }
if git grep -qIE '(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|vercel_blob_rw_[A-Za-z0-9]{10,}|xox[bp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)' "$tree"; then
  echo "Refusing to publish; secret-looking string found (git grep the tree to locate)"; exit 1
fi
size=$(git ls-tree -r -l "$tree" | awk '{s+=$4} END {printf "%.1f", s/1e6}')

parent=()
if git rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null; then
  if [ "$(git rev-parse "$BRANCH^{tree}")" = "$tree" ]; then echo "github-main already matches $SRC ($src_sha)"; NEW=0; else NEW=1; fi
  parent=(-p "$(git rev-parse "$BRANCH")")
else NEW=1; fi
if [ "$NEW" = 1 ]; then
  msg="Snapshot of local main $(git rev-parse --short "$src_sha"): $(git log -1 --format=%s "$src_sha")"
  [ "$DRY" = --dry-run ] && { echo "Dry run: would commit tree $tree (${size} MB) as: $msg"; exit 0; }
  commit=$(git commit-tree "$tree" "${parent[@]}" -m "$msg" -m "Published by tools/publish-main.sh; local history and shots/ stay on the box.")
  git update-ref "refs/heads/$BRANCH" "$commit" ${parent:+"${parent[1]}"}
  echo "github-main -> $(git rev-parse --short "$commit") (${size} MB tree)"
fi
[ "$DRY" = --dry-run ] && exit 0
: "${GH_TOKEN:?GH_TOKEN must be set in the environment}"
git -c credential.helper= \
    -c 'credential.helper=!f() { test "$1" = get && echo username=x-access-token && echo "password=$GH_TOKEN"; }; f' \
    push "$REMOTE" "refs/heads/$BRANCH:refs/heads/main"
