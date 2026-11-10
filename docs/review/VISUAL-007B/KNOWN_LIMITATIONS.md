# Known limitations and historical browser failures

The 007A full run had 102/105 passing cases, then three isolated passes. It is
not treated as a clean full run. Original full/focused logs are retained in the
007B review evidence. Exact failures:

1. `visuals.spec.ts:55` accessed removed `collisionDebug.lamp.visible`, causing
   a TypeError. This was a stale mesh-hierarchy assertion after the intentional
   007A redesign. 007A already replaced it with actual signal colors, retaining
   exact warning tick, hull, reveal and pause checks. 007B preserves that test
   and the mine implementation unchanged.
2. `integrated.spec.ts:3` exhausted its existing 120s test timeout at the first
   UI pause click after completing the synchronous 2200m replay with hull3.
   The same test passed in 23.9s in isolation. The session also ran CPU-heavy
   unit tests and two capture browsers during that original two-worker run.
   This supports contention/timing as the cause; the original trace does not
   prove a unique hardware cause. No timeout or runtime safety budget is relaxed.
3. `audio.spec.ts:9` expected a passive seed11 flight to reach 510m within 45s;
   the recorded page had naturally died at 366m. The isolated repeat reached
   516m and passed in 32.5s. Native render/planning cadence can change the actual
   admitted field; seed alone does not fix a native RAF schedule. No invulnerability,
   hazard suppression, different seed, test deletion or timeout extension is used.

The final 007B full suite runs with one worker (the repository default), with
other tests/captures/performance tools idle. Final result:107/107 passed in one complete run (12.1 minutes), zero unexpected,
flaky or skipped cases. This is a clean full run, not aggregate isolated coverage.

The first new wing-art probe incorrectly expected hull3 on both authored routes.
The left route collects successfully but takes a real contact before pickup.
An independent replay on frozen 007A confirms hull2 / left-wing pickup at tick1510,
versus hull3 / right-wing at tick1511. The new assertions now pin those exact
baseline outcomes; pickup must not heal or suppress the existing contact.
`wing-test-baseline.json` and the initial focused log are retained.

The first 007B full run reused the long-lived owner dev server after HMR edits.
Two ordinary-Launch observer tests imported `/src/game.ts`, while the app used
`/src/game.ts?t=1794300669555`. Network traces contain both module identities.
Their prototype patches therefore observed a different constructor: the actual
HUD was playing, but the test's captured instance was undefined. This differs
from 007A's long integrated timeout. A fresh Vite server clears that HMR graph;
the complete suite is repeated with the original assertions/timeouts unchanged.
The two bootstrap callbacks now import the Game URL actually present in the
browser resource timing entries, rather than creating a separate bare-path
module. This fixes observer ownership under HMR without changing any gameplay
assertion, seed, timeout or runtime source. The initial full result is105/107;
its log, contexts and module-URL evidence are retained.

Physical phones and owner preference are unverified. Capture/probe browser
emulation is not a phone benchmark. Existing occasional compilation/RAF stalls
and the Vite large-bundle warning remain. No Yandex SDK or production release
work is included. A single sequential performance sample does not establish a
speedup or isolate causality for small timing differences.

A shader-performance investigation found a155ms first-use peak in the initial
vertex-color prototype. The next full-suite attempt was interrupted before
completion so that this regression could be fixed first; it is not counted as
a full pass. Its partial log and the old performance data are retained. Final
materials reuse existing standard shader paths. All final captures, measurements,
unit checks and the final complete browser suite are regenerated for that model.

Final evidence:305/305 unit tests,107/107 browser tests, strict typecheck and
production build pass. Source preservation covers122 inherited inputs; all54
captured states and three performance endpoints match. All five station buffers
and the pickup-burst geometry match007A. Physical phone and owner acceptance
remain outstanding. No production merge/deployment is performed.
