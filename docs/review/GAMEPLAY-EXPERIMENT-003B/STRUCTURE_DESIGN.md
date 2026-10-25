# Structure design — GAMEPLAY-EXPERIMENT-003B

Approved base: `56824ad60b0f2583589d6b21de4dfce8db43c07d`, present in local and fetched remote main (0/0 divergence). Branch: `feature/gameplay-003b-large-structure`.

One abandoned docking bulkhead: outer20×13×6 units, open rectangular bore5.6×4.4 units. Two piers connect a crown and sill; deep orange inside faces and flush orange entry/exit markings give a single industrial frame silhouette. All painted panels lie on solid surfaces. The rear opening is physically identical to the front. Four geometry boxes are also the exact collision solids; their enclosing sphere radius13 is metadata/broad phase only.

| Solid | Center X/Y/Z | Half extents X/Y/Z |
| --- | --- | --- |
| Port pier | −6.4 /0 /0 |3.6 /6.5 /3 |
| Starboard pier |6.4 /0 /0 |3.6 /6.5 /3 |
| Crown |0 /4.35 /0 |2.8 /2.15 /3 |
| Sill |0 /−4.35 /0 |2.8 /2.15 /3 |

Five deterministic translations of this same structure: center(0,0), left(−3,0), right(3,0), upper(0,1.9), lower(0,−1.9). It never rotates or changes scale. Without `aperture`, seed+encounter index cycles these five positions; `seed=42` starts right. An explicit aperture repeats that position. Center allows a straight approach; every offset intersects the neutral centerline with a solid section. Even the most translated outer boundary extends beyond the full ±6/±3.6 ship-center domain plus the0.42 collision radius. Four corner sweeps hit for every variant. This blocks the measured boundary bypass for this encounter, not for the old field or all possible content.

One full six-cell source span (144units), center60units into its span. First source starts at96, center156; publication occurs at fixed tick144, about24.085distance, leaving118.345units to the conservative radius13 warning envelope. The fog/camera are unchanged; exact publication,45-unit,8-unit and post-exit snapshots are retained. The next structure is144units later, with no ambient fillers or adjacent complex patterns. The terminal empty tail is explicitly reserved to the owned source end. This is a repeatable content encounter, not a replacement director or ambient sampler.

Exact DEV URL: http://127.0.0.1:5173/?debug=field&experiment=large-structure&seed=42

Optional `&aperture=center|left|right|upper|lower`, `&colliders=1`. Unknown names and ambiguous policy+experiment requests fail explicitly. Existing baseline and pressure URLs keep their original behavior. No production UI control is added.

The developer view borrows World slot transforms and owns its own geometry/materials/wires. It hides the borrowed small-model representation for **every** large slot, including distant committed structures. Eight preallocated groups share one model/wire resource set, matching the32primitive/4 maximum; no published object is accidentally rendered as an enlarged barrel. It retains the static mesh during the inherited impact/invulnerability/exit phase while the logical ledger remains intact, then hides it at normal render despawn. No geometry is allocated per spawn/restart. Teardown detaches and disposes owned resources only. `GameModel.collisions` changes private→protected solely for subclass injection, with exact source normalization and production-byte checks; all movement/damage code remains authoritative. World exposes the existing read-only slot array for this developer renderer. Both visibility changes erase from production JavaScript.
