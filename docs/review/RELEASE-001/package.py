"""Build a submission receipt without duplicating the reviewed game source tree."""
from pathlib import Path
import hashlib,html,json,shutil,subprocess,zipfile

ROOT=Path(__file__).resolve().parents[3]
D=ROOT/'.cache/review/RELEASE-001'
STAGE=D/'package'
APPROVED='b34b5a6a3f8b04ab8f4254abaf432c5e2bfb9127'
ORIGINAL='d5b02d8c28118e540c673a73f99357fe886420c8'
BRANCH='release/vertical-slice-playtest-submission'

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode().strip()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf-8')
def dump(p,v):write(p,json.dumps(v,indent=2,ensure_ascii=False))
def copy(a,b):b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(a,b)

stats=read(D/'full/browser-results.json')['stats']
assert stats['expected']+stats['flaky']==148 and stats['unexpected']==stats['skipped']==0
assert 'pass 357' in (D/'logs/unit.log').read_text(encoding='utf-8-sig')
deploy=read(D/'deployment.json');final=git('rev-parse','main');prep=git('rev-parse',BRANCH)
assert final==prep==deploy['sha']==git('rev-parse','origin/main')
assert deploy['run']['conclusion']=='success'
assert git('diff',APPROVED,'--','src','public','index.html','package.json','package-lock.json','vite.config.ts','tests','playwright.config.ts')==''
assert git('diff','--name-only')==git('diff','--cached','--name-only')==''
local=read(D/'local-smoke.json');public=read(D/'public-smoke.json');diag=read(D/'diagnostics.json')
assert local['errors']==local['failed']==public['errors']==public['failed']==[]
assert public['death']['energy']>0 and public['audio']['menuRms']>0
logs=read(D/'actions-log-download.json')
url=deploy['publicUrl'];run=deploy['run'];count=len(deploy['assets'])
meta={'task':'RELEASE-001','approvedImplementation':APPROVED,'originalMain':ORIGINAL,'releaseBranch':BRANCH,'releasePreparation':prep,'finalMain':final,'remoteMain':deploy['sha'],'deploymentRun':run['id'],'publicUrl':url,'browser':stats,'preservation':'runtime/assets/dependencies/tests exact approved implementation','gitStatus':git('status','--short')}
dump(D/'metadata.json',meta)
reports={
'RELEASE-REPORT.md':f'''# RELEASE-001 — итог выпуска

Одобренная реализация: `{APPROVED}`. Release preparation: `{prep}`. Итоговый main и подтверждённый remote main: `{final}`. Исходный main: `{ORIGINAL}`.

Подготовлен существующий вертикальный срез без изменения игры. PLAYTEST_NOTES содержит сводку четырёх очных сессий (две дома), подтверждённый владельцем результат C2 и открытые проблемы. README и CHANGELOG актуализированы; неподтверждённые результаты людям не приписаны. Код, ресурсы, зависимости и все тесты побайтово сохранены относительно одобренной реализации с учётом штатной нормализации Git.

Main обновлён fast-forward и отправлен обычным push без переписывания истории. [GitHub Actions]({run['html_url']}) завершён с `{run['conclusion']}`. [Игра]({url}) возвращает точный revision `{final}`; проверены SHA-256 и HTTP200 всех {count} файлов manifest. Свежий браузер подтверждает подбор, урон, звук, cinematic, результаты с энергией, Skip, Replay и Back to menu.

Проверки: 357 unit; {stats['expected']} browser с первой попытки, {stats['flaky']} на повторе, {stats['unexpected']} ошибок, {stats['skipped']} пропусков. Typecheck/build и обе дополнительные проверки CI прошли. Подробности и ограничения — TESTING.md/DEPLOYMENT.md. Готово к учебной сдаче как вертикальный срез; финальный баланс и полнота игры не заявлены.
''',
'DOCUMENTATION-CHANGES.md':'''# Изменения документации

README прочитан целиком и обновлён точечно с сохранением русского языка, структуры, идентичности и лицензий. Добавлены устойчивые повреждения/гибель, фактическое mouse-drag управление, Fly again/Back to menu, строгий новый рекорд, текущий HUD и ограничения. Отвергнутые лучи не описываются как активная механика. Команды npm сохранены; существующая публичная ссылка проверена.

CHANGELOG сохраняет этапный формат без придуманной semantic version. Добавлены отсутствовавшие VISUAL-007A/B, FEEDBACK-001A/B/B1, D-A/B/C и RELEASE-001. Уже записанные C/C1/C2 не продублированы; старые пометки feature-веток явно обозначены как исторические. Даты проверены по истории Git/записям этапов.

PLAYTEST_NOTES отделяет домашние отзывы о подборе от наблюдений владельца и технического аудита. Прослеживается цепочка: сложность совмещения -> отвергнутая визуальная помощь -> удаление лучей, +12,5% параметров помощи и три дорожки -> владельцу легче; повтор исходных участников не подтверждён. Рост размещений50->56 в симуляции не объявлен ростом человеческой успешности. Различимость объектов, длительные пустоты, баланс и экономика остаются открытыми.

Минимальные release-изменения: новый одобренный pin в scripts/release-audit.mjs и task/approvedImplementation в release.json. Алгоритмы safety gate и workflow не ослаблены. Старый pin a5906ef воспроизводимо отклонял текущую одобренную игру; исходный отказ сохранён в logs/ci-pin-before.log. Никаких изменений production runtime.
''',
'GIT-INTEGRATION.md':f'''# Интеграция Git

После git fetch origin локальный main и origin/main совпадали: `{ORIGINAL}`. Этот commit — предок `{APPROVED}`. Создана `{BRANCH}` строго от одобренного commit.

Все игровые FEEDBACK A/B/B1/C/C1/C2/D-B/D-C уже были предками D-C. Единственное исключение — документальный D-A (`fbfde04`): осмотренный diff содержит только docs. Выполнен обычный `git merge --no-ff --no-commit feature/feedback-001d-a-ux-audit`; один конфликт в docs/TASKS.md разрешён сохранением обеих записей C/B и A. Merge commit `c7ca7b2` сохраняет обе линии истории. Чужие feature-ветки не объединялись и не удалялись; повторных cherry-pick нет.

Документация, QA-инструменты и два release-скрипта закоммичены в release preparation `{prep}`. После полного набора проверок remote повторно получен и проверен. Команды интеграции: `git switch main`; `git merge --ff-only {BRANCH}`; `git push origin main`. Итог main `{final}`; GitHub API и git ls-remote подтверждают тот же SHA. Push receipt — logs/push.log; история и документационные diff приложены.

Main интегрирован fast-forward; remote commits не отброшены. Force-push, reset, rebase, удаление веток и публикация формального GitHub Release не выполнялись. Ошибок repository protection при успешном push не зафиксировано. Четыре исходных посторонних untracked-пути сохранены и не включены в коммиты; текущий status — metadata.json.
''',
'DEPLOYMENT.md':f'''# Публикация

Проверены actual default branch main, has_pages=true и существующий URL [{url}]({url}). До выпуска публичный release.json показывал `{ORIGINAL}`, task RELEASE-007 (public-before.json). Workflow .github/workflows/deploy.yml уже публикует на push main; сохранены его permissions pages:write/id-token:write, environment github-pages, concurrency и закреплённые Actions. Vite в GitHub Actions использует /SpaceRunner/.

Deployment [run {run['id']}]({run['html_url']}) для `{final}` завершён success. actions-latest.json и actions-jobs.json содержат run/step receipts. HTTP-статус скачивания полного console-log ZIP: {logs['status']}; при доступном скачивании он находится в logs/deployment-actions.zip. При ограничении endpoint API-статусы шагов и ссылка на оригинальные логи сохранены вместо выдуманного console output.

release.json получен с cache-busting и Cache-Control:no-cache: task RELEASE-001, approvedImplementation `{APPROVED}`, commit `{final}`. Все {count} manifest-файлов загружены заново и совпали по размеру и SHA-256: JS/CSS, GLB, шрифты/уведомления, лицензированные аудиосемплы. Проверены исходные страницы и пути /SpaceRunner/. Публичный smoke использует новый browser context; реально загруженный script src сохранён, debug Game отсутствует.

Public smoke: {len(public['shots'])} скриншотов, energy после настоящего подбора={public['death']['energy']}, distance={int(public['death']['distance'])}; console/page errors 0, failed requests 0. Меню после Back воспроизводит ненулевой music-bus RMS={public['audio']['menuRms']:.6f} при сохранённом аудиографе. Это атмосферный слой существующей партитуры, а не новый отдельный трек.

Локальная Pages-сборка создана из Git blobs с LF, чтобы исключить Windows CRLF как причину различий хешей. Публичные SHA проверяются относительно manifest самой CI-сборки; локальная сборка отдельно прошла smoke. Доступность сейчас подтверждена, но не является обещанием бессрочного hosting uptime или тестом всех CDN edge. Физические телефоны и другие движки не проверялись.
''',
'TESTING.md':f'''# Проверки RELEASE-001

Команды перед интеграцией: npm run typecheck; npm test; npm run build; node --experimental-strip-types scripts/assignment-audit.mjs; node --experimental-strip-types scripts/release-audit.mjs --ci; npm run test:browser -- --workers=1 --retries=1 --output=.cache/review/RELEASE-001/full-artifacts. REVIEW_RESULT_DIR заранее создан. Logs сохранены без замены assertions.

Unit 357/357, typecheck/build pass. Full browser: {stats['expected']} first-attempt pass / {stats['flaky']} retry pass / {stats['unexpected']} failed / {stats['skipped']} skipped; duration {stats['duration']/1000:.1f}s. Все 148 сценариев и 357 unit сохранены без изменения. Build warning о chunk>500kB остаётся. Исходный CI отказ на устаревшем approved pin сохранён; новый pin соответствует явно одобренному D-C, replay/physics gates не удалены. Первый локальный Pages-smoke прерван: QA preview запущен без GITHUB_ACTIONS/base и отдавал HTML вместо prefixed JS. Исправлен только параметр QA-хоста, добавлена быстрая проверка Content-Type; исходный журнал сохранён. Игра не менялась.

assignment-audit повторяет 180s для seed 0/11/42, проверяет Phase2 и независимые маршруты. CI release-safety выполняет 48 независимых replay и четыре cadence-сценария, pause/cancel/reset и общую кинематику мин. JSON receipts приложены. Это техническая проверка, не плейтест людей.

local-smoke.json и public-smoke.json: обычная production-страница и genuine Launch/keyboard/button events. CDP только наблюдает существующий Game; легальный автоматический пилот подбирает кристалл, нейтральный ввод доводит до естественного урона/гибели. HP/предметы/score не вставляются. Ускоренные ожидания и held WebGL кадры явно маркированы. Проверены реальные модели/шрифты/8 samples, загрузка адаптивной музыки, видимые кристаллы и прирост энергии, эффекты, cinematic completion/Skip, результаты с правильной ненулевой энергией, Replay/Back/Menu/Launch, рекорд и фокус, pause/resume, две мобильные ориентации. Реальный вывод music bus в меню измерен после пользовательского жеста; это не субъективная оценка звучания.

Дополнительно проведён UI smoke через обычные элементы браузера; его фактический метод и доступные изображения указаны в ui-smoke.json, если этот файл присутствует. Ни этот проход, ни Playwright не выдаются за дополнительные человеческие плейтесты. Подробные четыре очных сессии описываются только по данным владельца в PLAYTEST_NOTES.

Сохранение approved исходников проверяется Git diff по src/public/index/config/dependencies/tests. Новые проверки и повторный build после документационного commit не меняют игровую логику. Public checks включают HTTP, SHA manifest, свежий browser, ошибки консоли и реальные переходы; один успешный push не использован как доказательство deployment.
''',
'SUBMISSION-SUMMARY.md':f'''# Вертикальный срез Space Runner

1. [Играть]({url}).
2. [Репозиторий](https://github.com/Xolopenya/SpaceRunner), опубликованная ревизия `{final}`.
3. Работает бесконечный 3D-полёт: WASD/стрелки, pointer-drag/касание, 3HP и временная защита, астероиды/обломки/проёмы станций, инерционная самонаводящаяся мина, Phase2, необязательные энергетические кристаллы и сохраняемый рекорд.
4. Единый Flight Instrumentation интерфейс: понятный HUD, подсказки по вводу, пауза/звук, новый рекорд, Fly again и Back to menu.
5. Отклик: видимые повреждения, разные столкновения/взрывы, пропускаемая гибель, лицензированные samples, музыка меню и адаптивные слои полёта, реакция двигателя.
6. Четыре очных плейтеста, два дома, сведены в PLAYTEST_NOTES без придуманных индивидуальных протоколов.
7. Два домашних участника сообщили о трудном сборе. Отвергнутые лучи удалены; помощь подбора +12,5%, три варианта дорожек. Владелец отмечает более лёгкий сбор; исходные участники повторно не проверены.
8. Различимость обломков/кристаллов и сообщение о долгих пустых интервалах остаются открытыми. Генератор не объявлен сломанным; новые модели/генерация в релиз не добавлялись.
9. README и CHANGELOG обновлены, история FEEDBACK безопасно сохранена в main, существующий Pages deployment и публичная сборка проверены.
10. Это рабочий этап для сдачи, не финальная игра: баланс, сложные новые комбинации, экономика, onboarding и физические телефоны требуют следующих итераций. Автотесты не доказывают удобство для всех людей.
''',
'DIAGNOSTICS.md':'''# Ограниченная проверка открытых наблюдений

Исходный IntegratedModel,120Hz, два тика/планировочный кадр, нейтральный ввод; шесть seed до естественной гибели или 180s. Никому не добавлялась неуязвимость, HP не сбрасывался. В текущей выборке все погибли за 17–40s, поэтому утверждать воспроизведение длительного полёта нельзя.

| Seed | Время до гибели, с | Дистанция, м | Committed / omitted | Max без asteroid в диапазоне -100<=z<0 после 5s |
|---|---:|---:|---:|---:|
'''
}
for r in diag['rows']:
    f=r['final'];reports['DIAGNOSTICS.md']+=f"| {r['seed']} | {f['elapsed']:.2f} | {f['distance']:.1f} | {f['committed']} / {f['omitted']} | {r['maxForwardAsteroidGap']['seconds']:.2f}s |\n"
