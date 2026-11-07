import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verify} from './review-verify.mjs';
import {releaseBytes} from './release-inputs.mjs';
const dir='.cache/review/RELEASE-007/final';await mkdir(dir,{recursive:true});
async function snapshot(){const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(p=>/^(src|public|scripts|tests|\.github)\//.test(p)||['package.json','package-lock.json','vite.config.ts','tsconfig.json','playwright.config.ts','review.config.json','index.html','.gitignore'].includes(p)).sort();return Promise.all(names.map(async path=>({path,sha256:createHash('sha256').update(releaseBytes(path,await readFile(path))).digest('hex')})));}
const before=await snapshot(),config=JSON.parse(await readFile('review.config.json','utf8'));assert.equal(config.taskId,'RELEASE-007');
const {result}=await verify(config.taskId,config.extraChecks,{browserWorkers:2});assert.deepEqual(await snapshot(),before,'Verified runtime/tooling changed during checks');await writeFile(`${dir}/validation-inputs.json`,JSON.stringify({executionHead:result.head,files:before},null,2));console.log('Frozen release inputs:',before.length);
