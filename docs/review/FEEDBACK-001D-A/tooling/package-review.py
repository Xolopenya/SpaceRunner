"""Prepare a small source-referenced audit package; no production copy/build edits."""
from pathlib import Path
import datetime, hashlib, html, json, shutil, subprocess, sys, zipfile

ROOT = Path(__file__).resolve().parents[4]
REPORTS = ROOT / 'docs/review/FEEDBACK-001D-A'
RAW = ROOT / '.cache/review/FEEDBACK-001D-A'
STAGE = RAW / 'package'
BASE = '54d581958bdde8c5a4d7f9cbdf3ee7a4a7c4f054'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8').strip()

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def write(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(value, encoding='utf-8')

def dump(path, value):
    write(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def copy(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def prepare():
    facts = read(RAW/'facts.json')
    findings = read(REPORTS/'findings.json')
    captures = [read(RAW/f'{mode}.json') for mode in ['live','matrix','focused']]
    assert all(not c['errors'] for c in captures), 'Audit capture error remains'
    refs = ['src','public','index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','tests','playwright.config.ts','scripts']
    subprocess.run(['git','diff','--exit-code',BASE,'--',*refs], cwd=ROOT, check=True)
    entries = [line.split('\t',1) for line in git('ls-tree','-r',BASE,'--',*refs).splitlines()]
    protected = [{'path':p,'gitBlob':info.split()[2],'sha256':sha((ROOT/p).read_bytes())} for info,p in entries]
    metadata = {'task':'FEEDBACK-001D-A','base':BASE,'branch':git('branch','--show-current'),'auditHead':git('rev-parse','HEAD'),
        'date':'2026-11-16','timezone':'Asia/Vladivostok','productionDiffAgainstBase':'empty','protectedFiles':len(protected),
        'gitStatus':git('status','--short'),'initialStatusObserved':['?? .agents/skills/pragmatic-orchestration/','?? docs/game-design/GAMEPLAY_CONSILIUM.md','?? docs/game-design/consilium/','?? skills-lock.json'],
        'initialStatusNote':'Transcribed from the first read-only tool result; preserved throughout. Current status above is captured by Git.',
        'newExternalAssets':False,'remotePush':False,'deployment':False}
    dump(RAW/'metadata.json',metadata)
    dump(RAW/'production-preservation.json',{'base':BASE,'gitDiffExit':0,'files':protected})
    rows=['# Complete UX issue inventory','','Baseline and evidence methods: see [TESTING](TESTING.md). Priorities reflect this vertical slice; hypotheses are not proven player frustration. There are no observed P0 blockers.','','| ID | Priority | Category | Classification | Finding |','|---|---|---|---|---|']
    for f in findings:
        rows.append(f"| [{f['id']}](#{f['id'].lower()}) | {f['severity']} | {f['category']} | {f['classification']} | {f['title']} |")
    for f in findings:
        rows += ['',f"## {f['id']} — {f['title']}",'',f"**Priority:** {f['severity']} · **Category:** {f['category']} · **Class:** {f['classification']}",'']
        for key,label in [('observed','Observed'),('expected','Expected'),('repro','Reproduction'),('state','Relevant state'),('cause','Supported cause'),('subsystem','Affected subsystem'),('source','Source references'),('solution','Recommendation'),('complexity','Implementation complexity'),('confidence','Confidence'),('human','Human playtesting')]:
            rows += [f'**{label}:** {f[key]}','']
        rows += ['**Evidence:** '+', '.join(f'[{e}](evidence/{e})' for e in f['evidence']) + (f"; [timing video](evidence/{f['video']})" if 'video' in f else '')+'.','']
    rows += ['## Excluded future features','','Complex obstacle patterns, major procedural generation work, a full economy, final difficulty balancing, upgrades/progression and major collectible-system changes are intentionally postponed. Their absence is not a defect. No speculative feature backlog is included.','','## Positive coverage and uncertainty','','See HUD-AND-MENUS, GAMEPLAY-READABILITY and RESPONSIVE-ACCESSIBILITY for working behaviors. User frustration, higher retention, better comfort and improved comprehension have not been demonstrated by this automated audit. Boundary and feedback opportunities require human testing. Source excerpts are in source/SELECTED-EXCERPTS.md.']
    write(REPORTS/'UX-AUDIT.md','\n'.join(rows)+'\n')
    full=read(RAW/'full-browser/browser-results.json')
    follow=read(RAW/'audio-recheck/browser-results.json')
    fullstats=full['stats']; followstats=follow['stats']
    runrows='\n'.join(f"| {r['seed']} / {r['label']} | {r['gameplaySeconds']:.3f}s | {r['playWallSeconds']:.3f}s | {r['score']}m | {r['pickups']} | {r['hullAtEnd']} |" for r in facts['nativeRuns'])
    testing=f'''# Testing and evidence methods

Task FEEDBACK-001D-A; 16 November 2026, Asia/Vladivostok. Source `{BASE}`; branch `feature/feedback-001d-a-ux-audit`. Browser: installed Chrome {facts['browser'][0]['browser']}, headless on desktop Windows. Existing @playwright/test 1.64.1, Three.js 0.186.1, TypeScript and Vite from the locked repository. No dependency installation or external asset download.

## Command results

| Command | Result |
|---|---|
| `git status --short`, branch and HEAD inspection | Exact requested baseline; four unrelated untracked paths preserved |
| `git switch -c feature/feedback-001d-a-ux-audit` | Success after a narrow .git-write sandbox escalation; initial permission failure retained in conversation/tool record |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 347/347 passing, none skipped; 61.30s reported unit duration |
| `npm run build` | Exit 0; standard >500kB chunk advisory (863.45kB JS / 232.27kB gzip), not a measured loading defect |
| `npm run test:browser` with REVIEW_RESULT_DIR | {fullstats['expected']} passed / {fullstats['unexpected']} failed / {fullstats['skipped']} skipped; {fullstats['duration']/1000:.1f}s; full original receipt retained |
| `npm run test:browser` selecting the two affected `audio` cases | {followstats['expected']} passed / {followstats['unexpected']} failed; {followstats['duration']/1000:.1f}s after creating the output directory; exact command in logs, assertions/tests unchanged |
| `node docs/review/FEEDBACK-001D-A/tooling/audit-browser.mjs live` | Three real-time production sessions, no capture errors, page/console errors or failed requests |
| same tool, `matrix` | Eight primary sizes; pause/dialog/resume, pointer/touch, first hit, death/results/replay |
| same tool, `focused` | Bounds, mute/three saved sliders, focus loss, reduced motion, rotation, skip and small desktop hints |
| `node .../analyze-evidence.mjs` | Generated facts.json from final raw capture receipts |
| `git diff --exit-code {BASE} -- src public index.html package.json package-lock.json vite.config.ts tsconfig.json tests playwright.config.ts scripts` | Exit 0; {len(protected)} protected tracked inputs unchanged |
| `python .../package-review.py prepare` / `pack` | Package construction and independent ZIP CRC/SHA inventory verification; external SHA-256 sidecar |
| `node .../verify-gallery.mjs` | Actual offline gallery browser check; see gallery-verification.json / gallery-review.png |

The first full browser run failed two audio tests **when writing optional JSON artifacts**: `audio-live.json` and `audio-restarts.json` could not be created because this audit invocation had not created REVIEW_RESULT_DIR. This was audit setup, not a failed gameplay assertion. Original error contexts/screenshots/traces and complete JSON/log are retained. Creating the directory and rerunning those two unchanged tests verifies the affected paths. This is not described as a second all-green full-suite run. Failed-case IDs and errors are available in `full-browser/browser-results.json`.

The first capture invocation was blocked by sandbox network policy at localhost (`ERR_NETWORK_ACCESS_DENIED`). The original log/receipt is retained. Authorized local Chrome/Vite execution succeeded after escalation. No policy bypass or external network download was used. The first focused receipt captured reduced-motion death start under a misleading filename; a follow-up capture explicitly separates death start, completed results and restart. Both receipts/logs remain; use final focused.json for current evidence.

## Native play duration

| Seed / strategy | Gameplay duration | Wall time after launch (includes screenshots/results) | Distance | Pickups | Hull at stopping point |
|---|---|---|---|---|---|
{runrows}

Total native gameplay: **{sum(r['gameplaySeconds'] for r in facts['nativeRuns']):.3f}s**. Longest continuous run: **70.708s**, manually paused by automation. Idle seed 42 and certificate-informed keyboard pilot seed 123 ended naturally and were restarted. The collector reads shard approach positions; the pilot reads the existing certificate and maps it to discrete keys. They use the real InputManager and native requestAnimationFrame, without gameplay mutation or accelerated time. They are not human skill measurements. Two natural deaths, one longer surviving run, seven accepted damage events, three accepted pickups and multiple mine approaches were observed.

Eight matrix runs use the real production instance obtained by a temporary CDP click-listener breakpoint, then invoke original fixed updates/renders to accelerate idle waiting. This preserves actual spawned hazards/HP rules but is **not additional real-time playtime** and may change planning cadence. Event subscribers are attached after launch, so very early run-start/first-record events can precede observation; zero record-event entries are not evidence of missing model events. The result acknowledgement finding is supported by visible results and source. A single separately labelled DOM visibility fixture forces phase/damage messages visible only to inspect simultaneous geometry; it proves neither a phase transition nor a natural collision. The primary overlap proof is the native seed-42 collision.

## Coverage and screenshots

{facts['captureCount']} screenshots are catalogued with viewport, game state, hull, immunity, phase, energy, position, camera/boundary policy, audio state, element rectangles and method. Original JSON captures and gallery captions identify accelerated/fixture states. Videos are native silent WebM browser recordings; no soundtrack/listening claims. Inspect native clips for timing; matrix recordings contain accelerated prefixes/frozen frames and are labelled accordingly.

Primary viewports: 1920×1080, 1366×768, 1280×720, 1024×600, 390×844, 360×800, 932×430 and 768×1024. Additional 800×450 fine-pointer desktop and portrait→844×390 rotation. Existing UI/touch tests add emulated safe-area, pointer cancel, extreme numeric fit and keyboard/focus coverage. Synthetic blur exercises the actual production focus-loss handler. Existing damage tests cover hidden-tab cinematic suspension and WebGL loss/recovery. The full suite also covers optional asset failure/fallback; those deliberate failures are fixtures, not primary-session network defects.

All eight matrix pause checks hold exactly the same model elapsed time through settings; P in Audio leaves PAUSED, Escape closes it without resuming, and resume input velocity is zero in the sampled states. Captured main controls fit and meet 44×44px. Damage/phase bounding boxes intersect in seven primary sizes; short 932×430 landscape is the observed exception. Current tests can pass without detecting this child-element visual overlap, which explains why screenshot inspection matters.

## Performance observations and limits

Native RAF p95 was {facts['nativeRuns'][0]['raf']['p95']:.1f}/{facts['nativeRuns'][1]['raf']['p95']:.1f}/{facts['nativeRuns'][2]['raf']['p95']:.1f}ms; maxima {facts['nativeRuns'][0]['raf']['max']:.1f}/{facts['nativeRuns'][1]['raf']['max']:.1f}/{facts['nativeRuns'][2]['raf']['max']:.1f}ms. Raw samples are retained. Screenshot calls, CDP and the existing regression suite ran concurrently for part of this work. These are observational samples with outliers, not isolated benchmarks, no speedup, root-cause or phone-FPS claim. No SpectorJS/GPU capture was performed because no unexplained rendering defect warranted one.

No physical devices, mobile Safari/Firefox/Yandex webview, public-host cold load, true browser zoom, real notches/browser chrome, screen-reader user study, photosensitivity analysis or subjective listening was tested. No player-frustration/retention improvement is claimed.

## Skills actually applied

- Game Studio `game-playtest`: boot, main verbs, real motion, screenshots, overlay checks, severity/repro reporting.
- Game Studio `game-ui-frontend`: hierarchy, playfield protection, overlays/input boundaries, responsive target review, Concept A preservation.
- Game Studio `three-webgl-game`: separate camera projection, scene appearance, placement/timing and collision; inspect loader/render/resize/context behavior without replacing the approved runtime.
- Local `space-runner-ui-design`: current design/tokens/research, real-scene comparison, safe insets, focus, 44px targets and reduced-motion checks.

All four SKILL.md files were read. Game Studio did not expose a separate hosted playtest service in this session; its available skills were applied using the repository's installed Playwright/Chrome infrastructure. No external agent or subagent was used. No physics package, alternative test framework or art generation was installed or invoked. Production source, assets, dependencies and existing tests remain unchanged.
'''
    write(REPORTS/'TESTING.md',testing)
    for p in REPORTS.rglob('*'):
        if p.is_file(): copy(p,STAGE/p.relative_to(REPORTS))
    for folder in ['evidence','logs','full-browser','audio-recheck','initial-test-artifacts']:
        for p in (RAW/folder).rglob('*'):
            if p.is_file(): copy(p,STAGE/folder/p.relative_to(RAW/folder))
    for p in RAW.glob('*.json'): copy(p,STAGE/p.name)
    for p in ['gallery-verification.json','gallery-review.png','gallery-review-mobile.png']:
        if (RAW/p).exists(): copy(RAW/p,STAGE/p)
    designs=['UI_ART_DIRECTION.md','UI_CONCEPT_COMPARISON.md','UI_DESIGN_TOKENS.md','UI_REFERENCE_RESEARCH.md']
    for p in designs: copy(ROOT/'docs/design'/p,STAGE/'source/design'/p)
    copy(ROOT/'docs/ASSETS.md',STAGE/'source/ASSETS.md')
    excerpts=['# Selected source excerpts','','Canonical references use the audited Git commit, not the audit documentation commit. Source is unchanged. No full repository snapshot is included.','']
    for p,ranges in {'src/styles.css':[(1,21),(43,85),(108,120),(149,165),(204,233)],'src/ui.ts':[(46,120)],'src/game.ts':[(53,102),(130,190)],'src/input.ts':[(16,36),(58,93)],'src/audio/sound-panel.ts':[(17,59)],'src/config.ts':[(1,14)],'src/camera/flight-camera.ts':[(1,40),(65,82)],'src/world.ts':[(48,53),(88,94),(181,188),(211,230)],'src/visuals/arena-boundaries.ts':[(38,65)],'src/visuals/fragmented-warp.ts':[(7,17),(35,48)],'src/visuals/settings.ts':[(24,43)],'src/feedback/destruction-sequence.ts':[(1,32)],'src/collectibles/settings.ts':[(1,18)],'src/services/storage.ts':[(1,34)],'index.html':[(14,60)]}.items():
        lines=subprocess.check_output(['git','show',f'{BASE}:{p}'],cwd=ROOT).decode('utf-8').splitlines()
        excerpts += [f'## {p}','',f'[Canonical source](https://github.com/Xolopenya/SpaceRunner/blob/{BASE}/{p})','']
        for start,end in ranges:
            excerpts += ['```text',*[f'{i}: {lines[i-1]}' for i in range(start,min(end,len(lines))+1)],'```','']
    write(STAGE/'source/SELECTED-EXCERPTS.md','\n'.join(excerpts))
    copy(ROOT/'AGENTS.md',STAGE/'source/AGENTS.md')
    # A self-contained gallery; no network assets, libraries or external font requests.
    esc=html.escape
    reports=['EXECUTIVE-SUMMARY','UX-AUDIT','HUD-AND-MENUS','GAMEPLAY-READABILITY','FIRST-RUN-EXPERIENCE','RESPONSIVE-ACCESSIBILITY','DESIGN-DIRECTIONS','IMPLEMENTATION-ROADMAP','TESTING']
    page=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Space Runner · FEEDBACK-001D-A</title>',
      '<style>body{background:#07111f;color:#edf4f5;font:16px/1.6 system-ui,sans-serif;max-width:1180px;margin:auto;padding:28px}a{color:#8cdeeb}h1{line-height:1.2}nav{display:flex;flex-wrap:wrap;gap:10px 24px}article{border-top:1px solid #385066;padding:24px 0}small,.muted{color:#b4c5d5}.tag{display:inline-block;padding:3px 10px;background:#162839}.P1{color:#ffb17b}figure{margin:16px 0}img{max-width:100%;max-height:570px;object-fit:contain;background:#030914}video{width:100%;max-height:620px;background:#000}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}summary{cursor:pointer;color:#8cdeeb}button,select{font:inherit;padding:10px;color:#edf4f5;background:#162839;border:1px solid #526b81}button{cursor:pointer}.note{border-left:3px solid #8cdeeb;padding:12px 18px;background:#0c1b2e}a:focus-visible,button:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid white;outline-offset:4px}</style>',
      '<h1>Space Runner · UX audit</h1><p>FEEDBACK-001D-A · 16 November 2026 · audit only</p>',f'<p class="muted">Source {BASE}<br>Branch feature/feedback-001d-a-ux-audit · Chrome {esc(facts["browser"][0]["browser"])}</p>',
      '<div class="note">Production code is unchanged. Findings distinguish confirmed defects, usability hypotheses and design opportunities. There were no human participants or physical-device tests. Images are real game captures; explicitly labelled accelerated/DOM fixtures are not ordinary real-time play.</div>',
      '<h2>Reports</h2><nav>'+''.join(f'<a href="{p}.md">{p.replace("-"," ")}</a>' for p in reports)+'</nav>',
      '<p><a href="source/SELECTED-EXCERPTS.md">Numbered source excerpts</a> · <a href="metadata.json">Git metadata</a> · <a href="production-preservation.json">Production preservation</a> · <a href="facts.json">Measured facts</a></p>',
      '<h2>Findings by priority and category</h2><label>Category <select id="category"><option value="all">All categories</option>'+''.join(f'<option>{esc(c)}</option>' for c in sorted({f['category'] for f in findings}))+'</select></label> <button id="reset">Show all</button>']
    for severity in ['P0','P1','P2','P3']:
        subset=[f for f in findings if f['severity']==severity]
        page += [f'<h2>{severity} · {len(subset)} findings</h2>']
        if not subset: page += ['<p>No observed critical gameplay/navigation blocker.</p>']
        for f in subset:
            page += [f'<article data-category="{esc(f["category"])}" id="{f["id"]}"><span class="tag {severity}">{severity}</span> <span class="tag">{esc(f["category"])}</span><h3>{f["id"]} · {esc(f["title"])}</h3><p><strong>{esc(f["classification"])}</strong></p><p>{esc(f["observed"])}</p><p><strong>Reproduce:</strong> {esc(f["repro"])}</p><p><strong>Expected:</strong> {esc(f["expected"])}</p><div class="shots">']
            for e in f['evidence']:
                assert (STAGE/'evidence'/e).exists(),e
                s=next((s for c in captures for s in c['screenshots'] if s['path']==f'evidence/{e}'),None)
                caption=f'{s["viewport"]["width"]}×{s["viewport"]["height"]} · {s.get("state","MENU (pre-observer)")} · t={s.get("elapsed","—")} · hull={s.get("hull","—")} · {s["method"]}' if s else e
                page += [f'<figure><a href="evidence/{e}"><img loading="lazy" src="evidence/{e}" alt="{esc(f["id"]+": "+e)}"></a><figcaption><small>{esc(caption)}</small></figcaption></figure>']
            page += ['</div>']
            if 'video' in f: page += [f'<details><summary>Timing evidence (silent video)</summary><video controls preload="none" src="evidence/{esc(f["video"])}"></video><p>See TESTING for real-time versus accelerated methods.</p></details>']
            page += [f'<p><strong>Recommendation:</strong> {esc(f["solution"])}</p><p><small>{esc(f["confidence"])} · Human testing: {esc(f["human"])}</small></p><p><a href="UX-AUDIT.md#{f["id"].lower()}">Complete issue record, cause, source and effort</a></p></article>']
    page += ['<h2>Native playthroughs</h2>']
    for r in facts['nativeRuns']:
        video={42:'native-42-idle',0:'native-0-collector',123:'native-123-pilot'}[r['seed']]
        page += [f'<details><summary>Seed {r["seed"]}: {r["gameplaySeconds"]:.2f}s gameplay, {r["score"]}m, {r["pickups"]} pickups</summary><video controls preload="none" src="evidence/{video}.webm"></video></details>']
    page += ['<h2>All screenshots and state receipts</h2><details><summary>Open complete capture inventory</summary><ul>']
    for c in captures:
        for s in c['screenshots']:
            page += [f'<li><a href="{s["path"]}">{esc(s["path"])}</a> · {s["viewport"]["width"]}×{s["viewport"]["height"]} · {esc(s["method"])}</li>']
    page += ['</ul></details><p><a href="live.json">Native sessions</a> · <a href="matrix.json">Responsive matrix</a> · <a href="focused.json">Focused checks</a> · <a href="full-browser/browser-results.json">Full regression receipt (initial artifact-write failures retained)</a> · <a href="audio-recheck/browser-results.json">Affected audio recheck</a></p>',
      '<script>const s=document.querySelector("select");s.onchange=()=>document.querySelectorAll("article").forEach(a=>a.hidden=s.value!=="all"&&a.dataset.category!==s.value);document.querySelector("button").onclick=()=>{s.value="all";s.onchange()};</script></html>']
    write(STAGE/'index.html','\n'.join(page))
    print(json.dumps({'prepared':str(STAGE),'screenshots':facts['captureCount'],'protectedFiles':len(protected),'stats':fullstats,'recheck':followstats}))

def pack():
    prepare()
    inventory={p.relative_to(STAGE).as_posix():{'size':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in STAGE.rglob('*') if p.is_file() and p.name!='MANIFEST-SHA256.json'}
    dump(STAGE/'MANIFEST-SHA256.json',inventory)
    dest=ROOT/'review-packages/FEEDBACK-001D-A-review.zip'
    dest.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(STAGE.rglob('*')):
            if p.is_file(): z.write(p,p.relative_to(STAGE).as_posix())
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None,'CRC failure'
        assert set(z.namelist()) == set(inventory)|{'MANIFEST-SHA256.json'}
        for name,entry in inventory.items():
            data=z.read(name)
            assert len(data)==entry['size'] and sha(data)==entry['sha256'],name
    digest=sha(dest.read_bytes())
    write(dest.with_suffix('.zip.sha256'),f'{digest}  {dest.name}\n')
    receipt={'archive':str(dest),'bytes':dest.stat().st_size,'entries':len(inventory)+1,'crc':'pass','sha256Inventory':'pass','sha256':digest,'auditHead':git('rev-parse','HEAD')}
    dump(dest.with_suffix('.zip.verification.json'),receipt)
    print(json.dumps(receipt,indent=2))

if __name__=='__main__':
    {'prepare':prepare,'pack':pack}[sys.argv[1] if len(sys.argv)>1 else 'prepare']()
