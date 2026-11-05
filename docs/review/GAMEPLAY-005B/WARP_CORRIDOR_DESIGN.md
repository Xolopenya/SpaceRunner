# Restrained world-space corridor

The new default is `warp`; the exact005A streams remain available as `legacy`. New surfaces use the authoritative `CONFIG.bounds` values: X=±6 and Y=±3.6. Unlike the old1.3m outer visual envelope, the new cues align with the actual ship-center limits. They are visual references, not solid walls or a wing collision tolerance.

Four reusable shader surfaces create separated thin energy threads, a soft local halo and sparse forward streaks. There are no crossing grid frames, viewport-attached rails, textures, lights or postprocessing. Corner gaps and low center intensity keep open space visible. Blue/cyan tone is distinct from the fragment's bright mint/white core and the mine's red warning.

Each side evaluates its own signed distance to its bound. Proximity is smoothstep over the last2.4m, with intensity `0.10 + 0.90 × proximity`. Opposite sides stay faint; a corner strengthens two adjacent sides. The function has zero slope at its endpoints, avoiding a threshold jump. Buffers and materials are reused; only scalar uniforms change each frame.

Travel phase follows actual run distance modulo23m, with a different fixed phase per side. The analytic pattern moves toward the ship consistently with forward motion. Geometry stays fixed; the pattern wraps while its near/far envelope is faded. Depth envelope fades in over4..20m and out over115..180m. Pause freezes distance and therefore flow. Restart resets phase; reduced-motion removes moving streaks while retaining the spatial reference.

Thin strokes use pixel derivatives for antialiasing in the distance. Depth testing remains enabled and depth writing disabled, so hazards occlude the corridor. Glow is translucent/additive and restrained. Actual center/edge/all-corner shots, a center→right→center video and portrait/landscape evidence are included. Visual clarity improved over the first deliberately rejected faint prototype; that initial iteration's logs are retained separately.
