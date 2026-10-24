# GAMEPLAY-001B-3 fairness evidence

## Corpus and admission

The approved seeds are0,1,2,3,7,11,23,42,64,127,255,1024,4096,65535,2147483647,4294967295. Every case is recorded, including request/structure failures. Normal FieldGenerator inspection and default B-2 generator policy are used throughout; no synthetic-fixture options are passed.

- 768 family attempts:4 families×16 seeds×2 intensities(.2,.8)×2 variations(0,1)×3 roots. Each family has192 attempts,96 per intensity.
- 128 global neutral-root attempts:4×16×2 intensities, variation0.
- 64 engineered late roots:4×16, intensity.8, variation0.
- 128 joint transitions:4 types×16×2 intensities.
- 8 invalid intensity requests:4 families×two values outside[0,1].

Ordinary roots use elapsed120s, distance32 and position at the generated source offset. Neutral velocity/input is zero; horizontal roots use vx±4/inputX±.5 and vertical roots vy±4/inputY±.5, with sign determined by variation parity. Source-aligned roots can favor a pattern, so global center roots at(0,0) are measured separately. Late roots are placed exactly two units before the first obstacle at its XY center, stationary. They are engineered probes, not sampled human run histories.

Every acceptance is replayed independently with fresh state against real Ship dynamics and calibrated collision proxies; witness hashes must match. Default0.15 margin,54 held steps,39 neutral braking steps,16-unit empty terminal reservation,1800-substep horizon, width16 and original work/deadline limits remain unchanged. Tests also cover stale publication, opposite velocities, budget/deadline rejection and complete serialization. Hashes establish determinism and never replace collision verification.

## Results

All768 family and128 global-neutral attempts accept. All64 late roots reject INSUFFICIENT_REACTION_DISTANCE. All8 invalid requests reject INVALID_REQUEST before search. Joint transitions accept127/128. Overall1023/1096 attempts accept(93.3394%); structural/request rejection8/1096(0.7299%), trajectory rejection65/1088 structurally admitted jobs(5.9743%). The deliberately negative cases remain in these denominators. There is no acceptance quota or fallback.

| Joint transition | Attempts | Accept | Rejection |
| --- | --- | --- | --- |
| Ambient → pattern |32 |31 |1 EXISTING_FIELD_UNCERTIFIED / NO_WITNESS_FOUND |
| Pattern → ambient |32 |32 |0 |
| Pattern → pattern |32 |32 |0 |
| Horizontal → vertical |32 |32 |0 |

Each joint context contains the complete first and next transaction geometry, with no velocity reset between them. Low intensity starts vx+4/heldX+.5; high intensity starts vy−4/heldY−.5. One whole known-field search/replay runs from the incoming root, not two independent certificates joined afterward. Structural negatives cover source-span overlap, cross-cell seam separation, wrong half-open ownership, duplicate IDs/ordinals, unknown provenance/profile, partial transactions and combined capacity. Adjacent nonoverlapping cells still reject when their physical radii violate separation across the seam.

The single failed ambient→weave case is seed11/I=.2: incoming(x,y)=(1.1671696879692002,−1.5716341498968704), vx4, vy0, heldX.5. Existing ambient cell2/ordinal0 has center(3.3031692942604423,−2.7888799345353616), q49.13303057849407 and radius1.0474425539840013. The54-step prefix ends clear at distance47.3, x2.967169687969199, vx4. Every one of the nine permitted first actions contacts that existing sphere with margin at tick57/distance48.15. The new candidate starts at q96. Raw existingFieldProbe records this result; this finite policy diagnosis is not a proof over all conceivable control functions. The rejection remains unchanged.

Zero corpus deadline/horizon failures or replay disagreements occurred. No known-safe trace miss was found by the four fixed supplemental hand-control probes on NO_WITNESS_FOUND results; this does not prove search completeness. All64 additional installed Chrome cases accept with identical Node decision/witness hashes and no harness errors or Game/World/GLB loads. Original32 browser regression tests separately exercise the unchanged live game.

## Actual maneuvers and clearance

