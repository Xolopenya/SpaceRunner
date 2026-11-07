import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const approved='a5906ef0baaeb5cfce6b59c29df6d378e1e141ad',git=(...a)=>execFileSync('git',a,{maxBuffer:64*1024*1024}).toString();
const paths=git('ls-tree','-r','--name-only',approved,'src','public','index.html','package.json','package-lock.json','vite.config.ts').trim().split('\n');
assert.equal(git('diff',approved,'--',...paths).trim(),'','Release must preserve approved runtime/assets/tuning');
const files=await Promise.all(paths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
const dir=process.env.REVIEW_RESULT_DIR??'.cache/review/RELEASE-007/final';await mkdir(dir,{recursive:true});await writeFile(`${dir}/release-preservation.json`,JSON.stringify({approved,protectedFiles:files.length,files,result:'Zero Git diff for ALL approved src/public/dependencies/Vite config; no gameplay/render/collider/camera/mine/reveal retuning'},null,2));console.log('Approved runtime preserved:',files.length,'files');
