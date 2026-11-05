import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createZip, readZip } from './zip.mjs';
import { containsSecret, excludedPath } from './review-safety.mjs';
import { reviewWorktree } from './review-worktree.mjs';

const root=process.cwd(),directory=resolve('.cache/review/GAMEPLAY-005B2/final');
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024});
const sha=data=>createHash('sha256').update(data).digest('hex');
const config=JSON.parse(await readFile('review.config.json','utf8'));
assert.equal(config.taskId,'GAMEPLAY-005B2');
const baseline=git('rev-parse',config.baseline).toString().trim(),head=git('rev-parse','HEAD').toString().trim();
assert.equal(baseline,'80e987d7804b663d1c8bf2080fa116ef63b667de');git('merge-base','--is-ancestor',baseline,head);
assert.equal(git('branch','--show-current').toString().trim(),'feature/gameplay-005b2-visual-collision-polish');
const preserved=await reviewWorktree(config,root,git),entries=[];
const add=(name,data)=>{const bytes=Buffer.from(data);assert.ok(!containsSecret(bytes),`Potential credential in ${name}`);entries.push({name,data:bytes});};
const inputs=JSON.parse(await readFile(`${directory}/validation-inputs.json`,'utf8'));
const tree=git('ls-tree','-rz','--full-tree',head).toString().split('\0').filter(Boolean);
const names=tree.map(r=>r.slice(r.indexOf('\t')+1));
const specs=[...new Set([...inputs.files.map(i=>`${head}:${i.path}`),...names.map(p=>`${head}:${p}`)])];
assert.ok(specs.every(s=>!s.includes('\n')));
const batch=execFileSync('git',['cat-file','--batch'],{input:specs.join('\n')+'\n',maxBuffer:128*1024*1024}),blobs=new Map();let cursor=0;
for(const spec of specs){const lineEnd=batch.indexOf(10,cursor),header=batch.subarray(cursor,lineEnd).toString(),m=header.match(/^[0-9a-f]+ blob (\d+)$/);assert.ok(m,`Missing Git blob: ${spec}`);const size=Number(m[1]);cursor=lineEnd+1;blobs.set(spec,batch.subarray(cursor,cursor+size));cursor+=size+1;}
const blob=spec=>{const b=blobs.get(spec);assert.ok(b,`Unknown snapshot blob ${spec}`);return b;};
for(const item of inputs.files) {
 const bytes=blob(`${head}:${item.path}`);
 const normalized=/\.(?:glb|ttf|png|webm)$/.test(item.path)?bytes:Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
 assert.equal(sha(normalized),item.sha256,`Tested source changed: ${item.path}`);
}
const browser=JSON.parse(await readFile(`${directory}/browser-results.json`,'utf8'));
assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.flaky,0);assert.equal(browser.stats.skipped,0);assert.ok(browser.stats.expected>=103);
assert.match(await readFile(`${directory}/test.log`,'utf8'),/pass 293/);
assert.match(await readFile(`${directory}/test.log`,'utf8'),/fail 0/);

for(const record of tree){const tab=record.indexOf('\t'),path=record.slice(tab+1);if(excludedPath(path))continue;
 assert.match(record.slice(0,tab),/^100(?:644|755) blob /);add(`project_snapshot/${path}`,blob(`${head}:${path}`));}
const patch=git('diff','--binary','--full-index',baseline,head);
add('changes/baseline-to-head.patch',patch);add('changes/head.txt',head+'\n');add('changes/baseline.txt',baseline+'\n');
add('changes/branch.txt',git('branch','--show-current'));add('changes/remotes.txt',git('remote','-v'));
add('changes/commits.txt',git('log','--format=fuller',`${baseline}..${head}`));
add('changes/preserved-user-work.json',JSON.stringify(preserved,null,2));
// Apply in both directions to an isolated index, then compare full Git trees.
const scratch=resolve(`.cache/review/GAMEPLAY-005B2/patch-${head.slice(0,7)}`);await mkdir(scratch,{recursive:true});
const patchPath=join(scratch,'changes.patch');await writeFile(patchPath,patch);
const env={...process.env,GIT_INDEX_FILE:join(scratch,'scratch.index')};
const run=(...args)=>execFileSync('git',args,{env,maxBuffer:32*1024*1024}).toString().trim();
run('read-tree',baseline);run('apply','--cached','--check','--binary',patchPath);run('apply','--cached','--binary',patchPath);
assert.equal(run('write-tree'),git('rev-parse',`${head}^{tree}`).toString().trim());
run('apply','--cached','--reverse','--check','--binary',patchPath);run('apply','--cached','--reverse','--binary',patchPath);
assert.equal(run('write-tree'),git('rev-parse',`${baseline}^{tree}`).toString().trim());
add('reports/patch-verification.json',JSON.stringify({baseline,head,patchSha256:sha(patch),forward:'applied; complete tree equals HEAD',reverse:'applied; complete tree equals baseline',realIndexUntouched:true},null,2));
for(const [name,path] of Object.entries(config.reports))add(`reports/${name}`,blob(`${head}:${path}`));
for(const name of await readdir(directory))if(/\.(log|json)$/.test(name)&&name!=='browser-extra-captures.json')add(`logs/${name}`,await readFile(join(directory,name)));
for(const stage of ['baseline','final']) {
 const folder=resolve(`.cache/review/GAMEPLAY-005B2/${stage}`);
 for(const name of await readdir(join(folder,'media')))if(/\.(png|webm)$/.test(name))add(`${name.endsWith('.png')?'screenshots':'videos'}/${name}`,await readFile(join(folder,'media',name)));
 if(stage==='baseline')for(const name of await readdir(folder))if(/\.(log|json)$/.test(name))add(`logs/baseline/${name}`,await readFile(join(folder,name)));
}