Full candidate/committed geometry, roots, controls, reservation, trace and hash are in pattern-samples.json and pattern-examples.json. Four plotted projections derive from these numerical data. Automatic beam witnesses commonly escape pressure early and may use a corner bypass. They prove checked reachability; they do not prove the intended route is forced or obvious to a player.

Two separately authored diagnostic routes use actual generated seed42/I=.8/variation0 transactions with zero offsets and no mirrors. Alternating makes two horizontal reversals and travels8.625067768047233 lateral units; Vertical Weave makes two vertical reversals and travels8.905537509639665 vertical units. Minimum additional swept-proxy padding estimates are1.1594203941855121 and1.1767254328598429 respectively. Both pass normal independent B-2 replay, including reaction, real neutral braking and reserved tail, and are excluded from the1096 beam corpus denominator. Diagnostic Y removal causes COLLISION_FOUND for the vertical trace. Actual beam witnesses also contain beneficial Y examples; the measured table below reports them without asserting all-X impossibility.

Clearance is measured using actual rotating calibrated proxies and continuous query sweeps over every recorded simulation step. Binary search finds extra ship-radius padding at first contact, capped at2, with nominal resolution≤2/4096. Temporal broad filtering is conservative for that padding. Values equal2 are right-censored lower bounds, not exact distances. This numerical estimate includes the collision adapter's conservative rotation allowance; it is not distance to the visible mesh, a robust state-space tube, or a guarantee under arbitrary steering errors. Default0.15 acceptance still comes from normal validation and replay.

## Compatibility and limits

All original96 unit tests, ambient goldens, B-2 witness golden, R01–R20 and source-pinning assertions remain intact.15 pattern tests add normal generator-policy admission, mirrors/translations/order/reset/serialization, full-source ownership and real positive/negative trajectories. Historical336 Node/80 Chrome B-2 jobs and B-1 foundation diagnostics are reproduced in approved snapshots; they are not mislabeled as current-schema pattern runs.

Acceptance is conditional on the supplied root and complete known geometry. A later root can invalidate it; representative24-step delayed roots and stale rejection tests exercise the existing publication API without adding runtime publication. Individual patterns allow bypasses. No globally protected horizontal stripe is authored, but the finite corpus cannot exclude every exploit over an infinite field. Human readability, enjoyment, actual camera visibility, mobile performance and difficulty/recovery cadence remain untested. Review before B-4.

## Measured geometry profile

Geometry distributions deduplicate complete transaction hashes across all phases, including joint candidates. They do not filter acceptance denominators. Witness clearance/Y counts use224 accepted library+global-neutral roots per family; joint witnesses are reported separately. Utilization is(first-to-last center depth)/transaction span; gap statistics use sorted consecutive centers. All exact same-depth fractions are0.

| Family | Unique transactions / hazards | Objects/100 | Count min–max | Gap min / median / p95 / max | X range | Y range | Mean utilization | Min padding | Y-beneficial beam traces/224 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| scattered | 72 /288 | 5.5556 | 3–5 | 7.5585 / 16.7618 / 29.6068 / 32.2518 | -5.1557…5.3679 | -3.1465…3.1293 | 0.7431 | 0.3470 | 38 |
| narrowing | 66 /462 | 7.2917 | 6–8 | 2.7513 / 2.9726 / 34.3135 / 36.1054 | -5.3802…5.1624 | -2.9540…2.9241 | 0.8008 | 0.2717 | 65 |
| alternating | 68 /340 | 4.1667 | 4–6 | 2.7471 / 2.9624 / 95.0504 / 96.7607 | -5.1951…5.2897 | -2.9439…3.0719 | 0.8403 | 0.2293 | 47 |
| vertical-weave | 114 /570 | 3.4722 | 4–6 | 2.7567 / 2.9633 / 119.2120 / 120.7947 | -5.2841…5.3673 | -3.1041…3.0134 | 0.8667 | 0.2568 | 41 |

Y-beneficial means this accepted beam trace uses Y and removing its post-reaction Y controls produces COLLISION_FOUND under normal independent replay. Other X routes may remain. Minimum padding values are numerical estimates; values capped at2 elsewhere in the raw distribution are censored. The profile is preserved alongside this report; current-HEAD reruns retain their own raw measurements.
