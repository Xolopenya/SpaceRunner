# Performance and resource evidence

Windows x64, Ryzen5 4600H/12 logical CPUs,16.56GB RAM, Chrome157.0.8103.78,
ANGLE AMD Radeon D3D11. These are local desktop measurements at desktop and mobile
viewport sizes, not physical-phone measurements. Native browsers ran sequentially
without competing review captures. Baseline is exact0348c2a production build.

Each case uses the same seed/input/cadence and Hybrid camera. Five cases at two
viewports for baseline/final give20 rows/10320 measured frames. Flight/extended use
600/1200 frames; event cases use their recorded tape window. Two fixed simulation
steps per native RAF. Idle60-frame controls surround each case. All10 gameplay
endpoint hashes match. Raw RAF, CPU, draw calls, resources and state are retained
in `evidence/performance.json`; CPU includes update/render scheduling, not GPU time.

| Case / width | Baseline FPS | Final FPS | RAF p95 baseline→final ms | CPU p95 baseline→final ms |
|---|---:|---:|---|---|
| flight1280 | 60.08 | 60.09 | 17.1→17.2 | 5.3→4.8 |
| shield1280 | 60.37 | 60.38 | 17.3→17.2 | 5.1→5.4 |
| mine1280 | 60.46 | 60.40 | 17.2→17.2 | 8.0→8.2 |
| death1280 | 60.26 | 59.65 | 17.1→17.2 | 3.4→3.4 |
| extended1280 | 60.05 | 60.06 | 17.2→17.2 | 4.8→4.9 |
| flight390 | 60.08 | 60.09 | 17.2→17.2 | 4.9→5.0 |
| shield390 | 60.35 | 60.39 | 17.1→17.2 | 5.9→5.2 |
| mine390 | 60.33 | 60.38 | 17.2→17.2 | 8.0→8.4 |
| death390 | 60.19 | 60.20 | 17.2→17.1 | 3.5→3.0 |
| extended390 | 60.04 | 60.02 | 17.1→17.2 | 4.7→4.6 |

Final desktop death contains one36.9ms maximum interval; desktop extended max20.1ms.
Baseline shield max28.7ms. The finite sample preserves approximately60FPS/p95,
not a claim of stall-free execution or a statistically isolated causal estimate.

## Audio loading and memory

Eight mono22050Hz derivatives add212612 bytes (207.6KiB) to downloads,599776 bytes
(585.7KiB) retained composite PCM. Total retained graph PCM is13468180 bytes,
including approved score/engine/fallback buffers. Decode originals are temporary.
No request occurs until first unlock; resets reuse the bank. Each hit uses one
existing voice slot; the cap remains6. The full browser test checks8 requests,
volume/mute,20resets and bank/context disposal.

Production-preview performance runs loaded the bank in92.4–133.9ms; separate native
live captures109–148.5ms. First development-server offline review took2848.5ms,
then24–216ms for successful cached examples. This cold Vite/import/network/decode
sample is retained, not hidden or presented as production network latency. Loading
is optional: engine/music/old collision fallback remain available while it runs.
Graph construction measured481ms cold/332–352ms warm in final offline renders versus
400/378/426ms baseline. These single sequential measurements include the existing
procedural graph initialization and do not isolate the added loader's CPU cost.
No third-party request, runtime decompressor or additional AudioContext.

## Guidance and lifecycle

Two geometries/two materials, one added shader role, no textures/lights/postprocess.
One draw when no target, two with contour; controlled scene deltas confirm1–2 calls.
Main scenario maxima rise by1 while death remains37. Buffers/vectors/query scratch
are reused per frame; contour topology rebuilds only for profile/assist changes.
Five production geometry probes measure0.0029–0.0057ms per update in warmed2000-call
batches. That microbenchmark is not a whole-frame or worst-case guarantee. Explicit
dispose drops exactly2 renderer geometries and retains texture count.

Ten natural death/UI-restart cycles per viewport/source give40cycles. Geometry,
texture, shader, subscriber and voice ownership counts stay stable: baseline
45geometries/1texture/26programs versus final47/1/27 at restart endpoints; one event
subscriber, at most4 active voices in these snapshots. GC heap grows about0.58–.60MB
in both versions during the repeated run; final settled heap is12.76–12.77MB versus
12.56–12.58MB baseline. This observation does not prove a leak or its absence.

A separate60.069s native audio flight records60 per-second samples, identical
buffer/source identities and constant13468180-byte PCM, at most1 transient voice,
zero restarts in that flight. Settled JS heap falls from13.87MB to13.45MB after GC.
Repeated restart coverage comes from the separate40cycles, not that flight.
Maximum sampled mix (six simultaneous mine cues, full music/engine/settings) peaks
at .59735/−4.48dBFS, with zero clipped samples. Physical phone CPU, GPU, network,
speaker response and listening fatigue remain owner validation work.
