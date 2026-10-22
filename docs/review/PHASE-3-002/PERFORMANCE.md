# Rendering performance evidence

## Method

`node scripts/vfx-performance.mjs` uses installed headless Google Chrome, a local Vite server on 5184 and the same machine/GPU for both revisions. Browser version: 155.0.8059.85; GPU: AMD Radeon(TM) Graphics via ANGLE/D3D11. Desktop: 1280×800, DPR 1. Mobile emulation: 390×844, DPR 2 with the existing effective renderer cap 1.4.

The fixture uses seed 42, speed 34 and six fixed, visible GLB hazards at matching transforms. It stops the normal loop and advances only visual distance/elapsed while manually rendering once per RAF. Each sample warms 60 frames and records 180 frames. This holds hazard count/composition constant across revisions. It measures RAF interval and synchronous JavaScript render submission; it does not measure GPU execution time. It is distinct from the real simulation/screenshot fixtures and ships only as a development script.

Baseline was measured before changing World/VFX. Raw baseline logs, verification/build measurements and `vfx-performance.json` are retained under `logs/baseline/` in the archive. Packaging reruns the final diagnostic; exact final samples appear in `reports/PERFORMANCE-MEASUREMENTS.json`, the manifest and `logs/vfx-performance.log`. Baseline/final browser, viewport, seed, hazard count and GPU must match before packaging.

## Initial matched comparison

Recorded baseline 10:33:48 UTC and implementation 10:44:05 UTC on 2026-10-22:

| Metric | Desktop before → after | Mobile emulation before → after |
| --- | --- | --- |
| Median RAF interval | 16.7 → 16.7 ms | 16.7 → 16.7 ms |
| p95 RAF interval | 16.8 → 16.8 ms | 16.8 → 16.7 ms |
| Median CPU render submission | 2.3 → 2.1 ms | 1.8 → 2.0 ms |
| p95 CPU render submission | 3.1 → 2.7 ms | 2.3 → 2.5 ms |
| Draw calls | 36 → 43 | 36 → 43 |
| Resident geometries | 30 → 34 | 30 → 34 |
| Resident textures | 1 → 1 | 1 → 1 |

The extra seven draw calls and four geometries buy distinct star layers, a sky plane, atmosphere and propulsion ribbons. The existing texture count is unchanged: no VFX texture is allocated. Similar frame intervals and small CPU differences show no material local regression in this short sample; they do not prove an optimization or performance on physical phones.

## Resource and build checks

Existing all-model restarts warm the impact resources before sampling. Five restarts retain 37 geometries / 1 texture in that fixture; collider mode retains 39 / 1 and its original 73-child root. The separate VFX lifecycle fixture retains 28 / 1 and the same trail/particle resource identities, one trail emitter and six total GLB downloads. Counts differ by which assets were uploaded/visible; do not compare different fixtures as an optimization claim.

Baseline production size: 730,988 bytes over 11 files, JavaScript 637,927 bytes (Node gzip 161,785). Pre-commit full verification measured 742,461 bytes over 11 files, JavaScript 649,400 bytes (Node gzip 165,472): an 11,473-byte / 1.57% total increase. Exact committed production file sizes and gzip values are regenerated into the manifest. No dependency, texture package or post-processing framework was added. The existing Vite >500 kB chunk advisory remains visible and its threshold is unchanged.

## Limits

Short desktop-GPU samples, one browser, no GPU timer queries, no sustained thermal/battery/heap profiling, no physical phone or Safari/Firefox measurements. Lower mobile counts reduce submitted particles/transparency work; geometry allocation intentionally remains stable. Driver scheduling and system load affect CPU timings. Broader hardware validation remains a later task.
