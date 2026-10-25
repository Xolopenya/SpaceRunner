# Performance, verification and remaining limits

The tables below quote the preserved precommit actual-render run (`logs/baseline/precommit-pressure-browser.json` and raw profiles). The exact committed package repeats all13 checks; its `logs/pressure-browser.json`, `verification.json` and VERIFICATION.md are authoritative for final timings/exit codes. Timing samples vary; deterministic logical input/geometry/outcome identities are independently compared between precommit and packaged results.

## Actual game measurement

Installed Chrome155.0.8059.85 on this Windows desktop. Four14s cases use the ordinary RAF loop, actual120Hz GameModel, Three.js/GLBs/VFX and running Web Audio. Desktop1280×800,DPR1; portrait390×844,touch/DPR2 emulation. Both policies use the same time-indexed prerecorded horizontal tape (reverse every1.5s). Planner APIs see only current observations. No accelerated/stopped loop occurs during these performance samples. No other benchmark runs concurrently.

Native desktop MediaRecorder capture runs during both desktop profiles, adding recording cost equally. Profiles begin before Launch and retain cold stalls; post-first-simulation-second intervals are labeled separately. Slightly different wall-clock completion produces slightly different terminal simulation clocks; these profiles are not fixed-window density comparisons. Exact12s/neutral screenshots are a separate browser test fixture.

| Case | Frame p50 /p95 /p99 /max ms | Steady p95 /max ms | Planner work p95 /max ms | Actual gate p95 /max ms |
| --- | --- | --- | --- | --- |
| A desktop |16.7 /17.1 /17.2 /583.4|17.1 /17.3|3.3 /6.6|2.7 /5.5|
| B desktop |16.7 /17.0 /17.2 /250.0|16.9 /17.3|4.8 /9.8|3.0 /3.5|
| A portrait emulation |16.7 /17.0 /17.3 /249.8|17.0 /23.3|3.2 /4.9|2.8 /4.3|
| B portrait emulation |16.7 /17.1 /17.3 /233.3|17.0 /17.3|3.6 /5.0|3.1 /3.6|

This finite sample shows similar frame p95 and higher B work-chunk cost, especially desktop. It does not certify a universal frame budget. Gates have only3–4 samples/case, so their percentile estimates are weak. Cold Launch stalls remain material. A runs first; cache/JIT/order variation prevents attributing B's smaller cold maximum to the policy. Audio/camera/render implementation is unchanged. No invented causal attribution or smooth-launch claim is made.

All four cases have0 browser/resource failures and audio running. End-profile draw calls A31/B38; geometry/texture counts A32/1,B37/1 in these actual worlds. The worlds and hit histories differ, so cross-policy resource counts are not a leak test. The finite within-policy restart tests below establish observed stability, not that an arbitrary future resource count can never rise.

## Resource lifecycle and visual evidence

After measurement, each case stops RAF for a separate engineered same-phase restart stress:five warmups,one baseline,ten repeated resets,20 real fixed steps and a real render per sample. Pending work cancels, slots stay72, event/sample rings stay within64/2048 (observed0/20), and renderer geometry/texture counts remain constant. A desktop34/1, B desktop37/1, A portrait32/1, B portrait37/1. No unexpected asset re-download occurs (six GLB requests per context). Browser tests additionally exercise real Replay buttons, damage/death, pause, focus, keyboard/touch and stable GPU resources. Finite tests do not prove indefinite JS/GPU retention bounds.

Both desktop WebMs are native VP8 recordings of the actual Three.js canvas, silent and without DOM HUD. Precommit sizes: A1684502 bytes,B1798763. Frames at2s and6s decode at1280×800 with distinct hashes in each recording. Final archive inventory records actual final bytes/SHA256. Screenshots retain the actual HUD; portrait emulation visibly shows live2/3 hull and distance after a natural hit. No synthetic screenshot is labeled as gameplay. The geometry comparison is explicitly a data plot.

## Logical work and preservation

The456-run logical benchmark uses four independent Node processes, so its wall/CPU samples are contended and are not presented as isolated frame performance. Work counts and original limits remain authoritative:144 planning calls,3072 propagations/6144 queries per call,2 searches/4 replays,32 known+candidate hazards and one pending transaction. The main comparison independently audits7534 certificates with127158574 full queries and0 violations. Peak known hazards is18; source records4.

`pressure-preservation.mjs` compares23 protected sources,12 approved-versus-A real-model histories and fresh production output. Production is byte-identical to approved928b88a:15 files/931651 bytes. Both experimental policy namespaces/graphs are absent from production attribution and emitted JS. No assets/dependencies are added and the expected Three.js500kB advisory remains; its limit is not raised.

## Executed verification before final evidence commit

| Command | Result |
| --- | --- |
| `npm run typecheck` | Exit0 |
| `npm run test` | Exit0;157/157 |
| `npm run build` | Exit0;original chunk advisory |
| `npm run test:browser` | Exit0;40/40,5.3min under concurrent logical load |
| `git diff --check` | Exit0 |
| `node scripts/review-static.mjs` | Exit0;0 known credential signatures (not exhaustive audit) |
| `node scripts/build-analysis.mjs` | Exit0 |
| `node --experimental-strip-types scripts/collision-audit.mjs` | Exit0 |
| `node --experimental-strip-types scripts/runtime-history.mjs` | Exit0;original B-1–B-4 snapshots/guards preserved |
| `node --experimental-strip-types scripts/runtime-benchmark.mjs` | Exit0;full baseline logical/model/render pipeline |
| `node --experimental-strip-types scripts/pressure-preservation.mjs` | Exit0 after local dependency-junction permission retry |
| `node --experimental-strip-types scripts/pressure-benchmark.mjs` | Exit0;456 runs,7534 independent audits,0 violations |
| `node scripts/pressure-browser.mjs` | Exit0;four real-render cases,two decoded recordings,resource checks,geometry plot |

The initial sandbox-only preservation attempt failed creating the dependency junction (EPERM); its actual failed log is retained. The authorized local retry passed. Earlier pilot/full logs remain evidence, not rewritten successes. No safety/test assertion was weakened. Final exact-HEAD packaging repeats the13 configured commands and records actual results rather than relying on this authored table.

## Remaining risks and rollout decision

Boundary bypasses remain the decisive gameplay failure despite higher accepted density. B work-chunk costs rise; physical phones, thermal/long sessions, slower CPUs/GPUs and broader browsers are untested. Cold Launch stalls, portrait edge clipping and combined keyboard+touch input-domain mismatch remain inherited limits. Conditional route certificates do not establish human readability/enjoyment. Human participants:0. Keep production and baseline defaults; no B promotion is recommended.
