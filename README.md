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

For the experimental continuous field, open **http://127.0.0.1:5173/?debug=field&seed=42** on the development server. Controls, hull, scoring, pause, sound and restart are the same. Candidates publish only after a bounded replay from the actual current Ship state and complete owned field; future player input is unknown. The original72 render records are reused. Without this flag, and in every production build, the original wave generator remains active. Production strips the experimental module graph and inspection global. See [runtime approach](docs/review/GAMEPLAY-001B-5A/RUNTIME_PUBLICATION.md) and [remaining gates](docs/review/GAMEPLAY-001B-5A/REMAINING_GATES.md). This is a developer prototype pending external review.

Pressure First A/B is selectable only in that DEV field: [A / baseline](http://127.0.0.1:5173/?debug=field&policy=baseline&seed=42) preserves approved `director-v1`; [B / pressure](http://127.0.0.1:5173/?debug=field&policy=pressure&seed=42) uses `pressure-v1`, more frequent existing encounters and shorter spans/recoveries. Omitting `policy` keeps A. Both retain identical flight, damage, scoring and validation. Greater object count is not an accepted gameplay improvement; see [measured comparison](docs/review/GAMEPLAY-EXPERIMENT-003A/AB_COMPARISON.md) and [owner playtest guide](docs/review/GAMEPLAY-EXPERIMENT-003A/PLAYTEST_GUIDE.md). Human preference remains pending.

Space atmosphere, engine ribbons and impact effects are procedural. Coarse pointers or a viewport short side below 600 px automatically use lower particle counts and the mobile DPR cap in both orientations. `prefers-reduced-motion` disables decorative speed streaks and softens parallax, engine animation and bursts; gameplay controls/speed are unchanged. There is no graphics menu. See [VFX lifecycle and quality details](docs/review/PHASE-3-002/VFX-IMPLEMENTATION.md).

`node scripts/vfx-performance.mjs` runs a held six-hazard rendering fixture with audio active in installed Chrome at desktop and mobile-emulated viewports, using a temporary local Vite server on 5184. It saves timing/draw/resource measurements and separate audio-update timing under the review cache (or `REVIEW_RESULT_DIR`). These short local measurements do not establish physical phone or audio-thread performance.

## External review package

```sh
npm run review:verify
# Commit the verified source changes, then:
npm run review:pack
```

The current GAMEPLAY-EXPERIMENT-003A configuration captures13 checks: typecheck, unit/build/browser, whitespace/static safety, build attribution, collision audit, historical/runtime diagnostics, approved-baseline/production preservation, real A/B comparison and rendered A/B profiling. Results go to ignored `.cache/review/GAMEPLAY-EXPERIMENT-003A/final/`. `review:pack` requires intended changes committed, repeats verification, reads source blobs from HEAD, and writes/reopens `review-packages/GAMEPLAY-EXPERIMENT-003A-review-<HEAD_SHORT>.zip` against approved `928b88a`. The four explicitly configured pre-existing untracked user roots are preserved by before/after SHA256 checks and excluded from snapshot/patch; other dirty paths fail. The packer verifies every entry's size/CRC/content and reports ZIP size/hash. Neither ZIP nor evidence cache enters Git.

The archive contains complete tracked source/tests/config/assets/licenses, historical records, five current reports, full patch, actual witnesses/input traces/failures, raw measurements and integrity inventory. Screenshots show the actual developer game; the short silent A/B WebMs capture its canvas without DOM HUD and are decode-checked. Exclusions include .git internals, dependencies, caches, old ZIPs, dist, unrelated user files and sensitive files/signatures; this is not an exhaustive security audit. Metadata comes from `review.config.json`.

Run `node --experimental-strip-types scripts/runtime-history.mjs` to reconstruct approved B-4 and reproduce its original build, pattern and director diagnostics, including nested original trajectory/foundation snapshots. This preserves historical source guards, fixtures, algorithms, counts and byte comparisons **inside the approved snapshots**. Original root scripts intentionally retain their old assumptions and should not be run directly against the changed entry bridge. Path-only nested bootstrap substitutions are recorded. Historical reports remain in `docs/review/GAMEPLAY-001B-{1,2,3,4}/`.

Run `node --experimental-strip-types scripts/runtime-benchmark.mjs` for the full current pipeline:2632 logical decisions, separate384 real-GameModel cases, six supplemental32-section passive runs, matched-window analysis and eight actual-render browser profiles. `--logical-only` omits model/browser stages. `node scripts/runtime-browser.mjs` repeats only the real-render profiles; `node --experimental-strip-types scripts/runtime-model-benchmark.mjs` repeats actual-model and long-passive checks. Installed Chrome/local socket access is required for browser/historical commands. Keep sources unchanged during measurement to avoid Vite/HMR invalidating profiles. No dependencies or runtime assets are downloaded by these commands.

Run `node --experimental-strip-types scripts/pressure-benchmark.mjs` for the matched A/B corpus (16 seeds ×12 histories ×2 policies at startup;3 seeds ×12 histories ×2 policies in explicit late warm starts,60s each). It retains full committed geometry, tapes/clocks, omissions and independent audits; early real-model damage/publication prefixes are checked separately. `--smoke` runs three seed42 histories for90s. `node --experimental-strip-types scripts/pressure-preservation.mjs` compares A and production with approved B-5A. `node scripts/pressure-browser.mjs` repeats actual rendered A/B measurements and recordings. Logical workers contend for CPU; browser timing must be measured separately after other benchmarks finish.

To reuse for another milestone, update `review.config.json` with its task id, baseline, report sources and expected screenshots before committing. `npm run review:pack -- --task TASK-ID --baseline COMMIT` overrides the first two values. Keep the authored reports relevant to that milestone. Installed Chrome/local socket access is needed for verification; this command does not upload anything.

## Milestone and limitations

The playable game retains PHASE-3-004B's owner-approved [Concept A — Flight Instrumentation](docs/design/UI_ART_DIRECTION.md). The normal URL uses original waves. B-5A adds an opt-in playable developer continuous field with actual-state publication; it does not change the production generator. The production lifecycle bridge changes bundle bytes, while original model/Ship/waves/collision/assets/UI/audio remain unchanged. External architecture review is required before B-5B or production rollout. Boundary bypasses, veto-created gaps, cold Launch stalls, portrait wing clipping and physical-device/human evaluation remain explicit [gates](docs/review/GAMEPLAY-001B-5A/REMAINING_GATES.md). The [historical concepts](design/ui-concepts/README.md) remain separate studies at `/design/ui-concepts/`.

Phases 0–2 and PHASE-3-001/002/003 readability, VFX and audio are implemented. Templates/audio resources remain shared across restarts; approved flight/camera/spawner/VFX behavior is unchanged. Subjective listening acceptance, physical mobile-device performance checks, and Yandex SDK/release work remain. This is not a moderation-ready Yandex release.

See [project architecture and tuning](docs/PROJECT.md), [progress and verification results](docs/TASKS.md), and [release checklist](docs/RELEASE_CHECKLIST.md).

## External assets

Six unmodified GLBs from the official Kenney Space Kit are included under CC0 1.0. See [docs/ASSETS.md](docs/ASSETS.md) for original paths, source/archive hash, sizes and runtime transformations. The Kenney notice ships in `public/assets/kenney-space/LICENSE.txt`; Three.js MIT notice remains in `public/THIRD_PARTY_NOTICES.txt`.

The two local production fonts (Oxanium 500 and IBM Plex Mono 400) ship with complete SIL OFL notices under `public/assets/fonts/`. No runtime font CDN is used; unused bold font and design screenshots remain outside production.
