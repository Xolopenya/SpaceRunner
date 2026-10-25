import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat, symlink, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { RuntimeGameModel } from '../src/debug/runtime-game-model.ts';
import { LargeStructureGameModel } from '../src/experiments/large-structure/model.ts';
import { pressureInputs } from '../tests/fixtures/pressure-simulation.ts';
const root = process.cwd(), baseline = '6ecae59074ce65a9a4fdf036583a7ba4c97485b4';
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B2/final'), snapshot = resolve('.cache/review/GAMEPLAY-EXPERIMENT-003B2/approved-003b');
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 }), sha = b => createHash('sha256').update(b).digest('hex');
await mkdir(output, { recursive: true }); await mkdir(snapshot, { recursive: true }); git('merge-base', '--is-ancestor', baseline, 'main');
const paths = git('ls-tree', '-r', '--name-only', baseline).toString().trim().split('\n');
const protectedSources = paths.filter(p => p.startsWith('public/') || p.startsWith('src/audio/') || p.startsWith('src/visuals/') || p.startsWith('src/assets/') || p.startsWith('src/experiments/large-structure/'));
protectedSources.push('src/config.ts','src/core/ship.ts','src/core/game-model.ts','src/core/obstacles.ts','src/core/hazard-collision.ts','src/core/hazard-profile.ts',
  'src/core/collision.ts','src/core/field-generator.ts','src/core/field-patterns.ts','src/core/field-pattern-source.ts','src/core/field-ownership.ts',
  'src/core/field-settings.ts','src/core/field-director-settings.ts','src/core/field-policy.ts','src/world.ts','src/game.ts','src/input.ts','src/styles.css','package.json','package-lock.json');
for (const path of protectedSources) {
  const b = await readFile(path), original = git('show',`${baseline}:${path}`);
  const normalize = bytes => Buffer.from(bytes.toString().replaceAll('\r\n','\n'));
  assert.equal(sha(path.startsWith('public/') ? b : normalize(b)), sha(path.startsWith('public/') ? original : normalize(original)), path);
}
for (const path of paths) { const target = resolve(snapshot,path); assert.ok(target.startsWith(snapshot+'\\')||target.startsWith(snapshot+'/'));
  await mkdir(dirname(target),{recursive:true}); await writeFile(target,path==='index.html'?await readFile(path):git('show',`${baseline}:${path}`)); }
try { assert.ok((await lstat(join(snapshot,'node_modules'))).isSymbolicLink()); } catch(e) { if(e.code!=='ENOENT')throw e; await symlink(join(root,'node_modules'),join(snapshot,'node_modules'),'junction'); }
const { RuntimeGameModel: ApprovedRuntime } = await import(pathToFileURL(join(snapshot,'src/debug/runtime-game-model.ts')).href);
const { LargeStructureGameModel: ApprovedStructure } = await import(pathToFileURL(join(snapshot,'src/experiments/large-structure/model.ts')).href);
function observation(m) { return { state:m.state,ship:{...m.ship},hull:m.hull,hits:m.hitSerial,distance:m.distance,elapsed:m.elapsed,score:m.score,
  geometry:m.field.ledger.knownHazards(m.distance),events:m.field.events,witness:m.field.certificate?.hash,committed:m.field.committed,omitted:m.field.omitted }; }
function witnessInput(m) { const w=m.field.certificate;let t=w?Math.round((m.elapsed-w.context.elapsed)*120):0;
  for(const r of w?.controls??[]){if(t<r.ticks)return r.input;t-=r.ticks;}return{x:0,y:0}; }
const comparisons=[];
function compare(a,b,seed,history,label) {a.ready();b.ready();a.start(seed);b.start(seed);const tape=pressureInputs(seed,history==='witness'?'neutral':history,3600);
  for(let i=0;i<3600&&a.state==='PLAYING';i++){const x=history==='witness'?witnessInput(a):tape[i];a.step(1/120,x);b.step(1/120,x);
    if(i%120===0)assert.deepEqual(observation(b),observation(a));}
  assert.deepEqual(observation(b),observation(a));comparisons.push({label,seed,history,hash:sha(JSON.stringify(observation(a)))});a.dispose();b.dispose();}
for(const policy of ['baseline','pressure'])for(const seed of [0,11,42])for(const history of ['neutral','top-right','horizontal','irregular']) compare(new ApprovedRuntime(policy),new RuntimeGameModel(policy),seed,history,policy);
for(const aperture of ['center','left','right','upper','lower'])for(const history of ['neutral','witness']) compare(new ApprovedStructure(aperture),new LargeStructureGameModel(aperture),42,history,`legacy-v1/${aperture}`);
const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
await writeFile(join(output,'variants-approved-build.log'),execFileSync(process.execPath,[npm,'run','build'],{cwd:snapshot,windowsHide:true,maxBuffer:16*1024*1024}));
async function inventory(dir,prefix=''){const rows=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())rows.push(...await inventory(join(dir,entry.name),prefix+entry.name+'/'));
  else{const b=await readFile(join(dir,entry.name));rows.push({path:prefix+entry.name,bytes:b.length,sha256:sha(b)});}}return rows.sort((a,b)=>a.path.localeCompare(b.path));}
const approved=await inventory(join(snapshot,'dist')),current=await inventory('dist');assert.deepEqual(current,approved,'Production byte identity');
const result={baseline,protectedSources,comparisons,productionByteIdentical:true,build:current,bytes:current.reduce((n,f)=>n+f.bytes,0),
  note:'Tracked baseline blobs in ignored snapshot; dependency junction stays within repository. All old v1 module bytes, production assets, gameplay/camera/audio/VFX/default generator are protected. Legacy URL namespace changes only routing; old model and goldens remain.'};
await writeFile(join(output,'variants-preservation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({comparisons:comparisons.length,protectedSources:protectedSources.length,productionByteIdentical:true,bytes:result.bytes},null,2));
