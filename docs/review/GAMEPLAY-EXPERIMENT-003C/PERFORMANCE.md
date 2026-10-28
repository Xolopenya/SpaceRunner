# Performance measurements

`mine-browser.mjs` measures actual Three.js rendering serially: approved mixed-flow desktop, moving-mine desktop, portrait390×844 and landscape844×390, each45s, same prerecorded horizontal120Hz input. All four use the same native VP8 recording and1ms CPU sampling settings. Canvas recordings are silent and omit the HTML HUD; screenshots include it. RAF logical/rendered poses, simulation ticks, recording-start timestamps, long tasks and every>=30ms interval are retained. All-frame, PLAYING-only and warmed PLAYING (elapsed>=2s) distributions are separate. Recording/sampling add overhead. Mobile profiles are desktop Chrome emulation, not physical-phone measurements.

The initial8s smoke was run while another diagnostic was active: frame p50/p95/p99/max16.7/16.9/33.3/766.6ms, active planner p50/p95/p99/max4.3/7.9/12.3/13.6ms. This exploratory result is retained and must not be confused with the final serial profile. It demonstrates the historical33ms gaps can still occur; aggregates do not excuse them.

Precommit active-phase Node microbenchmark:1,000,000 pose evaluations25.83ms (~25.8ns/evaluation) and100,000 varied relative CCD queries16.39ms (~163.9ns/query), including loop overhead. These warm-loop figures include neither rendering nor planner cost, and are not browser/mobile latency guarantees. `mine-benchmark.json` records complete validation latency, per-chunk work, replay cost, actual publication samples and active counts; exact-HEAD results supersede these preliminary times.

Matched precommit45s profiles, ms (p50/p95/p99/max):

| Case | PLAYING RAF including cold Launch | Warm PLAYING max | Active planner | Actual gate |
| --- | --- | --- | --- | --- |
| Approved mixed desktop |16.7/16.8/17.0/766.6|66.7|3.4/5.7/8.1/12.2|2.6/7.0/7.0/8.4|
| Mine desktop |16.7/16.8/17.2/449.9|50.1|3.7/7.2/10.9/13.2|3.8/7.0/7.0/13.2|
| Mine portrait |16.7/16.8/17.3/483.2|116.6|4.1/8.4/12.1/18.3|3.1/9.5/9.5/16.0|
| Mine landscape |16.7/16.8/16.9/450.0|17.4|3.2/5.6/8.3/12.4|3.2/7.8/7.8/8.0|

The small p99 values do not remove the spikes. Desktop33ms intervals around simulation12.4–12.8s overlap multiple120Hz planner chunks per rendered frame, with individual chunks around6–12ms; the50.1ms interval overlaps a13.2ms publication gate. Portrait also has116.6/83ms gaps around simulation37.1–37.4s while model steps take<=.2ms with no active planner chunk. The latter cause is unresolved; raw CPU/RAF/model/long-task records are retained. No GPU, encoder or host cause is asserted without evidence. These observations reproduce the historical frame-gap concern and require review rather than a claim of a universal60FPS budget.

All moving horizontal profiles naturally reach GAME_OVER at898.49m; baseline remains PLAYING at1023.20m. The45s capture includes the subsequent result screen, so PLAYING-only statistics are used above. This is one blind controller, not a human preference or arbitrary-input safety result.

Every source attempt retains3072propagations/6144primitive queries per call and the unchanged transaction ceilings. The sphere costs one primitive. All known committed native/wreck geometry remains billed. The benchmark compares actual mixed-flow/mine policies without raising CPU budgets or suppressing omissions.

The GLB is56,912 bytes,1136 triangles, three texture-free primitives. It adds54,528 geometry-attribute bytes and three materials to the asset owner; the view adds its warning/debug resources. One shared template and one borrowed visible instance are reused. Each profile performs five warmups, a same-phase baseline and ten2400-step model/World restarts. Each moving restart sample reaches one actual published active mine. Same-phase GPU/resource counts and request counts remain stable. Precommit retained V8 deltas:baseline46,012bytes;mine desktop80,024;portrait86,372;landscape91,000. These are finite positive retained deltas, not proof of zero leaks or whole-process/thermal phone behavior. Peak visible hazards10, draw calls52; mine peak triangles5094 versus4470 baseline.

Final exact-HEAD values and restart deltas are in `mine-browser.json` and the delivery report; matched precommit raw profiles are retained separately. Production identity is independently checked by `mine-preservation.mjs`; no experimental GLB request or module appears in the production build. The existing Three.js bundle-size advisory remains.
