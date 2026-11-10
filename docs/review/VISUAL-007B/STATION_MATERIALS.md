# Station material hierarchy

Station-only configuration is `src/visuals/station-materials.ts`. The shared
007A hazard palette and mine implementation remain frozen.

| Role | 007A | 007B |
| --- | --- | --- |
| Main cassettes | `#293f50` | `#738b98` steel-blue |
| Body / internal solid faces | `#172631` | `#425966` blue graphite |
| Reinforcements / ribs | `#607887` | `#344b59` dark steel |
| Seams / recesses | `#0b1822` | `#142631` graphite |
| Amber markings | `#c77b2d` | unchanged |
| Cyan utility lamps | `#70d5e2` | unchanged |
| Metalness / roughness | .35 / .73 | .22 / .82 |

The broader diffuse surfaces carry the silhouette; dark seams/ribs provide
depth. Existing lamp emissive intensity .45 is preserved. No broad emissive
wash is added. The existing hemisphere and two directional lights are used.
ObjectReveal and depth haze continue to affect the materials normally.

Every station geometry attribute/index buffer is compared against 007A for
all five variants. All are identical: 4568–4640 triangles, nine solid/detail
draws and six materials per station. Four exact collider boxes, five opening
positions, 5.6×4.4 opening size and <=0.10m cosmetic face relief are unchanged.
No decorative vertices enter the aperture. See `geometry.json` and the source
preservation receipt in the review evidence.
