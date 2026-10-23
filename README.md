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
| Mute / unmute | M, or Sound settings |

Switching tabs or losing focus pauses the game and silences audio. Return and deliberately resume.

Open **Sound settings** from the main menu or pause screen for master/music/SFX volume and mute. Defaults are 65% / 35% / 75%, unmuted. Audio activates only after Launch, Resume or a sound-control gesture; reloads remain silent until interaction. Preferences use `space-runner.audio.v1`, independently of best scores, with an in-memory fallback if storage is denied. Unsupported/blocked audio leaves flight playable and displays its actual availability. The compact dialog scrolls on short landscape screens and supports keyboard/touch controls.

Propulsion, impacts, UI feedback and a 16-second ambient composition are original native Web Audio synthesis; there are no audio downloads or streams. Pause stops continuous sound, final damage lets destruction finish, and restart reuses one context/graph. See [audio design and manual listening checklist](docs/review/PHASE-3-003/AUDIO-DESIGN.md). Automated waveform/routing checks do not replace listening on real speakers/headphones.

## Verify and build

```sh
npm run typecheck
npm run test
npm run build
npm run test:browser
npm run preview
```

`test` runs deterministic simulation/storage/VFX/audio tests with Node's test runner. `test:browser` uses **installed Google Chrome**, starts development (5173) and production preview (4173) servers, and covers desktop, emulated touch, audio and static production output. It analyses real Web Audio output and writes native OfflineAudioContext previews to ignored `test-results/audio-flight-preview.wav` and `audio-music-preview.wav`; these are generated PCM, not microphone recordings. Run `build` first. If Chrome is unavailable, install it from its official vendor or set `PLAYWRIGHT_CHANNEL` to an installed supported channel such as `msedge`. Browser installation is not automated. Screenshots and failure traces go into ignored `test-results/`. No lint tool is configured.

`build` produces a static `dist/` with relative asset paths. `preview` serves it locally (normally http://127.0.0.1:4173). Do not open `index.html` directly with `file://`. A Vite warning about the Three.js chunk exceeding 500 kB is currently expected; the current game output is under 1 MB uncompressed.

For a reproducible route, append `?seed=42`. In development only, `?debug&seed=42` exposes `window.spaceRunner` for diagnostics and automated fixtures. The production build omits this access. Startup loads six local GLBs before showing Launch; failed required models show an error and Retry loading.

For development collision visualization, open **http://127.0.0.1:5173/?debug=colliders&seed=42**. Pink is the player sphere, amber is the original hazard sphere, and mint is the extra calibrated box for thin/debris variants. Both hazard bounds must overlap the player at the same time. The overlay gives shape/position information; no debug UI or geometry module is shipped in production. See [collision measurements, limits and CCD details](docs/COLLISIONS.md). `node --experimental-strip-types scripts/collision-audit.mjs` remeasures the local GLBs.

Space atmosphere, engine ribbons and impact effects are procedural. Coarse pointers or a viewport short side below 600 px automatically use lower particle counts and the mobile DPR cap in both orientations. `prefers-reduced-motion` disables decorative speed streaks and softens parallax, engine animation and bursts; gameplay controls/speed are unchanged. There is no graphics menu. See [VFX lifecycle and quality details](docs/review/PHASE-3-002/VFX-IMPLEMENTATION.md).

`node scripts/vfx-performance.mjs` runs a held six-hazard rendering fixture with audio active in installed Chrome at desktop and mobile-emulated viewports, using a temporary local Vite server on 5184. It saves timing/draw/resource measurements and separate audio-update timing under the review cache (or `REVIEW_RESULT_DIR`). These short local measurements do not establish physical phone or audio-thread performance.

## External review package

```sh
npm run review:verify
# Commit the verified source changes, then:
npm run review:pack
```

The current GAMEPLAY-001B-1 configuration captures typecheck, unit/build/browser checks, whitespace/static safety, build attribution, real-model collision audit and isolated field benchmarks in ignored `.cache/review/GAMEPLAY-001B-1/final/`. `review:pack` requires a clean committed tree, repeats verification, reads source blobs from HEAD, and writes/reopens `review-packages/GAMEPLAY-001B-1-review-<HEAD_SHORT>.zip` against approved `c447ee5`. It verifies every entry's size/CRC/content and reports ZIP size/hash. Neither ZIP nor evidence cache enters Git.

The archive contains complete tracked source/tests/config/assets/licenses, the historical eight design records, new implementation/architecture/performance reports, full Git patch, raw results, three actual distribution plots and hash inventory. Exclusions include .git internals, node_modules, caches, old ZIPs, dist and sensitive files/signatures; this is not an exhaustive security audit. Metadata comes from `review.config.json`.

After `npm run build`, run `node --experimental-strip-types scripts/field-foundation-benchmark.mjs` for matched old/new16-seed spatial metrics, exact replay, protected-source/import/build checks, timing, after-GC memory and actual plots. It needs installed Chrome, no historical cache/ZIP. When an approved001A local build manifest exists it additionally compares filenames/sizes; fresh output hashes are always saved. This is candidate-generation research, not a validator or live-field benchmark. The earlier `generator-research.mjs` remains available for historical001A reproduction and its labelled concepts. See [B-1 implementation](docs/review/GAMEPLAY-001B-1/IMPLEMENTATION.md) and [measurements](docs/review/GAMEPLAY-001B-1/PERFORMANCE.md).

To reuse for another milestone, update `review.config.json` with its task id, baseline, report sources and expected screenshots before committing. `npm run review:pack -- --task TASK-ID --baseline COMMIT` overrides the first two values. Keep the authored reports relevant to that milestone. Installed Chrome/local socket access is needed for verification; this command does not upload anything.

## Milestone and limitations

The playable game retains PHASE-3-004B's owner-approved [Concept A — Flight Instrumentation](docs/design/UI_ART_DIRECTION.md). Run `npm run dev`, then open http://127.0.0.1:5173/. GAMEPLAY-001B-1 implements an isolated candidate foundation accessible only through tests/research; live generation, movement, presentation and audio remain unchanged. It has no trajectory validator and is not safe for production gameplay. B-2 requires external review approval. The [historical concepts](design/ui-concepts/README.md) remain separate studies at `/design/ui-concepts/`; historical UI scripts retain their original cache/baseline requirements.

Phases 0–2 and PHASE-3-001/002/003 readability, VFX and audio are implemented. Templates/audio resources remain shared across restarts; approved flight/camera/spawner/VFX behavior is unchanged. Subjective listening acceptance, physical mobile-device performance checks, and Yandex SDK/release work remain. This is not a moderation-ready Yandex release.

See [project architecture and tuning](docs/PROJECT.md), [progress and verification results](docs/TASKS.md), and [release checklist](docs/RELEASE_CHECKLIST.md).

## External assets

Six unmodified GLBs from the official Kenney Space Kit are included under CC0 1.0. See [docs/ASSETS.md](docs/ASSETS.md) for original paths, source/archive hash, sizes and runtime transformations. The Kenney notice ships in `public/assets/kenney-space/LICENSE.txt`; Three.js MIT notice remains in `public/THIRD_PARTY_NOTICES.txt`.

The two local production fonts (Oxanium 500 and IBM Plex Mono 400) ship with complete SIL OFL notices under `public/assets/fonts/`. No runtime font CDN is used; unused bold font and design screenshots remain outside production.
