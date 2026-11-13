# Architecture and asset audit, before implementation

Base: local 5f5a4282d110187d7549e38366051ccfab139f6d, verified present; unrelated
untracked research/skill files preserved. No remote synchronization is assumed.

- AssetManager normalizes rigid texture-free GLBs; clone(true) shares geometry
  and materials. Speeder A has four material primitives (metal, amber metalRed,
  dark, metalDark), not independently detachable mechanical parts. Damage must own
  cloned materials. Normalized local coordinates allow scars on the actual mesh;
  no floating decal planes. Breakup can partition the original triangles once at
  initialization, retaining authored silhouette/colors and borrowed asset ownership.
- Production IntegratedModel inherits ReleaseModel: asteroid kinds 0/1, industrial
  barrel/generator kind2, fixed station variants4–8, moving mine9. Legacy kind3 is
  a separate large-structure diagnostic. hazardVariant/Orientation and existing
  box profiles are the source for presentation-only placement estimates.
- Accepted collisions mark the slot inactive before publishing facts, but position,
  radius, phase/spin and optional planned identity still exist. Extend only the
  existing observation payload with a copied pose/distance; never change hit tests.
- IntegratedView draws its one active moving mine from that slot's actual pose,
  using MineShell and the licensed core. Detonation must use the event's identity
  and captured pose, never a later homing.current or a search for the visible mine.
- StructureVariantsView intentionally retains station rendering while planned
  ownership exists, even when active=false. It continues moving the rigid hull to
  despawn. Reuse this existing noninteractive persistence; no second station proxy.
- 001A owns a bounded FIFO and coordinator; retain it. Route the separate collision
  fact to family bursts in the same chosen contact batch. Persistent hull appearance
  is distinct from transient cancellation. Reuse the existing shield/ship ring,
  sound buses and camera interface; replace generic orange obstacle particles.
- GameModel enters GAME_OVER immediately and stops stepping. Game records score and
  platform gameplay stop on that transition. HUD currently reveals results at once.
  Add a bounded presentation clock, not another gameplay state. Defer only the
  results overlay/focus and secondary game-over cue. Skip completes the clock.
- visualDelta already freezes PAUSED and permits aftermath in GAME_OVER. New effects
  use clamped presentation time, freeze while hidden/context interrupted, cancel on
  restart/dispose, and offer an always reachable keyboard/touch skip. Context loss
  can reveal results safely without waiting for a GPU callback.
- Existing mobile/reduced-motion tiers and ResourceOwner remain the quality/ownership
  seams. New debris/particles use fixed pools/shared geometry, analytic time-based
  motion, cosmetic-only seeds, and no runtime fracture or per-impact GPU allocation.

The visual approach is graphite scorch and controlled cyan/amber fissures on armor;
rock shards/dust for asteroids, metallic splinters for industrial contacts, a cyan
core/shockwave for mines, localized stationary-surface sparks for stations, and
recognizable original hull sections for a configurable approximately2s final breakup.
