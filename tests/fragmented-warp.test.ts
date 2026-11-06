import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { CONFIG } from '../src/config.ts';
import { FIELD, FIELD_MODES, FragmentedWarpField, fieldDepth, fieldEnvelope } from '../src/visuals/fragmented-warp.ts';
import { ArenaBoundaries } from '../src/visuals/arena-boundaries.ts';
import { PROFILES } from '../src/experiments/structure-variants/profile.ts';
import { IntegratedModel } from '../src/integrated/model.ts';
import { certifiedInput } from './fixtures/fragment-flight.ts';

test('seeded curved ribbon pool lies on real arena planes, with short spans and a clear center', () => {
  const a = new FragmentedWarpField(), b = new FragmentedWarpField(), p = a.geometry.getAttribute('position');
  assert.deepEqual(p.array, b.geometry.getAttribute('position').array);assert.equal(a.fragments.length, 56);
  for (const [i, f] of a.fragments.entries()) {
    assert.ok(f.length < 17);const horizontal = Math.abs(f.side) === 1;
    for (let v = i * 50; v < (i + 1) * 50; v++) {
      assert.ok(Math.abs((horizontal ? p.getX(v) : p.getY(v)) - Math.sign(f.side) * (horizontal ? CONFIG.bounds.x : CONFIG.bounds.y)) < 1e-6);
      assert.ok(Math.abs(horizontal ? p.getY(v) : p.getX(v)) <= (horizontal ? CONFIG.bounds.y : CONFIG.bounds.x));
    }
  }
  assert.equal(a.material.depthTest, true);assert.equal(a.material.depthWrite, false);a.dispose();b.dispose();
});

test('coherent distance motion is one-to-one, bounded, and every wrap is outside the visible envelope', () => {
  const a = new FragmentedWarpField();
  for (const f of a.fragments) for (let d = 0; d < 800; d += .37) {
    const before = fieldDepth(f.depth, d), after = fieldDepth(f.depth, d + .1);
    if (after > before) {
      for (const offset of [-9, 0, 9]) { assert.equal(fieldEnvelope(before + offset), 0);assert.equal(fieldEnvelope(after + offset), 0); }
    } else assert.ok(Math.abs(after - before + .1) < 1e-10);
  }
  a.dispose();
});

test('pause repeats reuse all buffers, distance uniforms and upload versions; reset reproduces entry', () => {
  const a = new FragmentedWarpField();a.update(0, 0, 0, false, []);
  const initial = a.geometry.index!.array.slice(), positions = a.geometry.getAttribute('position').array;
  a.update(6, 3.6, 500, false, []);
  const state = JSON.stringify(a.material.uniforms), version = a.geometry.index!.version, fade = a.geometry.getAttribute('fade').version;
  for (let i = 0; i < 100; i++) a.update(6, 3.6, 500, false, []);
  assert.equal(JSON.stringify(a.material.uniforms), state);assert.equal(a.geometry.index!.version, version);
  assert.equal(a.geometry.getAttribute('fade').version, fade);assert.equal(a.geometry.getAttribute('position').array, positions);
  assert.deepEqual(a.material.uniforms.proximity!.value, [0, 1, 0, 1]);a.reset();assert.deepEqual(a.geometry.index!.array, initial);a.dispose();
});

test('all five station variants remove every intersecting strip and reserve shifted openings', () => {
  const a = new FragmentedWarpField(), positions = a.geometry.getAttribute('position');let cuts = 0;
  for (let kind = 4; kind < 9; kind++) for (const distance of [0, 37, 190, 255, 350]) {
    const station = { kind, x: .25, y: -.2, z: -50, planned: { id: 'accepted' } };
    a.update(0, 0, distance, false, [station]);cuts += a.excludedLinks;
    const index = a.geometry.index!;
    for (let k = 0; k < index.count; k += 6) {
      if(index.getX(k) === index.getX(k + 1))continue;
      const verts = [index.getX(k), index.getX(k + 1), index.getX(k + 2), index.getX(k + 5)];
      const f = a.fragments[Math.floor(verts[0]! / 50)]!, depth = fieldDepth(f.depth, distance);
      const xs = verts.map(v => positions.getX(v)), ys = verts.map(v => positions.getY(v)), zs = verts.map(v => -depth - positions.getZ(v));
      for (const box of PROFILES[kind - 4]!.boxes) {
        const overlap = Math.max(...xs) >= station.x + box.center.x - box.half.x && Math.min(...xs) <= station.x + box.center.x + box.half.x
          && Math.max(...ys) >= station.y + box.center.y - box.half.y && Math.min(...ys) <= station.y + box.center.y + box.half.y
          && Math.max(...zs) >= station.z + box.center.z - box.half.z && Math.min(...zs) <= station.z + box.center.z + box.half.z;
        assert.equal(overlap, false, `uncut ${kind}/${distance}/${k}`);
      }
      const aperture = PROFILES[kind - 4]!.aperture;
      const openingOverlap = Math.max(...xs) >= station.x + aperture.x - 2.8 && Math.min(...xs) <= station.x + aperture.x + 2.8
        && Math.max(...ys) >= station.y + aperture.y - 2.2 && Math.min(...ys) <= station.y + aperture.y + 2.2
        && Math.max(...zs) >= -53 && Math.min(...zs) <= -47;
      assert.equal(openingOverlap, false);
    }
  }
  assert.ok(cuts > 0);a.dispose();
});

