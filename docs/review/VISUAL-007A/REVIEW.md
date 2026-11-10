# VISUAL-007A — mine and installation fragments

Feature branch: `codex/visual-007a-mine-structure-polish`. Baseline: public
`d5b02d8`. This task does not merge main or publish a deployment.

## Visual changes

The mine keeps the licensed CC0 core, now surrounded by eight angular armor
segments, sensor collars and distributed emitters. Low cyan signals identify
the waiting object, amber pulses identify the existing warning interval, and
red signals identify pursuit/coast. Signal animation reads simulation elapsed
time, freezes on pause and becomes steady with reduced motion. The original
mine motion, activation ticks, collider and admission logic are unchanged.

Stations use graphite load-bearing bodies, navy clipped armor cassettes,
asymmetric spacing, exposed cooling channels, diagonal tension members,
maintenance markings and restrained cyan corner lights. Amber/black edges
identify the real flight opening. Four exact box bodies and all five original
aperture positions remain. Cosmetic relief extends at most 0.10m in Z; every
detail remains on a solid XY footprint, outside the aperture. No extra lights,
textures or postprocessing are added. Five merged detail batches plus four body
meshes replace the larger flush-paint material set; pooled clones share them.

All added geometry is original CC0 work. The original mine GLB, Kenney models,
fonts and license notices remain unchanged; see [asset provenance](../../ASSETS.md).

## Local owner review

From this branch, run `npm run dev` and open the printed local URL. Ordinary
Launch uses the new art. WASD/arrows or dragging steer; Escape/P pauses and
resumes; restart is available from pause/results. No debug URL is necessary.

The local comparison is `.cache/review/VISUAL-007A/compare.html`; the review ZIP
contains the same comparison at its root. It includes matched before/after
screenshots, original-resolution PNGs, four videos per source, source/behavior
receipts, raw performance samples, check logs, source from the delivered Git
commit and a binary patch from the baseline. ZIP CRC, inventory and SHA256 are
verified by `scripts/visual007-package.py`. Untracked user work, dependencies and
build output are excluded.

Recordings use the actual production app, ordinary Launch, reproducible seeds
and steering inputs. CDP observes the existing game instance; it does not insert
objects or edit simulation state. Prefixes run accelerated, then clips play
through native browser frames at two 120Hz simulation steps per frame. Still
captures pause simulation for orientation changes. The long mixed clip spans
two naturally occurring encounters. Boards only scale and label original
screenshots. The autopilot is not a human playtest or owner acceptance.
Video prefix holds were shortened by keyframe-aligned stream copies; some cold
lead remains. Three frames from each delivered video were decoded successfully.

## Reproduction

```powershell
node scripts/visual007-review.mjs freeze
node --experimental-strip-types scripts/visual007-scenarios.mjs
npm run build
node scripts/visual007-review.mjs capture before
node scripts/visual007-review.mjs capture after
python scripts/visual007-videos.py
node scripts/visual007-review.mjs performance before
node scripts/visual007-review.mjs performance after
node scripts/visual007-verify.mjs
python scripts/visual007-package.py
```

Run performance commands sequentially with other test/capture processes idle.
The package command requires all tracked changes committed on the feature
branch. Local Chrome, installed dependencies, Pillow and the existing
Playwright FFmpeg installation are used; no downloads are performed.

## Executed verification

- `npm run typecheck` and `npm run build`: exit 0. Production JS approximately
  808.73kB / 215.45kB gzip, versus frozen baseline 806.61kB / 214.71kB.
- Final `npm run test`: 304/304, zero skips or failures. Three new tests check
  all-variant solid/aperture bounds, mine sphere containment/resource disposal,
  and actual reveal-material phase updates/pause/reduced motion.
- Full two-worker browser run: 102/105. The obsolete removed-lamp assertion was
  updated to check the new idle/amber signals while retaining exact warning-tick,
  hull, opaque reveal and pause assertions. The long integrated test timed out
  at its UI step after reaching 2200m; passive audio seed11 ended at 366m instead
  of reaching Phase 2 during this run. No gameplay source or safety budget was
  changed to address either. All three passed in an isolated one-worker repeat:
  3/3. Logs retain both runs; this is aggregate scenario coverage, not a claim of
  one clean 105/105 full run. Scheduling-sensitive native timing remains a limit.
- `node scripts/visual007-verify.mjs`: 119 baseline runtime/asset/build inputs
  unchanged, nine paired captured gameplay states exactly equal, and three
  performance endpoint states exactly equal. Only two existing presentation
  entry points change; three new presentation modules are added.
- Source credential-pattern scan and module/build analysis: exit 0.
  `git diff --check`: exit 0. Eight delivered videos have three decoded PNG
  samples each. An initial FFmpeg null-muxer attempt failed because the bundled
  executable omits that muxer; PNG sampling replaced it without downloads.

## Measured performance

Chrome, sequential baseline then candidate, 900 native frames per viewport:
5400 measured frames total. The input tape and start/end states match. Each of
the six cases also completes ten real UI restarts with stable graphics counters.

| Viewport | RAF p95 before → after | Render callback p95 before → after |
| --- | --- | --- |
| 1280×800 | 17.0 → 17.0ms | 5.8 → 3.6ms |
| 390×844 | 16.9 → 16.9ms | 5.4 → 3.2ms |
| 844×390 | 16.9 → 16.9ms | 3.5 → 5.8ms |

Maximum scene calls remain 48, with median 38→35. Maximum scene triangles rise
7936→12928. End-of-sample scene/reveal materials fall 338→224, uploaded geometries
44→43, textures stay 1 and warmed programs stay 15. A standalone station changes
12→9 calls, 12→6 materials, and 224→4568–4640 triangles. Its five shared variant
geometries use about 2.20MB of attribute/index data versus 78.4kB previously;
clones borrow those buffers. There is no per-spawn resource allocation.

The landscape render callback regresses by 2.3ms at p95 in this sample, while
desktop and portrait are lower and native frame p95 remains unchanged. This
single sequential comparison does not isolate causality or establish a speedup;
the extra mesh detail has a real bounded geometry cost. The callback includes
render/update/planning bookkeeping and is not a GPU timer. Occasional stalls
remain (desktop RAF max 97.1ms before / 55.6ms after; see raw samples). These are
desktop Chrome measurements, not physical-phone guarantees.

## Limits

Phone orientations are browser emulation; physical phone performance and owner
comfort remain unverified. The waiting mine is deliberately distant and only
briefly precedes warning in the sampled integrated encounter. Its publication
and reveal timing were not extended for photography. The existing large Vite
bundle warning remains. State-color review does not alter warning duration,
mine steering, spawning, damage, pickup assistance or collision calibration.
