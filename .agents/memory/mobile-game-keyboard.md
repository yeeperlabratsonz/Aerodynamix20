---
name: Mobile game keyboard
description: Every catalog game receives the touch keyboard through the shared game-frame wrapper.
---

The on-screen keyboard belongs in `game-frame.html`, not inside individual games. It dispatches modern and legacy keyboard events into the iframe, releases held keys when touch, focus, visibility, or iframe state changes, and reserves its measured bottom-dock height from the game viewport. Compact movement controls are the default; the full layout is opt-in.

**Why:** All games use the shared wrapper, while the embedded games vary widely in whether they listen on canvas, document, window, or legacy keyCode properties. A fixed overlay also hid the lower part of games on phones.

**How to apply:** Add new keyboard controls to the shared frame and preserve keydown/keyup pairs, modifier state, release-on-blur behavior, and layout measurement when changing the panel. Keep the default pad short enough to preserve gameplay visibility.