# FEEDBACK-001C audio design

Original atmospheric electronics with a restrained industrial edge. Synthesis is
repository-authored; no sampled recording, external soundtrack or new dependency.
The existing volume panel, persisted settings key and defaults remain unchanged.

## Sound vocabulary

| Family | Construction | Length |
|---|---|---|
| Rock, three variants | Descending low thud, filtered debris, brief hull resonance | .48 s |
| Metal, three variants | Hard transient, inharmonic ringing and scrape | .65 s |
| Station, three variants | 57 Hz structural body, stress partials, broken scrape | .85 s |
| Mine, three variants | Electronic discharge, descending explosive body, electrical tail | 1.1 s |
| Pickup, three variants | Short related D/F/A upper confirmations, softened attack | .24 s |
| Damaged hull | Gated electrical crackle, no alarm loop | .22 s |
| Fatal contact | Hull collapse and electrical instability | .6 s |
| Breakup | Lower, longer plasma/structural release | 1.4 s |
| Secondary failure | Short low rupture and metallic tail | .48 s |
| Results | Quiet D-minor/add9 atmospheric resolution | 1.8 s |

Each repeated family has three deterministic PCM variants, with approximately
±2–2.5% pitch variation and at most 3.5% gain reduction. A private golden-ratio
counter selects variations; it never calls gameplay RNG or Math.random. Explicit
variation arguments remain supported. Fatal contact selects destruction alone;
the ordinary collision sound is not also played.

## Flight and damage

Three permanent engine sources: 54 Hz sine body, 162.3 Hz triangle propulsion
detail and filtered looped noise. Real speed 20–34 and actual lateral/vertical
velocity control pitch, rush cutoff (600–1900 Hz) and texture level. Parameters
are updated at most 25 times/second and smoothed over 100–120 ms. There is no
invented throttle or change in physics. Engine remains on the SFX bus.

Only accepted player.damage facts arm malfunction audio. At 2 HP the interval is
8.5 seconds at .35 cue gain; at 1 HP it is 4.6 seconds at .65 gain. Simulation
elapsed time controls these occasional events. Pause freezes that elapsed time;
muted due intervals are discarded and advanced. New runs disarm them. Hull
snapshots alone cannot create damage sounds. The texture is restrained crackle;
there is no permanent alarm or separate damaged-engine loop.

## Composition

64 seconds, 32 bars, 120 BPM; 16 four-second harmonic windows. D-minor/add9 is the
home language, with Bb/F/C/G colours and an A-based return. Four eight-bar chapters
change voicing, bass syncopation, upper responses, arpeggio contours and percussion
density. This replaces the former four-chord/16-second bed. It remains a looping
score, with musical development inside its 64-second form.

| Stem | Format | Function |
|---|---|---|
| Ambient | Stereo | Detuned pads, overlapping harmonies, sparse upper responses |
| Pulse | Mono | Rounded bass pulses with four chapter-specific rhythms |
| Pressure | Mono | Arpeggio, kick, restrained noise percussion and denser third chapter |

All stems have exactly 705600 frames at 11025 Hz, identical 64-second duration and
one explicit AudioContext start time. Circular note tails bridge the loop seam.
The music's band limit is 5.5 kHz; SFX and engine buffers use 22050 Hz. This keeps
the 64-second score practical without changing accepted visual quality. Runtime
PCM is generated once per graph, never per frame or restart.

| Active director pressure | Ambient / pulse / pressure | Low-pass |
|---|---|---|
| regular | .90 / .36 / .08 | 3000 Hz |
| rising | .90 / .72 / .40 | 3000 Hz |
| high | .82 / .88 / .90 | 4200 Hz |
| recovery | 1 / .16 / .02 | 1500 Hz |

Gain targets crossfade with a .65-second time constant; filter changes use .45 s.
Targets are changed only when pressure/state changes. No source restarts or
rhythmic rescheduling occur. The shortest real section lasts several seconds;
an additional hysteresis timer would delay useful feedback and is unnecessary.

## Authority and mixing

Director phaseChanged reports publication of future content. AudioPressure keeps
at most 16 read-only section summaries from field.lastOutcome, including omitted
and repeated-pacing sections. It selects only the interval containing actual ship
distance. Omitted/expired sections use recovery. Restart clears this ledger. The
director, publication budget, admission and gameplay event definitions are untouched.

Priority: destruction/results 3, collisions 2, pickups 1, small UI/crackle 0.
At saturation an incoming sound can replace an older unprotected voice of equal
or lower priority. Pickups cannot evict collision/destruction. Six temporary
voices plus six permanent sources bound polyphony. Native ended callbacks release
source buffers/connections. Critical voices cannot evict each other when full.

Master retains .7 headroom; all samples are bounded by .14. Collisions duck a
separate music gain to .58 with a short recovery; fatal phases duck to .22 with a
longer release. Pickups do not duck music. User Music/SFX gains are independent of
this envelope. No compressor or limiter flattens the score. Death fades the engine
out and leaves a quieter ambient results state. Reset cancels the duck envelope.

Artistic acceptance, fatigue on personal speakers/headphones and physical-phone
listening belong to the owner review; objective PCM checks are not that approval.