const analysis=JSON.parse(await readFile(`${directory}/polish-audit.json`,'utf8'));
const matched=JSON.parse(await readFile(`${directory}/matched-publication.json`,'utf8'));
assert.equal(analysis.replays,729);assert.equal(matched.replays,168);
assert.equal(analysis.rows.filter(r=>r.source==='final'&&r.policy==='witness'&&r.hull===3&&r.distance>=2500).length,8);
const captures=JSON.parse(await readFile(`${directory}/browser-captures.json`,'utf8'));
assert.equal(captures.receipts.filter(r=>r.source==='final'&&r.name==='pickup-phase2')[0].end.count,1);
const details=JSON.parse(await readFile(`${directory}/detail-captures.json`,'utf8'));
assert.ok(details.some(r=>r.name==='fixture-station-wall-block'&&r.result.occluded>0&&r.result.state!=='collected'));
assert.ok(details.some(r=>r.source==='final'&&r.mode==='settled'&&r.state.parts[1].offsetY===-.30));
const manifest={task:'GAMEPLAY-005B2',baseline,head,branch:'feature/gameplay-005b2-visual-collision-polish',
 tests:{unit:293,browser:browser.stats.expected},independentReplays:analysis.replays+matched.replays,
 testedRuntimeInputs:inputs.files.length,corpus:analysis.summary,
 captureCount:entries.filter(e=>e.name.startsWith('screenshots/')).length,videoCount:entries.filter(e=>e.name.startsWith('videos/')).length,
 camera:'Hybrid Chase',production:'not merged; not deployed',ownerPlaytestRequired:true,generatedAt:new Date().toISOString()};
add('reports/manifest.json',JSON.stringify(manifest,null,2));
add('README-REVIEW.md',`# GAMEPLAY-005B2

Baseline ${baseline}
HEAD ${head}

Start with reports/OWNER_PLAYTEST_GUIDE.md. Three focused corrections: local station/warp exclusion; pickup .36 plus .10 wing compensation; shared wing profile ±1.08/−.30/.70/r.18. Exact source is in project_snapshot/, full binary patch and Git metadata in changes/, test/audit/performance receipts and actual input histories in logs/, native Chrome evidence in screenshots/ and videos/. Videos are silent. The wall-block reward is an explicitly labelled invalid-placement fixture; genuine wing and pickup clips use accepted natural hazards/rewards. The referenced owner screenshot was absent; described-situation reconstruction is labelled.

Reproduce with Node22.12+ and installed Chrome: npm ci --ignore-scripts, npm run typecheck, npm run test, npm run build, npm run test:browser. See the six reports for baseline extraction, capture scripts and recording prerequisites. Logs include the initial interrupted browser attempt; browser-results.json and browser.log are the completed final run. Content inventory hashes every other entry. No merge or deployment is authorized.
`);
add('reports/content-inventory.json',JSON.stringify(entries.map(e=>({path:e.name,bytes:e.data.length,sha256:sha(e.data)})),null,2));
await mkdir('review-packages',{recursive:true});const output=resolve(`review-packages/GAMEPLAY-005B2-review-${head.slice(0,7)}.zip`);
await writeFile(output,createZip(entries));const bytes=await readFile(output),reopened=readZip(bytes);
assert.equal(reopened.size,entries.length);for(const e of entries)assert.ok(reopened.get(e.name)?.equals(e.data),e.name);
const inventory=JSON.parse(reopened.get('reports/content-inventory.json'));
for(const item of inventory){assert.equal(reopened.get(item.path).length,item.bytes);assert.equal(sha(reopened.get(item.path)),item.sha256);}
assert.equal(reopened.size,inventory.length+1);assert.deepEqual(await reviewWorktree(config,root,git),preserved);
const result={...manifest,archive:output,bytes:bytes.length,entries:reopened.size,sha256:sha(bytes),crc:'all entries passed',inventory:'all entries passed',forwardPatch:'HEAD tree exact',reversePatch:'baseline tree exact'};
await writeFile(`${output}.verification.json`,JSON.stringify(result,null,2));await writeFile(`${output}.sha256`,`${result.sha256}  ${output.split(/[\\/]/).at(-1)}\n`);
console.log(JSON.stringify(result,null,2));
