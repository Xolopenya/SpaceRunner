// Execute original source-pinned research at its approved B-4 snapshot.
// No assertion, algorithm, corpus or work-budget adaptation is made here.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,symlink,lstat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),baseline='d523cc4286d825594affbf9151cdae395b3ae721';
const task=resolve(root,'.cache/review/GAMEPLAY-001B-5A'),snapshot=join(task,'approved-b4'),evidence=join(task,'baseline'),history=join(task,'history');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
await mkdir(snapshot,{recursive:true});await mkdir(evidence,{recursive:true});await mkdir(history,{recursive:true});
const paths=git('ls-tree','-r','--name-only',baseline).toString().trim().split('\n'),inventory=[];
const crlf=(await readFile(join(root,'index.html'),'utf8')).includes('\r\n');
for(const path of paths){
 const target=resolve(snapshot,path);assert.ok(target.startsWith(snapshot+'\\')||target.startsWith(snapshot+'/'));
 await mkdir(dirname(target),{recursive:true});const original=git('show',`${baseline}:${path}`);
 const bytes=path==='index.html'&&crlf?Buffer.from(original.toString().replaceAll('\r\n','\n').replaceAll('\n','\r\n')):original;
 await writeFile(target,bytes);inventory.push({path,approvedSha256:sha(original),executedSha256:sha(bytes),checkoutNewlines:path==='index.html'&&crlf});
}
const link=join(snapshot,'node_modules');
try{const info=await lstat(link);assert.ok(info.isSymbolicLink(),'Expected only the managed dependency junction');}catch(error){if(error.code!=='ENOENT')throw error;await symlink(join(root,'node_modules'),link,'junction');}
const npm=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const env={...process.env,REVIEW_RESULT_DIR:history,GIT_DIR:git('rev-parse','--absolute-git-dir').toString().trim(),GIT_WORK_TREE:snapshot};
const commands=[['build',[npm,'run','build']],['pattern',['--experimental-strip-types','scripts/pattern-benchmark.mjs']],['director',['--experimental-strip-types','scripts/director-benchmark.mjs']]];
const results=[];
for(const [name,args]of commands){
 console.log(`Reproducing approved B-4 ${name}; original source assertions enabled.`);
 const start=performance.now();
 try{const stdout=execFileSync(process.execPath,args,{cwd:snapshot,env,windowsHide:true,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
  await writeFile(join(evidence,`approved-b4-${name}.log`),stdout);results.push({name,args,exitCode:0,ms:performance.now()-start});
 }catch(error){await writeFile(join(evidence,`approved-b4-${name}.log`),Buffer.concat([error.stdout??Buffer.alloc(0),error.stderr??Buffer.alloc(0)]));throw error;}
}
for(const name of await readdir(history))if(/\.(json|log)$/.test(name))await writeFile(join(evidence,`approved-b4-${name}`),await readFile(join(history,name)));
for(const taskId of ['GAMEPLAY-001B-3','GAMEPLAY-001B-4']){
 const inner=join(snapshot,'.cache/review',taskId,'baseline');
 for(const name of await readdir(inner))if(/\.(json|log)$/.test(name))await writeFile(join(evidence,`approved-${taskId}-${name}`),await readFile(join(inner,name)));
}
const result={baseline,snapshot,commands:results,inventory,adaptation:'Dependency junction inside ignored snapshot; inherited read-only Git metadata; index.html matches checkout newline convention. Original B-4/B-3/B-2/B-1 source/guards/goldens/corpora/work limits are unchanged. Earlier path-only nested bootstrap adaptations are retained by original pattern-baselines.mjs.',
 productionScope:'Historical output comparisons occur wholly inside the approved snapshot. Current production default is checked separately; no false current byte-identity claim.'};
await writeFile(join(evidence,'historical-reproduction.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({baseline,commands:results},null,2));
