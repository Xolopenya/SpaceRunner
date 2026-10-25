# Measured A/B comparison and decision

**Decision: retain B as a selectable experiment, reject promotion as a gameplay solution.** It produces more accepted geometry and shorter gaps, but easy side/corner play remains effective. Do not loosen validation or add another system to rescue it. The next proposed content experiment is one coherent large static obstacle with a separately reviewed collider/readability contract. No such content is implemented here.

Human participants in this task: **0**. No enjoyment, preference, fairness perception or willingness-to-retry result is claimed.

## Corpus and measurement contract

456 runs:16 historical seeds ×12 predetermined histories ×2 policies at startup (384), plus seeds0,42,4294967295 ×12 histories ×2 policies in explicit late warm starts (72). Each observes60s at120Hz. The historical corpus is `[0,1,2,3,7,11,23,42,64,127,255,1024,4096,65535,2147483647,4294967295]`.

Every A/B pair shares its exact tape and initial XY/velocity/clocks. Early state is distance/time0; late is distance5280/time180,zero lateral velocity,empty known field and an ahead ownership frontier. Late roots are engineered starts, not invented preceding player histories. Early windows cover1410.0292 units each; late windows2040.0000. Both variants total344165.6 matched units each. These are independent windows, not one uninterrupted run.

The research actor continues after three-hit death to compare publication over the same progression windows. Reported survival ends at actual modeled death; subsequent contacts are research data. Early prefixes are differentially checked against the unchanged real GameModel. All accepted witnesses receive independent full unpruned replay. Inputs, simulation ticks/clocks, complete proposals/commits, roots, controls, omissions and geometry are retained per run. Seed alone cannot reproduce an input-dependent admitted world.

## Proposed versus actually published geometry

Primary densities count centers inside identical half-open traveled windows, including omitted/empty spans and startup. Future published objects outside the window do not inflate the result. Secondary scheduled-span rates below deliberately use a different denominator.

| Measure | A / baseline | B / pressure |
| --- | ---: | ---: |
| Proposed centers /100 matched units |4.3967|6.9734|
| Accepted centers /100 matched units |3.8935|5.8719|
| Proposed /100 scheduled units |4.7556|7.4739|
| Accepted /100 scheduled units |4.2058|6.2956|
| Completed scheduled sections |3600|4980|
| Committed sections |3229|4305|
| Uncertified omissions |371 (10.31%)|675 (13.55%)|
| Final publication collision vetoes |293|578|
| Final validation collision rejections |78|97|
| Certified empty outcomes / deadline failures |0 /0|0 /0|
| Peak known hazards / ownership records |15 /4|18 /4|

B increases matched accepted density50.8%, while omissions increase3.25 percentage points. All omitted spans stay in the denominators. No hidden selective obstacle removal or extra safety retry improves those figures. Raw attempt reasons retain earlier failures as well as the final category; they are not interchangeable counts.

| Accepted depth gaps (window edges included) | A | B |
| --- | ---: | ---: |
| Median |22.2869|12.5471|
| p95 |57.2126|35.6075|
| p99 |148.4845|112.2071|
| Maximum |271.6363|229.5260|
| Nearby-hazard-free time |50.58%|45.84%|
| Axial-hazard-free time |39.44%|35.67%|
| Longest nearby-free interval |12.550s|10.158s|

Nearby means an actually published center within Euclidean10+radius of the current ship while q−D lies in[−8,10+radius]. Axial presence drops the XY condition. The complete known logical field conservatively retains sources after damage disappearance; actual hull events separately require an active slot and immunity expiry. The same clocks/publication/retirement definitions apply to both variants. Neither percentage measures boredom or forced avoidance. A small depth gap alone is not a structural separation violation because XY separation also matters; the unchanged structural validator checks full3D separation.

## Progression, first encounter and variety

| Band | A accepted /100 | B accepted /100 | A omissions | B omissions |
| --- | ---: | ---: | ---: | ---: |
| Early,192 runs each |3.8378|5.8288|288/2832|526/3948|
| Late,36 runs each |4.0986|6.0308|83/768|149/1032|

These bands have different seed counts and startup roots. They demonstrate real distance-dependent policy output, not a universal monotonic difficulty/enjoyment curve.

| Selected family → actually committed sections | A | B |
| --- | ---: | ---: |
| ambient |2412→2211|1032→959|
| scattered |336→310|1212→1129|
| narrowing |336→273|1116→879|
| alternating |300→246|756→615|
| vertical-weave |216→189|864→723|

No committed source in this corpus changes family through an ambient fallback. The raw `actualSources` map distinguishes this from scheduled family metadata.

