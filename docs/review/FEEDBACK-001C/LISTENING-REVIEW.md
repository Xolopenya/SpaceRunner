# Listening review

Open the archive's [index.html](index.html). Media links below are relative to the archive root. Every player uses delivered media; there is no
autoplay or external URL. Start at your normal comfortable listening level.
The production defaults are Master .65, Music .35 and SFX .75.

WAV: the actual production AudioGraph in Chromium OfflineAudioContext, using
scripted presentation inputs. These are not microphone recordings or substitutes
for gameplay. Opus/WebM: the actual production master bus recorded through
MediaStreamDestination/MediaRecorder. Combined canvas/Opus clips have synchronized
audio and video but exclude the HTML HUD. Matched page screenshots and silent page
videos retain the HUD. Accelerated prefixes are excluded from live recordings.

## Review order and cue sheet

| Example | Source / intended sound | File and useful range |
|---|---|---|
| Previous flight | Exact 001B1 graph, identical first movement inputs | [flight.wav](baseline/audio/flight.wav), 0–12 s |
| New flight | Steady flight 0–4; speed rises at 4; steer at 7/10; settle/faster flight at 13 | [flight.wav](final/audio/flight.wav), 0–18 s |
| Actual normal flight | Native certificate pilot, real ship/model/engine | [flight-audio.webm](final/live/flight-audio.webm) and [flight-canvas.webm](final/live/flight-canvas.webm), entire ~15 s |
| Actual steering | Explicit real analog controls, no velocity/physics edits | [steering-audio.webm](final/live/steering-audio.webm) and [steering-canvas.webm](final/live/steering-canvas.webm), entire clip |
| Collision comparison | Old shared impact three times, pickup, fatal contact | [collisions.wav](baseline/audio/collisions.wav), .5/1.9/3.3/4.7/6.1 s |
| Rock | Three rocky/hull variants | [collisions.wav](final/audio/collisions.wav), .5/1.9/3.3 s |
| Metal | Three sharp inharmonic strikes/scrapes | [collisions.wav](final/audio/collisions.wav), 4.7/6.1/7.5 s |
| Station | Three low structural impacts | [collisions.wav](final/audio/collisions.wav), 8.9/10.3/11.7 s |
| Mine | Three discharge/body/tail variants | [collisions.wav](final/audio/collisions.wav), 13.1/14.5/15.9 s; also [mine-excerpt.wav](final/audio/mine-excerpt.wav) |
| Pickup | D/F/A related confirmations | [collisions.wav](final/audio/collisions.wav), 17.3/18.7/20.1 s; also [pickups-excerpt.wav](final/audio/pickups-excerpt.wav) |
| Critical texture | Isolated restrained malfunction, then in a full flight mix | [collisions.wav](final/audio/collisions.wav) 21.5 s; [lifecycle.wav](final/audio/lifecycle.wav) 4/6 s (.35/.65 cue gain) |
| Actual mine | Real accepted seed42 mine around 730 m, warm core/cyan wave and corresponding sound | [mine-audio.webm](final/live/mine-audio.webm) and [mine-canvas.webm](final/live/mine-canvas.webm), impact ~3.1 s |
| Fatal sequence | Scripted production graph: contact 1.0, breakup 1.5, secondaries 1.6/1.75/1.92, results 3.05 | [destruction.wav](final/audio/destruction.wav), 0–8 s |
| Actual destruction | Natural third accepted hit, approved visual clock, results and production replay | [death-audio.webm](final/live/death-audio.webm) and [death-canvas.webm](final/live/death-canvas.webm): fatal ~3.07, main ~3.57, results ~5.12, replay ~5.46 s |
| Adaptive score | regular 0–12, rising 12–24, high 24–40, recovery 40–52, regular 52–64 | [adaptive.wav](final/audio/adaptive.wav), entire 64 s |
| Longer score | Hear opening 0–30; full form 0–64; next two loops and repeated pressure changes 64–180 | [music.wav](final/audio/music.wav), 3 minutes |
| Actual long flight | Real director and actual pickups, 180 seconds, all pacing states | [endurance-audio.webm](final/live/endurance-audio.webm), entire recording; exact transitions in endurance.json |
| Pause/mute | Pickup 2; malfunctions 4/6; pause 8–10; mute 12–14; resume/unmute in same graph | [lifecycle.wav](final/audio/lifecycle.wav), 0–16 s |
| Maximum mix | Full user gains, maximum engine/steering, high score and six synchronized fatal voices after layer settling | [headroom.wav](final/audio/headroom.wav), 2 s onward |

Offline suspension times are quantized to the native render quantum. Live fatal
phases follow the unchanged visual elapsed time within one rendered frame. The
isolation SFX file mutes engine/music so the family differences can be compared;
the live files demonstrate their actual mix.

## What was checked

Native browser playback decodes the delivered WAV/Opus files, plays selected
excerpts through an unmuted AudioContext after a genuine gesture, and measures the
output analyser. playback-review.json records the played ranges, decoded duration,
peak/RMS and actual output. This verifies playable audio rather than a silent
video or placeholder. Original live clips include the final production graph;
the three-minute endurance capture additionally logs active pressure sections.

signal-analysis.json checks finite PCM, full-scale samples, peak/RMS, mono fold-down,
musical seam steps and descriptive SFX spectral centroids. renders.json retains
initialization timing and one-second levels. No normalization is applied to hide
mix differences. Native tests cover independent volume buses, persistence,
autoplay, silent fallback, pause, background, reset and disposal.

## Limits of this review

This is automated browser playback, recordings and signal inspection. It does not
claim independent human hearing, fatigue approval or artistic acceptance. The owner
should listen to the first 30 seconds, complete first minute and full three-minute
examples on their usual speakers/headphones, compare steering/critical textures,
and review repeated deaths/restarts. Physical phone audio output, Bluetooth latency,
iOS/Safari and hearing-comfort preferences have not been tested here. The 64-second
composition eventually repeats; adaptive layers vary its density, not its tempo.

Exact live timestamps can vary by a few frames; live.json, steering.json and
endurance.json are the timing authority. Offline examples use the fixed sheet above.