reports['DIAGNOSTICS.md']+='\nFault во всех случаях отсутствовал, публикации продолжались. Forward band считает виды 0..2 (метеориты), а не все угрозы и не frustum камеры; это не доказательство пустого экрана. Например, seed 11 даёт около 5,89s без asteroid в этом band, но этого недостаточно для диагноза остановки генератора. Для модельной паузы seed 11: /SpaceRunner/?seed=11, Launch без управления; диапазон примерно277–406м (13,325–19,217s). Это не утверждение, что весь экран пуст. Другие типы встреч, owned tail, pacing и fail-closed omission допускают паузы. Точная длинная ситуация владельца не воспроизведена; observation остаётся открытым. Нужны seed/дистанция/видео длительного случая.\n\nКристаллы имеют cyan-свечение и рамку, обломки — иные модели/материалы; это техническое отличие видно на действующих кадрах, но оно не опровергает сообщение владельца о путанице. Дизайн не переделывался. Меню использует existing AdaptiveScore ambient layer в состоянии MENU (остальные слои0), с пользовательской разблокировкой; код/история и ненулевой WebAudio RMS подтверждают наличие музыки.\n'
for n,s in reports.items():write(STAGE/n,s)
for name in ['PLAYTEST_NOTES.md','README.md','CHANGELOG.md']:copy(ROOT/name,STAGE/name)
for folder in ['logs','evidence','full']:
    for p in (D/folder).rglob('*'):
        if p.is_file():copy(p,STAGE/folder/p.relative_to(D/folder))
