import{mkdir}from'node:fs/promises';
export async function directorPlots(browser,{metrics:m,fields,rows,chunks,referenceRun}){
 await mkdir('test-results',{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),files=[];
 const text=(x,y,t,size=17)=>`<text x="${x}" y="${y}" font-size="${size}">${String(t).replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`;
 const rect=(x,y,w,h,color)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
 const fixed=n=>Number(n).toFixed(3);
 async function save(name,title,subtitle,body){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900"><style>text{font-family:Arial,sans-serif;fill:#e2eef4}</style>${rect(0,0,1280,900,'#0b1726')}${text(36,44,title,25)}${text(36,77,subtitle,16)}${body}${text(36,875,'Actual recorded research data. Production gameplay unchanged. No human readability or enjoyment claim.',15)}</svg>`;
 await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);await page.screenshot({path:`test-results/${name}`});files.push(name);
 }
 try{
 const f=fields.find(f=>f.seed===42),list=f.rows.slice(0,24),end=list.at(-1).section.endDistance,start=list[0].section.startDistance;
 const color={regular:'#247d94',rising:'#a68832',high:'#c7674b',recovery:'#496f86'};let body='';
 for(const [i,r]of list.entries()){const s=r.section,x=70+(s.startDistance-start)/(end-start)*1120,w=(s.endDistance-s.startDistance)/(end-start)*1120;
 body+=rect(x,155,w-1,95,color[s.pacing])+text(x+3,280,i+1,13);
 body+=`<circle cx="${x+w/2}" cy="${530-s.intensity*190}" r="4" fill="#77e4dc"/>`;
 }
 body+=text(70,130,'Ownership sections: lengths and states, seed42')+text(70,320,`${start} → ${end} world units. Cell boundaries are not obstacle planes.`);
 body+=text(70,565,'Intensity varies within bounded pacing; identical intensity does not imply identical human difficulty.');
 for(const [i,[state,c]]of Object.entries(color).entries())body+=rect(70+i*280,650,25,25,c)+text(105+i*280,670,state);
 body+=text(70,730,`Recovery length median/p95: ${m.proposalDistribution.recoveryUnits.p50}/${m.proposalDistribution.recoveryUnits.p95} units.`);
 body+=text(70,770,`Repeated coarse three-section motifs: ${fixed(m.proposalDistribution.repeatedCoarseThreeSectionFraction*100)}%.`);
 await save('director-pacing.png','Distance-indexed pacing and intensity','Structure-only proposal schedule; every mark comes from the recorded seed42 sequence.',body);
 body=text(70,130,'Matched [0,19200) spatial windows,16 seeds: structure-only proposals versus unchanged original field');
 for(const [i,[label,value]]of [['Original waves (B-1 reproduction)',28403*100/(16*19200)],['B-4 combined proposal field',m.proposalDistribution.objectsPer100]].entries()){
 const y=190+i*85;body+=text(70,y,label)+rect(450,y-22,value*60,30,i?'#77e4dc':'#b68d65')+text(1080,y,fixed(value));}
 body+=text(70,380,'Admitted field by progression/policy: hazards/100 scheduled units (different warm-start windows).');
 let i=0;for(const band of ['early','middle','late'])for(const policy of ['witness','neutral','boundary','periodic']){
 const group=rows.filter(r=>r.labels.band===band&&r.labels.policy===policy&&['reference','state-aware-policy'].includes(r.labels.regime));
 const value=group.reduce((s,r)=>s+r.candidateCount,0)*100/group.reduce((s,r)=>s+r.section.cellCount*24,0),y=420+i++*31;
 body+=text(70,y,`${band}/${policy}`,15)+rect(300,y-17,value*70,20,color[band==='early'?'regular':band==='middle'?'rising':'high'])+text(1040,y,fixed(value),15);
 }
 await save('director-density.png','Proposed density and realized admission','Omissions remain in realized density. Higher count is not assumed to mean better navigation.',body);
 body=text(60,125,'Survivors without actual CCD contact through19200 units;15 fixed policies ×16 seeds.');
 for(const [i,p]of m.passive.byPolicy.entries()){const y=170+i*41;body+=text(60,y,p.policy,15)+rect(325,y-19,p.survived/16*610,25,'#77e4dc')+text(960,y,`${p.survived}/16; median ${Math.round(p.distance.p50)} units`,15);}
 body+=text(60,820,'Fixed structure-only field, no state veto or invulnerability. Failed finite policies do not prove no bypass exists.',15);
 await save('director-passive.png','Passive bypass experiments','Boundary starting positions are explicit early-parking probes; movement uses the real120Hz Ship.',body);
 const work=chunks.filter(c=>['validation','replay','publication'].includes(c.phase));
 const max=m.timing.chunkMs.max,plotTop=170,plotHeight=360,width=1120,buckets=1000,values=[];
 for(let i=0;i<buckets;i++){const from=Math.floor(i*work.length/buckets),to=Math.max(from+1,Math.floor((i+1)*work.length/buckets));values.push(Math.max(...work.slice(from,to).map(c=>c.ms)));}
 const path=values.map((v,i)=>`${i?'L':'M'}${70+i/(buckets-1)*width} ${plotTop+plotHeight-v/Math.max(max,2.5)*plotHeight}`).join('');
 body=text(70,125,`Chunk ms p50/p95/p99/max: ${[m.timing.chunkMs.p50,m.timing.chunkMs.p95,m.timing.chunkMs.p99,max].map(fixed).join(' / ')}`);
 body+=`<path d="${path}" stroke="#77e4dc" fill="none" stroke-width="1.5"/>`;
 const targetY=plotTop+plotHeight-2/Math.max(max,2.5)*plotHeight;
 body+=`<path d="M70 ${targetY}H1190" stroke="#e3a85e" stroke-dasharray="6 5"/>`+text(75,targetY-8,'2ms research target',13);
 body+=text(70,565,`${work.length} work chunks; each plotted bucket preserves its maximum. Waiting/final-gate samples are separate.`);
 body+=text(70,635,`CPU session p50/p95/max: ${[m.timing.sessionCpuMs.p50,m.timing.sessionCpuMs.p95,m.timing.sessionCpuMs.max].map(fixed).join(' / ')} ms.`);
 body+=text(70,685,`One pending job/world; peak ownership records ${m.work.peakRecords}; peak active hazards ${m.work.peakHazards}.`);
 body+=text(70,735,`Work-complete tick p95/max: ${m.work.workEndTick.p95}/${m.work.workEndTick.max}; fixed publication tick144.`);
 body+=text(70,760,`Final gate p95/max: ${fixed(m.timing.commitMs.p95)}/${fixed(m.timing.commitMs.max)} ms; every advance is recorded.`,15);
 body+=text(70,785,`Retained heap+ArrayBuffer delta ${m.memory.retainedGrowthBytes} bytes. Finite GC experiment, not a leak proof.`);
 await save('director-scheduling.png','Planning chunks, spikes and bounded scheduling','Local isolated CPU timings; no rendered main-thread or physical phone certification.',body);
 if(referenceRun){
  const r=referenceRun,start=r.initial.distance,end=r.terminal.distance,x=q=>80+(q-start)/(end-start)*1120;
  body=text(40,115,`Seed ${r.seed};${r.sections.length} scheduled sections;${r.sections.filter(s=>s.status!=='committed').length} omissions retained. Cyan: actual reference steering.`,16);
  for(const [axis,middle,scale,bound]of[['x',285,18,6],['y',650,30,3.6]]){
   body+=text(35,middle-130,`${axis.toUpperCase()} versus world distance`,19);
   for(const p of [-bound,0,bound])body+=text(30,middle-p*scale,p,14);
   body+=`<path d="M80 ${middle-120}V${middle+120}H1200" stroke="#52667c" fill="none"/>`;
   for(const h of r.hazards)body+=`<ellipse cx="${x(h.passDistance)}" cy="${middle-h[axis]*scale}" rx="${h.radius*1120/(end-start)}" ry="${h.radius*scale}" fill="${h.provenance.pattern?'#ffbc82':'#8aa1bf'}" opacity=".75"/>`;
   const path=r.trace.map((p,i)=>`${i?'L':'M'}${x(p.distance)} ${middle-p[axis]*scale}`).join('');
   body+=`<path d="${path}" stroke="#77e4dc" fill="none" stroke-width="2.5"/>`;
  }
  body+=text(80,820,'Accepted geometry only. Logical outer-radius projections; overlap in one projection is not3D contact.',15);
  await save('director-coverage.png','Recorded accepted field and reference steering','Research coordinates and actual simulated movement, not a captured production-game screenshot.',body);
 }
 }finally{await page.close();}return files;
}
