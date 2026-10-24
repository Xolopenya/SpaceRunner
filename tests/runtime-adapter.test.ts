import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeGameModel} from '../src/debug/runtime-game-model.ts';
import {CONFIG} from '../src/config.ts';
import {Ship} from '../src/core/ship.ts';
import {hazardVariant} from '../src/core/hazard-profile.ts';
import type {ValidationWitness} from '../src/core/field-validator-types.ts';

function model(){const m=new RuntimeGameModel();m.ready();m.start(42);return m;}
function step(m:RuntimeGameModel,ticks:number){for(let i=0;i<ticks;i++)m.step(CONFIG.step,{x:0,y:0});}
function input(w:ValidationWitness|undefined,elapsed:number){if(!w)return{x:0,y:0};let tick=Math.round((elapsed-w.context.elapsed)/CONFIG.step);for(const run of w.controls){if(tick<run.ticks)return run.input;tick-=run.ticks;}return{x:0,y:0};}

test('dev adapter publishes complete identities into the existing72 slots and existing catalog transforms',()=>{
 const m=model(),slots=[...m.field.hazards];step(m,144);const outcome=m.field.lastOutcome!;
 assert.equal(outcome.status,'committed');assert.equal(m.field.firstPublication,m.elapsed);
 assert.equal(m.field.hazards.length,72);assert.equal(m.field.slots.filter(h=>h.planned).length,outcome.transaction!.hazards.length);
 for(const h of m.field.slots.filter(h=>h.planned)){const p=h.planned!;assert.equal(h.z,m.distance-p.passDistance);assert.equal(h.x,p.x);assert.equal(h.y,p.y);assert.equal(hazardVariant(h.kind,h.phase),p.visualVariant);assert.equal(h.radius,p.radius);}
 assert.ok(m.field.hazards.every((h,i)=>h===slots[i]));assert.ok(m.field.waves.every(w=>!w.active));
 assert.equal(m.field.fault,undefined);assert.throws(()=>m.step(.1,{x:0,y:0}),RangeError);
});

test('runtime adapter retains exact Ship movement until real hull destruction without an alternate simulation',()=>{
 const m=model(),ship=new Ship();let steps=0;
 for(;steps<6000&&m.state==='PLAYING';steps++){const axis={x:Math.sin(steps/89),y:Math.cos(steps/133)*.7};ship.update(CONFIG.step,axis);m.step(CONFIG.step,axis);assert.deepEqual(m.ship,ship);}
 assert.ok(steps>500);assert.ok(m.hull>=0&&m.hull<=3);
});

test('pause stops pending jobs, clocks and director; resume advances only the next actual fixed tick',()=>{
 const m=model();step(m,60);m.pause();const before={elapsed:m.elapsed,distance:m.distance,ticks:m.field.planningTicks,cells:m.field.ledger.frontier,pending:m.field.pending};
 step(m,500);assert.deepEqual({elapsed:m.elapsed,distance:m.distance,ticks:m.field.planningTicks,cells:m.field.ledger.frontier,pending:m.field.pending},before);
 m.resume();step(m,1);assert.equal(m.field.planningTicks,before.ticks+1);assert.equal(m.elapsed,before.elapsed+CONFIG.step);
});

test('restart cancels a pending transaction and clears logical/render state without replacing the pool',()=>{
 const m=model(),slots=[...m.field.hazards];step(m,40);const old=m.field.pending!;
 m.state='GAME_OVER';m.start(7);assert.equal(old.getResult()!.reason,'CANCELLED');assert.equal(m.field.ledger.snapshot().length,0);
 assert.equal(m.elapsed,0);assert.equal(m.field.events.length,0);assert.equal(m.field.scheduled,0);assert.ok(m.field.slots.every(s=>!s.active&&!s.planned));
 step(m,1);assert.notEqual(m.field.pending,old);assert.equal(old.advance({player:m.ship,input:{x:0,y:0},distance:m.distance,elapsed:m.elapsed},[],41)!.reason,'CANCELLED');
 assert.ok(m.field.hazards.every((h,i)=>h===slots[i]));
});

