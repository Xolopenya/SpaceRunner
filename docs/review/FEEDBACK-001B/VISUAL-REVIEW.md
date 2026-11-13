# Actual gameplay visual review

Open `visuals.html` from the ZIP for original full-size frames and the native browser
recording. Files are also under `gameplay/`; `captures.json` records tick, HP, phase,
time, event identities, resource counts and field fault status for every capture.

Primary method: unmodified production app observed at Launch through CDP. A fixed
input pilot steers into **already published** hazards. No inserted obstacle, health,
cooldown, pose or generator edit. Prefix replay is accelerated; screenshot states are
deliberately held. The native video includes these holds, then normal RAF progression
through the death sequence. The browser recording is silent; Web Audio cue timing
is checked separately by automation. It is not a human playtest or listening test.

| Requirement | Actual production frames |
| --- | --- |
| Intact / damaged / critical | `death-intact.png`, `death-damaged.png`, `death-critical.png` |
| Portrait comparison | `mobile-intact.png`, `mobile-damaged.png`, `mobile-critical.png` |
| Rock contact and breakup | `rock-approach.png`, `rock-contact.png`, `rock-debris.png` |
| Industrial metal | `metal-approach.png`, `metal-contact.png`, `metal-debris.png` |
| Identified mine detonation | `mine-approach.png`, `mine-contact.png`, `mine-debris.png` |
| Station mass/local sparks | `station-approach.png`, `station-contact.png`, `station-debris.png` |
| Fatal contact / overload | `death-fatal.png`, `death-failure.png` |
| Central blast / separated hull | `death-explosion.png`, `death-breakup.png` |
| Aftermath / results | `death-aftermath.png`, `death-results.png` |
| Reset intact appearance | `death-restarted.png`, `mobile-restarted.png` |
| Recording | `natural-destruction.webm` |

All four families are naturally hit with seed42. The mine hit is at approximately
730m and station hit1450m, with their actual planned IDs retained. The death tape
ends at about266m after three accepted rock contacts. Full timing/identity data is
in scenarios/captures receipts rather than guessed from the images.

The assistant inspected full frames for damage severity, mobile critical HP, rock/
metal breakup, mine shockwave, station-local sparks and ship breakup/aftermath.
The rear armor carries a visible fissure/scorch at2HP; critical adds a broad second
fissure/soot and leakage. Hull fragments preserve original amber/steel paint.

The first controlled prototype was too dim behind the results vignette and its
upper-wing mark too subtle from Hybrid. The final implementation defers that vignette
and adds damage on visible rear armor surfaces. Controlled prototype images are not
presented as final natural gameplay evidence.

Known visual limits: open cut edges on triangle partitions; compact billboard cloud
rather than volumetric smoke; approximate impact proxy surface; tiny surface detail
at portrait distance. The much larger fissure/stage silhouette and ring/debris remain
visible. Inherited damage text overlaps phase text; deferred to the HUD phaseD.
Owner subjective comfort/art approval and physical-phone review are outstanding.
