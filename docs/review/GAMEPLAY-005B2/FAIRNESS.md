# GAMEPLAY-005B2 — fairness and publication

Baseline80e987d; exact frozen sources in the audit. `polish-preservation.mjs` checks111 unchanged approved runtime/assets outside the ten focused correction files, plus exact single-purpose replacements in the model/settings seams. Controls, camera, speed/Phase2, mine behavior/frequency, station solids/openings, families, progression, hull/immunity, HUD/audio and numerical budgets are preserved.

## Corpus

Eight seeds0/1/7/11/16/20/42/99 × witness/neutral/collect, before and after:48 genuine three-hull runs, stopping at death or2500m. All eight current-witness pilots reach2500m with hull3 and Phase2. All **729 committed witnesses** replay independently, preserving their hashes, including compound homing feedback. No field fault is observed. Raw decisions, actual placements, hits, query metrics and planner samples are retained in polish-audit.json.

| Whole corpus | Before | Corrected |
| --- | ---: | ---: |
| Committed sections |366|363|
| Omitted sections |34|36|
| Longest consecutive omission chain |2|1|
| Mine publications |84|82|
| Station publications |37|44|
| Fragment placements |96|97|
| Planner propagations |36,193,899|35,960,492|
| Billed narrow queries |32,372,214|31,953,993|
| Maximum chunk propagations /queries |3072 /6144|3072 /6144|
| Largest forward hazard-free interval |347.04m /15.05s|225.43m /10.16s|
| Longest time between committed publication receipts |18.39s|13.53s|

The forward-gap metric unions committed hazard axial extents plus the applicable ship axial extent, after the first hazard; it is not an empty-screen duration or an escape corridor. Receipt intervals measure publication timing, not visible object spacing. Own witness/collect steering and death horizons differ between shapes; these totals are descriptive, not a controlled estimate of gameplay improvement. A smaller hitbox does not imply uniformly higher admission; the closed-loop validator may choose another candidate and later state.

## Identical inputs

The eight baseline witness input histories are also replayed against the corrected live generator to the same horizon. Counts before→after: seed0 22/0→22/0,1 21/1→21/1,7 20/2→20/2,11 23/0→23/0,16 19/3→19/3,20 22/0→21/1,42 20/3→20/3,99 21/2→22/1 (committed/omitted). Seeds0 and99 end with hull2; the others hull3. These old controls are not the new validator's recommended controls after a publication changes. They are not described as new safe-route witnesses. matched-publication.json records the first changed actual publication, later contact, detailed work and168 independent replays of the newly accepted witnesses. For seed0 a previous ambient fallback is replaced by the real left-opening station near1902m; the old steering later hits its solid at X−6/Y3.6. For seed99 a previously omitted section becomes a center-opening station near1254m, and the old route later reaches its solid at X6. Both are body contacts against different actual fields, not a new wing hit on an unchanged old-safe obstacle.

The actual current-witness corpus, rather than an obsolete control trace, establishes no-damage route replay. Unit tests retain old-body witness rejection, release profile enforcement, exact station tangency guards,12000 broad-phase differentials,10000 body-hazard differentials, actual runtime/publication matching and adaptive wing-only endpoints. Unsafe sections remain fail-closed. No margin, obstacle volume, search beam, deadline or budget was weakened.

The sample shows a small change in admissions, no systematic omission-chain collapse and unchanged hard query limits. It is not a claim that more/less publication automatically improves feel. Human playtesting of the revised hitbox and optional pickup is still required.
