---
name: Mobile game keyboard
description: Every catalog game receives the touch keyboard through the shared game-frame wrapper.
---

The on-screen keyboard belongs in `game-frame.html`, not inside individual games. It dispatches modern and legacy keyboard events into the iframe and releases held keys when touch, focus, visibility, or iframe state changes.

**Why:** All games use the shared wrapper, while the embedded games vary widely in whether they listen on canvas, document, window, or legacy keyCode properties.

**How to apply:** Add new keyboard controls to the shared frame and preserve keydown/keyup pairs, modifier state, and release-on-blur behavior.