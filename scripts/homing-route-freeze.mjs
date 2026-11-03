import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readZip} from './zip.mjs';
const baseline='c51da9d2859c43765f83a29ca12c06aa54cf7284',dir=resolve('.cache/review/GAMEPLAY-003C4-FIX2');await mkdir(dir,{recursive:true});
const zipPath=resolve('review-packages/GAMEPLAY-003C4-FIX-review-c51da9d.zip'),bytes=await readFile(zipPath),entries=readZip(bytes),manifest=JSON.parse(entries.get('reports/manifest.json'));
assert.equal(manifest.finalCommit,baseline);
const inv=JSON.parse(entries.get('reports/content-inventory.json'));for(const name of ['evidence/corpus/evidence.json','evidence/before/adaptive-homing-witnesses.json']){assert.equal(createHash('sha256').update(entries.get(name)).digest('hex'),inv.find(x=>x.path===name).sha256);}
const prior=JSON.parse(entries.get('evidence/corpus/evidence.json')),raw=JSON.parse(entries.get('evidence/before/adaptive-homing-witnesses.json'));
const cases=prior.omissions.map((o,index)=>{const run=raw.runs.find(r=>r.policy==='balanced'&&r.seed===o.seed&&r.history===o.history),outcome=run.publications.find(p=>p.section.id===o.section);assert.deepEqual(outcome.publicationChecks[0],o.primary);return{id:index,seed:o.seed,history:o.history,section:o.section,category:o.category,context:o.primary.context,hint:outcome.resolution?.hint,original:o.primary.result,originalMetrics:o.primary.metrics,fullBeamRecovered:o.fullSearchCounterfactual?.decision==='accept'};});
assert.equal(cases.filter(c=>c.category==='bounded-proposal-no-witness').length,15);assert.equal(cases.filter(c=>c.fullBeamRecovered).length,14);
await mkdir('tests/fixtures',{recursive:true});await writeFile('tests/fixtures/homing-route-counterexamples.json',JSON.stringify({baseline,sourceZipSha256:createHash('sha256').update(bytes).digest('hex'),cases},null,2)+'\n');
await writeFile(join(dir,'original-balanced-runs.json'),JSON.stringify(raw.runs.filter(r=>r.policy==='balanced')));
const archive=execFileSync('git',['archive','--format=zip',baseline],{maxBuffer:64*1024*1024}),file=join(dir,'baseline-source.zip');await writeFile(file,archive);
execFileSync('python',['-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',file,join(dir,'baseline')]);
await writeFile(join(dir,'provenance.json'),JSON.stringify({baseline,sourceZip:zipPath,sourceSha256:createHash('sha256').update(bytes).digest('hex'),cases:cases.map(c=>({id:c.id,seed:c.seed,history:c.history,reason:c.original.reason,detail:c.original.detail,root:c.context.player,input:c.context.input,elapsed:c.context.elapsed,distance:c.context.distance,hazards:c.context.committed.map(h=>({id:h.id,x:h.x,y:h.y,d:h.passDistance,kind:h.kind})),hint:!!c.hint,recovered:c.fullBeamRecovered}))},null,2));
console.log(JSON.stringify({baseline,cases:cases.length,noWitness:15,beamRecovered:14,sourceZipBytes:bytes.length}));