Distinct zero-steering-continuation threats total702→917; unique contacted hazards268→361. However, runs with no measured threat increase106→112/228, and fully contact-free windows112→115/228. Median first threat among runs with any threat is14.108→11.708s; its denominators are122 and116, with all other windows right-censored. This conditional median cannot conceal threat-free runs.

A threat is a published hazard actually hit by a1.5s zero-steering continuation from the current real position/residual velocity, sampled every0.1s with unchanged dynamics/calibrated CCD. It is a useful proximity probe, not a measured human decision. For seed42/neutral, first threat/contact is A23.008/24.442s, B43.808/45.308s: a concrete delayed-pressure regression despite higher counts. A dies at49.150s/1123.941 units; B survives the60s window. The separate90s smoke shows B eventually dies at88.383s, not infinite survival.

## Passive bypass investigation

All twelve policies below start at the same center/zero velocity, then follow a predetermined tape. Boundary/corner policies continuously hold the named direction; horizontal/vertical reverse every1.5/1.1s; irregular uses seeded direction holds without access to geometry. Each row has19 paired windows (16 early+3 late). Means mix those explicitly named bands; raw per-band outcomes remain available. Survival is censored at60s, not extrapolated.

| Input | Contact-free A/B | Survived60s A/B | Threats A/B | Contacts A/B | Mean survival s A/B | Mean survival units A/B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| neutral | 0/0 | 14/9 | 45/57 | 44/56 | 54.80/52.53 | 1370.65/1294.98 |
| left | 9/14 | 19/19 | 13/7 | 11/6 | 60.00/60.00 | 1509.50/1509.50 |
| right | 10/13 | 19/19 | 13/6 | 11/6 | 60.00/60.00 | 1509.50/1509.50 |
| top | 15/13 | 19/18 | 11/17 | 11/17 | 60.00/59.75 | 1509.50/1502.74 |
| bottom | 15/12 | 18/17 | 6/24 | 6/24 | 59.88/56.86 | 1506.16/1430.87 |
| bottom-left | 15/13 | 19/19 | 9/9 | 8/9 | 60.00/60.00 | 1509.50/1509.50 |
| top-left | 14/15 | 19/19 | 8/8 | 7/8 | 60.00/60.00 | 1509.50/1509.50 |
| bottom-right | 16/16 | 19/18 | 6/7 | 6/7 | 60.00/59.65 | 1509.50/1500.21 |
| top-right | 14/17 | 19/18 | 6/6 | 6/6 | 60.00/59.30 | 1509.50/1491.26 |
| horizontal | 1/1 | 6/15 | 222/212 | 62/46 | 48.83/56.87 | 1204.40/1405.85 |
| vertical | 0/1 | 6/4 | 190/317 | 62/97 | 45.21/41.81 | 1125.73/1005.17 |
| irregular | 3/0 | 15/5 | 173/247 | 34/79 | 57.80/44.83 | 1442.57/1090.80 |

Left and right boundaries survive19/19 in both variants. Their contact-free counts worsen9→14 and10→13. Across all four corners, contact-free windows increase59→61/76; three-hit survival changes76→74/76. This does not meet the goal of reducing easy boundary dependence. More deaths under irregular/vertical tapes do not compensate for that failure or establish fun.

Seed42/top-right is a recorded veto-bias case: A commits its one corner3-targeted encounter and contacts at39.083s. B proposes three corner3-targeted encounters (indices1 narrowing,7 weave,18 narrowing); all three fail actual publication with STALE_PUBLICATION_STATE/COLLISION_FOUND. B still publishes82 total objects versus A66, but has zero threats/contacts in60s. This directly separates proposal intent from accepted pressure. Rejection is the correct safety behavior; finite prepared-witness failure does not prove no route exists. No validator workaround is introduced.

## Visual evidence and practical conclusion

`pressure-baseline-desktop-12s.png` and `pressure-pressure-desktop-12s.png` are actual1280×800 game captures at identical seed42/neutral/12s/248m with3/3 hull. B places a large close rock to the left/lower edge, while the center remains open in both images. They demonstrate changed accepted positions and readable silhouettes; one image cannot establish warning time or required maneuvering.

Four live desktop/portrait captures and two decoded native canvas WebMs show actual rendering in motion. Their time-indexed horizontal inputs match by simulation tick, while terminal wall-clock profiles can differ slightly. `pressure-geometry-comparison.png` is explicitly a data projection of recorded accepted geometry/omitted spans and the actual neutral trajectory, not a game screenshot or a collision proof.

The experiment changes real published gameplay and preserves safety/production, but fails the boundary-pressure acceptance goal. Keep A as the default DEV policy, retain B for owner comparison, stop further pressure-system expansion here, and move to a narrowly scoped large-static-obstacle content experiment only after owner/architecture authorization. Human comparison and device/readability assessment remain pending.
