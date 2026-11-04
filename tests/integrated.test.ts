import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { CONFIG } from '../src/config.ts';
import { IntegratedModel, INTEGRATED_GEOMETRY } from '../src/integrated/model.ts';
import { IntegratedPrediction } from '../src/integrated/collision.ts';
import { adaptiveTransaction } from '../src/experiments/adaptive-homing/transaction.ts';
import { initialAdaptiveState } from '../src/experiments/adaptive-homing/controller.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { certifiedInput } from './fixtures/fragment-flight.ts';
import { ArenaBoundaries, BOUNDARY } from '../src/visuals/arena-boundaries.ts';
import { passTick } from '../src/experiments/moving-mine/source.ts';
import { flightSpeed } from '../src/release/settings.ts';

function flight(stress = false) {
  const m = new IntegratedModel(); m.ready(); m.start(42);
  const outcomes: unknown[] = []; let last, mines = 0, replays = 0, peak = 0, frames = 0;
  while (m.state === 'PLAYING' && m.distance < 1800) {
    const count = stress && frames % 60 === 30 ? 12 : 2; m.beginPlanningFrame();
    for (let n = 0; n < count; n++) {
      m.step(CONFIG.step, certifiedInput(m)); assert.equal(m.field.fault, undefined);
      peak = Math.max(peak, m.field.slots.filter(h => h.active && h.planned?.motion).length);
      const o = m.field.lastOutcome; if (!o || last === o) continue; last = o;
      outcomes.push([o.status, o.reason, o.transaction, o.witness?.hash]);
      mines += o.transaction?.hazards.filter(h => h.motion).length ?? 0;
      if (o.witness) {
        const job = beginTrajectoryReplay(o.witness.context, o.witness.controls, { geometry: INTEGRATED_GEOMETRY });
        while (!job.getResult()) job.advance();
        const result = job.getResult()!; assert.equal(result.decision, 'accept');
        if (result.decision === 'accept') assert.equal(result.witness.hash, o.witness.hash); replays++;
      }
    }
    m.finishPlanningFrame(count / 120);
    assert.ok(m.homing.planningFrame.latest.propagations <= 6144);
    assert.ok(m.homing.planningFrame.latest.queries <= 12288); frames++;
  }
  assert.equal(m.hull, 3); assert.equal(m.phase, 2); assert.equal(peak, 1);
  assert.ok(mines >= 2); assert.ok(replays >= 8); assert.ok(m.fragments.stats.placed >= 3);
  assert.ok(m.field.events.some(e => e.selectedFamily === 'station-wreck'));
  const result = { outcomes, ship: { ...m.ship }, distance: m.distance, fragments: m.fragments.stats, mines };
  m.dispose(); return result;
}

test('ordinary integrated source admits mines, Mixed Flow, stations and fragments through Phase 2; all witnesses replay with wings', () => {
  assert.deepEqual(flight(), flight());
});
test('catch-up frames preserve original hard budgets and compound mine replay', () => { assert.deepEqual(flight(true), flight(true)); });

test('active mine and fragments freeze on pause; restart cancels ownership, feedback, pickups and planning budget', () => {
  const m = new IntegratedModel(); m.ready(); m.start(42);
  while (!m.homing.current && m.state === 'PLAYING') m.step(CONFIG.step, certifiedInput(m));
  assert.ok(m.homing.current); assert.ok(m.fragments.stats.placed);
  m.pause(); const before = JSON.stringify(m);
  for (let i = 0; i < 120; i++) m.step(CONFIG.step, { x: 1, y: -1 });
  assert.equal(JSON.stringify(m), before); m.resume(); m.step(CONFIG.step, certifiedInput(m));
  assert.notEqual(JSON.stringify(m), before);
  const pending = m.field.pending; m.state = 'GAME_OVER'; m.start(42);
  assert.equal(m.homing.current, undefined); assert.equal(m.homing.liveUpdates, 0);
  assert.equal(m.fragments.count, 0); assert.equal(m.fragments.active.length, 0); assert.equal(m.field.ledger.snapshot().length, 0);
  assert.equal(m.distance, 0); assert.equal(m.hull, 3); assert.equal(m.homing.planningFrame.maxMs, 0);
  if (pending) assert.equal(pending.getResult()?.reason, 'CANCELLED'); m.dispose();
});

