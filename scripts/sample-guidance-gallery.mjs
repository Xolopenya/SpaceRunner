import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from './release-browser-lib.mjs';
const root=resolve('.cache/review/FEEDBACK-001C1'),path=resolve(root,'index.html');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 await page.goto(pathToFileURL(path).href);
 await page.evaluate(()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');});
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 const desktop=await page.evaluate(()=>({images:document.images.length,groups:document.querySelectorAll('section').length,audio:document.querySelectorAll('audio').length,width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.equal(desktop.images,137);assert.equal(desktop.groups,11);assert.ok(desktop.scroll<=desktop.width);
 await page.locator('section').first().evaluate(async section=>{
  await Promise.all([...section.querySelectorAll('video')].map(v=>new Promise((resolve,reject)=>{v.preload='auto';v.onerror=()=>reject(Error('Gallery video failed'));v.onloadedmetadata=()=>{v.onseeked=()=>{v.pause();resolve();};v.currentTime=2;};v.load();})));
 });
 await page.locator('section').first().screenshot({path:resolve(root,'gallery-review.png')});
 await page.setViewportSize({width:390,height:844});const portrait=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(portrait.scroll<=portrait.width);
 assert.deepEqual(errors,[]);
 const receipt={passed:true,browser:browser.version(),gallerySHA256:createHash('sha256').update(await readFile(path)).digest('hex'),desktop,portrait,errors,method:'Native local gallery:137 actual images decoded;11 pair groups;first two video frames seek to2s;desktop/portrait fit;manual media controls. Functional review, not human usability.'};
 await writeFile(resolve(root,'gallery-review.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close();}
