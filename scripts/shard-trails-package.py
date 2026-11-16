"""Exact C2 Git source, complete diff, natural media and verified review evidence."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,html,json,os,subprocess,sys,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.cache/review/FEEDBACK-001C2'
BASE='10cc436c3afb005705dd8a1649799903363dfdf1'
BRANCH='feature/feedback-001c2-shard-trails'
REPORTS=['REPORT.md','COLLECTIBLE-DESIGN.md','BALANCE-COMPARISON.md','ARCHITECTURE.md','TESTING.md','PERFORMANCE.md','VISUAL-REVIEW.md']
def git(*args,env=None):return subprocess.check_output(['git',*args],cwd=ROOT,env=env)
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p):return json.loads((OUT/p).read_text(encoding='utf-8-sig'))
def normal(p,b):return b.replace(b'\r\n',b'\n') if Path(p).suffix in ['.ts','.mjs','.py','.json','.html','.css','.txt','.svg','.md'] else b
head=git('rev-parse','HEAD').decode().strip()
assert git('branch','--show-current').decode().strip()==BRANCH
assert not git('diff','--name-only','HEAD').strip(),'Commit tracked changes first'
git('merge-base','--is-ancestor',BASE,head)
browser=load('full-browser/browser-results.json')['stats']
assert browser['expected']==121 and all(browser[k]==0 for k in ['unexpected','flaky','skipped'])
tested=load('full-browser/test-inputs.json');assert tested['stable'] and len(tested['files'])==244
unit=(OUT/'unit.log').read_text(encoding='utf-8-sig');assert 'tests 347' in unit and 'pass 347' in unit and 'fail 0' in unit
assert 'built in' in (OUT/'build.log').read_text(encoding='utf-8-sig')
preservation=load('preservation.json');assert preservation['checked']==160 and preservation['unchanged']==153
comparison=load('comparison.json');assert comparison['matchedPerformanceStates']==10 and len(comparison['matchedBalanceInputs'])==4
perf=load('performance.json');assert len(perf['rows'])==20
for i in range(10):assert perf['rows'][i]['stateHash']==perf['rows'][i+10]['stateHash']
assert sum(len(r.get('resets',[])) for r in perf['rows'])==40
assert max(f['activeShards'] for r in perf['rows'] if r['source']=='final' for f in r['effects'])>=3
endurance=load('final/live/endurance.json')['receipts'][0]
assert endurance['seconds']>=120 and endurance['buffersStable'] and not endurance['guidancePresent']
assert len(endurance['samples'])==120 and all(s['sameBuffers'] and s['sameSources'] and s['voices']<=6 and s['pcm']==13468180 for s in endurance['samples'])
safety=load('safety-audit.json');assert len(safety['rows'])==6 and all(r['unsafe']==0 for r in safety['rows'])
assert sum(len(r['trails']) for r in safety['rows'])>=4 and sum(r['pointChecks'] for r in safety['rows'])>=19500
profile=load('dense-profile.json');assert len(profile['rows'])==6
for i in range(3):assert profile['rows'][i]['stateHash']==profile['rows'][i+3]['stateHash']
endurance=load('final/live/endurance.json')['receipts'][0]
assert endurance['seconds']>=120 and len(endurance['samples'])==120 and endurance['buffersStable'] and endurance['audioStatus']=='running' and not endurance['guidancePresent']
assert all(s['sameBuffers'] and s['sameSources'] and s['pcm']==13468180 and s['activeShards']<=8 and s['voices']<=6 for s in endurance['samples'])
entries={};blobs={};paths=git('ls-tree','-r','--name-only',head).decode().splitlines()
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=('\n'.join(f'{head}:{p}' for p in paths)+'\n').encode());cursor=0
for p in paths:
    assert not p.startswith(('node_modules/','dist/','.cache/','review-packages/','.env'))
    end=batch.index(b'\n',cursor);h=batch[cursor:end].split();assert h[1]==b'blob';size=int(h[2]);cursor=end+1
    entries['source/'+p]=batch[cursor:cursor+size];blobs[p]=h[0].decode();cursor+=size+1
assert cursor==len(batch)
for f in load('validated-inputs.json')+tested['files']:assert sha(normal(f['path'],entries['source/'+f['path']]))==f['sha256'],f['path']
for p in preservation['deleted']:assert 'source/'+p not in entries
patch=git('diff','--binary','--full-index',BASE,head);patchfile=OUT/'complete.patch';patchfile.write_bytes(patch)
assert OUT.resolve().is_relative_to(ROOT.resolve())
env={**os.environ,'GIT_INDEX_FILE':str(OUT/'patch-check.index')}
git('read-tree',BASE,env=env);git('apply','--cached','--binary',str(patchfile),env=env)
assert git('write-tree',env=env)==git('rev-parse',head+'^{tree}')
git('read-tree',head,env=env);git('apply','--cached','--reverse','--binary',str(patchfile),env=env)
assert git('write-tree',env=env)==git('rev-parse',BASE+'^{tree}')
identity=dict(task='FEEDBACK-001C2',base=BASE,head=head,tree=git('rev-parse','HEAD^{tree}').decode().strip(),branch=BRANCH,
              pushed=False,merged=False,unit=347,browser=browser,canonicalSourceFiles=len(paths),testedInputs=len(tested['files']),
              patch='Complete exact source trees reproduced forward/reverse in an isolated Git index')
entries['git/identity.json']=json.dumps(identity,indent=2).encode();entries['git/full.diff']=patch
entries['git/status.txt']=git('status','--short','--branch');entries['git/changed-files.txt']=git('diff','--name-status',BASE,head)
entries['git/log.txt']=git('log','--format=fuller',f'{BASE}..{head}')
for name in REPORTS:
    entries[name]=entries[f'source/docs/review/FEEDBACK-001C2/{name}']
    if name=='REPORT.md':entries[name]+=f'\nPackaged final commit: `{head}`.\n'.encode()
    (OUT/name).write_bytes(entries[name])
for p in OUT.iterdir():
    if p.is_file() and p.suffix in ['.json','.log'] and not p.name.endswith('-progress.json'):entries['evidence/'+p.name]=p.read_bytes()
for directory in ['full-browser','first-full','focused','focused-final','historical-fixed','first-focused-artifacts','first-full-artifacts']:
    for p in (OUT/directory).rglob('*'):
        if p.is_file() and p.suffix in ['.json','.log','.md','.png','.zip']:entries[f'evidence/{directory}/{p.relative_to(OUT/directory).as_posix()}']=p.read_bytes()
captures={};groups={}
for mode in ['baseline','final']:
    captures[mode]=load(f'{mode}/visuals/captures.json')
    assert len(captures[mode]['receipts'])==comparison['matchedProtectedScreenshotStates']
    for p in (OUT/mode/'visuals').iterdir():
        if p.is_file() and p.suffix in ['.png','.webm','.json']:entries[f'{mode}/visuals/{p.name}']=p.read_bytes()
for p in (OUT/'final/live').iterdir():
    if p.is_file() and p.suffix in ['.json','.webm']:entries['final/live/'+p.name]=p.read_bytes()
for p in (OUT/'final/live').glob('*'):
    if p.is_file() and p.suffix in ['.webm','.json']:entries['final/live/'+p.name]=p.read_bytes()
for r in captures['final']['receipts']:groups.setdefault(f"{r['scenario']}-{r['viewport']['width']}",[]).append(r)
e=lambda s:html.escape(s,quote=True)
sections=[]
for group,shots in groups.items():
    modes=[m for m in ['baseline','final'] if f'{m}/visuals/{group}.webm' in entries]
    videos=''.join(f'<figure><figcaption>{m.upper()} · silent actual input replay</figcaption><video controls preload="none" src="{m}/visuals/{group}.webm"></video></figure>' for m in modes)
    button='<button onclick="paired(this)">Play both from start</button>' if len(modes)==2 else ''
    pairs=[]
    for r in shots:
        figures=[]
        for m in ['baseline','final']:
            other=next(q for q in captures[m]['receipts'] if q['file']==r['file'])
            figures.append(f'<figure><figcaption>{m.upper()} · ENERGY {other["count"]}</figcaption><img loading="lazy" src="{m}/visuals/{e(r["file"])}"></figure>')
        pairs.append('<h4>'+e(r['shot'])+'</h4><div class="pair">'+''.join(figures)+'</div>')
    sections.append(f'<section><h3>{e(group)}</h3><p>Seed{shots[0]["seed"]}; Hybrid camera and identical bounded input tape. Baseline retains rejected guidance for comparison. Final has none. Collectibles differ; protected movement/hazards match.</p>{button}<div class="pair">{videos}</div><details><summary>Matched held gameplay states</summary>'+''.join(pairs)+'</details></section>')
links=' · '.join(f'<a href="{n}">{n}</a>' for n in REPORTS)
page=('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Space Runner · FEEDBACK-001C2 review</title>
<style>body{background:#07111e;color:#e0edf5;font:16px system-ui;margin:24px}p{max-width:1050px;line-height:1.55}a{color:#8ceaff}figure{margin:14px 0;min-width:0}figcaption,h3,h4{overflow-wrap:anywhere}video,img{width:100%;max-height:80vh;object-fit:contain;background:#030910}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}button,summary{cursor:pointer;padding:10px;background:#15293b;color:#d9faff;border:1px solid #398799}section{border-top:1px solid #304354;margin-top:24px;padding-top:16px}@media(max-width:700px){.pair{grid-template-columns:1fr}body{margin:12px}}</style>
<h1>Space Runner · FEEDBACK-001C2</h1><p>Rejected guidance removed; original crystals, occasional straight/curve/offset triples, bounded density and modest forgiveness. Real input-driven evidence; simulated pilots do not establish human satisfaction.</p><nav>'''+links+'''</nav><p><a href="git/identity.json">Exact Git identity</a> · <a href="git/full.diff">Complete binary diff</a></p><p>Matched12-minute reference:50→56 shards,50→52 groups. Inputs/hazards/3HP match. Four zero-input controls collect0. Fixed8 slots/reward1. See the balance report for censored pursuit deaths and limitations.</p><h2>Actual gameplay comparisons</h2><p>Manual playback only. Accelerated prefixes precede native-RAF final approaches. Silent full-page videos include HUD. Straight seed28, curve42 and offset291 collect3/3; curve stopping after its first pickup collects2/3. No ship/hazard/HP edits.</p>'''+''.join(sections)+'''<script>function paired(b){b.parentElement.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play().catch(()=>{})})}</script></html>''').encode()
entries['index.html']=page;(OUT/'index.html').write_bytes(page)
for n,b in entries.items():
    if n.startswith('git/'):
        p=OUT/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in ['href','src'] and v and not v.startswith(('#','http:','https:')):assert v in entries,v
Links().feed(page.decode())
if '--prepare-gallery' in sys.argv:
    print(json.dumps(dict(gallery=str(OUT/'index.html'),head=head,groups=len(groups),images=2*len(captures['final']['receipts']))));sys.exit(0)
gallery=load('gallery-review.json');assert gallery['passed'] and gallery['gallerySHA256']==sha(page)
entries['evidence/gallery-review.png']=(OUT/'gallery-review.png').read_bytes()
manifest={**identity,'files':[dict(path=n,bytes=len(b),sha256=sha(b)) for n,b in entries.items()]}
entries['manifest.json']=json.dumps(manifest,indent=2).encode()
entries['SHA256SUMS']=''.join(f'{sha(b)}  {n}\n' for n,b in entries.items()).encode()
destination=ROOT/'review-packages';destination.mkdir(exist_ok=True);path=destination/'FEEDBACK-001C2-review.zip'
with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for n,b in entries.items():z.writestr(n,b)
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None and len(z.namelist())==len(entries)
    for n,b in entries.items():assert z.read(n)==b,n
    for p,oid in blobs.items():
        b=z.read('source/'+p);assert hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()==oid,p
    for f in manifest['files']:assert sha(z.read(f['path']))==f['sha256']
assert not git('diff','--name-only','HEAD').strip()
receipt={**identity,'path':str(path),'bytes':path.stat().st_size,'sha256':sha(path.read_bytes()),'entries':len(entries),
         'verification':'ZIP CRC/all sizes and SHA256/every canonical Git blob SHA1/244 frozen native inputs/complete forward-reverse exact Git trees/gallery links passed'}
(destination/'FEEDBACK-001C2-review.json').write_text(json.dumps(receipt,indent=2),encoding='utf8');print(json.dumps(receipt,indent=2))
