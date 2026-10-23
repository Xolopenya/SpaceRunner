# Gameplay decisions — owner-approved scope record

Source: owner's GAMEPLAY-001A brief, 2026-10-23. These ten product decisions are binding. Proposed algorithms, numeric budgets and pacing values in the accompanying research are **not** automatically owner-approved implementation details. GAMEPLAY-001B needs independent architecture approval first.

| # | Owner decision | Status / consequence |
| --- | --- | --- |
| 1 | Endless 3D arcade survival; distance/records; ship destruction ends a run; no final level | Approved for upcoming generator work; no maximum designed run duration |
| 2 | Free continuous XY movement; preserve acceleration, damping/braking, speed, bounds, responsiveness, banking and camera | Approved and binding; no discrete player lanes or movement simplification |
| 3 | Moderate continuous density with periods of higher intensity and short recovery, possibly with scattered debris | Approved for upcoming work; avoid both recurring empty runways and constant maximum danger |
| 4 | Hybrid natural continuous flow plus deliberate multi-depth encounter patterns | Approved for upcoming work; decorative Z jitter on repeated walls is insufficient |
| 5 | No autonomous lateral/special hazard behavior in the first generator; cosmetic rotation may remain | Moving centers explicitly deferred; predictor contracts must still handle existing rotated collision boxes |
| 6 | Future score experiment combines distance with narrow-avoidance bonuses | Approved for later experimentation only; current distance scoring stays unchanged; no rings/coins/checkpoint gates |
| 7 | Persistent progression, consumables, skins and additional rewards may be future systems | Explicitly deferred; do not complicate the first generator or implement stores/currency |
| 8 | Difficulty mainly increases density, geometry complexity and maneuver sequences; speed increases only moderately; indefinite survival in principle | Approved for upcoming work; cap physical parameters and preserve certified continuation rather than scheduling inevitable death |
| 9 | Later expand silhouettes, sizes, mechanical debris and collision shapes; generator uses actual logical proxies | Catalog compatibility approved; acquiring/integrating new assets deferred to a later task |
| 10 | Focus on interesting avoidance; no combat/enemies/weapons/missions/complicated abilities | Binding scope boundary, not a backlog authorization |

## Approval boundary and open technical decisions

001A authorizes audit, architecture, small non-invasive diagnostics, tests of research tooling, feature commit/push and a local review package. It does **not** authorize production generator/config, movement, collision, UI, audio, VFX, score, health, camera or asset changes.

The recommendation chooses a hybrid distance stream, finite exact-state trajectory search, actual-state publication acceptance, bounded simplification/omission and seed+input replay semantics. Those are recommendations for reviewers to approve or amend. In particular, state-aware world generation sacrifices old seed-only layout identity across differing inputs and needs exploitability review. Performance targets, density/clearance caps, bootstrap and human reaction reserves remain hypotheses.

Near-miss opportunities should arise from voluntary closer trajectories beside a safer route. Future scoring should use stable hazard IDs and real proxy separation, award at most once per qualified hazard and avoid retry/oscillation farming. No bonus logic, multipliers, reward event or telemetry service is introduced now. Moving/rotating future structures require shared pose prediction and bounded collision envelopes before catalog eligibility; current rotation is already part of safety queries.

Next authorization step: independent architecture review of GAMEPLAY-001A. Begin 001B only after that approval; do not treat a successful research test run as product or architecture approval.
