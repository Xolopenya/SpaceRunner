# PHASE-3-004A implementation and review guide

Baseline: `5efda476f725df038bfb46ebbf9d65aaec2b646f`. Branch: `feature/phase-3-ui-concepts`. This is an isolated visual exploration; owner approval remains pending. Recommendation: A — Flight Instrumentation.

## Scope and ownership

`design/ui-concepts/prototype.html`, `prototype.css` and `prototype.js` implement three screen studies. One small module owns review state and ephemeral settings; native dialog owns focus containment. A real screenshot and recorded state manifest supply each scene. There is no import of Game, World, core, AudioManager or SoundPanel, no game storage writes, and no framework/dependency installation. Buttons navigate screen previews rather than start another game instance.

`index.html`, the entire `src/`, `public/`, package manifests and build config remain unchanged. Fonts/captures live outside public and the entry graph, so the ordinary production build remains the approved 11 files / 758,188 bytes. Existing playable controls, physics/collisions, rendering, VFX, audio and game loop retain their original ownership and implementation.

## Reproduction

1. Use Node >=22.12 and the existing locked dependencies; `npm ci --ignore-scripts` if needed.
2. `npm run dev`, then open `/design/ui-concepts/`. Inspect individual frames at full size; review navigation remains visibly labelled.
3. `npm run build`, then `node scripts/ui-concepts-verify.mjs` for actual current screenshot/interaction evidence. Installed Chrome and local socket access are required.
4. `npm run review:verify` runs full existing regressions and the design check. After a clean tested commit, `npm run review:pack` repeats checks against committed sources and produces the review ZIP.

`ui-capture-backgrounds.mjs` is a separate deliberate capture tool. It temporarily hides DOM siblings in the test browser, captures the actual canvas at menu and a natural route-42 150m freeze, restores UI, and records baseline/browser/values/hashes. Do not regenerate the committed references during packaging. These images are project screenshots, not downloaded reference-game assets.

## Packaging

The existing committed-blob snapshot/binary patch/metadata/raw-log/hash-inventory pipeline is reused. A small optional design diagnostics attachment verifies every rendered PNG against its current diagnostics hash before inclusion. All 29 screenshots and complete comparison pages are included. Fonts and complete OFL notices are in the snapshot. Research screenshot URLs remain links, not bundled proprietary artwork. No dependencies, dist, .git internals, secrets, caches or old review archives are included.

## Validation boundaries

The design script verifies all required states at 1440×900, A at 390×844 and 844×390, launch/pause/resume/replay previews, touch launch/mute/close, slider values, Escape/P, focus return, target fit, local-only requests, background SHA256, solid-surface contrast and a central 60% HUD reservation. It emits actual image hashes and production-file hashes. These checks supplement visual inspection; they cannot establish player preference, moving hazard readability, physical safe areas or accessibility conformance.

Existing unit and browser suites remain intact and exercise actual playable flight/audio separately. The missing-model regression intentionally creates and recovers from an HTTP 404. Physical devices/Safari/Firefox and subjective listening remain unverified. Exact current command exits/test counts are in TASKS and packaged verification logs; no production concept integration, merge or main push is part of this task.
