import {spawn,execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {mkdir,writeFile,readFile,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const base='4ad10e88aa147d619eb9cee63379a5407e8bd93b',root=resolve('.cache/review/FEEDBACK-001C'),frozen=resolve(root,'baseline-source');
for(const file of ['tests/browser/audio.spec.ts','tests/browser/helpers.ts']) {
  const path=resolve(frozen,file);await mkdir(dirname(path),{recursive:true});
  await writeFile(path,execFileSync('git',['show',`${base}:${file}`]));
}
const rows=[];
for(const mode of ['baseline','final']) {
  const output=resolve(root,`passive-${mode}`);await mkdir(output,{recursive:true});
  const config={testDir:resolve(mode==='baseline'?frozen:process.cwd(),'tests/browser'),testMatch:'audio.spec.ts',timeout:75000,workers:1,
    use:{channel:'chrome',headless:true,viewport:{width:1280,height:800},trace:'retain-on-failure',screenshot:'only-on-failure'},
    outputDir:resolve(output,'artifacts'),reporter:[['list'],['json',{outputFile:resolve(output,'browser-results.json')}]]};
  const configPath=resolve(output,'passive.config.mjs');await writeFile(configPath,`export default ${JSON.stringify(config)};\n`);
  const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5196','--strictPort'],{cwd:mode==='baseline'?frozen:process.cwd(),windowsHide:true,stdio:'ignore'});
  try {
    let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5196/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
    const html=await(await fetch('http://127.0.0.1:5196/')).text(),script=html.match(/src="([^"]+\.js)"/)[1];
    const bundle=Buffer.from(await(await fetch(new URL(script,'http://127.0.0.1:5196/'))).arrayBuffer());
    const log=await open(resolve(output,'run.log'),'w');
    const child=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test','--config',configPath,'--grep','hotfix production'],{env:{...process.env,HOTFIX_PUBLIC_URL:'http://127.0.0.1:5196/'},stdio:['ignore',log.fd,log.fd],windowsHide:true});
    const exit=await new Promise(resolve=>child.once('exit',resolve));await log.close();
    rows.push({mode,exit,bundle:script,bundleSHA256:createHash('sha256').update(bundle).digest('hex'),testSHA256:createHash('sha256').update(await readFile(resolve(config.testDir,'audio.spec.ts'))).digest('hex'),stats:JSON.parse(await readFile(resolve(output,'browser-results.json'),'utf8')).stats});
    console.log(JSON.stringify(rows.at(-1)));
  }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));}
}
await writeFile(resolve(root,'passive-comparison.json'),JSON.stringify({base,method:'Exact frozen001B1 test/source versus current001C. Same original seed11/no-steering/public-UI-only route, native RAF, timeout and distance/HP/phase assertions. The final test additionally expects four rather than two looping buffers, reflecting the new synchronized stems; route assertions are unchanged. One run per version; not a universal safety proof.',rows},null,2));
