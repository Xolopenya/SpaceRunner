import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Scene,Mesh} from 'three';
import {ResourceOwner} from '../src/assets/resources.ts';
import {salvageStation} from '../src/visuals/salvage-station.ts';
import {FragmentView} from '../src/collectibles/view.ts';
import {salvageStation as oldStation} from '../.cache/review/VISUAL-007B/before-source/src/visuals/salvage-station.ts';
import {FragmentView as OldFragmentView} from '../.cache/review/VISUAL-007B/before-source/src/collectibles/view.ts';
const dir='.cache/review/VISUAL-007B',baseline='552740c3b8ae0927b2caff9c89f2fcc5b7ac897d';
const hash=b=>createHash('sha256').update(b).digest('hex');
const geometryHash=g=>hash(Buffer.concat([...Object.keys(g.attributes).sort().map(k=>Buffer.from(g.attributes[k].array.buffer)),...(g.index?[Buffer.from(g.index.array.buffer)]:[])]));
const rows=[];
for(let i=0;i<5;i++){
  const a=oldStation(i),b=salvageStation(i),old=[],current=[];
  const measure=root=>{let calls=0,triangles=0,bytes=0;const materials=new Set(),geometries=new Set(),hashes=[];
    root.traverse(n=>{if(!(n instanceof Mesh))return;calls++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;geometries.add(n.geometry);hashes.push(geometryHash(n.geometry));for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
    for(const g of geometries){for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;bytes+=g.index?.array.byteLength??0;}
    return{calls,triangles,bytes,materials:materials.size,geometries:geometries.size,hashes};};
  const before=measure(a),after=measure(b);assert.deepEqual(before,after);rows.push({variant:i,before,after});
  for(const root of [a,b]){const r=new ResourceOwner();r.track(root);r.dispose();}
}
const fragments=[];
for(const [source,View] of [['before',OldFragmentView],['after',FragmentView]]){
 const scene=new Scene(),v=new View(scene),instance=v.root.children[0];let triangles=0;const materials=new Set(),geometries=new Set();
 v.root.traverse(n=>{if(n instanceof Mesh){geometries.add(n.geometry);materials.add(n.material);}});
 instance.traverse(n=>{if(n instanceof Mesh)triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;});
 fragments.push({source,triangles,calls:instance.children.length,geometries:geometries.size,materials:materials.size,burstHash:geometryHash(v.root.children.at(-1).geometry)});v.dispose();
}
assert.equal(fragments[0].burstHash,fragments[1].burstHash);assert.equal(fragments[1].calls,3);assert.ok(fragments[1].triangles<=300);
await writeFile(`${dir}/geometry.json`,JSON.stringify({stations:rows,fragments},null,2));
if(process.argv.includes('--geometry')){console.log('All five station geometries byte-identical; fragment:',fragments);process.exit(0);}
const allowed=['src/visuals/salvage-station.ts','src/collectibles/view.ts'];
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src','public','package.json','package-lock.json','vite.config.ts','index.html']).toString().trim().split('\n');
const protectedFiles=[];
for(const path of files){if(allowed.includes(path))continue;const before=execFileSync('git',['show',`${baseline}:${path}`]),after=await readFile(path);const normalize=b=>/\.(ts|css|html|json)$/.test(path)?b.toString().replaceAll('\r\n','\n'):b;assert.deepEqual(normalize(before),normalize(after),path);protectedFiles.push({path,sha256:hash(before)});}
const clean=s=>{const {resources,programs,...state}=s;return state;};
const before=JSON.parse(await readFile(`${dir}/before/captures.json`)),after=JSON.parse(await readFile(`${dir}/after/captures.json`)),pairs=[];
for(const b of after.receipts){const a=before.receipts.find(r=>r.name===b.name);assert.ok(a,b.name);assert.equal(a.tick,b.tick);assert.deepEqual(clean(a.state),clean(b.state),b.name);pairs.push({name:b.name,tick:b.tick,hash:hash(JSON.stringify(clean(b.state)))});}
const perfA=JSON.parse(await readFile(`${dir}/before-performance.json`)),perfB=JSON.parse(await readFile(`${dir}/after-performance.json`));
for(let i=0;i<perfA.rows.length;i++)assert.deepEqual(clean(perfA.rows[i].state),clean(perfB.rows[i].state));
const result={baseline,protectedFiles,allowed,pairs,performanceStatesMatched:perfA.rows.length,mineUnchanged:true,stationGeometryUnchanged:true,pickupBurstGeometryUnchanged:true};
await writeFile(`${dir}/preservation.json`,JSON.stringify(result,null,2));console.log(`${protectedFiles.length} protected inputs; ${pairs.length} matched gameplay states; ${perfA.rows.length} performance endpoints; mine and station/pickup contracts preserved.`);
const checked=execFileSync('git',['ls-files','src','public','tests','package.json','package-lock.json','vite.config.ts','tsconfig.json','playwright.config.ts']).toString().trim().split('\n');
for(const path of ['src/visuals/station-materials.ts','src/collectibles/shard-model.ts','tests/energy-art.test.ts'])if(!checked.includes(path))checked.push(path);
const validated=await Promise.all(checked.map(async path=>{let bytes=await readFile(path);const text=/\.(ts|css|html|json)$/.test(path);if(text)bytes=Buffer.from(bytes.toString().replaceAll('\r\n','\n'));return{path,text,sha256:hash(bytes)};}));
await writeFile(`${dir}/validated-inputs.json`,JSON.stringify(validated,null,2));
