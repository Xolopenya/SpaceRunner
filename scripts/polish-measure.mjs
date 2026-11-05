import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {Mesh,Vector3,Box3,Matrix4} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {normalizeModel} from '../src/assets/asset-manager.ts';
import {MODEL_ASSETS} from '../src/assets/catalog.ts';
const b=await readFile('public/assets/kenney-space/craft_speederA.glb'),raw=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
const rawBounds=new Box3().setFromObject(raw),m=normalizeModel(raw,MODEL_ASSETS[0]);m.updateMatrixWorld(true);
const vertices=new Map();m.traverse(n=>{if(n instanceof Mesh){const p=n.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);if(Math.abs(v.x)>.4)vertices.set(v.toArray().map(x=>x.toFixed(6)).join(','),v.toArray());}}});
const wings=[...vertices.values()],root={position:m.position.toArray(),rotation:m.rotation.toArray(),scale:m.scale.toArray()};
const bands=[.4,.56,.75,.9,1.0,1.1,1.25,1.39].map(min=>{const v=wings.filter(v=>Math.abs(v[0])>=min);return{min,count:v.length,minXYZ:[0,1,2].map(i=>Math.min(...v.map(v=>v[i]))),maxXYZ:[0,1,2].map(i=>Math.max(...v.map(v=>v[i])))}});
const tips=wings.filter(p=>Math.abs(p[0])>.75);
const bank=[0,.18,.36].map(z=>{const mat=new Matrix4().makeRotationZ(z),v=tips.map(p=>new Vector3(...p).applyMatrix4(mat));return{roll:z,minY:Math.min(...v.map(v=>v.y)),maxY:Math.max(...v.map(v=>v.y))}});
const triangles=[];
m.traverse(n=>{if(!(n instanceof Mesh))return;const pos=n.geometry.getAttribute('position'),indices=n.geometry.index;for(let i=0;i<(indices?.count??pos.count);i+=3){const vs=[0,1,2].map(j=>new Vector3().fromBufferAttribute(pos,indices?indices.getX(i+j):i+j).applyMatrix4(n.matrixWorld));if(vs.some(v=>Math.abs(v.x)>1.3))triangles.push(vs.map(v=>v.toArray()))}});
const samples=[];for(const tri of triangles)for(let a=0;a<=20;a++)for(let b=0;b<=20-a;b++){const u=a/20,v=b/20;const p=[0,1,2].map(i=>tri[0][i]*(1-u-v)+tri[1][i]*u+tri[2][i]*v);samples.push(p)}
const candidates=[.16,.18,.20,.22,.28].map(radius=>({radius,centerX:radius===.28?1.02:1.08,centerY:radius===.28?-.35:-.30,lowerY:(radius===.28?-.35:-.30)-radius,upperY:(radius===.28?-.35:-.30)+radius,outerX:(radius===.28?1.02:1.08)+radius,surfaceSamples:samples.length,insideSphere:samples.filter(p=>Math.hypot(Math.abs(p[0])-(radius===.28?1.02:1.08),p[1]+(radius===.28?.35:.30),p[2]-.7)<=radius).length}));
const data={triangles,candidates,rawBounds:{min:rawBounds.min.toArray(),max:rawBounds.max.toArray()},root,normalized:new Box3().setFromObject(m).getSize(new Vector3()).toArray(),bands,bank,vertices:wings};
await mkdir('.cache/review/GAMEPLAY-005B2/final',{recursive:true});await writeFile('.cache/review/GAMEPLAY-005B2/final/wing-measurement.json',JSON.stringify(data,null,2));console.log(JSON.stringify({...data,vertices:undefined},null,2));
