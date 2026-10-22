# Delivery checklist

## Current implementation plan

1. Integrate and verify the six licensed model assets while preserving the stable simulation.
2. Capture actual verification, resource/download stability and desktop/touch rendering evidence.
3. Commit PHASE-2-001 on its feature branch, then generate and verify the comprehensive ZIP from HEAD.
4. Await independent architecture review before any merge or separately authorized Phase 3 work.

## Acceptance

- [x] Phase 0: inspect environment, initialize minimal app, and confirm build scripts
- [x] Phase 1: playable graybox with ship controls, camera, hazards, health, score, death, pause, restart
- [x] Phase 2: legally sourced models imported, visible, and documented in `docs/ASSETS.md`
- [ ] Phase 3: visual polish, UI, responsive touch controls, sound and game feel
- [ ] Phase 4: tests, browser smoke checks, performance, restart/leak checks
- [ ] Phase 5: production build and Yandex-specific release checklist

Update this checklist only when the corresponding acceptance checks actually pass. Keep outstanding issues explicit.

## Phase 0 / Phase 1 delivery — 2026-10-22

- Initial Git workspace was clean on `main`; the repository contained only its guidance/docs and ignore rules. Read root `AGENTS.md` and the entire master brief before implementation.
- Added strict TypeScript, Three.js, Vite, a lockfile, and development/typecheck/test/build/preview/browser scripts. Registry installs were approved; lifecycle scripts were disabled and cache stayed inside ignored `.cache/`.
- Added focused simulation, input, lifecycle, rendering, storage, platform seam, and DOM UI modules. No backend, UI framework, physics engine, remote runtime assets, or SDK.
- Complete loop: loading → menu → flight → three hits with shield cooldown → game over / best → replay. Pause/resume buttons and keys, focus/visibility pause, touch capture/cancel, resizing, and WebGL context recovery work.
- Cyan full-height corridors change at most one lane per wave. At the fastest speed the 1.765 s minimum wave interval exceeds the 1.609 s conservative movement/reaction/collision budget. Difficulty ramps over 120 s; no spawns during the first 4 s, then 108 units of sight distance. Hazard/wave/particle/render resources are reused.
- Original temporary ship, three obstacle silhouettes, layered scrolling stars, distant planet, banking, engine glow, impact flash/particles, and responsive HTML/CSS UI are visible in browser screenshots. Real-model replacement remains Phase 2.

### Executed commands and results

| Command | Actual result |
| --- | --- |
| `git status --short` | Initially clean |
| `node --version` / `npm --version` | v24.11.1 / 11.6.2 |
| `npm install --save-exact three --cache .cache/npm --ignore-scripts --no-audit --no-fund` | Exit 0; added 1 package |
| `npm install --save-dev --save-exact vite typescript @types/three @playwright/test --cache .cache/npm --ignore-scripts --no-audit --no-fund` | Exit 0; added 27 packages |
| `npm run typecheck` | Exit 0; strict application typecheck passed |
| `npm run test` | Exit 0; all 16 simulation/storage tests passed |
| `npm run build` | Exit 0; 4 static files, 602,408 bytes uncompressed including license notice; Three.js chunk size advisory only |
| `npm run dev -- --port 5173 --strictPort` | Vite serves successfully; server/browser checks required approved local socket access outside the sandbox |
| `npm run test:browser` | Exit 0; all 6 Chrome desktop/touch/production tests passed in 42.2 s on the final run |
| `git diff --check` | Exit 0; no whitespace errors |

Unit coverage includes state guards, cooldown/damage/death, complete restart reset, acceleration/braking/bounds, step-size consistency, swept collisions, monotonic difficulty, seed reproducibility, warmup, corridor clearance/reachability, bounded pools, and denied/corrupt storage. Generated over 8,000 waves across 64 seeds; simulated 24 two-minute flights using actual steering dynamics at maximum difficulty without damage.

Browser coverage includes keyboard steering, all pause controls, released keys after focus loss, collision UI/invulnerability, best persistence across reload, five restarts with unchanged renderer geometry/texture counts, actual Chromium touch pointers with capture/release/cancel, 390×844 portrait / 844×390 landscape, graphics context loss/recovery, and the production build with no external runtime requests or console errors. Visibility events and collisions use controlled fixtures; touch uses Chromium's touch protocol. Also inspected the in-app browser visually and observed an untouched route-42 flight naturally end at 581 m, zero hull, with best score and replay visible.

