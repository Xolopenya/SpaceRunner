# Actual trajectory performance

Evidence is produced by `node --experimental-strip-types scripts/trajectory-benchmark.mjs` and included as `logs/trajectory-metrics.json`, `logs/trajectory-examples.json` and baseline reproduction logs. It contains all measured per-job outcomes and per-chunk wall time/operation counts. Timings include allocation, JIT, timer and OS effects. They are local measurements, not a device-independent promise.

## Workload and method

336 Node jobs:240 approved-corpus policy/regime combinations,64 broader neutral seeds,16 zero-margin comparisons and16 time-zero long-horizon six-cell transactions. The first160 normal jobs accepted and independently replayed;80 deliberately late committed roots rejected as existing-field uncertified;80 deliberately late candidate roots rejected for insufficient reaction distance. Long-horizon results are recorded separately. The browser runs80 normal corpus cases plus warmups in installed Chrome155.0.8059.85. It imports planning modules through a dedicated unlinked harness, asserts no live Game/World/model requests and compares deterministic result hashes with Node. No interactive game or physical phone is benchmarked.

Normal policy roots use120 exact preceding input ticks. Late roots are engineered5-unit reaction probes, preserving policy velocity; they are not human play traces. The broader256×1024 planning-policy matrix and four24h runs were not attempted or claimed. The implemented subset is reproducible and sufficient to expose both success and distinct failure categories, but does not characterize long-run omission or fun.

`begin` time is measured separately. Job wall time sums work advanced without waiting real simulation ticks; logical deadline count is separate. Main-thread chunk timing covers one incremental advance, not an entire synchronous search. External witness replay costs are measured separately from the replay already required within acceptance. Operation counters include both margin and actual gameplay queries during replay. Bounded clock-table setup and 35-point goal/pruning work are documented outside those two operation counters.

## Engineering findings

The first complete profile at4096-step chunks recorded Chrome chunk p95≈3.3ms and zero logical deadline failures. Removing per-step allocations/iterator overhead reduced it to≈2.1ms. Exact input-independent clock tables reduced total validation time while independent replay recomputed its clocks. A correct-terminal-clock run measured Chrome total median51.7ms/p9562.3ms/max65.8ms, chunk median1.4ms/p952.1ms/max3.4ms, and independent replay median1.4ms/p951.8ms/max2.8ms. That experiment is an earlier tuning measurement, not the final default.

An intermediate3712-step chunk remained marginal. The final default is3072 state steps/6144 queries per advance, retaining hard4096/8192 ceilings and144 ticks. Default propagation capacity442,368 is smaller than the research's loose two-full-15s-search worst case; those extreme jobs may explicitly reject on deadline. The added16 low-speed/long-horizon generated contexts measure the intended transaction shape rather than pretending the worst-case bound disappeared. A future coordinator may allocate up to the hard caps only after CPU/throughput review; narrow-query limits still apply. No worker or dependency was added.

The first complete final-default run is preserved as `logs/attempts/final-default-profile.log`. Its results follow; package reruns record fresh timing/memory in final JSON, not a fabricated identical sample.

| Metric | Node,336 mixed jobs | Chrome155,80 normal jobs |
| --- | ---: | ---: |
| Whole-job median/p95/max ms |53.6713/104.1065/187.2602|54.0/63.6/67.5|
| Chunk median/p95/max ms |1.2782/2.1972/8.2559|1.1/1.6/3.3|
| External replay median/p95/max ms |1.9041/5.3052/8.4451|1.3/1.8/3.3|

Node and browser columns have different workload mixtures and are not a speed comparison. Maximum measured operations per Node job were339,273 propagations/67,314 narrow queries, peak frontier16, and max115 planning ticks out of144. All16 added long-horizon jobs accepted. There were zero deadline failures and all176 accepted Node/80 browser results passed fresh replay. The Chrome chunk p95 met the proposed≤2ms desktop target in this finite diagnostic; Node's p95 was higher, and earlier profiles/OS/GC show variability. Physical phones, concurrent rendering and a general16ms-task guarantee remain unverified. If representative rendering misses the target, review throughput/chunk budgets or a bounded worker; never accept unchecked work or change dynamics.

## Memory and production

The fresh Node `--expose-gc` child warms five jobs, retains five active jobs after12 advances to amplify retained-state signal, then releases them and completes60 jobs with GC every10. Full heapUsed, ArrayBuffer, external and RSS samples are in JSON. Per-job estimates add heapUsed and ArrayBuffer deltas, avoiding double counting external. JIT/runtime noise means this is an estimate, not a precise object-size inventory or proof of a512KiB planner. An8MiB finite-run retained-growth guard catches obvious growth; it is not an indefinite leak guarantee.

Retained structures have explicit bounds:32 hazards,16 frontier states,144 expansion candidates, at most76 retained predecessor layers, ≤1800 control steps and two1801-entry Float64 clock arrays per prepared context. No cell/history cache or global job registry exists. Caller-held finished witnesses consume memory until released. Jobs snapshot their own data; completing a job releases its search continuation.

In that final-default memory child, five active jobs added70,432 heap bytes plus259,344 ArrayBuffer bytes, about65,955 bytes/job as a noisy retained-state estimate. After60 completed jobs, heap+ArrayBuffer delta was−56,288 bytes (no retained growth signal); raw RSS/external values remain in JSON. These are measurements with GC/JIT noise, not byte-exact object accounting or indefinite leak proof.

Every final benchmark rebuilds the exact approved B-1 snapshot with the current toolchain, matching only Git checkout HTML newline convention, and compares every production filename/byte/SHA256. The production output remains unchanged:15 files/931,609 bytes, including the same JS/CSS/GLBs/fonts. All original gameplay and collision code is untouched. The original Three.js chunk advisory is retained; no warning limit was changed. Existing32 browser tests retain resource/network regression assertions.
