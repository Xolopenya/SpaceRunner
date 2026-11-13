# Performance and resource policy

No per-impact geometry allocation, runtime boolean fracture, physics debris,
postprocessing, texture or dynamic light. Collision meshes/attributes/materials and
six GLB hull sections are allocated once. Shared resources use ResourceOwner sets;
asset cache resources are borrowed and never disposed by the effects.

| Limit | Desktop | Mobile | Reduced motion |
| --- | --- | --- | --- |
| Collision burst slots | 3 | 3 | 3 |
| Substantial fragments per burst | 12 | 6 | 6 |
| Dust/spark points per burst | 64 | 28 | 12 |
| Hull sections on death | 6 | 6 | 6 |
| Small metallic ship fragments | 12 | 6 | 6 |
| Death points | 96 | 40 | 40 |
| Attached critical leak points | 12 | 6 | 0 |
| Death sequence duration | 2.05s | 2.05s | 0.65s |

The normal immunity period exceeds an ordinary burst lifetime; the pool still handles
deliberate saturation safely. Living-play bursts fade within0.8–1.2s. Death runs only
after authoritative termination, so large hull fragments cannot block gameplay.
Analytic damped travel is stable across30/60/120Hz. New pool GPU data/shaders are warmed
in a single cleared backing-store pixel during loading, before the first real hit.
Using the real framebuffer avoids unused linear-color shader variants from a target.

Reproduction after other browser work is idle:

```powershell
node scripts/damage-performance.mjs freeze
node scripts/damage-performance.mjs measure
node scripts/damage-performance.mjs measure-heavy
node scripts/damage-performance.mjs measure-memory
```

This builds exact001A source inside ignored `.cache` and compares sequential production
Chrome cases: two viewports, a certificate-following flight and the natural three-hit
death tape. Each has480 warmup fixed ticks and600 native RAF frames, two fixed steps
per frame. Raw frame/CPU/call data, active burst counts, serialized endpoint hashes,
GPU counters, and baseline/candidate ten-death replay/reset GC heap samples are retained.
The heavy mode additionally measures240 native frames around each real mine/station
collision, before/after in both viewports. Memory mode repeats ten natural deaths for
both versions, then allows native audio cleanup and collects another GC heap sample.

Final main comparison (4800 native measured frames, Chrome157.0.8103.40):

| Scenario / viewport | Base → candidate RAF p95 | Base → candidate CPU p95 | Max calls |
| --- | --- | --- | --- |
| Flight /1280×800 | 16.9→16.8ms | 7.4→8.0ms | 32→32 |
| Collision/death /1280×800 | 17.7→16.9ms | 4.6→4.8ms | 33→36 |
| Flight /390×844 | 16.9→16.9ms | 7.4→7.4ms | 32→32 |
| Collision/death /390×844 | 16.8→16.9ms | 5.2→4.0ms | 33→36 |

Final heavy comparison (1920 additional native measured frames):

| Scenario / viewport | Base → candidate RAF p95 | Base → candidate CPU p95 | Max calls |
| --- | --- | --- | --- |
| Mine /1280×800 | 17.0→16.9ms | 12.6→12.0ms | 36→41 |
| Station /1280×800 | 16.9→16.9ms | 4.3→4.7ms | 37→42 |
| Mine /390×844 | 16.9→16.9ms | 12.9→12.5ms | 36→41 |
| Station /390×844 | 16.9→16.8ms | 4.2→4.5ms | 37→42 |

Every serialized gameplay-endpoint hash matches its001A counterpart in all three
matrices. Snapshots cover ship, elapsed time, distance, HP, phase, hazard/reward slots,
reward counts, publication decisions and current mine. They do not serialize every
private planner/RNG internal; source preservation and existing determinism tests
additionally cover the unchanged simulation modules.
These are small sequential samples on one desktop GPU, not a speedup claim
or a phone frame-rate guarantee. Raw RAF/CPU arrays retain outliers; e.g. the baseline
desktop mine reaches55.4ms, while its candidate sample reaches18.6ms. This does not
establish that the feature eliminates stalls. No active collision-pool sample exceeds
one slot during these natural-hit tapes.

Memory comparison adds2400 measured frames and40 natural death/reset replays, with
CDP GC after each replay. Both versions then receive150 presentation frames and1.6s
for audio cleanup before a final GC sample. Main mode independently also records40
replays. The following values are from `memory-performance.json`:

| Source / viewport | JS used heap after first replay | After tenth replay | After settling | GPU geometries / textures / programs |
| --- | --- | --- | --- | --- |
| Base /1280×800 | 11,284,184B | 11,632,764B | 11,632,420B | 30 /1 /14 |
| Base /390×844 | 11,238,036B | 11,590,012B | 11,589,668B | 30 /1 /14 |
| Candidate /1280×800 | 11,897,700B | 12,284,724B | 12,284,568B | 52 /1 /21 |
| Candidate /390×844 | 11,900,268B | 12,284,428B | 12,284,272B | 52 /1 /21 |

Memory mode also preserves its frame-rate anomaly: baseline desktop RAF p50/p95
16.7/33.5ms (45.0 average FPS), baseline portrait33.3/34.0ms (30.0FPS), candidate
desktop33.3/34.3ms and portrait33.3/34.2ms (both30.0FPS). The shift toward a33ms
RAF cadence occurs in the baseline before candidate measurement. Its cause was not
isolated, so these heap-series frame times are not treated as a controlled rendering
regression or silently discarded. The main/heavy matrices average59.7–60.5FPS;
main-thread CPU numbers measure two fixed steps plus render submission, not GPU time.

All ten samples keep identical GPU counts and one feedback subscription per version;
the candidate's22 additional geometries are fixed preallocated effects. The heavy
station/mine matrix uses55-versus33 because additional original assets are resident.
Settled retained JS cost is0.62–0.66MiB above baseline in memory mode. Heap growth
from first to tenth replay is0.33–0.34MiB baseline and0.37MiB candidate and does not
disappear on settling. Main mode independently records about0.38MiB baseline and
0.43MiB candidate growth across ten replays.
Its cause is not isolated; do not interpret stable GPU counts as proof of zero JS
retention or infer a confirmed feature leak from these finite samples.

Lifecycle tests additionally verify stable GPU counts/subscriptions over ten deaths,
resource identity reuse, asset-material isolation and exact-once disposal. Native
WEBGL_lose_context interruption/recovery is tested. A stable bounded sample does not
prove universal long-duration memory behavior. Loading-time shader warmup cost is not
separately benchmarked. Mobile dimensions are emulated on a
desktop GPU; physical phones and device thermal behavior are untested.
