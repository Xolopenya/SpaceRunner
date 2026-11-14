# Verification

Final runtime milestone: c956157, following isolated mine milestone e61b7ef.
The delivery commit adds review evidence tooling/docs. Exact final identity and
canonical-source hashes are in git/identity.json and manifest.json in the ZIP.

| Gate | Result |
|---|---|
| TypeScript strict typecheck | Pass |
| Node unit suite | 334/334, no skipped tests |
| Full native Chrome browser suite | 115/115, no skipped/flaky tests |
| Production build | Pass; existing large-bundle advisory remains |
| Source stability during final full suite | Before/after hashes match |
| Preserved baseline inputs | 131/140 unchanged; nine existing presentation/audio extensions |
| Matched production captures | 38/38 identical gameplay/cinematic endpoints |
| Approved shield/ship PNGs | 26/26 byte-identical |

Six added unit cases cover future-versus-active pressure, score chapters/grids,
buffer/source preservation, accepted damage/muted intervals, visual-clock fatal
phases/skip and priority/variant allocation. The existing complete IntegratedModel
state comparison now also runs the read-only AudioManager/pressure observer on
one of the two models. It still compares ship, HP, immunity, hazards, ledger,
certificate, publication history, pickups/rewards and mine state for two seeds.

The added native test verifies three 64-second/11025 Hz buffers, their identical
explicit start time, one AudioContext, four looped buffers including engine rush,
six permanent sources, twenty reset/mute cycles and priority under saturation.
Old exact-source expectations change only from four to six permanent sources and
two to four looping buffers, as required by the three-stem design. Original
distance, collision, HP, pause and restart assertions remain.

The production seed11/no-steering smoke passes in both completed C suite runs.
It previously failed intermittently during001B1. No gameplay or timeout change is
claimed to fix it. A bounded exact001B1/currentC comparison is included separately;
its raw outcomes are retained even if a passive route fails. Fixed-cadence
preservation and endpoint hashes are stronger evidence for this task's unchanged
simulation than treating one passive route as a universal survival guarantee.

## Attempts retained

1. First complete run: 113/115. Two audio tests completed their behavioral
   assertions but failed writing JSON into a missing REVIEW_RESULT_DIR. Initial
   logs, JSON, screenshots and traces are preserved. This was a runner setup error.
2. The next run was interrupted after a source edit caused a Vite page reload
   during the left-wing pickup fixture. The trace shows two Vite connections and
   the reset page; this attempt is not counted as a completed suite.
3. Final run used a precreated result directory and immutable runtime/test inputs:
   115/115 in 11.6 minutes. The wrapper records all input hashes and fails if any
   change during execution. No assertion, timeout or skip was used to suppress
   either earlier problem.

## Reproduction

With the specified base commit, installed project dependencies and Chrome:

```powershell
node --experimental-strip-types scripts/damage-scenarios.mjs
node scripts/feedback-audio-capture.mjs freeze
node scripts/feedback-audio-capture.mjs baseline
npm run typecheck
npm test
npm run build
node scripts/feedback-audio-capture.mjs final
node scripts/feedback-audio-verify.mjs full-browser-final
node scripts/feedback-audio-performance.mjs
node scripts/feedback-audio-render.mjs baseline
node scripts/feedback-audio-render.mjs final
node scripts/feedback-audio-live.mjs
node scripts/feedback-audio-live.mjs steering
node scripts/feedback-audio-live.mjs endurance
node scripts/feedback-audio-playback.mjs
python scripts/feedback-audio-analyze.py
node scripts/feedback-audio-passive.mjs
node scripts/feedback-audio-preservation.mjs
python scripts/feedback-audio-package.py
```

Run browser/performance commands sequentially with other heavy work idle. Do not
edit runtime sources during a Vite test run. Native Chrome/local servers require
this host's ordinary approved execution; nothing downloads an asset or dependency.
Signal analysis additionally uses the already available Python/NumPy environment;
they are review tools, not runtime dependencies. Packaging requires a clean tracked
tree and committed review files; it validates exact Git blobs, test input hashes,
complete forward/reverse patch trees, ZIP CRC and SHA256 inventory.

## Playback and limitations

The exact frozen baseline and final passive production comparison each passes
1/1 with the original seed11/no-steering route and its normal distance/HP/phase
assertions. This bounded sample does not establish a general fix for the earlier
intermittent result. Both bundles and test-source hashes are recorded.

Ten delivered-media playback checks pass. The first player fixture reset requested
seeks to the beginning (for example requested13s, actual end0.73s); its failure log
and measured ranges are retained. The final fixture loads the exact local bytes
as seekable Blob URLs and checks actual start/end times before applying the same
silence threshold. The original PCM pause RMS at9s is1.85e-6, mute at13s is0.
This was a review-player fixture issue, not a production pause failure.

The actual graph produces WAVs, live Opus and canvas/audio clips. The delivered
media are decoded and played through native browser audio with analyser checks.
Pause/mute silence, headroom, loop seams and long playback are measured. This is
automated output validation, not independent human artistic/fatigue acceptance.
Owner listening remains explicitly pending. Physical phones, iOS/Safari,
Bluetooth latency, Yandex SDK audio policy and publication were not tested.
No deployment, push or merge is part of this task.
