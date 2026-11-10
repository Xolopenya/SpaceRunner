"""Create a local comparison and exact-HEAD review ZIP without user files/builds."""
from pathlib import Path
import hashlib
import html
import json
import subprocess
import zipfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/review/VISUAL-007A'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def digest(data):
    return hashlib.sha256(data).hexdigest()

names = ['mine-close', 'mine-warning', 'mine-idle', 'structure-approach',
         'aperture-passage', 'structure-asteroids', 'structure-collectible']
board_dir = OUT / 'boards'
board_dir.mkdir(exist_ok=True)
font = ImageFont.truetype(str(ROOT / 'public/assets/fonts/oxanium-medium.ttf'), 22)
for name, shot in [('mine','mine-close'), ('station','aperture-passage')]:
    board = Image.new('RGB', (1280, 440), '#07121c')
    draw = ImageDraw.Draw(board)
    for column, source in enumerate(['before','after']):
        image = Image.open(OUT / source / f'{shot}.png').convert('RGB')
        image = image.resize((640,400), Image.Resampling.LANCZOS)
        board.paste(image, (column*640,40))
        draw.text((column*640+16,8), f'{source.upper()} · {shot}', font=font, fill='#c7e5ed')
    board.save(board_dir / f'{name}.png')
sections = []
for name in names:
    sections.append(f'<section><h2>{html.escape(name)}</h2><div class="pair">'
                    f'<figure><figcaption>Before · d5b02d8</figcaption><img src="before/{name}.png"></figure>'
                    f'<figure><figcaption>After · VISUAL-007A</figcaption><img src="after/{name}.png"></figure>'
                    '</div></section>')
videos = ''.join(f'<figure><figcaption>{name}</figcaption><video controls preload="metadata" src="after/{name}.webm"></video></figure>'
                 for name in ['mine-flight', 'station-flight', 'mixed-flight', 'integrated-flight'])
page = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Space Runner · VISUAL-007A review</title><style>
body{background:#07121c;color:#d8e7ed;font:16px system-ui;margin:24px}h1{color:#89dce6}h2{font-size:18px;margin-top:32px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{margin:8px 0;color:#adc6d0}img,video{width:100%;height:auto}
video{max-width:900px}p{max-width:960px;line-height:1.5}a{color:#89dce6}@media(max-width:700px){.pair{grid-template-columns:1fr}}
</style><h1>Space Runner · VISUAL-007A</h1><p>Matched production gameplay captures with identical seed, steering inputs and simulation ticks. Original screenshots are unretouched. Native browser videos use accelerated prefixes followed by real-time fixed-step playback; viewport stills pause simulation for orientation changes. Automated pilot, not owner acceptance.</p>
<p><a href="evidence/preservation.json">State/source preservation</a> · <a href="evidence/before-performance.json">Before measurements</a> · <a href="evidence/after-performance.json">After measurements</a></p>'''
# Local and ZIP comparison use the same relative evidence paths.
for filename in ['preservation.json', 'before-performance.json', 'after-performance.json']:
    target = OUT / 'evidence' / filename
    target.parent.mkdir(exist_ok=True)
    if (OUT / filename).exists():
        target.write_bytes((OUT / filename).read_bytes())
(OUT / 'compare.html').write_text(page + ''.join(sections) + '<h2>Gameplay videos</h2>' + videos, encoding='utf-8')

if '--compare-only' in __import__('sys').argv:
    print(OUT / 'compare.html')
    raise SystemExit(0)

head = git('rev-parse', 'HEAD').decode().strip()
branch = git('branch', '--show-current').decode().strip()
assert branch == 'codex/visual-007a-mine-structure-polish'
assert not git('diff', '--name-only', 'HEAD').strip(), 'Commit tracked changes before packaging'
files = git('ls-tree', '-r', '--name-only', 'HEAD').decode().splitlines()
assert 'src/visuals/mine-shell.ts' in files
package_dir = ROOT / 'review-packages'
package_dir.mkdir(exist_ok=True)
package = package_dir / f'VISUAL-007A-{head[:7]}.zip'
manifest = {'commit': head, 'branch': branch, 'baseline': git('rev-parse','d5b02d8').decode().strip(), 'files': []}
entries = {}
for name in files:
    assert not name.startswith(('node_modules/', 'dist/', '.cache/'))
    entries[f'source/{name}'] = git('show', f'HEAD:{name}')
for folder in ['before', 'after', 'evidence', 'boards']:
    for path in (OUT / folder).glob('*'):
        if path.is_file():
            entries[f'{folder}/{path.name}'] = path.read_bytes()
for path in OUT.glob('*'):
    if path.is_file() and path.suffix in ['.json', '.log']:
        entries[f'evidence/{path.name}'] = path.read_bytes()
entries['compare.html'] = (OUT / 'compare.html').read_bytes()
entries['source-diff.patch'] = git('diff', '--binary', 'd5b02d8', 'HEAD')
for name, data in entries.items():
    manifest['files'].append({'path': name, 'bytes': len(data), 'sha256': digest(data)})
entries['manifest.json'] = json.dumps(manifest, indent=2).encode()
with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in entries.items():
        archive.writestr(name, data)
with zipfile.ZipFile(package) as archive:
    assert archive.testzip() is None
    for entry in manifest['files']:
        assert digest(archive.read(entry['path'])) == entry['sha256']
    assert len(archive.namelist()) == len(manifest['files']) + 1
receipt = {'path': str(package), 'commit': head, 'files': len(entries),
           'bytes': package.stat().st_size, 'sha256': digest(package.read_bytes()),
           'verification': 'All entries decoded, CRC and per-file SHA256 matched; source read from Git HEAD, untracked user files excluded.'}
(package_dir / f'VISUAL-007A-{head[:7]}.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt, indent=2))
