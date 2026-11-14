# Targeted mine review

The mine receives a localized amber/orange, briefly white-hot plasma core using the
existing ship core shader. Its warped sphere expands rapidly inside the retained
cyan curved wave and spatial arcs. A .18-second thermal envelope cools it quickly;
the original cyan residual energy continues afterward. The result stays smaller
than complete ship destruction. No opaque smoke, new light, texture or postprocess.

Open index.html for all 38 matched before/after frames. For each desktop/mobile
mine, inspect these relative-to-contact moments:

| Moment | Image suffix | Review point |
|---|---|---|
| Accepted contact | mine-contact.png | Same accepted identity, pose and HP loss |
| Ignition | mine-core.png, .05 s | Concentrated warm/white-hot filaments |
| Expansion | mine-expansion.png, .18 s | Amber volume extends beyond hull silhouette inside cyan |
| Shockwave | mine-shockwave.png, .40 s | Cyan curved shell/arcs retained, thermal component cooling |
| Residual | mine-residual.png, .85 s | Faint residual energy, no lingering opaque cloud |
| End | mine-ended.png, 1.30 s | Pool returned to normal scene |

Desktop 1280×800 and portrait 390×844 use the original Hybrid camera. All captures
use exact seed42 production IntegratedModel input tapes, real accepted collisions,
natural 3→2 or 1→0 HP changes and the existing immunity. There are no fake hazards,
forced HP/cooldown changes or substitute scenes. Prefixes are accelerated, shots
are held, and post-contact progression uses native RAF.

All 38 paired endpoints match in tick, time, ship pose, HP, immunity, distance,
collision facts and cinematic elapsed time. All 26 non-mine screenshots—shield,
ship failure/main blast/secondary/breakup/aftermath/results/restart in both
viewports—are byte-identical. Approved impact-vfx.ts, energy-materials.ts,
ship-destruction.ts, hull damage, destruction sequence and polish settings are
unchanged. Source preservation independently covers the gameplay and input/camera.

The actual audible mine-canvas.webm shows the final burst in motion. The matched
desktop/mobile page videos are silent and provide full-HUD context; they are not
used as audio proof. Three fixed burst slots borrow their existing sphere, each
adding one owned material/mesh. Warmup and disposal traverse them automatically.
Reduced motion attenuates the thermal envelope. No additional particle count or
gameplay/random-state authority is introduced. Owner artistic approval is pending.
