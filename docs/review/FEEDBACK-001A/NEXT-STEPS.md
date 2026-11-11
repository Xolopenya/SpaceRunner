# Readiness for FEEDBACK-001B

| Planned work | Available foundation | Still required |
| --- | --- | --- |
| Hull damage | Real old/new HP, position, velocity, run/time, existing shimmer lifecycle | Own/reset/dispose material variants and approve damage art. |
| Asteroid breakup | Separate collision fact, obstacle kind/ID/position, priority routing | Bounded debris/art pool; preserve authoritative collision and reward policy. |
| Mine explosion | Same context, original SFX bus, cancellation lifecycle | Map authoritative mine identity to presentation; preserve homing/warning timing. |
| Local station hits | Ship/obstacle reference positions and identity | True local contact point/normal or ship-part context from the existing kernel; do not invent normals. |
| Ship destruction sequence | One destroyed fact/run, Major priority, voice/reset/disposal handling | Dedicated bounded presentation sequence. Any results delay needs an explicit gameplay/overlay policy change. |

New adapters/presets can be added without reworking damage or pickup truth. The
foundation intentionally supplies no fracture physics, future material ownership,
exact surface geometry, arbitrary timeline or new GAME_OVER delay.

Owner playtest should judge comfort/readability, muted play, pause and repeated replay
on a physical phone. Existing damage/phase-label overlap is a later HUD layout task.
