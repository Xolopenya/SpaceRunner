import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const baseline='218d6a1d477d9a61b08c0abd1828aa61c3b95562';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024}).toString();
const allowed=['src/visuals/fragmented-warp.ts','src/visuals/arena-boundaries.ts','src/visuals/warp-corridor.ts','src/world.ts','src/debug/visual-comparison.ts'];
const paths=git('ls-tree','-r','--name-only',baseline).trim().split('\n').filter(p=>(p.startsWith('src/')||p.startsWith('public/')||['package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json'].includes(p))&&!allowed.includes(p));
assert.equal(git('diff',baseline,'--',...paths).trim(),'','Protected gameplay/rendering/assets changed');
assert.ok(git('diff','--name-only',baseline,'--','src').trim().split('\n').every(p=>allowed.includes(p)));
const normalize=s=>s.replaceAll('\r\n','\n');
assert.equal(normalize(await readFile('src/world.ts','utf8')),normalize(git('show',`${baseline}:src/world.ts`)
 .replace("this.boundaries.setMode('warp')","this.boundaries.setMode('fragmented-warp')")
 .replace('this.quality.reducedMotion);\r\n    this.boundaries.warp.updateOcclusion','this.quality.reducedMotion, model.field.hazards);\r\n    this.boundaries.warp.updateOcclusion')
 .replace('this.quality.reducedMotion);\n    this.boundaries.warp.updateOcclusion','this.quality.reducedMotion, model.field.hazards);\n    this.boundaries.warp.updateOcclusion')));
assert.equal(normalize(await readFile('src/visuals/warp-corridor.ts','utf8')),normalize(git('show',`${baseline}:src/visuals/warp-corridor.ts`).replace("export type BoundaryMode = 'legacy' | 'warp';","export type BoundaryMode = 'legacy' | 'warp' | import('./fragmented-warp.ts').FieldMode;")));
const files=await Promise.all(paths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/VISUAL-006/final';await mkdir(directory,{recursive:true});
await writeFile(`${directory}/gameplay-preservation.json`,JSON.stringify({baseline,protectedFiles:paths.length,files,allowed,result:'Protected runtime/assets have zero Git diff. World has exactly two presentation call changes; old corridor is byte-identical except its type union.'},null,2));
console.log('Preserved',paths.length,'approved runtime/asset files; exact World/camera/reveal/legacy seams checked.');