test('integrated pickup retains assistance, both wings and exactly one count per fragment', () => {
  const m = new IntegratedModel(); m.ready(); m.start(42);
  for (const sign of [-1, 1]) {
    const count = m.fragments.count;
    Object.assign(m.fragments.slots[0]!, { state: 'active', proposal: { id: `wing-${sign}`, section: 4, anchor: 'fixture', situation: 'debris', x: sign * 1.7, y: -.35, passDistance: 10 } });
    m.fragments.step(0, 0, 9.8, 0, 0, 11, 1);
    m.fragments.step(0, 0, 9.8, 0, 0, 11, 1);
    assert.equal(m.fragments.count, count + 1); assert.equal(m.fragments.lastPickup.part, sign < 0 ? 'left-wing' : 'right-wing');
  }
  m.dispose();
});

test('compound homing prediction detects a wing-only mine contact and rejects absent feedback endpoints', () => {
  const root = { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0, release: true as const };
  const h = adaptiveTransaction(42, 4, root).hazards.at(-1)!;
  const homing = initialAdaptiveState(h), a = { x: h.x - Math.sign(h.x) * 1.9, y: h.y + .35, vx: 0, vy: 0, elapsed: 0, distance: h.passDistance, homing };
  const b = { ...a, elapsed: CONFIG.step };
  assert.ok(Math.hypot(a.x - h.x, a.y - h.y) > h.radius + CONFIG.ship.radius);
  assert.equal(new IntegratedPrediction().hit(a, b, h, 0), true);
  assert.throws(() => new IntegratedPrediction().hit({ ...a, homing: undefined }, b, h, 0));
});

test('mine pass tick follows the release clock across the Phase 2 threshold', () => {
  const root = { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 23, distance: 495, release: true as const };
  let elapsed = root.elapsed, distance = root.distance, tick = Math.round(elapsed * 120);
  while (distance < 580) { elapsed += CONFIG.step; distance += flightSpeed(elapsed, distance, true) * CONFIG.step; tick++; }
  assert.equal(passTick(root, 580), tick);
  assert.ok(passTick({ ...root, release: undefined }, 580) > tick);
});

test('boundary flow follows all four arena limits, freezes with distance, disposes and cannot mutate simulation', () => {
  const scene = new Scene(), bounds = new ArenaBoundaries(scene), m = new IntegratedModel(); m.ready(); m.start(42);
  const before = JSON.stringify(m); bounds.update(0, 0, 0);
  assert.ok(bounds.sides.every(s => s.material.opacity === BOUNDARY.idleOpacity));
  bounds.update(CONFIG.bounds.x, -CONFIG.bounds.y, 123);
  assert.equal(bounds.sides[1]!.material.opacity, BOUNDARY.nearOpacity); assert.equal(bounds.sides[2]!.material.opacity, BOUNDARY.nearOpacity);
  assert.equal(bounds.sides[0]!.material.opacity, BOUNDARY.idleOpacity);
  assert.equal(bounds.sides[0]!.position.z, 123 % BOUNDARY.spacing);
  const pose = JSON.stringify(bounds.root.toJSON()); bounds.update(CONFIG.bounds.x, -CONFIG.bounds.y, 123);
  assert.equal(JSON.stringify(bounds.root.toJSON()), pose); assert.equal(JSON.stringify(m), before);
  bounds.reset(); assert.equal(bounds.sides[1]!.material.opacity, BOUNDARY.idleOpacity);
  bounds.dispose(); assert.equal(scene.children.length, 0); m.dispose();
});
