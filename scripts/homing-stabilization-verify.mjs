import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve('.cache/review/GAMEPLAY-003C4-FIX/verification-final');await mkdir(output,{recursive:true});
const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const commands=[...['typecheck','test','build','test:browser'].map(name=>({name,args:[npm,'run',name],exe:process.execPath})),
 {name:'diff-check',exe:'git',args:['diff','--check']},
 ...['review-static','build-analysis'].map(name=>({name,exe:process.execPath,args:[`scripts/${name}.mjs`]})),
 {name:'collision-audit',exe:process.execPath,args:['--experimental-strip-types','scripts/collision-audit.mjs']}];
const checks=[];
for(const c of commands){const start=new Date().toISOString();let bytes,exitCode=0;try{bytes=execFileSync(c.exe,c.args,{windowsHide:true,maxBuffer:32*1024*1024,env:{...process.env,REVIEW_RESULT_DIR:output},stdio:['ignore','pipe','pipe']});}catch(e){bytes=Buffer.concat([e.stdout??Buffer.alloc(0),e.stderr??Buffer.alloc(0)]);exitCode=e.status??1;}
 await writeFile(join(output,c.name.replace(':','-')+'.log'),bytes);checks.push({command:[c.exe,...c.args].join(' '),name:c.name,start,end:new Date().toISOString(),exitCode});await writeFile(join(output,'checks.json'),JSON.stringify(checks,null,2));console.log(c.name,exitCode);if(exitCode)process.exit(exitCode);
}
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(p=>p&&(p.startsWith('src/')||p.startsWith('tests/')||p.startsWith('scripts/')||['package.json','package-lock.json','vite.config.ts','playwright.config.ts'].includes(p)));
const sourceHashes=[];for(const path of files){const bytes=await readFile(path);sourceHashes.push({path,sha256:createHash('sha256').update(bytes.toString().replaceAll('\r\n','\n')).digest('hex')});}
await writeFile(join(output,'source-hashes.json'),JSON.stringify(sourceHashes,null,2));
