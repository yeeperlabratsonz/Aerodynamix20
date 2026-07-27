---
name: Game purchase persistence
description: How purchased game state is stored and synced for free-trial vs logged-in users.
---

Game unlocks are stored in two places:

- **localStorage** (`aerodynamixPurchasedGames`): primary store for anonymous users so a bought game stays playable across browser sessions on the same device.
- **Database** (`users.purchased_games`): canonical store for logged-in users so purchases follow the account across devices.

When the game-frame page loads, it checks localStorage first, then fetches `/api/discs/purchased-games` to merge any DB-stored games into localStorage. This keeps the two sources consistent without relying on the login flow to refresh the cache.

**Why:** Session cookies alone don't persist for anonymous users, and localStorage alone doesn't cover logged-in users on new devices.

**How to apply:** Any new one-time purchase feature (e.g., levels, media packs) should use the same localStorage + DB + sync-on-load pattern.