The initial desktop Chrome sample showed 16.7 ms median frame interval, 25 draw calls, and 23 geometries with hazards visible. This is a local desktop sample, not a phone performance claim. Screenshots: ignored `test-results/desktop-hazards.png`, `production-menu.png`, `desktop-game-over.png`, `touch-portrait.png`, and `touch-landscape-paused.png`.

### Remaining work at the Phase 1 checkpoint (historical)

- Phase 2: obtain the official Kenney pack with narrow download permission, inspect license/archive, integrate models through a caching asset manager, and verify orientation/materials in-browser.
- Phase 3: sound/mute, model presentation, and further flight feel/pattern tuning.
- Phase 4 remains open despite early tests: real phones, Safari/Firefox, broader manual playtesting, sustained performance and memory measurements.
- Phase 5 remains open: real Yandex adapter, release archive/platform checks, and publication approval. See `RELEASE_CHECKLIST.md`.
- No external models, sounds, or textures were downloaded; no claim of completed v0.1 or Yandex readiness.

## PHASE-2-001 — licensed models and external review

- Verified clean `main` at `e926a72`, read all required guidance/provenance, inspected rendering/lifecycle/core/tests, then ran and saved baseline outputs: strict typecheck, 16 unit tests, build and 6 browser tests passed (37.9 s for browser suite).
- Created `feature/phase-2-assets` from the stable baseline. Official approved download: Kenney Space Kit; original ZIP license confirms CC0. Selected six native GLBs and original notice only; no conversion or source-byte modifications. Full provenance is in `ASSETS.md`.
- Replaced main ship and hazard primitives with Speeder A, three meteors, barrel and generator debris. Added async GLTF asset manager, loading progress/error/retry, in-flight cache, centered/normalized templates, shared rigid clones, explicit ownership/disposal and late-load cleanup. Restart/pooling/focus/context behavior preserved.
- Core simulation, colliders, input, difficulty and seeded spawner files are unchanged. Five visual variants derive from existing kind/phase without consuming extra random values. Model tests verify all hazard vertices fit the logical sphere after normalization.
- Added six asset tests and three review ZIP/safety tests (25 unit tests total), two model-loading/restart/error browser checks (8 browser tests total), deterministic desktop/all-hazard and touch/asteroid screenshots, and unchanged behavior checks. The new GPU baseline fixture was corrected for lazy impact-buffer upload and current hull; raw failed diagnostic logs are retained with the package.
- Added `review:verify`, `review:pack`, module-attribution tooling, safe HEAD snapshot collection, binary patch/metadata, authored architecture/implementation reports, actual log/screenshot collection, machine manifest/hash inventory, and dependency-free ZIP integrity verification. Generated archives/evidence are ignored.
- `npm run review:verify` passed before committing: `npm run typecheck` exit 0; `npm run test` 25/25; `npm run build` exit 0; `npm run test:browser` 8/8 (38.7 s). Static known-credential/whitespace checks and build attribution also exited 0. Raw outputs were saved, not reconstructed.
- Measured production output: 11 files / **728,722 bytes** uncompressed. Major JS: **635,718 bytes**, gzip **160,921 bytes** measured by Node `zlib.gzipSync` (default options); Vite's own rounded gzip estimate is retained separately in its raw log. All six original model files were SHA256-compared against their ZIP entries and match.
- Vite's advisory is caused primarily by mandatory Three.js/WebGLRenderer and GLTFLoader. Pre-minification attribution measured 542,768 bytes for `three.module.js`, 365,805 for `three.core.js`, and 84,594 for GLTFLoader. This is attribution, not final chunk size. Actual final chunk/whole-build byte and gzip measurements are generated by review verification; no warning-limit increase or build restructure.
- Required final checks/exit codes, complete production file sizes, exact test names and screenshots are collected into `logs/`, `reports/VERIFICATION.md` and `reports/manifest.json` inside the review archive. `review:pack` refuses a dirty source tree, reruns verification against the committed state, reads Git blobs, verifies every ZIP entry and checks status again.
- Remaining limitations: physical phones/Safari/Firefox, sustained heap/GPU profiling, audio/mute and Yandex SDK. Sphere proxies still approximate irregular silhouettes. No known unresolved regression in verified flows; Phase 3 was not started, and no merge/push/publication occurred.
