"""Package committed C1 source and measured evidence, without dependencies/build output."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import html
import json
import os
import subprocess
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.cache/review/FEEDBACK-001C1'
BASE='0348c2ac85be63106ea3bed6e532f50d97366c7a'
BRANCH='feature/feedback-001c1-audio-pickup-guidance'
REPORTS=['REPORT.md','AUDIO-DESIGN.md','PICKUP-UX-ANALYSIS.md','ARCHITECTURE.md','TESTING.md','PERFORMANCE.md','LISTENING-REVIEW.md','VISUAL-REVIEW.md']
def git(*args,env=None):return subprocess.check_output(['git',*args],cwd=ROOT,env=env)
def sha(data):return hashlib.sha256(data).hexdigest()
def load(path):return json.loads((OUT/path).read_text(encoding='utf-8-sig'))
def normal(path,data):return data.replace(b'\r\n',b'\n') if Path(path).suffix in ['.ts','.json','.html','.css','.txt','.svg','.md','.mjs','.py'] else data

head=git('rev-parse','HEAD').decode().strip()
assert git('branch','--show-current').decode().strip()==BRANCH
assert not git('diff','--name-only','HEAD').strip(),'Commit tracked changes first'
git('merge-base','--is-ancestor',BASE,head)
browser=load('full-browser/browser-results.json')['stats']
assert browser['expected']==118 and all(browser[k]==0 for k in ['unexpected','flaky','skipped'])
tested=load('full-browser/test-inputs.json');assert tested['stable'] and len(tested['files'])==244
unit=(OUT/'unit.log').read_text(encoding='utf-8-sig');assert 'tests 342' in unit and 'pass 342' in unit and 'fail 0' in unit
assert 'built in' in (OUT/'build.log').read_text(encoding='utf-8-sig')
preservation=load('preservation.json');assert preservation['checked']==143 and preservation['unchanged']==138
visual=load('visual-comparison.json');assert visual['matchedBaselineStates']==66 and visual['matchedOnOffStates']==66
assert len(visual['exactBaselineScreenshots'])==61 and len(visual['hudAnimationScreenshots'])==5
audio=load('audio-preservation.json');assert audio['engineClassSourceIdentical'] and len(audio['pairs'])==3
performance=load('performance.json');assert len(performance['rows'])==20
for i in range(10):assert performance['rows'][i]['stateHash']==performance['rows'][i+10]['stateHash']
assert sum(len(r.get('resets',[])) for r in performance['rows'])==40
endurance=load('final/live/endurance.json')['receipts'][0]
assert endurance['seconds']>=60 and endurance['buffersStable'] and endurance['audioStatus']=='running'
assert len(endurance['samples'])==60 and all(s['voices']<=6 and s['sameBuffers'] and s['sameSources'] and s['pcm']==13468180 for s in endurance['samples'])
assert endurance['sampleBank']['loaded']==8 and endurance['sampleBank']['failed']==0
playback=load('playback-review.json');assert len(playback['receipts'])==10
signal=load('signal-analysis.json');assert all(r['fullScaleSamples']==0 and r['peak']<.95 for r in signal['results'])
probes=load('final/probes/probes.json');assert len(probes['rows'])==5 and all(r['unchanged'] for r in probes['rows'])
assert probes['disposal']['before']['geometries']-probes['disposal']['after']['geometries']==2

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
    assert sha(normal(item['path'],entries[f"source/{item['path']}"]))==item['sha256'],f"Native-tested input changed: {item['path']}"

patch=git('diff','--binary','--full-index',BASE,head)
patch_path=OUT/'complete.patch';patch_path.write_bytes(patch)
assert OUT.resolve().is_relative_to(ROOT.resolve())
env={**os.environ,'GIT_INDEX_FILE':str(OUT/'patch-check.index')}
git('read-tree',BASE,env=env);git('apply','--cached','--binary',str(patch_path),env=env)
assert git('write-tree',env=env)==git('rev-parse',f'{head}^{{tree}}')
git('read-tree',head,env=env);git('apply','--cached','--reverse','--binary',str(patch_path),env=env)
assert git('write-tree',env=env)==git('rev-parse',f'{BASE}^{{tree}}')

identity=dict(task='FEEDBACK-001C1',base=BASE,head=head,tree=git('rev-parse','HEAD^{tree}').decode().strip(),branch=BRANCH,
              pushed=False,merged=False,unit=342,browser=browser,canonicalSourceFiles=len(paths),testedInputs=len(tested['files']),
              patch='Complete exact Git trees reproduced forward and reverse with isolated index')
entries['git/identity.json']=json.dumps(identity,indent=2).encode()
entries['git/full.diff']=patch
entries['git/status.txt']=git('status','--short','--branch')
entries['git/changed-files.txt']=git('diff','--name-status',BASE,head)
entries['git/log.txt']=git('log','--format=fuller',f'{BASE}..{head}')
for name in REPORTS:
    entries[name]=entries[f'source/docs/review/FEEDBACK-001C1/{name}']
    if name=='REPORT.md':entries[name]+=f'\nPackaged final commit: `{head}`.\n'.encode()
    (OUT/name).write_bytes(entries[name])

# Selected derivatives, original recordings and their supplied notices; no whole libraries.
asset_manifest=json.loads(entries['source/public/assets/collision-audio/manifest.json'])
assert len(asset_manifest['assets'])==8 and sum(a['bytes'] for a in asset_manifest['assets'])==212612
for path in (ROOT/'public/assets/collision-audio').iterdir():
    if path.is_file():entries[f'assets/{path.name}']=entries[f'source/public/assets/collision-audio/{path.name}']
for a in asset_manifest['assets']:
    prefix=('sci-fi-sounds-' if a['id'].startswith('mine') else 'impact-sounds-') if a['author']=='Kenney' else ''
    raw=(OUT/'candidates'/f"{prefix}{a['originalFile']}").read_bytes()
    assert sha(raw)==a['originalSHA256'];entries[f"assets/originals/{a['originalFile']}"]=raw
    assert sha(entries[f"assets/{a['file']}"])==a['sha256']
entries['assets/ASSETS.md']=entries['source/docs/ASSETS.md']

for path in OUT.iterdir():
    if path.is_file() and path.suffix in ['.json','.log'] and not path.name.endswith('-progress.json'):
        entries[f'evidence/{path.name}']=path.read_bytes()
for directory in ['full-browser','first-focused','focused','focused-clean','focused-final','focused-pass']:
    for path in (OUT/directory).rglob('*'):
        if path.is_file() and path.suffix in ['.json','.log','.md','.png','.zip']:
            entries[f'evidence/{directory}/{path.relative_to(OUT/directory).as_posix()}']=path.read_bytes()

groups={}
for mode in ['baseline','final']:
    capture=load(f'{mode}/guidance/captures.json');assert len(capture['receipts'])==(66 if mode=='baseline' else 132)
    entries[f'{mode}/guidance/captures.json']=(OUT/mode/'guidance/captures.json').read_bytes()
    for r in capture['receipts']:
        entries[f"{mode}/guidance/{r['file']}"]=(OUT/mode/'guidance'/r['file']).read_bytes()
        group=r['file'].split('-1280-')[0]+'-1280' if '-1280-' in r['file'] else r['file'].split('-390-')[0]+'-390' if '-390-' in r['file'] else r['file'].split('-844-')[0]+'-844'
        groups.setdefault(group,[])
        if mode=='final' and r['enabled']:groups[group].append(r['file'])
    for group in groups:
        for state in ['off'] if mode=='baseline' else ['off','on']:
            name=f'{group}-{state}.webm';data=(OUT/mode/'guidance'/name).read_bytes();assert len(data)>10000
            entries[f'{mode}/guidance/{name}']=data
    for directory in ['audio']+(['live','probes'] if mode=='final' else []):
        for path in (OUT/mode/directory).rglob('*'):
            if path.is_file() and path.suffix in ['.png','.webm','.wav','.json']:
                entries[f'{mode}/{directory}/{path.relative_to(OUT/mode/directory).as_posix()}']=path.read_bytes()

e=lambda s:html.escape(s,quote=True)
audio_players=''.join(f'<figure><figcaption>{e(path)}</figcaption><audio controls preload="none" src="{e(path)}"></audio></figure>' for path in sorted(entries) if path.endswith('.wav') and '/audio/' in path or path.startswith('final/live/') and path.endswith('-audio.webm'))
live=''.join(f'<figure><figcaption>{name} · actual canvas + audio (HTML HUD excluded)</figcaption><video controls preload="none" src="final/live/{name}-canvas.webm"></video></figure>' for name in ['flight','mine','death'])
guidance=[]
for group,shots in groups.items():
    videos=''.join(f'<figure><figcaption>{state.upper()} · same input tape</figcaption><video controls preload="none" src="final/guidance/{group}-{state}.webm"></video></figure>' for state in ['off','on'])
    pairs=''.join('<h4>'+e(shot)+'</h4><div class="pair">'+''.join(f'<figure><figcaption>{state.upper()}</figcaption><img loading="lazy" src="final/guidance/{e(shot.replace("-on.png","-"+state+".png"))}"></figure>' for state in ['off','on'])+'</div>' for shot in shots)
    guidance.append(f'<section><h3>{e(group)}</h3><p>Native-RAF final approach after accelerated prefix; silent page capture, HUD included. The same controls retain the same outcome.</p><button onclick="paired(this)">Play both from start</button><div class="pair">{videos}</div><details><summary>Six held ON/OFF states</summary>{pairs}</details><p><a href="baseline/guidance/{group}-off.webm">Exact base OFF video</a></p></section>')
report_links=' · '.join(f'<a href="{name}">{name}</a>' for name in REPORTS)
page=('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Space Runner · FEEDBACK-001C1 review</title>
<style>body{background:#07111e;color:#e0edf5;font:16px system-ui;margin:24px}p{max-width:1100px;line-height:1.55}a{color:#8ceaff}figure{margin:14px 0}figcaption{margin-bottom:8px;overflow-wrap:anywhere}audio{width:min(100%,650px)}video,img{width:100%;max-height:80vh;object-fit:contain;background:#030910}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}h3,h4{overflow-wrap:anywhere}button,summary{cursor:pointer;padding:10px;background:#15293b;color:#d9faff;border:1px solid #398799}section{border-top:1px solid #304354;margin-top:24px;padding-top:16px}@media(max-width:700px){.pair{grid-template-columns:1fr}body{margin:12px}}</style>
<h1>Space Runner · FEEDBACK-001C1</h1><p>Selected CC0 physical collision layers and true-depth pickup guidance. Manual playback only. Technical geometry/signal/playback evidence; no fabricated human listening or usability results. Start with the listening and visual reports for timestamps and limitations.</p><nav>'''+report_links+'''</nav><p><a href="assets/manifest.json">Asset sources, creators, licenses and hashes</a> · <a href="git/identity.json">Exact Git identity</a> · <a href="git/full.diff">Complete binary diff</a></p>
<h2>Before / after collision audio</h2><p>Compare baseline/audio/collisions.wav with final/audio/collisions.wav below at the same volume. Rock0.5–3.3s; metal4.7–7.5; station8.9–11.7; mine13.1–15.9. Fallback reproduces the old procedural mix. Other players include unchanged score/engine, spatial, lifecycle and stress examples.</p>'''+audio_players+'<h2>Actual live gameplay audio</h2>'+live+'<h2>Pickup guidance OFF / ON</h2><p>Five natural-input scenarios, desktop/portrait and body landscape. No teleporting in these tapes. Contour is current transverse overlap at real shard depth, not a future pickup guarantee. The left-wing tape retains its original hull loss.</p>'+''.join(guidance)+'''<h2>Secondary controlled obstruction/depth fixtures</h2><p>These explicitly placed geometry fixtures isolate rendering/rays; they are not natural gameplay attempts.</p>'''+''.join(f'<figure><figcaption>{name}</figcaption><img loading="lazy" src="final/probes/{name}.png"></figure>' for name in ['clear','ship-ray-blocked','camera-blocked','depth60','depth12'])+'''<script>function paired(b){const v=b.parentElement.querySelectorAll('video');v.forEach(x=>{x.currentTime=0;x.play().catch(()=>{})})}</script></html>''').encode()
entries['index.html']=page;(OUT/'index.html').write_bytes(page)
for name,data in entries.items():
    if name.startswith(('assets/','git/')):
        path=OUT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in ['href','src'] and v and not v.startswith(('#','https:','http:')):assert v in entries,f'Missing gallery link: {v}'
Links().feed(page.decode())
if '--prepare-gallery' in sys.argv:
    print(json.dumps({'gallery':str(OUT/'index.html'),'head':head,'groups':len(groups),'entriesPrepared':len(entries)}));sys.exit(0)
gallery=load('gallery-review.json');assert gallery['passed'] and gallery['gallerySHA256']==sha(page)
entries['evidence/gallery-review.png']=(OUT/'gallery-review.png').read_bytes()

manifest={**identity,'files':[dict(path=name,bytes=len(data),sha256=sha(data)) for name,data in entries.items()]}
entries['manifest.json']=json.dumps(manifest,indent=2).encode()
entries['SHA256SUMS']=''.join(f'{sha(data)}  {name}\n' for name,data in entries.items()).encode()
destination=ROOT/'review-packages';destination.mkdir(exist_ok=True)
archive_path=destination/'FEEDBACK-001C1-review.zip'
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
         'verification':'ZIP CRC, all sizes/SHA256, every canonical Git blob SHA1,244 native-tested inputs, complete exact forward/reverse Git trees and gallery links passed'}
(destination/'FEEDBACK-001C1-review.json').write_text(json.dumps(receipt,indent=2),encoding='utf8')
print(json.dumps(receipt,indent=2))