for p in D.glob('*.json'):copy(p,STAGE/p.name)
for context in (D/'full-artifacts').rglob('error-context.md'):
    for p in context.parent.iterdir():
        if p.is_file():copy(p,STAGE/'attempt-artifacts'/p.relative_to(D/'full-artifacts'))
write(STAGE/'history.log',git('log','--graph','--format=%H %aI %s',ORIGINAL+'..main'))
write(STAGE/'branches.log',git('branch','-vv'))
write(STAGE/'documentation.patch',git('diff','--binary',APPROVED,'main','--','README.md','CHANGELOG.md','PLAYTEST_NOTES.md','docs','scripts/release-audit.mjs','scripts/release-metadata.mjs')+'\n')
for p in (ROOT/'docs/review/RELEASE-001').iterdir():
    if p.is_file():copy(p,STAGE/'tooling'/p.name)
for p in ['scripts/release-audit.mjs','scripts/release-metadata.mjs','.github/workflows/deploy.yml','vite.config.ts']:
    copy(ROOT/p,STAGE/'release-config'/p)
preserved=git('ls-tree','-r',APPROVED,'--','src','public','index.html','package.json','package-lock.json','vite.config.ts','tests','playwright.config.ts')
assert preserved==git('ls-tree','-r','main','--','src','public','index.html','package.json','package-lock.json','vite.config.ts','tests','playwright.config.ts')
write(STAGE/'approved-inputs.git-tree',preserved+'\n')
out=['<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RELEASE-001</title><style>body{font:16px/1.5 system-ui;background:#07111f;color:#edf4f5;margin:24px;overflow-wrap:anywhere}a{color:#8cdeeb;overflow-wrap:anywhere}img{max-width:100%;max-height:650px}section{border-top:1px solid #496070;margin-top:24px}</style><h1>Space Runner · RELEASE-001</h1><p>Actual local / public production evidence. Accelerated simulation, held real WebGL frames; no human-playtest claim. Published SHA '+final+'</p><nav>']
out+=[' · '.join(f'<a href="{n}">{n}</a>' for n in list(reports)+['PLAYTEST_NOTES.md','README.md','CHANGELOG.md','metadata.json'])+'</nav>']
for smoke,label in [(local,'Local Pages'),(public,'Published Pages')]:
    for shot in smoke['shots']:
        path=html.escape(shot['path']);out.append(f'<section><h2>{label} · {path}</h2><p>{shot["state"]} · distance {shot["distance"]:.1f} · hull {shot["hull"]} · energy {shot["energy"]} · focus {shot.get("focus")}</p><a href="evidence/{path}"><img loading="lazy" src="evidence/{path}" alt="{path}"></a></section>')
write(STAGE/'index.html','\n'.join(out))
files={p.relative_to(STAGE).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in STAGE.rglob('*') if p.is_file() and p.name!='MANIFEST.json'}
dump(STAGE/'MANIFEST.json',files)
path=ROOT/'review-packages/RELEASE-001-review.zip';path.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(STAGE.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(STAGE).as_posix())
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    assert set(z.namelist())==set(files)|{'MANIFEST.json'}
    for n,f in files.items():assert sha(z.read(n))==f['sha256']
digest=sha(path.read_bytes());write(path.with_suffix('.zip.sha256'),digest+'  '+path.name+'\n')
receipt={'zip':str(path),'sha256':digest,'entries':len(files)+1,'CRC':'pass','inventory':'pass','main':final,'remote':deploy['sha'],'published':deploy['metadata']['commit']}
dump(path.with_suffix('.zip.verification.json'),receipt)
print(json.dumps(receipt))
