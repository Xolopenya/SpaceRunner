import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, difficulty } from '../src/config.ts';
import { GameModel } from '../src/core/game-model.ts';
import { Ship } from '../src/core/ship.ts';
import { Random } from '../src/core/random.ts';
import { sweptSphereHit } from '../src/core/collision.ts';
import { ObstacleField, corridorTravelBudget } from '../src/core/obstacles.ts';

const idle = { x: 0, y: 0 };
function playing(seed = 42): GameModel { const model = new GameModel(); model.ready(); model.start(seed); return model; }
function tick(model: GameModel, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / CONFIG.step); i++) model.step(CONFIG.step, idle);
}
function hit(model: GameModel): void {
  const hazard = model.field.hazards[0]!;
  Object.assign(hazard, { active: true, x: model.ship.x, y: model.ship.y, z: -0.2, radius: 1 });
  model.step(CONFIG.step, idle);
}

test('state transitions guard loading, pause and resume', () => {
  const model = new GameModel();
  model.start(1);
  assert.equal(model.state, 'LOADING');
  model.ready();
  assert.equal(model.state, 'MENU');
  model.start(1);
  tick(model, 1);
  const distance = model.distance;
  model.pause();
  tick(model, 5);
  assert.equal(model.distance, distance);
  assert.equal(model.state, 'PAUSED');
  model.start(999);
  assert.equal(model.seed, 1);
  model.resume();
  tick(model, 1);
  assert.ok(model.distance > distance);
});

test('damage consumes one hull point, grants invulnerability, then reaches game over', () => {
  const model = playing();
  hit(model);
  assert.equal(model.hull, 2);
  hit(model);
  assert.equal(model.hull, 2);
  assert.ok(model.invulnerability > 0);
  // Remove the overlapping test hazard before advancing the cooldown.
  model.field.hazards[0]!.active = false;
  tick(model, 1.7);
  hit(model);
  assert.equal(model.hull, 1);
  model.field.hazards[0]!.active = false;
  tick(model, 1.7);
  hit(model);
  assert.equal(model.state, 'GAME_OVER');
  assert.equal(model.hull, 0);
  const distance = model.distance;
  tick(model, 2);
  assert.equal(model.distance, distance);
});

test('restart completely resets the run and reuses hazard slots', () => {
  const model = playing();
  const pool = model.field.hazards;
  model.ship.x = 4;
  model.elapsed = 11;
  model.distance = 500;
  model.hull = 1;
  hit(model);
  model.start(76);
  assert.equal(model.state, 'PLAYING');
  assert.equal(model.hull, 3);
  assert.equal(model.distance, 0);
  assert.equal(model.elapsed, 0);
  assert.equal(model.invulnerability, 0);
  assert.equal(model.hitSerial, 0);
  assert.equal(model.ship.x, 0);
  assert.equal(model.ship.vx, 0);
  assert.equal(model.seed, 76);
  assert.equal(model.field.hazards, pool);
  assert.ok(pool.every(item => !item.active));
});

test('ship accelerates, brakes, normalizes diagonals and respects bounds', () => {
  const ship = new Ship();
  ship.update(CONFIG.step, { x: 1, y: 0 });
  assert.ok(ship.vx > 0 && ship.vx < CONFIG.ship.maxSpeed);
  assert.ok(ship.x < 0.01);
  for (let i = 0; i < 1200; i++) ship.update(CONFIG.step, { x: 1, y: 1 });
  assert.equal(ship.x, CONFIG.bounds.x);
  assert.equal(ship.y, CONFIG.bounds.y);
  ship.reset();
  for (let i = 0; i < 50; i++) ship.update(CONFIG.step, { x: 1, y: 1 });
  assert.ok(Math.hypot(ship.vx, ship.vy) <= CONFIG.ship.maxSpeed + 1e-8);
  for (let i = 0; i < 60; i++) ship.update(CONFIG.step, idle);
  assert.equal(ship.vx, 0);
  assert.equal(ship.vy, 0);
});

test('movement is consistent across simulation step sizes', () => {
  function move(dt: number): number {
    const ship = new Ship();
    for (let i = 0; i < Math.round(0.5 / dt); i++) ship.update(dt, { x: 1, y: 0 });
    return ship.x;
  }
  assert.ok(Math.abs(move(1 / 60) - move(1 / 120)) < 0.04);
  assert.ok(Math.abs(move(1 / 120) - move(1 / 240)) < 0.02);
});

test('swept collision catches fast crossing, tangent and stationary overlaps', () => {
  assert.equal(sweptSphereHit({ x: 0, y: 0, z: -20 }, { x: 0, y: 0, z: 20 }, 1), true);
  assert.equal(sweptSphereHit({ x: 1, y: 0, z: -20 }, { x: 1, y: 0, z: 20 }, 1), true);
  assert.equal(sweptSphereHit({ x: 1.01, y: 0, z: -20 }, { x: 1.01, y: 0, z: 20 }, 1), false);
  assert.equal(sweptSphereHit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1), true);
});

