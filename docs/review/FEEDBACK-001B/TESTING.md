# Testing and reproduction

```powershell
npm run typecheck
npm test
npm run build
npx playwright test --project=damage --project=feedback --project=audio --project=vfx
npx playwright test
node --experimental-strip-types scripts/damage-preservation.mjs
node --experimental-strip-types scripts/damage-scenarios.mjs
node scripts/damage-capture.mjs
node scripts/damage-performance.mjs freeze
node scripts/damage-performance.mjs measure
node scripts/damage-performance.mjs measure-heavy
node scripts/damage-performance.mjs measure-memory
```

When setting REVIEW_RESULT_DIR, create it first: the existing audio tests write their
JSON there. No lint command/config is present; `git diff --check` checks whitespace.
No dependencies/assets are downloaded. Chrome/local preview execution uses the
approved native permission because local-server/browser access needs it in this host.

## Recorded checks

- Final browser validation resumed on2026-11-13 after the host session interruption.
  The prior process ended after80 passing cases without a final JSON; its preserved
  `browser-interrupted-2026-11-11.log` is not counted as a complete passing suite.
  All349 frozen runtime/test/script inputs still matched before the complete rerun.
- Final complete native Chrome suite:113/113 actual passed statuses, one worker,
  777.23s (13.0min), on2026-11-13. Zero skipped, unexpected, flaky or global runner
  errors. `browser-full.log` and `full-browser-results.json` are the final receipts.
- Unit suite325/325 passed. New tests use the actual shipped GLB and verify HP stages,
  persistence/reset, cloned-material isolation, every original triangle partitioned
  once, identifiable sections, sequence cancellation/skip/pause, family selection,
  mine identity/pose retention, capacity saturation, FPS independence and exact-once
  disposal. Existing health/collision/generator/mines/control/determinism tests pass.
  Final ownership audit added explicit instance-buffer disposal for the three
  collision batches and the small ship-debris batch, with exact-once assertions.
  The in-progress browser run was stopped before this correction; its log remains
  labelled `browser-before-disposal-audit.log` and is not the final passing receipt.
- Focused native Chrome initially18/19. One new held-RAF lifecycle fixture measured
  before the existing engine trail's first GPU upload (39→40 geometries); this was
  not growing resources over repeated deaths. A normal presentation frame now warms
  that fixture before the unchanged strict count assertion. The repeated four-test
  damage project passed4/4, including ten resets, touch/keyboard skip, mute/reduced
  motion in both orientations, hidden-tab freeze and real WebGL loss/restoration.
- Dedicated typecheck and production build pass. Vite transforms112 modules; final
  JS841.88kB /225.15kB gzip, CSS15.88kB /4.31kB gzip; build1.56s. The existing
  >500kB bundle advisory remains. `build.log` retains the complete output.
- The first full browser attempt exposed an old adaptive-mine fixture that stops
  RAF, reaches real death, then clicks the now-hidden replay without advancing the
  presentation clock. It was stopped after that120s timeout. An audit found the same
  pattern in both pressure-policy fixtures; each now uses the real skip button after
  retaining its original immediate GAME_OVER/HP assertions. All three targeted
  cases pass3/3 with original timeouts and no simulation edits. Original log/context
  are retained; interrupted coverage is not counted as a complete passing suite.
- Preservation checks130 baseline runtime/asset/config paths:120 unchanged; ten
  presentation/observation/UI adapters allowlisted. The entire001A GameModel matches
  after removing exactly its one additional copied pose line. Physics/collision
  kernels, generator/director/validator, mine control, movement, tuning, rewards,
  licenses/assets and dependencies are unchanged.
- Final sequential performance matrices measure9,120 native RAF frames across20
  baseline/candidate cases and80 natural death/reset replays. Every paired serialized
  gameplay-endpoint hash matches. GPU resources/subscriptions stay stable over each ten
  replays; comparative JS heap growth is disclosed in PERFORMANCE.md and raw data.
- All five authored JavaScript tools parse, the Python packaging tool compiles, and
  both tracked/cached whitespace checks pass. No lint configuration is present.

The old `endRun` browser helper still asserts immediate authoritative GAME_OVER, then
waits for the deliberately deferred results overlay. The held-RAF001A integration
test now advances the full presentation clock and checks that the secondary cue waits;
its repeated-run cases explicitly skip. Health, effect uniqueness, resource bounds,
mute and other assertions are retained. No timeout or gameplay safety budget changed.

## Visual evidence

Final captures are unmodified production gameplay, with original published hazards
and input-only pilots. Controlled contact fixtures are confined to tests/probe tooling,
not a production mode. See VISUAL-REVIEW.md and raw receipts for the distinction.
Type/build success is not used as proof of visual quality. Native screenshots were
actually inspected, and a browser recording is included. No human owner acceptance,
physical-phone testing, microphone capture or subjective sound-quality test is claimed.

Original failed fixture log/context, final results JSON, native audio observations,
build/test logs and the independent packaging inventory are retained in the ZIP.
