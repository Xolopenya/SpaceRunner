# Performance and lifecycle

No new dependency, per-frame UI loop, layout measurement, timeout, shader, render pass, 3D asset or animation. RunResults is one small snapshot per run, updated by the existing coordinator's hud port. Back to menu adds one click listener owned by Game's existing AbortController; the coordinator retains its single subscription. Existing resets and audio graph are reused.

Sequential baseline/final production samples use desktop Chrome 1280x800, 600 native frames each (two original fixed ticks per frame), then ten original natural-death/replay cycles per version. Final alternates menu/Launch and Replay; baseline has Replay only because the menu path did not exist. This difference is explicit. Audio is fully loaded/running before measurement. Sampling ran after the full browser suite, without concurrent builds/capture/test jobs. Raw arrays/counters are in performance.json.

| Version | RAF p95 / max ms | Update/render p95 / max ms | CDP nodes min–max | CDP listeners min–max | Listeners after disposal |
|---|---:|---:|---:|---:|---:|
| before | 16.80 / 66.70 | 6.40 / 81.10 | 351–354 | 66–66 | 27 |
| after | 16.80 / 66.70 | 5.40 / 70.40 | 359–364 | 67–67 | 27 |

before: 10 cycles; fixed DOM elements171, subscriptions2, GPU geometries51/textures1/programs26; max active voices1, retained score sources3. Same audio graph/context/source identities in every cycle; one end per run, full HP 3 and zero distance/energy on restart. Browser errors=0, failed requests=0.


after: 10 cycles; fixed DOM elements175, subscriptions2, GPU geometries51/textures1/programs26; max active voices1, retained score sources3. Same audio graph/context/source identities in every cycle; one end per run, full HP 3 and zero distance/energy on restart. Browser errors=0, failed requests=0.

Four static DOM elements and one abortable click listener are added. No growth is observed over the ten cycles. Both versions retain one RAF gap>=50ms (max 66.7ms); update/render maxima remain 81.1/70.4ms. Those outliers are reported, not treated as fixed. Counters are taken after explicit GC at equivalent clean-start points. CDP counts include browser/document listeners and detached nodes; finite values are not all Game-owned. dispose removes Game listeners; raw post-disposal counts remain reported. The short sample verifies bounded observed resets and no measurable recurring UI workload, not a long-duration leak proof or phone FPS guarantee. Small p95 differences are noise at this scale; no speedup or unrelated cadence/stall fix is claimed.
