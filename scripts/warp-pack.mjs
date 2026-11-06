import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createZip, readZip } from './zip.mjs';
import { containsSecret, excludedPath } from './review-safety.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { normalizedBytes } from './warp-verify.mjs';

const directory=resolve('.cache/review/VISUAL-006/final'),git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024});
const sha=b=>createHash('sha256').update(b).digest('hex'),config=JSON.parse(await readFile('review.config.json','utf8'));
const baseline=git('rev-parse',config.baseline).toString().trim(),head=git('rev-parse','HEAD').toString().trim(),branch=git('branch','--show-current').toString().trim();
assert.equal(config.taskId,'VISUAL-006');assert.equal(baseline,'218d6a1d477d9a61b08c0abd1828aa61c3b95562');assert.equal(branch,'feature/visual-006-fragmented-warp-field');git('merge-base','--is-ancestor',baseline,head);
const preserved=await reviewWorktree(config,process.cwd(),git),entries=[];
const add=(name,data)=>{const bytes=Buffer.from(data);assert.ok(!containsSecret(bytes),`Potential credential: ${name}`);entries.push({name,data:bytes});};
const validation=JSON.parse(await readFile(`${directory}/verification.json`,'utf8'));
assert.equal(validation.checks.length,9);assert.ok(validation.checks.every(c=>c.exitCode===0));
const tested=JSON.parse(await readFile(`${directory}/validation-inputs.json`,'utf8'));
assert.equal(tested.executionHead,validation.head);git('merge-base','--is-ancestor',validation.head,head);
const browser=JSON.parse(await readFile(`${directory}/browser-results.json`,'utf8'));assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.flaky,0);assert.equal(browser.stats.skipped,0);assert.equal(browser.stats.expected,105);
assert.match(await readFile(`${directory}/test.log`,'utf8'),/pass 301/);assert.match(await readFile(`${directory}/test.log`,'utf8'),/fail 0/);
const scenes=JSON.parse(await readFile(`${directory}/warp-scenarios.json`,'utf8')),videos=JSON.parse(await readFile(`${directory}/warp-videos.json`,'utf8')),perf=JSON.parse(await readFile(`${directory}/warp-performance.json`,'utf8'));
assert.equal(Object.keys(scenes.events).length,7);assert.equal(videos.receipts.length,6);assert.equal(perf.rows.length,12);
for(const rows of Object.values(Object.groupBy(scenes.receipts,r=>r.name))){assert.equal(rows.length,4);assert.equal(new Set(rows.map(r=>r.stateHash)).size,1);}
assert.equal(new Set(perf.rows.map(r=>r.stateHash)).size,1);assert.deepEqual(scenes.errors,[]);assert.deepEqual(videos.errors,[]);assert.deepEqual(perf.errors,[]);
const tree=git('ls-tree','-rz','--full-tree',head).toString().split('\0').filter(Boolean);
const paths=tree.map(r=>r.slice(r.indexOf('\t')+1)).filter(p=>!excludedPath(p));
const batch=execFileSync('git',['cat-file','--batch'],{input:paths.map(p=>`${head}:${p}`).join('\n')+'\n',maxBuffer:128*1024*1024});let cursor=0;
const blobs=new Map();
for(const path of paths){const end=batch.indexOf(10,cursor),m=batch.subarray(cursor,end).toString().match(/^[0-9a-f]+ blob (\d+)$/);assert.ok(m,path);cursor=end+1;const size=Number(m[1]),data=batch.subarray(cursor,cursor+size);blobs.set(path,data);add(`project_snapshot/${path}`,data);cursor+=size+1;}
for(const file of tested.files){const data=blobs.get(file.path);assert.ok(data,`Missing verified input ${file.path}`);assert.equal(sha(normalizedBytes(file.path,data)),file.sha256,`Tested input differs from HEAD: ${file.path}`);}
const patch=git('diff','--binary','--full-index',baseline,head),scratch=resolve(`.cache/review/VISUAL-006/patch-${head.slice(0,7)}`);await mkdir(scratch,{recursive:true});
const patchPath=join(scratch,'changes.patch');await writeFile(patchPath,patch);
const env={...process.env,GIT_INDEX_FILE:join(scratch,'scratch.index')},run=(...args)=>execFileSync('git',args,{env,maxBuffer:32*1024*1024}).toString().trim();
run('read-tree',baseline);run('apply','--cached','--check','--binary',patchPath);run('apply','--cached','--binary',patchPath);assert.equal(run('write-tree'),git('rev-parse',`${head}^{tree}`).toString().trim());
run('apply','--cached','--reverse','--check','--binary',patchPath);run('apply','--cached','--reverse','--binary',patchPath);assert.equal(run('write-tree'),git('rev-parse',`${baseline}^{tree}`).toString().trim());
add('changes/baseline-to-head.patch',patch);add('changes/baseline.txt',baseline+'\n');add('changes/head.txt',head+'\n');add('changes/branch.txt',branch+'\n');add('changes/remotes.txt',git('remote','-v'));add('changes/commits.txt',git('log','--format=fuller',`${baseline}..${head}`));add('changes/preserved-user-work.json',JSON.stringify(preserved,null,2));
add('reports/patch-verification.json',JSON.stringify({baseline,head,sha256:sha(patch),forward:'complete HEAD tree exact',reverse:'complete baseline tree exact',realIndexUntouched:true},null,2));
for(const [name,path]of Object.entries(config.reports))add(`reports/${name}`,git('show',`${head}:${path}`));
for(const name of await readdir(directory))if(/\.(json|log)$/.test(name))add(`logs/${name}`,await readFile(join(directory,name)));
for(const name of await readdir(join(directory,'media')))if(/\.(png|webm)$/.test(name))add(`${name.endsWith('.png')?'screenshots':'videos'}/${name}`,await readFile(join(directory,'media',name)));
const manifest={task:'VISUAL-006',baseline,head,branch,unit:301,browser:105,screenshots:entries.filter(e=>e.name.startsWith('screenshots/')).length,videos:6,matchedStateGroups:new Set(scenes.receipts.map(r=>r.name)).size,
  performanceCases:12,protectedRuntimeFiles:117,testedRuntimeInputs:tested.files.length,runtimeInputsMatchHead:true,checksExecutedAtGitHead:validation.head,
  source:'regular tracked HEAD blobs only; every tested runtime/test/script/config input matches HEAD',production:'not merged; not deployed',ownerDecisionRequired:true,generatedAt:new Date().toISOString()};
