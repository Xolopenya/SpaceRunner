# Audio lifecycle

| Trigger/state | Behavior |
| --- | --- |
| LOADING / fresh MENU | No context or autoplay. Saved preferences alone cannot unlock audio. |
| Sound control in MENU | A real gesture resumes/creates the context; quiet filtered menu music, no engine. |
| Launch / restart | Reuse the graph; clear temporary voices/reset serial, fade engine/music up and play launch feedback. |
| PLAYING | Read speed/steering, smoothly update low engine pitches/filter/rush at most 25 times/s. Observe one new hit serial once. |
| Normal damage | One impact waveform includes body, transient texture and quiet shield resonance. Invulnerability causes no retrigger. |
| Final damage / GAME_OVER | One destruction sound and one delayed descending transition; engine decays and music becomes calmer. One-shots finish naturally. |
| PAUSED | Engine and music state gains fade to zero, old one-shots stop, optional short user pause cue. No continued model-driven engine updates. |
| Resume | Explicit gesture resumes the existing context if needed, then restores current state gains. No stale damage is replayed. |
| Muted | Master gain fades to zero; settings/state still synchronize and hit serials are consumed. Unmuting during pause cannot revive a flight engine. |
| Blur / hidden document | Silence master immediately, stop temporary voices, invalidate pending work and suspend context, including menu music. |
| Return to page | Keep simulation/audio suspended until a relevant gesture. No hidden-tab scheduling debt or accumulated music events. |
| WebGL context loss | Existing gameplay pause plus audio suspension; deliberate Resume after graphics recovery reuses audio. |
| Dispose / HMR | Abort listeners, invalidate late completions, stop/disconnect graph, clear buffers and close context. |

The native music loop uses AudioBufferSourceNode timing rather than JavaScript beat timers. Pausing its gain leaves a bounded native loop; background suspension freezes the whole audio clock. Ramp tails may settle briefly while manual pause fades out. Music and engine gains are separate from preference buses, so settings cannot undo a state pause.

Initialization is fire-and-forget from Game; sound failure never blocks Launch, movement, health, scoring, graphics recovery or restart. Unsupported constructors, rejected resumes and runtime node failures have explicit silent status. Runtime graph errors are caught before they reach the animation loop, with stopped/disconnected sources and a closed context; a user gesture may retry. The app never requests microphone permission. Settings retain only numbers and mute preference, with no context state or authentication data.

Automated coverage includes delayed resume after disposal, graph allocation failure after engine source creation, simultaneous unlock requests, muted pause, one hit per serial, final sound de-duplication, voice eviction/cleanup, ten mocked resets, five real browser restarts, real output silence checks, missing/rejected audio, reload persistence and context closure. Raw results/limitations are in VERIFICATION.md and AUDIO-DIAGNOSTICS.json.
