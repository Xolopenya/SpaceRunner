import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CONFIG } from '../src/config.ts';
import { Random } from '../src/core/random.ts';
import { GameModel } from '../src/core/game-model.ts';
import { HazardCollision } from '../src/core/hazard-collision.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { sameHazard, OwnershipLedger } from '../src/core/field-ownership.ts';
import { beginKnownFieldValidation, beginTrajectoryReplay, beginRuntimeRootSearch } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { FlightState } from '../src/core/field-prediction.ts';
import type { ValidationWitness } from '../src/core/field-validator-types.ts';
import { RuntimePlanningSession } from '../src/core/field-runtime-session.ts';
import { mineTransaction, movingMineSource, MINE_GEOMETRY as geometry, passTick } from '../src/experiments/moving-mine/source.ts';
import { MineCollision, MinePrediction, movingMineHit } from '../src/experiments/moving-mine/collision.ts';
import { isMine, mineX, validMotion } from '../src/experiments/moving-mine/motion.ts';
import { MINE_CONFIGURATIONS, mineConfiguration } from '../src/experiments/moving-mine/settings.ts';
import { MovingMineGameModel } from '../src/experiments/moving-mine/model.ts';
import { MineAssetManager } from '../src/experiments/moving-mine/assets.ts';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { wreckTransaction, WRECK_GEOMETRY } from '../src/experiments/structure-variants/encounter.ts';

const root = () => ({ player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0 });
function complete(j: ValidationJob) { while (!j.getResult()) j.advance(); return j.getResult()!; }
function accept(j: ValidationJob): ValidationWitness { const r = complete(j); assert.equal(r.decision, 'accept', JSON.stringify(r)); if (r.decision !== 'accept') throw Error('rejected'); return r.witness; }
export function witnessInput(w: ValidationWitness | undefined, elapsed: number) {
  let tick = w ? Math.round((elapsed - w.context.elapsed) * 120) : 0;
  for (const r of w?.controls ?? []) { if (tick < r.ticks) return r.input; tick -= r.ticks; } return { x: 0, y: 0 };
}
function candidate(configuration = MINE_CONFIGURATIONS[0]) {
  const source = movingMineSource(configuration, true), d = source.next(42, new DifficultyDirector(42).initial(4));
  return source.candidate(d.section, [], root()).transaction;
}
test('mine exact poses, both directions, speed bounds, clamp phases and stable seeded IDs', () => {
  for (const c of MINE_CONFIGURATIONS) {
    const tx = candidate(c), h = tx.hazards.find(isMine)!, m = h.motion!;
    assert.deepEqual(candidate(c), tx); assert.ok(Object.isFrozen(m)); assert.ok(validMotion(h));
    assert.equal(mineX(h, (m.startTick - 1) / 120), h.x);
    assert.equal(mineX(h, m.startTick / 120), h.x);
    assert.equal(mineX(h, (m.startTick + m.durationTicks / 2) / 120), 0);
    assert.equal(mineX(h, (m.startTick + m.durationTicks + 200) / 120), -h.x);
    assert.equal(Math.sign(m.velocityX), c.endsWith('ltr') ? 1 : -1);
    for (const key of ['startTick', 'durationTicks', 'velocityX'] as const) assert.equal(validMotion({ ...h, motion: { ...m, [key]: NaN } }), false);
    assert.equal(sameHazard(h, { ...h, motion: { ...m, startTick: m.startTick + 1 } }), false);
    assert.equal(geometry.inspect({ ...tx, hazards: tx.hazards.slice(0, -1) }, []).status, 'invalid');
    assert.equal(geometry.inspect({ ...tx, hazards: tx.hazards.map(a => a === h ? { ...h, motion: { ...m, velocityX: 3 } } : a) }, []).status, 'invalid');
  }
  assert.throws(() => mineConfiguration('homing')); assert.throws(() => mineTransaction(42, 4, -1, 'slow-ltr'));
});
test('seeded mine overlay retains all ordinary families, variable frequency and reproducible direction selection', () => {
  const identities = [];
  for (const seed of [0,11,42]) {
    const source = movingMineSource(); let cursor = new DifficultyDirector(seed).initial(4); const selected = [], configurations = new Set(), gaps = new Set(), families = new Set(); let previous = 0;
    for (let n = 0; n < 120; n++) {
      const d = source.next(seed, cursor); assert.deepEqual(source.next(seed, cursor), d); families.add(d.section.encounter);
      if (d.section.encounter === 'moving-mine') { selected.push(d.section.id); configurations.add(d.section.variation); gaps.add(d.section.firstCell - previous); previous = d.section.firstCell; }
      cursor = d.next;
    }
    assert.ok(selected.length > 15); assert.equal(configurations.size, 4); assert.ok(gaps.size > 3);
    for (const family of ['ambient','scattered','narrowing','alternating','vertical-weave','station-wreck','moving-mine']) assert.ok(families.has(family));
    identities.push(selected.join('/'));
  }
  assert.equal(new Set(identities).size, 3);
});

