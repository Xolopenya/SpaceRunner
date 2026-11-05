# GAMEPLAY-005B2 — station / corridor coherence

Baseline `80e987d7804b663d1c8bf2080fa116ef63b667de`. Feature only; no merge or deployment.

## Diagnosis

The four additive surfaces really cross the station solids: X=±6 and Y=±3.6 are inside a wreck extending approximately X±10/Y±6.5. Each station has four asymmetric solid boxes around a real aperture. Its opaque steel and paint materials already write depth; warp already tests depth and does not write it. Transparent draw ordering or a missing depthTest flag is not the root cause.

A depth buffer correctly hides the portion behind the front face. It cannot make an intersecting strip stop before that face: the nearer portion and its additive halo can still look like a light stroke on/through the plating. The distant reveal shader also deliberately discards some station fragments; those samples do not write depth. This contributes only during distant/birth coverage, not the fully revealed near-field example. Reveal and the original material depth flags are unchanged.

The supplied attachment contained only the text file, without the referenced owner screenshot. `owner-reconstruction-right-25-before/after.png` reconstructs the described rectangular wreck near the bright right boundary; it is not claimed to reproduce an unavailable screenshot exactly. Actual browser inspection confirms the bright stroke at the panel intersection disappears after correction.

## Correction

`WarpCorridor.updateOcclusion` reads only committed station slots, their current world poses and the same four box profiles used by the renderer. Its eight-station limit and retained inactive-station/despawn behavior match StructureVariantsView. It intersects each box with each fixed warp surface and uploads reusable world-coordinate rectangles. The shader sets light to zero inside each solid cross-section and smoothly restores it over 1.25m outside the rim. Ordinary depth testing still handles the light behind an opaque panel.

The suppression is local in lateral position and longitudinal depth. There is no whole-station plane across the opening, screen-space mask, additional depth pass, opaque wall, collider change, station scaling or reveal bypass. Empty-space uniforms have count zero. Four meshes, four materials and the original proximity/travel response remain. A paused state produces identical rectangles; reset clears them before reused slots are displayed.

## Evidence and checks

- `browser-captures.json`: all five accepted isolated station variants, far appearance, depth≈80/15/0/−5, passage with hull3; each old/corrected pair uses the identical simulation state. Center first publishes nearer than170m; the receipt records its actual132m depth rather than pretending it was170m. The other far variants are≈162m.
- `owner-reconstruction.json`: actual control inputs reach all four boundaries, with the station≈60m and25m ahead. No player or station pose was inserted. The station extends beyond the corridor; the outer geometry is retained.
- `corridor-station-live-comparison.webm`: native browser capture of the existing station diagnostic. The station diagnostic uses its historical body-sphere model; integrated compound fairness is tested separately.
- Unit tests independently reconstruct every rectangle for all five apertures/four sides, preserve the upper opening, check uncommitted/retired/out-of-range slots, bounded capacity and buffer identity. Browser checks verify live toggle state identity, opaque depth flags and restart cleanup. Existing reveal/pause/cadence/mobile lifecycle checks remain.

DEV `?debug=visuals&seed=42` includes a station-occlusion toggle. It changes presentation only. Openings and empty portions can still show light in front of/through open space; the system is a local intersection correction, not a volumetric lighting simulation.
