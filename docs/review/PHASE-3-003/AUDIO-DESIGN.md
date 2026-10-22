# Audio design and listening acceptance

## Original sound palette

All sounds are repository-authored synthesis in `src/audio/`; no third-party recording, sampled instrument, track, download or streaming URL is used. Source code is included for review. The Kenney CC0 notice applies to the existing models, not to this original music. No separate third-party audio attribution/license is claimed.

The propulsion layer combines a 54 Hz sine body, a quiet 81.15 Hz triangle harmonic and a softly filtered deterministic noise loop. Actual speed and lateral velocity gently raise pitch, cutoff and rush energy, with smoothed AudioParams. This remains propulsion texture rather than a boost mechanic. No engine graph is rebuilt while steering or restarting.

Impacts combine a fast tapered transient, falling low body, filtered noise/metallic texture and a short two-partial shield tail. Destruction has a lower, longer body; the delayed three-note game-over gesture is separate and plays once. UI launch/resume/pause gestures and quiet mechanical clicks share this restrained tonal palette. HUD refreshes are silent.

The original 16-second stereo ambient loop moves through Dm9 → Bbmaj7 → Fmaj7 → Cadd9, with crossfaded voicings, slight stereo detuning and sparse compatible accents. Its periodic chord envelopes overlap across the loop boundary. Menu/game-over states lower level and filter brightness; flight opens the filter and increases presence. Music amplitude is centrally tunable and was balanced using captured PCM levels; subjective musical/speaker quality remains for listening acceptance.

## Settings

Defaults: master 65%, music 35%, SFX 75%, mute off. Open Sound settings from the main menu or pause screen, or use M to mute/unmute. Desktop keyboard and touch controls are supported. The landscape dialog scrolls internally to preserve 44 px controls. Preferences save under `space-runner.audio.v1`; denied storage retains them for the session. Audio starts only after a valid interaction and remains optional for flight.

## What was actually verified

Unit tests cover preferences/routing/lifecycle/synthesis. Browser tests count a real gesture-created context, analyse live output, verify pause/mute/focus silence and reuse, and render the actual graph through native OfflineAudioContext. Rendered peaks, RMS, mute tail, cached PCM bytes and restart diagnostics are recorded in raw JSON/logs. Generated WAV previews are finite stereo PCM captures of the same synthesis/routing, not microphone recordings or production downloads. This does not establish subjective listening quality.

## Manual owner checklist — not yet signed off

Run `npm run dev`, open `http://127.0.0.1:5173/?seed=42`, and use modest system volume first. For the production check run `npm run build` then `npm run preview`. No debug parameter is needed.

- [ ] Before interaction, confirm silence. Open Sound settings and listen to quiet menu music.
- [ ] Launch and verify a smooth engine start; steer both axes and listen for subtle propulsion changes.
- [ ] Let route 42 produce damage; compare normal impact/shield feedback with the distinct final destruction/transition.
- [ ] Let music run for at least 40 seconds across multiple loop boundaries; check for clicks or distracting repetition.
- [ ] Check music/engine/impact balance and comfortable loudness on speakers and headphones.
- [ ] Pause/resume repeatedly; check fade continuity and absence of a continuing flight engine during pause.
- [ ] Mute/unmute and try each volume separately, including zero and maximum.
- [ ] Reload; verify saved settings, initial silence and gesture unlock.
- [ ] Switch tabs/lose focus, return and deliberately resume; check silence while hidden.
- [ ] Restart at least five times; listen for overlapping engines/music or stale hits.

Review `audio/audio-flight-preview.wav` (8 seconds, speed/steering modulation, hit and final transition) and `audio/audio-music-preview.wav` (16 seconds, quiet menu music) inside the ZIP. They supplement actual gameplay listening; physical phone/Safari/Firefox/device balance and sustained DSP behavior remain unverified.
