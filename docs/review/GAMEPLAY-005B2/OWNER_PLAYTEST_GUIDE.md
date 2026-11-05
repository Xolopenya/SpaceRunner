# GAMEPLAY-005B2 — owner review

Feature `feature/gameplay-005b2-visual-collision-polish`, baseline80e987d7804b663d1c8bf2080fa116ef63b667de. No main merge, force-push or deployment. Owner acceptance is not claimed.

## Play

`npm ci --ignore-scripts` (when dependencies are absent), `npm run dev -- --port 5173 --strictPort`; open http://127.0.0.1:5173/. WASD/arrows, mobile drag, Esc/P pause, restart from pause/game-over; existing sound controls remain. Ordinary Play includes the three corrections without diagnostic UI.

DEV comparison: http://127.0.0.1:5173/?debug=visuals&seed=0&colliders=1 . Existing boundary/reveal choices and the station-occlusion button change presentation at the same state. Wires display the authoritative new spheres and a recorded real hit. Debug labels do not enter the production build.

For pickup/physics A/B, use exact frozen baseline plus deterministic input recordings, rather than changing a live collider under a previously certified route. The task explicitly permits reproducible recordings instead of a large settings system. Run `node scripts/polish-freeze.mjs`, then serve `.cache/review/GAMEPLAY-005B2/baseline-project` with Vite on5194; the feature is served on5195 by the capture script. `polish-scenarios.json` records seed0 and every ordinary input for both genuine wing hits, the corrected lower graze, body/wing/deliberate-miss/Phase2 pickups. `node scripts/polish-capture.mjs` replays both sources and captures them. This is a source-level A/B: changed future publication is possible and is recorded, not hidden.

## Review package

Start with CORRIDOR_OCCLUSION.md, PICKUP_CALIBRATION.md and WING_COLLIDER_CALIBRATION.md, then FAIRNESS.md /PERFORMANCE.md. `project_snapshot/` is the exact committed source, `changes/` contains full binary patch and Git identity, `logs/` contains original results/inputs, `screenshots/` and `videos/` contain native Chrome captures. Inventory SHA256 covers each packaged item; external verification records ZIP CRC and bidirectional complete-tree patch checks. Build output, dependencies, raw video caches, old review ZIPs and preserved user files are excluded.

Recommended evidence:

1. owner-reconstruction-right-25-before/after.png: bright warp against a real station panel, localized gap after correction. All four boundary pairs and all five aperture approach/pass pairs are also included. The original screenshot was not attached; this is the described-situation reconstruction.
2. baseline/final-lower-near-miss.webm: same accepted asteroid/input history, hull2→hull3; compare clean images and settled multi-angle profile overlays.
3. final-left-wing-hit.webm and final-right-wing-hit.webm: genuine body-clear hits still cost one hull point. Inspect banked profile shots to understand the remaining cosmetic mismatch.
4. baseline/final-pickup-body, pickup-wing, pickup-deliberate-miss and pickup-phase2 videos:0→1,0→1,0→0,0→1 respectively.
5. normal-integrated-clean.webm: ordinary Play with Phase2, a station pass, mine and pickups, hull3, without a debug URL or overlays.
6. fixture-station-wall-block.webm: clearly labelled invalid-placement reward tests occlusion inside an accepted station. It is a defensive fixture, not a natural reward-placement claim.

Videos are silent native browser captures. Event clips run two120Hz ticks per native RAF after an accelerated prefix; wall-clock cadence can vary with host load. The separate performance run has no capture/test workload. No frame, geometry or collision event was painted into an image.

## Reproduce checks

`npm run typecheck`, `npm run test`, `npm run build`, `npm run test:browser`, `git diff --check`.

Diagnostics: `node --experimental-strip-types scripts/collision-audit.mjs`; `node scripts/polish-preservation.mjs`; `node --experimental-strip-types scripts/polish-audit.mjs`; `node --experimental-strip-types scripts/polish-analysis.mjs`; `node --experimental-strip-types scripts/polish-matched.mjs`; `node --experimental-strip-types scripts/polish-measure.mjs`. Then scenarios/capture/detail-capture/corridor-probe/clean/performance scripts; polish-cost.mjs measures isolated CPU kernels. Baseline extraction requires the supplied Git commit; a standalone source review can reconstruct it by applying the included patch in reverse to a separate HEAD snapshot.

For video recording on this workstation, set PLAYWRIGHT_BROWSERS_PATH to the repository's existing `.cache/playwright` (FFmpeg is already installed there). Browser scripts use installed Chrome and local Vite only. No additional asset download is required.

## Manual decisions still needed

Assess the panel/warp termination in motion, Phase2 grazing pickups, deliberate bypass, both real wing hits, lower clear pass and hard-banking mismatch on your desktop/phone. Three fixed spheres deliberately remain an arcade approximation; no physical-phone approval, exhaustive seed proof or perfect mesh alignment is claimed. All changes remain on the review branch until separate merge/deployment authorization.
