# B-1 actual distribution and performance

Local Node 24.11.1/win32/x64; installed Chrome renders plots. Raw output: `.cache/review/GAMEPLAY-001B-1/final/field-foundation-metrics.json`, packaged under `logs/`. Full seed42 old/new observations are separate JSON files. Reruns record actual new timing/memory in final logs; representative timing below is the first successful local run, preserved in `logs/attempts/field-foundation-first-run.log`, not a fixed guarantee.

## Comparable spatial windows

Same research corpus: `0,1,2,3,7,11,23,42,64,127,255,1024,4096,65535,2147483647,4294967295`.

Both datasets count pass-distance centers in[0,19200),307,200 total units. Old observations call real ObstacleField at120Hz for600s with production end-step speed, then filter this window. New observations build800 ownership cells per seed without player, bootstrap, warmup, director, acceptance or death. A second[4200,19200) window is in raw data. Old startup sparsity versus a raw ambient stream is a methodological difference; these are spatial distributions, not realized run difficulty. Original001A whole600s rate9.3130 has a different denominator and is retained historically.

| Metric | Current production, matched window | B-1 ambient proposals |
| --- | ---: | ---: |
| Objects |28,403|12,794|
| Objects/100 world units |9.24577|4.16471|
| Same-depth adjacent fraction |82.3088%|0%|
| Depth gap min/median/p95/max |0/0/60.0667/131.6178|12.1320/23.9444/32.2842/35.8755|
| X min/max |−4.34997/+4.34996|−5.39808/+5.39857|
| Y min/max |−2.59996/+2.60000|−3.14936/+3.14980|

All 12 X/Y histogram bins are occupied. Across 12,800 cells: 3,209 empty, 6,388 single, 3,203 double. Transaction maxima for 2/3/4/5/6 cells: 3/4/5/6/7. Maximum tested adjacent context is 6; general cap 32 and buffer cap 12 are independently tested, including rejection. Zero separation failures: depth gaps already exceed the max outer-radius pair plus 0.3, so ordered consecutive pairs also bound non-adjacent pairs. Applying the same new object-to-object screen to the old stream finds 491 violations among 67,307 broad-phase pairs; this is not a failure of the old player-corridor contract. Exact reverse replay/reset passed all 16 seeds; unit stress additionally checks 256×1024 cells.

Actual plots: `field-actual-depth.png` (seed42 X/depth in[0,720)), `field-actual-xy.png` (first2000 old/new points; full-corpus histograms in JSON), `field-actual-gaps.png` (full-corpus normalized histograms). Every mark comes from data. The old histogram's last bin includes ≥69-unit gaps; raw max remains131.6178. These are distribution plots, not game screenshots or route certificates.

## Timing and retained memory

After 1000 warmups, 10,000 six-cell generation calls measured median 0.0020 ms, p95 0.0034 ms, max 0.0756 ms. Inspection measured median 0.0044 ms, p95 0.0061 ms, max 4.6069 ms. Calls include timer overhead, allocation and GC; inspection includes the diagnostic assertion. No speedup versus old 120 Hz simulation is claimed: it does different work. No trajectory or browser frame cost is measured.

A fresh child runs `node --expose-gc --experimental-strip-types scripts/field-foundation-benchmark.mjs --memory-child`. After1000 warmups and8×10000 six-cell transactions, GC/reset at each boundary, retaining only last snapshot, heap moved50,303,864→50,310,400 bytes (+6,536). Peak snapshot7 records, last5. All nine samples are in JSON. Node/Playwright imports contribute overhead; this is **not** a512KiB planner measurement or allocation-free generation. The4MiB finite-run guard catches obvious retained growth, not indefinite leaks or callers retaining every snapshot. Generator state retains only settings/provenance, with no history/cache.

## Bypass and production boundary

The old proof relies on band-limited centers; new sampling covers intended XY continuously. Round variants can intersect X±2 and side boundaries: nearest allowed center is0.6 from X±6, less than radius0.65+ship0.42. Y residual0.45 likewise does not reserve a safe tube. Actual round-sphere center-pass intersection counts at X−6/−2/0/+2/+6,Y0:117/524/493/487/119. These geometric probes are **not** full rotating-proxy replay or proof every seed eventually hits every line. Temporal gaps, state-veto exploits and human steering remain separate questions.

Production stays15 files/931,609 bytes. Protected sources, absent imports and output filenames/sizes match approved research build's available local manifest. Fresh SHA256s are recorded; unavailable historical bundle hashes are not invented. Pool72 and model/font/audio/VFX ownership are unchanged. Browser checks establish regressions, not performance of future live field rendering. The Three.js advisory persists.

B-2 still needs actual-state trajectories, replay, rotating colliders, tail/work/deadline/hardware benchmarks. Later milestones own atomic publication, bootstrap, director/patterns and playtests. Candidate density/regularity does not establish safety, fun or release readiness.
