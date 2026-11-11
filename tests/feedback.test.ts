import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera } from 'three';
import { GameEvents } from '../src/events/game-events.ts';
import type { GameEvent, GameEventMap } from '../src/events/game-events.ts';
import { FeedbackOrchestrator } from '../src/feedback/orchestrator.ts';
import type { FeedbackPorts } from '../src/feedback/orchestrator.ts';
import { FEEDBACK } from '../src/feedback/settings.ts';
import { CameraImpulse } from '../src/feedback/camera-impulse.ts';
import { FlightCamera } from '../src/camera/flight-camera.ts';
import { GameModel } from '../src/core/game-model.ts';
import { ReleaseModel } from '../src/release/model.ts';
import { IntegratedModel } from '../src/integrated/model.ts';
import { FragmentView } from '../src/collectibles/view.ts';
import { CONFIG } from '../src/config.ts';
import { certifiedInput } from './fixtures/fragment-flight.ts';

const axis = { x: 0, y: 0 };
const context = { runId: 1, elapsed: 1, source: 'obstacle' as const, obstacleKind: 0,
  position: Object.freeze({ x: 0, y: 0, z: 0 }), obstaclePosition: Object.freeze({ x: 0, y: 0, z: -.1 }),
  velocity: Object.freeze({ x: 0, y: 0 }) };
const pickup: GameEventMap['collectible.collected'] = { runId: 1, elapsed: 1, item: 'energy-fragment', itemId: 'fixture',
  position: context.position, reward: 1, total: 1, assisted: false };
function harness(events = new GameEvents()) {
  const calls: string[] = [], hud: GameEvent[] = [];
  const ports: FeedbackPorts = { reset: () => calls.push('reset'), contact: e => calls.push(e.type),
    sound: cue => calls.push(`sound:${cue.variants[0]}`), gameOver: delay => calls.push(`end:${delay}`), hud: e => hud.push(e) };
  const feedback = new FeedbackOrchestrator(events, ports);
  const flush = () => { events.flush(); feedback.flush(); };
  events.emit('run.started', { runId: 1, elapsed: 0, seed: 42 }); flush(); calls.length = 0;
  return { events, feedback, ports, calls, hud, flush };
}
function hit(m: GameModel): void {
  Object.assign(m.field.hazards[0]!, { active: true, x: m.ship.x, y: m.ship.y, z: -.1, kind: 0, radius: 1 });
  m.step(CONFIG.step, axis);
}

test('typed FIFO delivery, insertion order, unsubscribe, immutable payload and no idle allocation queue', () => {
  const events = new GameEvents(), calls: string[] = [];
  const off = events.on('run.started', p => { assert.equal(p.seed, 42); assert.ok(Object.isFrozen(p)); calls.push('first'); });
  events.subscribe(e => calls.push(e.type));
  events.emit('run.started', { runId: 1, elapsed: 0, seed: 42 });
  assert.deepEqual(calls, []); events.flush();
  assert.deepEqual(calls, ['first', 'run.started']); off(); off();
  events.emit('run.ended', { runId: 1, elapsed: 2, reason: 'destroyed', score: 30, seed: 42 }); events.flush();
  assert.equal(calls.at(-1), 'run.ended');
  for (let i = 0; i < 1000; i++) events.flush();
  assert.equal(events.pendingCount, 0); events.dispose(); assert.equal(events.subscriberCount, 0);
});

test('delivery rejects recursive facts, isolates failures, bounds saturation and snapshots subscriptions', () => {
  const events = new GameEvents(), calls: string[] = [];
  events.subscribe(() => {
    events.flush(); events.emit('run.started', { runId: 99, elapsed: 0, seed: 99 });
    events.subscribe(() => calls.push('late'));
    throw Error('broken presentation');
  });
  events.subscribe(() => calls.push('survivor'));
  for (let i = 0; i < events.capacity + 4; i++) events.emit('run.started', { runId: 1, elapsed: 0, seed: 42 });
  events.flush(); assert.equal(calls.length, events.capacity); assert.ok(calls.every(s => s === 'survivor'));
  assert.equal(events.failures, events.capacity); assert.equal(events.dropped, events.capacity + 4);
  assert.equal(events.pendingCount, 0); events.dispose();
});

