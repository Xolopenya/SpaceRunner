import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from 'three';
import { CONFIG } from '../src/config.ts';
import { WARP, WarpCorridor, ARENA_SIDES, boundaryProximity } from '../src/visuals/warp-corridor.ts';
import { ObjectReveal } from '../src/visuals/object-reveal.ts';
import { REVEAL, revealCoverage } from '../src/visuals/reveal-settings.ts';
import type { RevealFamily } from '../src/visuals/reveal-settings.ts';
import { IntegratedModel } from '../src/integrated/model.ts';
import { certifiedInput } from './fixtures/fragment-flight.ts';

const families: readonly RevealFamily[] = ['debris', 'station', 'mine', 'fragment'];
function fixture() {
  const reveal = new ObjectReveal(), material = new MeshBasicMaterial({ color: 0xabcfff }), geometry = new BoxGeometry();
  const root = new Group(), mesh = new Mesh(geometry, material);root.add(mesh);
  const target = reveal.register(root, 'debris');return { reveal, material, geometry, root, mesh, target };
}

test('warp surfaces align exactly to the authoritative center limits on all four sides', () => {
  const warp = new WarpCorridor();
  warp.sides.forEach((mesh, index) => {
    const side = ARENA_SIDES[index]!, horizontal = Math.abs(side) === 1, p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) assert.ok(Math.abs((horizontal ? p.getX(i) : p.getY(i)) - Math.sign(side) * (horizontal ? CONFIG.bounds.x : CONFIG.bounds.y)) < 1e-6);
    assert.equal(mesh.material.depthTest, true);assert.equal(mesh.material.depthWrite, false);
  });warp.dispose();
});
test('all edges and corners respond continuously without threshold flicker or a movement change', () => {
  const warp = new WarpCorridor();
  for (const side of ARENA_SIDES) {
    const horizontal = Math.abs(side) === 1, limit = horizontal ? CONFIG.bounds.x : CONFIG.bounds.y, sign = Math.sign(side);
    let previous = 0;
    for (let i = 0; i <= 1000; i++) {
      const p = boundaryProximity(side, horizontal ? sign * limit * i / 1000 : 0, horizontal ? 0 : sign * limit * i / 1000);
      assert.ok(p >= previous && p - previous < .02);previous = p;
    }assert.equal(previous, 1);assert.equal(boundaryProximity(side, 0, 0), 0);
  }
  for (const x of [-CONFIG.bounds.x, CONFIG.bounds.x]) for (const y of [-CONFIG.bounds.y, CONFIG.bounds.y]) {
    warp.update(x, y, 123, false);
    assert.equal(warp.sides.filter(m => m.material.uniforms.strength!.value === WARP.base + WARP.boost).length, 2);
  }warp.dispose();
});
test('warp phase wraps without geometry relocation, pause freezes and reduced motion removes streaks', () => {
  const warp = new WarpCorridor(), position = warp.sides[0]!.geometry.getAttribute('position').array.slice();
  warp.update(6, 0, 31, false);const state = JSON.stringify(warp.root.toJSON());
  for (let i = 0; i < 100; i++) warp.update(6, 0, 31, false);
  assert.equal(JSON.stringify(warp.root.toJSON()), state);assert.equal(warp.sides[0]!.material.uniforms.travel!.value, 31 % WARP.spacing);
  warp.update(0, 0, 1e9, true);assert.equal(warp.sides[0]!.material.uniforms.motion!.value, 0);
  assert.deepEqual(warp.sides[0]!.geometry.getAttribute('position').array, position);warp.dispose();
});
test('new certified identities enter a fresh reveal and finish within the existing reaction prefix', () => {
  const f = fixture();f.reveal.beginFrame(10);f.reveal.apply(f.target, 'one', 10, 90);
  assert.equal((f.reveal.diagnostic('one') as { coverage: number }).coverage, 0);
  f.reveal.beginFrame(10 + .18);assert.ok((f.reveal.diagnostic('one') as { coverage: number }).coverage > 0);
  f.reveal.beginFrame(10 + REVEAL.maximumBirthSeconds);f.reveal.apply(f.target, 'one', 10, 90);
  assert.equal(f.target.applied, REVEAL.banks);
  assert.ok(REVEAL.maximumBirthSeconds < 54 / 120);f.reveal.dispose();f.geometry.dispose();f.material.dispose();
});
test('shared GLB materials get bounded cohort variants; pooled objects do not get unique material clones', () => {
  const f = fixture(), targets = [f.target];
  for (let i = 0; i < 72; i++) targets.push(f.reveal.register(new Mesh(f.geometry, f.material), 'debris'));
  assert.equal(f.reveal.materials.size, REVEAL.banks + 1);
  f.reveal.beginFrame(3);for (let i = 0; i < targets.length; i++) f.reveal.apply(targets[i]!, String(i), 3, 100);
  assert.equal(new Set(targets.map(t => t.entries[0]!.mesh.material)).size, 1);
  assert.equal(f.material.transparent, false);assert.equal(f.mesh.material instanceof MeshBasicMaterial && f.mesh.material.transparent, false);
  f.reveal.dispose();f.geometry.dispose();f.material.dispose();
});
test('birth cohorts use separate uniform sets and saturation fails open without resetting an older cohort', () => {
  const f = fixture(), second = f.reveal.register(new Mesh(f.geometry, f.material), 'debris'), third = f.reveal.register(new Mesh(f.geometry, f.material), 'debris');
  f.reveal.beginFrame(1);f.reveal.apply(f.target, 'a', 1, 90);
  f.reveal.beginFrame(1.01);f.reveal.apply(second, 'b', 1.01, 90);
  const born = f.reveal.banks.map(b => b.birth);
  f.reveal.beginFrame(1.02);f.reveal.apply(third, 'c', 1.02, 90);
  assert.equal(third.fallback, true);assert.equal(third.bank, REVEAL.banks);assert.equal(f.reveal.fallbackCount, 1);
  assert.deepEqual(f.reveal.banks.map(b => b.birth), born);f.reveal.dispose();f.geometry.dispose();f.material.dispose();
});
test('pause, pool reuse, live legacy switching and restart retain correct material lifecycle', () => {
  const f = fixture();f.reveal.beginFrame(2);f.reveal.apply(f.target, 'old', 2, 100);
  const before = JSON.stringify(f.reveal.diagnostic('old'));
  for (let i = 0; i < 120; i++) f.reveal.beginFrame(2);
  assert.equal(JSON.stringify(f.reveal.diagnostic('old')), before);
  f.reveal.setMode('legacy');assert.equal(f.mesh.material, f.material);
  f.reveal.setMode('seamless');assert.notEqual(f.mesh.material, f.material);
  f.reveal.beginFrame(4);f.reveal.apply(f.target, 'new', 4, 100);
  assert.equal(f.reveal.diagnostic('old'), undefined);assert.equal((f.reveal.diagnostic('new') as { coverage: number }).coverage, 0);
  f.reveal.reset();assert.equal(f.target.id, undefined);assert.equal(f.mesh.material, f.material);assert.equal(f.reveal.fallbackCount, 0);
  f.reveal.dispose();f.geometry.dispose();f.material.dispose();
});
test('readability margins remain independent of camera aspect; warning, pickup and near geometry are fully covered', () => {
  const maxSpeed = CONFIG.flight.maxSpeed * 1.08;
  const fullArenaCorrection = .45 + CONFIG.ship.maxSpeed / CONFIG.ship.acceleration + 12 / CONFIG.ship.maxSpeed + CONFIG.ship.maxSpeed / CONFIG.ship.braking;
  assert.ok((REVEAL.debris.clear - 1.3 - 1.1) / maxSpeed > fullArenaCorrection);
  for (const family of families) {
    assert.equal(revealCoverage(family, REVEAL[family].clear, 1), 1);
    assert.equal(revealCoverage(family, REVEAL[family].far, 1), 0);
    assert.equal(revealCoverage(family, 0, 1), 1);
  }
  assert.equal(revealCoverage('mine', 116, 1), 1);assert.equal(revealCoverage('fragment', 2, 1), 1);
});
test('presentation resources dispose exactly once without disposing borrowed GLB geometry or materials', () => {
  const f = fixture(), warp = new WarpCorridor();let originals = 0, clones = 0, geometries = 0, surfaces = 0;
  f.material.addEventListener('dispose', () => originals++);f.geometry.addEventListener('dispose', () => geometries++);
  for (const m of f.reveal.materials) m.addEventListener('dispose', () => clones++);
  for (const m of warp.sides) { m.geometry.addEventListener('dispose', () => surfaces++);m.material.addEventListener('dispose', () => surfaces++); }
  const count = f.reveal.materials.size;f.reveal.dispose();warp.dispose();
  assert.equal(originals, 0);assert.equal(geometries, 0);assert.equal(clones, count);assert.equal(surfaces, 8);f.geometry.dispose();f.material.dispose();
});

