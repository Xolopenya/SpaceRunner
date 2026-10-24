import assert from 'node:assert/strict';
import {execFileSync,spawn}from'node:child_process';
import{readFile,writeFile,mkdir,readdir}from'node:fs/promises';
import{resolve,join}from'node:path';
import{fileURLToPath}from'node:url';
import{createHash}from'node:crypto';
import{chromium}from'@playwright/test';
import{simulateSchedule}from'../tests/fixtures/director-simulation.ts';
import{APPROVED_SEEDS}from'../tests/fixtures/trajectory-corpus.ts';
import{DifficultyDirector}from'../src/core/field-director.ts';
import{OwnershipLedger}from'../src/core/field-ownership.ts';
import{PlanningSession}from'../src/core/field-scheduler.ts';
import{FlightPrediction}from'../src/core/field-prediction.ts';
import{witnessHash}from'../src/core/field-validator.ts';
import{proposalField,fieldDistribution,passiveReplay,PASSIVE_POLICIES,axialPresence,stats}from'./director-fields.mjs';
import{directorPlots}from'./director-plots.mjs';
const BASELINE='60ca6fcd64885e7fb8d10fda3a4410b3da39dbf9',root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-001B-4/final');
const sha=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--memory-child')){
 const section=new DifficultyDirector(42).next(new DifficultyDirector(42).initial()).section;
 const initial=()=>({player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:0,distance:0});
 function make(){const ledger=new OwnershipLedger();return{ledger,session:new PlanningSession(section,initial(),[],ledger),state:{x:0,y:0,vx:0,vy:0,elapsed:0,distance:0},tick:0};}
 function advance(v,end){const p=new FlightPrediction();while(v.tick<end){p.step(v.state,{x:0,y:0});v.session.advance({player:v.state,input:{x:0,y:0},elapsed:v.state.elapsed,distance:v.state.distance},[],++v.tick);}}
 for(let i=0;i<5;i++)advance(make(),144);global.gc();const baseline=process.memoryUsage();
 const active=Array.from({length:5},make);for(const a of active)advance(a,12);global.gc();const activeUsage=process.memoryUsage();
 for(const a of active){advance(a,144);a.ledger.retire(section.endDistance+20);}active.length=0;
 const snapshots=[];for(let batch=0;batch<4;batch++){for(let i=0;i<10;i++){const v=make();advance(v,144);v.ledger.reset();}global.gc();snapshots.push({completed:(batch+1)*10,...process.memoryUsage()});}
 const retained=snapshots.at(-1).heapUsed+snapshots.at(-1).arrayBuffers-baseline.heapUsed-baseline.arrayBuffers;
 assert.ok(retained<8*1024*1024);
 console.log(JSON.stringify({baseline,activeUsage,snapshots,retainedGrowthBytes:retained,
 activeSessionBytesEstimate:(activeUsage.heapUsed+activeUsage.arrayBuffers-baseline.heapUsed-baseline.arrayBuffers)/5,
 method:'Fresh --expose-gc child;5 warmups,5 independent-world sessions active after12 ticks,40 serial completed/reset sessions with GC every10. One pending job per world. Heap+ArrayBuffers excludes double-counted external. Finite noisy estimate, not exact512KiB or indefinite-leak proof.'}));process.exit(0);
}
await mkdir(output,{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const protectedInputs=[];
for(const path of git('ls-tree','-r','--name-only',BASELINE,'--','src','public','tests','design','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','playwright.config.ts').toString().trim().split('\n')){
 const before=git('show',`${BASELINE}:${path}`),after=await readFile(path);
 assert.ok(before.includes(0)?before.equals(after):before.toString().replaceAll('\r\n','\n')===after.toString().replaceAll('\r\n','\n'),'Approved source changed:'+path);
 protectedInputs.push({path,sha256:sha(before)});
}
for(const path of ['field-director.ts','field-director-settings.ts','field-ownership.ts','field-scheduler.ts','field-section.ts']){
 const source=await readFile('src/core/'+path,'utf8');assert.ok(!/Math\.random|Date\.now|from ['"]three|GameModel|new Worker/.test(source),'Isolation breach:'+path);
}
const structural=[];for(let seed=0;seed<256;seed++){const f=proposalField(seed,{end:0,minimumCells:1024,retain:false});assert.equal(f.remainingRecords,0);assert.ok(f.peakContext<=32&&f.peakRecords<=16);structural.push(f);}
console.log('Completed256-seed structural director corpus, >=1024 owned cells each.');
const dayDistance=20*120+7*120+34*(86400-120); // integral of the unchanged speed ramp; director-only spatial workload
const dayRuns=[0,1,42,0xffffffff].map(seed=>proposalField(seed,{end:dayDistance,retain:false}));
console.log('Completed four24-hour-equivalent director/ownership schedules (no trajectory claim).');
const fields=APPROVED_SEEDS.map(seed=>proposalField(seed));const distribution=fieldDistribution(fields);
const passive=[],presence=[];
for(const field of fields){presence.push(axialPresence(field));for(const policy of PASSIVE_POLICIES)passive.push(passiveReplay(field,policy));}
console.log(`Completed ${passive.length} fixed-field passive policy runs over up to19200 units each.`);
const sections=Number(process.env.DIRECTOR_REFERENCE_SECTIONS??12),passiveSections=Number(process.env.DIRECTOR_POLICY_SECTIONS??6);
assert.ok(Number.isInteger(sections)&&sections>=4&&sections<=128&&Number.isInteger(passiveSections)&&passiveSections>=1&&passiveSections<=128);
const bands=[{name:'early',firstCell:6,elapsed:0},{name:'middle',firstCell:256,elapsed:(256*24-128+840)/34},{name:'late',firstCell:1024,elapsed:(1024*24-128+840)/34}];
const runs=[],chunks=[],preparations=[],rows=[];
function run(options,labels){let index=-1;const cpu=[];
 const value=simulateSchedule({...options,onPreparation:ms=>{index++;cpu[index]=ms;preparations.push({labels,section:index,ms});},
  onChunk:c=>{cpu[index]+=c.ms;assert.ok(c.propagations<=3072&&c.queries<=6144);chunks.push({...c,labels,section:index});}});
 assert.equal(value.remainingRecords,0,'Ownership did not retire');assert.ok(value.peakRecords<=16&&value.peakHazards<=32);
 if((options.policy??'witness')==='witness')assert.equal(value.contacts,0,'Reference controller collided with a certified field');
 for(let i=0;i<value.sections.length;i++){const o=value.sections[i];assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.attempts.length<=2);
  const last=o.attempts.at(-1),candidateCount=o.status==='committed'?o.transaction.hazards.length:0;
  rows.push({labels,index:i,section:o.section,status:o.status,reason:o.reason,attempts:o.attempts.length,candidateCount,
   cpuMs:cpu[i],workEndTick:o.jobs.at(-1)?.metrics.planningTicks??0,metrics:o.metrics,
   planningLead:o.attempts[0]?.transaction?.hazards[0]?.passDistance-(o.attempts[0]?.context?.distance??0),
   publicationWarning:o.status==='committed'?o.transaction.hazards[0]?.passDistance-o.witness.context.distance:null,
   fallbackKind:last?.kind!=='primary'?last?.kind:null});}
 runs.push({labels,...value});return value;
}
for(const band of bands){for(const seed of APPROVED_SEEDS){
 run({seed,...band,sections},{regime:'reference',band:band.name,policy:'witness',seed});
 for(const policy of ['neutral','boundary','periodic'])run({seed,...band,sections:passiveSections,policy},{regime:'state-aware-policy',band:band.name,policy,seed});
}console.log(`Completed ${band.name} joint scheduling band across16 seeds and4 policies.`);}
for(let seed=256;seed<272;seed++)run({seed,...bands[2],sections:6},{regime:'additional-stress',band:'late',policy:'witness',seed});
const repeated=run({seed:42,...bands[0],sections},{regime:'determinism-replay',band:'early',policy:'witness',seed:42});
assert.equal(repeated.hash,runs.find(r=>r.labels.regime==='reference'&&r.seed===42&&r.labels.band==='early').hash);
for(const seed of APPROVED_SEEDS){const probe=run({seed,sections:1,policy:'periodic',forecast:'held'},{regime:'forecast-miss',band:'early',policy:'periodic',seed});assert.ok(probe.sections.every(o=>o.status!=='committed'),'Unmatched forecast published');}
for(const band of bands)for(const seed of [0,42])run({seed,...band,sections:4,budget:{propagations:2048,narrowQueries:4096}},
 {regime:'budget-comparison',band:band.name,policy:'witness',seed});
console.log(`Completed ${rows.length} scheduled decisions, including rejections and forecast-miss probes.`);
const acceptedFieldPolicies=PASSIVE_POLICIES.filter(p=>['neutral','fixed-x-vertical-motion','fixed-y-horizontal-motion','corner-1-1','constant-diagonal','periodic'].includes(p.name));
const acceptedFieldPassive=[];
for(const r of runs.filter(r=>r.labels.regime==='reference'))for(const p of acceptedFieldPolicies){
 acceptedFieldPassive.push({...passiveReplay({seed:r.seed,hazards:r.hazards},p,r.terminal.distance,{elapsed:r.initial.elapsed,distance:r.initial.distance}),band:r.labels.band});
}
await writeFile(join(output,'director-node-checkpoint.tmp'),JSON.stringify({structural,dayRuns,distribution,passive,presence,runs,rows,chunks,preparations},null,2)+'\n');
const memory=JSON.parse(execFileSync(process.execPath,['--expose-gc','--experimental-strip-types',fileURLToPath(import.meta.url),'--memory-child'],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5190','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
let browser,browserResult,plotFiles;
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5190/tests/browser/trajectory-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});const page=await browser.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.goto('http://127.0.0.1:5190/tests/browser/trajectory-harness.html');
 const inputs=bands.flatMap(band=>[0,42].flatMap(seed=>[undefined,{propagations:2048,narrowQueries:4096}].map(budget=>({seed,...band,sections:4,budget}))));
 browserResult=await page.evaluate(async inputs=>{const {simulateSchedule}=await import('/tests/fixtures/director-simulation.ts');const runs=[],chunks=[],prep=[];
  for(const options of inputs){const start=performance.now();const r=simulateSchedule({...options,onChunk:c=>chunks.push(c),onPreparation:ms=>prep.push(ms)});runs.push({seed:options.seed,band:options.name,budget:options.budget?.propagations??3072,hash:r.hash,contacts:r.contacts,remainingRecords:r.remainingRecords,ms:performance.now()-start});}return{runs,chunks,prep};},inputs);
 for(const b of browserResult.runs){const r=runs.find(r=>r.labels.regime===(b.budget===3072?'reference':'budget-comparison')&&r.seed===b.seed&&r.labels.band===b.band);
  const identity=r.sections.slice(0,4).map(o=>({section:o.section,status:o.status,reason:o.reason,candidates:o.attempts.map(a=>a.transaction),witness:o.witness?.hash}));
  assert.equal(b.hash,witnessHash(identity),JSON.stringify({seed:b.seed,band:b.band,budget:b.budget}));assert.equal(b.contacts,0);assert.equal(b.remainingRecords,0);}
 assert.deepEqual(errors,[]);assert.ok(!requests.some(u=>/\/src\/(main|game|world)\./.test(u)||u.endsWith('.glb')));
 const workPhases=['validation','replay','publication'];
 browserResult={...browserResult,browser:await browser.version(),errors,requests,
  chunkMs:stats(browserResult.chunks.filter(c=>workPhases.includes(c.phase)).map(c=>c.ms)),
  commitMs:stats(browserResult.chunks.filter(c=>c.tick===144).map(c=>c.ms)),preparationMs:stats(browserResult.prep)};
 const count=arr=>{const outcomes={},reasons={};let attempts=0,fallbacks=0,hazards=0,units=0;for(const r of arr){outcomes[r.status]=(outcomes[r.status]??0)+1;if(r.reason)reasons[r.reason]=(reasons[r.reason]??0)+1;attempts+=r.attempts;hazards+=r.candidateCount;units+=r.section.cellCount*24;if(r.attempts>1||r.status.startsWith('omitted'))fallbacks++;}return{scheduled:arr.length,attempts,outcomes,reasons,fallbacks,hazards,scheduledUnits:units,objectsPer100:hazards*100/units};};
 const groups=[...new Set(rows.map(r=>r.labels.regime+'/'+r.labels.band+'/'+r.labels.policy))].map(key=>({key,...count(rows.filter(r=>r.labels.regime+'/'+r.labels.band+'/'+r.labels.policy===key))}));
 const byPolicy=PASSIVE_POLICIES.map(policy=>{const list=passive.filter(r=>r.policy===policy.name);return{policy:policy.name,runs:list.length,survived:list.filter(r=>r.survived).length,distance:stats(list.map(r=>r.distance)),xTravel:stats(list.map(r=>r.xTravel)),yTravel:stats(list.map(r=>r.yTravel))};});
 const metrics={baseline:BASELINE,generatedAt:new Date().toISOString(),protectedInputs,seeds:APPROVED_SEEDS,bands,settings:{referenceSections:sections,policySections:passiveSections},
  structural:{seeds:256,cells:structural.reduce((n,s)=>n+s.allocatedCells,0),sections:structural.reduce((n,s)=>n+s.sectionCount,0),rejections:structural.reduce((n,s)=>n+s.rejections,0),fallbacks:structural.reduce((n,s)=>n+s.fallbacks,0),maxRecords:Math.max(...structural.map(s=>s.peakRecords))},
  directorOnlyDay:{secondsPerRun:86400,distancePerRun:dayDistance,rows:dayRuns},proposalDistribution:distribution,passive:{total:passive.length,byPolicy},
  acceptedFieldPassive:{total:acceptedFieldPassive.length,byPolicy:acceptedFieldPolicies.map(p=>{const a=acceptedFieldPassive.filter(r=>r.policy===p.name);return{policy:p.name,runs:a.length,survived:a.filter(r=>r.survived).length,distance:stats(a.map(r=>r.distance))};})},
  presence:{centerSlab10EmptyFraction:stats(presence.map(p=>p.centerSlab10EmptyFraction)),outerOpportunityEmptyFraction:stats(presence.map(p=>p.outerOpportunityEmptyFraction))},
  scheduling:count(rows),groups,reference:{runs:runs.filter(r=>r.policy==='witness').length,contacts:runs.filter(r=>r.policy==='witness').reduce((n,r)=>n+r.contacts,0),
   distance:runs.filter(r=>r.policy==='witness').reduce((n,r)=>n+r.distance,0),seconds:runs.filter(r=>r.policy==='witness').reduce((n,r)=>n+r.seconds,0),
   motion:runs.filter(r=>r.labels.regime==='reference').map(r=>({seed:r.seed,band:r.labels.band,distance:r.distance,...r.motion,visibility:r.visibility}))},
  timing:{node:process.version,preparationMs:stats(preparations.map(p=>p.ms)),sessionCpuMs:stats(rows.map(r=>r.cpuMs)),
   chunkMs:stats(chunks.filter(c=>workPhases.includes(c.phase)).map(c=>c.ms)),
   defaultChunkMs:stats(chunks.filter(c=>workPhases.includes(c.phase)&&c.labels.regime!=='budget-comparison').map(c=>c.ms)),
   lowerBudgetChunkMs:stats(chunks.filter(c=>workPhases.includes(c.phase)&&c.labels.regime==='budget-comparison').map(c=>c.ms)),
   coordinatorAdvanceMs:stats(chunks.map(c=>c.ms)),commitMs:stats(chunks.filter(c=>c.tick===144).map(c=>c.ms)),
   waitingMs:stats(chunks.filter(c=>['ready','failed'].includes(c.phase)&&c.tick!==144).map(c=>c.ms)),
   perPhase:[...workPhases,'commit'].map(phase=>({phase,...stats(chunks.filter(c=>c.phase===phase).map(c=>c.ms))})),outliers:chunks.filter(c=>c.ms>16)},
  work:{maxPropagations:Math.max(...rows.map(r=>r.metrics.propagations)),maxQueries:Math.max(...rows.map(r=>r.metrics.narrowQueries)),maxSearches:Math.max(...rows.map(r=>r.metrics.searches)),maxReplays:Math.max(...rows.map(r=>r.metrics.replays)),
   peakFrontier:Math.max(...rows.map(r=>r.metrics.peakFrontier)),peakExpansion:Math.max(...rows.map(r=>r.metrics.peakExpansion)),workEndTick:stats(rows.map(r=>r.workEndTick)),pendingJobsPerWorld:1,
   peakRecords:Math.max(...runs.map(r=>r.peakRecords)),peakHazards:Math.max(...runs.map(r=>r.peakHazards)),
   deadlineFailures:rows.filter(r=>/DEADLINE|BUDGET|MISSED_PUBLICATION/.test(r.reason??'')).length,planningLead:stats(rows.map(r=>r.planningLead).filter(Number.isFinite)),publicationWarning:stats(rows.map(r=>r.publicationWarning).filter(v=>v!==null&&Number.isFinite(v)))},
  memory,browser:browserResult,
  limitations:['Proposal-field bypass tests have structure only; they are not safe publication evidence.','Reference witnesses certify a supplied root and field, not arbitrary human controls.','Policy forecasts are known offline; held-forecast mismatch probes reject. A reliable human-input runtime forecasting strategy is NOT claimed.','Four24h-equivalent runs advance director/ownership by distance only; no24h physical trajectory, renderer or phone run.','Timings include local JIT/GC/OS effects; no main-thread frame budget is certified.']};
 plotFiles=await directorPlots(browser,{metrics,fields,rows,chunks,referenceRun:runs.find(r=>r.labels.regime==='reference'&&r.seed===42&&r.labels.band==='early')});metrics.plotFiles=plotFiles;
 await writeFile(join(output,'director-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
 await writeFile(join(output,'director-samples.json'),JSON.stringify({structural,dayRuns,rows,preparations,chunks,presence,passive,acceptedFieldPassive},null,2)+'\n');
 await writeFile(join(output,'director-examples.json'),JSON.stringify({proposalSeed42:fields.find(f=>f.seed===42),runs},null,2)+'\n');
 console.log(JSON.stringify({scheduling:metrics.scheduling,groups:metrics.groups,proposal:distribution,passive:metrics.passive,reference:metrics.reference,
  timing:{preparation:metrics.timing.preparationMs,session:metrics.timing.sessionCpuMs,chunks:metrics.timing.chunkMs,outliers:metrics.timing.outliers},work:metrics.work,memory,browser:{version:browserResult.browser,chunks:browserResult.chunkMs},plotFiles},null,2));
}finally{await browser?.close();server.kill();}
// Preserve the original B-3/B-2/B-1 reproduction emitted by the preceding configured check.
const baselineDir=resolve('.cache/review/GAMEPLAY-001B-4/baseline');await mkdir(baselineDir,{recursive:true});
try{for(const file of await readdir('.cache/review/GAMEPLAY-001B-3/baseline'))if(/^(approved-|trajectory-).*\.(json|log)$/.test(file))await writeFile(join(baselineDir,file),await readFile(join('.cache/review/GAMEPLAY-001B-3/baseline',file)));}catch(error){if(error.code!=='ENOENT')throw error;}