add('reports/manifest.json',JSON.stringify(manifest,null,2));
add('README-REVIEW.md',`# VISUAL-006\n\nBaseline ${baseline}\nHEAD ${head}\nBranch ${branch}\n\nStart with reports/OWNER_PLAYTEST_GUIDE.md. Four live policies, shared curved ribbons, actual station-solid/aperture exclusion and preserved gameplay. Exact source in project_snapshot; complete binary patch and identities in changes; raw checks/scenarios/timings in logs; native matched PNGs in screenshots; silent actual Chrome videos A/B/C,D legacy/new and E clean integrated in videos.\n\nAll new modes use one batch; no physical-phone, human preference or GPU timer claim. See reports/KNOWN_LIMITATIONS.md. No merge/deployment. Inventory hashes every other entry; ZIP CRC and complete forward/reverse Git trees were checked.\n`);
add('reports/content-inventory.json',JSON.stringify(entries.map(e=>({path:e.name,bytes:e.data.length,sha256:sha(e.data)})),null,2));
await mkdir('review-packages',{recursive:true});const output=resolve(`review-packages/VISUAL-006-review-${head.slice(0,7)}.zip`);await writeFile(output,createZip(entries));
const bytes=await readFile(output),reopened=readZip(bytes);assert.equal(reopened.size,entries.length);for(const e of entries)assert.ok(reopened.get(e.name)?.equals(e.data),e.name);
for(const item of JSON.parse(reopened.get('reports/content-inventory.json'))){assert.equal(reopened.get(item.path).length,item.bytes);assert.equal(sha(reopened.get(item.path)),item.sha256);}
assert.deepEqual(await reviewWorktree(config,process.cwd(),git),preserved);
const result={...manifest,archive:output,bytes:bytes.length,entries:reopened.size,sha256:sha(bytes),crc:'all entries passed',inventory:'all entries passed',forwardPatch:'HEAD tree exact',reversePatch:'baseline tree exact'};
await writeFile(`${output}.verification.json`,JSON.stringify(result,null,2));await writeFile(`${output}.sha256`,`${result.sha256}  ${output.split(/[\\/]/).at(-1)}\n`);console.log(JSON.stringify(result,null,2));
