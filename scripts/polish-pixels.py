from PIL import Image, ImageChops
from pathlib import Path
import json
folder=Path('.cache/review/GAMEPLAY-005B2/final/media')
rows=[]
for p in folder.glob('*before.png'):
    q=p.with_name(p.name.replace('before','after'))
    if not q.exists(): continue
    d=ImageChops.difference(Image.open(p).convert('RGB'),Image.open(q).convert('RGB'))
    r,g,b=d.split();m=ImageChops.lighter(r,ImageChops.lighter(g,b));h=m.histogram()
    rows.append({'name':p.name,'bounds':d.getbbox(),'pixelsOver3':sum(h[4:]),'maxChannel':max(i for i,v in enumerate(h) if v)})
Path('.cache/review/GAMEPLAY-005B2/final/corridor-pixels.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('Compared actual PNG pairs:',len(rows))
