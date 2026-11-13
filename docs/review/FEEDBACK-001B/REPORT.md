# FEEDBACK-001B — Collision, Damage & Destruction Visual Slice

Branch: `feature/feedback-001b-damage-destruction`.
Base: `5f5a4282d110187d7549e38366051ccfab139f6d` (local FEEDBACK-001A, not fetched or merged).
Exact delivery commit/tree, complete diff and status are recorded in the ZIP manifest
and `git/identity.json`. Unrelated user research/skill files are preserved/excluded.

## Delivered presentation

- 3 HP: original clean armor/engine presentation. 2 HP: persistent graphite scorch,
  exposed scratches and cyan fissure on an authored wing/rear-armor zone. 1 HP: an
  additional zone, broader aft scorching, electrical leakage and cosmetic engine
  instability. The first zone persists; damage never penalizes controls or speed.
- Rocks: solid low-poly spinning shards, dust and a compact contact flash. Industrial
  barrels/generators: thin metallic panels and directional amber/white sparks.
- Mines: cyan core glow, expanding shockwave, luminous plates and radial streaks,
  anchored to the accepted mine identity and captured pose. No proximity detonation.
- Stations: localized metallic spray/flash on a nearest existing proxy surface;
  the original heavy station remains intact through its existing retained rendering.
- Fatal contact: one coordinated fatal sound/contact, a short electrical/engine
  failure and presentation-only tumble, then six recognizable portions of the actual
  ship mesh separate amid energy, sparks, twelve instanced metallic splinters and a
  shockwave. The intact ship is hidden.
  Aftermath fades, then original results/replay appear. Standard duration2.05s;
  reduced motion0.65s. Space/Enter/Escape or the48px touch button skip immediately.

## Architecture and exact changes

The 001A FIFO/coordinator remains the only event-delivery mechanism. An optional
collision channel routes `obstacle.collision` from the same selected contact batch;
`player.damage` controls hull appearance, and `player.destroyed` starts the one-per-run
sequence. HUD still receives all facts, including run.start/end. Priorities remain
Minor/Medium/Major; fatal damage does not double-play an ordinary impact.

CollisionContext gains optional immutable `obstaclePose` (radius, phase, spin,
distance). GameModel changes by exactly one copied observation line. It retains
**every original 001A line**: inactive flag, HP, immunity, score, GAME_OVER and their
ordering. No collision kernel, trajectory validator, director, mine controller,
generator, movement/configuration, asset file, dependency or gameplay RNG is changed.

New `collision-presentation` reads existing proxy dimensions/transforms to estimate a
VFX surface/normal. This is not TOI or a second acceptance query. Production station
variants4–8 use their actual box profiles; kind9 uses the accepted moving-mine pose,
not `homing.current`. The older kind3 diagnostic uses the generic reference-sphere
placement fallback; it is not a production encounter.

HullDamage owns four cloned GLB material instances and one attached leak material.
Its shader evaluates scars on the actual normalized mesh, including rear surfaces
visible to Hybrid; no floating decal planes. The cached GLB geometry/materials remain
clean. ShipDestruction partitions original GLB triangles into six sections once at
initialization, retaining authored paint/silhouette. This approximates breakup, not
fracture physics. No geometry is generated/disposed during contact.

CollisionVFX owns three bounded burst slots with shared rock/panel/ring/plane geometry,
fixed instancing/particle buffers and reused materials. Visual randomness uses separate
keyed Random instances. Exhaustion safely skips presentation. New pools are uploaded
and shaders warmed in one cleared backing-store pixel during loading, using the real
framebuffer color space. Nothing is presented from that warmup and no gameplay event
is synthesized. Persistent hull appearance is separate from transient cancellation.

Game still finalizes score/best and stops platform gameplay immediately at GAME_OVER.
Only results visibility/focus and the secondary game-over cue wait for the bounded
presentation clock. No new gameplay state or unmanaged timer is added. Hidden tabs
freeze the sequence; WebGL interruption completes it safely so results remain usable.
Restart cancels old effects and pending cues. Existing master/music/SFX/mute/unlock
policy and original destruction sound remain; no new music or sound asset is added.

## Verification and scope

See TESTING.md and PERFORMANCE.md for final counts/measurements. Main visual proof
is actual unmodified production gameplay: an input pilot steers into naturally
published rocks, industrial debris, an identified adaptive mine and a station. The
three-hit death tape also supplies intact/damaged/critical/death/replay states in
desktop and portrait. It changes no entities, HP or cooldowns. Controlled fixtures
are separately labelled and used for lifecycle/accessibility edge tests.

No HUD redesign, combat, debris collision, upgrades, new encounter/generation policy,
material asset download or adaptive music. The inherited damage/phase-label overlap
is retained for stageD. Triangle sections have open cut edges visible on close
inspection, not sealed fracture interiors. Dust/clouds are lightweight additive
sprites, not volumetric simulation. Approximate proxy placement can differ from the
visible surface during fast rotation or wing-only contact; it never changes the hit.

Native desktop Chrome/mobile emulation are evidence, not physical-phone or owner
subjective acceptance. The existing Vite bundle-size advisory remains. All source,
original asset licenses, raw final frames, native recording, logs, performance data,
and SHA256/CRC inventory are in the review package. No push, main merge or deployment.
Main/heavy matrices average about60FPS; the separate heap series shifts toward30FPS
in the baseline before candidate measurement. The cause is not isolated. GC heap also
grows modestly across ten replays in both versions; stable GPU counts are not claimed
as proof of zero JS retention. Exact measurements and limits are in PERFORMANCE.md.

StageC can add sound variants/flight sensation through existing cue and camera seams.
Its work does not require replacing damage, breakup or results timing foundations.
