# Bounded rendering and comparable measurements

No new texture, dynamic light, postprocess or runtime fracture. Three collision slots
and all001B particle/debris caps remain:12/6 collision fragments,64/28 sparks (12
reduced), six hull sections,12/6 small ship fragments,96/40 death points. New sphere
surfaces share32×20 topology. The field/fatal surface share one geometry. Six identical
hull materials become one. Secondary flares are capped at3 desktop /2 mobile /1
reduced;24 existing owned line segments serve both pre-breakup and short breakup arcs.

Safe work reductions: do not iterate/upload the legacy orange particles while hidden
in production surface-only mode; update only the selected mobile point range; reuse
the existing arc buffer; share identical hull material state. These changes are small
and visible-quality preserving. Ownership/reset/disposal and first-use shader warmup
are tested. They do not justify a claim of a general performance improvement.

The new sequential production comparison uses the exact001B Git source and final
build, same Chrome/seed42/Hybrid/cadence and desktop1280×800 /portrait390×844. Cases:
ordinary flight600 native frames; shield240; accepted mine240; death300; extended
certificate-following flight3600 (one minute). Each frame advances two120Hz steps.
Before/after each case,180 native RAF callbacks do no simulation or rendering, to
help separate frame scheduling from application work. Visibility and GPU/browser/
CPU/RAM environment are retained. This is not a physical-phone benchmark.

Each death case additionally replays30 natural three-hit deaths/restarts, collecting
GC heap, resource/program counts and subscriptions. A final presentation advance,
1.6s audio settling and another GC distinguish short-lived cleanup from retained heap.
Comparisons hash ship/time/distance/HP/phase, hazard/reward slots, reward counts,
publication decisions and current mine. This is a broad observable endpoint, not an
exhaustive dump of private planner/RNG internals; protected source and determinism
tests additionally cover the unchanged gameplay modules.

Raw `effects.particles` counts selected collision point draw ranges, not shader-lit
pixels or all engine/ship particles; death point caps are stated above. `field` is
the authoritative cooldown flag (GAME_OVER suppresses the visible field), while
`death` and `fragments` describe active presentation and its six large hull sections.

The001B30FPS and JS-heap observations remain open until the new raw controls/samples
support a specific conclusion. Stable GPU counters alone cannot prove absence of JS
retention, and a short desktop sample cannot guarantee phone/thermal performance.
Final measured receipts follow.

## Recorded comparison

Windows x64; AMD Ryzen 5 4600H with Radeon Graphics, 12 logical CPUs, 15.42GiB RAM. Chrome 157.0.8103.78, headless. GPU: `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001636) Direct3D11 vs_5_0 ps_5_0, D3D11)`.

19,920 native measured frames across20 cases,7,200 idle-control callbacks and120 natural death/restart replays. Every paired serialized gameplay endpoint matches. Both extended runs keep3HP through1600m in both viewports.

| Scenario / width | FPS base -> final | RAF p95 ms | CPU+submit p95 ms | Max calls |
| --- | --- | --- | --- | --- |
| flight /1280 | 60.1 -> 60.1 | 17.2 -> 17.3 | 5.6 -> 5.3 | 32 -> 32 |
| shield /1280 | 60.3 -> 60.3 | 17.3 -> 17.3 | 6.1 -> 5.6 | 36 -> 36 |
| mine /1280 | 60.4 -> 60.2 | 17.3 -> 17.2 | 9.0 -> 8.9 | 41 -> 40 |
| death /1280 | 60.3 -> 60.2 | 17.1 -> 17.3 | 3.6 -> 3.9 | 35 -> 37 |
| extended /1280 | 60.0 -> 60.0 | 17.2 -> 17.3 | 5.9 -> 6.6 | 48 -> 48 |
| flight /390 | 60.0 -> 60.0 | 17.3 -> 17.3 | 5.0 -> 5.4 | 32 -> 32 |
| shield /390 | 60.0 -> 60.5 | 17.3 -> 17.4 | 5.8 -> 5.9 | 36 -> 36 |
| mine /390 | 60.4 -> 60.3 | 17.3 -> 17.3 | 8.5 -> 9.1 | 41 -> 40 |
| death /390 | 60.1 -> 60.1 | 17.2 -> 17.1 | 3.6 -> 3.8 | 35 -> 37 |
| extended /390 | 60.0 -> 60.0 | 17.3 -> 17.3 | 5.9 -> 5.9 | 48 -> 48 |

These sequential samples are descriptive, not a statistical speedup claim. The desktop extended CPU p95 changes5.9->6.6ms; portrait remains5.9ms. The extra shaders/secondary composition add work; sharing materials is not presented as a general CPU optimization. Raw arrays retain every frame/outlier.

The largest measured active RAF interval is 33.2ms baseline and 25.5ms final. Frame averages alone do not establish absence of stalls.

| Scenario endpoint | GPU geometries base -> final | Textures | Programs base -> final |
| --- | --- | --- | --- |
| flight | 52 -> 51 | 1 -> 1 | 21 -> 26 |
| shield | 52 -> 51 | 1 -> 1 | 21 -> 26 |
| mine | 55 -> 54 | 1 -> 1 | 21 -> 26 |
| death | 46 -> 45 | 1 -> 1 | 21 -> 26 |
| extended | 78 -> 77 | 1 -> 1 | 22 -> 27 |

Five extra warmed programs are the shader composition cost. One fewer resident geometry reflects shared surfaces. Extended flight adds an original reveal/program variant in both versions. Endpoint counts depend on scene lifetime; compare like phases, not death endpoints with in-flight counts. All30 restart samples per case keep identical geometry/texture/program counts and one subscription within each version.

| Version / width | GC heap after1 | After10 | After20 | After30 | Settled |
| --- | --- | --- | --- | --- | --- |
| baseline /1280 | 11,868,584B | 12,429,960B | 12,513,584B | 12,539,056B | 12,544,236B |
| baseline /390 | 11,792,360B | 12,366,136B | 12,449,812B | 12,475,904B | 12,481,276B |
| final /1280 | 11,846,592B | 12,418,100B | 12,526,752B | 12,551,496B | 12,556,564B |
| final /390 | 11,874,576B | 12,421,880B | 12,533,328B | 12,559,496B | 12,564,756B |

Heap growth is concentrated in early replays: roughly0.55MiB through the first ten, then0.08-0.11MiB through20 and about0.025MiB through30 in both versions. Settling does not remove all retained growth. Final-minus-base settled usage is about12KiB desktop and82KiB portrait in this sample. The decreasing increments are consistent with warm caches/JIT bookkeeping, but retainers were not isolated; this is not a proven explanation or proof of zero leak. GPU/subscription bounds are stronger directly observed evidence.

## Prior30FPS observation

It did not reproduce as a sustained30FPS application run here: active scenarios average60.0-60.5FPS. Idle controls with no render/step show RAF p95 17.1-31.2ms and mean 59.8-60.6FPS; every page is visible. This shows scheduling variability without game work, not the cause of the old sustained shift. Background throttling, VSync, power state or a specific browser policy were not conclusively identified. No30FPS fix is claimed.

Startup warmup cost, long-duration beyond these minute/cycle samples, physical phone thermal/GPU behavior and subjective comfort remain unmeasured. The existing production bundle-size advisory also remains.

CPU+submit timing is not a GPU timestamp measurement; renderer counters are not VRAM
byte measurements. Shader GPU energy/thermal cost was not independently isolated.
