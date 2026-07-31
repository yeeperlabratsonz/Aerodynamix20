---
name: Game purchase identifiers
description: Shop purchase keys must remain compatible with the actual Games-page and game-frame URLs.
---

Game purchases are keyed by URL path, so the Shop, Games page, and game-frame access check must share canonical identifiers or an explicit compatibility map.

**Why:** Several games used different paths in the Shop and library, causing successful purchases to be stored but hidden from the library and rejected by the trial access check.

**How to apply:** When replacing a game file or changing a game link, preserve the old key in the compatibility map and make Shop ownership, library filtering, and game-frame access use the same matcher.