---
name: Card trade safety
description: Server-authoritative card trading rules and reservation behavior.
---

Card trades must remain server-authoritative: clients submit card IDs only, the server verifies accepted friendship and ownership, and pending offers reserve cards with unique locks. Pending trades must also appear in the Messages conversation list even when no DM exists yet.

**Why:** Client-provided card metadata can be manipulated, and without reservations the same collectible can be promised or sold in multiple pending trades. A trade with no preceding DM is otherwise invisible to its recipient.

**How to apply:** Keep offer creation, cancellation, rejection, acceptance, and card selling inside transactional server paths. Revalidate both inventories on acceptance and transfer both sides atomically. Build conversation discovery from both DMs and pending trades.