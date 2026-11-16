# Verification

Final runtime, tests and production assets were frozen during the complete run.
`evidence/full-browser/test-inputs.json` records before/after hashes and stable=true;
all244 inputs are checked against canonical packaged Git blobs. Later edits are
review tooling/docs only. Reproduce normal checks with `npm ci`, `npm run test`,
`npm run typecheck`, `npm run build`, `npm run test:browser`.

| Check | Result |
|---|---|
| Unit | 342 passed,0 failed |
| Full native Chrome browser | 118 expected/passed,0 unexpected/flaky/skipped;12.1min |
| Typecheck / Vite build | passed |
| Baseline preservation | 143 checked;138 unchanged;five permitted presentation files |
| Natural screenshot states | 66 baseline/OFF and66 ON/OFF exact gameplay/projection matches |
| Broad gameplay endpoints | 10 baseline/final hashes match |
| Optional sample failure | HTTP503 and corrupt decode; immediate old buffers; one fatal response |
| Real media playback | 10 native unmuted file/seek receipts, finite PCM/no clipping |
| Geometry probes | five controlled fixtures; actual production camera/rays/renderer; unchanged model |

Four new guidance units cover body/wing corridor geometry, banking/gameplay axes,
camera/obstacle behavior and reusable lifecycle. Four audio units cover distinct
variant composites, spectrum/peak/edge bounds, rejection/fallback/disposal and
invalid late layer PCM. Three new browser tests verify exactly8 requests/212612
bytes, volume/mute/pan/cache20resets/context cleanup, corrupt optional files with
2 ordinary hits/1 fatal cue, and an actual right-wing pickup with ON/OFF depth,
camera movement, pause, viewport and restart. Existing115 browser checks remain.

The separate five controlled geometry fixtures deliberately position a target and
obstacle. They test clear, ship-ray-blocked, camera-blocked and12/60m depth states.
They are not represented as naturally generated encounters. Main comparison tapes
use actual bounded steering, original IntegratedModel, natural shards and damage.

## Retained failures and corrections

Initial focused checks exposed detached decode ArrayBuffer byte counts, fixed by
counting before decode. An audio gain assertion needed to wait for the real audio
clock rather than a wall-clock delay; its strict precision remains. Landscape
expected844px was incorrect because the actual2:1 drawable width is780px. A unit
spectral expectation was changed from an arbitrary absolute ratio to meaningful
at-least6dB attenuation relative to its input. Runtime filters were not retuned to
pass. Early failure logs/traces and the interrupted browser attempt are retained.
The final complete run uses the corrected tests and unchanged strict expectations.

Review-only corrections are also retained: the live JSON had a duplicated samples
property, which hid its per-second diagnostic list. The corrected live/endurance
captures were rerun before final playback. Initial preservation assertions expected
every whole PNG/PCM value to be identical. Investigation isolated five CSS ENERGY
glyph pulses and eight1LSB engine PCM values. Exact scene bounds, source identity
and raw deltas are recorded; those cases are not described as bit-identical.
The gallery helper's initial seek listener also paused a later play request;
it is removed after the seek, and the real pair-button playback check was rerun.

## Evidence and reproducibility

`sample-guidance-*` scripts own this task's capture, asset preparation, bounded-input
diagnosis, native offline audio, genuine playback, performance and packaging.
Review scripts need installed Chrome; Python signal/image verification additionally
uses NumPy/Pillow. They use task-local `.cache/review/FEEDBACK-001C1`; restore
`evidence/scenario-inputs.json` and `collision-inputs.json` there to replay supplied
tapes. Baseline freeze uses exact0348c2a. Downloads are optional preparation only;
normal build/play uses checked-in production derivatives. Assets are not fetched
from third-party sites during play.

Packaging requires clean committed tracked files, final342/118 gates, frozen
inputs, gameplay/scene/audio preservation, performance/endurance/playback receipts,
complete diff and isolated-index forward/reverse exact trees. ZIP CRC, all file
sizes/SHA256, every canonical source Git blob SHA1 and gallery links are verified.
Two patch whitespace warnings originate in preserved supplied license notices;
their canonical bytes are retained. Native gallery images, pair-video playback
and desktop/portrait fit are checked separately from the118 product tests.
No hardware phone, independent human listening/usability, Yandex SDK or remote
deployment test is claimed.
