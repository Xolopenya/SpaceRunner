# Performance and verification — GAMEPLAY-EXPERIMENT-003B

These tables quote the preserved precommit measurements after the four-box optimizations and complete renderer fix. Exact-HEAD packaging repeats all12 checks; its `logs/structure-browser.json`, `structure-benchmark.json`, `verification.json` and manifest are authoritative for that final run. Precommit source/metric identities and raw profiles are retained under `logs/baseline/precommit-*`. No timing is inferred from average FPS.

## Real rendering

Installed Chrome155.0.8059.85, Windows desktop; five serial14s cases, no concurrent benchmark. Actual RAF/120Hz GameModel, Three.js, existing GLBs, VFX and Web Audio. All modes use a causal follower of their currently published certificate; no future tape enters the planner. Desktop1280×800,DPR1; portrait390×844 and landscape844×390,touch/DPR2 emulation. All three desktop modes record silent native VP8 canvas at identical settings. Recordings add cost; mobile emulation is unrecorded. Launch intervals are retained; steady means elapsed≥1s. Order is fixed, so cache/JIT/cold differences cannot be attributed solely to policy.

| Case | Frame p50 /p95 /p99 /max ms | Steady p95 /max ms | Work chunks p50 /p95 /p99 /max ms | Publication p50 /p95 /p99 /max ms |
| --- | --- | --- | --- | --- |
| Baseline desktop |16.7 /17.1 /17.3 /583.2|17.1 /17.4|2.0 /3.2 /4.8 /11.5|1.9 /1.9 /1.9 /4.1|
| Pressure desktop |16.7 /17.1 /17.3 /249.9|17.1 /17.5|2.4 /4.7 /5.3 /6.1|2.6 /3.0 /3.0 /6.5|
| Structure desktop |16.7 /17.0 /17.3 /249.9|17.0 /17.4|1.3 /2.4 /2.7 /4.3|2.6 /2.6 /2.6 /5.0|
| Structure portrait emulation |16.7 /16.9 /17.2 /416.7|16.9 /17.4|2.2 /2.9 /4.2 /10.2|2.8 /2.8 /2.8 /4.8|
| Structure landscape emulation |16.7 /17.0 /17.2 /266.7|17.0 /17.5|1.5 /2.6 /3.2 /4.0|2.8 /2.8 /2.8 /3.5|

Frame counts846/845/845/846/846; work chunks332/322/176/176/176. Publication has only3/4/3/3/3 samples, so its percentiles are weak estimates. Cold spikes remain substantial. This finite desktop run does not establish a universal frame budget, phone performance or thermal stability. The original500kB Vite advisory remains; its limit is unchanged.

| Case | Gameplay hazard queries / billed profile units | Published / omitted in14s | End draw calls / triangles | Renderer geometries / textures / programs |
| --- | --- | --- | --- | --- |
| Baseline desktop |11388 /11388|3 /0|40 /3880|34 /1 /11|
| Pressure desktop |16502 /16502|4 /0|42 /3864|34 /1 /11|
| Structure desktop |1785 /7140|3 /0|42 /3126|31 /1 /11|
| Structure portrait |1791 /7164|3 /0|42 /3126|31 /1 /11|
| Structure landscape |1789 /7156|3 /0|42 /3126|31 /1 /11|

Legacy profile units preserve the approved query accounting for the old sphere/calibrated-box adapter; they are not an instruction-level math count. Each new compound query executes and is billed as four box primitives. Full planning/replay counts are separate below. These worlds differ in cadence and geometry; lower query counts alone do not show better gameplay.

## Geometry and resource lifecycle

No new GLB/texture bytes or requests. The six unchanged GLBs total78580disk bytes; each context makes exactly six requests. AssetManager owns14geometries/14materials/0textures and65720unique typed-array payload/backing-buffer bytes. The DEV model/debug owner adds12geometries/6materials/0textures and17920typed-array bytes, shared by eight preallocated representation groups (32primitive hard capacity /4). Counts include hidden debug wires. These are CPU payload/resource counts, not whole-process heap or GPU-driver memory.

