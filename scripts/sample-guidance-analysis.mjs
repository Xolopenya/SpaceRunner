import {mkdir,writeFile} from 'node:fs/promises';
import {PerspectiveCamera,Vector3} from 'three';
import {IntegratedModel} from '../src/integrated/model.ts';
import {FlightCamera,CAMERA} from '../src/camera/flight-camera.ts';
import {certifiedInput} from '../tests/fixtures/fragment-flight.ts';
const dir='.cache/review/FEEDBACK-001C1';await mkdir(dir,{recursive:true});
const results=[],scenarios=[];
for(const seed of [0,42,11,7])for(const policy of ['world-body','screen-centre']) {
 const m=new IntegratedModel();m.ready();m.start(seed);const camera=new PerspectiveCamera(CAMERA.fov,1.6,CAMERA.near,CAMERA.far),follow=new FlightCamera(camera);
 follow.setMode('hybrid-chase');follow.resize(1280,800);follow.reset();const p=new Vector3(),q=new Vector3(),axis=new Vector3();
 const inputs=[],shots=[],samples=[];let target,first,ended;
 for(let tick=0;tick<5000&&m.state==='PLAYING';tick++) {
  if(tick%2===0)m.beginPlanningFrame();follow.update(m.ship.x,m.ship.y,m.elapsed,0,1/60);camera.updateMatrixWorld();
  target??=m.fragments.active[0];let input=certifiedInput(m);
  if(target){
   const depth=target.passDistance-m.distance;
   p.set(target.x,target.y,-depth).project(camera);q.set(m.ship.x,m.ship.y,0).project(camera);axis.set(m.ship.x,m.ship.y,-depth).project(camera);
   first??={elapsed:m.elapsed,distance:m.distance,ship:{...m.ship},target:{...target},leadSeconds:depth/m.speed};
   input=policy==='world-body'?{x:(target.x-m.ship.x)*2.6-m.ship.vx*.8,y:(target.y-m.ship.y)*2.6-m.ship.vy*.8}
     :{x:(p.x-q.x)*12-m.ship.vx*.35,y:(p.y-q.y)*12-m.ship.vy*.35};
   input={x:Math.max(-1,Math.min(1,input.x)),y:Math.max(-1,Math.min(1,input.y))};
   if(tick%24===0)samples.push({tick,depth,ship:{...m.ship},shard:p.toArray(),shipImage:q.toArray(),corridorImage:axis.toArray(),perspectivePixelsY:Math.abs(axis.y-q.y)*400,hull:m.hull});
   for(const at of [64,40,16,8,2,-3])if(depth<at&&!shots.some(s=>s.name===`depth-${at}`))shots.push({name:`depth-${at}`,tick:tick+1});
  }
  inputs.push({...input});m.step(1/120,input);if(tick%2===1)m.finishPlanningFrame(1/60);
  if(target&&(m.fragments.count>0||m.distance-target.passDistance>4||m.state==='GAME_OVER'))ended??=tick;
  if(ended!==undefined&&tick-ended>30)break;
 }
 const row={seed,policy,first,shots,samples,count:m.fragments.count,hull:m.hull,pickup:m.fragments.lastPickup,state:m.state,distance:m.distance,fault:m.field.fault};results.push(row);
 if(seed===0)scenarios.push({name:policy==='screen-centre'?'pickup-screen-miss':'pickup-diagnostic-body',seed,inputs,endTick:inputs.length,shots});
 console.log(seed,policy,'count',m.fragments.count,'HP',m.hull);m.dispose();
}
await writeFile(`${dir}/pickup-analysis.json`,JSON.stringify({method:'Diagnostic model replays, not users. Both use actual bounded movement inputs and unchanged pickup/placement/collision rules. World-body pilot knows coordinates; screen-centre pilot demonstrates optical ambiguity and is not a human-performance estimate. Failures do not prove a globally unreachable shard.',results,scenarios},null,2));
