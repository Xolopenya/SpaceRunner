# PHASE-3-002 rendering architecture

Baseline: `d3d3aaaaaf0c7af52e4043cf57c15899ce77147e`. Scope: visual presentation only.

`World` retains the renderer, scene, approved camera/banking formulas, pooled hazard transforms and dim corner guides. It delegates scenery, propulsion and damage feedback to three focused modules in `src/visuals/`. They depend on Three.js, rendering-only settings, `ResourceOwner` and a separately constructed seeded `Random`; the gameplay model does not import VFX.

| Component | Contract and lifetime |
| --- | --- |
| `SpaceBackground` | Create three Points layers, one streak buffer, one procedural sky plane and a decorative planet/ring/rim. `setQuality` selects existing draw ranges. `update` derives stable positions from run distance. `dispose` removes its root and releases its resources. |
| `EngineVFX` | Attach two shared glow/core planes and two shared flame cones to the banking ship; keep one combined ribbon mesh in world space. Sample both exhaust ports into fixed histories at 90 Hz. `reset` clears history without replacing buffers. `update` accepts a state-gated delta, speed and quality; `dispose` removes both roots. |
| `ImpactVFX` | Observe `hitSerial`; retain one bounded 48-slot burst, one short ring flash and one thin shield shimmer. `reset` clears counters/particles; `update` accepts a clamped effect delta and model values; `dispose` releases private resources. |
| `settings.ts` | Counts, visual seed, trail timing, impact duration, quality selection and state-gated/clamped visual delta. No gameplay tuning. |

## Ownership

World tracks its own original scenery before VFX/debugger construction, excluding AssetManager's borrowed resources. Each visual subsystem then tracks only its private roots. This ordering prevents double ownership of VFX or imported model geometry/materials. Engine core/flame instances share their own static resources; no GLB material is modified. VFX creates no textures, listeners, timers or asynchronous loaders.

Restart resets engine history and the impact pool, while background positions derive directly from reset distance. The renderer, VFX roots/buffers and model clones survive. Teardown removes each subsystem and disposes each private geometry/material once; imported resources remain AssetManager-owned. Existing WebGL context recovery reconstructs GPU state from the retained Three.js objects.

## Timing and state

The fixed-step simulation loop is unchanged. Background motion uses gameplay distance, which freezes with the simulation. Engine time advances only while PLAYING; pause preserves its history/glow phase. MENU shows steady idle cores, and GAME_OVER hides continuous propulsion. Impact time advances while PLAYING or GAME_OVER, so the final burst can finish; PAUSED freezes it. All effect deltas are finite, nonnegative and capped at 100 ms. A hidden tab is paused by existing lifecycle handling, preventing a restoration jump.

The original whole-ship blink is replaced by a restrained cyan shield cue. The shimmer is decorative and has no collision role. The original impact shake formula, duration and maximum amplitude remain unchanged.

## Quality and isolation

Coarse pointers or a viewport with a short side below 600 px select the mobile tier in either orientation. Resizing changes draw ranges and the existing pixel-ratio cap; it does not rebuild resources or change the approved camera formulas. Reduced-motion preference changes are detected without event listeners: decorative streaks disappear, near/mid parallax slows, engine pulsation stops, trails dim/narrow and bursts use 12 particles. Gameplay motion remains intact.

Unit acceptance checks pin LF-normalized approved simulation/input/asset-normalization source hashes and the camera/banking formula hash. These checks deliberately require updating only when a later milestone explicitly approves changes to those contracts; they do not require Git history to run from the review snapshot.

No additional dependencies, external runtime URLs, audio, SDK integration or state-machine changes.
