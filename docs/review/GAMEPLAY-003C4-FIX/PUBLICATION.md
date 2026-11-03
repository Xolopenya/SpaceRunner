# Публикация

Исходный 21-сценарный Balanced corpus воспроизведён без изменений: **44/62 мины опубликованы, 18 пропущены**. Все final outcomes, геометрия, witness hashes и hull совпали с frozen baseline. Dev frame accounting включается явными begin/finish вокруг настоящего render-интервала; диагностика без render сохраняет прежний per-step режим.

Первичные причины 18 пропусков:

| Категория | Число |
| --- | ---: |
| NO_WITNESS_FOUND в ограниченном constructive proposal | 15 |
| Недостаточная реакция: контакт с committed ordinary field в held prefix | 3 |
| Первичный planning deadline | 0 |
| Ownership/capacity | 0 |
| Ошибка захвата actual root | 0 |

Это первичные причины; финальный ordinary fallback учитывается отдельно. 10 первичных проверок упираются в committed препятствие. Для 14/15 NO_WITNESS_FOUND более дорогой offline beam нашёл независимо replayed witness. Единственный оставшийся beam rejection также не доказывает математическую невозможность. Столкновение конкретной проверяемой траектории нельзя называть невозможностью всего encounter.

Финальные outcomes:10сертифицированных ordinary fallback commits и8полных uncertified omissions. Среди последних5 — `STALE_PUBLICATION_STATE:COLLISION_FOUND`: подготовленный fallback-маршрут не проходит повтор из фактического состояния; ещё3 — тот же недостаточный held-input reaction prefix. Это отдельная категория actual-state publication mismatch, а не ошибка канонического capture мины. Максимальная серия mine omissions равна2. Ownership/capacity/deadline отказов в исходном corpus нет.

`corpus/evidence.json` содержит каждый primary context, result/detail, fallback status и offline counterfactual. Разрешение на дополнительную runtime работу из этого не следует. Нельзя заменить actual-root gate устаревшим offline результатом.

Девять paired normal2-step frame прогонов полностью совпадают с baseline, включая active count и nearby-free time. Отдельный transient catch-up (12 шагов каждый60-й кадр) на seed0/witness даёт5/7 вместо6/7; максимальная пустота4.10 вместо3.18 s, hull3. Остальные восемь сохраняют число публикаций мин. Эти изменившиеся поля не используются как строго одинаковая нагрузка для timing A/B. Потеря доступности — открытый риск ограничения работы.

Не менялись source frequency, mine placement, tuning и producers. Другая начальная поза не устраняет конфликт с уже известным stationary debris; её изменение потребовало бы отдельной balance-проверки. Дополнительные кандидаты или полный поиск в synchronous gate увеличили бы работу. Они не внедрены. Existing certified whole ordinary fallback сохранён; несертифицированные секции не публикуются. Ни одна мина не объединяется со станцией в одном encounter.
