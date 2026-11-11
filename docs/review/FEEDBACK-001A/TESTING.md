# Verification and reproduction

Run with the existing dependencies and installed Chrome:

```powershell
npm run typecheck
npm test
npm run build
npx playwright test --project=feedback
npx playwright test
node --experimental-strip-types scripts/feedback-preservation.mjs
```

No lint script/config exists. `git diff --check` checks whitespace, not lint.

## Recorded checks

- TypeScript and production build pass; Vite's large-bundle advisory is retained.
- Unit suite: **318/318**, no skipped/cancelled tests. Coverage includes subscriptions,
  FIFO, removal/snapshot rules, immutable context, recursion, saturation/error
  isolation, real damage/death, immunity, simultaneous priorities, 50 coordinator
  resets, pause/time, exact rewards, records, camera recovery at 30/60/144 Hz,
  audio mute/variation/async reset, and existing GPU disposal/gameplay tests.
- Seeded Integrated comparison: 3,600 fixed ticks per seed 0/42, subscribed feedback
  versus unsubscribed simulation. Ship, field/ledger/certificate, mine, pickups,
  health, score/distance and publication state match exactly.
- Focused native Chrome: **2/2**, natural published pickup followed by controlled
  actual collision contacts, exact channel counts, immunity, pause/resume, single
  death/end, results/replay and 10 resets with stable GPU counts, pool identities and
  subscriptions. Mobile reduced-motion/mute behavior also passes.
- Preservation: all **126** baseline runtime/asset/config paths audited; **115**
  unchanged. Eleven adapter changes are allowlisted. Every original GameModel line
  matches after removing only labelled additive hooks; camera/control/collider/
  generator/director/validator/reward/asset/dependency inputs remain unchanged.
- Final full native Chrome suite: **109/109 pass in 11.3 minutes**, zero unexpected,
  flaky or skipped cases. This is one complete successful run, not aggregated
  isolated retries. All existing production, controls, camera, generator, mine,
  station, VFX, audio, touch and UI projects are included alongside the new project.

The first sandbox-only browser launch did not reach tests and was stopped; approved
native Chrome/local-server execution was then used. The first full native run passed
107/109; two audio cases completed their gameplay/audio assertions but failed writing
`audio-live.json`/`audio-restarts.json` because REVIEW_RESULT_DIR did not yet exist.
The original log, JSON result and exact ENOENT contexts are retained. The directory
was initialized before repeating the full suite; no runtime/test assertion changed.
An early 316-test pass preceded two added audio edge tests; the final 318-test log
supersedes it. Unavailable attempts are not counted as passing tests. No runtime
setting or timeout was relaxed.

## Actual browser evidence and limits

`browser-lifecycle.json` records the natural seeded pickup, then deliberately arranged
collision positions/cooldown through the original collision/damage path. Screenshots
are real Chrome renders of pickup, damage, pause, destruction, replay and mobile mute.
The assistant visually inspected pickup/damage, mobile and results images. Arranged contact screenshots
are not represented as natural obstacle-generation evidence. Existing production,
keyboard/touch and gameplay browser tests exercise ordinary entry points.

This is native browser automation plus visual review, not human owner acceptance or
physical-phone testing. Ten stable restarts are bounded evidence, not a universal
long-duration no-leak proof.

## Performance reproduction

Run sequentially after browser tests finish:

```powershell
node scripts/feedback-performance.mjs freeze
node scripts/feedback-performance.mjs measure
```

The exact baseline is frozen/built inside ignored `.cache`, then compared with the
candidate in sequential production Chrome cases: desktop/portrait, 900 warmup fixed
ticks, 600 native RAF frames, two fixed steps/frame and the existing certificate pilot.
`performance.json` retains raw intervals, CPU, calls, resources and endpoint state
hashes. This small desktop sample does not establish physical-phone performance.

Measured sequentially on the same Chrome, with all other test browsers idle:

| Viewport | Base → candidate RAF p95 | Base → candidate step+render CPU p95 | Max draw calls |
| --- | --- | --- | --- |
| 1280×800 | 16.9 → 16.9 ms | 3.1 → 3.0 ms | 28 → 28 |
| 390×844 emulation | 16.9 → 16.9 ms | 2.8 → 3.1 ms | 28 → 28 |

All 2,400 measured frames and four raw cases are retained. Endpoint complete-state
hashes match between base/candidate for each viewport. Candidate mailbox drops: zero.
This sample finds no RAF regression; the 0.3 ms portrait CPU p95 increase and higher
candidate maximum CPU times (8.1/9.0 ms versus 7.4/7.1 ms) are retained, not presented
as a speedup or a universal performance guarantee. Ten-reset lifecycle evidence is
separate from this fixed-cadence performance comparison.
