# PHASE-3-003 audio architecture

Approved baseline: `4b66af6be11c0afc8b6092cade20af27f5599524`. Native Web Audio only; no dependency, audio download or runtime stream.

| Module | Responsibility |
| --- | --- |
| `audio/settings.ts` | Central defaults, headroom/voice/engine/music tuning, validation and versioned preference storage |
| `audio/synthesis.ts` | Original deterministic noise, SFX waveforms, crossfaded stereo ambient composition and AudioBuffer creation |
| `audio/graph.ts` | Three gain buses, a continuous engine, one looping music source, six-voice temporary limit and node/buffer ownership |
| `audio/audio-manager.ts` | Sole AudioContext owner, gesture unlock, async generation guards, read-only model synchronization, hit de-duplication, visibility and disposal |
| `audio/sound-panel.ts` | Native accessible modal, settings events/status and cleanup; no AudioContext calls |
| `game.ts` | Submits existing model values, invokes activation from user actions and forwards pause/focus/context-loss/disposal events |

## Routing and budgets

Engine and one-shots → SFX Gain → Master Gain → Destination.

Stereo music → low-pass filter → state gain → Music Gain → Master Gain → Destination.

Master gain includes a fixed 0.7 headroom factor, in addition to the user's 0–1 master setting. Muting targets master gain zero. Each generated one-shot is limited to a 0.14 peak before caching; at most six are connected. Critical destruction/game-over voices can replace an older noncritical voice, while UI requests are dropped if all slots are critical. Native rendered maximum-volume stress tests check actual combined peaks. There is no automatic compressor makeup gain.

## Ownership and initialization

Construction reads preferences but creates no context/nodes. Launch, Resume, sound controls or M call `activate` directly from a real gesture. `unlock` creates at most one context, shares an in-flight resume request, and builds one graph only after resume succeeds. Four continuous sources (two oscillators, one noise loop, one music loop) and nine cached buffers survive restart. PCM allocation is measured in browser diagnostics; temporary generation arrays are released for GC.

The manager closes a context if partial graph construction fails, preventing an abandoned engine from layering on retry. Runtime node/automation errors are contained at the audio boundary, release the graph and switch to playable silent fallback; a later gesture may retry. Resume failures do not propagate to gameplay or console errors. A generation token invalidates stale initialization/UI callbacks after backgrounding/disposal. The browser's resume promise is not cancellable; close/invalidation prevents its completion from recreating resources. No application timer, scheduler interval, microphone or input-device access is used.

Completed one-shots remove themselves, disconnect, clear `onended` and release their source buffer reference. Restart clears temporary voices and the observed serial without replacing continuous sources. Backgrounding immediately zeros the master, clears one-shots and suspends the context. Disposal stops/disconnects all sources/nodes, clears cached references, closes the context and aborts settings/keyboard listeners through their existing owners. WebGL recovery suspends audio but does not dispose/rebuild its graph.

## Isolation and UI

`GameModel`, physics, collision profiles, input implementation, scoring/storage, fixed-step loop, World and all VFX remain unchanged. The audio manager reads a narrow typed frame (`state`, speed, velocities, hit serial and hull) and never writes it. Wave generation and audio synthesis use independent state; audio does not call the gameplay random generator.

Preferences use `space-runner.audio.v1`, independently of best scores. Values are clamped, invalid/missing fields default safely, and read/write failures retain session settings. Context state is never persisted. The native dialog is available from menu/pause, traps focus and scrolls on short viewports; Escape closes it without resuming flight. Sliders retain stable accessible names and native numeric values. M toggles mute outside editable fields. Status distinguishes locked, enabled, muted, blocked, suspended and unavailable audio.
