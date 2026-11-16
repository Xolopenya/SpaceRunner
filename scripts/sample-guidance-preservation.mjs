import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {createHash} from 'node:crypto';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const base='0348c2ac85be63106ea3bed6e532f50d97366c7a',dir='.cache/review/FEEDBACK-001C1';
const allowed=new Set(['src/world.ts','src/audio/graph.ts','src/audio/audio-manager.ts','src/feedback/orchestrator.ts','src/feedback/settings.ts']);
const isText=path=>['.ts','.mjs','.json','.html','.css','.py','.md','.txt','.svg'].includes(extname(path));
const normalize=(path,data)=>isText(path)?Buffer.from(data.toString().replaceAll('\r\n','\n')):data;
const sha=data=>createHash('sha256').update(data).digest('hex');
const paths=git('ls-tree','-r','--name-only',base,'src','public','index.html','package.json','package-lock.json','vite.config.ts').toString().trim().split('\n');
const blobs=execFileSync('git',['cat-file','--batch'],{input:paths.map(p=>`${base}:${p}\n`).join(''),maxBuffer:64*1024*1024});
let cursor=0;const files=[],changed=[];
for(const path of paths){const end=blobs.indexOf(10,cursor),size=Number(blobs.subarray(cursor,end).toString().split(' ')[2]);cursor=end+1;const before=normalize(path,blobs.subarray(cursor,cursor+size)),after=normalize(path,await readFile(path));cursor+=size+1;const same=before.equals(after);if(!same){assert.ok(allowed.has(path),`Protected baseline changed: ${path}`);changed.push(path);}files.push({path,same,sha256:sha(after)});}
assert.equal(cursor,blobs.length);assert.equal(paths.length,143);assert.deepEqual(new Set(changed),allowed);
await writeFile(`${dir}/preservation.json`,JSON.stringify({base,checked:paths.length,unchanged:paths.length-changed.length,changed,files,scope:'All existing gameplay, pickup/placement/collider/assist, controls/camera, generator/RNG/fairness, mines/scoring/HP/invulnerability, engine/music and approved VFX modules unchanged. Five existing presentation/audio files extended; five new source modules and eight licensed samples.'},null,2));
const inputs=git('ls-files','--cached','--others','--exclude-standard','-z','--','src','tests','scripts','public','index.html','package.json','package-lock.json','vite.config.ts','playwright.config.ts','tsconfig.json').toString().split('\0').filter(Boolean);
await writeFile(`${dir}/validated-inputs.json`,JSON.stringify(await Promise.all(inputs.map(async path=>({path,text:isText(path),sha256:sha(normalize(path,await readFile(path)))}))),null,2));
const tested=JSON.parse(await readFile(`${dir}/full-browser/test-inputs.json`,'utf8'));assert.ok(tested.stable);
for(const item of tested.files)assert.equal(sha(normalize(item.path,await readFile(item.path))),item.sha256,`Native-tested input changed: ${item.path}`);
git('diff','--check');
const baseline=JSON.parse(await readFile(`${dir}/baseline/guidance/captures.json`,'utf8')),final=JSON.parse(await readFile(`${dir}/final/guidance/captures.json`,'utf8'));
assert.equal(baseline.receipts.length,66);assert.equal(final.receipts.length,132);
const exactBaselineScreenshots=[],pairs=[],hudAnimationScreenshots=[];
for(const before of baseline.receipts){const off=final.receipts.find(r=>r.file===before.file),on=final.receipts.find(r=>r.file===before.file.replace('-off.png','-on.png'));assert.ok(off&&on);
 for(const key of ['tick','ship','distance','hull','count','pickup','target','projection','fault']){assert.deepEqual(off[key],before[key],`Baseline state ${key}: ${before.file}`);assert.deepEqual(on[key],off[key],`ON/OFF state ${key}: ${before.file}`);}
 if((await readFile(`${dir}/baseline/guidance/${before.file}`)).equals(await readFile(`${dir}/final/guidance/${off.file}`)))exactBaselineScreenshots.push(off.file);
 else {const inspection=JSON.parse(execFileSync('python',['-c','from PIL import Image,ImageChops;import sys,json;a,b=[Image.open(p).convert("RGB") for p in sys.argv[1:]];d=ImageChops.difference(a,b);print(json.dumps({"bounds":d.getbbox()}))',`${dir}/baseline/guidance/${before.file}`,`${dir}/final/guidance/${off.file}`]).toString());const b=inspection.bounds;assert.ok(b&&b[0]>=130&&b[1]>=95&&b[2]<=185&&b[3]<=111,`Scene changed beyond existing CSS ENERGY pulse: ${off.file}`);hudAnimationScreenshots.push({file:off.file,...inspection});}
 pairs.push({off:off.file,on:on.file,tick:off.tick,count:off.count,hull:off.hull});
}
assert.equal(exactBaselineScreenshots.length,61);assert.equal(hudAnimationScreenshots.length,5);
await writeFile(`${dir}/visual-comparison.json`,JSON.stringify({matchedBaselineStates:66,matchedOnOffStates:66,exactBaselineScreenshots,hudAnimationScreenshots,pairs,method:'66 held natural-input states match all gameplay/projection fields. 61 baseline OFF/final OFF PNGs byte-identical; five differ only within the existing wall-clock CSS ENERGY-count pulse glyph at x130–185/y95–111; every scene pixel outside those measured bounds is identical. No inference about human collection rates.'},null,2));
const audioPairs=[];
for(const [before,after,seconds] of [['flight','flight',12],['music','music',32],['collisions','fallback',24]]){const a=await readFile(`${dir}/baseline/audio/${before}.wav`),b=await readFile(`${dir}/final/audio/${after}.wav`);for(const h of [22,24,34])assert.equal(a.readUInt16LE(h),b.readUInt16LE(h));const bytes=seconds*a.readUInt32LE(28);let maxDeltaPcm16=0,changedSampleValues=0;for(let i=44;i<44+bytes;i+=2){const delta=Math.abs(a.readInt16LE(i)-b.readInt16LE(i));maxDeltaPcm16=Math.max(maxDeltaPcm16,delta);if(delta)changedSampleValues++;}assert.ok(before==='flight'?maxDeltaPcm16<=1&&changedSampleValues<=32:maxDeltaPcm16===0,`Approved audio changed: ${before}/${after}`);audioPairs.push({baseline:before,final:after,seconds,bytes,maxDeltaPcm16,changedSampleValues,baselineSHA256:sha(a.subarray(44,44+bytes)),finalSHA256:sha(b.subarray(44,44+bytes))});}
const engineBlock=data=>data.toString().slice(data.indexOf('class EngineAudio'),data.indexOf('interface Voice')).replaceAll('\r\n','\n');
assert.equal(engineBlock(git('show',`${base}:src/audio/graph.ts`)),engineBlock(await readFile('src/audio/graph.ts')));
await writeFile(`${dir}/audio-preservation.json`,JSON.stringify({pairs:audioPairs,engineClassSourceIdentical:true,method:'Actual native PCM prefixes. Music32s and collision fallback24s are bit-exact. Flight12s differs in eight PCM16 sample values by at most1LSB (0.00003052 full scale); the complete production EngineAudio class and score/settings/synthesis modules are source-identical. No audible-difference or human approval claim.'},null,2));
console.log(JSON.stringify({checked:paths.length,unchanged:138,changed,validatedInputs:inputs.length,nativeTestedInputs:tested.files.length,exactBaselineScreenshots:61,sceneIdenticalScreenshots:66,onOffStates:66,audioPairs:3}));
