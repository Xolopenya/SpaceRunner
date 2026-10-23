# Delivery checklist

## Current implementation plan

1. PHASE-3-004A: inspect approved baseline and UI states; research three reference games and font licenses.
2. Build three isolated browser concepts; explore A in portrait, landscape and audio settings with real game captures.
3. Render/inspect comparisons, verify unchanged production and existing regressions, and add the repository design skill.
4. Commit/push only `feature/phase-3-ui-concepts`; produce/verify the current review ZIP. Await owner concept approval before production implementation.

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

## PHASE-3-001 — readability and collision calibration

- Read AGENTS/master/tasks/project, inspected actual code/tests/review tooling, checked branches/remotes and fetched origin. Local main and origin/main both matched approved `08ceed477a134757336589dc1feadae7606ca3e5` (0 ahead / 0 behind). Existing target branch had no divergent commits and was safely switched to; no resets/user changes were discarded.
- Saved fresh baseline outputs under ignored `.cache/review/PHASE-3-001/baseline/`: typecheck, 25 unit tests, build and 8 browser tests passed (40.2 s browser). Measured baseline output in this checkout: 728,776 bytes, including 635,718-byte JS; HTML line-ending bytes differ slightly from the original Phase 2 machine snapshot.
- Removed all eight green safe-gate geometries/update code and misleading hints. Logical Wave descriptors, safe-lane selection and generation are untouched. Separate blue frames were inspected and minimally changed to dim disconnected corner guides because closed rectangles also resembled checkpoints; scrolling/depth cues remain.
- Audited all six shipped GLBs. The half meteor's normalized Y size is 0.781271, barrel Z size 1.082004, generator Y size 0.896883 versus the old diameter-2 sphere. Inspected actual developer wire bounds before calibration; source/render pivots are centered and aligned.
- Added outward-rounded measured boxes to those three variants, retaining the original sphere as a mandatory simultaneous outer limit. Rounded sphere/box CCD checks the whole segment, with a bounded rotation allowance; round meteors and the approved ship sphere are unchanged. This cannot expand the old hazard envelope, so existing corridor budgets remain valid.
- Added `?debug=colliders` development-only dynamic wireframes/information, two cached wire geometries, 72 pooled hazard slots/player and separate ownership/disposal. Normal dev and production create no debug objects; production class markers are tested absent from emitted JS. No permanent HUD control.
- `src/config.ts`, `core/ship.ts`, `core/obstacles.ts`, `input.ts` and `game-loop.ts` remain unchanged. Ship banking and camera formulas are unchanged; no added asset fetches/dependencies, audio, visual effects or SDK work.
- Added 9 numerical/model/collision regressions and current-task report-generation coverage, with original tests retained. First complete browser run passed all 11 tests (57.8 s), including empty-space generator near miss/direct hit, logical waves/no gates, production debug exclusion, touch and five debugger restarts/disposal. Debug sample: 33 geometries / 1 texture / 73 direct root children / 6 GLB downloads, stable across restarts; disabled all-model fixture: 31 geometries / 1 texture. Current final counts/outputs are generated into the ZIP.
- Current screenshots use only `phase3-*` filenames: normal gameplay, meteor/debris bounds, mobile gameplay, production, landscape pause, all models and game over. Model positioning uses documented deterministic fixtures; debug screenshots pause simulation and hide the pause overlay. Screenshots were visually inspected.
- Updated review task/baseline/report sources/limitations and safe extra audit check. Removed Phase 2-specific generated prose; added current collision JSON/report while preserving committed snapshot, credential/path protections, binary patch and ZIP integrity validation.
- Full numerical findings, approximations and debug usage are in `COLLISIONS.md`. Remaining limits: conservative sphere/box seam/rotation errors, forgiving decorative ship wings, physical phones/Safari/Firefox and sustained profiling. Overall Phase 3 audio/polish remains open; this task is only readability/calibration.
- Final pre-commit `npm run review:verify`: all 8 checks exited 0; typecheck passed, 35 unit tests passed, 11 browser tests passed (52.4 s). Measured 11 production files / **730,988 bytes**; JS **637,927 bytes** / Node gzip **161,785 bytes**. Compared with the fresh baseline this is +2,212 total bytes (~0.30%) and +2,209 JS bytes (~0.35%). Production contains no debugger class/module; its enabled development fixture adds only 2 shared GPU geometries. The existing Vite advisory remains.
- Delivery: commit verified changes, push only the authorized feature branch, supply authenticated PR or compare URL, generate/reopen the local ignored PHASE-3-001 ZIP, and confirm main stays at the approved baseline. Exact final identifiers/results are in the generated review manifest and completion report.

