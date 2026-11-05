import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { safeZipName } from './zip.mjs';

const commit='393c2c6ae48b5cc0f5ec164367d3bcd3f7b0b5ea';
const root=resolve('.cache/review/GAMEPLAY-005B/baseline-project');
const archive=execFileSync('git',['archive','--format=zip',commit],{maxBuffer:64*1024*1024});
const records=execFileSync('git',['ls-tree','-rz','--full-tree',commit]).toString().split('\0').filter(Boolean);
for(const record of records){const tab=record.indexOf('\t'),name=record.slice(tab+1);assert.ok(safeZipName(name));assert.match(record.slice(0,tab),/^100(?:644|755) blob /);}
await mkdir(root,{recursive:true});
const archivePath=resolve('.cache/review/GAMEPLAY-005B/baseline-source.zip');await writeFile(archivePath,archive);
// Native Windows bsdtar supports Git ZIP comments/directory records. All Git paths above are validated first.
execFileSync('tar',['-xf',archivePath,'-C',root],{windowsHide:true});
const folder=resolve('.cache/review/GAMEPLAY-005B/baseline');await mkdir(folder,{recursive:true});
await writeFile(`${folder}/source.json`,JSON.stringify({commit,archiveSha256:createHash('sha256').update(archive).digest('hex'),method:'git archive exact commit; no working tree source files',entries:records.length},null,2));
console.log('Frozen approved baseline:',commit);
