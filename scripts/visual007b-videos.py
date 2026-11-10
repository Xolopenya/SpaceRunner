"""Trim loading/accelerated-prefix holds from native Playwright recordings.

No generated frames or speed changes: request a stream copy from one second
before the distance HUD changes from zero. Earlier keyframe lead may remain.
Originals remain in ignored cache.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1]
out = root / '.cache/review/VISUAL-007B'
exe = root / '.cache/playwright/ffmpeg-1013/ffmpeg-win64.exe'
checks = out / 'video-checks'
originals = out / 'untrimmed-video'
checks.mkdir(exist_ok=True)
originals.mkdir(exist_ok=True)

def run(args):
    return subprocess.run([str(exe), *map(str,args)], capture_output=True)

def duration(path):
    meta = run(['-hide_banner','-i',path]).stderr.decode(errors='replace')
    match = re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta)
    assert match, meta
    h,m,s = map(float,match.groups())
    return h*3600+m*60+s

def frame(path,t,tag):
    target = checks / f'{tag}.png'
    r = run(['-v','error','-ss',t,'-i',path,'-frames:v','1','-y',target])
    assert r.returncode == 0 and target.exists(), r.stderr
    return Image.open(target).convert('RGB')

rows=[]
previous=json.loads((out/'video-validation.json').read_text()) if (out/'video-validation.json').exists() else {}
delivered={r['path']:r['sha256'] for r in previous.get('rows',[])}
for source in ['before','after']:
    for path in (out/source).glob('*.webm'):
        tag=f'{source}-{path.stem}'
        original=originals/f'{tag}.webm'
        # A newly captured bundle must replace an older cached original. A
        # repeated validation of the same delivered clip remains idempotent.
        if not original.exists() or delivered.get(str(path.relative_to(root)))!=hashlib.sha256(path.read_bytes()).hexdigest():
            shutil.copyfile(path,original)
        full=duration(original)
        reference=frame(original,3,f'{tag}-reference').crop((970,30,1104,68)).convert('L').point(lambda p:255 if p>170 else 0)
        def changed(t):
            sample=frame(original,t,f'{tag}-probe').crop((970,30,1104,68)).convert('L').point(lambda p:255 if p>170 else 0)
            return sum(p>0 for p in ImageChops.difference(reference,sample).tobytes())>200
        lo=3
        while lo+2<full and not changed(lo+2):
            lo+=2
        hi=min(lo+2,full-.5)
        assert changed(hi), f'No actual nonzero-distance segment in {path}'
        while hi-lo>.25:
            mid=(lo+hi)/2
            if changed(mid): hi=mid
            else: lo=mid
        start=max(0,lo-1)
        result=run(['-v','error','-y','-ss',start,'-i',original,'-map','0:v:0','-c','copy',path])
        assert result.returncode==0,result.stderr
        length=duration(path)
        samples=[]
        for frac in [.1,.5,.9]:
            image=frame(path,length*frac,f'{tag}-{frac}')
            assert image.width==1280 and image.height==800
            samples.append({'seconds':length*frac,'width':image.width,'height':image.height})
        rows.append({'path':str(path.relative_to(root)),'originalDuration':full,'requestedTrimStart':start,'durationSeconds':length,
                     'originalSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'samples':samples})
        print(source,path.stem,round(full,2),'->',round(length,2),flush=True)
(out/'video-validation.json').write_text(json.dumps({'method':'Native browser recordings; stream-copy trim requested one second before the HUD distance changes. Keyframe alignment can retain an earlier prefix hold. No synthetic frames, speed changes or gameplay edits. Three PNG samples decoded from each delivered video at 10%, 50%, 90%. Original complete recordings retained locally.', 'rows':rows},indent=2))