## PHASE-3-002 — space atmosphere and flight VFX

- Read required guidance, tasks/project, actual rendering/core/assets/debug/tests and review tooling. Fetched origin; clean main and origin/main both contained approved `d3d3aaaaaf0c7af52e4043cf57c15899ce77147e`, with 0 ahead/behind. Created `feature/phase-3-space-vfx` from main. No new dependency or asset downloads were needed.
- Captured fresh baseline typecheck, 35 unit tests, build and 11 browser tests, plus a matched six-hazard rendering sample. Baseline output: 730,988 bytes / 11 files; Chrome 155.0.8059.85, same AMD GPU, desktop 1280×800 DPR 1 and mobile emulation 390×844 DPR 2/effective 1.4. Both samples: 16.7 ms median RAF / 36 draw calls / 30 geometries / 1 texture.
- Extracted separately owned `SpaceBackground`, `EngineVFX` and `ImpactVFX`, with rendering-only settings. Added three deterministic star layers, subtle nebula shader, planet/ring/rim, edge speed streaks, bank-aligned cyan cores/plasma and a combined reusable two-engine ribbon buffer. Further dimmed blue corner fragments after visual inspection; green gates remain absent.
- Improved actual hitSerial-triggered amber sparks/ring and replaced whole-ship strobing with a low-intensity shield shimmer. Final impact completes after propulsion stops. Pause/focus freezes histories, particles and animation clocks; restart clears existing pools without new resources or requests.
- Mobile tiers reduce draw counts in both orientations; reduced motion removes streaks and softens parallax/pulsation/trails/bursts. No new textures, runtime URLs, audio, SDK, gameplay states or model-transform changes. Approved core/input/loop/asset-normalization files and camera/banking formulas remain unchanged and are acceptance-checked.
- Added seven focused unit tests and four browser checks, retaining prior assertions. The initial Node unit attempt rejected constructor parameter-property syntax; converted it to an ordinary field, then all tests passed. Raw attempts are retained. Current eight screenshots show desktop, engine crop, speed, actual damage, portrait, landscape, production route 42 and working collider diagnostics. Fixtures are identified in the VFX report; production is an untouched run.
- Pre-commit `npm run review:verify` passed all nine commands: typecheck; 42 unit tests; build; 15 browser tests (1.6 minutes); whitespace/static checks; build attribution; collision audit; matched VFX diagnostics. Production: **742,461 bytes**, 11 files, JS **649,400 bytes**, Node gzip **165,472 bytes**. Total increase: **11,473 bytes / 1.57%**. Existing Vite advisory remains.
- Matched implementation sample retained 16.7 ms median RAF on both viewports, 43 draw calls / 34 geometries / 1 texture. Initial CPU submission medians changed desktop 2.3→2.1 ms and mobile emulation 1.8→2.0 ms; small sample noise is not an optimization claim. Five all-model restarts retain 37 geometries/1 texture; debug 39/1 and the same 73-child root; VFX-specific fixture 28/1, same buffers, one emitter and six GLB downloads.
- Updated current review task/baseline/reports/screenshots. Packaging reruns committed verification, includes raw baseline/final performance and machine-readable comparisons, and rejects mismatched browser/GPU/viewports/seed/hazard counts. Source snapshot, binary patch, secret/path protections and full ZIP integrity checks remain in place. Final delivery identifiers and package size are reported by the generated manifest/completion report.
- Overall Phase 3 remains open for audio and broader acceptance. This task excludes audio, Yandex SDK and gameplay redesign. Physical phones, Safari/Firefox, sustained thermal/heap/GPU timings and external architecture/player acceptance remain unverified; no merge or main push is authorized.

## PHASE-3-003 — audio and sound design, 2026-10-23