function state(m: IntegratedModel): string {
  return JSON.stringify({ distance: m.distance, elapsed: m.elapsed, ship: m.ship, hull: m.hull, hits: m.hitSerial, immunity: m.invulnerability,
    hazards: m.field.slots, fragments: m.fragments.slots, count: m.fragments.count, feedback: m.homing.current, publications: m.field.events,
    ownership: m.field.ledger.snapshot() });
}
test('four visual modes leave real integrated inputs, publication, collision and pickup state identical through Phase 2', () => {
  let expected: string | undefined;const inputs: { x: number; y: number }[] = [];
  for (const mode of ['legacy', 'seamless', 'legacy', 'seamless'] as const) {
    const m = new IntegratedModel(), warp = new WarpCorridor(), f = fixture();m.ready();m.start(42);f.reveal.setMode(mode);
    for (let tick = 0; tick < 5000; tick++) {
      if (tick % 2 === 0) m.beginPlanningFrame();
      const axis = inputs[tick] ?? certifiedInput(m);if (!inputs[tick]) inputs.push({ ...axis });
      m.step(1 / 120, axis);f.reveal.beginFrame(m.elapsed);f.reveal.apply(f.target, 'fixture', 0, 100);warp.update(m.ship.x, m.ship.y, m.distance, false);
      if (tick % 2 === 1) m.finishPlanningFrame(1 / 60);
    }
    assert.equal(m.phase, 2);assert.equal(m.hull, 3);assert.equal(m.field.fault, undefined);
    const actual = state(m);if (expected) assert.equal(actual, expected);else expected = actual;
    m.dispose();f.reveal.dispose();warp.dispose();f.geometry.dispose();f.material.dispose();
  }
});
