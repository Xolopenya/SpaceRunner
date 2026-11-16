# FEEDBACK-001C1 — Sampled collision audio and shard guidance

Implemented on `feature/feedback-001c1-audio-pickup-guidance` from exact base
`0348c2ac85be63106ea3bed6e532f50d97366c7a`. No push or merge. The archive's
`git/identity.json` records the final committed source/tree; `manifest.json` and
`SHA256SUMS` identify the delivered files. Open `index.html` after extracting the ZIP.

Collisions now combine selected CC0 physical recordings with quiet existing hull
or mine-energy layers. Eight small WAVs cover two real variants each of rock,
metal, station and mine. They load optionally, cache across runs and fall back to
the existing immediate synthesized response on failure. Restrained stereo pan
comes from the accepted collision position. Fatal contact still produces one
coordinated destruction response. Music, engine defaults and saved controls remain.

Two thin cyan wing paths extend along gameplay axes. A dashed contour at the
nearest visible shard's actual depth shows the current body-plus-wing pickup
footprint. It brightens for current overlap with an unobstructed eligible sight
ray. Camera occlusion suppresses the marker. It never predicts future input or
guarantees a pickup. Short wing connectors follow cosmetic bank while the long
paths stay consistent with the actual unbanked gameplay collider.

## Verified delivery

- 342/342 unit tests; 118/118 full browser tests, zero skipped/flaky; typecheck and
  production build passed. All 244 native-tested input hashes match final source.
- Of 143 baseline runtime/asset/config files, 138 remain unchanged. The five
  extended files are World, AudioGraph, AudioManager, orchestrator and cue settings.
  All mechanics, RNG, pickup radii/size/assist/placement, camera, controls, approved
  engine/music/VFX and dependencies remain unchanged.
- 66 matched baseline/final-OFF gameplay states and 66 final ON/OFF pairs; all
  scene pixels preserved with guidance OFF. 61 PNGs are byte-identical; five only
  differ in the existing wall-clock ENERGY-count glyph animation.
- Ten broad gameplay endpoint hashes match baseline. Twenty sequential native
  performance cases retain approximately60FPS and RAF p95 around17.1–17.3ms.
  The final desktop death case has a retained36.9ms maximum frame/59.65FPS result.
- Samples add212612 download bytes and599776 retained PCM bytes. Guidance adds two
  reusable geometries, no textures, one shader role and one/two visible draw calls.
  Forty natural death/restart cycles plus60seconds of continuous native audio
  evidence show stable owned resources; finite samples do not prove no future leak.

The package contains complete canonical Git source, complete binary diff, forward
and reverse tree verification, selected assets/originals/licenses, eight reports,
test/build logs, diagnostic inputs, paired screenshots/videos and playable actual
production WAV/live Opus recordings. Unrelated owner files are preserved/excluded.

## Owner review still needed

Recorded material texture, spectral separation and alignment geometry are verified
technically. No external human listening or pickup-usability session occurred here.
The owner should judge collision balance/fatigue and compare ON/OFF attempts with
new players. Collection-rate improvement is not claimed. Physical phones and other
browser/device audio latency remain untested. No confirmed pickup-rule defect or
formal unreachable-shard counterexample was found; diagnostic misses and hull cost
are documented separately rather than changing the generator.
