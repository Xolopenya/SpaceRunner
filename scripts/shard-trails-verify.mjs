import { mkdir,open,readFile,writeFile } from 'node:fs/promises';
import { spawn,execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

// Audio tests write receipts before the JSON reporter finishes; create their
// destination first. Keep the full suite's normal assertions/timeouts unchanged.
const name=process.argv[2]??'full-browser';
const output=resolve('.cache/review/FEEDBACK-001C2',name);
await mkdir(output,{recursive:true});
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','src','tests','public','index.html','package.json','package-lock.json','vite.config.ts','playwright.config.ts','tsconfig.json']).toString().split('\0').filter(path=>path&&existsSync(path));
const snapshot=()=>Promise.all(paths.map(async path=>{
  let bytes=await readFile(path);if(/\.(ts|json|html|css|txt|svg|md|mjs|py)$/.test(path))bytes=Buffer.from(bytes.toString().replaceAll('\r\n','\n'));
  return{path,sha256:createHash('sha256').update(bytes).digest('hex')};
}));
const started=new Date().toISOString(),before=await snapshot();
const log=await open(resolve(output,'run.log'),'w');
const child=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test',...process.argv.slice(3)],
  {env:{...process.env,REVIEW_RESULT_DIR:output},stdio:['ignore',log.fd,log.fd],windowsHide:true});
const code=await new Promise(resolve=>child.once('exit',resolve));await log.close();
const after=await snapshot(),stable=JSON.stringify(before)===JSON.stringify(after);
await writeFile(resolve(output,'test-inputs.json'),JSON.stringify({started,finished:new Date().toISOString(),stable,files:before},null,2));
assert.ok(stable,'Runtime/test source changed during the browser suite');
console.log(name,'exit',code);process.exitCode=code??1;
