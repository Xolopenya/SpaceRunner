# Matched production performance

Approved a5906ef and release candidate are built separately for /SpaceRunner/ from canonical committed bytes. Six sequential cases use identical seed42 inputs/ticks2400..3600:Phase1,500m transition,station and mine.600 native RAF frames/case,3600 total. No concurrent test or video workload. All production JS hashes and authoritative endpoint hashes match.

| Source /viewport | RAF ms p50 /p95 /p99 /max | Warp CPU p95 ms | Planning frame max ms | Render callback p95 ms |
| --- | --- | ---: | ---: | ---: |
|approved1280×800|16.7 /17.1 /17.4 /33.9|0.8|23.3|5.6|
|approved390×844|16.7 /17.1 /17.8 /26.5|0.8|18.2|5.3|
|approved844×390|16.7 /17.2 /17.8 /27.1|0.8|20.1|5.4|
|candidate1280×800|16.7 /17.0 /17.6 /36.2|0.7|25.6|5.0|
|candidate390×844|16.6 /17.2 /17.6 /31.3|0.8|21.2|5.6|
|candidate844×390|16.7 /17.1 /17.5 /26.3|0.8|18.0|5.2|

Planning p95 is0 because most sampled frames have no planner work;the maxima describe the sparse actual gates. Maximum candidate simulation cost27.0/23.5/20.1ms includes planning. Warm Long Task observer records zero tasks≥50ms in all six cases. This does not rule out OS/driver stalls. The largest current candidate RAF gap36.2ms accompanies a sparse planning gate;per-frame simulation,render and warp arrays are retained for correlation.

Cold first full-scene draw:approved164.3/78.6/73.7ms,candidate79.0/77.1/78.7ms. This includes all shaders/driver/JIT and has order/cache bias;no isolated compile speedup is claimed. One additional warmed shader event per case is recorded as the encountered object/material appears. Warm totals are15 programs,338 materials,44 uploaded geometries,one texture;maximum48 draw calls.

Ten actual UI resets/case =60 resets. Resource counts remain stable. Post-GC heap differences over playback and resets are about1.509–1.516MB,including model and renderer caches,not isolated field retention or a universal leak proof. The prior approved post-dispose residual of one renderer texture/program is not reclassified as a new release leak.

The first diagnostic used Windows working-copy versus LF build inputs and observed a140.3ms approved portrait RAF gap without a≥50ms main-thread task. It remains in release-performance-first.json. The canonical repeated sample above removes the line-ending artifact from bundle identity,not a claimed frame-stall fix. VISUAL-006's earlier90.1ms gap is likewise not claimed eliminated. No systematic performance regression is demonstrated;runtime source and final JS are unchanged. No GPU timer,physical phone or thermal test was performed.