test('real damage facts follow collision order; immunity produces no repeat damage; death/end occur once', () => {
  const m = new GameModel(), facts: GameEvent[] = []; m.events.subscribe(e => facts.push(e));
  m.ready(); m.start(42); m.events.flush(); facts.length = 0; m.field.update = () => {};
  hit(m); m.events.flush();
  assert.deepEqual(facts.map(e => e.type), ['obstacle.collision', 'player.damage']);
  const damage = facts[1]!; assert.equal(damage.type, 'player.damage');
  if (damage.type === 'player.damage') { assert.equal(damage.payload.previousHP, 3); assert.equal(damage.payload.currentHP, 2); }
  const retained = JSON.stringify(facts[0]);
  hit(m); m.events.flush(); assert.equal(facts.length, 2); assert.equal(m.hull, 2);
  m.ship.x = 3; assert.equal(JSON.stringify(facts[0]), retained);
  m.invulnerability = 0; hit(m); m.events.flush();
  m.invulnerability = 0; hit(m); m.events.flush();
  for (let i = 0; i < 120; i++) { hit(m); m.events.flush(); }
  assert.equal(facts.filter(e => e.type === 'player.damage').length, 3);
  assert.equal(facts.filter(e => e.type === 'player.destroyed').length, 1);
  assert.equal(facts.filter(e => e.type === 'run.ended').length, 1);
  assert.deepEqual(facts.slice(-4).map(e => e.type), ['obstacle.collision', 'player.damage', 'player.destroyed', 'run.ended']);
  assert.equal(m.state, 'GAME_OVER'); m.dispose(); assert.equal(m.events.subscriberCount, 0);
});

test('simultaneous pickups and fatal contact select one Major in either event order; all HUD facts arrive', () => {
  for (const reverse of [false, true]) {
    const h = harness();
    const collect = () => h.events.emit('collectible.collected', pickup);
    const die = () => { h.events.emit('player.damage', { ...context, previousHP: 1, currentHP: 0 });
      h.events.emit('player.destroyed', { ...context, score: 10 }); };
    if (reverse) { die(); collect(); } else { collect(); die(); } h.flush();
    assert.deepEqual(h.calls, ['player.destroyed', 'sound:destruction', `end:${FEEDBACK.gameOverDelay}`]);
    assert.equal(h.hud.length, 4);
    h.events.emit('collectible.collected', { ...pickup, total: 2 }); h.flush();
    assert.equal(h.calls.length, 3); // Minor does not interrupt Major aftermath.
    h.feedback.dispose(); assert.equal(h.events.subscriberCount, 0);
  }
});

test('contact/aftermath/recovery use game time; pause freezes, death finishes, restart drops stale queued work', () => {
  const h = harness(); h.events.emit('player.damage', { ...context, previousHP: 3, currentHP: 2 }); h.flush();
  assert.equal(h.feedback.phase, 'contact');
  for (let i = 0; i < 20; i++) h.feedback.update('PAUSED', 10);
  assert.equal(h.feedback.phase, 'contact');
  h.feedback.update('PLAYING', .1); assert.equal(h.feedback.phase, 'aftermath');
  for (let i = 0; i < 3; i++) h.feedback.update('GAME_OVER', .1);
  assert.equal(h.feedback.phase, 'recovery');
  h.feedback.update('GAME_OVER', .1); h.feedback.update('GAME_OVER', .1); assert.equal(h.feedback.phase, 'idle');
  const subscribers = h.events.subscriberCount;
  for (let runId = 2; runId < 52; runId++) {
    h.events.emit('player.destroyed', { ...context, score: 10 });
    h.events.clear(); h.events.emit('run.started', { runId, elapsed: 0, seed: 42 }); h.flush();
    h.events.emit('player.destroyed', { ...context, score: 10 }); h.flush(); // old run ignored
    assert.equal(h.feedback.phase, 'idle'); assert.equal(h.events.subscriberCount, subscribers);
  }
  h.feedback.dispose(); assert.equal(h.events.subscriberCount, 0);
});

test('failing effect channel cannot prevent sound/HUD or mutate authoritative health', () => {
  const h = harness(); h.ports.contact = () => { throw Error('GPU unavailable'); };
  h.events.emit('player.damage', { ...context, previousHP: 3, currentHP: 2 }); h.flush();
  assert.equal(h.feedback.failures, 1); assert.ok(h.calls.includes('sound:impact'));
  assert.equal(h.hud.at(-1)?.type, 'player.damage'); h.feedback.dispose();
});

test('ReleaseModel delivers every same-step pickup with exact rewards, and progression without tuning changes', () => {
  const m = new ReleaseModel(), facts: GameEvent[] = []; m.events.subscribe(e => facts.push(e));
  m.ready(); m.start(42); m.events.flush(); m.field.update = () => {};
  m.distance = 499.9;
  for (let i = 0; i < 2; i++) Object.assign(m.fragments.slots[i]!, { state: 'active', proposal: {
    id: `fixture-${i}`, section: 4, anchor: 'fixture', situation: 'debris', x: 0, y: 0, passDistance: 500 } });
  m.step(CONFIG.step, axis); m.events.flush();
  const collected = facts.filter(e => e.type === 'collectible.collected');
  assert.equal(collected.length, 2); assert.equal(m.fragments.count, 2);
  assert.deepEqual(collected.map(e => e.payload.total), [1, 2]); assert.ok(collected.every(e => e.payload.reward === 1));
  assert.equal(m.score, Math.floor(m.distance));
  assert.equal(facts.filter(e => e.type === 'game.phaseChanged' && e.payload.scope === 'progression').length, 1);
  m.step(CONFIG.step, axis); m.events.flush(); assert.equal(facts.filter(e => e.type === 'collectible.collected').length, 2);
  m.dispose();
});

