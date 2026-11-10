"""Exact-HEAD VISUAL-007B review, complete-tree patch checks and SHA inventory."""
from pathlib import Path
import hashlib
import html
import io
import json
import os
import subprocess
import sys
import zipfile
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.cache/review/VISUAL-007B'
BASELINE='552740c3b8ae0927b2caff9c89f2fcc5b7ac897d'
BRANCH='feature/visual-007b-station-crystal-polish'
def git(*args,env=None):
    return subprocess.check_output(['git',*args],cwd=ROOT,env=env)
def sha(data):
    return hashlib.sha256(data).hexdigest()

before=json.loads((OUT/'before/captures.json').read_text())
after=json.loads((OUT/'after/captures.json').read_text())
font=ImageFont.truetype(str(ROOT/'public/assets/fonts/oxanium-medium.ttf'),22)
boards=OUT/'boards';boards.mkdir(exist_ok=True)
for name,shot in [('station','station-lower-close'),('energy','right-wing-fragment-inspect')]:
    board=Image.new('RGB',(1280,440),'#07121c');draw=ImageDraw.Draw(board)
    for col,source in enumerate(['before','after']):
        image=Image.open(OUT/source/f'{shot}.png').convert('RGB').resize((640,400),Image.Resampling.LANCZOS)
        board.paste(image,(col*640,40));draw.text((col*640+16,8),f'{source.upper()} · {shot}',font=font,fill='#c7e5ed')
    board.save(boards/f'{name}.png')
shot='right-wing-fragment-inspect'
projection=next(r['projection'] for r in after['receipts'] if r['name']==shot)
if projection:
    board=Image.new('RGB',(640,360),'#07121c');draw=ImageDraw.Draw(board)
    for col,source in enumerate(['before','after']):
        image=Image.open(OUT/source/f'{shot}.png').convert('RGB')
        x,y=projection['x'],projection['y'];image=image.crop((round(x-80),round(y-80),round(x+80),round(y+80))).resize((320,320),Image.Resampling.NEAREST)
        board.paste(image,(col*320,40));draw.text((col*320+12,8),f'{source.upper()} · 2x crop',font=font,fill='#c7e5ed')
    board.save(boards/'energy-crop.png')

sections=[]
for row in after['receipts']:
    name=row['name'];assert (OUT/'before'/f'{name}.png').exists()
    sections.append(f'<section><h2>{html.escape(name)}</h2><div class="pair">'+''.join(f'<figure><figcaption>{source.upper()}</figcaption><img loading="lazy" src="{source}/{name}.png"></figure>' for source in ['before','after'])+'</div></section>')
