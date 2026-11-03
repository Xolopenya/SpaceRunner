# Performance

Commands: homing-route-freeze.mjs → homing-route-benchmark.mjs / homing-route-matrix.mjs → homing-route-verify.mjs / homing-route-preservation.mjs → isolated homing-route-browser.mjs → homing-route-report.mjs. Browser measurements run without other verification work. Fresh Chrome per version/viewport, seed0,30s causal current-witness input, CPU sampling1ms. Both landscape cases capture the same CDP timeline categories; raw traces retained.

| Case | Planner chunk p50/p95/p99/max ms | Actual gate | Planner/render | RAF | Warm RAF | Synchronous render |
| --- | --- | --- | --- | --- | --- | --- |
| before/desktop | 3.50/7.50/10.80/21.30 | 4.90/6.50/6.50/21.30 | 7.20/14.60/18.90/21.90 | 16.70/16.80/17.10/500.00 | 16.70/16.80/17.10/17.50 | 2.20/3.00/3.80/36.00 |
| before/landscape | 3.20/6.70/9.50/20.30 | 4.90/5.50/5.50/20.30 | 6.20/13.60/19.70/20.90 | 16.70/16.80/17.10/499.90 | 16.70/16.80/17.10/33.30 | 2.10/2.80/3.40/36.10 |
| after/desktop | 5.60/9.50/16.80/20.60 | 7.50/10.40/10.40/18.80 | 11.30/18.30/29.50/40.10 | 16.70/16.80/17.30/950.00 | 16.70/16.80/17.20/33.40 | 2.40/4.30/5.10/67.70 |
| after/landscape | 3.40/8.00/12.40/19.00 | 5.30/7.40/7.40/19.00 | 6.80/15.80/19.90/25.80 | 16.70/16.80/17.10/533.50 | 16.70/16.80/17.10/33.40 | 2.20/3.00/3.60/44.00 |

Live fields/input policies can diverge after the first changed publication; these are policy profiles, not identical-work speedups. The frozen62-root microbenchmark is matched actual root/input/known field,10repeats after3warmup batches. Extra accepts include a replay, so increased per-gate CPU is not hidden.

| Case | Frozen microgate p50/p95/p99/max ms | Max propagation/render | Deferred simulation steps | Restart V8 delta bytes |
| --- | --- | ---: | ---: | ---: |
| before/desktop | 3.70/5.70/6.40/9.30 | 6144 | 0 | 52168 |
| before/landscape | 5.00/8.90/10.40/18.10 | 6144 | 0 | 57660 |
| after/desktop | 4.30/6.40/7.70/14.60 | 6144 | 0 | 52200 |
| after/landscape | 6.20/11.00/12.80/15.30 | 6144 | 0 | 44852 |

Each restart cancels an active planning job; five warmups precede baseline plus10forced-GC samples. GPU geometries/programs,72slots,owner/pending counts,trace and asset requests are checked equal within each case. These finite noisy heap deltas do not prove absence of all leaks. Existing3072/6144 per call and6144/12288 per render are asserted; no job rollout is hidden in the heuristic.

Changed ranking checks4fixed points and uses stopping position, mine velocity×0.6s, travel distance and reversal cost. It uses no Ship.update, prediction advance or CCD outside the authoritative job. Runtime total per-encounter preparation/gate metrics (including fallbacks) are in every outcome; work differences reflect changed accepted worlds.

before total paired-game propagation=26047370, preparation=25736277, actual-root gates=311093. Different exposure lengths are reported; these sums are not equal-work timing claims.

after total paired-game propagation=23504210, preparation=23194333, actual-root gates=309877. Different exposure lengths are reported; these sums are not equal-work timing claims.

RAF callback received time, callback timestamp,dispatch lag,visibility/focus,long tasks,step CPU and synchronous render timing are recorded separately. CDP timeline can distinguish recorded stages; physical presentation latency is not directly measured or inferred from a WebGL call. An unexplained large gap remains unknown unless trace evidence identifies it. Mean frame time is not evidence that stutters disappeared.
