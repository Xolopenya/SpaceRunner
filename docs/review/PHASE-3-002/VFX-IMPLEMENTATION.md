# Space atmosphere and flight VFX

## Environment

Three stable, separately seeded Points layers replace the single star buffer: 780 distant, 280 middle and 64 sparse near points. Distance factors are 0.08, 0.36 and 1.15. Near points and 28 paired-vertex speed streaks favor the outer flight area. Streak length/brightness respond to actual speed without modifying it. Wrapping occurs behind the normal desktop/portrait camera positions, with fixed x/y patterns and no rerolling.

One screen-space shader supplies low-frequency navy/indigo/violet gradients, strongest away from the central flight corridor. It uses no texture or noise dependency and has no animated uniform. A distant, off-center planet retains low-poly-compatible simple lighting, with a wider tilted ring and a thin additive atmospheric rim. Existing blue corner fragments are further dimmed after screenshot inspection; no closed/green gates are introduced.

## Propulsion

Two procedural radial glow planes combine bright cyan-white cores with soft blue halos at the approved rear ports `(±0.56, -0.21, 1.49)`. Small cone flames provide a tapered plasma base. These nodes inherit the ship transform, so steering/banking cannot detach them. Material sharing is confined to VFX; asset materials remain unchanged.

Two 24-sample histories feed one indexed ribbon buffer. Sampling is 90 Hz, with interpolation between rendered port positions, and bounded historical advection toward +Z. Tail colors/width fade smoothly; length responds to actual speed. Port transforms, typed arrays and mesh resources are reused. A small controlled intensity variation never shuts down an active engine. Restart begins a fresh trail rather than connecting to the previous ship location.

## Damage

Each observed increase in `hitSerial` starts one 48-slot directional warm spark burst and a short expanding ring. The burst is biased against lateral steering and fades over the existing 0.55-second feedback duration. A thin low-intensity cyan wire shimmer indicates the unchanged invulnerability period; the ship remains visible rather than strobing. Final damage hides propulsion, lets the short impact finish behind the existing game-over UI, and hides the shield. No hull/cooldown, camera, collision or scoring rule changes.

## Scaling and accessibility

| Visual setting | Desktop | Mobile | Reduced motion |
| --- | ---: | ---: | ---: |
| Stars, far/middle/near | 780/280/64 | 420/140/24 | Same tier counts; middle/near motion ×0.35 |
| Edge streaks | 28 | 10 | 0 |
| Impact particles | 48 | 24 | 12 |
| Trail samples per engine | 24 | 24 | 24; dimmer/narrower |
| Engine intensity pulse | ±4% | ±4% | Steady |

Mobile also reduces nebula strength and applies the existing 1.4 DPR cap in landscape as well as portrait. Maximum-size buffers are allocated once; quality changes only select draw ranges/settings. There is no settings menu or persistent preference added.

## Evidence

Eight current `vfx-*.png` screenshots are captured by Playwright. Desktop/mobile/engine/speed/debug views use a documented arranged hazard scene at maximum speed, advanced with actual simulation and held for capture; the engine view crops the actual screenshot without changing the camera. The damage image injects an actual colliding hazard and verifies hull loss. Production is an untouched route-42 run after warmup. No fixture is part of production behavior.

Tests cover original behavior plus timing at 30/60/144 FPS, port alignment, deterministic stars, random-source isolation, bounded pools, one emission per hit signal, pause/focus freezing, death completion, restart identities/downloads, reduced motion, teardown and debugger/production isolation. See generated VERIFICATION and raw logs for exact final results.

Remaining approximations: trails are camera-independent flat ribbons rather than volumetric exhaust; spark feedback has no surface-normal contact location because the approved damage model provides only the hit serial/ship pose. Quality tiers are viewport/pointer heuristics, not automatic GPU benchmarking. Phone thermal behavior and other browser engines require separate validation.
