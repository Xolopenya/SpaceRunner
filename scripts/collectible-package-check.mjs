import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readZip } from './zip.mjs';

const baseline='bbfb48ccf390b8feceb82ada4f01e86b912b4779';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const head=git('rev-parse','HEAD').toString().trim();
const directory=resolve('.cache/review/GAMEPLAY-004/patch-check');await mkdir(directory,{recursive:true});
const zip=process.argv[2]?resolve(process.argv[2]):undefined;
let patch=git('diff','--binary','--full-index',baseline,head),inventoryCount=0,archiveSha256;
if(zip){
 const bytes=await readFile(zip),entries=readZip(bytes);archiveSha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(entries.get('changes/head.txt').toString().trim(),head);
 assert.deepEqual(entries.get('changes/baseline-to-head.patch'),patch);
 const inventory=JSON.parse(entries.get('reports/content-inventory.json'));
 for(const item of inventory){const bytes=entries.get(item.path);assert.ok(bytes,item.path);assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);}
 assert.equal(entries.size,inventory.length+1);inventoryCount=inventory.length;
}
const patchPath=resolve(directory,'changes.patch');await writeFile(patchPath,patch);
const env={...process.env,GIT_INDEX_FILE:resolve(directory,'scratch.index')};
const run=(...args)=>execFileSync('git',args,{env,maxBuffer:16*1024*1024});
run('read-tree',baseline);run('apply','--cached','--check','--binary',patchPath);
run('read-tree',head);run('apply','--cached','--reverse','--check','--binary',patchPath);
const result={baseline,head,patchSha256:createHash('sha256').update(patch).digest('hex'),forward:'pass against baseline tree in isolated index',reverse:'pass against HEAD tree in isolated index',zip,archiveSha256,inventoryCount,zipCrcAndContent:zip?'pass':'not requested',note:'Real working tree/index and preserved user files are not modified.'};
const output=zip?zip+'.verification.json':resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-004/final','patch-applicability.json');
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
