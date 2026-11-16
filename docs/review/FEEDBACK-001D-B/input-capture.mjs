import {spawn} from 'node:child_process';
import {copyFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
const dir=resolve('.cache/review/FEEDBACK-001D-B'),rows=[];
for(const mode of ['before','after']){
 const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5198','--strictPort'],{cwd:mode==='before'?resolve(dir,'baseline'):process.cwd(),windowsHide:true,stdio:'ignore'});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5198')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  for(const [width,height,touch] of [[800,450,false],[390,844,true],[360,800,true],[932,430,true],[768,1024,true]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch}),page=await context.newPage();
   await page.goto('http://127.0.0.1:5198/?seed=42');await page.locator('#launch').waitFor();await page.evaluate(()=>document.fonts.ready);
   const shot=async label=>{const path=`${mode}-${width}x${height}-${label}.png`;await page.screenshot({path:resolve(dir,'evidence',path)});rows.push({mode,path,width,height,touch,label,input:await page.locator('#game').getAttribute('data-input')});};
   await shot('input-menu');if(touch)await page.locator('#launch').tap();else await page.locator('#launch').click();await page.waitForTimeout(200);await shot('input-flight');
   if(mode==='after'&&touch){await page.keyboard.press('KeyW');await shot('hybrid-keyboard');await page.locator('#pause').tap();await page.locator('#resume').tap();await shot('hybrid-touch');}
   await context.close();
  }
 }finally{await browser.close();server.kill();await new Promise(r=>setTimeout(r,300));}
}
await writeFile(resolve(dir,'input-captures.json'),JSON.stringify({method:'Real production input-capability contexts, ordinary pointer/touch launch; UI comparisons, not matched moving-world geometry.',rows},null,2));
