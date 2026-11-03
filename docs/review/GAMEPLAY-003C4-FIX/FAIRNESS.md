# Контракт безопасности

Сохранены exact Ship.update120Hz, coupled immutable mine state, relative swept sphere CCD, margin0.15, held54, braking39, terminal reservation, full known-field inspection, actual-root certification, independent replay и atomic ownership/pool admission. Контроллер и его параметры побитно прежние.

Новые тесты проверяют общий allowance, резерв полного actual-root gate, детерминированные normal/catch-up прогоны, независимый полный replay каждого принятого witness и отказ ровно на simulation tick144 при исчерпанном render allowance. Deferral не продлевает safety deadline. Gate всегда создаётся из текущего Ship/input/time/distance/feedback, а не из исторического результата. Исторические тесты не изменены и не ослаблены.

Исходный полный benchmark покрывает972 состояния, все3 preset, seeds0/11/42, позиции центра/границ, скорости и два режима forward clock:781 accept /191 NO_WITNESS_FOUND /0 unfinished. Дополнительные replays включают full-query clock/CCD, не сохранённую будущую траекторию мины. Отдельный stabilization corpus имеет623 дополнительных независимых replays, включая14 offline восстановленных маршрутов; runtime разрешения им не присваиваются.

Браузерная регрессия проверяет authoritative mesh/slot/target, keyboard и CDP touch, pause/restart, реальный урон и исключение из production. Числа завершённых final прогонов и exit codes находятся в verification manifest/logs. Collision audit сохранён отдельно.

Детерминированы движение, source и поиск при одинаковом seed, input tape и последовательности render-групп. При другой render cadence меняется количество выполненной подготовки до фиксированного simulation deadline: возможны другие сертифицированные поля/omissions. Это явно измерено; обещания cadence-independent accepted world нет. Произвольный ввод игрока не обязан совпадать с существующим безопасным witness.
