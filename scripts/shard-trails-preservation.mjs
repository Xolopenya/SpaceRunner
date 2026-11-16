import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {createHash} from 'node:crypto';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const base='10cc436c3afb005705dd8a1649799903363dfdf1',dir='.cache/review/FEEDBACK-001C2';
const allowed=new Set(['src/world.ts','src/collectibles/settings.ts','src/collectibles/run.ts','src/collectibles/placement.ts']);
const removed=new Set(['src/collectibles/guidance.ts','src/collectibles/guidance-settings.ts','src/collectibles/guide-ribbon.ts']);
const isText=p=>['.ts','.mjs','.json','.html','.css','.py','.md','.txt','.svg'].includes(extname(p));
const normal=(p,b)=>isText(p)?Buffer.from(b.toString().replaceAll('\r\n','\n')):b;
const sha=b=>createHash('sha256').update(b).digest('hex');
const paths=git('ls-tree','-r','--name-only',base,'src','public','index.html','package.json','package-lock.json','vite.config.ts').toString().trim().split('\n');
const blobs=execFileSync('git',['cat-file','--batch'],{input:paths.map(p=>`${base}:${p}\n`).join(''),maxBuffer:64*1024*1024});
let cursor=0;const files=[],changed=[],deleted=[];
for(const path of paths){const end=blobs.indexOf(10,cursor),size=Number(blobs.subarray(cursor,end).toString().split(' ')[2]);cursor=end+1;const before=normal(path,blobs.subarray(cursor,cursor+size));cursor+=size+1;
 if(!existsSync(path)){assert.ok(removed.has(path));deleted.push(path);files.push({path,deleted:true});continue;}
 const after=normal(path,await readFile(path)),same=before.equals(after);if(!same){assert.ok(allowed.has(path),`Protected file changed: ${path}`);changed.push(path);}files.push({path,same,sha256:sha(after)});
}
assert.equal(cursor,blobs.length);assert.equal(paths.length,160);assert.deepEqual(new Set(changed),allowed);assert.deepEqual(new Set(deleted),removed);
await writeFile(`${dir}/preservation.json`,JSON.stringify({base,checked:160,unchanged:153,changed,deleted,files,scope:'All audio/assets/engine/music, camera/movement/ship damage profile, authoritative hazards/RNG/director/fairness/mines, UI/scoring and approved VFX are unchanged. Four existing presentation/collectible files changed, three rejected render modules removed, one focused trail module added.'},null,2));
const inputs=git('ls-files','--cached','--others','--exclude-standard','-z','--','src','tests','scripts','public','index.html','package.json','package-lock.json','vite.config.ts','playwright.config.ts','tsconfig.json').toString().split('\0').filter(p=>p&&existsSync(p));
await writeFile(`${dir}/validated-inputs.json`,JSON.stringify(await Promise.all(inputs.map(async path=>({path,sha256:sha(normal(path,await readFile(path)))}))),null,2));
const tested=JSON.parse(await readFile(`${dir}/full-browser/test-inputs.json`,'utf8'));assert.ok(tested.stable);for(const f of tested.files)assert.equal(sha(normal(f.path,await readFile(f.path))),f.sha256,f.path);
const a=JSON.parse(await readFile(`${dir}/baseline-balance.json`,'utf8')),b=JSON.parse(await readFile(`${dir}/final-balance.json`,'utf8'));
const balance=[];
for(let i=0;i<a.rows.length;i++){const x=a.rows[i],y=b.rows[i];assert.equal(x.seed,y.seed);assert.equal(x.policy,y.policy);if(x.policy==='certificate'){assert.deepEqual(x.inputs,y.inputs);assert.equal(x.hazardsHash,y.hazardsHash);assert.equal(x.hull,y.hull);assert.equal(x.distance,y.distance);balance.push({seed:x.seed,matched:true});}}
const baseImages=JSON.parse(await readFile(`${dir}/baseline/visuals/captures.json`,'utf8')),finalImages=JSON.parse(await readFile(`${dir}/final/visuals/captures.json`,'utf8'));assert.equal(baseImages.receipts.length,finalImages.receipts.length);
for(const x of baseImages.receipts){const y=finalImages.receipts.find(r=>r.file===x.file);assert.ok(y);for(const key of ['tick','ship','hull','distance','phase','camera','seed','viewport'])assert.deepEqual(x[key],y[key],`${x.file}:${key}`);assert.equal(y.guidance,false);}
const performance=JSON.parse(await readFile(`${dir}/performance.json`,'utf8'));assert.equal(performance.rows.length,20);for(let i=0;i<10;i++)assert.equal(performance.rows[i].stateHash,performance.rows[i+10].stateHash);
await writeFile(`${dir}/comparison.json`,JSON.stringify({matchedBalanceInputs:balance,matchedProtectedScreenshotStates:baseImages.receipts.length,matchedPerformanceStates:10,method:'Collectibles intentionally differ. At common input/cadence, ship/hull/phase/distance, hazards/publications/mines and camera mode are protected. All final screenshots have no guidance object.'},null,2));
git('diff','--check');console.log(JSON.stringify({checked:160,unchanged:153,changed,deleted,nativeTestedInputs:tested.files.length,validatedInputs:inputs.length,matchedScreenshots:baseImages.receipts.length}));