- Read guidance/tasks and actual orchestration, UI, storage/platform, renderer, simulation/input and tests. Fetched origin; main and origin/main were clean/synchronized at approved `4b66af6be11c0afc8b6092cade20af27f5599524` (0 ahead/behind). Created `feature/phase-3-audio`; no new dependency/download needed.
- Captured fresh baseline typecheck, 42 unit tests, build and 15 browser tests (1.3 minutes), plus matched Chrome 155 / AMD desktop and mobile-emulated six-hazard rendering metrics. Both median RAF intervals were 16.7 ms, with 43 draw calls / 34 geometries / 1 texture. Baseline production: 742,461 bytes / 11 files, JS 649,400 bytes / Node gzip 165,472 bytes.
- Added native Web Audio context ownership, original deterministic propulsion/SFX/music synthesis, bounded voices and versioned preference storage. Four continuous sources, nine cached PCM buffers and at most six temporary voices are reused across restart. Original 16-second ambient stereo music, engine hum/rush, hull/shield/destruction and restrained UI sounds require no recordings or external audio license.
- Added a compact native settings dialog in menu/pause, master/music/SFX/mute, M shortcut, stable labels/native values, 44 px targets and landscape scrolling. Defaults 65%/35%/75%, mute off. Storage failures retain session preferences, with best scores unchanged. No context before a gesture; unsupported/rejected audio preserves silent gameplay. Blur/visibility/context-loss silence audio; late initialization is invalidated on background/disposal.
- Game reads existing state/speed/velocities/hit serial/hull for audio. Core, collisions, movement/input implementation, camera, World/VFX, scoring, fixed-step loop, models and gameplay randomness remain unchanged. A serial is consumed once even when silent; final destruction/transition does not replay on the game-over screen.
- Added focused unit and real Chrome audio checks without weakening original assertions. Early signal stress caught clipping; replaced compressor makeup gain with explicit per-voice peak budgeting. Stable accessible names were verified from the browser accessibility snapshot and matched by slider role. Raw failed attempts are retained. Music level was balanced using actual PCM; subjective listening acceptance is explicitly pending.
- First full browser run passed all 22 tests (1.8 minutes), including original controls/VFX/debug/collisions/touch/production, real gesture/context/output, steering modulation, pause/mute/focus silence, settings/reload, missing/rejected audio, five restarts and native OfflineAudioContext rendering. The peak acceptance remains below 0.95 at maximum volume with six destruction voices; mute tail below 0.00001. Exact final results are generated into review logs/manifest.
- Actual browser diagnostics measured 3,304,856 cached PCM bytes, one context/graph across five restarts, 12 normal impacts / 6 final destructions / 6 transitions and six total GLB downloads. Initial matched audio-enabled RAF remained 16.7 ms in both viewports with unchanged render counts; separate audio update p95 was 0.2 ms desktop / 0.1 ms emulation, with medians below timer resolution. These are short local samples, not DSP/physical-phone performance claims.
- Review metadata now uses PHASE-3-003/full approved baseline, current audio architecture/design/lifecycle/performance reports, actual settings/production screenshots, native generated PCM previews with provenance, live/offline/restart JSON, Git remote metadata and matched measurements. Existing committed-blob snapshot/binary patch/path/credential/integrity protections remain. Delivery is limited to the feature branch; final package identifiers/check results are reported by delivery tooling.
- Manual listening checklist is in `review/PHASE-3-003/AUDIO-DESIGN.md`; no subjective listening or microphone recording is claimed. Physical phones, speaker/headphone balance, Safari/Firefox and sustained heap/DSP behavior remain unverified. Overall Phase 3 stays open for manual presentation/game-feel acceptance; Yandex SDK/release work remains out of scope. Main is not pushed or merged.
- Final pre-commit `npm run review:verify` passed all nine checks: strict typecheck, **53 unit tests**, build, **23 browser tests** (1.9 minutes), diff/static safety, build attribution, collision audit and matched audio-enabled performance. Runtime AudioNode failures are now contained at the manager boundary; mocked and actual browser fixtures verify playable fallback, cleanup and valid-gesture retry. Build: **758,188 bytes / 11 files**, JS **662,310 bytes**, Node gzip **169,374 bytes**; total increase **15,727 bytes / 2.12%**. Final native maximum-volume stress peak **0.6672304**, mute tail RMS **0**. Seven current UI/fallback/production images were inspected; two actual native PCM previews are included for owner listening.

## PHASE-3-004A — UI art direction and concept exploration, 2026-10-23

