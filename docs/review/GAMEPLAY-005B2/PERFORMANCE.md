# GAMEPLAY-005B2 — performance and verification

## Sequential browser measurement

Exact frozen005B versus corrected005B2; Chrome, same recorded seed42 baseline-witness inputs at ticks3000..4200.600 native RAF samples per case, two120Hz steps/RAF, desktop and portrait emulation. Capture, test and corpus workloads were finished before this final measurement. Initial exploratory measurements are labelled initial; polish-performance.json is the final receipt. Renderer CPU is host JavaScript time, not a GPU timer.

| Source /viewport | RAF p50 /p95 /p99 /max ms | World-render callback p95 ms | Max calls | Materials | GPU geometries /textures | Programs |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
|baseline /1280×800|16.60 /17.20 /17.40 /20.30|3.10|50|337|48 /1|14|
|baseline /390×844|16.70 /17.20 /17.40 /17.80|3.10|50|337|48 /1|14|
|feature /1280×800|16.70 /17.20 /17.30 /17.60|3.30|50|337|48 /1|15|
|feature /390×844|16.70 /17.20 /17.40 /21.00|3.20|50|337|48 /1|15|

There are no added draw calls, geometries, textures, materials or render passes for occlusion. Four existing warp shaders receive fixed-capacity cross-section buffers; at most32 rectangles/side and eight rendered stations. This measured interval observes up to7 rectangles total; it does not exercise an artificial32-per-side GPU worst case.

Both sources start the sample with14 programs. The corrected sample collects one extra actual fragment (baseline0 versus feature1) and ends with15 programs; the original non-reveal pickup burst material is a plausible source of that extra cached variant. This is an inference from event/program timing and the separate burst material, not an assertion that the shader mask requires another pass. All10 actual UI resets per case retain their warmed program count and exact material/GPU resource counts. Desktop post-GC heap delta is≈1.419MB baseline versus1.461MB corrected over playback plus resets; portrait≈1.421/1.477MB. Finite retained-heap deltas are not a leak-proof theorem.

RAF p95 stays≈17.2ms. The corrected desktop World callback has a15ms maximum outlier; portrait RAF maximum is21ms. No speedup, strict frame deadline or phone guarantee is claimed. The browser's ordinary renderer callback also performs HUD/audio/camera/VFX work.

## Isolated warmed CPU kernels

200 batched samples/source; no browser/test/capture workload. Units below are milliseconds per query/update (median /p95). The distant fixture has eight persistently active misses. The wall fixture has eight persistently occluded rewards and never synthesizes repeated collected events.

| Source | Compound hazard query | Pickup: eight distant active | Pickup: eight wall-occluded |
| --- | --- | --- | --- |
|baseline|0.000209 /0.000313|0.00139 /0.00210|0.00843 /0.01072|
|final|0.000225 /0.000320|0.00139 /0.00184|0.01047 /0.01141|

Three physical parts and three-sphere/twelve-sphere-box conservative query billing remain. Full corpus planner propagations36,193,899→35,960,492; billed narrow queries32,372,214→31,953,993. Max hard chunk counts remain3072 propagations /6144 queries. Corpora include differing feedback/death histories; these work totals do not isolate a causal speedup. Raw per-run timing includes its host workload; isolated-cpu.json is the separate kernel timing.

## Verification receipts

Typecheck,293 unit tests and production build pass on the final runtime. The final full browser run passes103/103 in5.4minutes with two workers, zero skipped/flaky/unexpected tests; raw results are in browser.log /browser-results.json. Coverage includes the original collision differentials, both true wing hits, the old grazing-volume comparison, adaptive mine endpoints, station solids, pickup/140ms pause/reset lifecycle, integrated normal Play, Phase2, real touch controls, UI/audio and renderer restarts.729 corpus witnesses plus168 newly accepted witnesses under matched old steering replay independently:897 total.

The first complete browser attempt had99 passes and two failures: the intentionally changed old grazing-hit expectation, and Chrome ERR_NETWORK_IO_SUSPENDED during target-lock loading. Both were investigated; all eight focused repeats pass. The historical grazing controls and old-volume assertion remain, and both genuine current-profile wing hits are now tested. Logs retain initial/interrupted attempts rather than hiding them. No safety assertion, game margin or planning budget was reduced.

Static asset/collision audit, protected-source comparison, source-signature scan, build analysis and Git whitespace checks are packaged with their actual outputs. The build retains Vite's existing >500kB chunk advisory. No dependency, asset or network download was added. Physical mobile hardware and exhaustive seeds were not tested.
