# GAMEPLAY-001B-3 performance

This report records the complete precommit profile dated 2026-10-24T01:39:53.918Z. Raw precommit-pattern-metrics/samples/examples JSON and precommit-verification are preserved under logs/baseline/ in the ZIP. Current exact-HEAD verification reruns are in logs/; timing and GC figures vary between runs. Counts, outcomes, hashes and work bounds are asserted rather than tuned to a timing quota.

## Timing and work

Node v24.11.1, win32; installed Chrome 155.0.8059.85. Jobs run in an isolated logical harness with no Game/World/GLB or concurrent rendering. Preparation measures request construction, proposal and context setup. Whole job includes normal admission, committed-only search/replay, union search/replay and incremental bookkeeping. External replay is an additional fresh check; geometric clearance analysis and authored diagnostic routes are outside these timings. Chunks are one advance call, not entire jobs or rendering frames.

| Measurement (ms) | Samples | Median | p95 | Maximum |
| --- | --- | --- | --- | --- |
| Candidate/context preparation | 1096 | 0.0606 | 0.1171 | 1.3922 |
| Node whole job | 1088 | 30.0012 | 97.9502 | 146.8186 |
| Node incremental chunk | 29296 | 1.1147 | 1.8598 | 6.2647 |
| Node external replay | 1023 | 1.4038 | 3.5427 | 6.2975 |
| Chrome whole job | 64 | 32.9000 | 38.4000 | 49.6000 |
| Chrome incremental chunk | 1547 | 1.2000 | 2.2000 | 5.4000 |

1096 accounted attempts produce 1088 structurally admitted jobs;8 invalid requests never enter search. 1023 jobs accept;64 fail reaction distance and1 fails existing-field certification. No automatic fallback is implemented. All768 family cases and128 global-neutral cases accept. Joint acceptance127/128 remains explicit. Two authored normal replay diagnostics are supplemental, excluded from beam rates and job timings. Chrome repeats64 actual high-intensity neutral cases with exact Node decision/hash agreement.

| Work per Node job | Median | p95 | Maximum |
| --- | --- | --- | --- |
| Propagations |76385 |207788 |252448 |
| Narrow collision queries |16291 |43216 |76712 |
| Logical planning ticks |26 |71 |87 |

Peak frontier16; peak expansion144; deadline failures0; horizon failures0; known-safe trace misses detected0. The last count describes the finite diagnostic probes only, not complete search. Approved defaults3072 propagations/6144 queries per chunk, hard4096/8192 ceilings,144 planning ticks, width16,1800-substep horizon and32 known hazards are unchanged. Local chunks exceeding a2ms target remain evidence for future scheduling; a worker or increased limits are not introduced.

## Memory and capacity

A fresh --expose-gc child runs5 warmups,10000 proposal/reset calls,5 active jobs after12 advances and40 completed jobs with GC every10. The measured heap+ArrayBuffer retained delta is **261480 bytes**; estimated incremental active-job cost **107880 bytes/job**. Raw baseline, after-generation, active and batch snapshots retain heap, ArrayBuffers, external and RSS separately. The final process RSS is186040320 bytes; Node/runtime/JIT dominate this number. External is not added again to ArrayBuffers.

The finite8MiB retention guard passed. GC/JIT noise and shared allocation prevent an exact per-job512KiB guarantee or indefinite leak proof. No24-hour, physical phone or concurrent-rendering measurement is claimed. Candidate maximum8 here remains under12; complete rejection at configured capacity1, exact joint32/over32 and full-source ownership are executable tests. Live pool72 remains untouched.

## Production and historical evidence

Fresh approved B-2 and current builds match all15 output files byte-for-byte:931609 bytes total; JS663045 bytes, Node default gzip169576; CSS14479. The38-module live graph has no encounter or validator entry. No dependency/config/asset changes were needed. Existing Three.js chunk advisory remains, without a fabricated performance regression.

The benchmark executes historical B-2 trajectory and nested B-1 foundation diagnostics against reconstructed approved source, preserving their source-pinning assertions. Two explicitly logged path-only bootstrap substitutions fix nested Git metadata/Vite lookup. B-2 reproduces336 Node and80 Chrome jobs with176 normal/zero-margin/long-horizon acceptances,80 late-existing rejections and80 late-candidate rejections; B-1 retains its original generator/ownership/build assertions. Their raw outputs and reproduction hashes are in logs/baseline/. These historical timings do not describe new patterns.

Production browser regression checks separately cover keyboard/touch, restart/resource retention, focus/context recovery, UI and native audio. These tests and byte identity establish isolation within the tested environment, not universal browser/mobile performance. Readability, fun, cadence and eventual transaction-wide scheduling remain review/playtest work.
