import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createZip,readZip} from './zip.mjs';
import {excludedPath,containsSecret} from './review-safety.mjs';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {ADAPTIVE_GEOMETRY as geometry} from '../src/experiments/adaptive-homing/transaction.ts';
const task='GAMEPLAY-003C4-FIX2',baseline='c51da9d2859c43765f83a29ca12c06aa54cf7284',branch='feature/gameplay-003c4-bounded-route-proposal',cache=resolve('.cache/review/'+task);
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024}),sha=b=>createHash('sha256').update(b).digest('hex'),head=git('rev-parse','HEAD').toString().trim();
assert.equal(git('branch','--show-current').toString().trim(),branch);git('diff','--exit-code');git('diff','--cached','--exit-code');
const checks=JSON.parse(await readFile(join(cache,'verify/checks.json')));assert.equal(checks.length,8);assert.ok(checks.every(c=>c.exitCode===0));
const files=git('ls-tree','-rz','--name-only',head).toString().split('\0').filter(p=>p&&!excludedPath(p)),batch=execFileSync('git',['cat-file','--batch'],{input:files.map(p=>`${head}:${p}\n`).join(''),maxBuffer:128*1024*1024});let offset=0;const blobs=new Map();
for(const p of files){const end=batch.indexOf(10,offset),size=Number(batch.subarray(offset,end).toString().split(' ').at(-1));assert.ok(Number.isFinite(size));offset=end+1;blobs.set(p,batch.subarray(offset,offset+size));offset+=size+1;}
for(const r of JSON.parse(await readFile(join(cache,'verify/source-hashes.json'))))assert.equal(sha(blobs.get(r.path).toString().replaceAll('\r\n','\n')),r.sha256,r.path);
const entries=[];function add(name,data){data=Buffer.from(data);assert.ok(!excludedPath(name));assert.equal(containsSecret(data),false,name);entries.push({name,data});}
for(const[p,b]of blobs)add('project_snapshot/'+p,b);
const patch=git('diff','--binary','--full-index',baseline,head),patchPath=join(cache,'changes.patch');await writeFile(patchPath,patch);const patchChecks=[];
for(const[version,reverse]of [[baseline,false],[head,true]]){const env={...process.env,GIT_INDEX_FILE:join(cache,reverse?'reverse.index':'forward.index')};execFileSync('git',['read-tree',version],{env});execFileSync('git',['apply','--cached','--check',...(reverse?['--reverse']:[]),patchPath],{env});patchChecks.push({root:version,reverse,passed:true});}
add('changes/changes.patch',patch);add('changes/git.json',JSON.stringify({task,baseline,head,branch,history:git('log','--format=%H %s',`${baseline}..${head}`).toString(),patchChecks},null,2));
async function include(dir,prefix){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await include(path,prefix+e.name+'/');else if(/\.(json|log|png|webm|md|txt)$/.test(e.name))add(prefix+e.name,await readFile(path));}}
for(const d of ['verify','browser','media'])await include(join(cache,d),'evidence/'+d+'/');
for(const e of await readdir(cache,{withFileTypes:true}))if(e.isFile()&&/\.(json|log)$/.test(e.name))add('evidence/'+e.name,await readFile(join(cache,e.name)));
const benchmark=JSON.parse(await readFile(join(cache,'benchmark.json'))),matrix=JSON.parse(await readFile(join(cache,'matrix.json')));assert.deepEqual(benchmark.frozen62,{before:44,after:59,recovered:15,regressions:0});assert.equal(matrix.summary.regressed.length,0);
const media=JSON.parse(await readFile(join(cache,'media/manifest.json'))),browser=JSON.parse(await readFile(join(cache,'browser/summary.json')));assert.equal(media.evidence.length,4);assert.equal(browser.results.length,4);
const assessment=JSON.parse(await readFile(join(cache,'report-summary.json')));
add('reports/manifest.json',JSON.stringify({taskId:task,baselineCommit:baseline,finalCommit:head,branch,checks,patchChecks,status:assessment.additionalDeadlineCases.length?'Partial':'Complete',productionRollout:false,
 evidence:'Original ZIP-bound18 contexts including15NO_WITNESS; frozen62 gate A/B, matched-input real games, four cadences, protected isolated972 matrix, independent coupled replays, rejected unscoped matrix, Chrome CPU/RAF/render/visibility/timeline/memory, four actual decoded WebM clips.',
 verification:'Verification commands precede commit; normalized source hashes bind tested implementation and tools to HEAD. SHA inventory covers every other entry. Not a production approval or independent architecture review.'},null,2));
let audits=0;for(const w of [...JSON.parse(await readFile(join(cache,'witnesses.json'))).witnesses,...matrix.witnesses]){const j=beginTrajectoryReplay(w.context,w.controls,{geometry});while(!j.getResult())j.advance();const r=j.getResult();assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);audits++;}
add('reports/archive-verification.json',JSON.stringify({head,patchChecks,independentReplays:audits,protocol:'All payload entries are CRC/SHA verified after writing; source blobs are compared with git cat-file; forward/reverse checks use isolated temporary indexes.'},null,2));
const inventory=entries.map(e=>({path:e.name,bytes:e.data.length,sha256:sha(e.data)}));add('reports/content-inventory.json',JSON.stringify(inventory,null,2));
await mkdir('review-packages',{recursive:true});const path=resolve(`review-packages/${task}-review-${head.slice(0,7)}.zip`),zip=createZip(entries);await writeFile(path,zip);const reopened=readZip(await readFile(path));assert.equal(reopened.size,entries.length);
for(const e of inventory){const b=reopened.get(e.path);assert.equal(b.length,e.bytes);assert.equal(sha(b),e.sha256);}for(const[p,b]of blobs)assert.ok(reopened.get('project_snapshot/'+p).equals(b));
const result={path,bytes:zip.length,sha256:sha(zip),head,entries:entries.length,snapshotFiles:blobs.size,patchChecks,archiveReplays:audits};await writeFile(join(cache,'archive-verification.json'),JSON.stringify(result,null,2));await writeFile(path+'.sha256.txt',sha(zip)+'\n');console.log(JSON.stringify(result,null,2));
