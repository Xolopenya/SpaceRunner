import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile,access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Box3,Mesh,Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeModel } from '../src/assets/asset-manager.ts';
import { MODEL_ASSETS } from '../src/assets/catalog.ts';
import { ResourceOwner } from '../src/assets/resources.ts';
import { ReleaseModel,RELEASE_GEOMETRY } from '../src/release/model.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { ShipHazardCollision } from '../src/core/ship-hazard-collision.ts';
import { SHIP_COLLIDER,BODY_COLLIDER } from '../src/core/ship-collider.ts';
import { FragmentRun } from '../src/collectibles/run.ts';
import { FRAGMENT } from '../src/collectibles/settings.ts';
import { certifiedInput,fragmentInput } from '../tests/fixtures/fragment-flight.ts';

const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-004B/final';await mkdir(directory,{recursive:true});
const pct=v=>{const s=[...v].sort((a,b)=>a-b);return{n:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const baselineRoot=resolve(process.env.SHIP_BASELINE_DIR??'.cache/review/GAMEPLAY-004B/baseline-project');let baseline;
try{await access(`${baselineRoot}/src/release/model.ts`);const m=await import(pathToFileURL(`${baselineRoot}/src/release/model.ts`));const v=await import(pathToFileURL(`${baselineRoot}/src/core/field-validator.ts`));baseline={Model:m.ReleaseModel,geometry:m.RELEASE_GEOMETRY,replay:v.beginTrajectoryReplay};}catch(error){console.log('Baseline unavailable:',error.message);}
const rows=[];let audits=0;
for(const variant of baseline?['before','after']:['after'])for(const seed of [0,11,42])for(const policy of ['witness','neutral','horizontal','collect']){
 const spec=variant==='before'?baseline:{Model:ReleaseModel,geometry:RELEASE_GEOMETRY,replay:beginTrajectoryReplay};
 const m=new spec.Model();m.ready();m.start(seed);const decisions=[],placements=[],pickups=[],seen=new Set(),update=[],samples=[];let last,count=0,tick=0;
 const fragmentStep=m.fragments.step.bind(m.fragments);m.fragments.step=(...args)=>{const start=performance.now();fragmentStep(...args);update.push(performance.now()-start);};
 while(m.distance<1500&&m.state==='PLAYING'){
  const p=m.fragments.active[0],axis=policy==='neutral'?{x:0,y:0}:policy==='horizontal'?{x:Math.floor(tick/180)%2?-1:1,y:0}:policy==='collect'?fragmentInput(m,p):certifiedInput(m);
  const at=performance.now();m.step(1/120,axis);samples.push(performance.now()-at);tick++;
  assert.equal(m.field.fault,undefined);
  for(const p of m.fragments.active)if(!seen.has(p.id)){seen.add(p.id);placements.push(p);}
  if(m.fragments.count>count){count=m.fragments.count;pickups.push({...m.fragments.lastPickup,count,hull:m.hull});}
  const o=m.field.lastOutcome;if(!o||o===last)continue;last=o;
  if(o.witness){const j=spec.replay(o.witness.context,o.witness.controls,{geometry:spec.geometry});while(!j.getResult())j.advance();assert.equal(j.getResult().decision,'accept');audits++;}
  decisions.push({status:o.status,distance:m.distance,family:o.section.encounter,reason:o.reason,attempts:o.attempts.map(a=>({kind:a.kind,reason:a.reason})),witness:o.witness,metrics:o.metrics,geometry:o.transaction});
 }
 if(policy==='witness')assert.equal(m.hull,3);
 const row={variant,seed,policy,distance:m.distance,elapsed:m.elapsed,hull:m.hull,count:m.fragments.count,committed:m.field.committed,omitted:m.field.omitted,
  decisions,placements,pickups,fragmentStats:{...m.fragments.stats},runtimeQueries:m.shipCollisionMetrics,planner:m.field.samples,
  fixedStepMs:pct(samples),pickupUpdateMs:pct(update),historyHash:hash({decisions:decisions.map(d=>[d.status,d.geometry,d.witness?.hash]),placements,pickups})};
 rows.push(row);m.dispose();console.log(variant,seed,policy,row.distance.toFixed(1),row.hull,row.committed,row.omitted);
}
const matched=[];if(baseline)for(const a of rows.filter(r=>r.variant==='before'&&['neutral','horizontal'].includes(r.policy))){const b=rows.find(r=>r.variant==='after'&&r.seed===a.seed&&r.policy===a.policy),distance=Math.min(a.distance,b.distance);const prefix=r=>{const ds=r.decisions.filter(d=>d.distance<=distance);return{committed:ds.filter(d=>d.status==='committed').length,omitted:ds.filter(d=>d.status!=='committed').length,ordinary:ds.filter(d=>d.status==='committed'&&d.family!=='station-wreck').length};};matched.push({seed:a.seed,policy:a.policy,distance,before:prefix(a),after:prefix(b)});}
// Repeat exact causal witness histories; exclude wall-clock timings from hash.
const determinism=[];for(const seed of [0,11,42]){const m=new ReleaseModel();m.ready();m.start(seed);const seen=new Set(),placements=[],decisions=[],pickups=[];let last,count=0;
 while(m.distance<1500&&m.state==='PLAYING'){m.step(1/120,certifiedInput(m));for(const p of m.fragments.active)if(!seen.has(p.id)){seen.add(p.id);placements.push(p);}if(m.fragments.count>count){count=m.fragments.count;pickups.push({...m.fragments.lastPickup,count,hull:m.hull});}const o=m.field.lastOutcome;if(o&&o!==last){last=o;decisions.push([o.status,o.transaction,o.witness?.hash]);}}
 const digest=hash({decisions,placements,pickups}),original=rows.find(r=>r.variant==='after'&&r.policy==='witness'&&r.seed===seed);assert.equal(digest,original.historyHash);determinism.push({seed,hash:digest});m.dispose();}
const a={x:-1.7,y:.35,z:-.6},b={x:-1.7,y:.35,z:-.8},hazard={kind:0,radius:.65,phase:0,spin:0};
const collisions=[];for(const profile of [BODY_COLLIDER,SHIP_COLLIDER]){const q=new ShipHazardCollision(profile),times=[];for(let sample=0;sample<100;sample++){const start=performance.now();for(let i=0;i<1000;i++)q.hit(a,b,hazard,120,1/120);times.push((performance.now()-start)/1000);}collisions.push({profile:profile.version,timingMs:pct(times),narrow:q.narrowQueries,broad:q.broadSkips});}
const run=new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist),pickupCosts=[];for(let i=0;i<run.slots.length;i++)Object.assign(run.slots[i],{state:'active',proposal:{id:String(i),section:4,anchor:'benchmark',situation:'debris',x:i*.5,y:0,passDistance:200}});
for(let sample=0;sample<100;sample++){const t=performance.now();for(let i=0;i<1000;i++)run.step(0,0,0,.01,.01,.3,1);pickupCosts.push((performance.now()-t)/1000);}
const bytes=await readFile('public/assets/kenney-space/craft_speederA.glb');const model=normalizeModel((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,MODEL_ASSETS[0]);
const wingVertices=new Map();model.traverse(n=>{if(n instanceof Mesh){const p=n.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);if(Math.abs(v.x)>.75)wingVertices.set(v.toArray().map(x=>x.toFixed(6)).join(','),v.toArray());}}});
const geometry={file:'craft_speederA.glb',sha256:createHash('sha256').update(bytes).digest('hex'),dimensions:new Box3().setFromObject(model).getSize(new Vector3()).toArray(),wingVertices:[...wingVertices.values()],profile:SHIP_COLLIDER};const owner=new ResourceOwner();owner.track(model);owner.dispose();
await writeFile(`${directory}/ship-audit.json`,JSON.stringify({node:process.version,baselineCommit:'05d075415a6e813c28134d37d8f74afdb50af7bb',baselineAvailable:!!baseline,geometry,rows,matched,determinism,audits,collisions,eightActivePickupMs:pct(pickupCosts),notes:['Real three-hull runs stop at death; fixed-input publication comparison uses matched prefixes.','Own-witness histories differ between shapes; their rates are not a controlled input comparison.','Conservative billed planner costs are three sphere pairs /twelve sphere-box pairs; actual runtime narrow queries recorded separately.']},null,2));
console.log('Ship audit passed, independent witnesses:',audits);
