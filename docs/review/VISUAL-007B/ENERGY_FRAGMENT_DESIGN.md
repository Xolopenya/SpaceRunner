# Contained energy shard

Three nearby concepts were evaluated before finalizing the production model:

| Concept | Readability / pickup fit | Decision |
| --- | --- | --- |
| A: framed faceted shard | Filled cyan center, four compact retention shoes, compact existing envelope | Selected |
| B: energy cell | End caps would occupy more of the small projected core and could resemble ordinary debris | Rejected at concept stage |
| C: floating reactor fragments | Separated parts create a larger apparent contact envelope and a silhouette closer to a mine | Rejected at concept stage |

Only A is implemented. `src/collectibles/shard-model.ts` builds an eight-face
opaque turquoise core with lit facets and four metallic corner retainers.
The four retainers merge into one geometry; tiny cyan inlays merge with the
emissive core. Both use the scene's existing standard material shader path.
A faint halo uses the original torus geometry. The pickup burst uses that same
geometry and original color/opacity response; its attribute/index hash matches
007A exactly. No red/orange danger accent is used.

The existing eight-slot `FragmentView` pool still shares three geometries and
four materials including the burst. Each visible collectible still costs three
draws, with 280 triangles versus 144 before. There is no new per-frame or
per-publication geometry/material allocation, animation loop or model hierarchy.

Original gentle .65rad/s rotation, 7% pulse, reduced-motion behavior and the
simulation elapsed clock are retained. Positions do not bob. All visual
vertices, including peak core pulse, remain inside the original .54m visual
envelope. The 140ms magnetic interpolation/scaling and one-shot feedback state
machine are unchanged.

Authoritative pickup radius .32, body .42, assist .36 yield body effective
1.10m; wings .18 + .32 + .36 + .10 yield .96m. These constants, wing positions,
occlusion tests, swept collection, count/chime/HUD and placement RNG remain
unchanged. Natural body/left/right-wing and Phase2 pickups are recorded.

| Part | Final material / geometry |
| --- | --- |
| Core and four cyan inlays | Standard: #30b5a5, emissive #33d9c4 at .65, roughness .58 / metalness .05; 56 triangles |
| Four retention shoes | Standard steel #547481, roughness .66 / metalness .30; 96 triangles |
| Halo and borrowed burst geometry | Original 128-triangle torus; halo opacity .40; burst response unchanged |

The vertex-colored prototype added shader variants and exhibited a large
first-use stall. The final model uses existing standard shader paths, with
inlays batched into the emissive core. The 280-triangle total, three draws and
visual envelope stay unchanged. See the performance report for measurements.
