# Current generator audit — GAMEPLAY-001A

Research baseline: `f1a651e5d2a6079aadf51a31e6ca929e25bf0d31`, verified clean local/fetched main on 2026-10-23. This describes the shipped system. No production source or tuning changes are authorized in 001A. Proposed behavior is in [the architecture](CONTINUOUS_FIELD_ARCHITECTURE.md).

## Authoritative implementation

| Source | Actual responsibility |
| --- | --- |
| [config.ts](../../src/config.ts) | Movement, difficulty, pools, spawn planes and corridor budget inputs |
| [obstacles.ts](../../src/core/obstacles.ts) | `Hazard`, `Wave`, `ObstacleField`, `corridorTravelBudget` |
| [random.ts](../../src/core/random.ts) | Seeded unsigned 32-bit LCG |
| [ship.ts](../../src/core/ship.ts) | Continuous XY control, velocity approach, combined cap and boundary clamp |
| [game-model.ts](../../src/core/game-model.ts) | Step ordering, forward distance, health, relative sweeps and restart |
| [hazard-profile.ts](../../src/core/hazard-profile.ts), [hazard-collision.ts](../../src/core/hazard-collision.ts), [collision.ts](../../src/core/collision.ts) | Actual calibrated logical proxies and continuous queries |
| [world.ts](../../src/world.ts), [catalog.ts](../../src/assets/catalog.ts) | Pooled visual slots, variant/orientation agreement; no generation policy |
| [simulation.test.ts](../../tests/simulation.test.ts), [collision.test.ts](../../tests/collision.test.ts) | Existing determinism, corridor-following, dynamics, CCD and real-model tests |

## Scheduling and spatial mathematics

The ship remains at Z=0. Every active hazard/wave advances `z += speed*dt`; values above +8 deactivate. After movement, when `elapsed >= 4 && distance >= nextDistance`, exactly one wave is attempted. On return, `nextDistance = distance + difficulty(elapsed).spacing`. There is no catch-up loop; sampled distance overshoot is retained rather than subtracted. Browser simulation uses 1/120s steps; GameModel additionally caps an individual caller's dt at 0.1s. Paused/dead states do not advance the model.

Let `p = clamp(elapsed/120, 0, 1)`. Speed is `20+14p`, requested plane spacing `66−6p`, and independent cell occupancy probability `0.52+0.45p`. After 120 seconds all three stop changing. The initial distance threshold is zero, so the first attempt occurs at the warmup boundary. Subsequent objects appear 108 units ahead, not at the ship. A wave may contain zero objects; its metadata still advances the schedule.

`safeLane` starts at 0. Choose uniformly from `{-1,0,1}` at most one integer away from the prior choice, including staying put. `safeX = 4*safeLane`. For each of the other two lanes and each row `{-1,0,1}`, one occupancy draw decides whether to create a hazard. Its parameters are:

| Parameter | Exact production rule |
| --- | --- |
| X | `4*lane + U(-0.35,0.35)` |
| Y | `2.45*row + U(-0.15,0.15)` |
| Z | **−108 for every object in the wave** |
| Radius | `U(0.65,1.1)`; same range for every kind/difficulty |
| Kind | `floor(3*U(0,1))` |
| Spin | `U(-0.7,0.7)` |
| Phase | `U(0,2π)` |
| Object count | At most six; expected `6*(0.52+0.45p)` before pool constraints |

Each accepted object consumes six further draws after occupancy: X, Y, radius, kind, spin and phase (seven draws total). A skipped cell consumes only its occupancy draw. The lane draw precedes wave-slot lookup; a failed wave-slot allocation still changes lane/PRNG state. A missing hazard slot breaks that lane's row loop. These saturation branches are deterministic but are not exercised by normal measured occupancy.

The LCG is `s'=(1664525*s+1013904223) mod 2^32`; output is `s'/2^32`. Seeds are coerced with `>>>0`, including valid zero. `Game.start` uses a finite query seed or a new crypto-generated seed; the same query seed resets the same field. Generation consumes no input/renderer randomness and does not inspect ship position/velocity. Reproducibility assumes the same simulation-step progression; arbitrary different dt calls may change threshold crossings and difficulty values.

The five visual variants preserve those draws: kind 0 → meteor; kind 1 → detailed/half meteor split at phase π; kind 2 → barrel/generator split at π. Nominal probabilities are 1/3 and four times 1/6. Phase simultaneously controls orientation and the split, a small existing catalog coupling. Cosmetic spin also rotates the calibrated box proxy, even though centers never move laterally.

## Pools, consumers and fairness

There are 72 reusable hazard records and eight wave records. Restart marks them inactive and resets RNG, lane, next distance and count without reallocating arrays. World preclones five borrowed GLB variants per slot and updates transforms by slot index; only one child is visible. It no longer reads waves to draw green gates. GameModel, tests and diagnostics still read the concrete `field.hazards/waves` arrays. Core policy already has no Three.js/DOM dependency, so renderer coupling is **not** a current design defect. Pool exhaustion is a hard admission issue for future density, not a current measured bottleneck.

Bounds are X±6/Y±3.6; ship sphere radius 0.42; combined lateral speed ≤8. Every wave protects a full-height corridor centered at −4,0,+4, and adjacent selected centers differ by ≤4. A worst neighboring obstacle has center separation 3.65 from a safe center; subtracting 1.1 leaves 2.55, exceeding protected half-width 1.5 + player radius 0.42. The calibrated box queries cannot expand the old outer-sphere limit.

