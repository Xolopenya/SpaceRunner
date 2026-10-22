# Space Runner

Browser-based 3D space endless runner developed with Three.js, TypeScript, and Vite.

## Run locally

Requires Node.js 22.12+ (verified with 24.11.1) and npm. Install dependencies with permission for registry access:

```sh
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Click **Launch run**. Fly through the cyan openings, avoid incoming rocks/debris, and survive with three hull points. Distance is your score; a best score is saved locally when a run ends. If storage is unavailable, the best remains available for the current session.

| Action | Controls |
| --- | --- |
| Steer horizontally / vertically | WASD or arrow keys |
| Touch / mouse steering | Press and drag in the flight area; release to brake |
| Pause / resume | Escape or P; HUD Pause and Resume buttons |
| Restart after death | Fly again |

Switching tabs or losing focus pauses the game. Return and deliberately resume. There is no audio yet.

## Verify and build

```sh
npm run typecheck
npm run test
npm run build
npm run test:browser
npm run preview
```

`test` runs deterministic simulation/storage tests with Node's test runner. `test:browser` uses **installed Google Chrome**, starts development (5173) and production preview (4173) servers, and covers desktop, emulated touch, and static production output. Run `build` first. If Chrome is unavailable, install it from its official vendor or set `PLAYWRIGHT_CHANNEL` to an installed supported channel such as `msedge`. Browser installation is not automated. Screenshots and failure traces go into ignored `test-results/`. No lint tool is configured.

`build` produces a static `dist/` with relative asset paths. `preview` serves it locally (normally http://127.0.0.1:4173). Do not open `index.html` directly with `file://`. A Vite warning about the Three.js chunk exceeding 500 kB is currently expected; the entire Phase 1 output is under 1 MB uncompressed.

For a reproducible route, append `?seed=42`. In development only, `?debug&seed=42` exposes `window.spaceRunner` for diagnostics and automated fixtures. The production build omits this access. Startup loads six local GLBs before showing Launch; failed required models show an error and Retry loading.

## External review package

```sh
npm run review:verify
# Commit the verified source changes, then:
npm run review:pack
```

`review:verify` captures the four required checks, static checks and build-module attribution in ignored `.cache/review/PHASE-2-001/final/`. `review:pack` requires a clean committed tree, reruns verification, reads snapshot blobs from HEAD, creates the binary baseline patch and reports, collects actual logs/screenshots, then writes and reopens `review-packages/PHASE-2-001-review-<HEAD_SHORT>.zip`. It verifies each entry's size/CRC/content, lists entries, reports ZIP size/hash and checks Git status. No ZIP dependency is added. Neither the ZIP nor its evidence cache enters Git.

The archive is a self-contained review package: full relevant source/GLBs/license, Git changes, architecture/implementation/asset/verification reports, machine manifest, raw logs, screenshots and a content hash inventory. It excludes .git internals, node_modules, caches, source-download ZIPs, dist, environment/private-key files and detected credential signatures. Known-pattern checking is not an exhaustive security audit.

To reuse for another milestone, update `review.config.json` with its task id, baseline, report sources and expected screenshots before committing. `npm run review:pack -- --task TASK-ID --baseline COMMIT` overrides the first two values. Keep the authored reports relevant to that milestone. Installed Chrome/local socket access is needed for verification; this command does not upload anything.

## Milestone and limitations

Phases 0–2 are implemented: playable flight plus the licensed Kenney Speeder A, three meteor models, cargo barrel and generator debris. Templates load once and share resources across pooled clones and restarts; collider/gameplay rules remain unchanged. Audio, physical mobile-device performance checks, and Yandex SDK/release work remain. This is not a moderation-ready Yandex release.

See [project architecture and tuning](docs/PROJECT.md), [progress and verification results](docs/TASKS.md), and [release checklist](docs/RELEASE_CHECKLIST.md).

## External assets

Six unmodified GLBs from the official Kenney Space Kit are included under CC0 1.0. See [docs/ASSETS.md](docs/ASSETS.md) for original paths, source/archive hash, sizes and runtime transformations. The Kenney notice ships in `public/assets/kenney-space/LICENSE.txt`; Three.js MIT notice remains in `public/THIRD_PARTY_NOTICES.txt`.
