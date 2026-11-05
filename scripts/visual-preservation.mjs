import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const baseline='393c2c6ae48b5cc0f5ec164367d3bcd3f7b0b5ea';
const git=(...a)=>execFileSync('git',a,{maxBuffer:64*1024*1024}).toString();
const all=git('ls-tree','-r','--name-only',baseline).trim().split('\n');
const paths=all.filter(p=>p.startsWith('src/core/')||p.startsWith('src/audio/')||p.startsWith('src/release/')||p.startsWith('src/services/')
 ||p.startsWith('src/assets/')||p.startsWith('src/experiments/')&&!p.endsWith('/view.ts')||p.startsWith('src/collectibles/')&&!p.endsWith('/view.ts')
 ||['src/config.ts','src/game.ts','src/game-loop.ts','src/input.ts','src/ui.ts','src/styles.css','src/camera/flight-camera.ts','src/debug/runtime-field.ts','src/debug/runtime-game-model.ts'].includes(p));
assert.equal(git('diff',baseline,'--',...paths).trim(),'','Approved gameplay, clocks, fairness, assets and controls must remain unchanged');
const records=[];for(const p of paths)records.push({path:p,sha256:createHash('sha256').update(await readFile(p)).digest('hex')});
const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-005B/final';await mkdir(directory,{recursive:true});
await writeFile(`${directory}/gameplay-preservation.json`,JSON.stringify({baseline,protectedFiles:records.length,files:records,result:'all protected paths have zero Git diff'},null,2));
console.log('Preserved approved gameplay files:',records.length);
