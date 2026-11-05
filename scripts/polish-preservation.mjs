import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const baseline='80e987d7804b663d1c8bf2080fa116ef63b667de',git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024}).toString();
const allowed=['src/core/ship-collider.ts','src/collectibles/settings.ts','src/collectibles/run.ts','src/collectibles/placement.ts','src/release/model.ts','src/integrated/model.ts','src/visuals/warp-corridor.ts','src/world.ts','src/debug/visual-comparison.ts','src/debug/collider-debugger.ts'];
const all=git('ls-tree','-r','--name-only',baseline).trim().split('\n'),paths=all.filter(p=>(p.startsWith('src/')||p.startsWith('public/')||['package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json'].includes(p))&&!allowed.includes(p));
assert.equal(git('diff',baseline,'--',...paths).trim(),'','Unrelated approved runtime, controls, hazard volumes, budgets, assets or progression changed');
assert.ok(git('diff','--name-only',baseline,'--','src').trim().split('\n').every(p=>allowed.includes(p)));
const normalized=s=>s.replaceAll('\r\n','\n'),clean=s=>normalized(s).replace(/\/\*[^]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
for(const [path,before,after]of [
 ['src/release/model.ts','new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist)','new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist,FRAGMENT.wingPickupAssist)'],
 ['src/integrated/model.ts',"version: 'integrated-compound-homing-v1'","version: `integrated-compound-homing-v1/${SHIP_COLLIDER.version}`"],
 ['src/collectibles/settings.ts','pickupAssist: .26, magnetSeconds: .14','pickupAssist: .36, wingPickupAssist: .10, magnetSeconds: .14'],
])assert.equal(clean(await readFile(path,'utf8')),clean(git('show',`${baseline}:${path}`).replace(before,after)),path);
const records=await Promise.all(paths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
const dir=process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-005B2/final';await mkdir(dir,{recursive:true});await writeFile(`${dir}/gameplay-preservation.json`,JSON.stringify({baseline,protectedFiles:records.length,allowed,files:records,result:'zero diff for protected runtime/assets; exact limited replacements in model/config seams'},null,2));console.log('Preserved',records.length,'runtime/asset files; ten explicit correction files');
