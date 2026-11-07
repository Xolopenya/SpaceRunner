import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('.cache/playwright/ffmpeg-1013/ffmpeg-win64.exe'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.cache/playwright');
export const {chromium}=await import('@playwright/test');
export async function openGame(browser,url,{viewport={width:1280,height:800},videoDir,seed=42}={}){
 const context=await browser.newContext({viewport,...(videoDir?{recordVideo:{dir:videoDir,size:viewport}}:{})}),page=await context.newPage(),errors=[],failed=[],requests=[];
 page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{requests.push({url:r.url(),status:r.status()});if(r.status()>=400)failed.push({url:r.url(),status:r.status()})});
 await page.addInitScript(seed=>{
  window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};
  const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{random(array);if(array instanceof Uint32Array&&array.length===1)array[0]=seed;return array;};
 },seed);
 await page.goto(url,{waitUntil:'networkidle'});await page.locator('#launch').waitFor();
 assert.equal(await page.evaluate(()=>window.spaceRunner),undefined,'Public production must not expose a DEV game');
 const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('DOMDebugger.setEventListenerBreakpoint',{eventName:'click'});
 let pausedError;
 const onPause=async event=>{try{for(const frame of event.callFrames){const r=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:'!!(this && this.model && this.world)',returnByValue:true});if(r.result.value){await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:'window.releaseQA=this'});break;}}}catch(e){pausedError=e.message}finally{await cdp.send('Debugger.resume').catch(()=>{})}};
 cdp.on('Debugger.paused',onPause);await page.locator('#launch').click();await cdp.send('DOMDebugger.removeEventListenerBreakpoint',{eventName:'click'});cdp.off('Debugger.paused',onPause);await cdp.send('Debugger.disable');
 if(pausedError)throw Error(pausedError);
 await page.waitForFunction(()=>!!window.releaseQA,null,{polling:100});
 await page.evaluate(()=>{
  const g=window.releaseQA;g.loop.stop();window.releaseTick=0;
  window.releaseState=()=>{const m=g.model,w=g.world;return{state:m.state,seed:m.seed,distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},hull:m.hull,phase:m.phase,count:m.fragments.count,pickup:m.fragments.lastPickup,contact:m.lastShipContact,
   camera:w.flightCamera.mode,warp:w.boundaries.mode,fieldVisible:w.boundaries.field.root.visible,legacyVisible:w.boundaries.warp.root.visible,reveal:w.reveal.mode,source:m.field.experiment.version,mine:m.homing.current,
   hazards:m.field.slots,publications:m.field.events,fragments:m.fragments.slots,resources:{...w.renderer.info.memory},programs:w.renderer.info.programs.length};};
  window.releaseStep=input=>{const m=g.model;if(window.releaseTick%2===0)m.beginPlanningFrame();
   if(!input){const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0;input={x:0,y:0};for(const c of w?.controls??[]){if(at<c.ticks){input=c.input;break}at-=c.ticks;}}
   m.step(1/120,input);window.releaseTick++;if(window.releaseTick%2===0)g.loop.render(1/60);return{...input};};const coldAt=performance.now();g.loop.render(0);window.releaseCold={firstDrawMs:performance.now()-coldAt,programs:g.world.renderer.info.programs.length};
 });
 return{context,page,cdp,errors,failed,requests};
}
export async function advance(page,inputs,target,live=false){return page.evaluate(({inputs,target,live})=>new Promise(resolve=>{
 const g=window.releaseQA,step=()=>window.releaseStep(inputs?.[window.releaseTick]);
 if(!live){const draw=g.world.renderer.render;g.world.renderer.render=()=>{};while(window.releaseTick<target&&g.model.state==='PLAYING')step();g.world.renderer.render=draw;g.loop.render(0);resolve();return;}
 const frame=()=>{for(let n=0;n<2&&window.releaseTick<target&&g.model.state==='PLAYING';n++)step();if(window.releaseTick<target&&g.model.state==='PLAYING')window.nativeRAF(frame);else resolve()};window.nativeRAF(frame);
}),{inputs,target,live});}