test('only committed retained stations exclude; smooth rim fades and stale exclusions clear', () => {
  const a = new FragmentedWarpField(), station = { kind: 4, x: 0, y: 0, z: -50, planned: {} };
  a.update(0, 0, 0, false, [station]);assert.ok(a.excludedLinks > 0);
  assert.ok([...a.geometry.getAttribute('fade').array].some(x => x > 0 && x < 1));
  for (const invalid of [{...station, planned: undefined}, {...station, z: 9}, {...station, kind: 0}]) {
    a.update(0, 0, 0, false, [invalid]);assert.equal(a.excludedLinks, 0);assert.ok([...a.geometry.getAttribute('fade').array].every(x => x === 1));
  }
  a.dispose();
});

test('switches use the same resource identities, independent corner response, reduced-motion policy and idempotent cleanup', () => {
  const a = new FragmentedWarpField(), geometry = a.geometry, material = a.material;let disposed = 0;
  a.geometry.addEventListener('dispose', () => disposed++);a.material.addEventListener('dispose', () => disposed++);
  for (const mode of FIELD_MODES) { a.setMode(mode);a.update(-6, -3.6, 123, true, []);assert.deepEqual(a.material.uniforms.proximity!.value, [1, 0, 1, 0]);assert.equal(a.geometry, geometry);assert.equal(a.material, material); }
  assert.equal(a.material.uniforms.reduced!.value, 1);assert.ok(a.activeSegments <= 36);a.dispose();a.dispose();assert.equal(disposed, 2);
});

test('matched actual input histories across all visual policies preserve full integrated authoritative state', () => {
  const models = Array.from({ length: 4 }, () => new IntegratedModel()), views = models.map(() => new ArenaBoundaries(new Scene()));
  views.forEach((v, i) => v.setMode(i === 0 ? 'warp' : FIELD_MODES[i - 1]!));models.forEach(m => {m.ready();m.start(42);});
  for (let tick = 0; tick < 5000; tick++) {
    const input = certifiedInput(models[0]!);
    models.forEach((m, i) => {
      if(tick % 2 === 0)m.beginPlanningFrame();m.step(CONFIG.step, input);
      if(tick % 2 === 1) { m.finishPlanningFrame(1 / 60);views[i]!.update(m.ship.x, m.ship.y, m.distance, false, m.field.hazards); }
    });
  }
  const state = (m: IntegratedModel) => JSON.stringify({state:m.state,distance:m.distance,elapsed:m.elapsed,ship:m.ship,hull:m.hull,hits:m.hitSerial,immunity:m.invulnerability,
    hazards:m.field.slots,fragments:m.fragments.slots,count:m.fragments.count,mine:m.homing.current,publications:m.field.events,ownership:m.field.ledger.snapshot()});
  for (const m of models) { assert.equal(m.phase, 2);assert.equal(m.hull, 3);assert.equal(state(m), state(models[0]!)); }
  models.forEach(m => m.dispose());views.forEach(v => v.dispose());
});

test('visual policies preserve damage and the terminal game-over outcome under identical neutral input', () => {
  let expected: string | undefined;
  for (const mode of ['warp', ...FIELD_MODES] as const) {
    const m=new IntegratedModel(), v=new ArenaBoundaries(new Scene());v.setMode(mode);m.ready();m.start(42);
    for(let tick=0;tick<20000&&m.state!=='GAME_OVER';tick++){
      if(tick%2===0)m.beginPlanningFrame();m.step(CONFIG.step,{x:0,y:0});
      if(tick%2===1){m.finishPlanningFrame(1/60);v.update(m.ship.x,m.ship.y,m.distance,false,m.field.hazards);}
    }
    assert.equal(m.state,'GAME_OVER');assert.equal(m.hull,0);
    const state=JSON.stringify({ship:m.ship,distance:m.distance,elapsed:m.elapsed,hits:m.hitSerial,phase:m.phase,publications:m.field.events,mine:m.homing.current,fragments:m.fragments.slots,count:m.fragments.count});
    if(expected)assert.equal(state,expected);else expected=state;m.dispose();v.dispose();
  }
});
