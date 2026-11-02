# Gameplay comparison

The owner's rejection of frozen Target-Lock is the reason for this experiment. Increased collision counts alone do not establish enjoyment. The required behavior is current-position pursuit that can be manipulated through a deliberate reversal.

Precommit corpus:84normal three-hull games =4policies×3seeds×7histories. Histories are causal witness following, neutral, horizontal, boundary, touch-shaped, early reversal and late reversal. Witness followers each reach3000units at hull3; ordinary input games stop on death or1200units. No invulnerability, post-death continuation or removed static debris is credited. Different survival lengths produce different proposal exposure; the following totals are not a controlled probability estimate.

| Policy | Proposed | Published | Omitted | Published fixed-grid / contacts | Published perimeter / contacts | Actual mine X-heading reversals in live games |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Target-Lock | 65 | 48 | 17 | 75 /75 | 48 /48 | 0 |
| Soft | 66 | 38 | 28 | 58 /58 | 35 /35 | 21 |
| Balanced | 62 | 44 | 18 | 64 /64 | 40 /40 | 39 |
| Aggressive | 62 | 44 | 18 | 70 /70 | 44 /44 | 51 |

Each policy's grid has75attempted seed/XY positions; unpublished positions are not harmless published mines. All published static positions in this engineered grid face mine contact, including the perimeter. This demonstrates relevance and removes universal edge camping in the tested set; it does not guarantee every boundary encounter publishes. Balanced's29% omissions remain a practical limitation, while its first certified mine is readily available for the supplied test seeds. Do not promote the experiment on these totals alone.

Input-change count includes continuous analogue changes, so axis sign reversals are separately recorded. Full real-game X/Y travel, input changes/sign reversals, actual mine integrated heading angle/reversals and every outcome/work chunk are in `adaptive-homing-benchmark.json` / `adaptive-homing-witnesses.json`. Search omissions and earlier ordinary-asteroid deaths remain visible. A heading reversal caused by current-target feedback is different from the frozen Target-Lock's constant heading.

The controlled mine-only response corpus compares neutral, eight early-away timings, six72-tick bait timings, a late long bait, repeated/irregular inputs and five held directions on seeds42/43 for all policies. Logs retain minimum swept clearance, proximity time, steering travel, mine heading changes, reversal state, correction delay, overshoot and depth-plane pose. Early movement can escape; moving early then parking at an edge can still be caught. A30-tick late reversal can collide. No claim is made that every early action succeeds.

The mandatory continuous demonstration uses seed43/Balanced: neutral until232ticks before the plane, right for72ticks, then left160ticks before the plane. Ship is still moving right at8units/s when input reverses; the mine is also moving right. Ship turns left while the mine continues right, then the mine corrects too late to meet Ship at the plane. The native video and actual120Hz trace retain ordinary debris, hull3 and zero hits. Default seed42 also has a reproducible longer bait/reverse132ticks before the plane; its30-tick late counterpart loses one hull. These are mechanical demonstrations, not invented human feedback.

Fixed-depth pursuit offers3s of approaching guidance and a much shorter lethal proximity window. The visibility logs report projected size/frustum/fog proxies, not recognition. Owner testing must judge whether the red lamp, size, speed and approach make the cause of a miss understandable. Balanced is the research default; Soft/Aggressive remain explicit comparisons. No normal-run rollout is authorized.
