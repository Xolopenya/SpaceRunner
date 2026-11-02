# Motion and collision

`target-lock-v1` extends versioned planned motion with a frozen actual-root capture and explicit integer phase boundaries. Baseline/Fast/Diagonal `linear-crossing-v1` records remain byte reproducible, including absence of optional vertical velocity in original horizontal records.

Authoritative `mineX/mineY` are pure functions of immutable metadata and 120 Hz simulation tick. Rendering, actual collision and validator prediction use these same poses. The ship collision radius remains 0.42, mine sphere 1.35; actual contact uses sum 1.77, safety replay adds the unchanged 0.15 margin (1.92). There is no explosion/area damage or enlarged danger volume.

The approved relative swept sphere checks the full segment between (ship−mine) endpoints. GameModel supplies collision endpoints relative to the END hazard pose, so MineCollision corrects the previous XY by the mine displacement. Warning is stationary, attack is linear, completion is stationary. All admissible boundaries are integer ticks on the same fixed 120 Hz grid; no legal simulation interval contains an interior phase change. Fractional boundary metadata is rejected. A future variable-step/subtick motion format would require explicit splitting and is outside this version.

Focused coverage compares 12000 random legal intervals, including both sides of launch/completion, to an independent analytical closest-point oracle at gameplay and safety margins. Tangency and high relative displacement/tunneling cases are included. The historical 18000 vector/12000 original moving CCD checks remain unchanged and required. Browser traces compare exact authoritative/rendered XYZ; phase, pause and post-lock steering retain identical metadata.

Actual normal-model unavoided seed 42 first contact removes one hull point (3→2), using existing invulnerability. Deliberate post-lock steering passes with hull 3. Negative late-response tapes are replayed from the ORIGINAL frozen target, end with the required 39 neutral braking ticks and reject specifically with COLLISION_FOUND on that mine. No invulnerability exploitation, immortal override or motion/collider substitution is used in these acceptance cases.

Original GLB:56912bytes, SHA256 `c64b8bfa0146ffc7d819f46ab74887326828b2b8266604b516a3cdc570189c77`; no new assets or downloads. See existing ASSETS.md for CC0 attribution.
