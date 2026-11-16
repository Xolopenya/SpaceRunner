import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {access,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=resolve('.cache/review/FEEDBACK-001D-C'),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve(dir,'package/index.html')).href);
 const links=await page.locator('[href],img[src],video[src]').evaluateAll(ns=>ns.map(n=>n.href||n.src));
 for(const link of links)await access(fileURLToPath(link));
 await page.locator('img').evaluateAll(ns=>ns.forEach(n=>n.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 const videos=[];
 for(const video of await page.locator('video').all()){
  videos.push(await video.evaluate(v=>new Promise((done,reject)=>{v.onloadedmetadata=()=>done({width:v.videoWidth,height:v.videoHeight,duration:v.duration});v.onerror=()=>reject(Error('Video metadata failed'));v.preload='metadata';v.load();})));
 }
 assert.ok(videos.every(v=>v.width>0&&v.height>0&&v.duration>0));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:resolve(dir,'gallery-review.png')});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:resolve(dir,'gallery-mobile.png')});assert.deepEqual(errors,[]);
 await writeFile(resolve(dir,'gallery-verification.json'),JSON.stringify({links:links.length,images:await page.locator('img').count(),videos,errors,desktop:'1440x900',mobile:'390x844',overflow:false},null,2));
}finally{await browser.close();}
