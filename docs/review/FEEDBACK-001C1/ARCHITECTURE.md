# Architecture

Five existing runtime files are extended: World, AudioGraph, AudioManager,
FeedbackOrchestrator and feedback sound settings. New modules stay within sampled
audio and visual guidance. Gameplay models, generator, pickup/placement rules,
collider profile, camera/input, approved engine/music and existing effects remain
unchanged. No new framework, physics engine, backend or runtime dependency.

## Audio ownership

AudioManager remains the sole AudioContext owner and applies saved controls and
lifecycle as before. Orchestrator selects a material cue from the accepted damage
fact and adds restrained pan from its existing position snapshot. Fatal damage is
still filtered before choosing the single Major response; there is no second hit.

AudioGraph owns CollisionSamples. Eight asynchronous fetch/decode jobs make cached
physical/procedural composites, independent of gameplay RNG. Optional failure never
changes the graph to unavailable. Playback selects a ready composite or the existing
fallback in constant time, creates one source and optional gain/panner, then uses
the existing six-voice priority pool. End/cancel/dispose disconnect all voice nodes.
The bank is shared across runs; source IDs, fallback, score and engine buffers are
not rebuilt. Music sources and phase gating are unchanged.

Sample settings are centralized in sample-settings.ts. Input byte count is captured
before decodeAudioData, which may detach its ArrayBuffer. Decoded source buffers
are temporary; only the eight mono composites remain. Layer errors retain an already
valid mix. Bank disposal aborts work, ignores late results and clears retained PCM.

## Guidance ownership

World owns one PickupGuidance with two reusable GuideRibbon meshes: forward wing
paths and one target-depth cross-section. Two geometries/two materials use one soft
screen-width shader role, depth testing, transparent edges and no depth writes.
They are warmed by the existing loading warmup and disposed explicitly once.

The beam origins follow the visible wing surfaces through the ship quaternion.
Only their short1.5m connectors bank; their long paths use fixed gameplay X/Y axes
at the real wing offsets and extend forward72m, fading with distance. They never
rotate or home toward a shard. The contour is the exposed dashed boundary of the
union of the model's three pickup circles, not a made-up centered screen reticle.
It is placed at the selected shard's actual Z depth using the actual camera.

The profile/assistance shape is rebuilt only if the model's profile or assistance
changes. Beam buffers, vectors, query scratch and materials are reused during
frames. The marker geometry is static; position/opacity uniforms change. Projection
uses the real camera matrix, and CSS drawable dimensions keep line widths stable
under DPR/letterboxing. Mobile landscape844×390 has an actual780×390 drawable area.

Selection reads existing active slots, nearest ahead within2.5–72m, projected
visibility and opaque proxy occlusion. A separate ShipHazardCollision instance
queries sight rays without touching gameplay collision counters. The brighter
state requires current transverse overlap and unobstructed current part-to-shard
sight; it does not predict future controls, motion, rotating hazards or pickup.
Camera-occluded targets have no marker. A visible target with every eligible
part-to-shard ray blocked receives no positive alignment indication. Raster depth testing also respects
opaque scenery.

There is no new HUD/menu/input handler. GUIDANCE.enabled and World.guidance.enabled
provide isolated comparison. Pause freezes the geometry; viewport uniforms still
update. Toggle/reset clears stale target state; new runs reuse buffers. Menus,
game over and destruction hide the guides, preserving the approved presentation.
