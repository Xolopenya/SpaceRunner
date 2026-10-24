# GAMEPLAY-001B-3 integration notes

This milestone is a producer and research API. There is no continuous field in the playable game. Original waves, controls, camera, speed, collisions, health, scoring, UI, VFX, audio, assets and SDK seams remain unchanged.

## Request and admit

```ts
const producer = new PatternGenerator(seed);
const p = producer.propose({ family: 'vertical-weave', firstCell: 4,
  intensity: .8, variation: 0 }, nearbyCommitted);
if (p.status === 'proposed') {
  const job = beginValidation({ candidate: p.transaction,
    committed: nearbyCommitted, player, input, elapsed, distance });
  // Incremental research caller: advance once per distinct planning tick,
  // consume the bounded result, and independently retain/replay its witness.
}
```

No production caller is added. `proposed` means structure passed, not trajectory acceptance or permission to publish. A rejected request does not advance shared random history. Never retry secretly until a quota passes. If a caller chooses a simpler replacement, it must issue a reproducible different request/identity and validate that complete transaction separately.

## Contracts for a later approved milestone

1. Treat ambient-v1 anchor indices and encounter-v1 transaction ordinals differently. Preserve source metadata through serialization and pool mapping; never infer source from a visual model.
2. Reserve the complete2–6-cell source span, including empty cells, until its transaction ownership is explicitly released. Structural inspection cannot remember an encounter after its last record disappears; the future coordinator must retain that ownership ledger.
3. Provide all relevant committed hazards, respect12 candidates/32 known hazards and the unchanged72-record live pool, and apply real seam separation. A collection of isolated witnesses does not certify their union.
4. Use the actual current position, velocity, held input, time and distance. Preserve residual velocity across transitions. An accepted snapshot can become stale: later publication needs `beginPublicationCheck` and enough scheduling/reservation slack. Do not reset velocity at seams.
5. Preserve the empty terminal braking tail and its reserved-until bound. Do not fill it with a neighboring pattern merely because an earlier witness accepted. The joint corpus certifies the complete known union from one root, not a reusable chain of independent terminal certificates.
6. Keep approved4096 propagation/8192 query ceilings,3072/6144 default chunks, width16/expansion144 and144-tick job deadline. Future transaction-wide scheduling, publication cost and concurrent rendering require separate measurement.
7. Test entry roots near corners and with opposing velocities. This corpus includes translated/mirrored layouts and global center roots, but does not exhaust every root, setting or layout. There is no permanent protected X stripe built into the new producer; individual bypasses remain possible.

## Review gates

Review ownership/version migration, real witness geometry, bounded search failures, terminal reservations, bypass behavior, local CPU costs and finite memory evidence before authorizing B-4. Human readability, visibility under the actual camera, subjective enjoyment and recovery cadence need later live playtests. Whole transactions may span beyond the existing108-unit visible approach distance; mathematical reachability does not establish visual readability. Do not add live integration, director, worker, near-miss score or moving obstacles under this task.

There is no manual dependency setup beyond the existing lockfile. After a production build, `node --experimental-strip-types scripts/pattern-benchmark.mjs` runs the isolated corpus, Chrome comparison, plots, finite memory sample and approved historical diagnostics. Installed Chrome and local ports5189 and the historical harness ports are required. `npm run review:verify` runs the complete configured suite; `npm run review:pack` requires a clean committed tree and repeats it before packaging.
