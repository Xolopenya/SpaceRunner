# Initial encounter library — design only

Four intents are sufficient for the first hybrid field. These are candidates for GAMEPLAY-001B, not implemented encounters or approved tuning. Coordinates below are continuous targets with seeded translation/mirroring/scale; they are not movement lanes. All layouts must pass the [joint validator](PROCEDURAL_FAIRNESS.md), including ambient objects, adjacent cells, actual velocity and the terminal tail. Template validity alone never implies safe composition.

| Intent | Initial budget | Depth span | Purpose |
| --- | --- | --- | --- |
| Scattered field | 3–5 objects | 48–84 units | Small route choices among natural-looking depths |
| Narrowing passage | 4–6 objects | 60–96 units | Gradually favor one side of a usable opening |
| Alternating avoidance | 4–6 objects, 2–3 decisions | 84–132 units | Controlled reversals with sufficient braking time |
| Vertical weave | 4–6 objects, 2–3 decisions | 84–132 units | Make vertical control useful without compulsory lane gates |

Counts replace part of the ambient allowance rather than adding an unchecked second density layer. Depth spans may cross several 24-unit ownership cells; reserve the whole encounter within a 48–144-unit planning transaction and certify it as one candidate. A pattern must not be published in fragments whose later continuation has not been checked. It must fit the remaining pacing section or explicitly reserve its completion before recovery. Start with the existing five variants and radius 0.65–1.1. No new assets or moving centers.

## A. Scattered field

Place a small set at independently separated depths, spanning multiple XY quadrants. Example intent: a lower-left foreground rock, a later upper-right pair and an optional central small object further back; avoid aligning every object with the same X or the same Z. Seeded variation may change quadrant order, radii and shape weights while honoring local separation and density limits.

The player decides whether to make one larger move or several smaller adjustments. No single authored path is mandatory. Normal progression increases XY coverage and nearby staggered objects, not a simultaneous front wall. Allow entry from any replay-certified state; exit needs a settled or demonstrably recoverable velocity. This is the default after bootstrap and the preferred recovery-compatible pattern with reduced count. Future optional close passes may occur beside a roomy alternative.

## B. Narrowing passage

Use staggered left/right or upper/lower rocks to gradually favor an opening over 60–96 units. Each object's depth and size affect the actual opening time. The opening's favored center moves continuously by a modest amount, initially ≤2 units per decision; translation/mirroring prevents a permanent center corridor. Do not place two dense coplanar rows then add cosmetic offsets.

For two spherical bounds, a preliminary center-gap screen is `center separation >= r1+r2+2*(0.42+0.15)`. This is a conservative layout screen, not a replacement for time-resolved box/sphere queries. A wall-side passage also needs true boundary clearance, braking feasibility and adequate duration while both objects overlap the flight plane. Reject apparent openings that close before the moving ship arrives.

Player choice is early alignment with a generous route versus an optional tighter pass. Lower difficulty uses smaller objects, wider clearance and a nearly stationary opening. Later use an oblique opening or mixed shape profiles, staying within the same certificate requirements. Do not enter directly after a demanding reversal unless the whole transition certifies and the director permits it. Prefer recovery afterward if the witness exits with large velocity.

## C. Alternating avoidance

Arrange successive offset clusters so the easiest route changes horizontal direction. Use at least 2–3 meaningful depths, generally 28–44 units between decision centers; **increase** that distance when reversing high velocity or requesting a larger displacement. These are initial design ranges, not safety guarantees. The validator must reject any layout whose available time fails the actual state-dependent steering/braking budget.

Vary displacement, initial side and vertical offset; never blindly alternate −4,+4 at a fixed interval. Larger displacement and faster forward travel require longer depth, not simply more aggressive movement. At 34 units/s a nominal 28-unit interval is only 0.824s and may be insufficient: this category must be allowed to expand its span, reduce displacement or reject. The player should anticipate and reverse deliberately; a large open bypass may remain an intentional easier option.

Transition into a low-intensity scattered/recovery section after the sequence. Block immediate repeat of the same mirrored pattern and do not chain two maximum-amplitude reversals by default. A stationary line surviving this one encounter does not invalidate it; many repeated patterns permitting the same permanent line is a field-level defect to measure.

## D. Vertical weave

Favor a lower opening followed by an upper/diagonal opening (or vice versa), using different depths and partial horizontal occupancy. Y travel is bounded at ±3.6 and is not a disguised three-row control system. Begin with 1.2–2.0 unit vertical changes and extend timing from the actual vy; do not assume moving upward starts from rest. Retain a safe fallback direction and cap exposure near screen edges in portrait.

This layout creates useful vertical decisions; a small set of rocks cannot automatically **force** vertical movement across a freely navigable 12-unit width. Whether players choose Y and whether a horizontal bypass exists are separate measurements. Required-Y fairness tests use explicit engineered fixtures with known blocking geometry; they do not prove every aesthetic weave forces Y. Avoid closing all horizontal routes solely to justify the pattern name.

At higher progression mix small horizontal shifts or a thin rotating proxy, using its real pose and clearance. Require recovery after high-amplitude vertical sequences and prohibit a narrowing transition whose viable entry state assumes vy=0 when the previous witness exits moving. Future asset variety may change silhouettes, with the same metadata/predictor contract.

## Shared constraints and future variation

- Proposed normal minimum center separation is outer radii plus 0.3, enforced across adjacent encounter/ambient boundaries. Coplanarity and local count limits are additional screens; collision validation is authoritative.
- Accept only complete encounters within total density, active-slot, horizon, reaction and work budgets. On failure, enlarge timing, remove unpublished objects or fall back deterministically; never move committed visible debris.
- Pattern tags express intent and selection cooldowns, not hard scripted player routes. Reject repeated safe-stripe invariants across seeds using actual geometric probes.
- Stable IDs and proxy-aware distances allow later once-per-hazard near-miss measurement with a safe alternative. No points, rings, coins, checkpoints or reward incentives are added now.
- Future drift requires shared predicted pose and collision-time bounds. Cosmetic rotations already affect box proxies; “moving hazards deferred” must not mean ignoring existing rotation.

The packaged `gameplay-pattern-concepts.png` is explicitly a hand-positioned conceptual slice. It is neither generated output nor a certified full 3D arrangement.
