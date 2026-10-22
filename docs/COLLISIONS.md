# Collision calibration — PHASE-3-001

## Measured models and approved baseline

Baseline: `08ceed477a134757336589dc1feadae7606ca3e5`. No GLB, asset normalization, movement, camera, spawn/difficulty, ship collider, hull or invulnerability tuning was changed. Original models remain Kenney CC0.

The audit loads each actual GLB with GLTFLoader and the runtime `normalizeModel`, then measures its transformed bounds and vertices. Run `node --experimental-strip-types scripts/collision-audit.mjs`; review verification saves the actual output and `collision-measurements.json`. Hazard dimensions below are at logical radius **1**. All axes/offsets scale uniformly by generated radius **0.65–1.1**; center is the logical hazard position. Models are centered at `(0,0,0)` before placement. Units: X horizontal, Y vertical, forward −Z.

| Model | Original dimensions X/Y/Z | Normalized dimensions X/Y/Z | Final rule |
| --- | --- | --- | --- |
| `meteor.glb` | 0.866025 / 0.735 / 0.750 | 1.868914 / 1.586156 / 1.618527 | Original sphere |
| `meteor_detailed.glb` | 0.866025 / 0.735 / 0.825 | 1.868914 / 1.586156 / 1.780380 | Original sphere |
| `meteor_half.glb` | 0.866025 / 0.3675 / 0.750 | 1.841091 / 0.781271 / 1.594431 | Sphere AND oriented box |
| `barrel.glb` | 0.200 / 0.250 / 0.173205 | 1.249390 / 1.561738 / 1.082004 | Sphere AND oriented box |
| `machine_generator.glb` | 0.700 / 0.400 / 0.525 | 1.569545 / 0.896883 / 1.177159 | Sphere AND oriented box |
| `craft_speederA.glb` | 2.000 / 0.800 / 2.100 | 2.800 / 1.120 / 2.940 | Approved player sphere, radius 0.42 |

All hazards have maximum normalized vertex radius 1. The ship's full vertex radius is about 1.721772; its visual wings/nose extend beyond its intentionally forgiving player sphere. Expanding that sphere would change the approved arcade feel, so it stays unchanged. Decorative wings can still appear to pass close to obstacles without damage.

## Findings and decision

The old sphere has diameter 2 in every direction. Its radius extends 0.609364 beyond the half meteor's Y half-bound, 0.458998 beyond the barrel's Z half-bound, and 0.551558 beyond the generator's Y half-bound. Visual inspection with amber spheres and mint measured boxes confirmed substantial empty-space coverage. A separate browser fixture demonstrates a generator centered one unit below the player passing without contact: its visible Y half-height plus player radius is about 0.868442; the old sphere sum is 1.42.

Round meteor variants remain spheres. Their overall silhouette suits the approved approximation; no global shrink or new shape is justified there. The half meteor and two mechanical models gain measured model-aligned boxes, with half-extents rounded outward to one millionth in `src/core/hazard-profile.ts`. Unit tests derive the same bounds from real GLBs and prevent metadata drift.

Boxes alone would introduce empty corner regions beyond the old sphere. To avoid expanding any hazard's reach, calibration retains the original sphere as a mandatory outer limit. The accepted condition is overlap with **both expanded bounds at the same sweep time**, not two unrelated hits at different times. This is a conservative arcade proxy, not triangle collision.

## Continuous detection

`HazardCollision` holds reusable vectors, two sphere entry/exit times and eight box breakpoints. For round variants the exact old `sweptSphereHit` path remains. For calibrated variants:

1. Compute the original outer-sphere overlap interval using `hazard.radius + CONFIG.ship.radius`.
2. Transform both relative segment endpoints into the hazard's local orientation at the step midpoint. Rendering and collision share the original Euler XYZ formula: `(elapsed*spin+phase, elapsed*spin*0.7, phase)`.
3. Find the minimum squared point-to-box distance within that same interval. The distance is quadratic between at most six box-plane crossings. This checks the entire path and correctly rounds box faces, edges and corners by the ship sphere radius; it is not an expanded-box slab approximation.
4. Include a bounded rotation allowance: `boxHalfDiagonal * abs(spin) * 1.7 * dt / 2`. This covers movement about the midpoint pose. It is below **0.007 world units** at normal 120 Hz stepping and maximum configured spin/radius. Larger clamped steps use a proportionally larger bound rather than tunneling through rotation.

This tests intersection of sphere-expanded and box-expanded bounds. Minkowski expansion does not distribute exactly over intersection; small conservative errors can remain near their seams. Rotation allowance can also produce very small early contacts. These are explicit limits of the lightweight proxy, while the large measured empty regions are removed. No per-triangle collision or physics dependency was introduced.

## Fairness and preserved behavior

Every accepted calibrated hit is restricted to the **original sphere's** continuous overlap interval. Thus a previously safe path remains safe; collider calibration cannot enlarge the old envelope. Original maximum radius, reaction/travel budget, full-height corridors, wave spacing and seeded generation remain valid without changes. The existing 64-seed / 8,000+ wave tests and actual-ship route-following tests remain in place. A 10,000-sweep test checks the subset property; 600 rotating fixtures compare against sampled contacts.

`hazardVariant` moved into the pure profile module and is re-exported from the asset catalog for compatibility. It consumes no randomness and keeps the original mapping. `src/config.ts`, `core/ship.ts`, `core/obstacles.ts`, `input.ts` and `game-loop.ts` are unchanged from baseline. World ship banking/camera formulas are unchanged.

## Developer view

Run `npm run dev`, then open **http://127.0.0.1:5173/?debug=colliders&seed=42** and launch. Other `debug` values provide the old inspection seam without wire bounds. No player-facing debug button is added.

- Pink: unchanged player sphere, centered on logical ship position.
- Amber: original hazard sphere / outer collision limit.
- Mint: additional measured box for the half meteor, barrel or generator. Its visible corners outside amber do not create hits: both bounds are mandatory.
- The overlay reports active count, nearest model/radius/center, colors and the simultaneous-bound rule. It shows end-pose bounds; continuous midpoint/rotation tolerance is described above.

`ColliderDebugger` is dynamically imported only inside `import.meta.env.DEV`. Production strips that import/class; tests request production with the same query and verify no overlay or emitted debugger marker. Disabled mode creates no wire resources and only retains an undefined optional-view check in World.

The enabled view allocates one root, 72 reusable hazard groups with a sphere/box pair, and one player sphere (73 direct children). Two shared wire geometries and three shared materials are owned by the debugger; labels update at most four times per second, including while paused. Normal resources remain independent. Restart reuses the same root and cache; teardown detaches the root/overlay and disposes each wire geometry once.

## Evidence and remaining limits

Current-task tests capture `phase3-normal-gameplay.png`, `phase3-meteor-colliders.png`, `phase3-debris-colliders.png`, `phase3-mobile-gameplay.png` and `phase3-production-gameplay.png`, plus extra model/death/landscape screenshots. Deterministic fixtures position hazards; debug scenes pause simulation and hide the pause overlay for inspection. These are actual rendered GLBs, not generated illustrations.

No known regression in verified Chrome flows. Physical phones, Safari/Firefox, sustained heap/GPU profiling and manual feel review remain. Wireframes are developer diagnostics and add draws only while enabled. Audio, further visual effects and Yandex SDK are outside this task.
