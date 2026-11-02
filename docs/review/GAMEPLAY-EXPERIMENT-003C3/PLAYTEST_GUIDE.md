# Owner A/B/C playtest — Target-Lock

Status **Partial**: technically certified DEV subset; publication omissions 22.92% versus 10.42% for Fast/Diagonal in the matched reference. No regular-flow promotion is requested yet. Human participants for this implementation: 0.

Run `npm install` if needed, then `npm run dev`. Open these exact links:

- [A — Fast](http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=fast&seed=42&firstMine=1)
- [B — Diagonal](http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=diagonal&seed=42&firstMine=1)
- [C — Target-Lock](http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=target-lock&seed=42&firstMine=1)

Launch; the first targeted mine acquires for 0.8 s, locks the actual XY near tick 97, then launches according to its displayed countdown and reaches that point near 180 m. Stay neutral once to see one normal hull contact. Restart and steer upward or diagonally AFTER the lock: the ship should clear while the mine continues toward the old position. Use WASD/arrows, P/Escape pause; touch drag on mobile. M retains existing sound controls.

Repeat with horizontal steering during acquisition: the displayed target should capture the ship's new XY. After lock, reverse; the target/velocity must remain fixed. Try actual boundaries and corners. Remove `firstMine=1` for unchanged normal Mixed Flow frequency, repeat seeds 0/11/42, and add `colliders=1` for the existing debug collider. A rejected targeted encounter may be replaced by a whole native section or explicitly omitted; DEV text shows the reason.

Record A/B/C observations separately:

1. Does the warning attract attention, and can you identify the brief lock flash and upcoming launch? The early mine is distant; diagnostic timing does not prove visual recognition.
2. Does the mine respond to your pre-lock position? Does its path stay fixed after your post-lock move?
3. Can you deliberately dodge? Compare neutral, early reaction and late reaction without relying on invulnerability.
4. Does staying at an edge still feel trivial, or does a clearly understood target require a decision?
5. Is the warning too long, the attack too aggressive or the encounter frustrating? Is the targeting more engaging than A/B?
6. Are ordinary asteroids/wrecks readable around it, controls stable and pause/restart correct? Check desktop and physical portrait/landscape phones.

The ZIP includes actual canvas videos and full-page screenshots. Canvas video omits HTML HUD/audio; stage screenshots include DEV text. Scripted certificate-following stage captures are labelled as actual model runs; the no-retarget video instead uses causal steering 54 ticks after lock. None substitutes for human feedback.

Recommended next task: owner acceptance/rejection and focused bounded publication improvement before collectibles or advanced encounter patterns. Do not merge/promote from automated exposure metrics alone.
