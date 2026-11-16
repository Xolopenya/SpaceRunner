# Performance and resource observations

Windows x64, Ryzen5 4600H/12 logical CPUs,16.56GB RAM; Chrome157.0.8103.78,
ANGLE AMD Radeon D3D11. Desktop1280×800 and portrait390×844 are local viewport
measurements, not physical phones. Quantitative browsers ran sequentially after
the full suite. Two simulation steps per native RAF, identical input/seed/Hybrid
camera,60-frame idle controls before/after each case. Raw CPU/RAF/draw/effect arrays
and resource states are included. CPU measures the two update/render steps; RAF
also includes driver/scheduling/diagnostic effects and is not GPU timer-query time.

Twenty matched cases contain10320 measured frames. Dense uses the actual natural
three-shard curve tape; extended is1200 native frames. All10 protected endpoint
hashes match (collectible count/slots intentionally excluded). No quality reduction.

| Case / width | C1 FPS | C2 FPS | RAF p95 C1→C2 ms | CPU p95 C1→C2 ms | Max calls C1→C2 |
|---|---:|---:|---|---|---|
| flight1280 | 60.06 | 60.03 | 16.9→16.9 | 6.5→5.8 | 33→38 |
| dense1280 | 60.44 | 57.55 | 16.9→17.0 | 6.7→6.6 | 30→35 |
| mine1280 | 60.13 | 60.33 | 17.0→17.2 | 10.9→14.7 | 42→41 |
| death1280 | 60.23 | 60.23 | 17.0→17.0 | 2.9→4.9 | 37→37 |
| extended1280 | 60.03 | 60.05 | 16.9→17.0 | 5.6→5.6 | 39→38 |
| flight390 | 60.05 | 60.05 | 16.9→16.9 | 6.0→6.2 | 33→38 |
| dense390 | 60.35 | 60.35 | 16.9→16.9 | 7.1→6.0 | 30→35 |
| mine390 | 60.46 | 60.37 | 16.9→16.9 | 10.4→10.6 | 42→41 |
| death390 | 60.33 | 60.30 | 16.9→17.0 | 3.3→3.1 | 37→37 |
| extended390 | 60.02 | 60.02 | 17.0→16.9 | 5.5→5.7 | 39→38 |

The original desktop dense sample includes five consecutive intervals72.4/53.5/
53.4/54.3/52.0ms at frames198–202. Measured prior update CPU is2–3.2ms, shader
count26/draws28/one remaining shard are unchanged across the episode. Its cause
is unresolved; it is retained, not removed from the average or called a fixed bug.

A targeted fresh-page repeat of the exact setup ran three times/source without
other quantitative browser work. C1 gives60.36–60.46FPS, p95≤17.0/max17.4ms;
C2 gives60.26–60.37FPS, p95≤17.0/max17.5ms. No observed long task in those repeats;
protected state hashes match. The original episode did not reproduce. These finite
samples support approximately60FPS, not universal stall-free execution. Mine CPU
variation is reported without attributing it to unchanged effect code.

## Geometry and memory

Guide removal saves exactly2 renderer geometries and1 program in every matched
main endpoint; textures remain1. Trails reuse the unchanged eight-shard pool, its
three shared geometries/four materials, and existing model sizes. Visible peak is
3 versus1/2 in baseline samples; two extra shards add six mesh draws while guide
removal removes one/two, giving a net peak+5 in the dense/flight windows. No trail
mesh/material/texture is allocated on admission. Immutable proposals and temporary
route checks are allocated only at publication; existing per-frame8-slot work stays.

Ten actual death/UI-restart cycles per source/viewport give40cycles. Each route
retains constant geometry/texture/program/subscriber counts: C147/1/27 versus
C245/1/26, one event subscriber. GC heap rises about.56–.61MB over ten cycles in
both versions; final settled12.64–12.65MB versus C112.75–12.82MB. This is a finite
observation, not proof of indefinite leak absence or a claimed leak fix.

Separate continuous native flight executes7200 RAF callbacks in120.146s (about
59.9/s including recording/flush),120 per-second resource samples,0 restarts and
peak3 active shards. Audio source/buffer identities and13468180-byte PCM stay
constant; context remains running and no guide object exists. Sampled geometry
varies40–86/programs24–27 as the scene varies; texture count1. Settled heap is
13.74MB versus11.02MB at initial observation. That run is not a controlled isolation
of cache/scene/QA retention growth. The same-route restart measurements above are
the direct comparison for accumulation; no stable-all-GPU-counters claim is made
for the changing extended scene.

No new asset download or dependency. Approved audio bytes and its599776-byte
sample cache are unchanged. Native continuous Opus audio and resource receipts
are in `final/live`. Physical phones, thermal throttling and other browsers remain
unmeasured; overall human comfort/readability needs owner follow-up.
