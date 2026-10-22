# Audio performance evidence

Fresh baseline: approved `4b66af6be11c0afc8b6092cade20af27f5599524`, measured before runtime integration on 2026-10-23 (Asia/Vladivostok; raw JSON timestamps use UTC). The same Chrome 155.0.8059.85 / AMD Radeon via ANGLE-D3D11 machine, seed 42, speed 34, six held visible hazards and 60 warmup + 180 sampled RAF frames are used. Viewports: desktop 1280×800 DPR 1, mobile emulation 390×844 DPR 2/effective 1.4.

| Initial matched metric | Desktop before → audio | Mobile emulation before → audio |
| --- | --- | --- |
| Median RAF interval | 16.7 → 16.7 ms | 16.7 → 16.7 ms |
| p95 RAF interval | 16.9 → 16.9 ms | 17.0 → 17.0 ms |
| Median render submission | 3.0 → 3.2 ms | 2.8 → 2.5 ms |
| p95 render submission | 4.9 → 4.9 ms | 3.9 → 3.6 ms |
| Draw calls / geometries / textures | 43/34/1 → 43/34/1 | 43/34/1 → 43/34/1 |

The final diagnostic adds read-only audio synchronization before World rendering and reports its CPU cost separately (initial p95 0.2 ms desktop, 0.1 ms mobile emulation; median below timer resolution). Both contexts report running. RAF intervals include native audio work; World submission timing excludes the separate audio call. The baseline had no audio subsystem. Raw final measurements are regenerated at packaging time and supersede rounded sample values; see PERFORMANCE-MEASUREMENTS.json and the manifest.

A separate live browser batch measured roughly 0.00042 ms per unchanged-state audio update across 5,000 calls. This is a coarse microbenchmark with native engine updates throttled to 25 Hz, not a complete DSP cost measurement. Cached PCM measured **3,304,856 bytes** across nine buffers. Four native continuous sources plus at most six temporary voices remain bounded. No per-frame sample generation, decoding, context recreation, timer scheduling or asset requests. Startup temporarily allocates waveform arrays while creating the cached AudioBuffers; this is not a heap profile.

Six-voice, all-volume-max native OfflineAudioContext stress rendering caught clipping in an early compressor-based version. It was replaced with explicit peak/headroom budgeting and plain gain routing. The corrected initial stress peak was 0.656; final diagnostics rerender after music balance tuning and require peak below 0.95. Mute-tail RMS is separately checked below 0.00001. These are actual signal checks, not loudness/taste approval.

Baseline production output: **742,461 bytes**, 11 files; JS 649,400 bytes, Node gzip 165,472 bytes. Final pre-commit verification measured **758,188 bytes**, 11 files; JS **662,310 bytes**, Node gzip **169,374 bytes**. Total increase: **15,727 bytes / 2.12%**. The tuned native stress peak was **0.6672304**, with mute tail RMS **0**. Exact committed measurements are regenerated into VERIFICATION.md/manifest.json. Original audio is generated from small source modules, so no audio media files enter dist; preview WAVs are review evidence only. The unchanged Three.js chunk advisory remains visible; no threshold/build-system adjustment.

Limits: one desktop GPU/browser, emulated phones, short samples, no physical speaker listening, phone thermals, Safari/Firefox, native audio-thread timing, sustained heap or battery profiling. A stable median RAF sample does not prove universal 60 FPS or zero audio cost.
