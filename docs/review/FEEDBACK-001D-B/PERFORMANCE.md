# Performance

Sequential 600-native-frame baseline/final production measurements and ten UI restarts per version are retained in performance.json. No per-frame layout measurement, new animation loop, timer queue, framework, shader or asset. HUD observer adds three listeners, owned by an AbortController; Game.dispose removes them. Compare actual CDP counters below rather than equating arbitrary DOM counter values to leaks. No unrelated frame anomaly is claimed fixed. Desktop Chrome sample is not a phone guarantee.

Viewport: 1280x800 desktop. A preliminary concurrent-load sample is retained separately and is excluded from the final comparison below. The final performance receipt was written after the completed 131-case browser report. No speedup or phone-FPS claim. Raw counters and frame series: performance.json.

| Version | RAF p95 ms | Update/render p95 ms | CDP DOM nodes over 10 resets | Listeners over 10 resets | Listeners after disposal |
|---|---|---|---|---|---|
| before | 16.80 | 6.80 | 351–352 | 63–63 | 27 |
| after | 16.80 | 6.60 | 352–354 | 66–66 | 27 |
