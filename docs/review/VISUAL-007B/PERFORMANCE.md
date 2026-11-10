# Performance method and resource budget

Compare exact 007A source and candidate production builds in the same Chrome,
sequentially, without unit tests, capture processes or a parallel browser suite.
Each desktop 1280×800, portrait 390×844 and landscape 844×390 case runs the same
input tape, warms to the same tick, then measures 900 native frames and ten real
UI restarts. Raw RAF/render/call/triangle/active-reward samples are retained.

The render callback includes scene updates and planning bookkeeping; it is not
a GPU timer. Initial draw and later program-count changes are separately timed.
Heap snapshots follow explicit garbage collection before/after each case.
Renderer geometry/texture/program counters and scene/reveal material counts are
recorded. Stable counters establish bounded resources for this sample, not an
exhaustive heap-leak proof.

Station buffers and triangle counts remain identical to 007A. Collectibles
remain three draws and three shared geometries, rising 144→280 triangles per
visible item. The existing capacity is eight. This moderate local increase
does not multiply resources on publication or restart. No new light, texture,
postprocessing pass or dependency is introduced.

## Final sequential measurements

5400 measured frames and 60 UI restarts total; the three endpoint gameplay states match exactly.

| Viewport | RAF p50 before/after | p95 | p99 | max | Render callback p95 |
| --- | --- | --- | --- | --- | --- |
| 1280x800 | 16.7 / 16.7 | 16.9 / 16.9 | 17.2 / 17.1 | 59.8 / 46.4 | 3.1 / 3.0 |
| 390x844 | 16.7 / 16.7 | 16.9 / 16.9 | 17.2 / 17.1 | 45.0 / 47.0 | 3.1 / 3.0 |
| 844x390 | 16.7 / 16.7 | 16.9 / 16.9 | 17.2 / 17.3 | 46.1 / 47.3 | 3.0 / 3.0 |

All times are milliseconds. Small percentile differences are measurement noise, not a speedup claim.

Maximum scene calls stay48; materials stay224; uploaded geometries/textures stay43/1. Warmed programs change15 to14. Maximum scene triangles rise12928 to13064, with one active reward in this sample. All restart GPU counters remain stable.

| Viewport | Cold first draw before/after | First reward draw before/after | GC heap before measurement before/after | GC heap after10 resets before/after |
| --- | --- | --- | --- | --- |
| 1280x800 | 211.1 / 224.2ms | 46.8 / 27.5ms | 17.094 / 17.118MB | 18.343 / 18.401MB |
| 390x844 | 66.2 / 63.1ms | 17.0 / 12.4ms | 17.096 / 17.117MB | 18.350 / 18.386MB |
| 844x390 | 62.8 / 60.7ms | 17.1 / 12.0ms | 17.097 / 17.117MB | 18.349 / 18.404MB |

The per-reset post-GC heap range is about0.14MB in both versions. Retained heap increases after warm-up in both controls; this is not an exhaustive leak proof. Ten restart GPU counters are constant in each case; raw per-reset heaps are included.

The first vertex-color prototype produced a155.4ms desktop RAF peak, a142.1ms first-reward draw and18 warmed programs. Those samples are retained in historical/pre-shader-fix-*-performance.json. The final core/inlays and frame share existing standard shader paths: no color attributes, no additional draw or triangle growth,14 warmed programs. The observed large first-reward peak did not recur in the final sequential sample.

Cold boot and initial upload/compilation stalls remain: desktop first draw211.1/224.2ms, and the prefix scene draw113.4/112.4ms. First-use timings combine shader creation, upload and driver work; they do not isolate pure shader compiler time. These are desktop Chrome measurements, including mobile viewport emulation. Physical phones remain untested.
