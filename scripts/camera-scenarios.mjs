import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ReleaseModel } from '../src/release/model.ts';
import { SHIP_COLLIDER } from '../src/core/ship-collider.ts';
import { hazardVariant } from '../src/core/hazard-profile.ts';
import { certifiedInput, fragmentInput } from '../tests/fixtures/fragment-flight.ts';

export const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/CAMERA-001/final';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function state(m) {
 return {distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},state:m.state,hull:m.hull,phase:m.phase,speed:m.speed,hitSerial:m.hitSerial,invulnerability:m.invulnerability,hazards:m.field.hazards.map(h=>({...h})),fragments:m.fragments.active.map(p=>({...p})),count:m.fragments.count,pickup:m.fragments.lastPickup,contact:m.lastShipContact,publications:m.field.events.map(e=>({...e}))};
}
const steer=(m,x,y)=>({x:Math.max(-1,Math.min(1,(x-m.ship.x)*1.6-m.ship.vx*.3)),y:Math.max(-1,Math.min(1,(y-m.ship.y)*1.6-m.ship.vy*.3))});
function run(seed,pilot,inspect,maxDistance=1500) {
 const m=new ReleaseModel();m.ready();m.start(seed);const inputs=[];let found;
 while(m.state==='PLAYING'&&m.distance<maxDistance) {
  const input=pilot(m,inputs.length);inputs.push({...input});m.step(1/120,input);
  const match=inspect(m,inputs.length);
  if(match){found={seed,tick:inputs.length,inputs,state:state(m),...match};break;}
 }
 m.dispose();return found;
}
export async function scenarios() {
 const rows=[];
 for(const sign of [-1,1]) {
  let best;
  // Seeds found by a bounded0..29 search; retain actual input history, not geometry fixtures.
  for(const seed of [sign<0?16:20])for(const y of [0,-1.8,1.8,-2.8,2.8]) {
   const found=run(seed,m=>steer(m,sign*4.6,y),(m,tick)=>{
    if(m.hull!==3||Math.abs(m.ship.x)<4.5)return;
    const p=SHIP_COLLIDER.parts[sign<0?1:2];
    for(const h of m.field.slots)if(h.active&&hazardVariant(h.kind,h.phase)<2&&h.kind<2&&Math.abs(h.z-p.offsetZ)<.12) {
     const clearance=Math.hypot(m.ship.x+p.offsetX-h.x,m.ship.y+p.offsetY-h.y,h.z-p.offsetZ)-h.radius-p.radius;
     if(clearance>.02&&clearance<.42)return{event:{name:sign<0?'left-boundary':'right-boundary',hazard:{...h},part:p.id,clearance,boundaryRoom:6-Math.abs(m.ship.x)},captureTick:tick-12};
    }
   },850);
   if(found){best=found;break;}
  }
  assert.ok(best,`No real boundary near miss found: ${sign}`);rows.push(best);console.log(best.event.name,best.seed,best.tick,best.event.clearance,best.state.ship.y);
 }
 const wing=run(42,m=>{const p=m.fragments.active[0];return p?steer(m,(p.approach??p).x,(p.approach??p).y):{x:0,y:0};},(m,tick)=>m.lastShipContact?.bodyClear?{event:{name:'wing-hit',contact:m.lastShipContact},captureTick:tick}:undefined,300);
 assert.ok(wing);rows.push(wing);
 let pickupTick,stationTick;
 const pickup=run(42,m=>fragmentInput(m,m.fragments.active[0]),(m,tick)=>{if(m.fragments.count===1)pickupTick??=tick;return pickupTick&&tick>=pickupTick+24?{event:{name:'pickup',pickup:m.fragments.lastPickup,pickupTick},captureTick:pickupTick+1}:undefined;},400);assert.ok(pickup);rows.push(pickup);
 const station=run(42,m=>fragmentInput(m,m.fragments.active[0]),(m,tick)=>{if(m.fragments.count===2)stationTick??=tick;return stationTick&&tick>=stationTick+24?{event:{name:'station',pickup:m.fragments.lastPickup,pickupTick:stationTick},captureTick:stationTick+1}:undefined;},700);assert.ok(station);rows.push(station);
 let verticalEvent,verticalCapture;
 const vertical=run(42,(m,tick)=>steer(m,0,Math.sin(tick/60)*3.4),(m,tick)=>{
  if(!verticalEvent&&m.hull===3&&Math.abs(m.ship.vy)>3){const h=m.field.slots.find(h=>h.active&&h.kind<2&&h.z< -8&&h.z> -30&&Math.abs(h.x)<2);if(h){verticalEvent={name:'vertical',hazard:{...h}};verticalCapture=tick;}}
  if(verticalEvent&&m.distance>190){assert.equal(m.hull,3);return{event:{...verticalEvent,safelyPassedAt:m.distance},captureTick:verticalCapture};}
 },400);assert.ok(vertical);rows.push(vertical);
 const sustained=run(42,(_m,t)=>t<150?{x:-1,y:0}:t<390?{x:1,y:0}:t<510?{x:0,y:1}:t<650?{x:0,y:-1}:{x:-1,y:1},(_m,t)=>t===850?{event:{name:'sustained'},captureTick:t}:undefined);assert.ok(sustained);rows.push(sustained);
 // Continue actual witness flight until all five ordinary station variants have appeared.
 const apertures={},m=new ReleaseModel();m.ready();m.start(42);const inputs=[];
 while(m.state==='PLAYING'&&m.distance<6000&&Object.keys(apertures).length<5) {
  const input=certifiedInput(m);inputs.push({...input});m.step(1/120,input);
  for(const h of m.field.slots)if(h.active&&h.kind>=4&&h.kind<=8&&h.z< -15&&h.z> -16&&!apertures[h.kind])apertures[h.kind]={seed:42,tick:inputs.length,inputs:inputs.slice(),state:state(m),event:{name:`aperture-${['center','left','right','upper','lower'][h.kind-4]}`,hazard:{...h}},captureTick:inputs.length};
 }
 assert.equal(m.hull,3);m.dispose();rows.push(...Object.values(apertures));
 const output=rows.map(row=>({...row,stateHash:digest(row.state),inputHash:digest(row.inputs)}));
 await mkdir(directory,{recursive:true});await writeFile(`${directory}/camera-scenarios.json`,JSON.stringify(output));
 console.log('real scenarios',output.map(r=>[r.event.name,r.seed,r.tick,r.state.distance]));return output;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/camera-scenarios.mjs'))await scenarios();