test('difficulty rises smoothly and is bounded', () => {
  assert.deepEqual(difficulty(-20), difficulty(0));
  assert.deepEqual(difficulty(200), difficulty(120));
  assert.equal(difficulty(0).speed, 20);
  assert.equal(difficulty(120).speed, 34);
  for (let second = 1; second <= 120; second++) {
    assert.ok(difficulty(second).speed > difficulty(second - 1).speed);
    assert.ok(difficulty(second).spacing <= difficulty(second - 1).spacing);
  }
});

test('seeded randomness and fields reproduce exactly, including seed zero', () => {
  for (const seed of [0, 1, 42, 4294967295]) {
    const a = new Random(seed);
    const b = new Random(seed);
    for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
    const first = playing(seed);
    const second = playing(seed);
    tick(first, 20);
    tick(second, 20);
    assert.deepEqual(first.field.hazards, second.field.hazards);
  }
});

test('warmup and sight distance prevent immediate hazards', () => {
  const model = playing();
  tick(model, 3.9);
  assert.equal(model.field.spawnedWaves, 0);
  tick(model, 0.2);
  assert.equal(model.field.spawnedWaves, 1);
  assert.ok(model.field.hazards.filter(item => item.active).every(item => item.z < -100));
});

test('an untouched seeded flight naturally loses its hull and stops scoring', () => {
  const model = playing(42);
  tick(model, 120);
  assert.equal(model.state, 'GAME_OVER');
  assert.equal(model.hull, 0);
  assert.equal(model.hitSerial, 3);
  assert.ok(model.score > 200 && model.score < 1000);
  const score = model.score;
  tick(model, 10);
  assert.equal(model.score, score);
});

test('worst-case wave interval exceeds reaction, acceleration, travel and braking budget', () => {
  assert.ok(CONFIG.waves.minSpacing / CONFIG.flight.maxSpeed > corridorTravelBudget());
});

test('64 challenging seeds retain full-height clear corridors and bounded pools', () => {
  let checked = 0;
  for (let seed = 0; seed < 64; seed++) {
    const field = new ObstacleField();
    field.reset(seed);
    let distance = 0;
    let previousSafeX = 0;
    let previousWaves = 0;
    for (let i = 0; i < 2400; i++) {
      distance += CONFIG.flight.maxSpeed * 0.1;
      field.update(0.1, CONFIG.flight.maxSpeed, distance, 120 + i * 0.1);
      if (field.spawnedWaves === previousWaves) continue;
      const wave = field.waves.find(item => item.active && item.z === CONFIG.hazards.spawnZ)!;
      assert.ok(Math.abs(wave.safeX - previousSafeX) <= CONFIG.waves.laneWidth);
      for (const hazard of field.hazards.filter(item => item.active && item.z === wave.z)) {
        assert.ok(Math.abs(hazard.x - wave.safeX) - hazard.radius > CONFIG.waves.safeHalfWidth + CONFIG.ship.radius);
      }
      assert.ok(field.hazards.filter(item => item.active).length <= 18);
      previousSafeX = wave.safeX;
      previousWaves = field.spawnedWaves;
      checked++;
    }
    assert.equal(field.hazards.length, CONFIG.hazards.capacity);
    assert.equal(field.waves.length, CONFIG.waves.capacity);
  }
  assert.ok(checked > 8000);
});

test('real ship dynamics can follow successive safe routes at maximum difficulty', () => {
  for (let seed = 0; seed < 24; seed++) {
    const model = playing(seed);
    model.elapsed = 120;
    let desiredX = 0;
    let seen = 0;
    let reaction = 0;
    for (let i = 0; i < 120 * 120; i++) {
      const nearest = model.field.waves.filter(wave => wave.active && wave.z < 2).sort((a, b) => b.z - a.z)[0];
      if (nearest && nearest.safeX !== desiredX && (!seen || nearest.z < -6)) {
        desiredX = nearest.safeX;
        reaction = CONFIG.waves.reactionSeconds;
        seen++;
      }
      reaction -= CONFIG.step;
      const difference = desiredX - model.ship.x;
      const brakingDistance = model.ship.vx * model.ship.vx / (2 * CONFIG.ship.braking);
      const axis = reaction > 0 || Math.abs(difference) < brakingDistance + 0.08 ? 0 : Math.sign(difference);
      model.step(CONFIG.step, { x: axis, y: 0 });
      assert.equal(model.hull, 3, `seed ${seed} at ${model.elapsed.toFixed(2)}s`);
    }
    assert.ok(model.field.spawnedWaves > 60);
  }
});
