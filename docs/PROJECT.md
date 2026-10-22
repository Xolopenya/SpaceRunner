# Space Runner

Third-person endless avoidance flight for desktop and mobile. The current milestone integrates six licensed Kenney GLBs into the playable Phase 1 loop, preserving the existing simulation and controls.

## Controls and rules

WASD / arrows steer on X and Y; press/drag the flight area for touch or mouse steering. Release to brake. Escape/P and HUD buttons pause/resume. Focus/visibility loss pauses until explicit resume. Three hull points, 1.6 seconds of invulnerability per hit, distance-based score, persisted best, and one-click replay.

X is horizontal, Y is vertical, forward is −Z. The ship stays at Z=0 while hazards and scenery move toward +Z. The ship's logical collider is a sphere separate from its decorative wings/engines.

## Code map

| Module | Responsibility |
| --- | --- |
| `src/config.ts` | Playfield, movement, difficulty, pool sizes, render caps |
| `src/core/game-model.ts` | Explicit state machine, run data, health, distance, collision integration |
| `src/core/ship.ts`, `collision.ts` | Pure movement and swept-sphere collision math |
| `src/core/obstacles.ts`, `random.ts` | Seeded policy, reusable hazard/wave slots, route budget |
| `src/game-loop.ts` | 120 Hz fixed simulation, capped 100 ms frame delta, one animation loop |
| `src/world.ts` | Three.js scene, camera, pooled visuals, particles, disposal |
| `src/assets/` | Model catalog, asynchronous GLTF loading/cache, normalization/cloning, shared resource ownership |
| `src/input.ts` | Once-per-game keyboard/pointer listeners, pointer capture, input clearing |
| `src/game.ts`, `ui.ts` | Lifecycle wiring, resize/focus/context handling, DOM screens/HUD |
| `src/services/` | Safe score persistence and standalone/future platform seam |

No renderer or DOM dependencies enter the core simulation. Restart resets existing objects without rebuilding the renderer, UI, or event listeners. HMR disposal aborts listeners, disconnects the resize observer, cancels the loop, and disposes shared GPU resources once. Debug access is opt-in and development-only.

## Fairness and balance

Three lane centers are X=−4, 0, +4. Every wave leaves one full-height corridor; successive safe centers differ by at most 4 units. All occupied-lane sphere colliders remain outside the protected half-width plus ship radius. Hazards share a wave plane, with at least 60 units between planes. At 34 units/s this gives 1.765 seconds. A conservative budget including 0.45 s reaction, acceleration, braking, one-lane travel, and the collision slab is 1.609 seconds. Seeded tests check this budget and actual ship dynamics. The guarantee is a reachable route when following successive corridors; arbitrary late player decisions can still cause a hit.

Speed rises from 20 to 34 units/s over 120 s. Density rises from 0.52 to 0.97 and wave spacing narrows from 66 to 60 units. The first four seconds contain no hazards; subsequent waves appear 108 units ahead. Append `?seed=42` to reproduce a route.

## Rendering and scope

Kenney Speeder A, three meteors, cargo barrel and generator debris replace the ship/hazard primitives. Points starfield/particles, a distant planet, guides and inexpensive engine cones remain procedural. No textures, postprocessing or audio. Camera distance expands in portrait to preserve horizontal playfield visibility. DPR caps are 1.4 on narrow displays and 1.75 otherwise; playfield display aspect ratio is capped at 2:1 with letterboxing on wider screens.

Boot preloads six local GLBs before Game creation, with progress/error/retry. AssetManager owns imported resources; World borrows rigid clones and owns only its procedural geometry/materials. Restart does no loading or cloning. Original files are unchanged; runtime centers pivots, normalizes ship width/hazard radius, and adjusts metallic/roughness for the existing lights. Five hazard visuals derive from existing kind/phase, with no extra PRNG draws. See `review/PHASE-2-001/ARCHITECTURE.md` for contracts, disposal/cancellation details and risks.

Platform methods remain standalone no-ops except safe local storage; no Yandex SDK API signatures are guessed. Physical mobile performance and broader browser support still require verification. Review tooling packages committed blobs and actual verification evidence without shipping development files to the game.
