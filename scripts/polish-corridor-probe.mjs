import {spawn} from 'node:child_process';import {mkdir,writeFile} from 'node:fs/promises';import {chromium} from '@playwright/test';
const dir='.cache/review/GAMEPLAY-005B2/final',server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5195','--strictPort'],{stdio:'ignore',windowsHide:true});
for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:5195');break}catch{await new Promise(r=>setTimeout(r,100))}}
const b=await chromium.launch({channel:'chrome'}),receipts=[];
try{for(const [name,target]of [['right',[6,0]],['left',[-6,0]],['upper',[0,3.6]],['lower',[0,-3.6]]]){
 const context=await b.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{}});await p.goto('http://127.0.0.1:5195/?debug=field&experiment=large-structure&aperture=center&mode=isolated&seed=42');await p.locator('#launch').click();
 await p.evaluate(()=>{const g=window.spaceRunner;g.loop.stop();g.world.flightCamera.setMode('hybrid-chase');document.querySelector('#structure-variants-debug-info').hidden=true});
 for(const depth of [60,25]){
  const s=await p.evaluate(({depth,target})=>{const g=window.spaceRunner,m=g.model,w=g.world,draw=w.renderer.render;w.renderer.render=()=>{};let h;
   for(let i=0;i<4000;i++){h=m.field.slots.find(h=>h.planned&&h.kind===4);if(h&&h.z>=-depth)break;m.step(1/120,{x:Math.max(-1,Math.min(1,(target[0]-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(target[1]-m.ship.y)*2.6-m.ship.vy*.8))});g.loop.render(1/120)}w.renderer.render=draw;g.loop.render(0);return{distance:m.distance,hull:m.hull,ship:{...m.ship},h:{...h}}},{depth,target});
  for(const on of [false,true]){await p.evaluate(on=>{const g=window.spaceRunner;g.world.boundaries.warp.occlusion=on;g.world.render(g.model,0)},on);await p.screenshot({path:`${dir}/media/owner-reconstruction-${name}-${depth}-${on?'after':'before'}.png`})}
  receipts.push({name,depth,state:s});
 }await context.close();
}await writeFile(`${dir}/owner-reconstruction.json`,JSON.stringify(receipts,null,2));}finally{await b.close();server.kill()}
