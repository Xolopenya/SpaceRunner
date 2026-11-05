# GAMEPLAY-005B2 — pickup calibration

## Diagnosis and tuning

Verified baseline: fragment logical radius .32, assist .26, body .42, wings .28: effective body1.00 / wing.86. The visible crystal has radius .34, vertical scale1.35 and small breathing scale; the halo is about .54. Its luminous silhouette therefore exceeds the .32 logical crystal. Perspective and cosmetic banking further make grazing contact ambiguous.

Both old and new detectors already sweep the entire120Hz segment. Deterministic .2m and8m forward segments give the same near-tangent result; this is not endpoint tunneling. Far reveal finishes well before the pickup region. The closest-approach line-of-sight check still rejects real station boxes and asteroid proxies. No failing timing/duplicate-event or valid-aperture occlusion regression was found.

Candidates .26/.30/.32/.34/.36/.38 were checked against nearby grazing distances. At body separation1.09, .34 still misses (effective1.08); .36 succeeds (1.10). .38 extends farther without being needed for that target. Final shared assist is **.36**. The new wing damage radius .18 gets **+.10 wing-only pickup assistance**, so the wing collection radius is .18+.32+.36+.10 = **.96**. Pickup offsets use the current authoritative profile; no duplicate damage profile is introduced.

| Effective pickup distance | Baseline | Corrected |
| --- | ---: | ---: |
| Body |1.00|1.10|
| Each wing |.86|.96|

`ReleaseModel` passes both settings to FragmentRun. The same additional wing allowance is included in placement's coasting-route exclusion, preventing an accidentally automatic route. Part count, cadence hash/version, opportunity spacing2..4 ordinary sections, candidate cap, boundary inset, reach checks, local solid clearance and reward separation are unchanged.

## Authoritative event and evidence

Swept contact plus unobstructed sight produces exactly one collected transition/count. The original140ms attraction follows that event and uses the existing pooled view; chime, burst, pause/restart and resources retain their lifecycle. There is no pre-contact magnet or per-pickup resource allocation.

`polish-scenarios.json` contains real accepted fragments and exact ordinary inputs on seed0. The original and corrected sources receive the same inputs and same proposal coordinates:

- `pickup-body`: baseline0, corrected1, hull3; about1.06m vertical grazing separation.
- `pickup-wing`: baseline0, corrected1, right-wing event, hull3; .91m lateral offset from the corrected wing center (the small Y offset is recorded).
- `pickup-deliberate-miss`: both0, target1.20m away, hull3.
- `pickup-phase2`: baseline0, corrected1 at≈561.7m and normal Phase2 speed, hull3.

Native videos and clean/overlay stills exist for these cases in baseline/final media. `fixture-station-wall-block` is explicitly labelled: an intentionally invalid reward is inserted inside a genuine committed station panel to exercise the last line of defense. The station/player use real world geometry and steering; this is not claimed as a naturally spawned reward. The fixture retires uncollected and records9 blocked contact checks; its ordinary HUD count can include a separate legitimate fragment. Unit tests also block an asteroid and station wall, test both compensated wing tangencies, high-speed traversal, repeated checks, normal/Phase2 events and deliberate distant misses.

Across the final24-run corpus there are97 placements versus96 before, with unchanged frequency settings. Histories/admitted station opportunities differ after the collider change; this one-placement difference is reported rather than described as identical deterministic placement. Production proposals remain within X±4.9/Y±2.5; no reward is placed beyond the visual boundary. A boundary is a ship-center reference, not a physical wall or a new reward spawn region.