The existing budget is `0.45 + 8/32 + 8/25 + 4/8 + 2*(1.1+0.42)/34 = 1.609411765s`. Minimum requested plane interval is `60/34 = 1.764705882s`. This is a deliberately loose adjacent-corridor schedule budget, supported by 24 two-minute controller tests at maximum difficulty. It is not a state-space validator or a guarantee from any arbitrary late player state. It does not compose a future field with arbitrary XY/Z arrangements.

### Permanent safe stripes

There is an additional source-level invariant: at X=±2, the nearest possible center in any lane is at least `2−0.35=1.65` units away horizontally. The maximum collision envelope is `1.1+0.42=1.52`. Therefore every height/depth is clear with at least **0.13** units of horizontal clearance. The same inequality holds at X=±6. This is independent of seed, occupancy and rotation. A player can reach X=2 long before the first hazard arrives and remain there indefinitely in the logical model. The full safe bands around ±2 have half-width 0.13 (strict interior avoids tangency); the selected safe-corridor sequence therefore does **not** require actual steering. Existing corridor-following tests establish one route, not engagement or absence of such exploits.

## Reproducible measurements

Run `node --experimental-strip-types scripts/generator-research.mjs`. It imports and calls the unchanged production field and collider, checks 82 protected production/test/design inputs, and replays seed 42. It writes `generator-baseline.json`, per-seed summaries, full seed-42 events and labelled diagrams under ignored review evidence. The ZIP contains these in `logs/` and `screenshots/`.

Fixed seeds: `0,1,2,3,7,11,23,42,64,127,255,1024,4096,65535,2147483647,4294967295`. Each receives 600 seconds at 120Hz with the actual elapsed/speed/distance update order. This is a collision-independent stream observation; it deliberately continues beyond a hypothetical player's death. Stationary probes use the real collider at Y=0 and count each contacting hazard once, without removing it. It is not a simulated human run or a new fairness implementation.

| Metric over 16 × 600 seconds | Observed value |
| --- | ---: |
| Waves / hazards | 5,168 (two empty) / 29,146 |
| Generated hazards per 100 traveled units / minute | 9.3130 / 182.1625 |
| Mean objects per wave | 5.6397 |
| Adjacent generated hazard centers sharing depth | 82.3206% |
| Mean adjacent hazard depth spacing, including zeros | 10.6990 units |
| Mean plane spacing | 60.4936 units |
| Median / maximum adjacent nonempty-wave pass gap | 1.7667 / 3.1083s |
| Radius min / median / max | 0.650005 / 0.875011 / 1.099985 |
| Peak active hazards / waves | 12 / 2 |
| Time with no center in nearby axial slab | 70.4951% |
| Median / p95 no-nearby run | 1.2333 / 1.7500s |
| Median run with ≥4 nearby centers | 0.5333s |
| Selected corridor changes / consecutive coarse pattern repeats | 56.3082% / 27.5039% |
| Required vertical corridor transitions | 0 |
| Actual collider probe contacts at X=−2 / 0 / +2 | 0 / 2,753 / 0 |
| Generated hazards/100 units at 0–30 / 30–120 / 120–600s | 4.7317 / 7.9467 / 9.7128 |

“Nearby” is **only** center Z in [−10,+10], regardless of XY. It does not mean unavoidable danger. Low-run statistics include the initial warmup (maximum 8.725s) and a right-censored final run. Pass-gap statistics exclude adjacent pairs involving an empty wave and measure plane-center crossings, not first/last collider contact. Coarse patterns use safeX plus nine-cell occupancy, ignoring radius/jitter/rotation. X/Y moments and lane/row/variant histograms are in JSON; row counts are 9,726/9,718/9,702, showing even placement rather than deliberate vertical sequences. Corridor changes are metadata, **not** 56% mandatory maneuvers.

The observed 600s stream plus one replay took about 0.97s in the initial Node 24.11.1 sample. Packaging records its own timing. This is research-tool CPU work with assertions, not the unimplemented validator's performance or browser FPS.

The current research checkout builds **931,609 bytes / 15 files**, with unchanged JS **663,045 / Node gzip169,576** and CSS **14,479**. Compared with the prior milestone's 931,551-byte capture, the 58-byte difference is solely checkout CRLF in the 58-line HTML output (7,685 versus7,627 bytes). Committed source is unchanged; protected-text checks account for Git checkout newline normalization. Historical reports are not edited to conceal that difference.

## Findings and hypotheses

Confirmed: single-depth groups, six fixed placement cells outside a selected lane, persistent bypass stripes, fixed size distribution, limited vertical intent, coarse repeated layouts, and a complete difficulty plateau at 120s. At full speed six objects traverse a thin collision slab in roughly `2*(1.52)/34=0.0894s`; their center-plane encounters are separated by about 1.77s. The wider 20-unit measurement slab intentionally reports a different duration.

Not established by this audit: perceived boredom, readability, fun, natural damage rates, human meaningful-decision counts, intentional risk-taking or preferred recovery duration. Shared planes and bypasses are plausible causes of repetition, but playtests must test that hypothesis. The existing five silhouettes and calibrated colliders already provide some visual/shape variety; the problem is not lack of actual assets. Higher object count alone could worsen readability and performance without improving choices.
