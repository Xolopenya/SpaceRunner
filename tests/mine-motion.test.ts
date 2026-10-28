import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { Random } from '../src/core/random.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { sameHazard, OwnershipLedger } from '../src/core/field-ownership.ts';
import { beginKnownFieldValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { ALL_MINE_CONFIGURATIONS, MOTION_POLICIES, motionVector, motionPolicy, configurations } from '../src/experiments/moving-mine/settings.ts';
import { mineTransaction, movingMineSource, passTick, MINE_GEOMETRY as geometry } from '../src/experiments/moving-mine/source.ts';
import { mineX, mineY, isMine, validMotion } from '../src/experiments/moving-mine/motion.ts';
import { movingMineHit, MineCollision } from '../src/experiments/moving-mine/collision.ts';
import { MovingMineGameModel } from '../src/experiments/moving-mine/model.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { MineMotionPolicy } from '../src/experiments/moving-mine/settings.ts';

const root = () => ({ player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0 });
const finish = (j: ValidationJob) => { while (!j.getResult()) j.advance(); return j.getResult()!; };
function candidate(c: typeof ALL_MINE_CONFIGURATIONS[number], elapsed = 0) {
  const speed = Math.abs(motionVector(c).x), r = { ...root(), elapsed };
  return mineTransaction(42, 4, passTick(r, 180) - Math.round(6 / speed * 120), c);
}

test('all vector policies use one fixed clock, center at actual forward pass, and finite clamped endpoints', () => {
  for (const c of ALL_MINE_CONFIGURATIONS) for (const elapsed of [0, 120]) {
    const tx = candidate(c, elapsed), h = tx.hazards.find(isMine)!, m = h.motion!, v = motionVector(c);
    assert.ok(validMotion(h)); assert.deepEqual(tx, candidate(c, elapsed));
    assert.equal(mineX(h, m.startTick / 120 - 1), h.x); assert.equal(mineY(h, m.startTick / 120 - 1), h.y);
    const end = (m.startTick + m.durationTicks) / 120;
    assert.equal(mineX(h, end), mineX(h, end + 10)); assert.equal(mineY(h, end), mineY(h, end + 10));
    const t = passTick({ ...root(), elapsed }, 180) / 120;
    assert.ok(Math.abs(mineX(h, t)) <= Math.abs(v.x) / 120 + 1e-10);
    assert.ok(Math.abs(mineY(h, t)) <= Math.abs(v.y) / 120 + 1e-10);
    assert.ok(Math.abs(mineY(h, end)) <= 3 && Math.abs(mineX(h, end)) <= 6);
    assert.equal(sameHazard(h, { ...h, motion: { ...m, velocityY: (m.velocityY ?? 0) + .1 } }), false);
    assert.equal(validMotion({ ...h, motion: { ...m, velocityY: NaN } }), false);
    assert.equal(geometry.inspect({ ...tx, hazards: tx.hazards.map(a => a === h ? { ...h, motion: { ...m, velocityY: 99 } } : a) }, []).status, 'invalid');
    const ledger = new OwnershipLedger(); ledger.reset(4); assert.equal(ledger.reserve('runtime', 4, 6, tx.hazards.map(h => h.id), tx.hazards).status, 'reserved');
    assert.ok(Object.isFrozen(ledger.snapshot()[0]!.hazards.at(-1)!.motion));
  }
  assert.equal(motionPolicy(null), 'baseline'); assert.throws(() => motionPolicy('homing'));
  assert.throws(() => movingMineSource('fast-ltr', true, 'baseline'));
});

test('A/B/C source schedules identical encounters and ordinary payloads, with all signed vectors', () => {
  for (const seed of [0,11,42]) {
    const sources = MOTION_POLICIES.map(p => movingMineSource(undefined, false, p));
    const cursors = sources.map(() => new DifficultyDirector(seed).initial(4));
    const seen = sources.map(() => new Set<number>());
    for (let n = 0; n < 120; n++) {
      const decisions = sources.map((s, i) => s.next(seed, cursors[i]!));
      for (let i = 0; i < sources.length; i++) {
        const d = decisions[i]!; cursors[i] = d.next;
        assert.equal(d.section.firstCell, decisions[0]!.section.firstCell); assert.equal(d.section.encounter, decisions[0]!.section.encounter);
        assert.equal(d.section.cellCount, decisions[0]!.section.cellCount);
        if (d.section.encounter === 'moving-mine') {
          seen[i]!.add(d.section.variation);
          const c = configurations(MOTION_POLICIES[i]!)[d.section.variation]!;
          const a = configurations('baseline')[decisions[0]!.section.variation]!;
          assert.equal(Math.sign(motionVector(c).x), Math.sign(motionVector(a).x));
        }
        else assert.deepEqual(d.section, decisions[0]!.section);
      }
    }
    seen.forEach((s, i) => assert.equal(s.size, configurations(MOTION_POLICIES[i]!).length));
  }
});

test('XY relative sweep matches separate closest point oracle for 18000 legal step intervals', () => {
  const rng = new Random(854), live = new MineCollision();
  for (let i = 0; i < 18000; i++) {
    const h = candidate(ALL_MINE_CONFIGURATIONS[i % ALL_MINE_CONFIGURATIONS.length]!).hazards.find(isMine)!, m = h.motion!;
    const elapsed = (m.startTick + Math.floor(rng.next() * (m.durationTicks + 4)) - 2) / 120;
    const a = { x: rng.between(-6,6), y: rng.between(-3.6,3.6), vx: 0, vy: 0, elapsed, distance: h.passDistance + rng.between(-2,2) };
    const b = { ...a, x: a.x + rng.between(-8,8) / 120, y: a.y + rng.between(-8,8) / 120, elapsed: elapsed + CONFIG.step, distance: a.distance + rng.between(20,34) / 120 };
    const from = [a.x - mineX(h,a.elapsed), a.y - mineY(h,a.elapsed), h.passDistance - a.distance];
    const to = [b.x - mineX(h,b.elapsed), b.y - mineY(h,b.elapsed), h.passDistance - b.distance];
    const delta = to.map((v,j) => v - from[j]!), norm = delta.reduce((s,v) => s + v*v,0);
    const t = norm ? Math.max(0,Math.min(1,-from.reduce((s,v,j) => s + v*delta[j]!,0)/norm)) : 0;
    const d2 = from.reduce((s,v,j) => s + (v + t*delta[j]!)**2,0);
    for (const margin of [0,.15]) assert.equal(movingMineHit(a,b,h,margin), d2 <= (h.radius + .42 + margin)**2);
    assert.equal(live.hit({x:a.x-mineX(h,b.elapsed),y:a.y-mineY(h,b.elapsed),z:from[2]!}, {x:to[0]!,y:to[1]!,z:to[2]!}, {...h,planned:h},b.elapsed,CONFIG.step), d2 <= (h.radius+.42)**2);
  }
});

test('diagonal between-step contact, tangency and near boundary are continuous in both XY axes', () => {
  for (const c of configurations('diagonal')) {
    const h = candidate(c).hazards.find(isMine)!, t = passTick(root(),180)/120, x = mineX(h,t), y = mineY(h,t);
    const s = { x,y,vx:0,vy:0,elapsed:t,distance:180 };
    // Same-time long relative segments isolate tangency independently of quantized motion.
    assert.ok(movingMineHit({...s,x:x-4,y:y+1.77},{...s,x:x+4,y:y+1.77},h));
    assert.equal(movingMineHit({...s,x:x-4,y:y+1.78},{...s,x:x+4,y:y+1.78},h),false);
    assert.ok(movingMineHit({...s,x:x-4,y:y-4},{...s,x:x+4,y:y+4,elapsed:t+CONFIG.step},h));
    const start = h.motion!.startTick / 120;
    assert.ok(movingMineHit({...s,x:h.x,y:h.y,elapsed:start},{...s,x:h.x,y:h.y,elapsed:start+CONFIG.step},h));
  }
});

test('every signed variant independently replays different incoming velocities and rejects late neutral reaction', () => {
  for (const c of ALL_MINE_CONFIGURATIONS) for (const velocity of [{vx:0,vy:0},{vx:8,vy:0},{vx:-5,vy:5}]) {
    const tx = candidate(c), context = {...root(),player:{...root().player,...velocity},candidate:tx,committed:[],reservedUntilDistance:tx.endDistance};
    const r = finish(beginKnownFieldValidation(context,{geometry})); assert.equal(r.decision,'accept');
    if(r.decision !== 'accept') continue;
    const replay = finish(beginTrajectoryReplay(r.witness.context,r.witness.controls,{geometry})); assert.equal(replay.decision,'accept');
    if(replay.decision === 'accept') assert.equal(replay.witness.hash,r.witness.hash);
    const state = {...root().player,elapsed:0,distance:0}, p = new FlightPrediction(), tick = passTick(root(),180);
    for(let n=0;n<tick-2;n++) p.step(state,{x:0,y:0});
    const late = finish(beginKnownFieldValidation({...context,player:state,elapsed:state.elapsed,distance:state.distance},{geometry}));
    assert.equal(late.decision,'reject'); if(late.decision==='reject') assert.equal(late.reason,'INSUFFICIENT_REACTION_DISTANCE');
  }
});

test('fast and diagonal actual models pause and restart at identical poses without retained clocks', () => {
  for(const policy of ['fast','diagonal'] as MineMotionPolicy[]) {
    const model = new MovingMineGameModel(undefined,true,policy); model.ready(); model.start(42);
    function steps(count:number) { for(let n=0;n<count;n++) { const w=model.field.certificate; let t=w?Math.round((model.elapsed-w.context.elapsed)*120):0,axis={x:0,y:0};
      for(const r of w?.controls??[]) {if(t<r.ticks){axis=r.input;break;}t-=r.ticks;} model.step(CONFIG.step,axis);assert.equal(model.field.fault,undefined); } }
    steps(1030);const a=model.field.slots.find(h=>h.active&&isMine(h))!;assert.ok(a);const pose={x:a.x,y:a.y,id:a.planned!.id};
    model.pause();steps(40);assert.deepEqual({x:a.x,y:a.y,id:a.planned!.id},pose);
    model.resume();steps(1);assert.notEqual(a.x,pose.x);if(policy==='diagonal')assert.notEqual(a.y,pose.y);
    model.state='GAME_OVER';model.start(42);steps(1030);const b=model.field.slots.find(h=>h.active&&isMine(h))!;
    assert.deepEqual({x:b.x,y:b.y,id:b.planned!.id},pose);assert.equal(model.hull,3);model.dispose();
  }
});
