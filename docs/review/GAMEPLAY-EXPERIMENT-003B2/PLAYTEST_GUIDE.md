# Owner playtest — 003B2

Run `npm run dev`. Each selected aperture now repeats; no hidden cycle. The label must show the requested MODE/APERTURE and opening XY inside a fixed hull(0,0).

- [Center](http://127.0.0.1:5173/?debug=field&experiment=large-structure&aperture=center&seed=42)
- [Left](http://127.0.0.1:5173/?debug=field&experiment=large-structure&aperture=left&seed=42)
- [Right](http://127.0.0.1:5173/?debug=field&experiment=large-structure&aperture=right&seed=42)
- [Upper](http://127.0.0.1:5173/?debug=field&experiment=large-structure&aperture=upper&seed=42)
- [Lower](http://127.0.0.1:5173/?debug=field&experiment=large-structure&aperture=lower&seed=42)
- [Mixed/right](http://127.0.0.1:5173/?debug=field&experiment=large-structure&mode=mixed&aperture=right&seed=42)
- [Baseline](http://127.0.0.1:5173/?debug=field&policy=baseline&seed=42)
- [Original003B](http://127.0.0.1:5173/?debug=field&experiment=large-structure-v1&seed=42)

1. Initially hold no steering until the approach. Compare the hole against the **fixed wreck silhouette**, not just the ship. Confirm each label and that left/right/top/bottom are obvious before steering. The package's neutral-distance110screens show this comparison without camera/ship differences.
2. Fly each selected opening with ordinary keys/touch. Record first recognition, chosen route, braking time, wing clearance, exit obstruction and whether hits are explainable. Inspect `&colliders=1` separately: mint is the four real sections, pink the approved sphere. Do not use a certificate follower for human evaluation.
3. Compare baseline/isolated/mixed with seeds42,11,0; alternate order between people. Use three attempts per mode up to90s or real death. Record actual input, source IDs/events and omissions; paired seeds do not guarantee the same published world after different input.
4. In mixed mode identify the ordinary object before the frame and the one after it. Judge whether either hides the opening or exit. Test the known seed4/upper case too; a veto can leave a deliberately omitted span. No missing/uncertified encounter should be presented as an invisible obstacle.
5. Repeat portrait and landscape on physical touch hardware. Emulation in this package is desktop Chrome, not a phone result. Try pause/resume and restart during approach. Ask: “Where is the opening?”, “What made you steer?”, “What caused the hit?”, “Does this look like wreckage?”, “Did the ordinary debris improve or obscure the encounter?”

Checklist: [ ] five variants obvious; [ ] debris identity convincing; [ ] approach/exit clear; [ ] ordinary hazards understandable; [ ] hits explainable; [ ] lower camera obstruction acceptable; [ ] touch usable; [ ] no production change.

No new human result is claimed. Moving hazards are **not implemented** and should wait for external003B2review, profiling of the recorded mixed-frame burst, and owner acceptance of the mixed/visual/viewport behavior. A separate dynamic-geometry safety contract would still be required.
