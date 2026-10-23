# Generator validation plan — GAMEPLAY-001B

This file specifies future tests. It does not report them as executed. Actual GAMEPLAY-001A results are in [the audit](CURRENT_GENERATOR_AUDIT.md), TASKS and the review logs. No existing assertion is weakened. Run the current typecheck, unit, build and browser suite unchanged for this research milestone.

## Existing evidence and research reproduction

`node --experimental-strip-types scripts/generator-research.mjs` directly imports the shipped field, collision query, difficulty and Ship. It verifies protected-source equivalence, 16×600s fixed-step streams, exact seed42 replay, restart array identity, spawn bounds, safe-corridor clearance, permanent X±2 clearance and active limits. Outputs are `generator-baseline.json`, `generator-seed42-events.json` and four clearly labelled diagrams. The latter distinguish actual old-field data from hand-positioned proposed concepts. Its timing is not a future planner benchmark.

The mandatory seed corpus is `0,1,2,3,7,11,23,42,64,127,255,1024,4096,65535,2147483647,4294967295`; preserve it for before/after aggregate comparisons. Add `0..255` for stress, with explicit generator version. State-aware generation requires matching fixed-tick input history, not seed alone, to reproduce an accepted layout.

## Deterministic and structural tests

Use real candidate builders, integrated dynamics, shared collision queries and actual generated configurations. Mocks may inject a work-limit condition, but may not replace the acceptance algorithm.

| ID | Scenario / required assertion |
| --- | --- |
| D01 | Same seed/version/input ticks → identical director, proposals, accepted IDs/poses and fallback decisions |
| D02 | Different render cadence with identical fixed simulation inputs → identical world; pausing creates no extra cells |
| D03 | Restart resets frontier/IDs/epoch/history/counters/RNG/work buffers and reuses all existing hazard slots |
| D04 | Every generated center, radius and catalog/profile/visual mapping obeys its metadata; finite values only |
| D05 | Every pair obeys separation across cell/pattern seams; duplicate half-open-boundary IDs rejected |
| D06 | Ambient plus pattern counts consume one quota; hard active32/allocated72 and bounded scratch remain invariant |
| D07 | Pool exhaustion/horizon overrun/work-limit never partially publishes or drops a previously certified object |
| D08 | Pattern cooldown/entry/exit rules and capped/asymptotic director parameters hold after hours of simulation |
| D09 | Fixed bounded retries use keyed substreams; a rejected cell does not shift future proposal randomness |
| D10 | Fallback and stale-root paths preserve committed geometry; no teleport, immunity credit, forced death or hidden health edit |
| D11 | At speed34, minimum48-unit transactions and144-tick deadlines sustain the generation frontier; full-pattern reservations, bootstrap and omissions cannot create a growing queue or recurring empty runway |

Golden records include quantized-for-reporting poses plus full-precision replay hashes. Reporting quantization must not enter simulation or collider acceptance. Verify exact hashes within a supported engine/version; separately characterize cross-engine floating differences before claiming portable bitwise replays.

## Reachability fixtures and expected outcomes

Distinguish **replaying a particular witness** from **finding some path in a layout**. An obstructed straight line does not make an entire open playfield unreachable. Positive fixtures must supply an independently replayable known control sequence; the bounded search is required to find it or trigger a documented search-cap revision before shipping.

Use root `(x,y,vx,vy)=(0,0,0,0)` with neutral held input and maximum forward speed34 unless a fixture specifies otherwise; actual dt1/120, prefix0.45s, player radius0.42 and proposed margin0.15. Engineered barrier fixtures may intentionally violate generator separation so the validator itself is tested; they are never proposed production patterns. For example, 16 round hazards with X=`0,1.8,3.6,5.4`, Y=`−3.15,−1.05,1.05,3.15`, radius1.1, center-pass distance68 cover the right side but leave an attainable left path. Mirror for right. Their synthetic overlap is intentional.

| ID | Fixture | Expected result and reason |
| --- | --- | --- |
| R01 | Empty field, legal state including residual velocity; neutral braking tail | Accept a replayed bounded continuation; no artificial vx=vy=0 reset |
| R02 | Rock at X3/Y0/pass68, ship at0/rest | Accept straight witness; true clearance is sufficient |
| R03 | Right-side engineered barrier at68 and mirrored version | Accept left/right known trajectories from rest, with no instantaneous position changes |
| R04 | Upper-side barrier spanning X, mirrored lower barrier | Accept known down/up trajectories; tests genuine Y reachability |
| R05 | Alternating clear sides with sufficiently separated pass distances | Accept continuous position/velocity witness across both |
| R06 | Two 16-object opposite-side barriers at68 and71.4 | Reject union: individually possible moves require incompatible XY states only0.1s apart; max speed8 cannot bridge the gap |
| R07 | Full-plane sphere grid covering all legal XY, within context cap | Reject zero-hit certificate; do not spend invulnerability/hull |
| R08 | Center rock at pass5 while held input remains neutral during prefix | Reject: contact occurs before response is permitted |
| R09 | R03 with initial vx=+8 rather than0 and a shortened pass distance34 | Reject if the explicitly replayed delayed-reversal fixture has no route; compare to the attainable rest case rather than resetting vx |
| R10 | Two sphere centers X±1.8/Y0/pass68/r1.1 | Accept straight narrow-gap witness with margin; test exact tangency separately |
| R11 | Same pair at X±1.5 | Reject straight replay; whole layout may accept a side/vertical bypass and must not be called impossible |
| R12 | Large sphere near X/Y boundary, velocity toward it | Reject colliding witness; allow only a demonstrated inward alternative with actual braking |
| R13 | Half-meteor r1, phaseπ, spin0; straight relative Y1.1 across Z | Accept the calibrated-box straight witness at margin0.15; a visual/outer-sphere-only checker would incorrectly reject it |
| R14 | Round meteor with the same relative Y1.1 | Reject that straight witness; candidate search may still find another route |
| R15 | Rotating barrel/generator with simultaneous sphere/box interval and mid-step contact | Reject colliding witness; include the existing old-time-interval and rounded-corner regressions |
| R16 | Position-identical roots with opposite vx/vy at a segment boundary | Different reachability as appropriate; never merge only by position |
| R17 | Valid snapshot witness, then changed root input/position/time before publication | Publish only if the current-state independent replay passes; otherwise reject without moving committed obstacles |
| R18 | Hazard with collision opportunity just beyond an arbitrary fixed horizon | Extend within cap or reject; do not declare a safe terminal state before it |
| R19 | Speed-ramp boundary at120s, high spin/size, overlapping depth intervals | Compare prediction tick-for-tick to actual GameModel/field queries |
| R20 | Unknown proxy, invalid metadata, nonfinite state, exhausted work budget | Reject/omit with explicit reason; never report mathematical unreachability from a timeout |

