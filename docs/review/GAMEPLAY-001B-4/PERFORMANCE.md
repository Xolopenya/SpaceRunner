# B-4 scheduling performance

Precommit profile:2026-10-24T10:44:28.116Z; Nodev24.11.1; Chrome155.0.8059.85. Raw precommit-director-metrics/samples/examples and precommit-analysis are preserved under logs/baseline/. Current exact-HEAD package reruns retain their own raw data under logs/. Times vary; no measurement is replaced by a claimed identical rerun.

## Complete cost accounting

Preparation includes generation, inspection, reservation,144-step forecast and B-2 preparation. CPU/session sums preparation plus every coordinator advance, including waiting checks and final gate. It excludes the research driver's ordinary flight/collision simulation and renderer. Work chunks cover validation/replay/publication jobs only; idle advances do not dilute their percentiles. Commit cost is the complete publication-tick call, including any last work on deadline cases. No clock or wall-time stopping changes deterministic work decisions.

| Milliseconds | Samples | Median | p95 | p99 | Maximum |
| --- | --- | --- | --- | --- | --- |
| Preparation |1588 |0.3013|0.5803|0.9345|2.5072 |
| CPU/session incl waiting and final gate |1588 |131.7734|224.5665|274.5417|418.8992 |
| Node work chunk |97075 |2.1554|3.4795|4.5303|85.9476 |
| Node waiting advance |130012 |0.0007|0.0019|0.0030|0.6468 |
| Node publication-tick gate |1588 |0.0258|0.0520|0.0940|1.7344 |
| Chrome work chunk |3722 |1.5000|2.8000|3.4000|9.8000 |
| Chrome publication-tick gate |48 |0.0000|0.4000|1.4000|1.4000 |

7 observed advances exceed16ms; all raw samples/contexts are retained. The work-chunk p95 does not establish a2ms desktop target or physical-phone budget. Chrome timer resolution limits interpretation of very small values. CPU/session is offline CPU, not144 ticks of real rendering time.

## Lower-budget sequence experiment

The paired subset starts the same two seeds and three progression bands for four consecutive sections,24 decisions per budget. Roots may diverge after an omission; this is a complete scheduling-policy tradeoff, not identical-work microbenchmarking. Default limits remain3072/6144; lower2048/4096 is diagnostic only.

| Budget | Committed/24 | Chunk median | p95 | p99 | Maximum ms |
| --- | --- | --- | --- | --- | --- |
|3072/6144 |23 |2.3168|4.7049|6.6151|85.9476 |
|2048/4096 |21 |1.3847|2.1572|2.8659|3.9927 |

All3 logical budget/deadline failures occur in the lower-budget early cohort; standard-budget cohorts have zero. A work deadline is an operation/tick limit, not a measured wall-clock CPU timeout. Long wall-time chunks are reported separately rather than relabeled as timeout omissions. No budget increase or unchecked acceptance is used.

## Outlier investigation and work bounds

B-3 recorded30.19ms Node and7.1ms Chrome maxima. B-4's early pre-identity profile recorded64.7981ms Node, with p952.7338. Inspection identified unnecessary JSON geometry serialization on every fixed tick. The coordinator now compares all primitive hazard/provenance fields exactly, with tampering tests; IDs/hashes alone are never enough. The old profile remains in baseline/pre-identity-profile-metrics.json. Fresh timing differs in both directions, so no universal speedup or proof of a GC cause is claimed. Diagnostic recording/JIT/OS/GC can affect maxima. Keep the actual current outliers.

Whole-session maxima:289686 propagations,185748 narrow queries,2 searches,4 replays; frontier16/expansion144. Work-complete ticks median/p95/p99/max:57/98/106/144; fixed publication remains144. One pending job per world, peak ownership records4/16 and actual known hazards17/32. Source spans remain48–144 units; minimum cadence48/34≈1.412s versus1.2s deadline, but actual CPU/main-thread viability still needs integration measurements.

## Memory

Fresh --expose-gc child:5 warmups,5 independent-world sessions retained after12 advances,40 serial completed/reset sessions with GC every10. Measured heap+ArrayBuffer retained delta **-251056 bytes**; active-session estimate **18761.6 bytes/session**. Full heap/ArrayBuffer/external/RSS snapshots are retained; external is not added twice. One world never owns five pending jobs: that is only an amplification experiment across independent worlds.

The finite8MiB guard passes. These are noisy retained-state estimates, not exact512KiB accounting or indefinite leak proof. The research recorder intentionally retains result history; the production-independent ledger itself is bounded and its four long director runs retain only rolling aggregates. Actual caller-owned witness/history lifetimes must be reviewed during B-5.

## Isolation and reproduction

All approved B-3 src/public/tests/design/dependency/build inputs are guarded unchanged. The configured original pattern benchmark also runs original B-2 and nested B-1 diagnostics in their approved snapshots, preserving source assertions and recording the established two path-only Git/Vite bootstrap adaptations. Fresh production files remain byte-identical:15 files/931609 bytes, JS663045/default Node gzip169576. Existing Three.js advisory is unchanged.

Run npm run build, then node --experimental-strip-types scripts/director-benchmark.mjs. Defaults run1588 scheduled decisions,240 long fixed-field policy episodes,288 short accepted-field counterfactuals,256-seed structural stress and four director-only24h-equivalent schedules. DIRECTOR_REFERENCE_SECTIONS and DIRECTOR_POLICY_SECTIONS can expand the bounded consecutive workload to128 each; do not label unexecuted expansions as results. Installed Chrome/local5190 are required. A worker, live integration, concurrent-rendering and physical-phone certification are not implemented; see B5_INTEGRATION_PLAN.
