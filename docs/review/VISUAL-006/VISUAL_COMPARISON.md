# Matched visual comparison

`warp-scenarios.json` records172 actual Chrome PNG captures in43 matched groups. Every group has four policies at one unchanged authoritative state hash. Fourteen desktop scenarios cover center,left/right/upper/lower,corner,fast diagonal,asteroids,fragment near hazards,station approach/close/passage,mine warning and Phase2. Seven natural integrated event states are replayed in both390×844 and844×390. Fifteen further groups cover all five accepted station apertures at80m,20m and passage.

The ordinary integrated seed42 route uses7679 recorded120Hz inputs and reaches1600m with hull3. Natural event ticks:asteroid332,fragment1086,station approach2511,Phase2 2809,station close3013,passage3115,mine3437. The same seed alone is not the matching criterion:exact inputs,ticks and full authoritative snapshot hashes are retained. Snapshot includes ship position/velocity,hull,distance,elapsed,phase,immunity,hit count,all hazard slots/publications/ownership,mine and reward state.

PNG filenames are `<scenario>-<policy>.png`. Mobile scenarios have390-/844- prefixes;isolated station scenarios have`aperture-<name>-<depth>` prefixes. The latter use the pre-existing certified diagnostic with its historical body-sphere contract and real steering inputs,not inserted stations. Geometry tests and integrated captures separately cover the current compound ship.

Six silent native Chrome videos:

- A-fragmented-arcs,B-flowing-filaments,C-fragmented-warp:the same first1440 inputs at two simulation ticks/native RAF.
- D-station-legacy,D-station-fragmented:the same844-input close approach/passage interval,after an accelerated prefix.
- E-integrated-clean:the complete7679-input continuous integrated route,including Mixed Flow,stations,adaptive mines,Energy Fragments and Phase2. All DEV panels are hidden;the existing public Phase2 notice remains.

These are real WebGL scene captures,without compositing,teleports,inserted obstacles or edited ship/hazard state. The pilot follows existing published certificate inputs;it is not a human playtest. The videos show optional rewards without guaranteeing collection. Timing follows native RAF,so video wall duration depends on host scheduling.

Inspected examples include center/right-edge views,combined station approach,portrait close station and left-aperture passage. The final mixture leaves the central ship and true opening clear. Short foreground curves can still project over distant station panels;see STATION_OCCLUSION and KNOWN_LIMITATIONS. No mode is declared a visual winner.
