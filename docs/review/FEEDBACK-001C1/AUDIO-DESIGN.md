# Collision audio design

The approved engine, 64-second score, pressure adapter, user preferences and single
AudioContext owner are preserved. This slice replaces the material texture of
nonfatal collision families, with graceful procedural fallback. Fatal contact still
selects one coordinated destruction response and the existing visual-clock phases.

## Sources and selection

Official Kenney Impact Sounds, Sci-fi Sounds and Digital Audio packs were downloaded
through their public fresh-link flow. The supplied notices and official pages state
CC0. OpenGameArt's Various Sound Effects page identifies Julie Damsgaard / Spring
Spring and CC0. Its two stone recordings are selected. The suggested Metal Impact
page returned403 and supplies no asset. No library is imported wholesale.

23 candidate files were actually decoded and auditioned in unmuted Chromium after
a genuine gesture. candidate-audition.json preserves filenames, waveform duration,
attack, bass proportion and decay. This is automated audition/signal inspection,
not an independent human taste verdict. Selection was informed by actual signals:

- The low-frequency explosion had a slow attack, two-second duration and about70%
  low-band energy; it was rejected for the already boomy mix.
- Digital zaps had roughly73–111ms before audible onset and read as separate
  electronic gestures; they were rejected as physical contact attacks.
- Very short heavy-metal candidates concentrated around60% low-band energy;
  medium/light strikes offered clearer attacks and less bass concentration.
- Stone contact was sharp but high-crest/quiet in its tail; combining it with the
  recorded fracture supplies physical texture rather than just another sine thud.

| Family | Selected originals | Runtime layers |
|---|---|---|
| Rock | small_rock_impact.wav + break_stone.wav | Both recorded contact/fracture layers, swapped dominance, quiet original hull |
| Metal | impactMetal_medium_000.ogg / impactMetal_light_000.ogg | Material attack/ring plus quiet original hull |
| Station | impactPlate_heavy_000.ogg / impactPlate_heavy_002.ogg | Heavy plate/structural response plus restrained low hull resonance |
| Mine | explosionCrunch_000.ogg / explosionCrunch_001.ogg | Crunch transient/energy texture plus original electronic/body tail |

Each family has two independent physical variants. The existing third cosmetic
sound ID aliases the first sample, with the approved small rate/gain variation.
It is not represented as a third independent recording.

## Preparation and mix

Eight production WAVs total212612 bytes. Native Chromium resamples/downmixes to
22050Hz mono, retains a3ms lead, crops long material, normalizes to .85 and applies
2ms/25ms edge fades. manifest.json records originals, creators, URLs, licenses,
original and derivative hashes, timings and processing. Original Kenney notices
and stone attribution accompany the derivatives. See docs/ASSETS.md.

The bank creates one composite per selected sound. Linear high-pass cutoffs are
100Hz rock,130Hz metal,75Hz station and110Hz mine. A .12 original hull layer or .24
mine energy layer supplies continuity; rock variants additionally share recorded
contact/fracture texture at .65/.40. Composite peaks remain capped at .14. No
compressor, distortion or global echo is added. Physical texture is precomputed
once; a contact still consumes one voice and one cached buffer source.

The six-voice priorities and existing music ducking remain unchanged. Accepted
obstacle/ship X displacement supplies pan: hull impacts at most±.16, external
mine discharge at most±.35. Unsupported StereoPanner falls back to centered sound.
Panner/gain/source nodes are released together. Fatal impact remains centered.

Master/Music/SFX/mute defaults, saved values and approved engine balance are not
overwritten. Rather than reducing the owner's approved engine automatically,
the new transients and reduced sub-bass improve material separation. Final balance
and listening fatigue require the owner's speakers/headphones and judgement.

## Loading/fallback

Only the first unlocked AudioGraph starts the eight optional same-origin requests.
It does not await them to make the engine/music usable. Until each file is ready,
the existing corresponding procedural buffer plays immediately. No cue is queued
or replayed when loading finishes. All reset/pause/mute behavior is preserved.

Timeout, HTTP failure, corrupt/invalid decoded PCM and disposal are contained.
Partial rock-layer construction retains its valid first composite. Disposal aborts
requests, discards late decoded results and clears owned buffers. No second context
or audio engine is introduced. Before/after, fallback, spatial and maximum-mix
examples use the actual production graph, not replacement rendering code.
