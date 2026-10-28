# Performance and real browser evidence

`mine-motion-browser.mjs` profiles the real Three.js game serially for45s/policy. Desktop1280×800/DPR1 uses identical prerecorded horizontal input; diagonal additionally runs390×844 portrait and844×390 landscape with the same workload and touch emulation. All five enable firstMine equally,1ms CDP CPU sampling and native VP8 canvas recording at30FPS/1.5Mbps. No other benchmark runs concurrently. Raw RAF/step/planner/pose/long-task/CPU records are retained; recording and sampling add overhead. Screenshots include HTML HUD; canvas videos omit it and audio.

Initial matched precommit results, milliseconds, p50/p95/p99/max. These profiles precede the final refinement that preserves each seeded X direction across A/B/C; their first encounter is identical to the final selector. Full raw initial records are retained under baseline/precommit-initial-. Exact-HEAD package JSON reruns the final paired-direction workload and is the final measurement authority.

| Case | PLAYING RAF, including cold Launch | Warm PLAYING max | Active planning chunk | Actual publication gate |
| --- | --- | ---: | --- | --- |
| A baseline desktop |16.7/16.9/17.2/666.7|17.6|3.6/6.3/8.8/14.4|3.3/6.9/6.9/10.9|
| B fast desktop |16.7/17.0/17.1/649.8|17.4|3.6/6.2/8.3/10.5|3.3/6.2/6.2/9.1|
| C diagonal desktop |16.7/17.1/17.3/533.2|17.7|3.7/6.7/9.3/12.5|3.4/7.0/7.0/9.4|
| C portrait |16.7/17.0/17.2/566.6|17.5|3.6/6.5/7.9/11.8|3.1/6.8/6.8/10.7|
| C landscape |16.7/17.0/17.2/583.2|17.4|3.7/6.4/8.9/11.1|2.5/6.3/6.3/9.1|

This finite matched sample does not show a material fast/diagonal frame regression. Planner chunks remain capable of consuming much of a16.7ms frame. Cold Launch gaps are large and retained, and multiple120Hz chunks can share one RAF. A p99 does not erase maximum stalls; no universal60FPS or phone guarantee is claimed.

Historical003C matched data and exact-HEAD raw CPU/RAF files are copied unchanged into baseline/ with a SHA256 source inventory. They retain desktop33–50.1ms bursts, portrait116.6ms while planning idle, and the later slower capture (warm maxima183.3/166.6/116.7/149.9ms). Their causes remain unresolved. Their profiling/recording/viewport and workload identities are preserved; the new first-mine workload and different capture session do not justify a claim that these earlier anomalies were fixed, or a regression claim from unmatched recordings.

Each new case performs five warmups, one same-phase baseline and ten restarts, all at1030actual120Hz steps with upward input. Every sample reaches a published active mine and verifies identical GPU geometry/texture/program counts, ledger/slot sizes and request count. Each page makes seven GLB requests total and none on subsequent restarts. Precommit retained forced-GC V8 deltas:58,636/56,748/55,712/54,064/55,840bytes for A/B/C/portrait/landscape. Finite positive deltas do not prove zero leaks or indefinite retention. The asset/template/material/light and geometry storage are unchanged across policies; no per-spawn mesh/resource creation is added.

Node warm-loop diagnostics separately time one million XY poses and100000relative CCD queries per policy, including loop overhead. The paired precommit log and exact-HEAD mine-motion-benchmark.json retain actual totals. These are throughput probes, not isolated per-call browser latency. Validation/replay chunks and actual admission outcomes retain all unchanged3072/6144work caps.

Five native videos contain live first-mine trajectories; decoded7s/9s frames have different hashes. Twenty stage captures plus five live screenshots cover A/B/C desktop and diagonal portrait/landscape. Stage capture follows causal witnesses using real fixed steps, with no ship/hazard teleport or camera change. Inspected close approaches show the original red light/model and a clear diagonal height change. RAF traces record logical/rendered XY equality and absolute ticks alongside capture timestamps.

First render is around.40s; desktop12-pixel enclosing-diameter presence around1.51–1.53s, portrait1.78s and landscape5.6s. These leave about7.25/7.0/3.18s before the first8.7833s plane. Diagonal activation is6.7833s; fast7.0667s. Projected size/fog/frustum are explicit visibility proxies, not human detection thresholds. Physical device thermals, touch readability and owner preference remain untested.