For R06, every legal Y is at most1.05 from a row center, so at each plane the left/right clearance requirement differs by at least `2*sqrt(1.67²−1.05²)=2.597` units. The ship can move at most0.8 horizontally between center times0.1s apart. This independently establishes the union's impossibility under the margin contract. R09's rejection expectation concerns an engineered no-bypass barrier and delayed response, not every single obstacle with that velocity. Complete concrete positive/negative control traces in B-2 and verify them against the unchanged real dynamics before freezing goldens. Add perturbations around tangency, walls, 0/π phase splits and macro boundaries. Differential-test default-margin queries against the pre-extraction implementation on at least10,000 sweeps; test monotonicity when margin increases. Query failures are safety failures, not flaky tests to relax.

## Stress and performance gates — proposed, not measured

Run 256 seeds×1024 ownership cells (262,144 cell attempts), with stationary, corridor-like, diagonal, oscillating and recorded input policies. Add four 24-hour collision-independent director/field runs and chunk-boundary precision tests. Save per-seed aggregates and a small reproducible failure context, not a huge telemetry database.

Measure proposal rejection, each rejection reason, base-uncertified states, replay failures, omission/fallback frequency, active count, depth-gap distribution, coarse pattern diversity, verified witness minimum clearance, switch count, reaction reserve, operation counts, actual validation latency, and retained memory after restarts. Report median/p95/max plus seed/policy and sample size. Separate human-caused already-uncertified states from candidate-induced certificate failures.

Initial acceptance targets for review:

- Zero accepted witness collisions or invalid terminal/seam states; independent real-model replay agrees with every certificate.
- Zero changed movement/camera/health/scoring/audio/UI/VFX behavior outside explicitly approved generator integration; all old tests retained or deliberately migrated with equivalent guarantees.
- Normal/advanced omission ≤1%/3% on eligible viable-root corpora. If not met, reduce pattern complexity or revise search; do not lower collision safety.
- Settled-run nearby axial-slab empty fraction ≤45%, compared with old whole-run70.5%; also report old/new on the **same** 120–600s window before claiming improvement. Normal/recovery center-depth gaps ≤48 units except explicit bootstrap/certification omissions, all reported.
- Same-depth-neighbor fraction <15% and no source-invariant permanently safe X stripe; multi-seed fixed-X/Y probes are evidence, not a proof that every stationary policy eventually dies.
- Main-thread planning-chunk p95 ≤2ms desktop / ≤4ms on named midrange phone, terminal publication replay included separately; no added long task >16ms. These are targets awaiting hardware measurements.
- Bounded allocated memory, proposed planner ≤512KiB, active hard32 and no new GLB downloads/geometry growth across repeated starts. Record both allocation and retained-heap methodology; do not infer memory from record count alone.
- Ordinary rendered game stays comparable to baseline input latency/RAF/resource behavior with the new natural active counts. A held six-object rendering fixture alone is insufficient.

The safety acceptance is hard; other targets require review and real device evidence before tuning is finalized. Do not replace a failed deadline with an unbounded synchronous search. The proposed operation/publication schedule must be deterministic even if a browser is slow.

## Human playtest checklist and local metrics

Compare old/new builds with the fixed seed corpus, alternating order. Begin with at least five people covering novice/experienced keyboard and touch control; record platform/viewport/input and anonymous aggregate observations, no personal identifiers or analytics service. A larger sample is needed for preference claims.

Observe time without a meaningful obstacle, large steering adjustments, chosen horizontal/vertical routes, late visibility, perceived walls, unclear collision footprints, damage, run duration, restart count, voluntary close passes, recovery quality and frustration. Automated hazards/minute, center-depth gaps, proxy clearance and input switches are **proxies**, not counts of meaningful human decisions. Damage/death/run duration require a specified controller or actual play; unconditional field counts cannot substitute for them.

Use local CSV/JSON with seed/version/tick context, input changes, contacts and minimum proxy separation. No account, backend or personal telemetry. Check portrait readability and that moving through a certified route feels reasonable without being shown an artificial safe corridor. Require visual/player acceptance in addition to numerical certificates before retiring the old generator.
