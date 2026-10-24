# Space Runner

Third-person endless avoidance flight for desktop and mobile. The approved Concept A interface now presents real flight, hull, distance, pause/results and native audio settings. Gameplay, camera, calibrated collisions, VFX, procedural generation and audio ownership remain unchanged.

## Controls and rules

WASD / arrows steer on X and Y; press/drag the flight area for touch or mouse steering. Release to brake. Escape/P and HUD buttons pause/resume. M toggles mute; Sound settings in menu/pause controls master/music/SFX. Focus/visibility loss pauses and silences audio until explicit resume. Three hull points, 1.6 seconds of invulnerability per hit, distance-based score, persisted best, and one-click replay.

X is horizontal, Y is vertical, forward is −Z. The ship stays at Z=0 while hazards and scenery move toward +Z. The ship's logical collider is a sphere separate from its decorative wings/engines.

## Code map

| Module | Responsibility |
| --- | --- |
| `src/config.ts` | Playfield, movement, difficulty, pool sizes, render caps |
| `src/core/game-model.ts` | Explicit state machine, run data, health, distance, collision integration |
| `src/core/ship.ts`, `collision.ts` | Pure movement and continuous sphere/rounded-box collision math |
| `src/core/hazard-profile.ts`, `hazard-collision.ts` | Measured box bounds, shared orientation, continuous sphere/box intersection and reusable query state |
| `src/core/obstacles.ts`, `random.ts` | Seeded policy, reusable hazard/wave slots, route budget |
| `src/game-loop.ts` | 120 Hz fixed simulation, capped 100 ms frame delta, one animation loop |
| `src/world.ts` | Three.js scene/camera, pooled hazard transforms, VFX coordination and disposal |
| `src/visuals/` | Separately owned starfield/nebula/planet, engine ribbons, impact pool and rendering-only quality/timing |
| `src/audio/` | Native context/graph ownership, original synthesis/music, bounded SFX, safe preferences and accessible sound dialog |
| `src/assets/` | Model catalog, asynchronous GLTF loading/cache, normalization/cloning, shared resource ownership |
| `src/debug/` | Optional development-only wire bounds, diagnostics and private resource ownership |
| `src/input.ts` | Once-per-game keyboard/pointer listeners, pointer capture, input clearing |
| `src/game.ts`, `ui.ts` | Lifecycle wiring, resize/focus/context handling, DOM screens/HUD |
| `src/services/` | Safe score persistence and standalone/future platform seam |

No renderer or DOM dependencies enter the core simulation. Restart resets existing objects without rebuilding the renderer, UI, or event listeners. HMR disposal aborts listeners, disconnects the resize observer, cancels the loop, and disposes shared GPU resources once. Debug access is opt-in and development-only.

## Fairness and balance

Three lane centers are X=−4, 0, +4. Every wave leaves one full-height corridor; successive safe centers differ by at most 4 units. All occupied-lane sphere colliders remain outside the protected half-width plus ship radius. Hazards share a wave plane, with at least 60 units between planes. At 34 units/s this gives 1.765 seconds. A conservative budget including 0.45 s reaction, acceleration, braking, one-lane travel, and the collision slab is 1.609 seconds. Seeded tests check this budget and actual ship dynamics. The guarantee is a reachable route when following successive corridors; arbitrary late player decisions can still cause a hit.

Speed rises from 20 to 34 units/s over 120 s. Density rises from 0.52 to 0.97 and wave spacing narrows from 66 to 60 units. The first four seconds contain no hazards; subsequent waves appear 108 units ahead. Append `?seed=42` to reproduce a route.

## Rendering and scope

Kenney Speeder A, three meteors, cargo barrel and generator debris replace the ship/hazard primitives. Three star layers, edge streaks, a subtle procedural nebula, distant planet/rim/ring, cyan engine cores/ribbons and amber impact particles provide depth and speed. Blue corner fragments are very dim; green safe-wave rectangles remain removed while logical corridors/waves remain. No external textures or postprocessing; audio is original synthesis. Camera distance expands in portrait using the unchanged approved formula. DPR caps are 1.4 for coarse pointers or a viewport short side below 600 px, and 1.75 otherwise; the display aspect remains capped at 2:1 with letterboxing.

Boot preloads six local GLBs before Game creation, with progress/error/retry. AssetManager owns imported resources; World borrows rigid clones and owns only its procedural geometry/materials. Restart does no loading or cloning. Original files are unchanged; runtime centers pivots, normalizes ship width/hazard radius, and adjusts metallic/roughness for the existing lights. Five hazard visuals derive from existing kind/phase, with no extra PRNG draws. See `review/PHASE-2-001/ARCHITECTURE.md` for contracts, disposal/cancellation details and risks.

Platform methods remain standalone no-ops except safe local storage; no Yandex SDK API signatures are guessed. Physical mobile performance and broader browser support still require verification. Review tooling packages committed blobs and actual verification evidence without shipping development files to the game.

## PHASE-3-004A design exploration

