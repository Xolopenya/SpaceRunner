# Linear crossing v1

Logical position is `x = x0 + vx * clamp(n - startTick, 0, durationTicks) / 120`, with `n = round(elapsed / (1/120))`. Y is0 and depth is `currentDistance - passDistance`. The fixed simulation provides elapsed; render time, random frame deltas, wall clocks and audio clocks never enter this calculation.

Initial X is−6 for left-to-right or+6 for right-to-left. Slow speed1.5 units/s crosses in960 ticks (8s); moderate speed2 crosses in720 ticks (6s). Motion starts and finishes on integer ticks. Before/after crossing the mine holds the corresponding endpoint until ordinary depth retirement; no teleport, reversal, homing or acceleration exists. The ship retains8units/s maximum,32 acceleration and25 braking; even moderate mine speed is one quarter of ship maximum.

At proposal, passTick integrates the exact end-speed forward clock from the current actual state. The crossing midpoint aligns with that estimated ship-plane tick. Forward progression is input-independent, so this timing never tracks the player's XY. Once proposed, the absolute start tick never moves during planning/publication. Actual publication re-evaluates the same trajectory at its current phase. Seed, source cell, version, absolute start tick and speed/direction appear in the stable hazard ID and witness metadata. Reproduction needs the same input/publication history, as in mixed flow.

DEV configurations: `mine=slow-ltr`, `slow-rtl`, `moderate-ltr`, `moderate-rtl`. Omit this parameter for seeded selection. `firstMine=1` makes the first six-cell section a mine plus the complete two-cell ordinary ambient payload; it still requires the full safety certificate. Both overrides are testing tools, not separate motion behaviors.

Pause, focus loss and game over freeze elapsed. Resume continues the same phase. Restart resets the source cursor, model elapsed, pool and pending planning; no timer survives. Rendering reads the authoritative slot pose without interpolating gameplay truth. No cosmetic rotation is needed for this spherical approximation.

Unit tests check exact start/mid/end poses, direction, speed/duration bounds, malformed parameters, phase-sensitive identity and deterministic restarts. The benchmark records quarter-second pose traces; real-render raw profiles record every RAF-associated pose and simulation tick beside the native WebM.
