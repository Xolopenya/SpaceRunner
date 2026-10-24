# Fairness evidence and limits

Acceptance establishes one independently replayed input sequence from the exact supplied state against the entire supplied known field, with actual dynamics, zero hits, no hull/immunity credit and a neutral terminal continuation inside reserved empty space. It does not establish all-input safety, complete continuous-state reachability, human discoverability, arbitrary response delays or endless survival.

## R01–R20

Every named fixture is executable in `tests/field-validator.test.ts`. Deliberately overlapping barriers use explicit `synthetic-fixture` mode and are not legal generator output. Positive search fixtures include independently specified control traces; unsafe straight witnesses are distinguished from whole-layout rejection.

| Fixture | Actual assertion |
| --- | --- |
| R01 | Residual velocity brakes naturally; actual terminal vx/vy zero inside tail |
| R02 | Independent straight replay and beam acceptance |
| R03 | Both mirrored horizontal barrier passages: known replay and search |
| R04 | Both vertical passages: known replay and search |
| R05 | Alternating barriers at68/170: known continuous trace and revised search pass |
| R06 | Each half barrier passes alone; committed-plus-candidate68/71.4 union rejects under bounded search |
| R07 | Overlapping28-sphere plane spanning legal XY rejects |
| R08 | Center hazard at5 collides during held prefix; explicit insufficient-response result |
| R09 | Pass34 barrier accepts rest root; initial+8 toward it rejects |
| R10 | Spheres X±1.8 leave a straight margin-safe route |
| R11 | X±1.5 reject the straight witness while the search can find an alternative |
| R12 | Outward boundary witness collides; actual inward reversal passes |
| R13 | Half meteor phaseπ allows relativeY1.1 straight replay with margin0.15 |
| R14 | Round counterpart rejects that straight trace |
| R15 | Rotating barrel/generator full-substep contacts reject; old rounded-corner/same-time assertions remain |
| R16 | Opposite velocities at the same position produce different valid/rejected roots |
| R17 | Later-state/current-input replay accepts only checked traces; unsafe changed root rejects stale |
| R18 | Distant hazard extends the search; last opportunity/braking beyond15s rejects horizon |
| R19 | 10,000 exact GameModel transitions plus ramp-boundary spinning/overlapping depth fixture |
| R20 | Unknown profile, nonfinite root and exhausted operation/deadline fail closed |

Additional tests cover real B-1 joint contexts, immutable snapshots, replay disagreement fault injection, changed committed geometry/current input, mid-step operation suspension, no duplicate planning ticks, past opportunities, complete terminal controls, future tail clearance and full-JSON witness goldens. Zero-margin differential testing compares10,000 varied/tangent/rotating sweeps against a frozen approved collision implementation; positive margins are checked for monotonicity. The reference's bytes are verified against the approved Git blob with only class/import substitutions.

Independent reasoning supplements the search result. R06's left/right plane constraints differ by at least2.597 X units, but speed8 allows only0.8 in0.1s; the union is impossible under this stated margin model. R07's grid has maximum nearest-center XY distance `sqrt(1²+1.2²)=1.5621`, below outer contact radius1.67, covering the entire plane. In R09, the held+8 prefix travels3.6 right; a delayed reversal cannot reach the required left-side clearance by the pass34 center time. Those arguments concern the specified engineered layouts, not every rejected random candidate. In particular, R11 is only an unsafe straight witness.

## Corpus and witnesses

The diagnostic records336 Node jobs:16 approved seeds×5 policies×3 regimes (240),64 additional neutral normal roots,16 zero-margin normal roots and16 time-zero six-cell long-horizon cases. It separately runs80 normal jobs in installed Chrome and independently replays accepted results. Normal roots derive from120 exact input-history ticks. Late-existing/late-candidate probes deliberately place the player on a generated hazard center five units before pass while preserving policy velocity; they are engineered reaction tests, not claimed human run states.

All normal16-seed/policy contexts accepted in the completed diagnostic, as did the64 neutral,16 zero-margin and16 long-horizon cases (176 accepted/336 total). All80 late-existing contexts returned existing-field uncertified; all80 late-candidate contexts returned insufficient reaction distance. The16 long-horizon roots start at time/distance zero and cover full six-cell transactions, with no deadline failures in the completed set. This does not force arbitrary ambient candidates to pass and does not establish low rejection rates under real play. Detailed roots, identities, operation counts, hashes and cases are in `trajectory-metrics.json`; accepted/rejected complete contexts and witness examples are in `trajectory-examples.json`. Current-state publication examples advance the actual shadow Ship24 ticks before checking the new root; replay cost is included.

The pinned single-rock fixture has a full-precision FNV reproduction hash and SHA256 asserted in unit tests. Node and Chrome replay results are compared for the tested corpus; no general cross-engine bitwise portability is claimed. No witness is accepted by hash alone.

## Remaining review gates

Finite width/control/pruning/heuristic search can miss valid paths; search exhaustion is not impossibility. The positive fixture revision is documented rather than widening gaps to hide failure. Caller completeness and empty-reservation ownership must be enforced by a future coordinator. A later player can abandon a previously valid route. State-aware veto frequency, exploitability, bootstrap, concurrent pool reservations and publication cadence remain unimplemented integration work. Human response/readability and phone/frame timing require later evidence. The256×1024 planning-policy stress matrix and four24h runs are not claimed; the completed subset is explicit and reproducible. B-3 is not authorized by these passing tests.
