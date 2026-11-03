# Производительность и воспроизводимость

Frozen baseline `bbfb48ccf390b8feceb82ada4f01e86b912b4779`. Команды: `node scripts/homing-stabilization-freeze.mjs`, исходный `adaptive-homing-benchmark.mjs` с REVIEW_RESULT_DIR до/после, `homing-stabilization-corpus.mjs`, `homing-stabilization-verify.mjs`, затем **без конкурирующих проверок** `homing-stabilization-browser.mjs` с HOMING_PROFILE_DIR=.cache/review/GAMEPLAY-003C4-FIX/profile-final и `homing-stabilization-matched.mjs`. Media снимается отдельным `homing-stabilization-media.mjs`. `homing-stabilization-analyze.mjs` проверяет результаты и создаёт этот отчёт.

Живые serial-профили: fresh Chrome на case, 30s wall time, seed42, x±1 каждые180 simulation ticks/y0, обычный hull, sampler1ms, без per-operation timer wrappers и записи видео. Desktop1280×800/DPR1, portrait390×844/DPR2, landscape844×390/DPR2. Stress отдельно добавляет60ms busy wait каждый90-й observer RAF. Работа привязана непосредственно к loop.render, а не к timestamp соседнего observer.

| Case | Planner/render p50/p95/p99/max ms | Warm RAF p50/p95/p99/max ms | Cold RAF max | Max work p/q | Long tasks |
| --- | --- | --- | ---: | --- | ---: |
| before/desktop | 8.30/12.60/15.30/26.20 | 16.70/16.80/17.00/17.60 | 549.90 | 6144/12288 | 2 |
| before/portrait | 9.60/15.30/18.90/23.30 | 16.70/16.80/16.90/17.40 | 433.20 | 6144/12288 | 2 |
| before/landscape | 45.00/88.60/90.40/109.50 | 16.70/33.50/100.00/4449.40 | 716.50 | 33997/29700 | 23 |
| before/landscape/stress | 63.00/106.80/107.90/118.40 | 16.70/116.70/150.10/483.00 | 833.30 | 36864/31028 | 32 |
| after/desktop | 19.60/32.30/50.40/65.60 | 16.70/133.70/183.30/516.60 | 800.00 | 6144/12288 | 4 |
| after/portrait | 18.50/30.60/33.40/51.50 | 16.70/133.40/233.50/549.90 | 849.80 | 6144/12288 | 3 |
| after/landscape | 18.80/30.90/36.20/56.80 | 16.70/133.10/166.60/349.90 | 883.30 | 6144/12288 | 4 |
| after/landscape/stress | 20.50/40.20/47.50/60.00 | 16.70/133.00/150.30/266.60 | 916.50 | 6144/12288 | 15 |

Planner/render учитывает кадры с работой; RAF — PLAYING после2s для warm, startup<2s для cold. Полные chunk distributions, actual-gate, resolution, active/nearby counts, raw RAF и long-task intervals включены в JSON. Mean не используется как доказательство исчезновения stutters.

Совпадение живых миров проверено отдельно: desktop: prefix1, outcomes6/6, identical=false; portrait: prefix1, outcomes6/6, identical=false; landscape: prefix1, outcomes4/6, identical=false; landscape/stress: prefix1, outcomes6/6, identical=false. Везде совпадает ввод на общих simulation ticks. Разошедшиеся после veto миры являются policy comparison, **не** одинаковой работой timing A/B.

## Строго одинаковая работа

Контроль исполняет9 full-beam jobs на трёх одинаковых exact contexts, после3 JIT warmups, с12 work opportunities/render, в одинаковой menu scene844×390/DPR2. Algorithm/controller совпадают с frozen bytes. Все work counters и9 witness hashes равны, каждый witness независимо replayed. Это контроль scheduling; он не заменяет живую gameplay проверку.

| Policy | Planner/render p50/p95/p99/max ms | RAF p50/p95/p99/max ms | Max propagation/render | Frames |
| --- | --- | --- | ---: | ---: |
| original allowances | 60.70/80.80/82.90/90.90 | 66.80/100.20/149.90/766.40 | 36864 | 32 |
| capped | 8.60/12.50/15.70/16.00 | 16.70/33.30/49.90/716.60 | 6144 | 183 |

