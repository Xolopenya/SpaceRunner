# UI build and performance evidence

The fresh approved baseline is **758,188 bytes / 11 output files**, including 662,310-byte JS (Node gzip 169,374). No dependency changes are made. Production adds only the two used TTFs (**157,232 bytes**) and their complete notices (**8,840 bytes**), plus the UI markup/styles/HUD adaptation. Unused bold font, concept PNGs and review tooling remain outside the build.

The verified production build is **931,551 bytes / 15 files**, an increase of **173,363 bytes / 22.86%**. Fonts/notices account for 166,072 bytes of that increase; UI JS/CSS/HTML account for 7,291 bytes. JS is **663,045 bytes / Node gzip 169,576**, CSS **14,479**, HTML **7,627**. Per-file sizes/hashes and the final rerun evidence are generated into `UI-PRODUCTION-DIAGNOSTICS.json` and the package manifest. Build measurements use actual dist files; no rounded estimate is substituted for byte counts. Vite's existing Three.js chunk advisory is unchanged.

## Matched render sample

`vfx-performance.mjs` uses the same Chrome/GPU, desktop 1280×800 DPR1 and mobile emulation 390×844 DPR2/effective1.4, seed42, six held hazards, speed34 and 60 warmup + 180 measured RAF frames. Baseline medians were **16.7ms** in both viewports, with **43 draw calls / 34 geometries / 1 texture**. The baseline and final JSON are packaged together and fixture identities are checked. These are local RAF/CPU submission samples, not GPU timer queries or physical phone/thermal measurements.

The pre-commit matched final sample retained **16.7ms median / 17ms p95 RAF** and **43 draw calls / 34 geometries / 1 texture** in both viewports. CPU submission medians were 1.7ms in both, versus baseline 3.2ms desktop / 2.9ms emulation; this noisy short sample establishes no optimization claim. The packaging rerun records its own exact timings. World, its camera/quality policy, input and audio implementation are unchanged. Existing keyboard and actual touch tests exercise input responsiveness in the moving game. Matched render sampling does not itself benchmark all DOM painting; the ordinary browser regressions and UI captures run the complete app.

## HUD work

HUD caches unchanged score, hull, hit state and speed. It does not query layout or create menu trees in animation frames. The pre-commit diagnostic ran 5,000 actual HUD updates against a frozen model: **0 DOM mutations**, **141 nodes before/after**, average **0.00036ms** per call (timer-limited). This microbenchmark verifies a stable cached frame; it excludes changing values, audio/rendering and DOM paint, so it is not a whole-game FPS or optimization claim. The packaging rerun records its own measured values in the generated diagnostics.

Physical devices, long sessions, memory/thermal/DSP profiling and broader browser support remain unverified. No quality downgrade, physics change, warning-limit adjustment or new UI framework is used to satisfy this task.
