# CI/CD: merge to `main` → Vercel production

Every push to `main` on the private GitHub repo `Ashe-Oro/thistlebrook` runs
`.github/workflows/deploy.yml`, which tests the code, builds the deploy `dist`
with the licensed models, and deploys it to Vercel production
(<https://thistlebrook.vercel.app>, project `thistlebrook`, team
`ashe-oros-projects`). The previous URL <https://cel-village.vercel.app> stays
on as an extra production domain. Pull requests run the tests only. The workflow can also be
started by hand (Actions → "Test and deploy" → Run workflow).

The site is **public** (Vercel Authentication is off, by Ashe's decision on
2026-11-17). The workflow does not change protection settings.

## Pipeline

1. `npm ci` on Node 24.22.1.
2. `npm run models:fetch` (`tools/fetch-licensed-models.mjs`): downloads
   `models/latest.json` and the tarball it names from the private Blob store,
   checks its sha256, unpacks it to `.models-pack/` and links
   `public/licensed -> .models-pack/licensed`.
3. `npm run test:ci`: every `tests/*.mjs` file, `tools/life-routines.test.mjs` and
   `npm run test:checks`.
4. `npm run deploy:dist` with `ASTRA_ASSET_ROOT=.models-pack/owned-assets`: vite
   build, copy the models the town requests, compress (already-compressed pack
   files are kept as is), and a headless Chrome load that fails the job on any
   missing model (404).
5. `vercel deploy dist --prod` with `VERCEL_TOKEN`; `VERCEL_ORG_ID` and
   `VERCEL_PROJECT_ID` select the project.
6. Post-deploy check: `https://thistlebrook.vercel.app/` must return **200** to an
   unauthenticated request and serve the new `index.html`, and
   `/draco/draco_decoder.wasm` must return 200.

The Vercel Git integration is **not** connected; `vercel.json` also sets
`git.deploymentEnabled: false`, so there is exactly one deploy per merge.

## Licensed models

The ThreeJS Assets models are licensed. They are never committed to git (not even
to the private repo): `public/licensed`, `dist/`, `.licensed-cache/` and
`.models-pack/` are gitignored. CI gets them from the **private** Vercel Blob
store `cel-village-models` (store_79QhDyrDhPJu5gB4, iad1, connected to
`thistlebrook`):

- `models/cel-village-models-<sha16>.tar.gz`: `licensed/` and `owned-assets/`
  exactly as compressed in `dist/` (Draco/meshopt), about 26 MB, 427 files.
  Files under `owned-assets/fairground/` are mirrored into
  `licensed/fairground/` because the deploy script resolves both through the
  fairground root.
- `models/latest.json`: the current pack's pathname, sha256, size and date.

### Updating the models

When a change makes the town load models the pack does not have, the CI
headless check fails with the missing URLs. On the box (which has the full
library):

```sh
npm run deploy:dist                    # builds dist/ from public/licensed + /workspace/threejs-assets
BLOB_READ_WRITE_TOKEN=... npm run models:upload -- --prune   # token from `vercel env pull`, never echo it
```

`models:upload -- --dry-run` builds and measures the pack without uploading.
`--prune` deletes older packs. Then re-run the workflow.

## GitHub Actions secrets

| Secret | What it is |
| --- | --- |
| `VERCEL_TOKEN` | Vercel access token for ashe-oro (deploys) |
| `VERCEL_ORG_ID` | Team id of `ashe-oros-projects` |
| `VERCEL_PROJECT_ID` | Project id of `thistlebrook` (id unchanged after the rename from `cel-village`) |
| `BLOB_READ_WRITE_TOKEN` | Read-write token of the `cel-village-models` Blob store |

`tools/ci-bootstrap.sh` does the one-time GitHub setup: create the private repo,
set the secrets by piping values into `gh secret set` (`VERCEL_TOKEN` comes
straight from `vercel tokens create`), then run `tools/publish-main.sh`. It
needs `GH_TOKEN` in the environment (fine-grained token on Ashe-Oro with
Administration, Contents, Secrets and Workflows read-write).

## Publishing local `main` to GitHub (snapshots, no local history)

Local `main` keeps its full history on the box, including commits marked
"Local only, not for GitHub" and about 550 MB of `shots/` renders and videos.
None of that is pushed. GitHub's `main` is a separate chain of **snapshot
commits** kept in the local branch `github-main`:

```sh
# after merging work into local main (tests passing):
GH_TOKEN=... tools/publish-main.sh            # or --dry-run to preview
```

The script takes main's current tree, drops `shots/` (and appends `/shots/` to
the snapshot's `.gitignore`), refuses to continue if the tree holds model or
texture binaries, licensed/dist paths, `.env` files, files over 20 MB or
token-looking strings, commits it on top of `github-main` with the message
`Snapshot of local main <sha>: <subject>`, and pushes `github-main` to
`origin/main` as a normal fast-forward (never a force-push). That push
triggers the deploy workflow. The token is handed to git by a one-shot
credential helper and never written to `.git/config`, a remote URL or a file.

Do not commit to GitHub's `main` directly (web edits, merged PRs); the next
snapshot would then not fast-forward. If that happens, fetch and make the
snapshot on top of `origin/main` instead of force-pushing. For pull requests,
branch from `github-main`, open the PR on GitHub, and after merging, bring the
change into local `main` by hand.

## Cost

Each deploy uploads about 33 MB and uses a few build minutes on GitHub, not
Vercel. Blob holds about 26 MB per pack (prune old ones). Both fit inside the
Pro plan's included usage.
