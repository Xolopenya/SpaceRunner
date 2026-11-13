# Visual ownership and event flow

```text
Original authoritative fixed step
  collision → inactive/HP/immunity/GAME_OVER (unchanged)
  copied obstaclePose + original typed facts
        ↓ GameEvents.flush after the complete model step
  existing FeedbackOrchestrator chooses one coherent contact
        ├─ collision → CollisionVFX family pool / approximate proxy placement
        ├─ damage → HullDamage + existing ship ring/shimmer + original SFX/camera
        └─ destroyed → ShipDestruction + original destruction SFX
                          ↓ bounded DestructionSequence
                  Game defers results/focus and secondary cue only
```

## Source truth and identities

The only GameModel edit is an immutable rendering snapshot of radius/phase/spin/
distance. A separate collision fact is paired with the chosen contact in the same
001A batch. Geometry/CCD, acceptance, HP and immunity are untouched. Presentation
reads proxy profiles for nearest-surface approximation, never calls a hit/sweep to
decide gameplay and never writes hazards. The mine's event identity and actual
accepted slot pose identify the blast; no lookup of a potentially replaced mine.
Stations already remain rendered while their planned ownership exists, even after
active=false. Reuse that continuation instead of a duplicate proxy or geometry.

## Hull and debris ownership

AssetManager remains owner of cached GLB resources. The ship's four materials are
cloned once; HullDamage owns/disposes only clones and its fixed leak geometry/material.
Scorch/cracks are shader evaluations on real GLB surfaces in normalized local space.
Deterministic authored zones mirror by incoming X direction and accumulate by HP;
they are not claimed as exact physical scratches at a swept contact point.

ShipDestruction owns six normalized triangle partitions from the original speeder,
with vertex paint colors and original normals. Large wings/engine/nose/keel sections
use closed-form drift and independent spin. Borrowed asset geometry is not edited or
disposed. Explosion core, cloud, ring, fixed particles and a12/6-instance small
metallic debris batch are built once. Geometry updates stop while the sequence is idle.

CollisionVFX has three slots. Each reuses instanced debris, particle/streak attributes,
a ring and a glow sprite. Shared geometry is owned once through ResourceOwner sets.
All motion is analytic from age; cosmetic Random instances never touch model RNG.
Normal play typically has one active burst because the original immunity exceeds
burst duration. Explicit capacity/exhaustion behavior is tested independently.
Disposal also calls `InstancedMesh.dispose()` for all three collision batches and
the small ship-debris batch, releasing mesh-owned instance buffers separately from
their shared geometries/materials. Both ownership paths are idempotent and tested.

## Presentation lifetime and UI

| Moment/state | Behavior |
| --- | --- |
| Accepted contact | Copy context before slot reuse; route family response and ship consequence together. |
| 2/1 HP | Material stage remains until authoritative HP/reset changes; transient cancellation preserves it. |
| PAUSED | Existing simulation clock and new effect/camera/damage animation freeze. Resume creates no hit. |
| HP0 / GAME_OVER | Original score/best/platform stop occur immediately. Input clears; model stops. Results are hidden temporarily. |
| 0–0.15s | Fatal flash/overload, immediate original destruction cue. |
| 0.15–0.50s | Unstable engine glow, small presentation tumble. |
| 0.50–1.10s | Intact ship hidden, six original hull sections separate, central energy and shockwave. |
| 1.10–2.05s | Drifting fragments fade, then original results and secondary game-over cue. |
| Reduced motion | Total0.65s, breakup0.12s, smaller travel, static hull emission, no camera displacement/streaks/leak flicker. |
| Skip | Space/Enter/Escape or accessible button completes the clock and reveals results synchronously. |
| Hidden tab | World presentation delta0; the skip remains reachable on return. |
| Context loss | Complete the sequence and expose results without waiting for a render callback; replay works after restoration. |
| Restart/dispose | Clear candidates/pools/pending cue; reset HP appearance/sequence; unsubscribe through existing lifetime and dispose owned resources. |

The public gameplay state remains GAME_OVER throughout the cinematic; only
`data-cinematic`, overlay visibility and focus differ. Completion is polled from a
bounded clamped-delta clock, with no timer callback dependency. A small independent
background drift after death does not change model distance or obstacle generation.
Hybrid is unchanged; existing scalar impulses decay to zero without accumulation.

Central tuning: `feedback/visual-settings.ts`, existing 001A presets, and existing
VisualQuality. No new texture, postprocessing chain, light, physics engine or backend.