Each case performs five warmups, a same-phase baseline and ten restarts at144 real fixed steps plus rendering. Geometry/texture/program counts remain identical to that case's baseline; slots stay72 and ownership records1. No new download occurs. The updated browser tests also assert that at least two committed structures render as frames and that **all** borrowed small-model groups for those slots are hidden. Source ownership survives damage; render despawn and ledger expiry remain distinct. Ten finite restarts do not prove indefinite retention bounds.

## Validator and optimization evidence

240 direct valid jobs, four intentionally unreachable late jobs and36 actual-model histories. Every accepted direct/runtime witness receives an unpruned independent replay. Direct validation CPU p50/p95/p99/max **21.146/81.647/85.708/100.677ms**; pooled diagnostic chunks **0.844/2.020/2.877/11.616ms** (9401samples, including replay/audit work). Max123655propagations,32000billed narrow primitives and44planning calls. Per-call maxima remain3072propagations/6144queries. No budget increase, worker or unchecked publication.

The first measured design used radius13 as its axial search envelope and executed the general rounded-box kernel even for distant solids. It had direct-job p95 **225.173ms**, chunks p95 **7.481**/max27.012ms, structure desktop work p95 **14.8**/max23.5ms, steady-frame max116.7ms and frame p99 **33.5ms**. The original raw JSON/logs are retained under `preoptimization-*`; the before/after profiles are diagnostic runs, not a randomized hardware experiment.

The final profile uses its true conservative axial half-depth3 for search/publication, separately retaining radius13 for enclosing bounds, source separation and lifecycle. Strictly disjoint expanded slabs reject within each still-charged primitive before the exact rounded-box kernel. All10000 optimized random sweeps match four unpruned kernel calls; full-versus-culled publication hashes agree. Paint planes are batched by material; structural faces use one material per member. A subsequent visual audit fixed pooled representation of every committed structure, including distant ones. Source/renderer freezes and corrected standalone browser results are distinguished from the earlier full verification run in attempt logs. The original four-solid shape was retained; no smaller unsafe substitute was needed.

## Visual evidence and limits

31 actual browser PNGs: three desktop policy samples, portrait/landscape, first published visibility, approach, entry, successful passage, solid impact, collider debug, and entry/exit for all five offsets. Stage images use accelerated **actual** GameModel integration with stopped RAF, not player/geometry teleports; they are not performance measurements. Three native14s desktop canvas WebMs are silent and exclude DOM HUD. Precommit sizes:baseline2130257,pressure2220836,structure2081214bytes. Two frames at2s/6s decode with differing hashes in every video. Final inventory records exact archive bytes/hashes.

The orange hole and depth are legible in inspected desktop/portrait/landscape samples. Lower-offset exit partially masks the ship with the unchanged chase-camera angle after clearance; it clears by normal+8 render despawn. The unchanged forgiving sphere allows visible wing grazing in some reference trajectories. These are explicit visual review risks, not reasons to weaken CCD or claim human acceptance. Centered/keyboard passages remain real and collision-free. Human participants0; physical devices0.

## Verification

Precommit full `review:verify`: all12commands exit0, including typecheck,170units,47browser tests,build,diff-check,source-safety,build-analysis,collision-audit,full runtime-benchmark,structure-preservation,structure-benchmark andstructure-browser. After the complete renderer fix: typecheck and all7structure browser cases passed again; the full frozen-source structure browser benchmark repeated successfully. Exact-HEAD packaging reruns all12 against the committed source.

Legacy runtime audit:2632scheduled decisions/377runs,384actual GameModel cases/505independent actual-model audits/0violations, plus eight live render profiles. Historical source-pinned A/B preservation runs at its unmodified approved snapshot;24new differential histories compare both selectable policies to56824ad. Production output is byte-identical:15files/931651bytes. Original generator/witness goldens remain. Initial loopback/junction permission failures and the corrected nested Git-root bootstrap attempt remain in logs; none is labeled a successful command. No dependencies were installed and no main/merge/force operation is authorized by this delivery.