Операционный потолок упал с12×3072 до2×3072 за render. Общая работа поиска не исчезла: она распределена на больше кадров. Ни per-call budgets, ни deadline144, ни beam не повышены. Это не wall-time guarantee.

## Стоимость компонентов и память

before: chunk 4.10/6.90/9.60/22.20 ms; actual gate 4.70/7.80/7.80/22.20 ms; resolution 0.10/0.10/0.10/1.70 ms. Restart retained V8 delta после5warmups+10samples: 145216 bytes;30retained jobs: 29484 bytes/job (forced GC; noisy finite estimate).

after: chunk 9.50/17.70/23.90/60.80 ms; actual gate 6.20/13.10/13.10/60.80 ms; resolution 0.20/0.20/0.20/2.80 ms. Restart retained V8 delta после5warmups+10samples: 247328 bytes;30retained jobs: 29446 bytes/job (forced GC; noisy finite estimate).

`analysis.json/attribution` содержит inclusive1ms CPU sample attribution propagation/controller, collision, search, replay, prepare/snapshot и GC. Это перекрывающиеся времена, не сумма wall time. Exploratory per-operation timers и исходные неблагоприятные показатели сохранены в browser/ отдельно; они включают стоимость частых performance.now и конкурирующие диагностические процессы и не служат итоговым A/B. Independent full replay cost также измерен в matched/summary.json.

Original corpus до/после:972/781accepted/191rejected/0unfinished,1962 независимых replay на каждый прогон. Balanced44/62; максимальная серия пропусков2; максимальная nearby-free пауза в21сценарии4.62s (nearby: active z∈[−100,8]). Normal2-step field/count/time совпали; transient catch-up отдельно ухудшает один случай (PUBLICATION.md). Offline15 full-beam counterfactuals требуют до158702 propagation;14принимаются, но это больше synchronous gate3072.

Защищено146 прежних source/assets/tests files (разрешены только5явных hook/presentation files). Production 1013503→1013482 bytes; побайтовая идентичность не заявляется. Девять ReleaseModel histories совпали полностью, adaptive module/asset отсутствуют в production.

Отвергнуты: повышение budgets, worker rewrite, замена преследования Target-Lock, публикация без полного replay, дополнительный beam в gate и motion tuning ради acceptance. Нужен более удачный существующий bounded route proposal. Cold spikes, отдельные warm выбросы, низкий sustained FPS и реальные телефоны остаются рисками. Статус Partial.

## Неблагоприятные результаты и повторные проверки

Рост FPS в живой игре не доказан: after desktop/portrait warm p95≈133ms хуже baseline≈16.8ms. В `outlier-overlap.json` largest gaps сопоставлены с теми же performance timestamps model steps, planner time и long tasks. Landscape baseline4449.4ms имеет0ms planner/0.9ms model и ни одного пересекающегося long task; after desktop516.6ms имеет0ms planner. Источник таких RAF/presentation gaps не установлен. Их нельзя выдавать за устранённые planner stalls или объяснять недоказанной нагрузкой GPU/хоста.

Изначальный browser regression обнаружил собственную ошибку активации accounting вне render: исправлена явными begin/finish без изменений тестов. Отдельный прерванный прогон длился5.8h и завершился audio-context teardown timeout (84pass/1fail); он сохранён, не использован для timing claims. Финальный полный прогон:234unit и85browser pass, все8обязательных checks exit0.

Первый identical-work harness ошибочно вызывал frozen-context job с нулевым propagation allowance и расходовал его call deadline. Исправлено только измерительное средство: теперь такая offline очередь ждёт следующий RAF без пустого вызова. Runtime simulation deadline144 не изменён. Повторный control прошёл,9hashes/work counters совпали,18independent replays. Исходные verification source hashes сохранены отдельно; `tooling-reverification.json` фиксирует единственное изменение harness и его повторный запуск, syntax/static checks. Implementation и tests после полного regression не менялись.
