# Performance

Reference measurements and exact-HEAD outputs are described separately. Real Three.js profiles use installed Chrome, seed 42, identical horizontal input, fixed viewports, CPU sampling at 1 ms and VP8 canvas recording at 30 fps. Fast/Diagonal/Target desktop and Target portrait/landscape record 45 s. Two 20 s desktop controls (Fast/Target) omit video while retaining the CPU sampler; compare the matched simulated[2, 20]s warm window. Each performance case starts a fresh Chrome process. No other repository benchmark is run concurrently.

Reports retain RAF p50/p95/p99/max, playing/warm/cold distributions, every frame/model-step/planner chunk, actual publication gate cost, target-resolution timings, long tasks, CPU profiles, draw/triangle peaks, loaded resources, visibility proxies and omission events. Browser microbenchmarks run after RAF capture with five warmup batches excluded: 20 batches of 10000 pose evaluations and 1000 relative CCD queries. Their cost is not per-frame cumulative work. The independent Node benchmark also records pose/CCD loops and 1458 resolution/search timings.

Memory uses five warmups, one baseline and ten matched 1030-tick active-mine restarts, forced GC and GPU/program/slot/ledger/request comparisons. No additional GLB loads are allowed; heap retention is a finite proxy, not a leak proof. Portrait/landscape are emulation; physical phones and thermal behavior remain untested.

## Previous anomalies retained

Approved003C2 exact-HEAD profiles had desktop Fast/Diagonal p50≈33.3ms and warm max≈34ms, while its baseline p50≈16.7ms. Its initial matched precommit profiles all ran near16.7ms. Shared-process sequential contexts and recording were present; that correlation did not establish a cause. A baseline83.7ms validator chunk at13.48–13.52simulated seconds overlapped a126ms long task; raw CPU/work/frame records remain available. Older003C warm33–183ms anomalies also remain in the historical inventory.

The new fresh-process and unrecorded comparisons investigate that variance. A faster later sample cannot prove the old anomaly fixed, and a frame interval is not a direct measure of validator work. Cold load/shader stalls remain reported. No frame gap is attributed to Target-Lock without matched evidence; no work cap has been raised.

See `target-lock-browser.json`, each `target-lock-*-raw.json`/`*-cpu.json`, benchmark JSON and final timing analysis for measured values. The final review manifest binds fresh command results to the exact packaged HEAD. Production remains the same15files/931651bytes, including the pre-existing Vite chunk-size advisory.

## Recorded precommit reference (2026-11-02)

All values below are milliseconds. Exact-HEAD reruns may differ; raw records for this run are preserved under logs/baseline/precommit-*.

| Case | RAF p50/p95/p99/max | Warm max (elapsed≥2s) | Planner p50/p95/p99/max | Gate max |
|---|---|---:|---|---:|
|fast desktop recorded|16.70/16.90/17.20/583.20|17.50|2.60/4.90/6.70/10.10|9.10|
|diagonal desktop recorded|16.70/16.80/17.10/1032.40|17.80|2.40/5.10/7.30/19.80|19.80|
|target-lock desktop recorded|16.70/16.90/17.30/899.80|66.60|2.50/5.90/9.20/18.40|18.40|
|target-lock portrait recorded|16.70/16.90/17.30/766.60|33.40|2.80/5.40/7.20/34.30|34.30|
|target-lock landscape recorded|16.70/16.90/17.40/949.90|34.00|2.30/4.20/5.90/37.60|37.60|
|fast desktop unrecorded20s|16.70/16.90/17.20/750.00|17.30|2.30/4.70/10.80/16.60|16.60|
|target-lock desktop unrecorded20s|16.70/16.80/17.10/366.60|17.40|2.10/4.20/5.50/15.70|15.70|

All seven fresh-process cases have median16.7ms. The matched[2,20]s unrecorded desktop warm p99 is17.1ms for both policies. The recorded Target desktop warm maximum66.6ms includes idle-planner frames around21.93–22s; a separate13.53–13.60s group overlaps9.2–13.7ms planner chunks. Thus some gaps coincide with planning and others do not. No causal encoder/GPU/OS explanation is claimed. Mobile gate outliers34.3/37.6ms occur in this run; budgeted work is not a millisecond guarantee.

Peak draw calls52 in every case. Ten-restart retained-heap deltas range48,528–88,560bytes; fixed GPU/program/slot/ledger/request counts stay identical at each matched sample. The no-retarget demo retains hull3/0hits. Exact source commit and final command results remain in the manifest. The final browser pass also records resolution timings and post-capture browser pose/CCD microbenchmarks; see its machine-readable distributions.
