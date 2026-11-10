import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='.cache/review/VISUAL-007A',baseline='d5b02d8';
const hash=b=>createHash('sha256').update(b).digest('hex');
const changedViews=['src/integrated/view.ts','src/experiments/structure-variants/view.ts'];
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src','public','package.json','package-lock.json','vite.config.ts','index.html']).toString().trim().split('\n');
const protectedFiles=[];
for(const path of files){if(changedViews.includes(path))continue;
 const before=execFileSync('git',['show',`${baseline}:${path}`]);const after=await readFile(path);
 const normalize=b=>/\.(ts|css|html|json)$/.test(path)?b.toString().replaceAll('\r\n','\n'):b;
 assert.deepEqual(normalize(before),normalize(after),`Protected input changed: ${path}`);protectedFiles.push({path,sha256:hash(before)});
}
const clean=state=>{const {resources,programs,...simulation}=state;return simulation;};
const before=JSON.parse(await readFile(`${dir}/before/captures.json`)),after=JSON.parse(await readFile(`${dir}/after/captures.json`));
const pairs=[];for(const a of after.receipts){const b=before.receipts.find(b=>b.name===a.name);assert.ok(b,`Missing before ${a.name}`);assert.equal(a.tick,b.tick);assert.deepEqual(clean(a.state),clean(b.state),`State mismatch ${a.name}`);pairs.push({name:a.name,tick:a.tick,stateSha256:hash(JSON.stringify(clean(a.state)))});}
const perfBefore=JSON.parse(await readFile(`${dir}/before-performance.json`)),perfAfter=JSON.parse(await readFile(`${dir}/after-performance.json`));
for(let i=0;i<perfBefore.rows.length;i++)assert.deepEqual(clean(perfBefore.rows[i].state),clean(perfAfter.rows[i].state));
const result={baseline:execFileSync('git',['rev-parse',baseline]).toString().trim(),protectedFiles,changedViews,pairs,performanceStatesMatched:perfBefore.rows.length};
await writeFile(`${dir}/preservation.json`,JSON.stringify(result,null,2));console.log(`${protectedFiles.length} protected inputs unchanged; ${pairs.length} paired gameplay states and ${perfBefore.rows.length} performance endpoint states exactly match.`);
