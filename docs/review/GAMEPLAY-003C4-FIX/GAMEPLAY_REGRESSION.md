# Gameplay и публичный релиз

Сохранён DEV URL:

`http://127.0.0.1:5173/?debug=field&experiment=moving-mine&motion=adaptive-homing&seed=42&firstMine=1`

`homing=soft|balanced|aggressive` остаются прежними. Balanced: speed5.5, acceleration6, responsiveness2.4,120Hz, fixed world depth, максимум одна мина. Это живое непрерывное преследование текущего Ship, включая смену цели после разворота. Frozen Target-Lock не заменяет его.

Детерминированная демонстрация seed43: нейтрально до passTick−232, вправо до passTick−160, затем влево. Мина продолжает двигаться вправо после разворота корабля, позже исправляет курс; hull3/hits0. Late case seed42: вправо с startTick, разворот только passTick−30; hull2/hits1. Реальные RAF canvas WebM, декодированные кадры, HUD screenshots и120Hz states сохраняются в `media/`. Два сценария снимаются до и после; геометрия не удаляется, hull/velocity не подменяются.

Старые fairness tests дополнительно воспроизводят stationary/boundary/early/late/repeated directions, pause/resume и restart. Новые normal/catch-up witness flights и исходный corpus проверяют complete known field. Мина не получает предопределённый путь.

Публичный ReleaseModel не использует render accounting. DEV hooks в Game и runtime-field исключаются production compile-time guard. Полный production output собирается заново; побайтовая идентичность не заявляется: минификатор может иначе записать эквивалентный вызов с undefined budget. Assets, release settings, source policy, physics, audio, input, World и Pages workflow не изменены.

Девять frozen/current ReleaseModel сравнений на seeds0/11/42 и witness/neutral/horizontal совпадают по Ship, clocks, hull, field geometry, events и certificates. Три witness-run достигают3642.85m с hull3; Phase2 активна. Это сохраняет threshold500, speed×1.08, интервалы и пять aperture. Полный браузерный regression дополняет модельные сравнения проверками menu music, persistence, pause/restart, production isolation и обычного Play. Субъективное прослушивание и физический телефон не проверялись.

DEV panel показывает published/omitted, rejection, pursuit state, planner work per render, deferred steps, spike count и active obstacles. Panel frame delta ограничена исходными100ms; raw RAF trace содержит необрезанный интервал. В production panel и mine asset отсутствуют.
