---
name: Shop secret full access
description: The Shop has a hidden keyboard sequence that activates the existing alternate-access state.
---

The Shop-only sequence ArrowUp, ArrowDown, 2, 0, 0, 5 activates the existing full-access state through the server-backed session endpoint. It is intentionally absent from the visible UI; client-side sequences are discoverable, so this is an easter egg rather than a security boundary.

**Why:** The product needs a hidden way to switch the current browser session from basic mode to the existing full experience without duplicating access logic.

**How to apply:** Keep the sequence scoped to the Shop page and use the shared authorized state so games, themes, media, and server-side purchase routes stay consistent.