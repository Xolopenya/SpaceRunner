# GAMEPLAY-004B — three-part ship

Baseline05d075415a6e813c28134d37d8f74afdb50af7bb. Feature branch only; no merge/deployment. **Wing damage is enabled in normal ReleaseModel Play**, against ordinary asteroids, calibrated mechanical/half-meteor hazards and every station solid. It is not a pickup-only implementation.

Actual `craft_speederA.glb`, normalized by the unchanged AssetManager to width2.8, measures2.8 ×1.12 ×2.94. Outer wing vertices are x=±1.4, y=−.28/−.42, z=.49/.91. Measurement, source SHA256 and exact normalized vertices are in ship-audit.json. No model or hazard asset/scale was changed.

`src/core/ship-collider.ts` is the sole frozen definition:

| Part | Offset X | Offset Y | Offset Z | Radius |
| --- | ---: | ---: | ---: | ---: |
| body |0|0|0|.42|
| left-wing |−1.02|−.35|.70|.28|
| right-wing |1.02|−.35|.70|.28|

The union spans x±1.30; decorative outer .10 on each wing stays forgiving. Wing spheres cover the substantial flat wing surfaces, not every polygon. The original central foundation remains intact. Axial enclosing half-extent .98 and a computed3D enclosing radius (~1.566) are broad-phase bounds only; narrow phase always tests the three individual spheres.

Ship movement is unchanged. Rendering banks/tilts using smoothed velocity-dependent transforms; this is cosmetic, not gameplay orientation. The authoritative compound shape stays aligned to game axes. At maximum bank/pitch the rendered wing center can differ vertically by roughly.5; this deliberate stable approximation avoids frame-rate-dependent collision physics. DEV overlay shows actual gameplay centers. Recorded wing-hit examples use nearly settled steering, with little cosmetic mismatch.

`ShipHazardCollision` shifts BOTH endpoints by each part's offset. Asteroids retain their sphere volumes. Calibrated hazards retain the intersection of their original outer sphere and continuously guarded, midpoint-oriented box. Stations retain all four exact asymmetric boxes, including tangent numerical guards. No hazard volume, safety margin, control rule, hull rule or invulnerability duration was reduced. Base GameModel still applies one damage event per step, even for overlapping parts/hazards.

The enclosing broad phase includes the full wing span and positive rear offset. Body-only source/profile APIs remain as explicit historical diagnostics and control cases; main.ts normal Play selects ReleaseModel with the compound profile. The new reproducible overlay is `/?debug=collectibles&colliders=1&seed=42`; legacy debug URLs retain their documented historical models.
