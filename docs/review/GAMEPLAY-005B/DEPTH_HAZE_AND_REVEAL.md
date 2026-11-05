# Certified reveal and depth treatment

Logical scheduling, publication distances, search budgets, reaction prefix and colliders are unchanged. Rendering starts only from existing certified slots/reward proposals. There is no speculative visual obstacle, collision suppression, scale-up animation or delayed gameplay activation.

`ObjectReveal` uses two shared publication cohorts and one fully mature material variant per original material/family. Variants are shared among pooled meshes; geometry and textures remain borrowed. Binding an ID reads its existing successful publication receipt once. Absolute simulation elapsed time drives birth progress, so pause freezes it and render cadence cannot restart a fade. New IDs and restart clear stale bindings. If both short-lived cohorts are occupied, a further identity fails open to the mature variant; it never extends concealment. The engineered saturation case is tested and observed cohort fallback counts are reported.

The shader uses stable screen-space coverage discard rather than alpha blending for opaque hazards. Kept pixels retain their original depth test/write and material flags; discarded pixels reveal actual stars/background instead of an opaque flat fog mask. No transparent ghost ordering or extra pass is introduced. Noise is fixed in screen coordinates, with no time-based flicker. Fully revealed near-field geometry uses its original color and opacity. Distant coverage can show fine grain, particularly after video compression; owner assessment is required.

| Family | Full spatial coverage at world depth≤ | Zero coverage at world depth≥ | Maximum navy attenuation | Birth transition |
| --- | --- | --- | --- | --- |
|Debris/asteroids|105m|205m|22%|360ms|
|Station|150m|215m|18%|420ms|
|Mine body|145m|235m|15%|320ms|
|Fragment|140m|215m|12%|280ms|

Depth is measured along world−Z from the ship plane, not from a farther portrait camera. The original scene fog remains available exactly in legacy mode. The patch affects registered gameplay objects only: ship, stars, planet, background, engine/impact VFX and pickup burst retain their existing rendering.

The mature mine silhouette now emerges while its already certified controller is waiting. Its lamp stays off during waiting, then uses the original warning tick/pulse and original pursuit state. The red warning is fully covered by the time it begins; no warning delay was added. Fragment geometry is fully revealed long before pickup depth; shell/core/halo identity, assist and attraction remain unchanged.

Two cohort banks plus a mature variant reuse shader programs. Material variants are allocated at World setup, never per frame. Targets cache their mesh/material bindings; no full scene traversal is added to the tick loop. Reveal owns and disposes only its variants, restores borrowed materials before other view cleanup, and never writes authoritative model state.
