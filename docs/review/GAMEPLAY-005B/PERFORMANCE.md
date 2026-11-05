# Matched finite measurements

`visual-performance.json` compares the exact frozen005A source and all four005B visual combinations. Seed42, original recorded inputs, ticks3000..4200 and600 native RAF frames per case are identical. This window includes station/fragments and the Phase2 mine approach. One Chrome process, sequential contexts, no video encoding and no parallel browser suite. All ten endpoint simulation hashes are identical. Portrait is desktop viewport emulation, not physical-phone evidence.

| Source / boundaries / reveal | Desktop RAF p95 | Portrait RAF p95 | Desktop world callback p95 | Portrait callback p95 |
| --- | --- | --- | --- | --- |
|Exact005A / legacy / legacy|17.2ms|17.1ms|3.1ms|3.3ms|
|005B / legacy / legacy|17.0ms|17.0ms|3.6ms|3.7ms|
|005B / warp / legacy|17.1ms|16.9ms|3.4ms|3.2ms|
|005B / legacy / seamless|17.2ms|17.2ms|4.2ms|4.4ms|
|005B / warp / seamless|17.0ms|16.9ms|3.0ms|3.2ms|

Median RAF is16.7ms throughout. Exact005A p99/max:19.8/29.3ms desktop and19.1/26.8ms portrait. New combined p99/max:17.7/26.1ms and19.2/31.3ms. These finite distributions do not establish a speedup; case order, JIT/driver caches and host scheduling matter. Non-renderer CPU p95 remains about.5/.6ms. This metric is Game render callback minus WebGLRenderer.render, including existing HUD/audio/VFX/camera work; it is not an isolated GPU timer.

Peak calls47→50 in this window: the mine body now renders during certified waiting, rather than only after warning. Warp replaces four legacy line draws with four surface draws. Added particles0 and textures0; total observed GPU textures1. Window-end GPU geometries remain48 in both selected presentations. Four additional CPU-side surface buffers coexist with the hidden legacy geometry for A/B; GLB geometry/texture buffers are not duplicated.

Two cohort variants plus a mature variant allocate231 shared materials for77 source/family combinations, plus4 warp shader materials. The baseline scene has106 referenced materials; feature allocation is about341. The scene-reference-plus-variant counter reads337 when four originals are temporarily only retained in asset/cache ownership. No material is allocated per frame or per pooled object identity. Active shader programs12→14 and remain stable throughout each window; program reuse avoids per-object shader compilation.

After explicit Chrome GC, heap before playback is about27.69MB for exact baseline and28.75MB for new combined mode: roughly1.06MB additional retained state. After playback plus ten genuine UI restarts, measured deltas are1.14MB baseline and1.20MB combined. Arrays/JIT/inspector bookkeeping and finite lifetime affect these figures; they are not evidence of an unlimited leak. Geometry/texture/material counts are stable across all ten restarts in every case. Every reset returns distance0, energy0 and hull3. Cohort fallback count is0 in the measured windows.

Cold combined-scene first draw is recorded separately after a deliberately unrendered prefix:334.6/147.6ms exact baseline versus110.7/112.3ms new combined desktop/portrait; isolated reveal-only desktop is201.5ms. Sequential cache warming makes these unsuitable for claiming better startup. They expose real cold compilation/upload outliers. The two new programs are shared and no continuing shader-count growth occurs. Ordinary first-encounter/hitch comfort still needs owner testing.

The static feature entry is about797.67kB minified /211.43kB gzip versus005A789.61/208.67kB. No dependency, external asset, postprocess or runtime network service was added. Existing chunk-size advisory remains. Unit/type/build/browser, protected-source, pixel reveal and lifecycle receipts are retained; initial harness, interrupted and visually rejected attempts are separate logs. Full historical mine matrices and physical-device thermal/long-duration tests were not repeated.