test('record crossing is once per run against the supplied existing best; restart restores elapsed/run identity', () => {
  const m = new GameModel(), records: GameEventMap['score.recordBroken'][] = [];
  m.events.on('score.recordBroken', p => records.push(p)); m.ready(); m.setRecordBaseline(2); m.start(42); m.field.update = () => {};
  for (let i = 0; i < 120; i++) { m.step(CONFIG.step, axis); m.events.flush(); }
  assert.equal(records.length, 1); assert.equal(records[0]!.previousBest, 2); assert.equal(records[0]!.score, 3);
  m.pause(); const time = m.elapsed; m.step(1, axis); assert.equal(m.elapsed, time);
  m.state = 'GAME_OVER'; m.setRecordBaseline(100); m.start(42); assert.equal(m.runId, 2); assert.equal(m.elapsed, 0);
  for (let i = 0; i < 120; i++) { m.step(CONFIG.step, axis); m.events.flush(); }
  assert.equal(records.length, 1); m.dispose();
});

test('camera impulse is bounded, FPS independent, frozen on pause, resets and returns exactly to Hybrid pose', () => {
  for (const fps of [30, 60, 144]) {
    const pulse = new CameraImpulse(), camera = new PerspectiveCamera(), follow = new FlightCamera(camera);
    follow.setMode('hybrid-chase'); follow.resize(1280, 800); follow.reset();
    follow.update(2, 1, 1, 0, 1 / fps); const normal = camera.position.clone();
    pulse.trigger(FEEDBACK.damage); const contact = pulse.amplitude;
    pulse.update('PAUSED', 10); assert.equal(pulse.amplitude, contact);
    for (let frame = 0; frame < fps; frame++) {
      pulse.update('PLAYING', 1 / fps); assert.ok(pulse.amplitude >= 0 && pulse.amplitude <= FEEDBACK.damage.camera);
      follow.update(2, 1, 1 + frame / fps, pulse.amplitude, 1 / fps);
    }
    assert.equal(pulse.amplitude, 0); assert.deepEqual(camera.position, normal);
    pulse.trigger(FEEDBACK.destroyed); pulse.reset(); assert.equal(pulse.amplitude, 0);
  }
});

test('subscribed feedback leaves seeded Integrated field, mines, pickups and complete simulation state identical', () => {
  for (const seed of [0, 42]) {
    const a = new IntegratedModel(), b = new IntegratedModel(); a.ready(); b.ready();
    const h = harness(a.events); a.start(seed); b.start(seed); h.flush();
    let directorEvents = 0; a.events.on('game.phaseChanged', p => { if (p.scope === 'director') directorEvents++; });
    const state = (m: IntegratedModel) => ({ ship: m.ship, distance: m.distance, elapsed: m.elapsed, hull: m.hull,
      hit: m.hitSerial, immunity: m.invulnerability, hazards: m.field.hazards, ledger: m.field.ledger.snapshot(),
      certificate: m.field.certificate, publications: m.field.events, fragments: m.fragments.slots, count: m.fragments.count, mine: m.homing.current });
    for (let tick = 0; tick < 3600; tick++) {
      const input = certifiedInput(a);
      if (tick % 2 === 0) { a.beginPlanningFrame(); b.beginPlanningFrame(); }
      a.step(CONFIG.step, input); b.step(CONFIG.step, input); h.flush();
      if (tick % 2 === 1) { a.finishPlanningFrame(1 / 60); b.finishPlanningFrame(1 / 60); h.feedback.update(a.state, 1 / 60); }
      if (tick % 120 === 0) assert.deepEqual(state(a), state(b));
    }
    assert.deepEqual(state(a), state(b)); assert.ok(directorEvents > 0); assert.equal(a.events.dropped, 0);
    h.feedback.dispose(); a.dispose(); b.dispose();
  }
});

test('pickup contact reuses the existing ring immediately, freezes on pause and cancels on restart', () => {
  const view = new FragmentView(new Scene()), m = new ReleaseModel(); m.ready(); m.start(42);
  const ring = view.root.children.at(-1)!;
  view.trigger({ ...pickup, elapsed: 0 }, FEEDBACK.pickup); view.update(m, false); assert.equal(ring.visible, true);
  const pose = ring.scale.toArray(); m.pause(); view.update(m, false); assert.deepEqual(ring.scale.toArray(), pose);
  view.cancel(); assert.equal(ring.visible, false); view.reset(); view.dispose(); m.dispose();
});
