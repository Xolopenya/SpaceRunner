"""Package exact committed source, verified native evidence and playable audio."""
from pathlib import Path
import hashlib
import html
import json
import os
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.cache/review/FEEDBACK-001C'
BASE='4ad10e88aa147d619eb9cee63379a5407e8bd93b'
BRANCH='feature/feedback-001c-audio-flight-feel'
REPORTS=['REPORT.md','AUDIO-DESIGN.md','ARCHITECTURE.md','LISTENING-REVIEW.md','VISUAL-REVIEW.md','PERFORMANCE.md','TESTING.md']
def git(*args,env=None):return subprocess.check_output(['git',*args],cwd=ROOT,env=env)
def sha(data):return hashlib.sha256(data).hexdigest()
def load(path):return json.loads((OUT/path).read_text(encoding='utf-8-sig'))
def normal(path,data):return data.replace(b'\r\n',b'\n') if Path(path).suffix in ['.ts','.json','.html','.css','.txt','.svg','.md','.mjs','.py'] else data

head=git('rev-parse','HEAD').decode().strip()
assert git('branch','--show-current').decode().strip()==BRANCH
assert not git('diff','--name-only','HEAD').strip(),'Commit tracked changes first'
git('merge-base','--is-ancestor',BASE,head)
browser=load('full-browser-final/browser-results.json')['stats']
assert browser['expected']==115 and all(browser[k]==0 for k in ['unexpected','flaky','skipped']),browser
tested=load('full-browser-final/test-inputs.json');assert tested['stable']
unit=(OUT/'unit.log').read_text(encoding='utf-8-sig');assert 'tests 334' in unit and 'pass 334' in unit and 'fail 0' in unit
assert 'built in' in (OUT/'build.log').read_text(encoding='utf-8-sig')
preservation=load('preservation.json');assert preservation['checked']==140 and preservation['unchanged']==131
visual=load('visual-comparison.json');assert visual['matchedEndpoints']==38 and len(visual['exactApprovedScreenshots'])==26
performance=load('performance.json');assert len(performance['rows'])==20
for i in range(10):assert performance['rows'][i]['stateHash']==performance['rows'][i+10]['stateHash']
endurance=load('final/live/endurance.json')['receipts'][0]
assert endurance['seconds']>=180 and endurance['buffersStable'] and endurance['audioStatus']=='running'
assert all(s['voices']<=6 for s in endurance['samples'])
for change in endurance['pacing']:
    if change['state'] in ['high','rising']:assert change.get('active')
    if change.get('active'):
        active=change['active'];assert active['start']<=change['distance']<active['end'] and active['pacing']==change['state']
playback=load('playback-review.json');assert len(playback['receipts'])==10
assert (OUT/'final/audio/music.wav').stat().st_size>15_000_000
assert (OUT/'final/live/mine-canvas.webm').stat().st_size>100_000
signal=load('signal-analysis.json');assert all(r['fullScaleSamples']==0 for r in signal['results'])

entries={}
paths=git('ls-tree','-r','--name-only',head).decode().splitlines()
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=('\n'.join(f'{head}:{p}' for p in paths)+'\n').encode())
cursor=0;blob_ids={}
for path in paths:
    assert not path.startswith(('node_modules/','dist/','.cache/','review-packages/','.env'))
    end=batch.index(b'\n',cursor);header=batch[cursor:end].split();assert header[1]==b'blob'
    size=int(header[2]);cursor=end+1;data=batch[cursor:cursor+size];cursor+=size+1
    blob_ids[path]=header[0].decode();entries[f'source/{path}']=data
assert cursor==len(batch)
for item in load('validated-inputs.json'):
    assert sha(normal(item['path'],entries[f"source/{item['path']}"]))==item['sha256'],item['path']
for item in tested['files']:
    assert sha(normal(item['path'],entries[f"source/{item['path']}"]))==item['sha256'],f"Tested runtime changed: {item['path']}"

patch=git('diff','--binary','--full-index',BASE,head)
patch_path=OUT/'complete.patch';patch_path.write_bytes(patch)
assert OUT.resolve().is_relative_to(ROOT.resolve())
env={**os.environ,'GIT_INDEX_FILE':str(OUT/'patch-check.index')}
git('read-tree',BASE,env=env);git('apply','--cached','--binary',str(patch_path),env=env)
assert git('write-tree',env=env)==git('rev-parse',f'{head}^{{tree}}')
git('read-tree',head,env=env);git('apply','--cached','--reverse','--binary',str(patch_path),env=env)
assert git('write-tree',env=env)==git('rev-parse',f'{BASE}^{{tree}}')

identity=dict(task='FEEDBACK-001C',base=BASE,head=head,tree=git('rev-parse','HEAD^{tree}').decode().strip(),branch=BRANCH,
              pushed=False,merged=False,unit=334,browser=browser,canonicalSourceFiles=len(paths),testedInputs=len(tested['files']),
              patch='Forward and reverse application reproduce the complete exact Git trees using an isolated index')