test('damage, invulnerability, game over and restart remain the authoritative inherited rules',()=>{
 const m=model();let ticks=0,previous=0;
 while(m.state==='PLAYING'&&ticks++<24000){step(m,1);if(m.hitSerial!==previous){assert.equal(m.invulnerability,CONFIG.ship.invulnerability);previous=m.hitSerial;}}
 assert.equal(m.state,'GAME_OVER');assert.equal(m.hull,0);assert.equal(m.hitSerial,3);
 const old=m.field.pending;const score=m.score;step(m,100);assert.equal(m.score,score);
 m.start(42);assert.equal(m.state,'PLAYING');assert.equal(m.hull,3);assert.equal(m.hitSerial,0);assert.equal(m.distance,0);if(old)assert.equal(old.getResult()!.reason,'CANCELLED');
 for(let i=0;i<12;i++){step(m,10);m.state='GAME_OVER';m.start(42);assert.equal(m.field.events.length,0);assert.equal(m.field.samples.length,0);assert.equal(m.field.hazards.length,72);}
});

test('early render disappearance cannot erase committed geometry or source-span history',()=>{
 const m=model();step(m,144);const count=m.field.ledger.knownHazards(m.distance).length,frontier=m.field.ledger.frontier;
 for(const slot of m.field.slots)slot.active=false;step(m,1);
 assert.equal(m.field.ledger.knownHazards(m.distance).length,count);assert.equal(m.field.ledger.frontier,frontier);assert.equal(m.field.fault,undefined);
});

test('unknown or altered pool geometry stops publication instead of truncating a transaction',()=>{
 for(const kind of ['unknown','changed','logical']){const m=model();step(m,144);const commits=m.field.committed;
  if(kind==='unknown')m.field.slots.find(s=>!s.planned)!.active=true;
  else if(kind==='logical'){const slot=m.field.slots.find(s=>s.planned)!;slot.planned={...slot.planned!,passDistance:slot.planned!.passDistance+1};}
  else m.field.slots.find(s=>s.planned)!.x+=.01;
  step(m,1);assert.match(m.field.fault!,/POOL/);assert.equal(m.field.pending,undefined);assert.equal(m.field.committed,commits);
 }
});

test('causal witness follower traverses consecutive actual-model sections with bounded ownership and pool',()=>{
 const m=model();let steps=0;
 for(;steps<20000&&m.field.scheduled<14&&m.state==='PLAYING';steps++)m.step(CONFIG.step,input(m.field.certificate,m.elapsed));
 assert.ok(m.field.scheduled>=14);assert.equal(m.hitSerial,0);assert.equal(m.field.fault,undefined);
 assert.ok(m.field.ledger.snapshot().length<=16);assert.ok(m.field.slots.filter(s=>s.planned).length<=32);assert.ok(m.field.samples.length<=2048);
 assert.equal(new Set(m.field.ledger.knownHazards(m.distance).map(h=>h.id)).size,m.field.ledger.knownHazards(m.distance).length);
});

test('combined raw inputs outside the approved planner domain fail closed while Ship steering is preserved',()=>{
 const m=model(),ship=new Ship();for(let i=0;i<144;i++){ship.update(CONFIG.step,{x:2,y:0});m.step(CONFIG.step,{x:2,y:0});}
 assert.deepEqual(m.ship,ship);assert.equal(m.field.committed,0);assert.equal(m.field.lastOutcome!.status,'omitted-uncertified');
 assert.equal(m.field.lastOutcome!.reason,'validation:INVALID_TERMINAL_STATE:control count/input');
 assert.match(m.field.lastOutcome!.attempts[0]!.reason!,/STRUCTURAL_INVALID/);
});

test('developer teardown explicitly cancels jobs and prevents further planning or simulation',()=>{
 const m=model();step(m,20);const old=m.field.pending!,elapsed=m.elapsed;m.dispose();
 assert.equal(old.getResult()!.reason,'CANCELLED');assert.equal(m.field.pending,undefined);step(m,100);assert.equal(m.elapsed,elapsed);
});
