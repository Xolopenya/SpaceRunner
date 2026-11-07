# Safety and cadence

Primary corpus:four seeds0/11/42/99 ×60Hz/30Hz/10Hz/periodic12-step catch-up ×approved/candidate =32 three-hull flights to2500m. Candidate uses the approved run's exact fixed inputs at the same cadence. All16 final authoritative hashes and decision/publication/witness histories match the approved source.544 accepted witnesses independently replay;published witness roots match actual elapsed/distance/ship state. No field fault,unverified commit,stale mine capture,invalid accepted replay or more than one active mine occurred. Every witness-following run ends hull3 in Phase2.

| Cadence | Mine proposals /certified /not admitted | Omitted sections | Planning deadlines | Rejected actual-root checks |
| --- | ---: | ---: | ---: | ---: |
|60Hz,2 steps|19 /17 /2|6|0|12|
|30Hz,4 steps|19 /18 /1|9|5|14|
|10Hz,12 steps|19 /18 /1|69|68|1|
|60Hz with periodic12-step catch-up|19 /18 /1|4|0|11|

Values aggregate the four candidate seeds;approved has identical outcomes. A rejected actual-root check can be followed by a separately certified fallback,so it is not synonymous with a completely omitted encounter. Proposed/not-admitted counts and pending-at-end fields are retained in raw records rather than hidden.

The maximum consecutive omitted-decision span is136.49m/4.69s at60Hz,276.42m/11.63s at30Hz,863.82m/27.56s at10Hz and113.01m/3.50s under catch-up. These are distances/times between decisions,not measured empty-screen intervals:already published hazards may remain. At10Hz the future ordinary field becomes substantially sparser. This is a known approved fail-closed degradation,not a new release regression. No budget increase,extra query skip or weaker margin was used to improve admission.

Each render interval remains bounded by6144 propagations/12288 narrow queries,while deadlines advance in120Hz simulation time. Already-published mine physics is tested separately:1054 actual controller ticks from one published seed42 mine are regrouped under2/4/12-step intervals. Every state matches the original live controller;all three hashes are86d6e13fe4ecc235a0489d79db1881ecef8ef002e8eb79dc94dc9f7c241629a8. This proves that matched published controller history,not equality of future publication across cadences.

Pause freezes actual state;restart while a planning job is pending returns CANCELLED and clears ownership,mine,rewards and frame budgets. Existing unit/browser tests retain body,left/right wing-only hits,lower graze,diagonal/high-speed swept tests,multiple-part single damage,immunity,all five station apertures,reactive mine endpoints,solid-occluded pickup and invalid witness rejection. ship-collider-audit and the historical phase audit run in addition to the integrated audit.

The release gate permits these bounded omissions because they match the owner-approved baseline and never publish uncertified geometry. An accepted replay failure,collision mismatch,stale commit or unbounded work would stop promotion. Physical-phone reaction/readability and universal fairness for arbitrary human input are not claimed.
