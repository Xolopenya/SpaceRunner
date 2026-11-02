import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { TARGET_GEOMETRY, targetCapture } from '../src/experiments/moving-mine/target-lock-source.ts';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { beginTrajectoryReplay, beginKnownFieldValidation } from '../src/core/field-validator.ts';
import { MINE_GEOMETRY as geometry, mineTransaction } from '../src/experiments/moving-mine/source.ts';
import { mineX, mineY, isMine } from '../src/experiments/moving-mine/motion.ts';

const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024});
const head=git('rev-parse','HEAD').toString().trim(),baseline='bad0a5498e41a262da224308deefae5bee8bd28e';
const path=resolve(process.argv[2]??`review-packages/GAMEPLAY-EXPERIMENT-003C3-review-${head.slice(0,7)}.zip`);
const bytes=await readFile(path),entries=readZip(bytes),sha=b=>createHash('sha256').update(b).digest('hex');
function json(name){assert.ok(entries.has(name),name);return JSON.parse(entries.get(name));}
const manifest=json('reports/manifest.json'),config=json('project_snapshot/review.config.json');
assert.equal(manifest.finalCommit,head);assert.equal(manifest.baselineCommit,baseline);assert.equal(manifest.taskId,'GAMEPLAY-EXPERIMENT-003C3');assert.equal(manifest.branch,'feature/gameplay-003c3-target-lock-mine');
assert.equal(manifest.checks.length,19);assert.ok(manifest.checks.every(c=>c.exitCode===0));
assert.equal(manifest.tests.filter(t=>t.suite==='unit').length,212);assert.equal(manifest.tests.filter(t=>t.suite==='browser').length,77);assert.ok(manifest.tests.every(t=>t.result==='passed'));
const inventory=json('reports/content-inventory.json');assert.equal(inventory.length,entries.size-1);
for(const r of inventory){assert.equal(entries.get(r.path)?.length,r.bytes);assert.equal(sha(entries.get(r.path)),r.sha256);}
let snapshotFiles=0;for(const[name,b]of entries)if(name.startsWith('project_snapshot/')){assert.ok(b.equals(git('show',`${head}:${name.slice(17)}`)),name);snapshotFiles++;}
for(const prefix of config.preservedUntracked)assert.ok(![...entries.keys()].some(p=>p.startsWith('project_snapshot/'+prefix)));
assert.deepEqual(await reviewWorktree(config,process.cwd(),git),json('changes/preserved-untracked-inventory.json'));
assert.equal(sha(entries.get('project_snapshot/src/experiments/moving-mine/space-mine.glb')),'c64b8bfa0146ffc7d819f46ab74887326828b2b8266604b516a3cdc570189c77');
const preservation=json('logs/target-lock-preservation.json');assert.equal(preservation.productionByteIdentical,true);assert.equal(preservation.comparisons.length,116);assert.equal(preservation.bytes,931651);assert.equal(preservation.build.length,15);
function finish(j){while(!j.getResult())j.advance();return j.getResult();}
let audits=0,negative=0;
for(const prefix of ['mine','mine-motion']){const evidence=json(`logs/${prefix}-witnesses.json`),b=json(`logs/${prefix}-benchmark.json`);let count=0;
 for(const w of evidence.witnesses){const r=finish(beginTrajectoryReplay(w.context,w.controls,{geometry}));assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);count++;}
 assert.equal(count,b.audits);audits+=count;
 for(const f of evidence.fixtures.filter(f=>f.context&&f.result.decision==='reject')){const r=finish(beginKnownFieldValidation(f.context,{geometry}));assert.equal(r.decision,'reject');assert.equal(r.reason,'INSUFFICIENT_REACTION_DISTANCE');negative++;}
 for(const r of evidence.runs){for(const o of r.publications)assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.metrics.planningTicks<=144&&o.attempts.length<=2);
  for(const p of r.poses){const a=p.id.split('/'),h=mineTransaction(Number(a[1]),Number(a[2]),Number(a[3]),a[4]).hazards.find(isMine);assert.equal(p.x,mineX(h,p.tick/120));assert.equal(p.y,mineY(h,p.tick/120));assert.equal(p.z,p.distance-h.passDistance);}}
 if(prefix==='mine-motion'){assert.equal(evidence.runs.length,45);assert.equal(b.fixtures,250);assert.equal(b.accepted,240);assert.equal(b.negative,10);assert.equal(count,762);}
 else{assert.equal(evidence.runs.length,30);assert.equal(b.fixtures,100);assert.equal(b.accepted,96);}
}
assert.equal(negative,14);
const target=json('logs/target-lock-witnesses.json'),benchmark=json('logs/target-lock-benchmark.json');
assert.equal(benchmark.fixtures,1458);assert.equal(benchmark.accepted,1458);assert.equal(benchmark.resolutionRejected,0);assert.equal(benchmark.unfinished,0);assert.equal(target.runs.length,45);
let targetAudits=0;
for(const w of target.witnesses){const g=w.geometryVersion===TARGET_GEOMETRY.version?TARGET_GEOMETRY:geometry,r=finish(beginTrajectoryReplay(w.context,w.controls,{geometry:g}));assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);targetAudits++;}
assert.equal(targetAudits,benchmark.audits);assert.equal(targetAudits,2236);audits+=targetAudits;
for(const n of target.negative){const r=finish(beginTrajectoryReplay(n.context,n.controls,{geometry:TARGET_GEOMETRY}));assert.equal(r.decision,'reject');assert.equal(r.reason,'COLLISION_FOUND');assert.ok(r.detail.includes('target-lock-v1/'));negative++;}
assert.equal(target.negative.length,3);
for(const r of target.runs){const map=new Map();for(const o of r.publications){assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.metrics.planningTicks<=144&&o.attempts.length<=2);
 for(const h of o.transaction?.hazards??[])if(isMine(h)){map.set(h.id,h);if(h.motion.version==='target-lock-v1'){assert.deepEqual(h.motion.capture,targetCapture(o.witness.context));assert.equal(o.publicationChecks[0].witness,undefined);assert.equal(o.resolution.previewPose.x,h.x);assert.equal(o.resolution.previewPose.y,h.y);assert.equal(TARGET_GEOMETRY.validHazard(h),true);}}}
 for(const p of r.poses){const h=map.get(p.id);assert.ok(h);assert.equal(p.x,mineX(h,p.tick/120));assert.equal(p.y,mineY(h,p.tick/120));assert.equal(p.z,p.distance-h.passDistance);}
 for(const c of r.work)assert.ok(c.propagations<=3072&&c.queries<=6144);
 if(r.history==='witness')assert.equal(r.hull,3);
}
assert.deepEqual(benchmark.policies.map(p=>[p.proposed,p.published,p.omitted]),[[48,43,5],[48,43,5],[48,37,11]]);
assert.equal(benchmark.policies[2].gridContacts,75);assert.equal(benchmark.policies[2].boundaryContacts,48);
const browser=json('logs/target-lock-browser.json');assert.equal(browser.results.length,7);assert.equal(browser.videos.length,6);assert.equal(browser.screenshots.length,26);
let browserAudits=0;
for(const r of browser.results){assert.deepEqual(r.errors,[]);assert.equal(r.restarts.samples.length,10);assert.equal(r.requests.length,7);for(const s of r.restarts.samples)assert.deepEqual({...s,heap:undefined},{...r.restarts.before,heap:undefined});
 const label=(r.variant==='target-lock'?'target':r.variant)+(r.recorded?'':'-unrecorded'),raw=json(`logs/target-lock-${label}-${r.viewport}-raw.json`);
 for(const s of raw.steps.filter(s=>s.chunk))assert.ok(s.chunk.propagations<=3072&&s.chunk.queries<=6144);
 assert.ok(raw.poses.length>30);for(const p of raw.poses){const h=p.planned,g=r.variant==='target-lock'?TARGET_GEOMETRY:geometry;assert.equal(g.validHazard(h),true);assert.equal(p.x,mineX(h,p.tick/120));assert.equal(p.y,mineY(h,p.tick/120));assert.equal(p.z,p.distance-h.passDistance);assert.equal(p.renderedX,p.x);assert.equal(p.renderedY,p.y);assert.equal(p.renderedZ,p.z);}
 assert.ok(r.micro.poseBatchMs.length===20&&r.micro.ccdBatchMs.length===20);
 for(const o of raw.publications){if(!o.witness)continue;const w=o.witness,replay=finish(beginTrajectoryReplay(w.context,w.controls,{geometry:r.variant==='target-lock'?TARGET_GEOMETRY:geometry}));assert.equal(replay.decision,'accept');assert.equal(replay.witness.hash,w.hash);browserAudits++;}
 if(r.variant==='target-lock'){assert.ok(raw.acquisition.length>0);assert.ok(raw.acquisition.every(p=>p.liveMines===0));assert.ok(r.targetResolutionMs.count>0);
  for(const o of raw.publications.filter(o=>o.resolution&&o.witness&&o.transaction.hazards.some(isMine)))assert.deepEqual(o.transaction.hazards.find(isMine).motion.capture,targetCapture(o.witness.context));}
}
const demo=json('logs/target-lock-no-retarget-trace.json');assert.equal(demo.hull,3);assert.equal(demo.hits,0);const poses=demo.poses.filter(p=>p.mine);assert.ok(poses.length>30);assert.equal(new Set(poses.map(p=>JSON.stringify(p.mine.planned.motion))).size,1);assert.ok(Math.max(...poses.map(p=>p.ship.y))-Math.min(...poses.map(p=>p.ship.y))>2);
assert.ok(poses.filter(p=>p.tick<=demo.first.motion.capture.tick+54).every(p=>p.ship.y===0));
for(const v of browser.videos){assert.equal(entries.get('videos/'+v.filename)?.length,v.bytes);assert.notEqual(v.decoded[0].hash,v.decoded[1].hash);}
for(const name of browser.screenshots){const b=entries.get('screenshots/'+name);assert.ok(b?.length>1000);assert.equal(b.readUInt32BE(0),0x89504e47);}
for(const r of json('logs/baseline/historical-inventory.json')){const b=entries.get('logs/baseline/'+r.file);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);}
const patch=entries.get('changes/baseline-to-head.patch');assert.ok(patch.equals(git('diff','--binary','--full-index',baseline,head)));
execFileSync('git',['apply','--reverse','--check','--binary','-'],{input:patch,maxBuffer:8*1024*1024});
const approved=resolve('.cache/review/GAMEPLAY-EXPERIMENT-003C3/approved-c2');
execFileSync('git',['apply','--check','--binary','-'],{cwd:approved,env:{...process.env,GIT_CEILING_DIRECTORIES:resolve(approved,'..')},input:patch,maxBuffer:8*1024*1024});
const result={path,head,baseline,bytes:bytes.length,sha256:sha(bytes),entries:entries.size,snapshotFiles,inventory:inventory.length,independentMovingReplays:audits,negativeReplays:negative,browserIndependentReplays:browserAudits,forwardPatchApplicable:true,reversePatchApplicable:true,readable:true,productionByteIdentical:true};
await writeFile(path+'.verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
