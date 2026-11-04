# Measured performance and verification

Final unit suite:278 passed. The full browser suite has93 cases; the final machine JSON and shell exit are retained in `logs/browser-results.json` and `logs/test-browser.log`. Initial interrupted/HMR and outdated-assertion attempts remain separate logs. Typecheck/build, whitespace check, static source scan, collision measurement, historical Phase2, wing and collectible audits, and the new integrated audit are retained alongside them.

The integrated corpus contains24 actual three-hull runs over8 seeds:366 independent compound witness replays,400 proposals including34 omissions, zero field faults and peak one active mine. All8 witness flights reach2500m with hull3. Historical regressions additionally replay141 Phase2,214 wing-audit and78 collectible-audit witnesses; the wing audit includes its cached historical baseline comparison. The18 frozen homing counterexamples and frame-stabilization tests run in the unit suite. The historically exhaustive mine benchmark/tuning matrix was not repeated.

Separate native GameLoop measurements ran600 frames per viewport in local headless Chrome, without video encoding or the parallel browser suite. These early ordinary-play samples finish around209m with hull3. Portrait is viewport emulation on the same desktop, not phone hardware.

| Viewport | RAF median / p95 / max | World.render p95 | Planner/RAF p95 / max |
| --- | --- | --- | --- |
|1280×800|16.7 /16.8 /17.3ms|2.8ms|3.5 /8.9ms|
|390×844|16.7 /16.8 /17.6ms|2.7ms|3.5 /9.9ms|

Both end samples use28 draw calls,30 geometries and1 texture. The separate recorded mine approach at718m uses34 calls,32 geometries and1 texture. Its300-frame RAF median/p95/max is16.7/17.1/19.9ms; combined two-step update/render p95 is11.3ms. That sample includes native video encoding and fixed replay pacing. It is not a controlled GPU benchmark or a universal60FPS guarantee. Raw per-scenario results and Chrome version are in `logs/integrated-browser.json`; the renderer reports the generic `WebKit WebGL` label.

Ten genuine integrated UI restart cycles keep graphics counts unchanged. Fragment/mine state and ownership reset each time; there is still one AudioContext lifecycle. The boundary update creates no explicit per-frame vectors, arrays, meshes or materials; its four buffers/materials are disposed by World. The mine reuses one normalized borrowed GLB and warning lamp; each collision/prediction instance keeps its scratch endpoints. The frame-accounting sample object is reused during rendering. The existing immutable homing controller/search still allocates its bounded branch states; no claim of a zero-allocation simulation is made.

Local static feature bundle:16 files /1,116,709bytes total; about789.61kB minified entry JavaScript,208.67kB gzip by Vite, plus the existing56.91kB mine GLB. The existing >500kB chunk advisory remains. There is no new library, download, worker, shader or postprocessing stack. Build/module details are retained in logs. Main production output was not published.

Scope of evidence: finite desktop samples, emulated portrait/landscape, exact causal state comparisons at15 captured states, six silent video excerpts. Thermal behavior, physical-phone frame rate, long-duration memory stability and the owner's perception of comfort/fairness still require playtesting. Automated passing checks do not certify those properties.