/** Independent closest-point analytical oracle: does not call game collision code. */
function oracle(a: number[], b: number[], r: number) {
  const v = b.map((x, i) => x - a[i]!), vv = v.reduce((n, x) => n + x * x, 0);
  const t = vv ? Math.max(0, Math.min(1, -a.reduce((n, x, i) => n + x * v[i]!, 0) / vv)) : 0;
  return a.reduce((n, x, i) => n + (x + t * v[i]!) ** 2, 0) <= r * r;
}
test('relative sphere CCD matches independent analytical oracle over120Hz velocities and forward speeds', () => {
  const rng = new Random(739), prediction = new MinePrediction(), live = new MineCollision();
  for (let i = 0; i < 12000; i++) {
    const h = candidate(MINE_CONFIGURATIONS[i % 4]!).hazards.find(isMine)!, motion = h.motion!;
    const tick = motion.startTick + Math.floor(rng.next() * (motion.durationTicks + 2)) - 1, elapsed = tick / 120;
    const previous: FlightState = { x: rng.between(-6, 6), y: rng.between(-3.6, 3.6), vx: 0, vy: 0, elapsed, distance: h.passDistance + rng.between(-2.5, 2.5) };
    const next = { ...previous, x: previous.x + rng.between(-8, 8) / 120, y: previous.y + rng.between(-8, 8) / 120,
      elapsed: elapsed + CONFIG.step, distance: previous.distance + rng.between(20, 34) / 120 };
    const a = [previous.x - mineX(h, previous.elapsed), previous.y - h.y, h.passDistance - previous.distance];
    const b = [next.x - mineX(h, next.elapsed), next.y - h.y, h.passDistance - next.distance];
    for (const margin of [0, .15]) assert.equal(prediction.hit(previous, next, h, margin), oracle(a, b, h.radius + .42 + margin));
    assert.equal(live.hit({ x: previous.x - mineX(h, next.elapsed), y: a[1]!, z: a[2]! }, { x: b[0]!, y: b[1]!, z: b[2]! },
      { ...h, planned: h }, next.elapsed, CONFIG.step), oracle(a, b, h.radius + .42));
  }
});
test('between-endpoint impacts, tangency, final interval and margin retain continuous precision', () => {
  const h = candidate().hazards.find(isMine)!, m = h.motion!, time = (m.startTick + m.durationTicks / 2) / 120;
  const state = { x: 0, y: 0, vx: 0, vy: 0, elapsed: time, distance: h.passDistance };
  // Huge relative displacement is a primitive tunnelling stress, not a legal Ship action.
  assert.ok(movingMineHit({ ...state, x: -10 }, { ...state, x: 10, elapsed: time + CONFIG.step }, h));
  const r = h.radius + .42;
  assert.ok(movingMineHit({ ...state, x: -3, y: r }, { ...state, x: 3, y: r }, h));
  assert.equal(movingMineHit({ ...state, x: -3, y: r + .01 }, { ...state, x: 3, y: r + .01 }, h), false);
  assert.ok(movingMineHit({ ...state, x: -3, y: r + .01 }, { ...state, x: 3, y: r + .01 }, h, .15));
  const end = (m.startTick + m.durationTicks) / 120;
  assert.ok(movingMineHit({ ...state, x: 6, elapsed: end - CONFIG.step }, { ...state, x: 6, elapsed: end }, h));
});
test('moving union witnesses replay with motion; held-prefix collisions and stale phase reject', () => {
  for (const c of MINE_CONFIGURATIONS) {
    const tx = candidate(c), context = { ...root(), candidate: tx, committed: [], reservedUntilDistance: tx.endDistance };
    const w = accept(beginKnownFieldValidation(context, { geometry }));
    assert.equal(accept(beginTrajectoryReplay(w.context, w.controls, { geometry })).hash, w.hash);
    const mine = tx.hazards.find(isMine)!, tick = passTick(root(), mine.passDistance);
    const state = { ...root().player, elapsed: 0, distance: 0 }, p = new FlightPrediction();
    for (let i = 0; i < tick - 2; i++) p.step(state, { x: 0, y: 0 });
    const late = { ...context, player: state, elapsed: state.elapsed, distance: state.distance };
    const bad = complete(beginKnownFieldValidation(late, { geometry }));
    assert.equal(bad.decision, 'reject'); assert.ok(bad.decision === 'reject' && bad.reason === 'INSUFFICIENT_REACTION_DISTANCE');
    assert.equal(complete(beginTrajectoryReplay(w.context, w.controls)).decision, 'reject');
    const changed = { ...tx, hazards: tx.hazards.map(h => isMine(h) ? { ...h, motion: { ...h.motion!, startTick: h.motion!.startTick + 1 } } : h) };
    assert.equal(complete(beginRuntimeRootSearch(w, { ...context, candidate: changed }, { geometry })).decision, 'reject');
  }
  const wreck = wreckTransaction(42, 4), forged = { ...wreck, hazards: wreck.hazards.map(h => ({ ...h, motion: candidate().hazards.find(isMine)!.motion })) };
  assert.equal(complete(beginKnownFieldValidation({ ...root(), candidate: forged, committed: [], reservedUntilDistance: forged.endDistance }, { geometry: WRECK_GEOMETRY })).decision, 'reject');
});
test('incremental moving publication uses actual state, work limits and cancellation epochs', () => {
  const source = movingMineSource('slow-ltr', true), d = source.next(42, new DifficultyDirector(42).initial(4)), ledger = new OwnershipLedger(); ledger.reset(4);
  const session = new RuntimePlanningSession(d.section, root(), [], ledger, 'culled', source.candidate(d.section, [], root()));
  const p = new FlightPrediction(), state = { ...root().player, elapsed: 0, distance: 0 };
  for (let t = 1; t <= 144 && !session.getResult(); t++) {
    p.step(state, { x: .3, y: -.2 }); session.advance({ ...root(), player: state, input: { x: .3, y: -.2 }, elapsed: state.elapsed, distance: state.distance }, [], t);
  }
  const outcome = session.getResult()!; assert.equal(outcome.status, 'committed'); assert.equal(outcome.witness!.context.distance, state.distance);
  assert.equal(accept(beginTrajectoryReplay(outcome.witness!.context, outcome.witness!.controls, { geometry })).hash, outcome.witness!.hash);
  assert.ok(outcome.metrics.searches <= 2 && outcome.metrics.replays <= 4 && outcome.metrics.planningTicks <= 144);
  const empty = new OwnershipLedger(); empty.reset(4);
  const exhausted = new RuntimePlanningSession(d.section, root(), [], empty, 'culled', source.candidate(d.section, [], root()));
  for (let t = 1; t <= 144; t++) exhausted.advance(root(), [], t, { propagations: 0, narrowQueries: 0 });
  assert.equal(exhausted.getResult()!.status, 'omitted-uncertified'); assert.equal(exhausted.getResult()!.witness, undefined);
  const cancelLedger = new OwnershipLedger(); cancelLedger.reset(4);
  const cancelled = new RuntimePlanningSession(d.section, root(), [], cancelLedger, 'culled', source.candidate(d.section, [], root()));
  cancelled.cancel(); assert.equal(cancelLedger.snapshot().length, 0); assert.equal(cancelled.getResult()!.reason, 'CANCELLED');
});
test('actual moving model publishes occasional mines in a regular field, pauses, resets and reuses slots', () => {
  const model = new MovingMineGameModel(); model.ready(); model.start(42); const slots = [...model.field.slots];
  const mines = new Set<string>(); let audits = 0, previous;
  for (let t = 0; t < 15000 && model.distance < 2600; t++) {
    model.step(CONFIG.step, witnessInput(model.field.certificate, model.elapsed)); assert.equal(model.field.fault, undefined);
    assert.ok(model.field.slots.filter(h => h.active && isMine(h)).length <= 1);
    for (const h of model.field.slots) if (h.active && isMine(h)) { mines.add(h.planned!.id); assert.equal(h.x, mineX(h.planned!, model.elapsed)); }
    const o = model.field.lastOutcome;
    if (o && o !== previous) { previous = o; if (o.witness) { assert.equal(accept(beginTrajectoryReplay(o.witness.context, o.witness.controls, { geometry })).hash, o.witness.hash); audits++; } }
  }
  assert.equal(model.hull, 3); assert.ok(mines.size >= 4 && audits > 12); assert.ok(model.field.events.some(e => e.selectedFamily === 'alternating'));
  const before = JSON.stringify(model.field.exportDiagnosticTrace()), x = model.field.slots.map(h => h.x);
  model.pause(); for (let t = 0; t < 200; t++) model.step(CONFIG.step, { x: 1, y: 1 });
  assert.equal(JSON.stringify(model.field.exportDiagnosticTrace()), before); assert.deepEqual(model.field.slots.map(h => h.x), x);
  model.resume(); model.step(CONFIG.step, { x: 0, y: 0 }); const pending = model.field.pending; model.state = 'GAME_OVER'; model.start(42);
  assert.equal(model.field.ledger.snapshot().length, 0); assert.equal(model.field.pending, undefined); if (pending) assert.equal(pending.getResult()!.reason, 'CANCELLED');
  assert.ok(model.field.slots.every((h, i) => h === slots[i] && !h.active && !h.planned)); model.dispose();
});
test('static collision and normal gameplay retain approved behavior with moving geometry absent', () => {
  const native = new HazardCollision(), extended = new MineCollision(), rng = new Random(42);
  for (let i = 0; i < 1500; i++) { const a = { x: rng.between(-2, 2), y: rng.between(-2, 2), z: rng.between(-2, 2) }, b = { x: rng.between(-2, 2), y: rng.between(-2, 2), z: rng.between(-2, 2) };
    const h = { kind: i % 3, radius: 1, spin: .5, phase: rng.between(0, Math.PI * 2) }; assert.equal(extended.hit(a, b, h, 10, CONFIG.step), native.hit(a, b, h, 10, CONFIG.step)); }
  const m = new GameModel(); m.ready(); m.start(42); for (let t = 0; t < 1200; t++) m.step(CONFIG.step, { x: 1, y: 1 });
  assert.ok(m.field.hazards.every(h => h.kind < 3));
});
test('mine asset loads once, clones share resources, failures and disposal preserve ownership', async () => {
  const a = new MineAssetManager(), source = new Group(), geo = new BoxGeometry(), mat = new MeshStandardMaterial(); source.add(new Mesh(geo, mat));
  let calls = 0; const load = async () => { calls++; return source; };
  await Promise.all([a.loadMine(load), a.loadMine(load)]); assert.equal(calls, 1);
  const b = a.cloneMine(), c = a.cloneMine(); assert.notEqual(b, c); assert.equal(b.userData.modelId, 'space-mine'); assert.equal(a.resources.geometries.size, 1); assert.equal(a.resources.materials.size, 1);
  a.dispose(); a.dispose(); assert.equal(a.resources.geometries.size, 0); assert.throws(() => a.cloneMine());
  const failed = new MineAssetManager(); await assert.rejects(failed.loadMine(async () => { throw Error('offline'); })); failed.dispose();
  const pending = new MineAssetManager(); let resolveLoad!: (group: Group) => void; const promise = pending.loadMine(() => new Promise(done => { resolveLoad = done; }));
  pending.dispose(); const late = new Group(); late.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial())); resolveLoad(late);
  await assert.rejects(promise, /cancelled/); assert.equal(pending.resources.geometries.size, 0);
});
test('original GLB bytes, mesh counts and normalized collision envelope are independently inspected', async () => {
  const bytes = readFileSync(new URL('../src/experiments/moving-mine/space-mine.glb', import.meta.url));
  assert.equal(bytes.length, 56912); assert.equal(createHash('sha256').update(bytes).digest('hex'), 'c64b8bfa0146ffc7d819f46ab74887326828b2b8266604b516a3cdc570189c77');
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(json.meshes.reduce((n: number, m: any) => n + m.primitives.reduce((s: number, p: any) => s + json.accessors[p.attributes.POSITION].count / 3, 0), 0), 1136);
  assert.equal(json.materials.length, 3); assert.equal(json.textures?.length ?? 0, 0); assert.equal(json.animations?.length ?? 0, 0);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const assets = new MineAssetManager(); await assets.loadMine(async () => gltf.scene); const clone = assets.cloneMine(); clone.updateMatrixWorld(true);
  let max = 0, count = 0; const { Vector3 } = await import('three'), p = new Vector3();
  clone.traverse(node => { if (node instanceof Mesh) { const positions = node.geometry.getAttribute('position'); count += positions.count;
    for (let i = 0; i < positions.count; i++) max = Math.max(max, p.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).length()); } });
  assert.equal(count, 3408); assert.ok(Math.abs(max - 1) < 1e-12); assets.dispose();
});
