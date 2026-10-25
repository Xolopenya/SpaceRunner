# Repeatable owner A/B playtest

Actual new human participants recorded by this task: **0**. The prior owner's qualitative feedback motivated the experiment; it is not a new A/B preference result. Endless gameplay has no90s limit;90s is only the observation window below.

Run `npm run dev`, use the same device/viewport/audio settings, then play three runs each:

| Pair | A | B |
| --- | --- | --- |
| 1 | `http://127.0.0.1:5173/?debug=field&policy=baseline&seed=42` | `http://127.0.0.1:5173/?debug=field&policy=pressure&seed=42` |
| 2 | `http://127.0.0.1:5173/?debug=field&policy=baseline&seed=0` | `http://127.0.0.1:5173/?debug=field&policy=pressure&seed=0` |
| 3 | `http://127.0.0.1:5173/?debug=field&policy=baseline&seed=4294967295` | `http://127.0.0.1:5173/?debug=field&policy=pressure&seed=4294967295` |

Observe60–90s or until natural death. Alternate A→B and B→A order across participants/pairs. Give equal familiarization, keep ship/camera/hull/scoring unchanged, and note pauses or interruptions. Reload a URL to start a fresh paired run; Replay preserves policy and seed. WASD/arrows/touch steer, Escape/P pauses, release brakes. Focus loss pauses; deliberately resume.

Use ordinary steering for the three primary pairs. Separately try neutral, each side and all four corners; label these bypass probes. A finite surviving corner is a concrete failure case, not proof of an infinite safe stripe. Different player inputs produce different admitted worlds even with the same seed.

## Local record sheet

For each attempt record participant pseudonym, device/browser/viewport, controls, order, seed, exact policy/version, observation duration, distance/hull/hits/death, long idle periods, actual reasons to change course and voluntarily chosen retries. With consent capture a local screen/input recording; do not add remote telemetry or collect private identifiers.

Ask after each pair:

1. What made you change trajectory, and how often?
2. Were there long boring stretches?
3. Could you read upcoming hazards and available routes in time?
4. What caused each collision? Was anything surprising or unfair?
5. Did staying at a boundary avoid meaningful choices?
6. Which version was more enjoyable, and why?
7. Would you choose another attempt?

Count a meaningful decision only when the player identifies a concrete threat, alternatives and a chosen maneuver. Key presses, jitter, velocity reversals and automated threat proxies do not automatically count as decisions.

## Optional reproducibility capture

The DEV console exposes `window.spaceRunner.model.field.policy`, `.events`, `.lastOutcome` and `.ledger.knownHazards(distance)`. These live rings are bounded (64 events/2048 samples); save locally before expiry if needed. Do not treat them as a complete recorded-input replay. The automated raw files in the review package contain full predetermined histories, clocks and committed geometry; use those for exact machine comparisons.

## Acceptance and stop rules

The owner may accept B only after real evidence of more meaningful steering/enjoyment with readable routes and explainable collisions, without unacceptable omissions, longer empty periods or performance cost. Report actual participant count and all runs, including adverse ones. One owner is n=1, not a fabricated panel or statistical result.

Do not accept B solely because more rocks are visible. Reject rollout if easy edge parking persists, vetoes materially rise, readability/fairness deteriorates, or play becomes exhausting. If the current compact existing-content policy remains ineffective, stop tuning this experiment and request a dedicated coherent large-obstacle content experiment with its own collider/readability review. Do not add that mechanic here.
