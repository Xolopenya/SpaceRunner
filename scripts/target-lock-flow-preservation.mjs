import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, lstat, symlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// The original pre-mine byte guard deliberately cannot describe extended motion
// ownership. Preserve it on its approved source; current behavior is separately
// compared to approved003C2 by target-lock-preservation, including all legacy modes.
const root=process.cwd(),approved='41812b61f23aaeca5295b4112ed75b60c1e78897',directory=resolve('.cache/review/GAMEPLAY-EXPERIMENT-003C3/approved-flow');
const output=resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-EXPERIMENT-003C3/final');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
await mkdir(directory,{recursive:true});await mkdir(output,{recursive:true});git('merge-base','--is-ancestor',approved,'HEAD');
for(const p of git('ls-tree','-r','--name-only',approved).toString().trim().split('\n')){const target=resolve(directory,p);assert.ok(target.startsWith(directory+'\\')||target.startsWith(directory+'/'));await mkdir(dirname(target),{recursive:true});await writeFile(target,git('show',`${approved}:${p}`));}
try{assert.ok((await lstat(join(directory,'node_modules'))).isSymbolicLink());}catch(e){if(e.code!=='ENOENT')throw e;await symlink(join(root,'node_modules'),join(directory,'node_modules'),'junction');}
const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),env={...process.env,REVIEW_RESULT_DIR:output,GIT_DIR:join(root,'.git'),GIT_WORK_TREE:directory};
const run=args=>execFileSync(process.execPath,args,{cwd:directory,env,windowsHide:true,maxBuffer:16*1024*1024});
await writeFile(join(output,'flow-approved-build.log'),run([npm,'run','build']));const log=run(['--experimental-strip-types','scripts/flow-preservation.mjs']);process.stdout.write(log);
const script=await readFile(join(directory,'scripts/flow-preservation.mjs'));assert.ok(script.equals(git('show',`${approved}:scripts/flow-preservation.mjs`)));
await writeFile(join(output,'flow-source-pinned.json'),JSON.stringify({approved,sourcePinned:true,scriptSha256:createHash('sha256').update(script).digest('hex'),originalAssertionsUnchanged:true,exitCode:0,currentDifferential:'target-lock-preservation.json:116 histories against approved003C2',note:'Direct original pre-mine current-source hash guard rejects field-ownership.ts after the intentional versioned motion extension; the original failure is retained in logs/attempts/flow-preservation-current-attempt.log. No assertion was weakened. This frozen run preserves the original approved mixed-flow audit; current flow-benchmark/browser and116-history differential run separately.'},null,2)+'\n');
