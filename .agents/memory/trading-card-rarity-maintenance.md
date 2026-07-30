---
name: Trading card rarity maintenance
description: Constraints to preserve when changing the collectible card set or rarity assignments.
---

The collectible card pool and its weighted-pull list must always have the same length, and sell-value lookups must normalize rarity casing before accessing the payout table.

**Why:** A rarity reassignment can silently make pack purchases fail at runtime if the weight count is not updated with the card count; inconsistent casing can also make the displayed sell value differ from the server payout.

**How to apply:** Whenever adding, removing, or reclassifying a card, update the per-rarity weight distribution and verify the weights sum to 100. Keep sell-value keys and normalized lookup casing aligned.