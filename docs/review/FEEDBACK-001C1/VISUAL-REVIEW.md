# Guidance comparison review

Open the extracted `index.html` for ON/OFF image pairs and synchronized-review
video pairs. View the same scene/controls in each state before judging style.
Source camera, pickup rules, quality settings and all approved VFX are preserved.

## Natural input evidence

Five original deterministic input tapes run through the production IntegratedModel:
body, left-wing, right-wing, Phase2 aperture and diagnostic screen-centre miss.
Each has1280×800 and390×844 captures; body additionally844×390 landscape. Eleven
groups produce66 baseline-OFF held screenshots,132 final OFF/ON shots and33 silent
page videos. Final video approaches run420 simulation ticks at native RAF after
accelerated prefixes. No ship teleports, inserted hazards or changed HP/radii are
used for this primary evidence. Video clips include loading/prefix transitions;
the gallery labels them rather than hiding their capture method.

For each successful group inspect distant(~55m), debris(~28m), close(~9m), inspect
(~3m), pickup and after-pickup states. The screen-miss sequence shows64/40/16/8/2/−3m
depth checkpoints. Its contour remains neutral while the screen-centre pilot
misses. Marker fade/selection ends inside2.5m; ordinary pickup presentation remains.

| Tape | Pickup tick | End count / HP |
|---|---:|---|
| body | 1502 | 1 /3 |
| left wing | 1510 | 1 /2 |
| right wing | 1511 | 1 /3 |
| Phase2 | 3104 | 1 /3 |
| screen-centre diagnostic | no pickup | 0 /3 |

All66 held states match baseline/final-OFF and final ON/OFF ship, velocity, distance,
HP, count, target, projection and fault fields. 61 baseline/OFF PNGs are byte-identical;
five differ only within the existing wall-clock CSS ENERGY-count glyph pulse, with
measured pixel bounds in `visual-comparison.json`. Every other scene pixel matches.
These outcomes prove preserved rules and visual geometry, not human usability gains.

## Observed rendering

Desktop distant body shows two restrained cyan paths converging through perspective
toward the small dashed corridor. The contour expands naturally at close depth,
including body and both wings; it does not chase the crystal. In portrait, paths
are shorter on screen and the contour supplies the clearer near-depth reference.
Phase2 captures show it with debris and the illuminated station aperture. Visible
obstacles retain silhouette and depth; guides use translucent soft edges, fading
distance, no luminous weapon muzzle, no hit effect and no added animation.

Only the short connector follows cosmetic banking. Long paths remain stable along
actual gameplay coordinates as the ship/camera move. Configuration widths2.2px
beams/1.6px contour use actual drawable CSS width; landscape viewport844×390 has
780×390 drawable area due the existing2:1 limit. Resize/pause/restart tests preserve
this behavior. No settings menu or HUD overlay is introduced. Reduced motion is
respected by adding no autonomous pulsing, shaking or scroll animation; quality
settings and prior presentation are unchanged.

Five explicitly controlled secondary geometry fixtures in `final/probes` isolate
clear alignment, ship-ray block, camera occlusion and12/60m depth. The ship-blocked
case shows a neutral contour while the camera can still see the shard; a camera
block suppresses the contour. Shader depth testing masks guides behind opaque
geometry. Current clear alignment never promises future collection through moving
obstacles or future inputs. Model fields stay unchanged in all fixture renders.

## Review limits

Images were inspected at desktop, portrait, station and blocked configurations.
The combination makes the current mathematical pickup footprint explicit and is
ready for owner/new-player comparison. No external human session measured trajectory
understanding, success rate or clutter. Visibility on physical phone screens,
ambient lighting, small speakers and different GPUs remains unverified. Owner
feedback may justify tuning centralized width/opacity, without changing mechanics.
