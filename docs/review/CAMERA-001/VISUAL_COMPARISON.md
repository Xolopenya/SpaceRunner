# Actual matched comparison

Evidence is recorded from real Chrome running ordinary ReleaseModel. `scripts/camera-scenarios.mjs` finds/records ordinary input histories; `camera-browser.mjs` replays them unchanged at120Hz for every policy. Camera update/render uses60Hz samples of the same authoritative ticks. Unrendered prefixes still update original presentation while GPU draws are suppressed; final four seconds per primary case are drawn in native RAF. Browser scheduling can stretch playback but cannot change the two fixed simulation steps per render. Native silent WebM, original GLBs, no invented hazards, teleport or health overrides. Diagnostic impact retains004B's explicitly labeled recorded asteroid ghost. Clean images hide DEV panels. This is automated gameplay evidence, not owner approval.

| Case | Seed / authoritative tick | Result |
| --- | --- | --- |
| Left boundary |16 /2630 |Left-wing sphere clearance.303254m, hull3; ship nearX−4.6, Y−2.815 |
| Right boundary |20 /3545 |Right-wing clearance.185377m, hull3; ship nearX+4.6, Y+2.816 |
| Wing damage |42 /851 |Actual accepted asteroid hits left wing, body clear; hull3→2 |
| Energy near debris |42 /1643 |First fragment collected, hull3 |
| Lower station / Phase2 |42 /3119 |Right-wing fragment collection, ENERGY2, hull3, distance563.983m |
| Vertical evasion |42 /799 |Y velocity~5.98m/s near incoming ordinary debris; hull3 |
| Sustained steering |42 /850 |Long alternating X/Y/corner inputs; no chase lag or oscillation |

Five station snapshots use actual accepted seed42 witness flight: center tick4833, left17985, right16102, upper6505, lower3042. The same input history discovers all five without forcing the aperture bag. Follow modes do not widen holes or change alignment requirements. Witness flight also deliberately ignores rewards in the early stations. Separate screenshots cover center, both lateral boundaries, upper/lower boundaries and a diagonal corner with the same actual movement history.

The table lists event ticks. Files `camera-<case>-<policy>.png` are matched at exactly the same capture tick: boundary approach12 ticks before closest pass, wing hit at impact, rewards one tick after pickup, vertical motion at799. Raw JSON carries `captureTick`, event and final-state hashes separately. Reward videos continue24 ticks after pickup to show the original140ms attraction/pulse. Vertical input continues beyond190m with hull3, demonstrating that the incoming debris is actually passed. JSON includes complete input histories, poses, hazards, fragments, hull, Phase2, event identities, projected vertices and resource counts.

Three videos `camera-baseline.webm`, `camera-full-chase.webm`, `camera-hybrid-chase.webm` show all primary cases, then same-state selector comparisons. A fourth `camera-switching.webm` records selector clicks while forward flight and sustained input continue. Ordinary native GameLoop/held-key switching is covered by the camera browser test as well.

Trade-offs to evaluate manually: A gives stronger screen displacement and a world-centered corridor reference, but near-boundary wing clearance is viewed obliquely. B removes steering-induced yaw and holds the ship steady; it also removes ship-screen displacement as a boundary cue and makes stationary-world structures translate across the view. C retains some ship displacement with a constant view direction. Neither numerical stability nor the owner's initial suggestion chooses a winner.

The inherited corner guides are very faint, at X±7.1/Y±4.6, beyond the actual ship-center bounds±6/±3.6. They are not reliable hard-boundary indicators. Full Chase cannot communicate remaining maneuvering room from ship position alone; Hybrid gives only20% of that displacement. No permanent walls or new gameplay barriers have been added. Cosmetic banking still differs from axis-aligned collision spheres; the camera cannot remove that visual/proxy difference.

Desktop1280×800, portrait390×844 and mobile landscape844×390 use matched states. Narrow portrait's inherited long rear distance makes near geometry and the ship smaller; chasing does not remove that constraint. Mobile emulation is not a physical-phone comfort/FPS test. HUD, touch controls and audio remain inherited.
