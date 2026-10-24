# GAMEPLAY-001B-3 pattern library

Four families share one logical producer and normal structural/trajectory admission. None is rendered in the live game. All radii remain0.7–1.05, spin±0.7, all five existing visual/collision variants are available, and center translations fit the configured X±5.4/Y±3.15 box. Mirrors reflect X and/or Y centers; they do not reflect a mesh's rotation chirality. Every variant must be revalidated.

| Family | Default / minimum span | Count at I=.2 / .8 | Geometry and intended decisions |
| --- | --- | --- | --- |
| Scattered field |72 /48 units |3 /5 | Independently varied continuous XY positions and one irregular pass distance per depth stratum; low-density navigation with multiple routes. Intensity changes count and bounded within-stratum depth spread. |
| Narrowing passage |96 /72 |6 /8 | Three or four staggered pairs over the span. Half-width decreases from2.9 toward1.85−.25I, with lateral drift, small Y tilt/arc and independent depth offsets. Progressive pressure rather than a coplanar wall. |
| Alternating avoidance |120 /96 |4 /6 | Two or three stages alternate X pressure around±(.65+.2I), each with Y-separated objects and distinct depths. The intended route changes horizontal direction after clearing each stage. |
| Vertical weave |144 /96 |4 /6 | Two or three stages alternate upper/lower Y pressure around±(.55+.15I), each with X-separated objects and distinct depths. The intended route uses vertical movement between layers. |

`PatternGenerator(seed).propose({family,firstCell,intensity,variation,...optionalTransform})` returns complete immutable transactions, actual provenance and structure. Request intensity must be finite[0,1]; no clamping. Counts step at bounded thresholds; width/pressure or depth spread also changes within a count band. Pose/radius variates stay fixed for common ordinals, avoiding simultaneous hardening of radius, speed and density. Family-specific spans below the minimum return INSUFFICIENT_SPAN; invalid intervals return INVALID_REQUEST. All spans remain within2–6 cells. No retry, clipping or silent partial arrangement exists.

Scattered depth spread is0.2+0.1I around each stratum midpoint. Intensity is a bounded geometric input, not a proved monotonic measure of human difficulty or planner CPU across seeds. Equal acceptance at the two measured intensities does not establish equivalent player difficulty.

For paired families, stage centers occupy about9 to span−13 units with±1 unit variation. Each pair is staggered by±1.45 with±.08 depth variation, so pair depth difference is at least2.74 units, exceeding the maximum possible2.4-unit radius+separation requirement. Stage gaps shrink as high intensity adds a meaningful intermediate stage. Scattered strata also maintain separation at the smallest legal span; all actual results still pass inspect rather than relying on the construction bound alone. Exact same-depth frequency in the measured corpus is zero.

## Actual trajectories and plots

Four1280×900 numerical plots accompany the review ZIP under screenshots/. Amber ellipses are correctly scaled projections of logical outer radii; cyan is the real Ship center obtained by stepping the recorded controls. Panels show X-depth and Y-depth; projection overlap alone is not a3D collision. Cell lines show ownership, not movement lanes. There are no fake captured gameplay screenshots.

Scattered and narrowing figures use actual beam-search witnesses. Alternating and weave figures use separately authored diagnostic controls at seed42/I=.8/variation0, with explicit zero offsets/no mirrors. These two complete generated transactions pass normal structural policy and independent B-2 replay, including held-input prefix, calibrated proxies, neutral braking and empty reservation. Both make two intended reversals; they are supplemental evidence, excluded from automatic-search acceptance rates. Full beam examples remain in pattern-examples.json alongside these diagnostic examples.

Removing post-reaction Y inputs from the vertical diagnostic trace causes COLLISION_FOUND. Actual accepted beam traces also show beneficial Y movements; FAIRNESS_EVIDENCE gives the counts. This demonstrates that Y can help, not that all horizontal routes are impossible. The planner often moves to an early bypass rather than following the visual center of a passage. Narrowing admits reachable center and outside routes; the library intentionally does not construct a wall requiring one exact opening.

## Rejections, variety and limits

All four families have representative engineered late-root rejections: the root is placed two units before the first obstacle center with stationary velocity, yielding INSUFFICIENT_REACTION_DISTANCE. These are controlled negative fixtures, not observed human histories. Eight out-of-range intensity requests reject before validation. One joint ambient-to-weave incoming root fails existing-field certification; no invalid sample is filtered to inflate success.

Seed/location/variation keys change geometry, depth spacing, transforms and catalog pose. Translations vary upper/lower and left/right occupancy; there is no globally reserved X stripe in the new algorithm. No individual encounter is required to force a single maneuver, and corner bypasses remain possible. The original live generator still has its approved corridors. Geometric reachability, finite planner discoverability, visibility/readability under the actual camera, and subjective enjoyment are different questions. Only the first two have isolated evidence here; the other two and recovery cadence need later playtests. Fixed speed progression is untouched.

See FAIRNESS_EVIDENCE for exact distributions and representative roots, PERFORMANCE for measured work, and INTEGRATION_NOTES for source ownership and publication obligations.
