import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {HOMING,HOMING_PRESETS} from '../src/experiments/adaptive-homing/settings.ts';
import {ReleaseModel} from '../src/release/model.ts';
const root=resolve('.cache/review/GAMEPLAY-003C4-FIX2'),base=join(root,'baseline'),baseline='c51da9d2859c43765f83a29ca12c06aa54cf7284';
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline]).toString().trim().split('\n'),allowed=new Set(['src/core/field-runtime-session.ts','src/experiments/adaptive-homing/transaction.ts','src/experiments/adaptive-homing/source.ts','src/experiments/adaptive-homing/settings.ts']);let protectedFiles=0;
for(const p of files.filter(p=>/^(src|public|tests|\.github)\//.test(p)&&!allowed.has(p))){const a=await readFile(p),b=await readFile(join(base,p)),norm=x=>/\.(ts|css|html|txt|json|yml)$/.test(p)?x.toString().replaceAll('\r\n','\n'):x;assert.deepEqual(norm(a),norm(b),p);protectedFiles++;}
const settings=await import(pathToFileURL(join(base,'src/experiments/adaptive-homing/settings.ts')).href);assert.deepEqual(HOMING,settings.HOMING);assert.deepEqual(HOMING_PRESETS,settings.HOMING_PRESETS);
await writeFile(join(root,'baseline-build.log'),execFileSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build'],{cwd:base,windowsHide:true,maxBuffer:16*1024*1024}));
const sha=b=>createHash('sha256').update(b).digest('hex');async function inventory(dir,prefix=''){const rows=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())rows.push(...await inventory(join(dir,e.name),prefix+e.name+'/'));else{const b=await readFile(join(dir,e.name));rows.push({path:prefix+e.name,bytes:b.length,sha256:sha(b)});}}return rows.sort((a,b)=>a.path.localeCompare(b.path));}
const before=await inventory(join(base,'dist')),after=await inventory('dist'),identical=JSON.stringify(before)===JSON.stringify(after),models=[];
if(!identical){const{ReleaseModel:Old}=await import(pathToFileURL(join(base,'src/release/model.ts')).href);const observe=m=>({ship:{...m.ship},distance:m.distance,hull:m.hull,state:m.state,elapsed:m.elapsed,speed:m.speed,phase:m.phase,events:m.field.events,certificate:m.field.certificate?.hash,geometry:m.field.ledger.knownHazards(m.distance)});
 for(const seed of [0,11,42])for(const history of ['witness','neutral','horizontal']){const a=new Old(),b=new ReleaseModel();a.ready();b.ready();a.start(seed);b.start(seed);let tick=0;for(;tick<15000&&a.state==='PLAYING';tick++){let input={x:0,y:0};if(history==='horizontal')input.x=Math.floor(tick/180)%2?-1:1;else if(history==='witness'){let at=a.field.certificate?Math.round((a.elapsed-a.field.certificate.context.elapsed)*120):0;for(const r of a.field.certificate?.controls??[]){if(at<r.ticks){input=r.input;break;}at-=r.ticks;}}a.step(1/120,input);b.step(1/120,input);if(tick%120===0)assert.deepEqual(observe(a),observe(b));}assert.deepEqual(observe(a),observe(b));models.push({seed,history,ticks:tick,distance:b.distance,hull:b.hull,phase:b.phase});a.dispose();b.dispose();}}
const result={baseline,protectedFiles,controllerAndPresetsUnchanged:true,byteIdentical:identical,before,after,models};await writeFile(join(root,'preservation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({protectedFiles,byteIdentical:identical,models:models.length,bytes:after.reduce((n,r)=>n+r.bytes,0)}));
