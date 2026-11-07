import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
export async function buildPages(){
 const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024}),head=git('rev-parse','HEAD').toString().trim(),approved='a5906ef0baaeb5cfce6b59c29df6d378e1e141ad';
 assert.equal(git('diff',approved,'--','src','public','index.html','package.json','package-lock.json','vite.config.ts').toString().trim(),'','Unexpected production input change');
 const root=resolve('.cache/review/RELEASE-007/production-project'),names=git('ls-tree','-r','--name-only',head,'src','public','index.html','package.json','vite.config.ts').toString().trim().split('\n');
 const bytes=execFileSync('git',['cat-file','--batch'],{input:names.map(p=>`${head}:${p}`).join('\n')+'\n',maxBuffer:128*1024*1024});let cursor=0;
 for(const path of names){const end=bytes.indexOf(10,cursor),size=Number(bytes.subarray(cursor,end).toString().split(' ')[2]);cursor=end+1;const dest=resolve(root,path);assert.ok(dest.startsWith(root));await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes.subarray(cursor,cursor+size));cursor+=size+1;}
 // Git blobs use LF just as the existing Linux Pages runner. Windows working
 // copies may contain CRLF inside shader template strings and HTML; their Vite
 // hashes differ even with zero Git diff. Build canonical bytes without editing
 // the user's source files or global Git configuration.
 const out=resolve('dist');assert.equal(dirname(out),resolve('.'),'Generated output must be the workspace dist child');
 execFileSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build',root,'--outDir',out,'--emptyOutDir'],{env:{...process.env,GITHUB_ACTIONS:'true'},stdio:'inherit'});
 execFileSync(process.execPath,['scripts/release-metadata.mjs'],{stdio:'inherit'});
 const dir=process.env.REVIEW_RESULT_DIR??'.cache/review/RELEASE-007/final';await mkdir(dir,{recursive:true});await writeFile(`${dir}/pages-build-inputs.json`,JSON.stringify({head,approved,inputs:names,canonicalGitBlobs:true,base:'/SpaceRunner/',note:'Same committed input bytes as Linux GitHub Actions; user working-copy line endings are untouched.'},null,2));
}
if(process.argv[1]?.endsWith('release-build.mjs'))await buildPages();
