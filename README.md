# Space Runner

Browser-based 3D space endless runner developed with Three.js, TypeScript, and Vite.

## Run locally

Requires Node.js 22.12+ (verified with 24.11.1) and npm. Install dependencies with permission for registry access:

```sh
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Click **Launch run**. Read the gaps between incoming rocks/debris and survive with three hull points. Distance is your score; a best score is saved locally when a run ends. If storage is unavailable, the best remains available for the current session.

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

`build` produces a static `dist/` with relative asset paths. `preview` serves it locally (normally http://127.0.0.1:4173). Do not open `index.html` directly with `file://`. A Vite warning about the Three.js chunk exceeding 500 kB is currently expected; the current game output is under 1 MB uncompressed.

For a reproducible route, append `?seed=42`. In development only, `?debug&seed=42` exposes `window.spaceRunner` for diagnostics and automated fixtures. The production build omits this access. Startup loads six local GLBs before showing Launch; failed required models show an error and Retry loading.

For development collision visualization, open **http://127.0.0.1:5173/?debug=colliders&seed=42**. Pink is the player sphere, amber is the original hazard sphere, and mint is the extra calibrated box for thin/debris variants. Both hazard bounds must overlap the player at the same time. The overlay gives shape/position information; no debug UI or geometry module is shipped in production. See [collision measurements, limits and CCD details](docs/COLLISIONS.md). `node --experimental-strip-types scripts/collision-audit.mjs` remeasures the local GLBs.

Space atmosphere, engine ribbons and impact effects are procedural. Coarse pointers or a viewport short side below 600 px automatically use lower particle counts and the mobile DPR cap in both orientations. `prefers-reduced-motion` disables decorative speed streaks and softens parallax, engine animation and bursts; gameplay controls/speed are unchanged. There is no graphics menu. See [VFX lifecycle and quality details](docs/review/PHASE-3-002/VFX-IMPLEMENTATION.md).

`node scripts/vfx-performance.mjs` runs a held six-hazard rendering fixture in installed Chrome at desktop and mobile-emulated viewports, using a temporary local Vite server on 5184. It saves timing/draw/resource measurements under the review cache (or `REVIEW_RESULT_DIR`). These short local measurements do not establish physical phone performance.

## External review package

```sh
npm run review:verify
# Commit the verified source changes, then:
npm run review:pack
```

`review:verify` captures the four required checks, static checks, build-module attribution, collision measurements and matched VFX rendering diagnostics in ignored `.cache/review/PHASE-3-002/final/`. `review:pack` requires a clean committed tree, reruns verification, reads snapshot blobs from HEAD, creates the binary baseline patch and reports, collects actual logs/screenshots, then writes and reopens `review-packages/PHASE-3-002-review-<HEAD_SHORT>.zip`. It verifies each entry's size/CRC/content, lists entries, reports ZIP size/hash and checks Git status. No ZIP dependency is added. Neither the ZIP nor its evidence cache enters Git.

The archive is a self-contained review package: full relevant source/GLBs/license, Git changes, architecture/implementation/VFX/performance/asset/verification reports, machine manifest, raw logs, screenshots and a content hash inventory. Current-task prose/limitations/screenshots come from `review.config.json`. It excludes .git internals, node_modules, caches, source-download ZIPs, dist, environment/private-key files and detected credential signatures. Known-pattern checking is not an exhaustive security audit.

The current VFX package also requires the captured baseline `vfx-performance.json` under `.cache/review/PHASE-3-002/baseline/`; it refuses mismatched browser/GPU/viewport/seed/hazard conditions. For review/reconstruction, that baseline is provided inside the ZIP at `logs/baseline/`. Baseline logs are evidence, not source files regenerated from the new rendering implementation.

To reuse for another milestone, update `review.config.json` with its task id, baseline, report sources and expected screenshots before committing. `npm run review:pack -- --task TASK-ID --baseline COMMIT` overrides the first two values. Keep the authored reports relevant to that milestone. Installed Chrome/local socket access is needed for verification; this command does not upload anything.

## Milestone and limitations

Phases 0–2, PHASE-3-001 readability/calibration and PHASE-3-002 atmosphere/flight VFX are implemented: playable flight, licensed Kenney models, calibrated bounds, layered scenery, propulsion trails and localized impact feedback. Templates/resources remain shared across restarts; approved flight/camera/spawner tuning is unchanged. Audio, physical mobile-device performance checks, and Yandex SDK/release work remain. This is not a moderation-ready Yandex release.

See [project architecture and tuning](docs/PROJECT.md), [progress and verification results](docs/TASKS.md), and [release checklist](docs/RELEASE_CHECKLIST.md).

## External assets

Six unmodified GLBs from the official Kenney Space Kit are included under CC0 1.0. See [docs/ASSETS.md](docs/ASSETS.md) for original paths, source/archive hash, sizes and runtime transformations. The Kenney notice ships in `public/assets/kenney-space/LICENSE.txt`; Three.js MIT notice remains in `public/THIRD_PARTY_NOTICES.txt`.
