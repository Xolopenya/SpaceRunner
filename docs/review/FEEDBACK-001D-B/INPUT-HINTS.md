# Input hints

Initial preference comes from matchMedia('(pointer: coarse)'). Touch pointerdown chooses touch copy; mouse/pen chooses desktop copy. A supported steering/pause/mute keyboard key chooses desktop copy. A real pointer capability change refreshes the default. Browser viewport resizing changes composition, not input preference. No supported control is disabled.

Touch mode shows drag instructions and hides keyboard-only auxiliary menu/pause shortcuts. Desktop mode retains WASD/arrows and actual keyboard pause/mute hints, even at 800x450. Hybrid users can switch by keyboard, touch or mouse without reloading. Observers never preventDefault, stopPropagation or modify axes. InputManager is byte unchanged. Observer listeners use an AbortController and are removed in Game.dispose.

Existing touch, pointer-capture/cancel, mouse, keyboard and focus tests remain. The new hybrid regression changes keyboard/touch/mouse while resizing from portrait to compact desktop. Physical convertible laptops/tablets remain untested. There is no added tutorial or fragment teaching.