videos=''.join(f'<figure><figcaption>{p.stem}</figcaption><video controls preload="metadata" src="after/{p.name}"></video></figure>' for p in sorted((OUT/'after').glob('*.webm')))
page='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Space Runner · VISUAL-007B</title>
<style>body{background:#07121c;color:#d8e7ed;font:16px system-ui;margin:24px}h1,a{color:#89dce6}h2{font-size:18px;margin-top:32px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{margin:8px 0}img,video{width:100%;height:auto}video{max-width:900px}p{max-width:1000px;line-height:1.5}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<h1>Space Runner · VISUAL-007B</h1><p>007A baseline → lighter station materials and a contained energy shard. Mine, station geometry and gameplay contracts are preserved. Matched production gameplay: same seed, steering inputs and simulation ticks; no inserted entities or model state edits. Orientation stills pause simulation. Clips use native browser recordings with accelerated prefix holds and keyframe-aligned trims. Automated pilot, not owner approval.</p>
<p><a href="evidence/preservation.json">Preservation receipt</a> · <a href="evidence/geometry.json">Geometry costs</a> · <a href="evidence/before-performance.json">Before performance</a> · <a href="evidence/after-performance.json">After performance</a></p>'''
evidence=OUT/'evidence';evidence.mkdir(exist_ok=True)
for name in ['preservation.json','geometry.json','before-performance.json','after-performance.json']:
    if (OUT/name).exists():(evidence/name).write_bytes((OUT/name).read_bytes())
(OUT/'compare.html').write_text(page+''.join(sections)+'<h2>Gameplay videos</h2>'+videos,encoding='utf-8')
if '--compare-only' in sys.argv:
    print(OUT/'compare.html');raise SystemExit(0)

head=git('rev-parse','HEAD').decode().strip()
assert git('branch','--show-current').decode().strip()==BRANCH
git('merge-base','--is-ancestor',BASELINE,head)
assert not git('diff','--name-only','HEAD').strip(),'Commit tracked changes first'
verification=json.loads((OUT/'verification.json').read_text())
assert verification['unit']==305 and verification['browserExpected']==107
browser=json.loads((OUT/'browser-results.json').read_text())
assert browser['stats']['expected']==107 and all(browser['stats'][k]==0 for k in ['unexpected','flaky','skipped'])
remote=json.loads((OUT/'remote.json').read_text());assert remote['head']==head and remote['branch']==BRANCH
patch=git('diff','--binary','--full-index',BASELINE,head)
scratch=OUT/f'patch-{head[:7]}';scratch.mkdir(exist_ok=True)
patch_path=scratch/'complete.patch';patch_path.write_bytes(patch)
env={**os.environ,'GIT_INDEX_FILE':str(scratch/'audit.index')}
git('read-tree',BASELINE,env=env)
git('apply','--cached','--check','--binary',str(patch_path),env=env)
git('apply','--cached','--binary',str(patch_path),env=env)
assert git('write-tree',env=env)==git('rev-parse',f'{head}^{{tree}}')
git('apply','--cached','--reverse','--check','--binary',str(patch_path),env=env)
git('apply','--cached','--reverse','--binary',str(patch_path),env=env)
assert git('write-tree',env=env)==git('rev-parse',f'{BASELINE}^{{tree}}')
patch_receipt={'baseline':BASELINE,'head':head,'forward':'complete HEAD tree exact','reverse':'complete baseline tree exact','realIndexUntouched':True}
(OUT/'patch-verification.json').write_text(json.dumps(patch_receipt,indent=2))

entries={}
# Windows git archive applies checkout EOL conversion to some text blobs.
# Read canonical objects directly so licenses and every source byte match HEAD.
paths=git('ls-tree','-r','--name-only',head).decode().splitlines()
specs='\n'.join(f'{head}:{path}' for path in paths)+'\n'
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=specs.encode())
cursor=0
for path in paths:
    assert not path.startswith(('node_modules/','dist/','.cache/','review-packages/'))
    end=batch.index(b'\n',cursor);header=batch[cursor:end].split();assert header[1]==b'blob'
    size=int(header[2]);cursor=end+1
    entries[f'source/{path}']=batch[cursor:cursor+size];cursor+=size+1
assert cursor==len(batch)
inputs=json.loads((OUT/'validated-inputs.json').read_text())
for item in inputs:
    data=entries[f"source/{item['path']}"]
    if item['text']:data=data.replace(b'\r\n',b'\n')
    assert sha(data)==item['sha256'],item['path']
for folder in ['before','after','boards','evidence','historical']:
    for path in (OUT/folder).glob('*'):
        if path.is_file():entries[f'{folder}/{path.name}']=path.read_bytes()
for path in OUT.glob('*'):
    if path.is_file() and path.suffix in ['.json','.log']:entries[f'evidence/{path.name}']=path.read_bytes()
entries['compare.html']=(OUT/'compare.html').read_bytes()
entries['baseline-to-head.patch']=patch
entries['patch-verification.json']=json.dumps(patch_receipt,indent=2).encode()
manifest={'task':'VISUAL-007B','baseline':BASELINE,'head':head,'branch':BRANCH,'remote':remote,'sourceInputsMatch':True,'unit':305,'browser':browser['stats'],'files':[]}
for name,data in entries.items():manifest['files'].append({'path':name,'bytes':len(data),'sha256':sha(data)})
entries['manifest.json']=json.dumps(manifest,indent=2).encode()
directory=ROOT/'review-packages';directory.mkdir(exist_ok=True)
output=directory/f'VISUAL-007B-review-{head[:7]}.zip'
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name,data in entries.items():archive.writestr(name,data)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist())==len(manifest['files'])+1
    for item in manifest['files']:
        data=archive.read(item['path']);assert len(data)==item['bytes'] and sha(data)==item['sha256']
receipt={'path':str(output),'head':head,'baseline':BASELINE,'bytes':output.stat().st_size,'sha256':sha(output.read_bytes()),'entries':len(entries),'crc':'passed','inventory':'all SHA256 and sizes passed','patch':patch_receipt}
(directory/f'VISUAL-007B-review-{head[:7]}.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt,indent=2))
