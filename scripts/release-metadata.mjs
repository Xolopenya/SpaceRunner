import {execFileSync} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const head=execFileSync('git',['rev-parse','HEAD']).toString().trim(),files=[];
async function visit(path,prefix=''){for(const e of await readdir(path,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())await visit(join(path,e.name),name+'/');else if(name!=='release.json'){const b=await readFile(join(path,e.name));files.push({path:name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}}}
await visit('dist');
await writeFile('dist/release.json',JSON.stringify({task:'RELEASE-007',commit:process.env.GITHUB_SHA??head,tree:execFileSync('git',['rev-parse','HEAD^{tree}']).toString().trim(),generatedAt:new Date().toISOString(),files},null,2));
console.log('Release metadata:',process.env.GITHUB_SHA??head,files.length,'files');
