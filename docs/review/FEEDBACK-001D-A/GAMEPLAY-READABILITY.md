# Gameplay readability

The approved Hybrid chase camera is preserved. The default source uses 80% X/Y translation of both camera position and target, no bank coupling and explicit aspect-ratio framing. Nothing in this audit supports replacing that policy.

## Separate projection, placement, appearance, timing and collision

| Layer | Observed / verified | Limits and action |
|---|---|---|
| Projection | Ship remains visible during real keyboard steering; portrait pulls camera back to retain horizontal arena width | Small screen displacement at a world limit is expected with 80% follow. Do not misdiagnose it as failed steering |
| Placement | Real accepted stations, ambient debris, mines and shards appear in native runs | No generator, obstacle-pattern or balance change is recommended. Different render/planning cadence can produce different accepted fields; deterministic fixed-step evidence is labelled |
| Appearance | Strong ship silhouette/exhaust, muted solid hazards, readable rectangular station apertures, turquoise shard/ring, warm mine core and temporary cyan protection | Distant hazards/mines occupy fewer pixels; native mine-approach captures warrant a human identification test, not an unsupported new-warning requirement |
| Reaction time | Native loop supports avoidance and collection, but automated pilots use state/certificate knowledge | These runs cannot prove novice reaction time, fairness or optimal difficulty. No balance defect inferred from death alone |
| Geometry | Events identify actual obstacle IDs/material families and accepted damage; collector records three real accepted pickups | No visible evidence establishes a collider or camera-pickup mismatch. Existing body/wing/collision regressions remain the relevant functional proof |

## Obstacles, scenery and visual hierarchy

The planet/star layers sit behind the route and do not look like interactive goals in the inspected captures. Rocks and industrial silhouettes differ from the turquoise shards; stations define large, comprehensible openings. Warm aperture accents and mine cores also share an industrial palette, so a first-time player's recognition of a distant mine needs human confirmation. Do not change the owner-approved thermal mine/explosion treatment from a still-image preference.

The natural seed-42 collision shows a rock and station in the same approach. Protection remains visible around the ship while hull decreases and damaged surfaces persist. This is a crowded but explainable moment; the confirmed confusion is text over text, rather than proven excessive particle count. Destruction clears active HUD and prioritizes the approved cinematic. Native videos and event clocks are included because a single frozen frame cannot establish timing or overload.

## Fragments and depth

The first collector success is recorded at 12.558s with reward 1, followed by successes at 29.817s and 46.675s. The native pilot uses keyboard pursuit, without HP, obstacle, pickup-radius or camera edits. The pickup ring, temporary +1, numerical count and sound already provide several feedback channels. Counter/ring visibility is positive evidence; whether a new player notices it while attending to an incoming obstacle remains UX-08's low-confidence question.

At different depths a shard and ship can align in screen space without sharing world coordinates. The recent body/wing assist and magnet have been approved. No audit evidence warrants undoing those settings, adding wing lasers, increasing spawn density or claiming that missed collections are camera defects. Trail completeness and partial collection are exercised by the existing shard-trail regressions; no new trail mechanic is proposed.

## Boundaries: current implementation matters

The brief's open boundary question does not mean the current version has none. `World` selects **fragmented-warp / Combined C** by default. `ArenaBoundaries` contains legacy, warp and fragmented-field alternatives, and `FragmentedWarpField` uses fixed world bounds, depth envelope, proximity response and accepted-station exclusions. These are already implemented.

Focused ordinary input held the right bound at x=6 across two captures, then reached y=3.6 and x=-6. The center-position clamp is real and consistent. The current sparse field brightens near edges, but no distinct clamp cue appears and the screen-space ship movement is small under Hybrid. This is a comprehension opportunity requiring human observation, not proof that players cannot understand the volume.

Compare three refinements in [DESIGN-DIRECTIONS](DESIGN-DIRECTIONS.md): tune the existing localized field response; sparse environmental cross-section marks only near limits; or brief edge-localized particles on sustained boundary approach. None uses wing-mounted lines. All preserve actual bounds, station aperture exclusions and approved camera/flight geometry.

## Game feel and pacing

The 70.71s collection attempt includes steering, three accepted rewards, a station hit at 55.525s and continued flight to 1802m with two hull points. Native idle/pilot deaths cover hull 3→2→1→0 and rapid retries. Phase 2 appears at 500m and changes speed; current product wording is harder to interpret than the underlying event. Early quiet flight exists in the after-hint captures, but no evidence here justifies removing warm-up or retuning density. Full economy, final difficulty balancing, elaborate patterns, progression and major collectible-system changes remain explicitly postponed.

No isolated GPU/frame debugger investigation was necessary: no unexplained rendering corruption or reproducible performance cliff was identified. RAF outliers during concurrent browser regression work are retained in TESTING and not attributed to shaders or devices without profiling.
