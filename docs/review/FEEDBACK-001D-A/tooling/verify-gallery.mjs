import assert from 'node:assert/strict';
import {access,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const dir=resolve('.cache/review/FEEDBACK-001D-A'),entry=pathToFileURL(resolve(dir,'package/index.html')).href;
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 await page.goto(entry);
 const links=await page.locator('[href],img[src],video[src]').evaluateAll(nodes=>nodes.map(n=>n.href||n.src));
 for(const url of links){const u=new URL(url);assert.equal(u.protocol,'file:');u.hash='';await access(fileURLToPath(u));}
 await page.locator('img').evaluateAll(nodes=>nodes.forEach(n=>n.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await page.locator('#category').selectOption('HUD');assert.equal(await page.locator('article:visible').count(),2);
 await page.locator('#reset').click();assert.equal(await page.locator('article:visible').count(),10);
 await page.screenshot({path:resolve(dir,'gallery-review.png')});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:resolve(dir,'gallery-review-mobile.png')});
 assert.deepEqual(errors,[]);
 const result={browser:browser.version(),url:entry,localLinks:links.length,images:await page.locator('img').count(),issues:10,categoryFilter:'pass',desktop:'1280x900',mobile:'390x844',horizontalOverflow:false,errors};
 await writeFile(resolve(dir,'gallery-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
