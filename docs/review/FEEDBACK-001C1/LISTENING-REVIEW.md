# Listening guide and technical results

Extract the ZIP and open `index.html`; every player is manual, without autoplay.
Compare at one comfortable device volume. Delivered WAVs are actual production
AudioGraph rendered by native OfflineAudioContext; cues are scripted presentation
inputs, not claimed gameplay collisions. Live Opus/canvas recordings route the
real production master during natural gameplay. Canvas video omits the HTML HUD;
separate silent full-page guidance clips include it. No independent human listening
panel or artistic/fatigue approval is claimed.

## Start here

1. `baseline/audio/collisions.wav` then `final/audio/collisions.wav`: same isolated
   cue order/default gain. Rock at0.5/1.9/3.3s; metal4.7/6.1/7.5s; station8.9/10.3/
   11.7s; mine13.1/14.5/15.9s. Pickup17.3/18.7/20.1s and crackle21.5s are retained.
   The third material ID aliases the first of two physical variants. Judge stone
   contact/fracture, metallic ring, heavy plate body and mine crunch/energy tail.
2. `final/live/mine-canvas.webm`: natural mine damage near3.09s; compare the physical
   transient to engine/music in context. `death-canvas.webm`: fatal collision near
   3.03s, coordinated rupture/secondary phases, UI restart near5.40s. Counts also
   include accelerated prefixes, so pre-recording cues are not all in the clip.
3. `final/audio/spatial.wav`: left rock1s, right metal3s, wider-left mine5s. Pan is
   deliberately small; mono fold retains .975 RMS ratio in this example.
4. `final/audio/fallback.wav`: all optional fetches return503; the immediate old
   procedural collision render is bit-identical to baseline24s. Corrupt decode and
   fatal deduplication also pass the browser tests.
5. `final/audio/music.wav`:180s with preserved64s score and adaptive transitions.
   First32s match baseline bit-for-bit. `adaptive.wav` changes pressure at12/24/40/
   52s. Music was already approved; it is not retuned here.
6. `final/audio/flight.wav`:18s engine with speed/steering changes at4/7/10/13s.
   First12s differ from baseline in eight PCM16 sample values by at most1LSB;
   the complete engine class/settings/synthesis remain source-identical.
7. `lifecycle.wav`:pickup2s, damaged crackles4/6s, pause8–10s, mute12–14s.
   `sample-headroom.wav`: six mine voices plus maximum engine/music at2s; this is
   a stress mix, not a representative flight. `headroom.wav` preserves the existing
   six-destruction stress example. `final/live/endurance-audio.webm` is60s real audio.

## Material separation evidence

Measured1.2s cue windows, mono FFT/Hann, same output gain. Low-band percentages are
descriptive energy below120Hz, not perceived quality scores or LUFS normalization.

| Variant | Centroid baseline→final Hz | Below120Hz energy baseline→final |
|---|---|---|
| rock1 | 626→935 | 66.7%→24.3% |
| rock2 | 669→936 | 64.2%→24.4% |
| metal1 | 399→1218 | 0.8%→0.1% |
| metal2 | 413→2676 | 1.1%→<0.1% |
| station1 | 116→159 | 89.8%→68.4% |
| station2 | 118→144 | 88.7%→69.1% |
| mine1 | 84→457 | 96.4%→33.0% |
| mine2 | 84→467 | 96.4%→30.6% |

These recorded transients, variant differences and lower bass concentration address
the flat/boomy source material technically. Station intentionally retains heavier
structure. Equal peak caps do not imply equal perceived loudness: owner judgement
is still needed for balance, attack, believability and fatigue on real equipment.

## Playback and safety margins

Ten actual delivered-file playback/seek cases decode finite PCM and play through
an unmuted native HTMLAudioElement→Analyser→destination after a genuine Play click.
Includes the full collision sequence, adaptive change, long-score seeks, spatial
and mute window; raw receipts give actual media times/RMS. No microphone or human
ear assessment is inferred from analyser output. New mine stress peak .59735
(−4.48dBFS), all WAVs zero full-scale samples. Pause9s RMS1.85e−6; mute13s exactly0.
Score sample steps at64/128s are .000214/.000183. Finite checks support functional
delivery, not a universal absence of clicks or fatigue on every browser/device.
