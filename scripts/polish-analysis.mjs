import {readFile,writeFile} from 'node:fs/promises';
import {INTEGRATED_GEOMETRY} from '../src/integrated/model.ts';
import {SHIP_COLLIDER} from '../src/core/ship-collider.ts';
import {INTEGRATED_GEOMETRY as OLD} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/integrated/model.ts';
import {SHIP_COLLIDER as OLD_SHIP} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/core/ship-collider.ts';
import {flightSpeed} from '../src/release/settings.ts';
const p=JSON.parse(await readFile('.cache/review/GAMEPLAY-005B2/final/polish-audit.json','utf8'));
const clock=[{distance:0,elapsed:0}];while(clock.at(-1).distance<2700){const a=clock.at(-1),elapsed=a.elapsed+1/120;clock.push({elapsed,distance:a.distance+flightSpeed(elapsed,a.distance,true)/120})}
const time=d=>{const i=clock.findIndex(p=>p.distance>=d);if(i<=0)return 0;const a=clock[i-1],b=clock[i];return a.elapsed+(b.elapsed-a.elapsed)*(d-a.distance)/(b.distance-a.distance)};
for(const r of p.rows){
 const g=r.source==='baseline'?OLD:INTEGRATED_GEOMETRY,ship=r.source==='baseline'?OLD_SHIP:SHIP_COLLIDER;
 const intervals=r.decisions.flatMap(d=>d.hazards??[]).map(h=>({lo:h.passDistance-g.axialExtent(h)-ship.axialExtent,hi:h.passDistance+g.axialExtent(h)+ship.axialExtent})).filter(p=>p.lo<r.distance).sort((a,b)=>a.lo-b.lo);
 let end=intervals[0]?.hi??r.distance,max={meters:0,seconds:0};for(const v of intervals.slice(1)){if(v.lo>end){const gap={start:end,end:v.lo,meters:v.lo-end,seconds:time(v.lo)-time(end)};if(gap.meters>max.meters)max=gap;}end=Math.max(end,v.hi)}r.emptyForwardInterval=max;
 const ds=r.decisions.filter(d=>d.status==='committed');r.maxTimeBetweenPublications=Math.max(0,...ds.slice(1).map((d,i)=>time(d.distance)-time(ds[i].distance)));
}
const aggregate=source=>{const rs=p.rows.filter(r=>r.source===source),sum=k=>rs.reduce((a,r)=>a+r[k],0),max=k=>Math.max(...rs.map(r=>r[k]));return{runs:rs.length,committed:sum('committed'),omitted:sum('omitted'),mines:sum('mines'),stations:sum('stations'),placed:rs.reduce((a,r)=>a+r.stats.placed,0),opportunities:rs.reduce((a,r)=>a+r.stats.opportunities,0),maxOmissions:max('maxOmissions'),maxEmptyForwardMeters:Math.max(...rs.map(r=>r.emptyForwardInterval.meters)),maxEmptyForwardSeconds:Math.max(...rs.map(r=>r.emptyForwardInterval.seconds)),maxTimeBetweenPublications:max('maxTimeBetweenPublications'),plannerPropagations:rs.reduce((a,r)=>a+r.decisions.reduce((a,d)=>a+d.metrics.propagations,0),0),billedNarrowQueries:rs.reduce((a,r)=>a+r.decisions.reduce((a,d)=>a+d.metrics.narrowQueries,0),0),maxChunkPropagations:Math.max(...rs.flatMap(r=>r.work.map(w=>w.propagations))),maxChunkQueries:Math.max(...rs.flatMap(r=>r.work.map(w=>w.queries))),pickupP95Ms:rs.map(r=>r.pickupMs.p95)}};
p.summary={baseline:aggregate('baseline'),final:aggregate('final')};await writeFile('.cache/review/GAMEPLAY-005B2/final/polish-audit.json',JSON.stringify(p,null,2));console.log(p.summary);
