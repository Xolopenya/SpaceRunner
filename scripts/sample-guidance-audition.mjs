import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from './release-browser-lib.mjs';
const root=resolve('.cache/review/FEEDBACK-001C1'),dir=resolve(root,'candidates');
const files=(await readdir(dir)).filter(n=>/\.(ogg|wav)$/.test(n));
const browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--mute-audio']});
try {
 const page=await browser.newPage();await page.route('http://127.0.0.1:5192/**',async route=>{
  const name=decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
  if(!name)return route.fulfill({contentType:'text/html',body:'<!doctype html><button id="play">Audition</button><script>document.querySelector("button").onclick=async()=>{window.ctx=new AudioContext();await ctx.resume();window.ready=true;}</script>'});
  if(name==='favicon.ico')return route.fulfill({status:204});
  await route.fulfill({body:await readFile(resolve(dir,name))});
 });
 await page.goto('http://127.0.0.1:5192/');await page.locator('#play').click();await page.waitForFunction(()=>window.ready);
 const results=[];
 for(const file of files) {
  const result=await page.evaluate(async file=>{
   const c=window.ctx,b=await c.decodeAudioData(await(await fetch('/'+file)).arrayBuffer()),s=b.getChannelData(0);
   let peak=0,energy=0,low=0,lowEnergy=0,attack=0,first=-1,last=-1;
   const coefficient=1-Math.exp(-2*Math.PI*120/b.sampleRate);
   for(let i=0;i<s.length;i++){peak=Math.max(peak,Math.abs(s[i]));energy+=s[i]*s[i];low+=coefficient*(s[i]-low);lowEnergy+=low*low;if(Math.abs(s[i])>.01){if(first<0)first=i;last=i;}if(i<b.sampleRate*.025)attack+=s[i]*s[i];}
   const source=c.createBufferSource(),gain=c.createGain();source.buffer=b;gain.gain.value=.18/Math.max(.18,peak);source.connect(gain).connect(c.destination);source.start();
   await new Promise(r=>setTimeout(r,Math.min(1.4,b.duration+.1)*1000));source.stop();source.disconnect();gain.disconnect();
   return{file,duration:b.duration,rate:b.sampleRate,channels:b.numberOfChannels,peak,rms:Math.sqrt(energy/s.length),bassEnergy:lowEnergy/energy,attackRms:Math.sqrt(attack/Math.min(s.length,b.sampleRate*.025)),first:first/b.sampleRate,last:last/b.sampleRate,decodedBytes:b.length*b.numberOfChannels*4};
  },file);
  results.push(result);console.log(JSON.stringify(result));
 }
 await page.evaluate(()=>window.ctx.close());await writeFile(resolve(root,'candidate-audition.json'),JSON.stringify({method:'Actual licensed candidate bytes decoded and auditioned in unmuted Chromium after genuine gesture. Descriptive signal inspection supports selection; not an independent human taste verdict.',browser:browser.version(),results},null,2));
}finally{await browser.close();}
