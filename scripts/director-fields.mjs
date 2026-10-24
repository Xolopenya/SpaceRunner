import { createHash } from 'node:crypto';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { OwnershipLedger } from '../src/core/field-ownership.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { buildSection } from '../src/core/field-section.ts';
import { visibleAt } from '../src/core/field-scheduler.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { CONFIG } from '../src/config.ts';

export function stats(values) {
  const sorted=[...values].sort((a,b)=>a-b), at=p=>sorted[Math.floor((sorted.length-1)*p)]??null;
  return {count:sorted.length,min:sorted[0]??null,p50:at(.5),p95:at(.95),p99:at(.99),max:sorted.at(-1)??null,
    mean:sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null};
}
export function proposeSection(section, committed=[]) {
  return buildSection(section,committed).transaction;
}
/** STRUCTURE ONLY. This field is an open-loop bypass experiment, never publication evidence. */
export function proposalField(seed,{end=19200,minimumCells=0,retain=true}={}) {
  const director=new DifficultyDirector(seed), ledger=new OwnershipLedger(), field=new FieldGenerator(seed), hash=createHash('sha256');
  let cursor=director.initial(), committed=[], allocated=0, attempts=0, rejections=0, fallbacks=0, omissions=0, peakRecords=0, peakContext=0, generatedHazards=0;
  const rows=[], hazards=[], reasons={};
  while(cursor.firstCell*24<end || allocated<minimumCells) {
    const {section,next}=director.next(cursor);cursor=next; allocated+=section.cellCount;
    const distance=Math.max(0,section.startDistance-128);committed=visibleAt(committed,distance);ledger.retire(distance);
    let transaction=proposeSection(section,committed), admitted, usedFallback=false;
    for(let attempt=0;attempt<2;attempt++) {
      attempts++; const structure=transaction?field.inspect(transaction,committed):{status:'invalid',reason:'generation'};
      if(structure.status==='valid'){admitted=transaction;break;}
      rejections++; reasons[structure.reason]=(reasons[structure.reason]??0)+1;
      if(attempt===0){fallbacks++;usedFallback=true;transaction=field.propose(section.firstCell,section.cellCount);}
    }
    if(!admitted)omissions++;
    const reservation=ledger.reserve(section.id+(usedFallback?'/ambient-fallback':'/primary'),section.firstCell,section.cellCount,
      admitted?.hazards.map(h=>h.id)??[],admitted?.hazards??[]);
    if(reservation.status!=='reserved')throw new Error('Structural proposal ledger failed:'+reservation.reason);
    ledger.finalize(reservation.token,admitted?'committed':'omitted');
    if(admitted){generatedHazards+=admitted.hazards.length;committed=[...committed,...admitted.hazards];if(retain)hazards.push(...admitted.hazards);}
    peakRecords=Math.max(peakRecords,ledger.snapshot().length);peakContext=Math.max(peakContext,committed.length);
    const row={section,count:admitted?.hazards.length??0,fallback:usedFallback,omitted:!admitted};
    if(retain)rows.push(row);hash.update(JSON.stringify({row,transaction:admitted}));
  }
  ledger.retire(cursor.firstCell*24+20);
  return {seed,window:[0,end],allocatedCells:allocated,sectionCount:cursor.index,generatedHazards,attempts,rejections,fallbacks,omissions,reasons,peakRecords,peakContext,
    remainingRecords:ledger.snapshot().length,rows,hazards:hazards.filter(h=>h.passDistance<end),hash:hash.digest('hex')};
}
export function fieldDistribution(fields,end=19200) {
  const all=fields.flatMap(f=>f.hazards),gaps=fields.flatMap(f=>f.hazards.slice(1).map((h,i)=>h.passDistance-f.hazards[i].passDistance));
  const rows=fields.flatMap(f=>f.rows),family={},pacing={},recovery=[],motifs=new Map();let repeats=0,totalMotifs=0,encounterDistance=0,peak96=0;
  for(const f of fields){
    for(let i=0,j=0;i<f.hazards.length;i++){while(j<f.hazards.length&&f.hazards[j].passDistance-f.hazards[i].passDistance<=96)j++;peak96=Math.max(peak96,(j-i)*100/96);}
    const coarse=f.rows.map(r=>[r.section.pacing,r.section.family,r.section.cellCount,Math.floor(r.section.intensity*5)].join('/'));
    for(let i=2;i<coarse.length;i++){const key=coarse.slice(i-2,i+1).join('|');if(motifs.has(key))repeats++;motifs.set(key,(motifs.get(key)??0)+1);totalMotifs++;}
  }
  for(const r of rows){const s=r.section;family[s.family]=(family[s.family]??0)+1;pacing[s.pacing]=(pacing[s.pacing]??0)+1;
    if(s.pacing==='recovery')recovery.push(s.endDistance-s.startDistance);
    if(s.family!=='ambient')encounterDistance+=Math.max(0,Math.min(end,s.endDistance)-s.startDistance);}
  return {seeds:fields.length,window:[0,end],hazards:all.length,objectsPer100:all.length*100/(fields.length*end),gaps:stats(gaps),
    sameDepthFraction:gaps.filter(g=>Math.abs(g)<1e-9).length/gaps.length,peak96ObjectsPer100:peak96,
    encounterDistanceFraction:encounterDistance/(fields.length*end),family,pacing,recoveryUnits:stats(recovery),
    repeatedCoarseThreeSectionFraction:repeats/totalMotifs,coarseMotifs:motifs.size,
    structuralAttempts:fields.reduce((n,f)=>n+f.attempts,0),structuralRejected:fields.reduce((n,f)=>n+f.rejections,0),
    fallbacks:fields.reduce((n,f)=>n+f.fallbacks,0),omissions:fields.reduce((n,f)=>n+f.omissions,0)};
}
export const PASSIVE_POLICIES = Object.freeze([
  {name:'neutral',x:0,y:0,kind:'neutral'},
  {name:'fixed-x-vertical-motion',x:0,y:0,kind:'vertical'},
  {name:'fixed-y-horizontal-motion',x:0,y:0,kind:'horizontal'},
  {name:'boundary-left',x:-6,y:0,kind:'neutral'}, {name:'boundary-right',x:6,y:0,kind:'neutral'},
  {name:'boundary-top',x:0,y:3.6,kind:'neutral'}, {name:'boundary-bottom',x:0,y:-3.6,kind:'neutral'},
  ...[-1,1].flatMap(x=>[-1,1].map(y=>({name:`corner-${x}-${y}`,x:x*6,y:y*3.6,kind:'neutral'}))),
  {name:'constant-right',x:0,y:0,kind:'right'}, {name:'constant-up',x:0,y:0,kind:'up'},
  {name:'constant-diagonal',x:0,y:0,kind:'diagonal'}, {name:'periodic',x:0,y:0,kind:'periodic'},
]);
function policyInput(kind,tick) {
  const t=tick/120;
  return kind==='vertical'?{x:0,y:Math.sin(t*.8)}:kind==='horizontal'?{x:Math.sin(t*.8),y:0}
    :kind==='right'?{x:1,y:0}:kind==='up'?{x:0,y:1}:kind==='diagonal'?{x:1,y:1}
      :kind==='periodic'?{x:Math.sin(t*.8),y:Math.cos(t*.6)*.6}:{x:0,y:0};
}
export function passiveReplay(field,policy,end=19200,initial={elapsed:0,distance:0}) {
  const state={x:policy.x,y:policy.y,vx:0,vy:0,...initial},prediction=new FlightPrediction();
  let tick=0,left=0,firstMarginHit,firstGameplayHit,xTravel=0,yTravel=0,reversals=0,lastX=0,lastY=0,turnX=state.x,turnY=state.y;
  while(state.distance<end&&!firstGameplayHit){
    const previous={...state};prediction.step(state,policyInput(policy.kind,tick++));xTravel+=Math.abs(state.x-previous.x);yTravel+=Math.abs(state.y-previous.y);
    for(const [axis,velocity]of[['x','vx'],['y','vy']]){
      const sign=Math.abs(state[velocity])>.3?Math.sign(state[velocity]):0;
      if(axis==='x'){if(sign&&lastX&&sign!==lastX&&Math.abs(state.x-turnX)>.75){reversals++;turnX=state.x;}if(sign)lastX=sign;}
      else {if(sign&&lastY&&sign!==lastY&&Math.abs(state.y-turnY)>.75){reversals++;turnY=state.y;}if(sign)lastY=sign;}
    }
    while(left<field.hazards.length&&field.hazards[left].passDistance+1.67<previous.distance)left++;
    for(let i=left;i<field.hazards.length&&field.hazards[i].passDistance-1.67<=state.distance;i++){
      const h=field.hazards[i];
      if(!firstMarginHit&&prediction.hit(previous,state,h,.15))firstMarginHit={distance:state.distance,elapsed:state.elapsed,id:h.id};
      if(prediction.hitGameplay(previous,state,h)){firstGameplayHit={distance:state.distance,elapsed:state.elapsed,id:h.id};break;}
    }
  }
  return {seed:field.seed,policy:policy.name,root:{x:policy.x,y:policy.y,...initial},survived:!firstGameplayHit,
    distance:Math.min(end,state.distance)-initial.distance,seconds:state.elapsed-initial.elapsed,firstMarginHit,firstGameplayHit,xTravel,yTravel,reversals,
    method:'Fixed geometry; real120Hz Ship and calibrated CCD; stop at first actual contact, no immunity. Boundary initial states are explicit early-parking probes.'};
}
export function axialPresence(field,end=19200) {
  const state={x:0,y:0,vx:0,vy:0,elapsed:0,distance:0},prediction=new FlightPrediction();
  let tick=0,left=0,right=0,nearbyEmpty=0,axialEmpty=0,opportunityLeft=0;
  while(state.distance<end){
    prediction.step(state,{x:0,y:0});tick++;
    while(left<field.hazards.length&&field.hazards[left].passDistance<state.distance-10)left++;
    while(right<field.hazards.length&&field.hazards[right].passDistance<=state.distance+10)right++;
    if(left===right)nearbyEmpty++;
    while(opportunityLeft<field.hazards.length&&field.hazards[opportunityLeft].passDistance+1.67<state.distance)opportunityLeft++;
    let nearby=false;
    for(let i=opportunityLeft;i<field.hazards.length&&field.hazards[i].passDistance-1.67<=state.distance;i++)if(Math.abs(field.hazards[i].passDistance-state.distance)<=field.hazards[i].radius+.42+.15)nearby=true;
    if(!nearby)axialEmpty++;
  }
  return {seed:field.seed,steps:tick,seconds:tick/120,centerSlab10EmptyFraction:nearbyEmpty/tick,outerOpportunityEmptyFraction:axialEmpty/tick,
    note:'Axial presence only. Neither envelope presence nor absence is XY contact risk or human perception.'};
}
