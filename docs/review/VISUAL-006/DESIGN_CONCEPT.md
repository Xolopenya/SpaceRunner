# VISUAL-006 — Fragmented Warp Field

Baseline: `218d6a1d477d9a61b08c0abd1828aa61c3b95562`. Branch: `feature/visual-006-fragmented-warp-field`. Experimental presentation only; owner selection remains pending.

The previous continuous threads read as perspective rails and cut through station cross-sections. This experiment replaces surfaces with isolated curved ribbons, negative space and distance-driven flow. The center remains open space. The existing navy sky, mine red and brighter mint/white Energy Fragment retain their visual roles.

| Mode | Composition | Intended trade-off |
| --- | --- | --- |
| `legacy` | Exact005B2 four-surface corridor | Continuous boundary reference; old rail appearance |
| `fragmented-arcs` | 20 incomplete arcs | Recognizable curved field fragments; least longitudinal flow |
| `flowing-filaments` | 28 gently bending strands | Peripheral speed; fewer transverse orientation cues |
| `fragmented-warp` | 12 arcs,16 filaments,8 short streaks | Restrained mixed research candidate |

Counts are fixed pool selections, not the number simultaneously visible. The pool contains56 fragments; depth envelopes and station exclusion reduce visible content. The combined policy is the initial Play default because the brief requests it, not because an owner or automated test selected a winner.

`FIELD` in `src/visuals/fragmented-warp.ts` centralizes the values:256m period,32m behind-plane recycling region,24 subdivisions,1.6m exclusion feather,0.10m conservative strip clearance,ambient0.30/proximity boost0.65. Ribbon half-widths:arc0.12m,filament0.10m,streak0.07m; arc transverse spans0.9–2.4m,filaments5–16m,streaks1–2.8m. Arcs bow in depth by up to1.4m; filaments drift transversely by up to0.48m. Tint `#5aaabc` is attenuated by ribbon/core/end/depth envelopes.

Local fixed-seed variation and a golden-ratio depth distribution avoid full rings and long randomly empty stretches. The first inspected iteration was too faint; the final width/intensity/distribution was adjusted after actual Chrome screenshots. No imported art, dependency, light or postprocessing was added.
