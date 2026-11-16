from pathlib import Path
import subprocess,json,hashlib,zipfile,shutil,html,sys
ROOT=Path(__file__).resolve().parents[3];D=ROOT/'.cache/review/FEEDBACK-001D-B';DOC=ROOT/'docs/review/FEEDBACK-001D-B';STAGE=D/'package';BASE='54d581958bdde8c5a4d7f9cbdf3ee7a4a7c4f054'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT).decode('utf-8').strip()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf-8')
def copy(a,b):b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(a,b)
def sha(b):return hashlib.sha256(b).hexdigest()
def prepare():
 stats=read(D/'acceptance/browser-results.json')['stats'];caps=read(D/'captures.json');inputs=read(D/'input-captures.json');perf=read(D/'performance.json')
 assert stats['expected']+stats.get('flaky',0)==131 and stats['unexpected']==0 and stats['skipped']==0,stats
 assert (D/'performance.json').stat().st_mtime >= (D/'acceptance/browser-results.json').stat().st_mtime,'Wait for isolated performance repeat'
 changed=git('diff','--name-only',BASE).splitlines();changed+=['src/ui-input-hints.ts'] if 'src/ui-input-hints.ts' not in changed else []
 allowed={'index.html','src/styles.css','src/ui.ts','src/game.ts','src/ui-input-hints.ts','tests/browser/ui.spec.ts','tests/browser/audio.spec.ts','tests/browser/desktop.spec.ts'}
 unexpected=[p for p in changed if (p.startswith('src/') or p.startswith('public/') or p.startswith('tests/') or p.startswith('package')) and p not in allowed];assert not unexpected,unexpected
 meta={'base':BASE,'finalCommit':git('rev-parse','HEAD'),'branch':git('branch','--show-current'),'status':git('status','--short'),'changed':changed,'scopeGuard':'pass','fullBrowserStats':stats}
 write(D/'metadata.json',json.dumps(meta,indent=2))
 reports={
 'REPORT.md':'''# FEEDBACK-001D-B

Implemented UX-01/02/03/10 within Concept A. Hull owns a compact status stack: energy, persistent phase, then one transient slot. Damage/protection suppress the phase announcement; permanent phase stays visible. Existing shield/health/camera/physics/audio/collection/boundary systems are unchanged. A 48px transparent event slot prevents message-induced movement. No panel or continuously animated decoration was added.

Player copy is PHASE 1 · Normal flight / PHASE 2 · Dangerous sector, with a three-gameplay-second Faster flight ahead announcement. The phase2 speed change is real; thresholds and scheduling remain untouched. Exact data-speed/data-gap diagnostic attributes remain for existing diagnostics/tests. Audio footer now says Adjust music and sound effects independently.

InputHints observes pointer capability and actual input without consuming events. No sensitivity, pointer capture, focus or gameplay input logic changed. Result/menu navigation, collectible onboarding and boundary experiments remain deferred to C/D/E. No external assets, dependencies, push or merge. The only additional test maintenance is readiness waits in four existing browser scenarios, justified by retained failure receipts; no assertion was weakened.

Visual evidence uses matched original production seed42/input/tick states; scene/HP/ship coordinates agree before/after at normal/phase/hit samples. Separate input context images compare UI capability, not exact moving-world poses. Human comfort and device performance are unverified.
''',
 'HUD-ARCHITECTURE.md':'''# HUD architecture

The existing HUD grid retains hull at left, distance at right and pause. A relative hull-instruments anchor owns hud-status below hull, using intrinsic layout instead of independent phase/damage top offsets. Energy and current phase are permanent rows. A bounded transparent hud-event region contains either damage/protection or the phase notice. It does not move the permanent rows or buttons.

Priority is deterministic: active invulnerability displays the existing damage/protection message and suppresses phase notice; phase notice may return only within its original three-second window. No queue, callbacks or wall timers. Hull count/pips still show critical state. The current phase label stays visible throughout damage. All timing uses model.elapsed/invulnerability; pause stops that clock. run.started resets the window and transient presentation, preventing a stale new-run announcement. No DOM rectangles are measured at runtime.

Phase nodes are cached; text writes use the existing change-only helper. Input observation has one AbortController owned/disposed by Game. Existing gameplay event architecture and orchestration priorities are retained. Portrait/short landscape use the same hierarchy and smaller existing type scale. Nine geometry tests inspect actual rendered leaf rectangles, clipping, pause/resume and restart after natural accepted damage. Existing center reservation and safe-area tests remain unchanged.
''',
 'INPUT-HINTS.md':'''# Input hints

Initial preference comes from matchMedia('(pointer: coarse)'). Touch pointerdown chooses touch copy; mouse/pen chooses desktop copy. A supported steering/pause/mute keyboard key chooses desktop copy. A real pointer capability change refreshes the default. Browser viewport resizing changes composition, not input preference. No supported control is disabled.

Touch mode shows drag instructions and hides keyboard-only auxiliary menu/pause shortcuts. Desktop mode retains WASD/arrows and actual keyboard pause/mute hints, even at 800x450. Hybrid users can switch by keyboard, touch or mouse without reloading. Observers never preventDefault, stopPropagation or modify axes. InputManager is byte unchanged. Observer listeners use an AbortController and are removed in Game.dispose.

Existing touch, pointer-capture/cancel, mouse, keyboard and focus tests remain. The new hybrid regression changes keyboard/touch/mouse while resizing from portrait to compact desktop. Physical convertible laptops/tablets remain untested. There is no added tutorial or fragment teaching.
''',
 'VISUAL-REVIEW.md':'''# Visual review

Open index.html for labelled matched comparisons at 1920x1080, 1366x768, 1280x720, 1024x600, 390x844, 360x800, 932x430, 768x1024 and 800x450. Original production seed42 is advanced with neutral input to identical simulation ticks. Normal, phase and accepted-hit coordinates/HP/elapsed match. Phase2 without damage is captured before the first hit; hit frames show suppression while the persistent phase stays readable. A two-second native-RAF post-contact segment covers critical hull. Accelerated prefixes are not ordinary continuous playtime.

Before captures reproduce Hull hit through the phase label. After captures separate energy, current phase and damage vertically with aligned left anchors and no panel. Automatic leaf-rectangle tests detect intersection/clipping rather than checking CSS declarations. Existing viewport center tests remain active. Separate coarse-pointer menu/flight images demonstrate touch instructions; keyboard/mouse switching is tested and pictured. Audio screenshots expose the corrected footer.

Typography, palette, hull pips, numerical hierarchy, pause target and scene remain recognizable. Small peripheral labels still need human glance testing. No claim that these changes improve retention or novice performance. True browser zoom at 125%/200% and physical notches/devices were not independently validated; smaller viewports are not claimed as zoom tests. Reduced motion, orientation, large scores and safe-area emulation remain covered by existing browser tests.
''',
 'TESTING.md':f'''# Testing

Base {BASE}; branch {meta['branch']}; final identity in metadata.json. Game Studio game-ui-frontend and game-playtest applied, plus local space-runner-ui-design. Skills were read in this conversation; available tooling is the repository's Playwright/Chrome, not a separate hosted Game Studio service. No subagents.

347 unit tests pass. Typecheck and final production build pass (see logs). Existing 121 browser tests are retained, plus ten new cases (nine viewport natural-damage/lifecycle tests and one hybrid input/settings test). Full run: {stats['expected']} first-attempt passes / {stats.get('flaky',0)} passed on retry / {stats['unexpected']} failed / {stats['skipped']} skipped, duration {stats['duration']/1000:.1f}s. Full artifacts output directory was created before launch. Focused receipts and any final follow-up are included separately; logs are authoritative.

Commands: npm run typecheck; npm test; npm run build; npm run test:browser -- --project=ui; final full run: npm run test:browser -- --workers=2 --retries=1 --output=.cache/review/FEEDBACK-001D-B/acceptance-artifacts. REVIEW_RESULT_DIR points to a pre-created per-run folder. Earlier one/two-worker receipts and startup failures are retained. capture.mjs builds matched evidence from frozen baseline and final production previews; input-capture.mjs covers actual coarse/hybrid capability; performance.mjs runs sequential native frame/reset comparison. Review scripts need local Chrome/Vite permission. No production test hook is shipped.

An initial full run reused a preview owned by a concurrent focused run, then lost that server; it was interrupted and its original log is retained. A preview start conflict was diagnosed, the task-owned hung preview was restarted, and the entire suite was repeated. Assertions were not relaxed.

A complete two-worker run then reported 128 passed and three existing-case failures: aborted sample requests in the console fixture and a DEV audio-object readiness error after reload. That receipt and original failure attachments are retained in final-full and failed-artifacts. A single-worker repeat then reached 130/131, reproducing early disposal of an offline fixture while sample requests were pending. Four test-only readiness waits now finish sample loading before teardown/disposal and wait for the DEV instance after reload. All original assertions remain. The final count above is the subsequent full two-worker run on those corrected fixtures, without concurrent builds/captures/benchmarks. Production audio and input remain unchanged.

An initial build encountered invalid UTF-8 introduced while editing presentation copy; encoding was corrected and final build succeeds. The original failure log is retained. The baseline freeze helper initially used a wrong CLI path; corrected absolute local Vite path succeeded. No gameplay defect was concealed or assertion weakened.

All screenshots use actual WebGL and DOM. Fixed-step continuations are accelerated and state-matched; the short post-contact clip uses native RAF. Input captures use ordinary pointer/touch launch. No physical phones, other browser engines, true browser zoom, photosensitivity analysis or human listening/UX study. No manual human playtest claimed.
''',
 'PERFORMANCE.md':'# Performance\n\nSequential 600-native-frame baseline/final production measurements and ten UI restarts per version are retained in performance.json. No per-frame layout measurement, new animation loop, timer queue, framework, shader or asset. HUD observer adds three listeners, owned by an AbortController; Game.dispose removes them. Compare actual CDP counters below rather than equating arbitrary DOM counter values to leaks. No unrelated frame anomaly is claimed fixed. Desktop Chrome sample is not a phone guarantee.\n\n'
 }
 reports['PERFORMANCE.md']+='Viewport: 1280x800 desktop. A preliminary concurrent-load sample is retained separately and is excluded from the final comparison below. The final performance receipt was written after the completed 131-case browser report. No speedup or phone-FPS claim. Raw counters and frame series: performance.json.\n\n| Version | RAF p95 ms | Update/render p95 ms | CDP DOM nodes over 10 resets | Listeners over 10 resets | Listeners after disposal |\n|---|---|---|---|---|---|\n'
 for row in perf['rows']:
  p=lambda a:sorted(a)[int(len(a)*.95)]
  nodes=[c['nodes'] for c in row['counters']];listeners=[c['jsEventListeners'] for c in row['counters']]
  reports['PERFORMANCE.md']+=f"| {row['mode']} | {p(row['measure']['gaps']):.2f} | {p(row['measure']['cost']):.2f} | {min(nodes)}–{max(nodes)} | {min(listeners)}–{max(listeners)} | {row['disposed']['jsEventListeners']} |\n"
 for name,body in reports.items():write(DOC/name,body)
 for p in DOC.glob('*'):
  if p.is_file():copy(p,STAGE/p.name)
 for folder in ['evidence','logs','full','focused','final-ui','final-full','serial-full','verified-full','acceptance']:
  for p in (D/folder).rglob('*'):
   if p.is_file():copy(p,STAGE/folder/p.relative_to(D/folder))
 for folder in ['full-artifacts','final-full-artifacts','serial-full-artifacts','verified-full-artifacts','acceptance-artifacts']:
  for context in (D/folder).rglob('error-context.md'):
   for p in context.parent.iterdir():
    if p.is_file():copy(p,STAGE/'failed-artifacts'/folder/p.relative_to(D/folder))
 for name in ['metadata.json','captures.json','input-captures.json','performance.json','preservation.json']:copy(D/name,STAGE/name)
 diff=subprocess.check_output(['git','diff','--binary',BASE],cwd=ROOT);write(STAGE/'complete.patch',diff.decode('utf-8'))
 for p in allowed:
  if (ROOT/p).exists():copy(ROOT/p,STAGE/'source'/p)
 copy(ROOT/'docs/TASKS.md',STAGE/'source/docs/TASKS.md')
 if (D/'gallery-verification.json').exists():copy(D/'gallery-verification.json',STAGE/'gallery-verification.json')
 for name in ['gallery-review.png','gallery-mobile.png']:
  if (D/name).exists():copy(D/name,STAGE/name)
 pairs=[]
 for a in caps['rows']+inputs['rows']:
  if a['mode']!='after':continue
  b=next(r for r in caps['rows']+inputs['rows'] if r['mode']=='before' and r['path']==a['path'].replace('after-','before-',1)) if 'hybrid-' not in a['path'] else None
  if b:pairs.append((b,a))
 lead=['after-1280x720-hit.png','after-390x844-hit.png','after-800x450-input-menu.png','after-1280x720-phase.png','after-390x844-input-menu.png','after-1280x720-audio.png']
 pairs.sort(key=lambda pair:lead.index(pair[1]['path']) if pair[1]['path'] in lead else 999)
 out=['<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FEEDBACK-001D-B</title><style>body{font:16px/1.5 system-ui;background:#07111f;color:#edf4f5;margin:24px}a{color:#8cdeeb}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}img,video{max-width:100%;max-height:650px}section{border-top:1px solid #496070;margin-top:24px}</style><h1>FEEDBACK-001D-B · HUD readability</h1><p>Real production rendering. Fixed input/tick pairs; coarse-pointer UI comparisons separately labelled. No human/device approval claimed.</p>','<nav>'+ ' · '.join(f'<a href="{n}">{n}</a>' for n in reports)+'</nav>']
 for b,a in pairs:
  out.append(f'<section><h2>{html.escape(a["path"].removeprefix("after-").removesuffix(".png"))}</h2><div class="pair">')
  for r in [b,a]:
   profile='touch/coarse' if r.get('touch') else 'fine pointer'
   state='MENU' if 'menu' in r['label'] else 'PAUSED' if r['label']=='audio' else 'PLAYING'
   out.append(f'<div><p>{r["mode"]} · {r.get("viewport",str(r.get("width"))+"x"+str(r.get("height")))} · {profile} · {state} · t={r.get("elapsed","UI comparison")} · phase={r.get("phase","—")} · hull={r.get("hull","—")}</p><a href="evidence/{r["path"]}"><img loading="lazy" src="evidence/{r["path"]}" alt="{r["path"]}"></a></div>')
  out.append('</div></section>')
 out+=['<h2>Hybrid method switches</h2>']
 for r in inputs['rows']:
  if r['label'].startswith('hybrid-'):out.append(f'<p>{r["width"]}x{r["height"]} · {r["label"]} · {r["input"]}</p><img loading="lazy" src="evidence/{r["path"]}" alt="{r["path"]}">')
 out+=['<h2>Timing (silent)</h2><p>Accelerated prefix, then two seconds of native post-contact motion; not a continuous 24-second human run.</p>']
 for mode in ['before','after']:out.append(f'<video controls preload="none" src="evidence/{mode}-timing.webm"></video>')
 write(STAGE/'index.html','\n'.join(out))
 print(json.dumps({'stage':str(STAGE),'stats':stats,'pairs':len(pairs)}))
def pack():
 prepare();files={p.relative_to(STAGE).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in STAGE.rglob('*') if p.is_file() and p.name!='MANIFEST.json'};write(STAGE/'MANIFEST.json',json.dumps(files,indent=2))
 path=ROOT/'review-packages/FEEDBACK-001D-B-review.zip';path.parent.mkdir(exist_ok=True)
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
  for p in STAGE.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(STAGE).as_posix())
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  for n,h in files.items():assert sha(z.read(n))==h['sha256']
 digest=sha(path.read_bytes());write(path.with_suffix('.zip.sha256'),digest+'  '+path.name+'\n');receipt={'zip':str(path),'sha256':digest,'CRC':'pass','inventory':'pass','entries':len(files)+1,'finalCommit':git('rev-parse','HEAD')};write(path.with_suffix('.zip.verification.json'),json.dumps(receipt,indent=2));print(json.dumps(receipt))
if __name__=='__main__':{'prepare':prepare,'pack':pack}[sys.argv[1] if len(sys.argv)>1 else 'prepare']()