- Read complete AGENTS/master and current project/tasks/assets/release/collision docs; inspected production HTML, HUD/styles, SoundPanel, browser tests, screenshots and review pipeline. Clean main was approved `5efda476f725df038bfb46ebbf9d65aaec2b646f`; `git fetch origin` confirmed main/origin-main 0 ahead / 0 behind. Created the explicitly requested `feature/phase-3-ui-concepts` branch.
- Studied actual reference screenshots in the browser: Flippfly's clean Race the Sun gallery and early developer HUD image, Bad Potion's Hyperburner Flight Basics, Sony's WipEout gallery and the separately attributed HUD reference. Original URLs/observations are in `design/UI_REFERENCE_RESEARCH.md`; transitions are proposals, not claimed measurements. No proprietary reference images were bundled.
- Approved official download of Oxanium 500/700 and IBM Plex Mono 400, three unchanged TTF files / 185,564 bytes. Complete OFL notices, authors/source/date/hashes are recorded. No dependencies were installed or changed; production has no added font requests/assets.
- Added isolated HTML/CSS/JS studies in `design/ui-concepts/`: A Flight Instrumentation, B Arcade Racing and C Isolation Minimalism, with all four required desktop states. A adds four portrait/four landscape states, three audio layouts and loading/error/damage studies. They use six actual canvas captures of the approved game at menu/route-42 150m; provenance includes model values, browser, viewport and SHA256. State transitions/settings are explicitly preview-only, silent and nonpersistent.
- Recommend A for its restrained cyan, angular title, clear action and open active center. Wrote art direction, tokens, comparison/visual findings, research and implementation guide. Proposal is not owner approval. Added the requested concise repository skill with the built-in skill-creator workflow and validated it.
- Rendered/inspected 29 concept/comparison PNGs. Fixed initial background capture overlap, landscape hint encroachment, unnecessarily scrolling landscape audio, full-page comparison cropping, responsive heading spacing and the pause glyph. First concept diagnostic correctly failed the flight-area check; subsequent runs pass. Actual attempt logs are retained under the ignored review cache.
- The staged whitespace check found a trailing space in the official Plex notice. Kept both font notices verbatim with a font-notice-only `-text -whitespace` attribute; authored code/docs retain normal checks. Downloaded and committed font/license bytes are hash-checked before delivery.
- `src/`, `public/`, production `index.html`, package manifests and build config are unchanged. Diagnostics compare all **45 production inputs** with the approved Git baseline, verify source capture hashes, reject prototype/font production inclusion, and check native dialog focus/return, keyboard/touch preview navigation, slider/mute, control sizes/fit, local requests and central HUD reservation. Five solid-color contrast samples range from 9.49:1 to 17.79:1; translucent moving scenes still require player review.

### Executed commands and results

| Command | Actual result before milestone commit |
| --- | --- |
| `git status --short`; `git fetch origin`; `git rev-list --left-right --count main...origin/main` | Clean baseline; fetch exit 0; `0 0` |
| `git switch -c feature/phase-3-ui-concepts` | Exit 0; requested branch created |
| `node scripts/ui-capture-backgrounds.mjs` | Exit 0 after capture-method correction; six approved-game PNGs and provenance |
| `python C:/Users/artem/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/space-runner-ui-design` | Exit 0; `Skill is valid!` (Python 3.14.0) |
| `node scripts/ui-concepts-verify.mjs` | Initial flight-area assertion failed; corrected runs exit 0; 29 PNGs, 12 diagnostic groups and five contrast measurements |
| `npm run review:verify` | Exit 0; all eight commands below passed |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0; 53 passed / 0 failed |
| `npm run build` | Exit 0; 11 files / 758,188 bytes; unchanged JS 662,310 / Node gzip 169,374 bytes |
| `npm run test:browser` | Exit 0; 23 passed (1.9 minutes), installed Chrome 155.0.8059.85 |
| `git diff --check` | Exit 0 |
| `node scripts/review-static.mjs` | Exit 0; no detected known credential signatures |
| `node scripts/build-analysis.mjs` | Exit 0; unchanged Three.js chunk advisory |

Review configuration now targets this task/full approved baseline and 29 current design screenshots. The existing packer retains committed source/binary patch/metadata/logs/inventory protections and additionally checks each design screenshot against its diagnostics hash. Delivery uses a clean tested feature commit, feature-only push and a reopened integrity-checked ZIP; generated manifest identifies exact HEAD/branch/checks/hash. No merge/main push or production UI integration is authorized. Physical devices, moving-hazard design acceptance, localization, subjective listening and owner concept approval remain pending; overall Phase 3 stays open.
