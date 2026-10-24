# Performance under actual rendering

## Method and retained attempts

Numbers below quote the frozen-source precommit continuation in logs/baseline/precommit-runtime-browser.json and its raw eight cases. Installed Chrome155.0.8059.85, Windows desktop, ANGLE AMD Radeon(TM) Graphics / Direct3D11. Viewports1280×800 and390×844 touch emulation; this is **not a physical phone**. Each case runs about12 real-time seconds with the original RAF loop,120Hz physics, actual World/GLB/VFX rendering and native audio running. Measurements begin before Launch and retain cold-start frames. Old/new early cases use real keyboard/CDP touch changes every0.2s. Event-to-motion latency is from browser event timestamp to observed Ship change, not hardware-to-photon latency.

Established cases first reach distance4200 by accelerated **actual** model/causal steering with real frame callbacks, then resume ordinary RAF/input/render/audio for measurement. New follows only an already published witness; old follows its visible wave corridor. These are source-specific research actors, **not a matched-human-input performance comparison** or an input-latency claim. No teleports, hull edits or immunity changes are used.

An initial post-Launch-only profile missed cold initialization; retained logs are historical partial observations, not evidence for a smooth first frame. A later whole benchmark completed its2632 logical cases but failed during browser profiling after source edits caused Vite/HMR to reset the profiling object. That command exited1 and is retained. The frozen-source standalone browser continuation exited0 with all eight cases and decoded changing video frames. Exact committed packaging reruns the full pipeline without source edits. Authored precommit timings and exact-HEAD timings need not be identical.

## Frame intervals (milliseconds, including cold maxima)

| Case | p50 | p95 | p99 | Max | Steady max after first sim second |
| --- | ---: | ---: | ---: | ---: | ---: |
| runtime-old-desktop | 16.7 | 16.8 | 17.1 | 666.6 | 18.4 |
| runtime-new-desktop | 16.7 | 16.9 | 17.1 | 366.6 | 17.2 |
| runtime-old-portrait | 16.7 | 16.8 | 16.9 | 350.0 | 17.4 |
| runtime-new-portrait | 16.7 | 16.9 | 17.1 | 350.0 | 17.3 |
| runtime-old-desktop-established | 16.7 | 16.9 | 17.1 | 17.2 | 17.2 |
| runtime-new-desktop-established | 16.7 | 16.8 | 17.0 | 17.1 | 17.1 |
| runtime-old-portrait-established | 16.7 | 16.9 | 17.1 | 17.5 | 17.5 |
| runtime-new-portrait-established | 16.7 | 16.8 | 17.1 | 17.6 | 17.6 |

No observed long task overlaps measured scheduler work in these eight cases. The cold maxima are still unacceptable as a general smooth-launch claim: old desktop666.6ms, new366.6ms, portrait350ms each. A separate native Launch CPU sample identifies synchronous musicSamples187.276ms, frequency68.032ms and createContext51.561ms self samples; renderer compilation, JS/program/native and planner samples also exist. This is bottleneck evidence, not exclusive attribution of the whole stall to audio. Audio is unchanged in this task. A separately approved cache/defer/prewarm investigation is appropriate.

## Planner and response (milliseconds)

| New case | Work p50 / p95 / p99 / max | Actual gate p50 / p95 / p99 / max | Total scheduler CPU | Event→motion p95 / max |
| --- | --- | --- | ---: | --- |
| runtime-new-desktop | 2.50 / 3.60 / 4.50 / 6.30 | 3.00 / 3.00 / 3.00 / 4.50 | 654.70 | 14.30 / 14.50 |
| runtime-new-portrait | 2.40 / 3.80 / 5.40 / 7.20 | 2.40 / 2.40 / 2.40 / 4.90 | 662.50 | 3.00 / 5.70 |
| runtime-new-desktop-established | 2.00 / 3.00 / 3.30 / 3.80 | 1.00 / 1.50 / 1.50 / 1.50 | 545.40 | — / — |
| runtime-new-portrait-established | 2.00 / 3.20 / 3.30 / 3.60 | 0.70 / 0.80 / 0.80 / 0.90 | 544.70 | — / — |

Actual per-step and render CPU distributions are in the raw JSON, including maxima; frame intervals are not CPU times. Browser observed active counts≤12 old/≤10 new, one new pending job. The32 logical limit includes retained geometry beyond active visual counts, not just visible asteroids. Every pause snapshot confirms elapsed/distance/planning ticks and schedules remain fixed. New actual-state gates never yield into a subsequent simulation tick. Lead and first-visible/opportunity measurements remain raw rather than inferred from frame averages.

The Node actual-input cohort records159123 nonidle chunks: p502.02, p953.23, p994.29, **max44.60ms**. Gate p500.86, p951.48, p992.04, max4.47. Preparation p950.40, max3.81. Seven>16ms chunks are retained individually; the44.60ms outlier has3072 propagations and zero queries, so the collision-query loop alone cannot explain it. JS runtime/GC/OS scheduling may contribute, but no causal GC trace proves which.

The historical85.95ms B-4 Node observation remains in its original report/raw data. Approved-snapshot reproduction runs the original scheduler/diagnostics and retains all new maxima. It does not establish why a past OS/runtime pause occurred. Bounded work counts are not wall-time guarantees. Actual rendering results above motivate keeping the worker deferred; evidence does not justify a universal main-thread budget guarantee or weaker physics/collision budgets.

## Lifecycle memory and recording

After five warmups, ten real GAME_OVER→Replay resets use the same renderer, pool and audio graph. The separate finite memory phase stops RAF, runs exactly20 real steps/render per sample and uses native CDP GC to improve comparability; it is excluded from FPS measurements. Raw heap/listener/GPU snapshots and cancelled pending sessions are retained. Window/canvas listeners stay7/10, geometries/textures34/1, slots72, pending1 and ownership records1. JS used heap grows from14502424 to14665912 bytes (+163488) in this finite run. Event/sample rings remain bounded. Heap changes are finite/noisy and do not prove indefinite absence of leaks or an exact fixed-byte bound.

The short native MediaRecorder VP8 WebM captures the **actual Three.js canvas**, silent and without DOM HUD. Screenshots contain HUD. Two frames at2.2/4.7s are decoded and verified to differ; runtime-video-frame.png is a decoded preview. Final file size/SHA are in manifest.json; no synthetic frame is substituted. Human audio listening, physical-device thermal behavior, slower CPUs/GPUs, other browsers and long sessions remain untested.
