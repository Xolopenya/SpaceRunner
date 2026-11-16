# Architecture

World no longer imports, creates, warms, resets, updates or disposes PickupGuidance.
The three dedicated source modules (guidance, settings, ribbon shader) are deleted.
Their two geometries/two materials, shader role and per-frame sight queries are
gone from production. No replacement overlay/event listener is introduced.
Historical C1 review scripts/docs remain historical evidence; the renderer does not
import them. Existing nonrendering diagnostics and collider debugging remain.

Runtime edits are limited to World and the existing collectible settings, run and
proposal types, plus the new focused `collectibles/trails.ts`. No new dependency,
backend, physics engine, model/view or authoritative hazard-source change.

FragmentRun remains the sole owner of scheduling, fixed slots, pickup sweep and
reward accounting. The existing successful-publication hook first asks the same
single-placement algorithm for a valid candidate. At one eligible successful group
per12, the optional template checks all members/continuous segments. It admits all
three atomically only with three free slots; otherwise it uses the valid singleton.
Failed opportunities keep the existing retry semantics. Moving-mine transactions
remain excluded by the unchanged ReleaseModel publication hook.

The module uses stateless FNV-derived hashes salted for cycle slot, shape and bend.
It never consumes the hazard RNG or calls the planner/director. The single identity
namespace is preserved to avoid needless single-candidate churn; trail members
have distinct suffixes. Configuration/commit identity determines replay behavior.
Restart clears counters, cadence and identities while retaining the eight slots.

New stats distinguish opportunities, successful groups, individual placements,
trails and per-shape counts, rejected upgrades, collections and retired misses.
One pickup still emits one existing event with reward1 and the existing ENERGY
total. Distance score, hull, immunity and mine behavior are unaffected. The same
post-pickup140ms attraction runs in FragmentView; no long-range magnet was added.

All template arrays/immutable proposals and geometric scratch are created only
at infrequent successful publications. The frame loop retains the existing
eight-slot sweep/view updates. All meshes/materials are the existing fixed pool;
more simultaneously visible shards use additional draws, not additional geometry
allocations. Partial pickup is ordinary per-member collection/retirement.

The complete sampled audio directory and audio/feedback/music/engine modules,
camera, movement, three damage spheres, generator, director, fairness logic,
approved shield/mine/destruction and UI are preserved byte-for-byte. Test changes
remove tests for rejected guidance, update intentional assistance/count boundaries
and extend natural trail/restart/mobile coverage. No hazard regression is removed.
