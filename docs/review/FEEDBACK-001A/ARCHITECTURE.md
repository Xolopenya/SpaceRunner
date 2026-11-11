# Event and feedback architecture

```text
Original fixed step: ship → field → collision/HP → fragments
  GameModel / RuntimeGameModel / ReleaseModel / FragmentRun
      ↓ typed immutable facts: runId + simulation elapsed
  GameEvents: bounded FIFO, no scene/audio dependencies
      ↓ Game flushes after the complete outer step
  FeedbackOrchestrator
      ├─ every fact → HUD.feedback
      └─ strongest contact → preset
          ├─ World → existing ImpactVFX / FragmentView
          ├─ CameraImpulse → unchanged FlightCamera scalar interface
          └─ AudioManager.playCue → existing AudioGraph / SFX bus
```

## Delivery

`on(type, payloadHandler)` statically narrows payload; `subscribe(handler)` receives
the discriminated union. Both return idempotent unsubscribe closures. FIFO events
and insertion-order listeners are deterministic. Each nonempty flush snapshots
listeners: additions start next batch; removals take effect immediately. Reentrant
flushes do nothing; recursive publications are dropped. Subscriber exceptions are
counted without preventing other delivery. Capacity is 64; overflow never blocks
simulation. There is no retained queue when unsubscribed and no idle event allocation.

Publishers copy/freeze positional snapshots; top-level envelopes/payloads are frozen.
Pooled hazard changes cannot corrupt context. The planner's diagnostic history is
unchanged. There is one coordinator subscription per Game; restart reuses it,
dispose removes it before model/audio/world teardown. Headless models require no DOM
or 3D scene. The direct FragmentRun publisher hook is bound once by ReleaseModel.

Start completes all subclass resets before delivering run.started. Each fixed step
completes authoritative mutations before delivery and contact selection. Render also
flushes for existing tools that step models directly, then closes presentation
envelopes and synchronizes state/audio/HUD/World. No callback enters the planner's
atomic admission. Contact reactions start in the same JavaScript turn, without a
timer. Valid hit order: collision → damage; fatal hit appends destroyed → ended.
The original immediate GAME_OVER/results policy remains.

## Priorities, timing and configuration

Presets configure priority, contact duration, total duration, recovery tail,
intensity, flash, camera and SoundCue. Existing VISUALS/FRAGMENT quality counts and
durations are reused. Current durations remain 550 ms impact and 420 ms pickup.
Contact starts immediately; Aftermath is the middle; Recovery is the final tail,
then idle. No generic deferred animation queue or extra meshes exist.

One strongest contact wins each batch. Bounded envelope slots are allocated once
(capacity two); current distinct priorities conservatively retain the strongest
family, retrigger same-family contacts and cancel weaker active channels. Existing
physical pools are one impact emitter and one pickup ring. Future same-priority
families must respect those capacities. AudioGraph retains its six-voice cap.

SoundCue accepts an existing Sound list, gain and rate range; caller-supplied
normalized variation avoids gameplay RNG. Current presets use the original sound
at unchanged gain/rate. Locked/muted event cues are discarded without delayed replay.
Master/Music/SFX, settings persistence, unlock and background policy remain owned by
AudioManager. The existing delayed secondary game-over voice is cancelled on reset.

## Lifecycle

| State/action | Result |
| --- | --- |
| PLAYING | Fixed simulation time; clamped presentation delta advances envelopes and existing animations. |
| PAUSED | Simulation elapsed, pickup, impact and camera envelope freeze; existing audio clears one-shot voices and quiets loops. No contact replay on resume. |
| GAME_OVER | Existing results appear immediately. Impact/camera envelope can finish in presentation time; simulation stays stopped, camera displacement is hidden behind results. |
| Restart | Model clears pending old facts and increments run ID; World resets existing pools; coordinator clears candidates/envelopes/native voices; pending gesture generation is invalidated. |
| Dispose | Coordinator unsubscribes, model clears mailbox, existing GPU/audio owners dispose resources. |

HUD retains authoritative HP/cooldown polling. Pickup pulse uses its event timestamp;
record/end signals are exposed without UI redesign. CameraImpulse stores only
strength and remaining duration; Hybrid recomputes both endpoints with the original
follow algorithm. Reduced motion and the recurrent DEV baseline receive zero shake.
