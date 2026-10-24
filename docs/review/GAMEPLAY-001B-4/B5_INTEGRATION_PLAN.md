# B-5 integration proposal — not implemented or authorized

B-4 is isolated. A successful logical witness or offline forecast is not permission to replace the live wave generator. External architecture approval is required before any development integration.

## First decision: publication under unknown human input

The current research coordinator verifies a forecast at a fixed tick and commits only when the actual state/field match. Offline witness/neutral/boundary/periodic policies can provide future controls exactly; humans cannot. Held-input forecasts deliberately fail closed when the player changes input. Treating those known-policy results as a generally available runtime forecast would be incorrect.

Before integration, select and test an authoritative final-gate strategy. One option is off-main-thread beam work followed by a fresh bounded replay from the actual commit state. Another is a short forecast interval with exact invalidation and sufficient remaining replay budget. Both need actual timing and veto/density evidence. A worker does not solve stale human state by itself. Do not accept stale worker results, omit the held-input prefix, reduce clearance or grant immunity to recover throughput.

B-3 already recorded30.19ms Node and7.1ms Chrome chunk maxima. B-4 retains every chunk, adds p99 and lower-budget comparisons, and includes forecast/preparation/publication costs. If p95/long-task bounds cannot be met with smaller chunks while retaining the shared144-tick deadline and horizon, propose a worker explicitly and obtain approval before adding it. Messages would carry bounded immutable logical records, input/root/epoch fingerprints and cancellation, never Three.js objects. No worker exists in B-4.

The recorded final precommit B-4 profile has Node work p95/max3.4795/85.9476ms and Chrome2.8/9.8ms. The two-seed/three-band lower-budget subset reduces chunk costs but commits21/24 versus23/24 at default limits, with three early deadline failures. This does not demonstrate a reliable main-thread budget. The corner-coverage revision reduces short accepted-field corner survival from44/48 to11/48 while increasing uncertified omissions from135 to151/1588. All240 long passive policies hit within19200 units, but reference physical reversals remain sparse (0.1784/1000 units). These are explicit integration and gameplay-review gates, not grounds to enable the default.

## Proposed development integration sequence

1. Preserve the approved production build. After authorization, add a development-only adapter/flag around the existing ObstacleField seam, stripped from production while experimental. Do not expose a production UI selector.
2. Keep the actual120Hz Ship, speed function and calibrated collision queries. Adapt complete PlannedHazard records to the existing72-slot renderer pool atomically, respecting hard32 known/active plus pending reservations. No partial admission or source-ID remapping.
3. Persist full source ownership even when render/collision records retire. Reset cancels pending epochs; pause/focus advances no director or planning ticks. Visibility/context recovery must not republish old jobs or rebuild imported assets.
4. Integrate current-state final revalidation and empty-tail certificate replacement. A rejected extension preserves existing geometry and the prior valid continuation; it must not suppress actual player damage/death if controls abandon that continuation.
5. Measure launch/bootstrap and visual warning under the actual camera. B-4 starts ownership at144 units; the current wave generator spawns at108, camera FOV58 degrees/far260 and fog70–190. These are source observations, not a proved legibility distance. Some logical transactions exceed the visible approach range. Inspect actual desktop/portrait/landscape motion, occlusion, silhouettes and incoming-velocity cases before tuning spans.
6. Compare proposal versus realized density, omission causes and passive policies on the same windows. Include actual human input histories; do not optimize only object count or conceal rejected sections. In particular, test whether bad steering can collapse future density before or after an actual collision.
7. Run all old controls, health, score, pause/focus, audio/VFX, GLB retry, restart/resource and production-stripping checks with equal or stronger generator assertions. Keep historical wave proofs as historical evidence rather than weakening tests silently.

## Gates before changing the default

Require zero false publication decisions/accepted witness collisions, correct retirement/epoch cancellation, bounded slots/work/memory and unchanged gameplay contracts. Investigate repeated bypasses, omitted sections and field gaps rather than inventing an acceptance quota. Measure concurrent rendering/input latency and named physical phones; isolated Chrome CPU is insufficient. Collect human readability/reaction/enjoyment observations separately from simulated steering counts. Explicitly review first-contact timing and natural recovery rather than delaying launch for a planning horizon.

Do not add near-miss scoring, moving hazards, models, progression/unlocks, shops or unrelated UI under this plan. Retain the existing production default until technical and human review approve a change. The recommended next task is B-4 architecture review followed by an explicitly scoped B-5 prototype only if approved.