entries['git/identity.json']=json.dumps(identity,indent=2).encode()
entries['git/full.diff']=patch
entries['git/status.txt']=git('status','--short','--branch')
entries['git/changed-files.txt']=git('diff','--name-status',BASE,head)
entries['git/log.txt']=git('log','--format=fuller',f'{BASE}..{head}')
for name in REPORTS:entries[name]=entries[f'source/docs/review/FEEDBACK-001C/{name}']
entries['REPORT.md']+=f'\n\nPackaged identity: branch `{BRANCH}`, base `{BASE}`, final `{head}`. No push or merge.\n'.encode()
for path in OUT.glob('*'):
    if path.is_file() and path.suffix in ['.json','.log','.md']:entries[f'evidence/{path.name}']=path.read_bytes()
for directory in ['full-browser-final','first-browser-failure','second-browser-interrupted','passive-baseline','passive-final']:
    for path in (OUT/directory).rglob('*'):
        if path.is_file() and path.suffix in ['.json','.log','.md','.png','.zip','.mjs']:
            entries[f'evidence/{directory}/{path.relative_to(OUT/directory).as_posix()}']=path.read_bytes()
for mode in ['baseline','final']:
    for path in (OUT/mode).rglob('*'):
        if path.is_file() and 'raw-video' not in path.parts and path.suffix in ['.png','.webm','.wav','.json']:
            entries[f'{mode}/{path.relative_to(OUT/mode).as_posix()}']=path.read_bytes()

audio=[]
for path in sorted(k for k in entries if k.endswith(('.wav','.webm')) and '/audio/' in k or k.startswith('final/live/') and k.endswith('-audio.webm')):
    audio.append(f'<figure><figcaption>{html.escape(path)}</figcaption><audio controls preload="none" src="{html.escape(path,quote=True)}"></audio></figure>')
clips=''.join(f'<h3>{name}: actual canvas + audio</h3><video controls preload="none" src="final/live/{name}-canvas.webm"></video>' for name in ['flight','steering','mine','death'])
pairs=[]
for row in load('final/captures.json')['receipts']:
    name=html.escape(row['path'],quote=True)
    pairs.append(f'<h3>{name}</h3><div class="pair"><figure><figcaption>001B1 baseline</figcaption><img loading="lazy" src="baseline/{name}"></figure><figure><figcaption>001C final</figcaption><img loading="lazy" src="final/{name}"></figure></div>')
entries['index.html']=('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Space Runner FEEDBACK-001C review</title>
<style>body{background:#07111e;color:#e0edf5;font:16px system-ui;margin:24px}p{max-width:1000px;line-height:1.5}a{color:#8ceaff}figure{margin:16px 0}figcaption{margin-bottom:8px}audio{width:min(100%,650px)}video{width:min(100%,1000px)}img{width:100%}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}h3{font-size:16px}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<h1>Space Runner · FEEDBACK-001C</h1><p>Start with <a href="LISTENING-REVIEW.md">LISTENING-REVIEW.md</a> for exact timestamps and <a href="REPORT.md">REPORT.md</a> for scope. No autoplay. WAV files are actual production AudioGraph renders in native OfflineAudioContext; live Opus and canvas/Opus clips are actual production flights. Canvas videos exclude the HTML HUD. Matched screenshots and silent page captures retain it. Technical playback and signal checks do not assert human artistic approval.</p>
<h2>Audible production clips</h2>'''+clips+'<h2>Audio comparison, long score and adaptive demos</h2>'+''.join(audio)+'<h2>Matched screenshots</h2>'+''.join(pairs)).encode()

manifest={**identity,'files':[dict(path=name,bytes=len(data),sha256=sha(data)) for name,data in entries.items()]}
entries['manifest.json']=json.dumps(manifest,indent=2).encode()
entries['SHA256SUMS']=''.join(f'{sha(data)}  {name}\n' for name,data in entries.items()).encode()
destination=ROOT/'review-packages';destination.mkdir(exist_ok=True)
archive_path=destination/'FEEDBACK-001C-review.zip'
with zipfile.ZipFile(archive_path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name,data in entries.items():archive.writestr(name,data)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None and len(archive.namelist())==len(entries)
    for name,data in entries.items():assert archive.read(name)==data
    for path,blob in blob_ids.items():
        data=archive.read(f'source/{path}');assert hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==blob
    for item in manifest['files']:assert sha(archive.read(item['path']))==item['sha256']
assert not git('diff','--name-only','HEAD').strip()
receipt={**identity,'path':str(archive_path),'bytes':archive_path.stat().st_size,'sha256':sha(archive_path.read_bytes()),'entries':len(entries),
         'verification':'ZIP CRC, every size/SHA256, every canonical Git blob SHA1, tested-input correspondence, exact complete forward/reverse Git trees passed'}
(destination/'FEEDBACK-001C-review.json').write_text(json.dumps(receipt,indent=2),encoding='utf8')
print(json.dumps(receipt,indent=2))
