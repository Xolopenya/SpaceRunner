# Matched performance evidence

The camera-only microbenchmark in `camera-audit.json` executes120 batches×1000 updates per policy, including Three.lookAt, with the same positions/time samples. A precommit sample had per-update p95 A .00115ms / B .00055ms / C .00055ms. These tiny timings are JIT/scheduling-sensitive and do not establish that either chase policy improves frame rate. Exact-HEAD raw results are packaged separately and may vary.

`camera-browser.json` includes RAF p50/p95/p99/max and directly timed camera-update samples for each mode under the same recorded input history. Only final four-second real rendered windows count toward RAF measurements. Prefix CPU work, navigation, screenshot pauses and station snapshot-only captures are excluded. Do not compare aggregate captures with different histories or interpret scheduling outliers as proven camera CPU cost. Native video recording itself adds browser work.

Precommit matched left-boundary RAF p95 was17.4/17.1/17.1ms for A/B/C, with medians~16.7ms; right-boundary p9517.3/17.2/17.3ms. These are individual finite desktop recordings, not general FPS guarantees. Chrome's observed timer resolution gives many individual camera samples0 or.1ms; Node batch timing is the more useful CPU diagnostic. Twenty clean restart samples retained31 geometries/1 texture with the same camera object. Exact-HEAD raw data is the delivery record.

FlightCamera.update allocates no explicit objects, vectors or arrays; it updates the existing camera and Three.js reusable lookAt scratch state. Named settings and per-world controller are created once. DEV buttons use one abortable listener group. No new graphics resources are created by selecting a policy. This is code inspection plus bounded resource measurements, not a sampled JavaScript allocation profiler.

Twenty actual UI restart cycles check stable geometry/texture counts, same camera identity, distance0/hull3/ENERGY0. Original cleanup, collectible, collider, Mixed Flow and Phase2 regressions run unchanged. Source protection audit pins91 inherited source/deployment files (line endings normalized for text, GLB bytes exact). Generator complexity, collision budgets and hazard publication are unchanged by this task.

Existing build >500kB chunk advisory remains. Physical-phone frame rate, prolonged motion comfort and human depth perception are not certified. No new rendering engine, shaders, postprocessing or permanent diagnostics are introduced.
