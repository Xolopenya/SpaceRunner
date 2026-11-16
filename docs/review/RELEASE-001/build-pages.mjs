import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
const git=(...a)=>execFileSync('git',a,{maxBuffer:128*1024*1024});
const approved='b34b5a6a3f8b04ab8f4254abaf432c5e2bfb9127',head=git('rev-parse','HEAD').toString().trim();
assert.equal(git('diff',approved,'--','src','public','index.html','package.json','package-lock.json','vite.config.ts').toString().trim(),'','Approved playable inputs must remain exact');
const root=resolve('.cache/review/RELEASE-001/pages-source');
const names=git('ls-tree','-r','--name-only',head,'src','public','index.html','package.json','vite.config.ts').toString().trim().split('\n');
const batch=execFileSync('git',['cat-file','--batch'],{input:names.map(p=>`${head}:${p}`).join('\n')+'\n',maxBuffer:128*1024*1024});let at=0;
for(const path of names){const end=batch.indexOf(10,at),size=Number(batch.subarray(at,end).toString().split(' ')[2]);at=end+1;const target=resolve(root,path);assert.ok(target.startsWith(root+'/')||target.startsWith(root+'\\'));await mkdir(dirname(target),{recursive:true});await writeFile(target,batch.subarray(at,at+size));at+=size+1;}
execFileSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build',root,'--outDir',resolve('dist'),'--emptyOutDir'],{env:{...process.env,GITHUB_ACTIONS:'true'},stdio:'inherit'});
execFileSync(process.execPath,['scripts/release-metadata.mjs'],{stdio:'inherit'});
await writeFile('.cache/review/RELEASE-001/pages-build.json',JSON.stringify({head,approved,canonicalGitBlobs:true,base:'/SpaceRunner/',inputs:names},null,2));
