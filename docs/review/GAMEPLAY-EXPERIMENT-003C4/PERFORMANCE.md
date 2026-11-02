# Performance and resource evidence

All numbers below are the completed precommit run. Exact-HEAD packaging reruns the checks/profiles and retains its actual results in `adaptive-homing-browser.json`, `adaptive-homing-timing-analysis.json`, raw CPU/RAF files and the manifest. Precommit records and approved003C3/003B3 evidence remain separately named under `logs/baseline/` with SHA inventory. No old adverse record is replaced by a faster run.

Eight serial profiles use a fresh Chrome process per case, CPU sampling at1ms, equal30fps VP8 canvas recording for six45s cases, and two20s unrecorded controls. Viewports are1280×800,390×844 and844×390 (mobile DPR2). Every profile uses the same causal180-tick alternating horizontal input, normal hull and complete field. They are matched input/measurement conditions, not necessarily identical accepted worlds. The simulated[2,20]s window is reported separately. Recording/profiling adds overhead; an observed gap cannot be attributed to it without evidence.

| Case | RAF p50/p95/p99/max ms | Warm max ms | Planning chunk p50/p95/p99/max ms | Actual gate max ms |
| --- | --- | ---: | --- | ---: |
| Target-Lock desktop recorded |16.7/16.8/17.3/966.6|66.7|3.7/7.7/13.9/42.4|42.4|
| Soft desktop recorded |16.7/16.8/17.3/1049.8|83.4|4.8/8.8/14.1/47.3|47.3|
| Balanced desktop recorded |16.7/16.8/17.1/1099.8|17.5|5.0/8.3/10.5/56.8|56.8|
| Aggressive desktop recorded |16.7/16.8/17.3/766.5|116.8|5.3/11.1/14.9/30.2|30.2|
| Balanced portrait recorded |16.7/16.8/17.3/1383.1|133.3|5.5/10.8/16.4/51.8|51.8|
| Balanced landscape recorded |16.7/16.8/17.1/1083.2|33.4|4.8/7.9/11.2/44.2|44.2|
| Target-Lock desktop unrecorded |16.7/16.8/17.2/1083.1|17.4|3.1/6.2/8.6/45.9|45.9|
| Balanced desktop unrecorded |16.7/16.8/17.3/549.8|34.1|5.5/12.1/17.3/28.7|28.7|

There is a measured CPU increase: recorded Balanced median chunk5.0ms versus3.7ms Target-Lock in this matched run. Do not claim zero cost or stable60fps. The portrait133.3ms warm frame overlaps about121ms of actual model work, consisting of multiple bounded3072-propagation, zero-query search chunks at roughly8–13ms each. Catch-up fixed steps can accumulate several allowed chunks in one RAF. This identifies a real batching bottleneck even when collision queries are zero. It is not explained away as host load. The controller itself is a small portion of sampled CPU (about44.8ms inclusive over the45s desktop recording, versus search about1632.7ms); approximate1ms sample attribution is not a wall-time partition.

The large cold frame maxima overlap launch/initial validation as recorded; Balanced's first actual gate takes56.8ms with2165propagations/180queries in the horizontal-input profile. The neutral engineered matrix has a different actual root: max1929propagations/183queries, gate p50/p95/p99/max2.24/4.15/5.13/18.58ms on Node, resolution0.057/0.100/0.160/2.891ms. Browser resolution maxima are1.5–3.1ms across the measured cases. Whole validation wall latency includes waits between chunks: Balanced desktop p50≈377.3ms/max1200.1ms, while each synchronous gate is separately billed. Deadlines/omissions remain explicit in raw outcomes.

Five warmup batches precede20isolated browser microbatches of1000controller updates and1000relative CCD queries. Balanced recorded desktop controller median≈0.4ms/1000 and CCD median≈0.2ms/1000; these are loop measurements, not total per-frame overhead. All per-call work remains≤3072propagations/6144queries, absolute ceilings4096/8192,144planning ticks,2searches/4replays/2attempts. Full-beam state metrics include frontier, expansions, pruning and mine updates; the fresh gate deliberately has frontier1. Thirty retained partly advanced full-beam jobs estimate29457bytes/job after forced GC, including contexts/clock arrays/frontier; release samples are retained. This is a finite noisy estimate, not exact allocation accounting.

Every case performs five matched active-mine warmups, a baseline and ten restarts. Within-case GPU geometry/texture/program counts, slots, ledger, requests and bounded trace sizes match. Seven GLBs are loaded once (the six base assets plus the existing mine); no restart downloads. Retained V8 deltas are47916/66524/50812/45092/52244/53276/104692/111888bytes in table order, without a zero-leak or all-day claim. Peak draws52 in every case; maximum triangles4768–5310 depending on visible geometry. Source trace is bounded960states; render trail uses one cached241-point buffer and one material.

Approved003C3 exact evidence had Target-Lock desktop median/p95/max chunk2.4/4.5/18.8ms and warm max18.2ms; its mobile gates approached49.8ms and cold frames≈1s. Approved003B3's precommit mixed desktop had2.1/4.5/6.6/9.4ms planning and17.6ms warm max. Those historical runs are not the current matched hardware/process sample. Earlier33ms pacing and83.7ms validation anomalies remain in the baseline inventory. Current warm stalls, CPU increase and publication omissions require performance review before promotion.

The prototype safely certifies within work limits and supports the filmed interaction, but its worst rendered pacing is not accepted as production-ready. A focused next engineering option is smaller incremental search chunks with the existing synchronous actual-root gate/deadline preserved, followed by a fresh availability/performance comparison. This task does not silently change those budgets or introduce a Worker. Physical-device, sustained-session and human readability tests remain unverified.