PHASE-3-004A remains isolated in `design/ui-concepts/`: three browser-rendered UI alternatives and real approved-game backgrounds. Its review state/sliders remain independent of Game/AudioManager and do not save settings or play audio. The owner approved A in PHASE-3-004B; production now adapts the original `HUD` and DOM/styles using local Oxanium 500/Plex Mono 400, live hull counts/pause metrics, safe-area layouts and full large-score formatting. SoundPanel/Game/input/rendering/core remain unchanged. See `review/PHASE-3-004B/` for integration, accessibility, build/measurement boundaries and reference deviations. Repository UI guidance remains in `.agents/skills/space-runner-ui-design/SKILL.md`.

## PHASE-3-003 audio lifecycle

`Game` submits existing model values and gestures to one `AudioManager`. The core model and renderer know nothing about Web Audio. After a permitted gesture, four native continuous sources feed SFX/music buses and a headroom-controlled master. Original generated buffers are cached once; temporary voices are capped at six and cleaned on completion. `hitSerial` selects one normal or final hit event; silent/locked states consume it without later replay. Pause fades continuous sound, backgrounding suspends the context even in menus, final damage finishes its one-shots, and restart preserves the graph. HMR/disposal closes it and invalidates late initialization.

`space-runner.audio.v1` stores only validated preferences, independently of best scores. The menu/pause native dialog supports touch/keyboard and reports blocked/unavailable audio truthfully. Reloads never bypass autoplay. See `review/PHASE-3-003/ARCHITECTURE.md`, `AUDIO-LIFECYCLE.md`, `AUDIO-DESIGN.md` and `PERFORMANCE.md` for routing, ownership, actual signal diagnostics and pending manual listening acceptance.

## PHASE-3-002 visual lifecycle

World delegates to `SpaceBackground`, `EngineVFX` and `ImpactVFX`, each with private `ResourceOwner` ownership. It tracks its own resources before attaching these roots, preserving imported shared GLB resources. Star movement derives from frozen run distance; engine time/history freeze on pause; impact time may finish after death. Restart reuses all roots/buffers and clears history/bursts. Reduced motion removes edge streaks, slows decorative parallax and softens engines/impacts. Mobile lowers star/streak/particle draw counts without changing gameplay or reallocating resources. See `review/PHASE-3-002/ARCHITECTURE.md`, `VFX-IMPLEMENTATION.md` and `PERFORMANCE.md` for contracts and evidence limits.

## PHASE-3-001 collision and diagnostics

The two round meteors retain their spheres. Half meteor, barrel and generator now require continuous overlap with both the original outer sphere and a measured model-aligned box. Rounded box edges/corners use point-to-box distance over the sphere's overlap time interval; a small midpoint rotation bound prevents tunneling. The old outer limit guarantees that no previously safe corridor becomes blocked. Ship radius, movement/camera, health and difficulty settings are unchanged.

`?debug=colliders` on the development server dynamically loads a private wireframe view. Disabled mode creates no debug resources; production strips the module. World updates/disposes the optional view, whose two wire geometries are separately owned from scenery and GLB resources. Restart reuses its player/72 hazard slots. See `COLLISIONS.md` and `review/PHASE-3-001/ARCHITECTURE.md` for measurements, numerical guarantees and known conservative limits.

## GAMEPLAY-001A research

The live generator remains unchanged. The [audit](game-design/CURRENT_GENERATOR_AUDIT.md) measures coplanar waves and permanent safe X±2 stripes. The eight game-design records preserve the approved research baseline. The subsequent owner-authorized B-1 foundation is described below; later milestones still require external review.

## GAMEPLAY-001B-1 isolated foundation

`core/field-generator.ts`, `field-settings.ts` and `field-types.ts` provide immutable planned hazards, keyed random-access ambient proposals and structural checks. Tests/research tooling alone import them. Depth anchors use separate keyed pose/depth streams, actual half-open24-unit ownership and48–144-unit transactions; each owner has0–2 hazards. Candidate12/context32 bounds are separate from the unchanged live72-record pool. The future validator has an interface only: structure does not imply a reachable path. There is no live flag, publisher, director, encounter library, scoring or new asset. See [implemented architecture](review/GAMEPLAY-001B-1/ARCHITECTURE.md), [measurements](review/GAMEPLAY-001B-1/PERFORMANCE.md) and TASKS. B-2 requires external review approval.

## GAMEPLAY-001B-2 isolated validation

The subsequent B-2 authorization adds `field-validator.ts`, `field-validator-types.ts`, `field-prediction.ts` and `field-clearance.ts` for incremental exact-state beam search, independent replay and later-root checks. A private real Ship handles movement; shared original collision functions/profiles handle margin queries, while replay also calls unchanged gameplay HazardCollision. All original gameplay/test sources stay unchanged; B-1 context adds only an optional reservation bound. The result certifies a particular replayed input sequence through the supplied known field into an empty braking tail, not arbitrary inputs or human fairness. There is no gameplay flag, scheduler or live publication. See [architecture](review/GAMEPLAY-001B-2/ARCHITECTURE.md), [evidence](review/GAMEPLAY-001B-2/FAIRNESS_EVIDENCE.md) and [performance](review/GAMEPLAY-001B-2/PERFORMANCE.md). B-3 requires external review approval.
