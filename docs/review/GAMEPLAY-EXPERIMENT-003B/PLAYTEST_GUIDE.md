# Owner playtest — GAMEPLAY-EXPERIMENT-003B

Run `npm run dev`. Compare these unchanged/experimental modes using the same seeds42,11,0:

- Baseline: http://127.0.0.1:5173/?debug=field&policy=baseline&seed=42
- Pressure: http://127.0.0.1:5173/?debug=field&policy=pressure&seed=42
- Structure: http://127.0.0.1:5173/?debug=field&experiment=large-structure&seed=42

Use `&aperture=center`, `left`, `right`, `upper`, `lower` for a repeated single position. Add `&colliders=1` only for a separate collision inspection: mint is the four solid boxes; pink is the unchanged ship sphere. There should be no mint surface across the opening. Existing WASD/arrows or touch drag, pause/resume, hull/score and restart are unchanged.

1. Record device/browser, viewport/orientation, seed, mode/order and ordinary input. Alternate mode order between people. First get comfortable with the existing steering, then make three attempts per mode, up to90seconds or real three-hit death. No autopilot/certificate follower during human evaluation.
2. Check first visibility, the orange front opening, inside faces and exit. Try a centered passage, both horizontal offsets and both vertical offsets. Identify a planned entry while there is still time to brake; note any last-second surprise. Test pause/resume during approach and restart after impact.
3. Deliberately aim at each pier/crown/sill. Explain the contact from the visible mesh. Try a grazing wing and an apparent corner bypass. Note the original forgiving sphere versus visible wings; do not interpret a wing-only overlap as a newly expanded ship collider. In the lower variant, judge the short chase-camera obstruction after exiting; at the upper/lower edge distinguish a route inside the aperture from an outer-frame bypass.
4. Repeat on narrow portrait and landscape. Record whether the opening, ship wings, warning distance and touch steering remain legible. Desktop emulation evidence in this package does not replace a physical phone.
5. After each attempt ask without prompting: “What made you change course?”, “What were the alternatives?”, “What caused the hit?”, “Which encounter do you remember?”, “Would you start another run, and why?” Record adverse cases and omissions along with successful passages.

Owner checklist: [ ] opening recognized early; [ ] front/exit understood; [ ] enough entry/braking time; [ ] wing clearance understandable; [ ] all solid hits explainable; [ ] no false gap; [ ] corners understood; [ ] portrait and landscape usable; [ ] pause/restart sound; [ ] baseline/pressure still selectable.

No preference verdict has been collected. Do not infer fun from extra hits or from a zero-hit automated witness. Promotion or the next gameplay experiment requires external review of geometry, measured CPU cost, human results and physical-device behavior.
