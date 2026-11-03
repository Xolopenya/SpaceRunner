import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Mesh } from 'three';
import { CONFIG } from '../src/config.ts';
import { ReleaseModel } from '../src/release/model.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { FragmentRun } from '../src/collectibles/run.ts';
import { FragmentView } from '../src/collectibles/view.ts';
import { fragmentClear, fragmentReachable, proposeFragment } from '../src/collectibles/placement.ts';
import type { FragmentProposal } from '../src/collectibles/placement.ts';
import { FRAGMENT as S } from '../src/collectibles/settings.ts';
import { wreckTransaction } from '../src/experiments/structure-variants/encounter.ts';
import { APERTURE_NAMES } from '../src/experiments/structure-variants/profile.ts';
import { certifiedInput, fragmentInput } from './fixtures/fragment-flight.ts';

const root = { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, distance: 0, elapsed: 0 };
const p: FragmentProposal = { id: 'fixture', section: 4, anchor: 'fixture-hazard', situation: 'debris', x: 0, y: 0, passDistance: 10 };
function fixture(run = new FragmentRun(), proposal = p) { run.slots[0]!.proposal = proposal; run.slots[0]!.state = 'active'; return run; }

test('A/F: swept pickup includes edge, high speed and lateral crossings exactly once', () => {
  for (const [x0, x1, y, d0, d1] of [[0, 0, 0, 9.8, 10.1], [0, 0, .739, 9, 11], [-2, 2, 0, 9.9, 10.1], [0, 0, 0, 1, 20]]) {
    const r = fixture(); r.step(x0!, y!, d0!, x1!, y!, d1!, 1);
    assert.equal(r.count, 1); assert.equal(r.slots[0]!.state, 'collected'); assert.equal(r.active.length, 0);
    r.step(x0!, y!, d0!, x1!, y!, d1!, 2); assert.equal(r.count, 1);
  }
});
test('B: a near miss beyond the combined .74 radius never collects and retires', () => {
  const r = fixture(); r.step(0, .741, 9, 0, .741, 11, 1); assert.equal(r.count, 0);
  r.step(0, 0, 18, 0, 0, 19, 2); assert.equal(r.slots[0]!.state, 'retired'); assert.equal(r.active.length, 0);
});
test('F: actual Phase 2 step collects while hull protection is active', () => {
  const m = new ReleaseModel(); m.ready(); m.start(42); m.distance = 500; m.elapsed = 120;
  m.invulnerability = 1; m.field.update = () => {};
  fixture(m.fragments, { ...p, passDistance: 500.15 }); m.step(CONFIG.step, { x: 1, y: 0 });
  assert.equal(m.phase, 2); assert.equal(m.speed, 36.72); assert.equal(m.fragments.count, 1); assert.equal(m.hull, 3); m.dispose();
});
test('C: a pickup neither disables nearby damage nor grants hull, immunity or score', () => {
  const m = new ReleaseModel(); m.ready(); m.start(1); fixture(m.fragments, { ...p, passDistance: .1 });
  m.field.update = () => {}; // Controlled damage fixture; no procedural admission claim.
  const h = m.field.hazards[0]!; Object.assign(h, { active: true, x: 1.5, y: 0, z: -.1, radius: .5, kind: 0 });
  m.step(CONFIG.step, { x: 0, y: 0 }); assert.equal(m.fragments.count, 1); assert.equal(m.hull, 3); assert.equal(m.invulnerability, 0);
  Object.assign(h, { x: .1, z: -.1 }); m.step(CONFIG.step, { x: 0, y: 0 });
  assert.equal(m.hull, 2); assert.equal(m.fragments.count, 1); assert.ok(m.invulnerability > 0); assert.equal(m.score, Math.floor(m.distance));
});
test('E: every aperture uses actual four solids; no fragment is inside a wall', () => {
  let placed = 0;
  for (const aperture of APERTURE_NAMES) for (const seed of [0, 11, 42]) {
    const tx = wreckTransaction(seed, 8, aperture, 'mixed');
    const result = proposeFragment(tx, root, tx.hazards, [], () => {});
    if (result) { placed++; assert.equal(result.situation, 'aperture'); assert.ok(fragmentClear(result, tx.hazards)); }
    assert.equal(fragmentClear({ x: 7, y: 0, passDistance: tx.hazards[0]!.passDistance }, tx.hazards), false);
  }
  assert.ok(placed >= 10);
});
test('lead, opposing velocity, bounds, nearby solids and duplicate spacing reject conservatively', () => {
  assert.ok(fragmentReachable({ ...p, x: 2, passDistance: 180 }, root));
  assert.equal(fragmentReachable({ ...p, passDistance: 20 }, root), false);
  assert.equal(fragmentReachable({ ...p, x: 6, passDistance: 180 }, root), false);
  assert.equal(fragmentReachable({ ...p, x: 4, passDistance: 80 }, { ...root, player: { ...root.player, vx: -8 } }), false);
  const tx = new FieldGenerator(42).propose(8, 3), a = proposeFragment(tx, root, tx.hazards, [], () => {});
  assert.ok(a); assert.ok(fragmentClear(a, tx.hazards));
  const wall = { ...tx.hazards[0]!, x: a.x, y: a.y, passDistance: a.passDistance, radius: 30 };
  assert.equal(proposeFragment(tx, root, [...tx.hazards, wall], [], () => {}), undefined);
  assert.equal(proposeFragment(tx, root, tx.hazards, [a], () => {}), undefined);
});
test('G/H: pause freezes complete run state; restart clears count, identities and all slots', () => {
  const m = new ReleaseModel(); m.ready(); m.start(42); fixture(m.fragments);
  m.fragments.count = 7; m.pause(); const before = JSON.stringify(m.fragments);
  for (let i = 0; i < 20; i++) m.step(CONFIG.step, { x: 1, y: 1 });
  assert.equal(JSON.stringify(m.fragments), before); m.resume(); assert.equal(m.fragments.count, 7);
  const slots = [...m.fragments.slots]; m.state = 'GAME_OVER'; m.start(42);
  assert.equal(m.fragments.count, 0); assert.equal(m.fragments.active.length, 0);
  assert.ok(slots.every((s, i) => m.fragments.slots[i] === s && !s.proposal)); m.dispose();
});
test('I/K: same inputs preserve placement identities, exact hazard admission and certified optional routes', () => {
  const a = new ReleaseModel(), b = new ReleaseModel(); a.ready(); b.ready(); a.start(42); b.start(42);
  // Counterfactual has no collectibles; hazard source/validator/inputs are identical.
  b.fragments.published = () => {};
  const placed = new Map<string, FragmentProposal>();
  for (let tick = 0; a.distance < 1100 && tick < 7200; tick++) {
    const input = certifiedInput(a); a.step(CONFIG.step, input); b.step(CONFIG.step, input);
    for (const f of a.fragments.active) placed.set(f.id, f);
    assert.deepEqual(a.ship, b.ship); assert.equal(a.distance, b.distance); assert.equal(a.hull, b.hull);
    assert.equal(a.field.committed, b.field.committed); assert.equal(a.field.omitted, b.field.omitted);
    assert.equal(a.field.certificate?.hash, b.field.certificate?.hash);
  }
  assert.equal(a.hull, 3); assert.ok(placed.size >= 2); assert.ok(a.fragments.stats.retired > 0);
  a.state = 'GAME_OVER'; a.start(42); const replay = new Map<string, FragmentProposal>();
  for (let tick = 0; a.distance < 1100 && tick < 7200; tick++) { a.step(CONFIG.step, certifiedInput(a)); for (const f of a.fragments.active) replay.set(f.id, f); }
  assert.deepEqual([...replay], [...placed]); a.dispose(); b.dispose();
});
test('J: mesh and authoritative pools stay fixed across restarts and dispose shared resources once', () => {
  const scene = new Scene(), view = new FragmentView(scene), m = new ReleaseModel(); m.ready(); m.start(1);
  const geometries = new Set(), materials = new Set(); let disposed = 0;
  view.root.traverse(n => { if (n instanceof Mesh) { geometries.add(n.geometry); materials.add(n.material); } });
  for (const item of [...geometries, ...materials] as { addEventListener(name: string, callback: () => void): void }[]) item.addEventListener('dispose', () => disposed++);
  for (let i = 0; i < 50; i++) { fixture(m.fragments); view.update(m, false); m.state = 'GAME_OVER'; m.start(1); view.reset(); }
  assert.equal(view.root.children.length, S.capacity + 1); assert.equal(geometries.size, 3); assert.equal(materials.size, 4);
  view.dispose(); view.dispose(); assert.equal(disposed, 7); assert.equal(scene.children.length, 0);
});
test('D/L: real ReleaseModel publishes only owned fragments and collects using unmodified movement', () => {
  const m = new ReleaseModel(); m.ready(); m.start(42); let collected = false;
  while (m.distance < 350 && m.state === 'PLAYING') {
    const target = m.fragments.active[0]; m.step(CONFIG.step, fragmentInput(m, target));
    for (const f of m.fragments.active) {
      assert.ok(m.field.ledger.knownHazards(m.distance).some(h => h.id === f.anchor));
      assert.ok(fragmentClear(f, m.field.ledger.knownHazards(m.distance)));
    }
    collected ||= m.fragments.count > 0;
  }
  assert.ok(collected); assert.equal(m.hull, 3); assert.equal(m.field.fault, undefined); m.dispose();
});
test('I: identical recorded movement reproduces pickup tick, count and final state after restart', () => {
  const m = new ReleaseModel(); m.ready(); m.start(42); const inputs = [], pickups: number[] = [];
  while (m.distance < 350 && m.state === 'PLAYING') {
    const input = fragmentInput(m, m.fragments.active[0]); inputs.push(input);
    const before = m.fragments.count; m.step(CONFIG.step, input); if(m.fragments.count > before) pickups.push(inputs.length);
  }
  const end = { ship: { ...m.ship }, count: m.fragments.count, distance: m.distance, hull: m.hull, witness: m.field.certificate?.hash };
  m.state = 'GAME_OVER'; m.start(42); const replay: number[] = [];
  inputs.forEach((input, i) => { const before=m.fragments.count; m.step(CONFIG.step,input); if(m.fragments.count > before) replay.push(i+1); });
  assert.deepEqual(replay, pickups); assert.equal(pickups.length, 1);
  assert.deepEqual({ship:{...m.ship}, count:m.fragments.count,distance:m.distance,hull:m.hull,witness:m.field.certificate?.hash}, end); m.dispose();
});
