# GAMEPLAY-005B2 — wing geometry

## Actual model measurement

`polish-measure.mjs` parses the real Kenney `craft_speederA.glb` with GLTFLoader and the unchanged normalizeModel. Source bounds are (1,0,.45)..(3,.8,2.55). RotationY=0; recentering subtracts (2,.4,1.5); root scale=1.4 for width2.8. Final dimensions are2.8×1.12×2.94. Every sampled point includes the complete mesh/world transform.

Outer tip vertices are X±1.4, Y−.28..−.42, Z.49...91. Inspecting the actual triangles, rather than just those extreme vertices, reveals an upward slope inward: near X=.56 the top is Y−.14, and near X=.70 it is≈−.1633. At X=1.08 the wing top is≈−.2267, bottom≈−.3667 and mid-plane≈−.2967. The new center therefore follows that local plane at Y−.30. It is not an unexplained upward shift of the old large sphere.

`wing-measurement.json` retains vertices, triangles, transformation, bank extrema and .16/.18/.20/.22/.28 radius candidates. Barycentric sample counts describe a triangulation-dependent geometric probe, not an area-weighted gameplay coverage percentage. One sphere cannot cover every flat/sloped polygon while remaining thin and forgiving.

## Shared profile

| Part | Baseline X/Y/Z/r | Corrected X/Y/Z/r |
| --- | --- | --- |
| Body |0 /0 /0 /.42|0 /0 /0 /.42|
| Left wing |−1.02 /−.35 /.70 /.28|−1.08 /−.30 /.70 /.18|
| Right wing |1.02 /−.35 /.70 /.28|1.08 /−.30 /.70 /.18|

The lower envelope rises from−.63 to−.48; the upper envelope also contracts from−.07 to−.12. Lateral outer extent changes only1.30→1.26 through the small outward move. Axial extent is.98→.88. Radius.16 sacrifices another.02 at the tip/longitudinal edge; .20/.22 add lower/upper volume without being required for the retained real wing hits. .18 is a deliberate three-sphere arcade compromise, not mesh collision. Both new wing spheres fit entirely inside their original spheres (center displacement≈.0781 +.18 <.28).

`SHIP_COLLIDER` version advances to ship-body-wings-v2. Runtime spheres/rotating hazards, exact wreck boxes, actual mine relative CCD, prediction, broad bounds, final actual-root publication, independent replay and DEV overlay use this same immutable profile. Release and integrated geometry versions identify it; old certificates do not silently cross profile versions. Three-part query accounting,120Hz swept simulation, obstacle volumes, margins and planning budgets remain.

## Genuine flight and fixed tests

Seed0 genuine input histories target an already accepted ordinary asteroid; no obstacle/ship/health fixture is inserted. Left and right wing hits still give hull3→2 with `bodyClear=true` and the corresponding contact part. The lower-graze history gives hull2 before and hull3 after; the same actual asteroid and input history are retained. Capture receipts contain IDs, coordinates, speed, contact and frame pose. Native videos show the approach and pass, with clean gameplay plus overlays; multi-angle settled/banked profile images supplement the close contact view.

Tests cover both wing-only contacts, lower and upper near misses which the old profile hits, tip contact, fast/diagonal sweeps, station wall, adaptive moving mine, multiple-part single damage, immunity, broad-phase differential checks and accepted witness replay. Existing old-body differential/safety assertions remain.

## Banking limitation

Authoritative spheres stay in stable game axes. The unchanged cosmetic roll reaches≈.36rad and pitch≈.20rad; the measured tip Y envelope under roll alone changes from[−.42,−.28] to roughly[−.886,.231]. This mismatch is significant during hard steering and cannot be eliminated for all angles with three fixed spheres. Settled near-miss evidence uses almost neutral velocities. The calibration reduces the reported lower contact; it does not claim perfect alignment during every bank.

No renderer interpolation is fed into physics. A minimal future presentation-only option, if the owner still dislikes the hard-bank overlay, is to cap roll/pitch around±.20/±.10rad while retaining the stable profile. That option is documented, not silently applied to the already approved controls/ship presentation. No mesh collider, extra sphere count or higher planning budget was introduced.
