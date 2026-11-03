# Решение и оставшиеся риски

**Partial.** Реальная причина суммирования работы подтверждена; накопление propagation/query за render ограничено, safeguards и adaptive inertia сохранены. Это результат focused stabilization для дальнейшего review, а не production-ready mine.

- 18/62 исходных mine omissions не устранены. 14 восстановимых full-beam случаев требуют более эффективного bounded constructive proposal; добавлять работу в actual-root gate нельзя.
- При catch-up cadence некоторые сертифицированные публикации меняются; seed0/witness теряет ещё одну мину и получает более длинную пустоту. На постоянном низком FPS исчерпание simulation deadline остаётся возможным и должно завершаться отказом.
- Число операций на render ограничено, wall time — нет. Синхронные inspect/prepare, gate, JIT/GC, Web Audio startup и render могут создавать long tasks. Исчезновение всех stutters не заявляется.
- Main-thread sampler и запись видео влияют на timings. Exploratory per-operation timers хранятся отдельно от итогового профиля. Поля, разошедшиеся после safety veto, не считаются одинаковой работой A/B.
- Живые after warm RAF p95≈133ms местами хуже baseline16.8ms. Крупнейшие4.45s baseline/516.6ms after gaps не совпадают с planner CPU или main-thread long tasks; точный источник задержки RAF/presentation не установлен. Общий рост FPS не доказан, несмотря на подтверждённый operation cap и улучшение identical-work control.
- Память измерена конечными GC/restart samples и30 retained jobs; это не доказательство отсутствия любой утечки или allocator bound.
- Chrome desktop/mobile emulation не заменяет физические телефоны, Safari/Firefox и sustained thermal sessions. Human readability/fun acceptance не получено.

Следующая задача: улучшить существующее одноветочное предложение маршрута на зафиксированных14 actual-root counterexamples **внутри прежнего allowance**, затем повторить frame-budget/availability review. Владелец уже может проверить снятый bait-and-reverse, но approval на production, merge или deployment здесь не запрашивается и не подразумевается. Collectibles и новые encounter families не добавлены.
