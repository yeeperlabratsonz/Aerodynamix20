---
name: Trading card rarity maintenance
description: Constraints to preserve when changing the collectible card set or rarity assignments.
---

The collectible card pool and its weighted-pull list must always have the same length, and sell-value lookups must normalize rarity casing before accessing the payout table.

**Why:** A rarity reassignment can silently make pack purchases fail at runtime if the weight count is not updated with the card count; inconsistent casing can also make the displayed sell value differ from the server payout.

**How to apply:** Whenever adding, removing, or reclassifying a card, update the per-rarity weight distribution and verify the weights sum to 100. Keep sell-value keys and normalized lookup casing aligned.

Secret rarities are a deliberate exception: keep their pull weight outside the public odds display, while still including them in the server pool, client rendering, and normalized sell-value map.

**Why:** The Secret Greatest Game card is intended to be discoverable only through an extraordinarily rare pull, not advertised as part of the standard pack odds.

**How to apply:** Treat hidden rarities as real weighted entries for `random.choices`; omit them only from the user-facing odds copy and give them an explicit sell payout.