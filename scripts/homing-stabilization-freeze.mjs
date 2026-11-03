import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const baseline='bbfb48ccf390b8feceb82ada4f01e86b912b4779';
const dir=resolve('.cache/review/GAMEPLAY-003C4-FIX/baseline');
await mkdir(dir,{recursive:true});
const archive=execFileSync('git',['archive','--format=zip',baseline],{maxBuffer:64*1024*1024});
const zip=resolve('.cache/review/GAMEPLAY-003C4-FIX/baseline-source.zip');await writeFile(zip,archive);
execFileSync('python',['-c','import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,dir]);
const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline]).toString().trim().split('\n'),inventory=[];
for(const path of paths){const bytes=await readFile(join(dir,path));inventory.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(resolve('.cache/review/GAMEPLAY-003C4-FIX/baseline-inventory.json'),JSON.stringify({baseline,inventory},null,2));
console.log(dir,inventory.length);
