import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from './release-browser-lib.mjs';
const root=resolve('.cache/review/FEEDBACK-001C1'),out=resolve('public/assets/collision-audio');await mkdir(out,{recursive:true});
const selected=[
 ['rock-a','small_rock_impact.wav',.65,'Julie Damsgaard / Spring Spring','https://opengameart.org/content/various-sound-effects-0'],
 ['rock-b','break_stone.wav',.8,'Julie Damsgaard / Spring Spring','https://opengameart.org/content/various-sound-effects-0'],
 ['metal-a','impact-sounds-impactMetal_medium_000.ogg',.5,'Kenney','https://kenney.nl/assets/impact-sounds'],
 ['metal-b','impact-sounds-impactMetal_light_000.ogg',.5,'Kenney','https://kenney.nl/assets/impact-sounds'],
 ['station-a','impact-sounds-impactPlate_heavy_000.ogg',.7,'Kenney','https://kenney.nl/assets/impact-sounds'],
 ['station-b','impact-sounds-impactPlate_heavy_002.ogg',.7,'Kenney','https://kenney.nl/assets/impact-sounds'],
 ['mine-a','sci-fi-sounds-explosionCrunch_000.ogg',1.1,'Kenney','https://kenney.nl/assets/sci-fi-sounds'],
 ['mine-b','sci-fi-sounds-explosionCrunch_001.ogg',1.1,'Kenney','https://kenney.nl/assets/sci-fi-sounds'],
];
const browser=await chromium.launch({channel:'chrome',headless:true}),manifest=[];
try {
 const page=await browser.newPage();await page.route('http://127.0.0.1:5190/**',async route=>{
  const file=new URL(route.request().url()).pathname.slice(1);
  if(!file)return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Licensed sample preparation</title>'});
  if(file==='favicon.ico')return route.fulfill({status:204});
  return route.fulfill({body:await readFile(resolve(root,'candidates',file))});
 });await page.goto('http://127.0.0.1:5190/');
 for(const [id,file,max,author,url] of selected) {
  const original=await readFile(resolve(root,'candidates',file));
  const result=await page.evaluate(async({file,max})=>{
   const c=new OfflineAudioContext(1,1,22050),b=await c.decodeAudioData(await(await fetch('/'+file)).arrayBuffer());
   let first=0;while(first<b.length&&Math.abs(b.getChannelData(0)[first])<.005)first++;
   first=Math.max(0,first-66);const length=Math.min(b.length-first,Math.round(max*22050));
   const samples=new Float32Array(length);let peak=0;
   for(let i=0;i<length;i++){for(let k=0;k<b.numberOfChannels;k++)samples[i]+=b.getChannelData(k)[first+i]/b.numberOfChannels;peak=Math.max(peak,Math.abs(samples[i]));}
   const data=new Uint8Array(44+length*2),v=new DataView(data.buffer),word=(at,s)=>[...s].forEach((x,i)=>v.setUint8(at+i,x.charCodeAt(0)));
   word(0,'RIFF');v.setUint32(4,data.length-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,44100,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,length*2,true);
   for(let i=0;i<length;i++)v.setInt16(44+i*2,samples[i]*.85/peak*Math.min(1,i/44,(length-1-i)/550)*32767,true);
   let text='';for(let i=0;i<data.length;i+=8192)text+=String.fromCharCode(...data.subarray(i,i+8192));
   return{data:btoa(text),seconds:length/22050,trimStart:first/22050};
  },{file,max});
  const bytes=Buffer.from(result.data,'base64');await writeFile(resolve(out,id+'.wav'),bytes);
  manifest.push({id,file:id+'.wav',originalFile:file.replace(/^(impact-sounds|sci-fi-sounds)-/,''),author,url,license:'CC0-1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',accessed:'2026-11-16',originalSHA256:createHash('sha256').update(original).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,seconds:result.seconds,trimStart:result.trimStart,processing:'Native Chromium decode/resample22050Hz, mono average, retained leading3ms, bounded crop, .85 peak,2ms attack/25ms tail. Runtime adds high-pass/quiet existing hull or energy layer and caps at .14.'});
 }
 for(const asset of manifest){asset.authorURL=asset.author==='Kenney'?'https://kenney.nl':'https://spring-enterprises.neocities.org';if(asset.author==='Kenney'){const pack=asset.id.startsWith('mine')?'sci-fi-sounds':'impact-sounds';asset.sourceArchiveSHA256=createHash('sha256').update(await readFile(resolve(root,'downloads','kenney_'+pack+'.zip'))).digest('hex');}else asset.processing+=' Both rock recordings are blended as contact/fracture layers at runtime.';}
 await writeFile(resolve(out,'manifest.json'),JSON.stringify({assets:manifest},null,2));
 for(const pack of ['impact-sounds','sci-fi-sounds'])await writeFile(resolve(out,pack+'-LICENSE.txt'),(await readFile(resolve(root,'candidates',pack+'-LICENSE.txt'),'utf8')).replace(/\r+/g,''));
 await writeFile(resolve(out,'stone-LICENSE.txt'),'CC0 1.0 Universal\nAuthor: Julie Damsgaard / Spring Spring / Spring Enterprises\nSource: https://opengameart.org/content/various-sound-effects-0\nFiles: small_rock_impact.wav, break_stone.wav\nCommercial use and redistribution under https://creativecommons.org/publicdomain/zero/1.0/\nVerified2026-11-16; source page/provenance retained in docs/ASSETS.md.\n');
 console.log('selected8 assets',manifest.reduce((n,a)=>n+a.bytes,0),'bytes');
}finally{await browser.close();}
