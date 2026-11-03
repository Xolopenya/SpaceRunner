# Known limitations

- Placement is a bounded local heuristic, not a certified collision-free pickup route. The safe route that ignores rewards remains certified. Greedy automated pilots lose hull later in some runs; this result is retained.
- Owner/human approval of readability, enjoyment and tuning has not been provided. Three recorded scenarios demonstrate real simulation, not human skill or approval. Physical phones have not been tested; browser touch emulation is covered by the existing suite.
- Fragment count has no persistence or best-fragment record. This is intentional scope. One render frame can aggregate simultaneous pickups into one sound/burst.
- Cadence depends on accepted geometry. No guaranteed maximum reward gap; station opportunities can shorten the ordinary threshold. No continuous reward chains or phase-specific reward difficulty.
- A .32 pickup sphere differs from the decorative halo. The usual existing .42 ship proxy is used, not triangle-mesh contact with wings.
- Performance is measured locally on headless Chrome and Node. CPU submission measurements, noisy allocator samples and finite restart checks do not prove physical-device FPS, GPU latency or indefinite absence of leaks. Existing planner spikes and Vite's large-chunk advisory remain.
- Review materials are for this feature branch. No main merge, public deployment, mine integration, economy or new obstacle families are included.
