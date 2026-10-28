# Short owner A/B/C playtest

Run `npm run dev`. Launch these three URLs, each with the same seed and certified first encounter:

- [A baseline](http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=baseline&seed=42&firstMine=1)
- [B fast](http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=fast&seed=42&firstMine=1)
- [C diagonal](http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=diagonal&seed=42&firstMine=1)

The first mine reaches ship depth around8.78simulation seconds after Launch. Original ordinary asteroids precede it. Controls, acceleration, hull, damage, scoring, pause, restart and forward flight remain ordinary gameplay. The reproduction flag never bypasses certification; unsafe incoming steering can cause a recorded fallback/omission. Remove firstMine for the original normal mixed-flow frequency. Omitting motion selects original baseline; old mine=slow-ltr/rtl/moderate-ltr/rtl URLs still work.

Play one short attempt per mode, then repeat in C/B/A order with seeds11 and0. Approach center once, steer horizontally once and vertically once; try a constant edge as a separate adversarial attempt. Continue for30–60seconds or until natural death if useful. Use keyboard or real touch; certificate-driven videos are demonstrations, not owner evidence. Try pause/resume during motion and Replay after death. No forward throttle or depth waiting exists.

Record a1–5score plus a brief observation for each policy:

1. Can you recognize direction before it moves quickly, and before choosing an avoidance route?
2. Is the warning/response time comfortable, insufficient or excessive?
3. Does diagonal motion create a different decision, or merely a different visual path?
4. Can you explain a collision from the visible contact? Is edge grazing understandable?
5. Is the mine still trivial to bypass at a fixed position?
6. Is the higher speed enjoyable, frustrating or irrelevant?
7. Which policy, if any, should enter normal mixed flow?

For exact directions append mine=fast-ltr|fast-rtl to motion=fast, or mine=diagonal-ltr-up|diagonal-ltr-down|diagonal-rtl-up|diagonal-rtl-down to motion=diagonal. Conflicting policies/configurations reject. Append colliders=1 only for proxy inspection. The existing DEV aside identifies policy; trace export records IDs, exact motion, actual roots, controls and admission/rejection. Record seed, device/browser/orientation, policy/config, distance, hits, observed direction, footage and recent trace for unclear cases.

Owner feedback supplied for003C: visible red warning/model, correct contact/damage, but horizontal motion too easy. No new003C2human feedback is claimed. The measured fixed-position and release-input proxies did not improve materially. Owner policy selection remains the next task, with physical-phone performance and readability still unverified.
