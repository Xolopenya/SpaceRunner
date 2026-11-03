import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createZip,readZip} from './zip.mjs';
import {excludedPath,containsSecret} from './review-safety.mjs';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {ADAPTIVE_GEOMETRY} from '../src/experiments/adaptive-homing/transaction.ts';
import {TARGET_GEOMETRY} from '../src/experiments/moving-mine/target-lock-source.ts';
const baseline='bbfb48ccf390b8feceb82ada4f01e86b912b4779',task='GAMEPLAY-003C4-FIX',branch='feature/gameplay-003c4-homing-stabilization',root=process.cwd(),cache=resolve('.cache/review/'+task);
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024}),sha=b=>createHash('sha256').update(b).digest('hex');
const head=git('rev-parse','HEAD').toString().trim();assert.equal(git('branch','--show-current').toString().trim(),branch);git('diff','--exit-code');git('diff','--cached','--exit-code');
const checks=JSON.parse(await readFile(join(cache,'verification-final/checks.json')));assert.equal(checks.length,8);assert.ok(checks.every(c=>c.exitCode===0));
const files=git('ls-tree','-rz','--name-only',head).toString().split('\0').filter(p=>p&&!excludedPath(p));
// One batch avoids one process per source blob, preserving binary contents.
const batch=execFileSync('git',['cat-file','--batch'],{input:files.map(p=>`${head}:${p}\n`).join(''),maxBuffer:128*1024*1024});let offset=0;const blobs=new Map();
for(const path of files){const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString(),size=Number(header.split(' ').at(-1));assert.ok(Number.isFinite(size),header);offset=end+1;blobs.set(path,batch.subarray(offset,offset+size));offset+=size+1;}
for(const r of JSON.parse(await readFile(join(cache,'verification-final/source-hashes.json')))){assert.equal(sha(blobs.get(r.path).toString().replaceAll('\r\n','\n')),r.sha256,r.path+' changed after verification');}
const entries=[];function add(name,data){assert.ok(!excludedPath(name),name);data=Buffer.from(data);assert.equal(containsSecret(data),false,name);entries.push({name,data});}
for(const[path,data]of blobs)add('project_snapshot/'+path,data);
const patch=git('diff','--binary','--full-index',baseline,head),patchPath=join(cache,'changes.patch');await writeFile(patchPath,patch);
const patchChecks=[];
for(const[version,reverse]of [[baseline,false],[head,true]]){
 const env={...process.env,GIT_INDEX_FILE:join(cache,reverse?'reverse.index':'forward.index')};
 execFileSync('git',['read-tree',version],{env});execFileSync('git',['apply','--cached','--check',...(reverse?['--reverse']:[]),patchPath],{env});patchChecks.push({root:version,reverse,passed:true});
}
add('changes/changes.patch',patch);add('changes/git.json',JSON.stringify({task,baseline,head,branch,history:git('log','--format=%H %s',`${baseline}..${head}`).toString(),patchChecks},null,2));
async function include(dir,prefix){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await include(path,prefix+e.name+'/');else if(/\.(json|log|png|webm|md|txt)$/.test(e.name))add(prefix+e.name,await readFile(path));}}
for(const dir of ['before','after','corpus','browser','profile-final','media','matched','verification-interrupted','verification-final'])await include(join(cache,dir),'evidence/'+dir+'/');
for(const e of await readdir(cache,{withFileTypes:true}))if(e.isFile()&&/\.(log|json)$/.test(e.name))add('evidence/'+e.name,await readFile(join(cache,e.name)));
const media=JSON.parse(await readFile(join(cache,'media/manifest.json'))),profile=JSON.parse(await readFile(join(cache,'profile-final/comparison.json'))),matched=JSON.parse(await readFile(join(cache,'matched/summary.json')));
assert.equal(media.evidence.length,4);assert.equal(profile.results.length,8);assert.equal(matched.results.length,2);
const manifest={taskId:task,status:'Partial',branch,finalCommit:head,baselineCommit:baseline,checks,patchChecks,productionRollout:false,
 evidence:'Frozen baseline inventory; before/after original full corpus; focused framed/production differential; per-render CPU+RAF+long task/memory; strict identical-work scheduling control; real decoded VP8 bait+late media; failed exploratory and passing final verification logs.',
 verification:'Commands executed before commit. Normalized source hashes bind verified implementation/tests/scripts to committed blobs. Reports are documentation of those results. Not an independent architecture review.',
 inventory:'SHA-256 covers every other ZIP entry; inventory cannot contain its own hash.'};add('reports/manifest.json',JSON.stringify(manifest,null,2));
const inventory=entries.map(e=>({path:e.name,bytes:e.data.length,sha256:sha(e.data)}));add('reports/content-inventory.json',JSON.stringify(inventory,null,2));
await mkdir('review-packages',{recursive:true});const path=resolve(`review-packages/${task}-review-${head.slice(0,7)}.zip`),zip=createZip(entries);await writeFile(path,zip);
const reopened=readZip(await readFile(path));assert.equal(reopened.size,entries.length);for(const e of inventory){const data=reopened.get(e.path);assert.equal(data.length,e.bytes);assert.equal(sha(data),e.sha256);}
for(const[p,b]of blobs)assert.ok(reopened.get('project_snapshot/'+p).equals(b));
const w=JSON.parse(reopened.get('evidence/after/adaptive-homing-witnesses.json'));let audits=0;
for(const witness of w.witnesses){const geometry=witness.geometryVersion===ADAPTIVE_GEOMETRY.version?ADAPTIVE_GEOMETRY:TARGET_GEOMETRY,j=beginTrajectoryReplay(witness.context,witness.controls,{geometry});while(!j.getResult())j.advance();const r=j.getResult();assert.equal(r.decision,'accept');assert.equal(r.witness.hash,witness.hash);audits++;}
assert.equal(audits,1962);
const verification={path,bytes:zip.length,sha256:sha(zip),entries:entries.length,inventoryEntries:inventory.length,snapshotFiles:blobs.size,patchChecks,archiveReplays:audits};
await writeFile(path+'.sha256.txt',sha(zip)+'  '+path.split(/[\\/]/).at(-1)+'\n');await writeFile(join(cache,'archive-verification.json'),JSON.stringify(verification,null,2));console.log(JSON.stringify(verification,null,2));
