# HUD and menus

Evidence is linked by issue in [UX-AUDIT](UX-AUDIT.md); screenshot dimensions/state are in the gallery and raw JSON. Evaluation preserves the owner-approved Concept A. The interface uses local Oxanium for display type, IBM Plex Mono for labels, navy surfaces, cyan actions and warm damage information. Primary cyan button contrast is strong against its opaque ink text. Historical token contrast calculations concern solid color pairs; they do not certify contrast against every live WebGL frame.

## Active HUD

| Element | Observed behavior | Information priority / action |
|---|---|---|
| Hull | Three skewed pips, explicit N/3 and warm critical state; meter exposes numeric state | Essential. Preserve both shape/count redundancy; protect damage text from phase text |
| Distance | Large tabular distance in metres at upper right | Essential primary score. Correctly reports actual distance; no separate points display is missing |
| Energy | Small cyan icon/label/count under hull; +1 on accepted pickup | Secondary persistent run count. Explain optional collection once; avoid a fabricated fuel gauge |
| Phase label | Permanent 11px monospace line offset from the hull anchor | Secondary. Its independent positioning causes UX-01; calm the permanent label after transition |
| Phase transition | Three-second amber string with +8% and RECOVERY GAP -48 | Event-only. Simplify wording, add truthful units if numerical details remain (UX-02) |
| Damage | Hull hit / Impact protection active while immunity >0 | Essential event-only information. Natural hit at 24.37s overlaps phase; 1280x720 bounding-box intersection is 126.23×13 CSS px |
| Record | Data flag exists; no visible announcement | Result-oriented. Prefer a compact acknowledgement on results to more persistent flight chrome (UX-06) |
| Hint | Steering + avoid-debris copy for first nine gameplay seconds on every run | Helpful early; wrong input wording in short desktop windows (UX-03); no fragment teaching (UX-04) |
| Speed | 12px m/s at lower left | Secondary and low visual weight. No evidence justifies removing it or increasing it |
| Pause | Top-right opaque button, 84×48 desktop / 48×48 portrait | Essential, unobstructed and reachable in captured states |

The center and lower-middle remain largely available to flight. This is a strength. Additional phase/damage lines progressively stack down the upper-left margin; the solution is shared message space and priority, not a larger panel. Default labels are 10–12px; distance is 27–38px across inspected compact/desktop layouts. Human glance tests are needed before judging small text categorically unreadable. The natural collision screenshot makes the overlap indisputable without such a claim.

Damage/protection, pickup and record use separate facts. The presentation orchestrator already limits decorative reactions and prioritizes fatal/damage effects over pickup decoration; no unbounded notification queue was observed. Fix DOM message competition without changing collision cadence, protection time or this priority logic.

## Main menu

The stepped title, cyan launch surface, quiet personal best and real ship/world make the screen feel like the same game. Avoid debris. Fly further. communicates the survival goal. Launch is focused at entry and large enough for pointer/touch. There is one primary action and one restrained audio action; no dashboard redesign is warranted.

The control model is explained adequately on normal desktop and portrait touch. However, compact CSS chooses touch wording even on a fine-pointer 800x450 desktop. The coarse tablet gets drag steering plus ESC/P/M auxiliary copy. This is a disclosure defect, not evidence that keyboard or drag steering is broken.

The menu does not teach cyan fragments or their current purpose. A short first-encounter explanation has a stronger evidence basis than a mandatory tutorial. Do not add progression/economy promises.

## Pause and settings

Pause presents clear state/reason, Resume as the primary action, quieter restart/audio and retained hull/distance. All eight matrix pause samples kept exactly the same model elapsed time while sliders and P/Escape were exercised. P inside the native audio dialog did not resume flight; Escape closed the dialog and left PAUSED. Resume cleared residual velocity in the sampled states. Touch capture released after drag; rotation retained navigation access.

The Audio dialog has native modal semantics and an accessible heading. Slider tracks are at least 44px high. Master/music/SFX changes, mute and reload persistence worked; the focused sequence saved 28% / 17% / 63% and mute. Escape/focus-return and focus confinement are also covered by the existing UI tests. Raw state records an empty active-element ID for the opener because that button has no id; that value alone is not evidence of lost focus.

There are no visual settings beyond OS-driven reduced motion. Report this as scope/discoverability (UX-09), not a missing quality-menu defect. The synthesized-sounds footer is stale after sampled collision audio was integrated (UX-10). Do not expose development telemetry in the product as a remedy.

## Death, results and replay

Two native runs ended naturally at 868m and 1424m. The approved destruction sequence played, a focusable Skip to results action appeared, and the ordinary results took focus on Fly again. A separate held natural-death capture verifies skip immediately exposes results; reduced-motion behavior is documented separately. Do not redesign the approved cinematic.

Results emphasize distance, list energy separately and show personal best. First records show equal final/best values without acknowledging improvement (UX-06). Results offer only replay; there is no in-game route back to the menu or its audio controls (UX-07). Treat adding that route as lifecycle work: cancel cinematic/audio tail as appropriate, clear input, retain saved records/settings and restore focus. Replay already resets hull to three and collection count to zero. Preserve it.

The portrait result layouts inspected at 390x844 and 360x800 did not overlap essential actions; the four-digit result and personal best remained visually separated. All eight main viewport menu/pause/settings/results target rectangles fit, with no captured button/input below 44×44px. These checks do not establish zoom, localization or arbitrary long-count behavior; the existing score-fit regression supplies additional extreme-value coverage.
