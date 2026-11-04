# Owner camera decision

Start `npm run dev -- --port 5173` in the reconstructed repository, or open the running local server:

- A: http://127.0.0.1:5173/?debug=camera&camera=baseline&seed=42
- B: http://127.0.0.1:5173/?debug=camera&camera=full-chase&seed=42
- C: http://127.0.0.1:5173/?debug=camera&camera=hybrid-chase&seed=42
- Collider diagnosis: append `&colliders=1` to any URL.

Press normal Play. Use WASD/arrows or touch dragging, P/Escape to pause and M to mute. Bottom-right A/B/C controls switch the existing camera during flight; the run, input state, geometry, ENERGY, hull and random sequence continue. Switches deliberately snap. Selection survives restart; restart clears positional history. Normal Play and production builds remain A regardless of these DEV parameters.

Compare left/right boundaries, upward/downward movement and corners. Observe both wing spheres, not only the model body. Decide whether stable ship framing clarifies depth and wing clearance, and whether the remaining lateral room becomes harder to judge. Pause a scene and switch A/B/C to compare exactly the same geometry. Reaching a similar distance in a different manually controlled run does not create a matched comparison.

Use ZIP videos/PNGs for the controlled cases listed in VISUAL_COMPARISON. The exact automated input histories and hashes are in logs/camera-scenarios.json; `node --experimental-strip-types scripts/camera-browser.mjs` regenerates actual evidence with installed Chrome and running Vite. Source snapshot contains all scripts, without dependencies/caches. Browser video is silent; audio behavior is covered by inherited tests.

Try debris rewards and consciously ignore one, then align both wings with a station opening. Seed42's recorded collection route reaches a lower opening at564m in Phase2. All five aperture snapshots are included. Test portrait and mobile landscape, including thumb steering and accidental HUD overlap, on physical hardware if available. Do not infer a phone performance guarantee from desktop emulation.

Research implementation/evidence can be complete while selection remains pending. Choose **A, B, C, or another adjustment** after manual playtesting. There is no automatic recommendation or public deployment. Remaining limitations: faint boundary guides, existing cosmetic-bank/collider mismatch, inherited portrait distance, fixed-step presentation, finite local benchmark samples and no human comfort approval for this camera task.
