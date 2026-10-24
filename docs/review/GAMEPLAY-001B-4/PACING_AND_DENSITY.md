# Pacing, field density and passive policies

Recorded precommit profile: 2026-10-24T10:44:28.116Z. Its exact raw JSON is preserved under logs/baseline/precommit-director-*. Current exact-HEAD reruns are separate under logs/. Technical publication results and gameplay hypotheses are different outcomes.

## Complete proposed field

Sixteen approved seeds cover the matched spatial window[0,19200),307200 total units, including startup. The director owns3354 intersecting sections and produces15717 hazards: **5.1162 hazards/100 units**. The unchanged original field's reproduced B-1 matched-window rate is9.24577. This is a density comparison, not a difficulty/fun comparison. The proposed fields below have structure only; they are not mislabeled as safely published worlds.

| Center-depth gap | Mean | Median | p95 | p99 | Maximum |
| --- | --- | --- | --- | --- | --- |
| World units |19.3848|20.4194|35.2734|46.4623|59.8742 |

Same-depth fraction0; peak96-unit local density12.5000/100. Per-section density targets do not enforce a global rolling-window quota. Some gaps exceed48; that proposed historical target is not claimed achieved everywhere. Encounter sections cover35.1484% of the window. Mean center-slab±10 empty fraction is22.9252%; outer axial-opportunity empty fraction is85.3965%. These axial definitions differ and neither is actual XY contact risk or perceived empty time. Historical whole600s empty-time percentages have a different denominator and are not presented as a matched improvement.

| Selected family | Sections |
| --- | --- |
| ambient |2080 |
| scattered |360 |
| alternating |279 |
| narrowing |353 |
| vertical-weave |282 |

Recovery length min/median/p95/max is48/72/96/96 units across746 sections. Raw recovery contains ambient objects; actual safety omissions can still create empty spans and are counted. Repeated coarse three-section motifs are47.9530%. Keyed pose variation is not used to conceal this repetition or prove enjoyment.

## Realized scheduling density

Every scheduled span, including failed/empty sections, stays in these denominators. Warm-start windows differ from the19200-unit proposed-field window, so the table is not a matched old-game comparison. Neutral/boundary/periodic actors continue collision-independently to measure state vetoes; they are not called successful survivors after contact.

| Band/controller | Scheduled | Committed | Hazards/100 scheduled units |
| --- | --- | --- | --- |
| reference/early/witness |192 |184 |4.4290 |
| state-aware-policy/early/neutral |96 |84 |4.1465 |
| state-aware-policy/early/boundary |96 |90 |4.4189 |
| state-aware-policy/early/periodic |96 |87 |4.3584 |
| reference/middle/witness |192 |182 |4.7900 |
| state-aware-policy/middle/neutral |96 |85 |4.5745 |
| state-aware-policy/middle/boundary |96 |89 |4.8170 |
| state-aware-policy/middle/periodic |96 |76 |4.2769 |
| reference/late/witness |192 |187 |5.2817 |
| state-aware-policy/late/neutral |96 |81 |4.3842 |
| state-aware-policy/late/boundary |96 |88 |4.6932 |
| state-aware-policy/late/periodic |96 |80 |4.3040 |

## Passive bypasses in fixed fields

All240 long-policy runs use real120Hz Ship and calibrated gameplay CCD, stopping at first actual contact with no immunity. Boundary/corner initial positions are explicit early-parking probes. No state veto regenerates an easier field during these fixed-geometry experiments.

| Policy | Survived19200 /16 | Median distance before contact/end |
| --- | --- | --- |
| neutral |0 |430.42 |
| fixed-x-vertical-motion |0 |434.71 |
| fixed-y-horizontal-motion |0 |339.86 |
| boundary-left |0 |1347.35 |
| boundary-right |0 |2206.23 |
| boundary-top |0 |922.00 |
| boundary-bottom |0 |777.70 |
| corner--1--1 |0 |751.85 |
| corner--1-1 |0 |1157.93 |
| corner-1--1 |0 |775.29 |
| corner-1-1 |0 |870.79 |
| constant-right |0 |2206.23 |
| constant-up |0 |922.00 |
| constant-diagonal |0 |870.79 |
| periodic |0 |390.71 |

No long policy survives the full19200-unit field in this finite corpus (0/240). This does not prove there is no bypass, nor that each section forces steering. Short-window corner survival remains a material gameplay risk.

The separate accepted-field experiment replays six counterfactual policies through each of48 reference worlds,288 runs over shorter warm-start windows. Geometry is held fixed rather than regenerated for each policy.

| Counterfactual policy | Survived whole short window /48 |
| --- | --- |
| neutral |3 |
| fixed-x-vertical-motion |0 |
| fixed-y-horizontal-motion |9 |
| corner-1-1 |11 |
| constant-diagonal |11 |
| periodic |7 |

These shorter worlds leave substantial corner opportunities: survival here must not be equated with19200-unit survival or forced steering. The director is technically testable, but removal of easy corner play and human engagement are not established. B-5 needs actual camera/input playtests before default integration.

## Recorded coverage revision

The first free-offset director implementation left frequent passive corner routes. The current corner-pressure-v1 policy uses only actual B-3 mirror/translation requests, chosen in seeded four-corner bags independent of player state. A deterministic template pass derives allowed offsets; the final complete transaction undergoes the same structural and trajectory checks. Counts, depths, radii and pose draws are preserved. A bag covers all four corners, but every sliding four encounters need not do so. There is no extra safety retry or individual hazard removal.

| Matched diagnostic | Free offset | Corner-pressure-v1 |
| --- | --- | --- |
| Scheduled/committed/uncertified omissions |1588/1453/135 |1588/1437/151 |
| Proposed hazards/100 units |5.1162 |5.1162 |
| Long passive survivors /240 |13 |0 |
| Short accepted-field corner survivors /48 |44 |11 |
| Primary reference physical reversals/1000 units |0.0487 |0.1784 |

The revision improves this finite bypass corpus while increasing publication omissions; it does not establish human engagement. Before/after raw metrics, samples, examples and the original source are preserved under logs/baseline/pre-coverage-*. Five current plots show recorded pacing, density, policies, scheduling cost and an accepted-field projection with its actual reference trace. The projection is not a production screenshot or a collision proof by itself.

## Motion, incoming velocity and visibility

Across48 primary reference runs, median X/Y travel is6.0000/3.6000 units; median physical reversal count0, aggregate0.1784 reversals/1000 units. A reversal requires a velocity sign change after>.75-unit excursion. This is a physical-motion proxy, not a count of meaningful human decisions or proof each obstacle caused a maneuver.

First-candidate planning lead min/median is127.8190/135.5484 units; publication warning center-distance min/median is87.0190/103.6502. At maximum speed, subtracting the maximum1.67 outer opportunity radius from the minimum leaves about2.5103s to first contact opportunity. This is not a universal maneuver/readability threshold: actual incoming velocity and intervening obstacles are checked by replay.

Using the existing108-unit spawn approach only as a nominal visibility threshold,104/2614 reference-field entries occur while lateral speed exceeds1. The actual camera has58-degree vertical FOV, far260 and fog70–190; legibility, occlusion and portrait motion are untested. Transactions can exceed108 units. Preserve the0.45s engineering prefix, but do not treat it as a human perception model.
