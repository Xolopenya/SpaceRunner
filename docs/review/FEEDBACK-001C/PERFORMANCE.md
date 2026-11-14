# Performance and resources

Windows x64, Ryzen 5 4600H, 12 logical CPUs, 15.42 GiB RAM. Chrome
157.0.8103.78; ANGLE AMD Radeon integrated graphics, Direct3D11. Desktop 1280×800
and resized portrait 390×844 use the same PC/GPU. These are not physical-phone,
thermal, battery or mobile-CPU measurements. Other test/browser jobs were idle
during the sequential production comparison.

Exact 001B1 source versus final audio runtime, same seed42, Hybrid camera and
inputs. Five cases per viewport/version: flight 600 native frames, shield 240,
mine 240, death 300, extended 1800. Each advances two 120 Hz simulation steps per
native frame. Total 12720 measured frames, plus 7200 no-render/no-simulation idle
RAF callbacks before/after cases. JS CPU covers simulation and render submission;
it is not a GPU timer. All ten before/after observable gameplay endpoint hashes
match (ship/time/distance/HP/phase/hazard/reward slots/publications/current mine).
Protected source and seeded state tests additionally cover simulation preservation.

Thirty natural three-hit deaths/restarts per death case produce 120 stress cycles.
No forced HP/cooldown edits. GC samples at each cycle and a delayed settled sample
separate warmup from retained heap. GPU resources/programs/subscriptions stay
bounded; source/PCM identity is separately checked by native audio tests and the
three-minute final recording. Temporary voices never exceed six.

Steady results: every case averages about 60 FPS. RAF p95 spans 17.0–17.3 ms in
baseline and 17.0–17.2 ms in final. Largest observed draw submission count stays
48; the mine scene rises from 40 to 41 while its extra thermal surface is active.
No new geometry, texture or shader role is added. The approved shield/ship images
are identical, so these results do not come from a visual-quality reduction.

Audio PCM increases from 3,320,732 bytes (3.17 MiB) to 12,868,404 (12.27 MiB), a
fixed additional 9.11 MiB. This buys the 64-second stereo foundation/two synchronized
mono stems and 26 sound buffers. Music uses 11025 Hz; engine/SFX use 22050 Hz.
Temporary synthesis arrays briefly add allocation at initial graph construction.
The graph is not rebuilt on phase changes, death, mute or restart. Permanent
sources increase from four to six; engine rush plus three score buffers form four
loops. Six temporary voices cap total active source nodes at twelve.

JS heap shows similar warmup in both versions. Desktop baseline cycle1→30 is
11,845,460→12,572,048 bytes; final 11,978,024→12,690,204. Final cycles20→30 add
24,900 bytes. Portrait final adds 23,504 bytes over cycles20→30. These small last-ten
changes and stable native PCM do not prove every long-session allocation is free
of retention. The old001B/001B1 heap observation is not declared fixed. GC heap
does not include every native GPU/audio allocation; fixed PCM is counted separately.

No sustained 30 FPS state is reproduced in these samples. Occasional longer
callbacks also occur in baseline/idle controls. The previous observation's cause
has not been isolated, and no platform-wide performance fix is claimed. Exact
per-case, cold initialization, mono/headroom and final endurance figures follow
from the delivered raw measurements.


## Per-case measured comparison

| Viewport / case | FPS base → final | RAF p95 ms base → final | JS CPU p95 ms base → final | Calls max base → final |
|---|---|---|---|---|
| 1280 / flight | 60.05 → 60.09 | 17.1 → 17.1 | 4.8 → 4.9 | 32 → 32 |
| 1280 / shield | 60.02 → 60.48 | 17.3 → 17.2 | 5.3 → 5.3 | 36 → 36 |
| 1280 / mine | 60.42 → 60.49 | 17.2 → 17.1 | 8.1 → 8.1 | 40 → 41 |
| 1280 / death | 60.36 → 60.24 | 17.0 → 17.1 | 3.0 → 2.8 | 37 → 37 |
| 1280 / extended | 60.02 → 60.01 | 17.1 → 17.1 | 4.7 → 4.9 | 48 → 48 |
| 390 / flight | 60.07 → 60.08 | 17.1 → 17.1 | 4.8 → 4.9 | 32 → 32 |
| 390 / shield | 60.33 → 60.31 | 17.1 → 17.2 | 5.2 → 5.0 | 36 → 36 |
| 390 / mine | 60.29 → 60.43 | 17.1 → 17.1 | 8.0 → 8.0 | 40 → 41 |
| 390 / death | 60.07 → 60.21 | 17.1 → 17.0 | 2.9 → 2.8 | 37 → 37 |
| 390 / extended | 60.02 → 60.04 | 17.1 → 17.1 | 4.8 → 4.6 | 48 → 48 |

## Cold graph and signal measurements

Native OfflineAudioContext constructor timing: baseline median 200.9 ms (range 178.4–212.8); final median 669.7 ms (range 364.0–712.5). Different program lengths/caches make this a real one-time cost increase. These small samples include JIT/allocation variability; they do not guarantee a phone startup time. Work runs once after unlock, with no repeated synthesis during flight/restart. No startup speedup is claimed.

Full-gain/high-pressure/maximum-engine/six-fatal-voice mix peak: 0.5619 (-5.01 dBFS), zero full-scale samples. The long score's mono/stereo RMS ratio is 0.732; the measured adjacent-sample seam steps at64/128seconds are {'64': 0.000213623046875, '128': 0.00018310546875}. These are signal measurements, not human quality approval.


## Final native endurance

180.17 seconds of actual native flight with unmuted Chrome output; 5662.5m, HP3, 40 pressure changes, 0 restarts in this clean flight. Buffer/source identities remain stable; cached PCM 12,868,404 bytes; sampled voice maximum 1. Active-section metadata independently bounds each rising/high transition by distance. Opus audio and raw samples are delivered. Recording/telemetry buffers themselves retain memory in this harness, so its pre/post heap is not treated as a production leak test; the separate120-reset comparison supplies that evidence.
