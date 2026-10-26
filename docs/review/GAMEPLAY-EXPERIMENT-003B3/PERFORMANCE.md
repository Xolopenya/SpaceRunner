# Performance and evidence

The final package repeats13configured checks on its exact committed HEAD. `flow-browser.json`, CPU/raw profiles, `flow-benchmark.json`, `verification.json` and the manifest record actual final results. Precommit figures and exploratory failures are retained separately. Never infer a millisecond guarantee from bounded operation counts.

Real rendering uses serial45s profiles:A approved B2mixed/right desktop, B mixed-flow desktop, B portrait390×844 and B landscape844×390. Desktop is1280×800/DPR1; mobile viewports use desktop Chrome touch/DPR2 emulation. All use the same prerecorded horizontal input, actual120Hz model, Three.js, original assets/audio/VFX. These performance controllers have no geometry/witness access. No other benchmark runs concurrently with rendered measurement.

Frame p50/p95/p99/max include cold Launch; elapsed>=2s intervals are reported separately. Active planning and actual-gate distributions retain p50/p95/p99/max and operation counts; idle coordinator calls are separately available. Every case uses1ms CDP CPU sampling; both desktop cases also record native silent VP8 canvas at equal settings. Sampling/recording add measurement overhead. CPU node samples, every long task, overlapping model work and all>=30ms frame intervals are preserved for investigation rather than attributed to unspecified host load.

Initial8s smoke:B desktop frame p50/p95/p99/max16.7/16.8/17.2/816.5ms. It is not the full A/B measurement. The inherited B2 precommit steady mixed burst had p9949.9ms/planner max21.4ms; B2's later faster run did not explain it. Final full45s profiles and their CPU records determine whether more frequent planning exacerbates those stalls. No advisory/threshold is raised and no outlier is hidden inside an average.

Completed precommit45s profiles (exact-HEAD packaging repeats them):

| Case | Frame p50/p95/p99/max ms | Warm max ms | Planning p50/p95/p99/max ms | Gate p50/p95/p99/max ms | Committed/omitted |
| --- | --- | --- | --- | --- | --- |
| A desktop |16.7/16.9/17.2/500.0|17.5|1.7/3.7/5.2/6.7|1.4/3.3/3.3/4.9|1/7|
| B desktop |16.7/16.9/17.2/283.2|17.6|2.1/4.5/6.6/9.4|1.7/4.8/4.8/6.1|10/1|
| B portrait |16.7/16.9/17.2/299.8|17.6|2.1/3.5/5.0/7.1|1.4/3.3/3.3/4.6|10/1|
| B landscape |16.7/16.8/17.1/299.9|17.4|2.1/3.5/4.9/8.7|1.6/4.3/4.3/4.8|10/1|

B desktop spends1822453propagations/524675queries versus A1294594/525702 over approximately45.17simulated seconds. Planning p95/max rise; frame p99 does not rise in this finite sample. All four profiles record one cold long task with no overlapping model step. CPU samples include original audio-context creation during cold launch and `simulate`/`search` among B's active hotspots. These observations locate measured costs, but do not retrospectively explain B2's49.9ms steady burst. The old spike did not recur here; its cause remains open.

Main long diagnostic work:A131756986propagations/62201958queries; B157387493/49760935. B spends more total propagations while checking fewer compound-heavy queries. These totals cover equal138600spatial units/variant, not equal source counts. All per-call ceilings remain3072/6144. Node wall timings include offline instrumentation and, in the exploratory precommit, other verification activity; rendered serial measurements are the performance authority.

Observed peak active/known objects:A5/5,B14/14; known+pending primitive capacity:A12,B15; ownership records:A2,B3. New DEV trace rings retain16decisions and128input runs, events64 and samples2048. Trace export is an explicit detached JSON snapshot, not per-frame serialization or unlimited telemetry. Raw exports may include long exact witnesses; no backend is added.

Each render case performs five warmups, a same-phase baseline and ten model/World restarts at600real steps. GPU geometry/texture/program counts, slot/source/trace sizes must agree within each case. Forced-GC V8 heap samples and retained delta are reported separately; they are not whole-process or GPU-driver memory, indefinite leak or physical-phone guarantees. The renderer shares the unchanged B2templates/resources and makes the same six GLB requests. No new asset/dependency is downloaded.

Precommit end draw calls/geometries/textures/programs:A28/42/1/11,B35/49/1/12 (both mobile B cases also35/49/1/12). Different visible worlds/damage histories make cross-case counts unsuitable as a leak test. Within-case restart resource counts are stable; retained V8 heap deltas after ten samples are46744/50772/61904/65100bytes. Both modes own the same81geometries/66materials/0textures/90400typed-array bytes for wreck rendering, shared across preallocated instances. Small positive heap deltas are reported without claiming zero retention or an established cause.

Gameplay evidence:ordinary-only field; first wreck publication/approach/entry/pass; successive right/left and lower/upper/center openings; genuine solid impact; collider overlay;3300mnormal-model reference; portrait/landscape. Stage PNGs use accelerated actual fixed steps with stopped RAF, without ship/geometry teleports. Long90sdesktop/60smobile native videos use causal certificate following and are explicitly supplementary. Primary availability evidence comes from prerecorded ordinary inputs and real keyboard/touch tests.

Before commit:186/186unit tests,65/65browser tests, strict typecheck/build and64approved-model preservation cases pass. Production15files/931651bytes are identical. Original collision/runtime/history audits remain mandatory exact-HEAD checks; generated logs record their completion. Human participants0; physical devices0. Owner acceptance and CPU/readability review remain required before moving hazards.
