import {spawnSync,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve('.cache/review/GAMEPLAY-003C4-FIX2/verify');await mkdir(output,{recursive:true});
const npm=join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),checks=[];
const commands=[...['typecheck','test','build','test:browser'].map(name=>({name,exe:process.execPath,args:[npm,'run',name]})),{name:'diff-check',exe:'git',args:['diff','--check']},...['review-static','build-analysis'].map(name=>({name,exe:process.execPath,args:[`scripts/${name}.mjs`]})),{name:'collision-audit',exe:process.execPath,args:['--experimental-strip-types','scripts/collision-audit.mjs']}];
for(const c of commands){const start=new Date().toISOString(),r=spawnSync(c.exe,c.args,{windowsHide:true,maxBuffer:32*1024*1024,env:{...process.env,REVIEW_RESULT_DIR:output}});await writeFile(join(output,c.name.replace(':','-')+'.log'),Buffer.concat([r.stdout??Buffer.alloc(0),r.stderr??Buffer.alloc(0)]));checks.push({...c,start,end:new Date().toISOString(),exitCode:r.status??1});await writeFile(join(output,'checks.json'),JSON.stringify(checks,null,2));console.log(c.name,r.status);if(r.status!==0)process.exit(1);}
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(p=>p&&/^(src|tests|scripts)\//.test(p)),hashes=[];
for(const path of files){const b=await readFile(path);hashes.push({path,sha256:createHash('sha256').update(b.toString().replaceAll('\r\n','\n')).digest('hex')});}await writeFile(join(output,'source-hashes.json'),JSON.stringify(hashes,null,2));
