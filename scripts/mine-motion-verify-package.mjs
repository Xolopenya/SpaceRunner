import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { beginTrajectoryReplay, beginKnownFieldValidation } from '../src/core/field-validator.ts';
import { MINE_GEOMETRY as geometry, mineTransaction } from '../src/experiments/moving-mine/source.ts';
import { mineX, mineY, isMine } from '../src/experiments/moving-mine/motion.ts';

const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024});
const head=git('rev-parse','HEAD').toString().trim(),baseline='3779d3247a65e27046180f8f0541a467ea0eb75c';
const path=resolve(process.argv[2]??`review-packages/GAMEPLAY-EXPERIMENT-003C2-review-${head.slice(0,7)}.zip`);
const bytes=await readFile(path),entries=readZip(bytes),sha=b=>createHash('sha256').update(b).digest('hex');
function json(name){assert.ok(entries.has(name),name);return JSON.parse(entries.get(name));}
const manifest=json('reports/manifest.json'),config=json('project_snapshot/review.config.json');
assert.equal(manifest.finalCommit,head);assert.equal(manifest.baselineCommit,baseline);assert.equal(manifest.taskId,'GAMEPLAY-EXPERIMENT-003C2');assert.equal(manifest.branch,'feature/gameplay-003c2-mine-motion-tuning');
assert.equal(manifest.checks.length,16);assert.ok(manifest.checks.every(c=>c.exitCode===0));
assert.equal(manifest.tests.filter(t=>t.suite==='unit').length,203);assert.equal(manifest.tests.filter(t=>t.suite==='browser').length,73);assert.ok(manifest.tests.every(t=>t.result==='passed'));
const inventory=json('reports/content-inventory.json');assert.equal(inventory.length,entries.size-1);
for(const r of inventory){assert.equal(entries.get(r.path)?.length,r.bytes);assert.equal(sha(entries.get(r.path)),r.sha256);}
let snapshotFiles=0;for(const[name,b]of entries)if(name.startsWith('project_snapshot/')){assert.ok(b.equals(git('show',`${head}:${name.slice(17)}`)),name);snapshotFiles++;}
for(const prefix of config.preservedUntracked)assert.ok(![...entries.keys()].some(p=>p.startsWith('project_snapshot/'+prefix)));
assert.deepEqual(await reviewWorktree(config,process.cwd(),git),json('changes/preserved-untracked-inventory.json'));
assert.equal(sha(entries.get('project_snapshot/src/experiments/moving-mine/space-mine.glb')),'c64b8bfa0146ffc7d819f46ab74887326828b2b8266604b516a3cdc570189c77');
const preservation=json('logs/mine-motion-preservation.json');assert.equal(preservation.productionByteIdentical,true);assert.equal(preservation.comparisons.length,92);assert.equal(preservation.bytes,931651);assert.equal(preservation.build.length,15);
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
const browser=json('logs/mine-motion-browser.json');assert.equal(browser.results.length,5);assert.equal(browser.videos.length,5);assert.equal(browser.screenshots.length,25);
for(const r of browser.results){assert.deepEqual(r.errors,[]);assert.equal(r.restarts.samples.length,10);assert.equal(r.requests.length,7);for(const s of r.restarts.samples)assert.deepEqual({...s,heap:undefined},{...r.restarts.before,heap:undefined});
 const raw=json(`logs/mine-motion-${r.variant}-${r.viewport}-raw.json`);for(const s of raw.steps.filter(s=>s.chunk))assert.ok(s.chunk.propagations<=3072&&s.chunk.queries<=6144);
 const poses=raw.poses;assert.ok(poses.length>30);for(const p of poses){const h=p.planned;assert.equal(geometry.validHazard(h),true);assert.equal(p.x,mineX(h,p.tick/120));assert.equal(p.y,mineY(h,p.tick/120));assert.equal(p.z,p.distance-h.passDistance);assert.equal(p.renderedX,p.x);assert.equal(p.renderedY,p.y);assert.equal(p.renderedZ,p.z);}
 if(r.variant==='diagonal')assert.ok(new Set(poses.map(p=>p.y)).size>30);
}
for(const v of browser.videos){assert.equal(entries.get('videos/'+v.filename)?.length,v.bytes);assert.notEqual(v.decoded[0].hash,v.decoded[1].hash);}
for(const r of json('logs/baseline/historical-inventory.json')){const b=entries.get('logs/baseline/'+r.file);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);}
const patch=entries.get('changes/baseline-to-head.patch');assert.ok(patch.equals(git('diff','--binary','--full-index',baseline,head)));
execFileSync('git',['apply','--reverse','--check','--binary','-'],{input:patch,maxBuffer:8*1024*1024});
const result={path,head,baseline,bytes:bytes.length,sha256:sha(bytes),entries:entries.size,snapshotFiles,inventory:inventory.length,independentMovingReplays:audits,negativeReplays:negative,reversePatchApplicable:true,readable:true,productionByteIdentical:true};
await writeFile(path+'.verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
