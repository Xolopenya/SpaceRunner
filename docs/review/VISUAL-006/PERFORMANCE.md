# Actual Chrome measurements

Chrome157.0.8103.38,local sequential headless runs,600 native frames/case,two120Hz simulation steps/frame. Twelve cases =7200 RAF intervals. Exact recorded seed42 inputs/ticks2800..4000 cover Phase2,station passage and a mine warning. All12 authoritative endpoint hashes match. No video encoding or test suite ran concurrently with the primary measurement.

| Viewport | Mode | RAF ms p50 /p95 /p99 /max | Field update p95 ms | Render callback p95 ms |
| --- | --- | --- | ---: | ---: |
|1280×800|legacy|16.7 /17.2 /17.5 /37.0|0|4.0|
|1280×800|fragmented-arcs|16.7 /17.1 /17.3 /17.6|0.4|2.9|
|1280×800|flowing-filaments|16.7 /17.1 /17.3 /17.8|0.5|3.0|
|1280×800|fragmented-warp|16.7 /17.2 /17.3 /17.6|0.5|2.8|
|390×844|legacy|16.7 /17.1 /17.3 /17.9|0|2.6|
|390×844|fragmented-arcs|16.7 /17.1 /17.3 /18.1|0.6|3.1|
|390×844|flowing-filaments|16.7 /17.1 /17.4 /19.0|0.5|3.2|
|390×844|fragmented-warp|16.7 /17.0 /17.2 /20.3|0.6|3.0|
|844×390|legacy|16.7 /17.0 /17.3 /24.7|0|2.8|
|844×390|fragmented-arcs|16.7 /17.1 /17.3 /18.5|0.6|3.0|
|844×390|flowing-filaments|16.7 /17.1 /17.6 /26.8|0.6|3.2|
|844×390|fragmented-warp|16.7 /17.1 /17.7 /90.1|0.5|3.1|

Small p95 differences are measurement noise;no speedup is claimed. New policies use one draw instead of four surfaces. Maximum complete-scene calls51→48;warmed GPU geometries48→45,one texture,338 scene/reveal materials and15 shader programs in every case. Allocated material count includes both hidden legacy resources and the one new material. New selected fragments with center inside the envelope peak at19/26/33 for A/B/C,before local clipping. Zero independent particles;the8 C streaks are ribbons. Legacy field count is0 because that root is hidden;raw diagnostic segments retains its preallocated invisible pool count.

Each case executes10 actual UI restarts:120 total. Geometry/texture/program counts remain stable. Post-GC heap deltas over playback plus resets:approximately1.342–1.364MB,including model lifecycle and renderer caches. These are finite samples,not isolated field retention or proof against every leak. Disposal emits each new geometry/material event once,including a second idempotence call. After complete Game disposal all cases have0 geometries,1 texture and1 program remaining in renderer.info,including legacy. No new texture is owned by this field. The initial zero-total-textures assertion was corrected against this measured baseline;the residual's exact Three.js ownership was not established and is not claimed to be a new-field leak.

Cold first full-scene draw times,legacy/A/B/C respectively:desktop251.3/61.8/45.6/45.6ms,portrait48.9/48.3/46.4/49.4ms,landscape52.8/51.2/47.4/45.3ms. These include all initial scene shader compilation/driver state,not isolated field compile time. The first case has cold-cache/order bias;these values do not establish a shader compilation speedup. Warm sampling starts after the accelerated prefix.

Spike investigation:landscape C's90.1ms RAF interval is sample233. The preceding render callback took1.8ms and field update0.1ms;the next took2.7/0.2ms. Further28.8/29.0/37.1ms intervals cluster at237/239/240,with field update0.2–0.4ms and32 draw calls. Legacy desktop also has37.0ms and a22.6ms render callback before a24.8ms interval. The recorded field CPU kernel does not explain the90ms gap. Host scheduling,simulation work,driver/GPU and GC were not separately traced,so the exact cause remains unassigned. RAF p95 remains stable;strict frame deadlines and absence of stalls are not claimed.

Raw per-frame arrays,cold draws,resets,disposal receipts,heap observations and full endpoint states are in`logs/warp-performance.json`;progress and cleanup records retain the actual diagnostics. Physical phones and GPU timers remain unverified. Vite's existing>500kB chunk advisory remains;no dependency,texture or postprocessing pass was introduced.

Final verification:all9 checks exit0,typecheck,301 unit tests,build,105 browser tests,Git whitespace,source safety,build analysis,collision audit and117-file preservation. Full browser verification uses two workers with zero unexpected/flaky/skipped results;exact elapsed time is retained in the raw receipt. The initial104/105 run and its ResizeObserver timing failure remain in browser-first-complete.log/json;the final test retains the same exact aspect/FOV conditions and waits for the real resize notification.306 runtime/assets/test/script/config hashes are identical before/after verification and are checked against final committed blobs by packaging. Report-only edits follow the checks;their metadata is distinguished from the execution Git HEAD.
