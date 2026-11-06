import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verify } from './review-verify.mjs';
const git=(...args)=>execFileSync('git',args).toString(),directory='.cache/review/VISUAL-006/final';
export const normalizedBytes=(path,data)=>path==='.gitignore'||/\.(?:ts|mjs|js|py|json|css|html|txt|md|svg)$/.test(path)?Buffer.from(data.toString('utf8').replaceAll('\r\n','\n')):data;
async function snapshot(){
 const paths=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(p=>/^(?:src|public|tests|scripts)\//.test(p)||['package.json','package-lock.json','vite.config.ts','tsconfig.json','playwright.config.ts','review.config.json','index.html','.gitignore'].includes(p)).sort();
 return Promise.all(paths.map(async path=>({path,sha256:createHash('sha256').update(normalizedBytes(path,await readFile(path))).digest('hex')})));
}
if(process.argv[1]?.endsWith('warp-verify.mjs')){
 const before=await snapshot(),executionHead=git('rev-parse','HEAD').trim(),config=JSON.parse(await readFile('review.config.json','utf8'));
 assert.equal(config.taskId,'VISUAL-006');await mkdir(directory,{recursive:true});
 await verify(config.taskId,config.extraChecks,{browserWorkers:2});assert.deepEqual(await snapshot(),before,'Verification inputs changed while checks ran');
 await writeFile(`${directory}/validation-inputs.json`,JSON.stringify({executionHead,files:before,note:'All runtime/assets/tests/scripts/build configurations frozen before and after full checks; normalized text line endings. Packaging compares these hashes to committed HEAD blobs. Final report-only edits can follow checks.'},null,2));
 console.log('Frozen verified runtime inputs:',before.length);
}
