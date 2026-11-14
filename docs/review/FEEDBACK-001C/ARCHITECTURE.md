# FEEDBACK-001C architecture

The pre-change audit found one AudioManager-owned AudioContext, three engine
sources, one 16-second music source, eight cached SFX and six temporary voices.
FeedbackOrchestrator already made one prioritized contact decision from typed
facts. Game already deferred results until the approved destruction sequence ended.

The implementation extends these paths. No SDK, UI framework, physics engine,
backend, AudioWorklet, downloaded media or new dependency is added.

## Modules and ownership

- AudioManager remains the sole context owner. It receives read-only model frames,
  observes accepted typed facts through the existing orchestrator, owns cosmetic
  variation, damage cadence and a read-only pressure adapter.
- AudioGraph retains Master/Music/SFX buses, six-voice allocation and engine. Its
  AdaptiveScore owns three fixed sources, layer gains, shared low-pass, state gain
  and music duck gain. Existing diagnostic counters include family totals.
- music-synthesis.ts creates the original score's PCM; synthesis.ts creates SFX
  and engine noise. No synthesis executes during a frame or restart.
- pressure.ts stores bounded immutable-value section summaries. It cannot step,
  validate, publish, spawn or move anything. Gameplay never imports audio modules.
- Game passes world.destruction.sequence into the existing audio update calls.
  The visual sequence, shaders, breakup and clocks are unchanged.

## Event routing

Model events → FeedbackOrchestrator → observe(AudioManager) plus the existing
HUD/contact/collision ports. Nonfatal player.damage chooses the sound family from
the accepted obstacleKind. Fatal damage is filtered by the existing orchestrator;
player.destroyed selects the single fatal contact cue. Pickups retain the existing
reaction priority. No collision inference exists in audio.

The fatal observer arms a previous-visual-elapsed marker. Audio update compares
that marker to the existing visual breakupAt and the existing secondary offsets
(.10/.25/.42 after breakup). Each crossed phase plays once. No setTimeout,
independent destruction elapsed clock or pending explosion queue exists. Reduced
motion uses its actual shorter breakupAt. Skip/results discard unplayed phases;
restart clears all old voices/markers. The existing results cue routing is kept.

## Lifecycle

No AudioContext is created at construction or page load. The existing genuine
Launch/Resume/menu/settings gesture unlocks/resumes it. Locked/muted cue requests
are discarded. A generation token contains asynchronous unlock races; failed
allocation/runtime errors close the context and leave the game playable silently.

Pause clears temporary voices, fades engine/music state gains to zero and preserves
the graph. The muted musical sources continue their shared context clock on an
ordinary in-page pause, matching the previous attenuation strategy. Background
immediately silences/clears and suspends the context, freezing all source clocks.
Resume reuses those sources. Mute also clears temporary voices; it changes only
presentation. Restart resets pressure, damage, fatal markers, voices and ducking,
while retaining the synchronized composition and buffer identities. Dispose stops
all six fixed sources, disconnects nodes, nulls buffers and closes the context.

Fixed native PCM: 12,868,404 bytes (12.27 MiB), including 11,289,600 music bytes,
176,400 engine-noise bytes and 1,402,404 SFX bytes. Temporary synthesis arrays can
briefly duplicate this data during initialization; they are not retained caches.
AudioParam automation is canceled/replaced at each target change; engine updates
are throttled, and score automation is not submitted every frame.

## Mine

Each of three existing burst slots gains one mesh/material, borrowing its existing
sphere. The existing core shader renders orange/white-hot filaments inside the
unchanged cyan release. It expands rapidly, cools with a .18-second envelope and
uses reduced-motion attenuation. ResourceOwner traverses/disposes the new material;
the existing warmup includes it. There is no new geometry, texture, shader role,
collision query, RNG stream or effect clock. The accepted contact identity/pose
continues to own the whole effect.

## Evidence and boundaries

The preservation tool compares all 140 baseline runtime/asset/build inputs:
131 are unchanged; nine existing presentation/audio files are extended and three
audio modules are new. All 38 matched visual scenarios have identical gameplay
and cinematic endpoints. All 26 shield/ship PNGs are byte-identical to baseline.
Audio WAVs come from the same production graph in native OfflineAudioContext;
Opus and combined canvas/Opus clips come from actual production flights.
