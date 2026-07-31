---
name: Trade modal independent loading
description: The two card inventories and pending trade history must load independently in the trade modal.
---

The trade modal must not use one all-or-nothing loading path for the current user, friend, and trade history. Render each successful response independently and show a targeted error for only the failed side.

**Why:** A failed friend lookup or stale trade-history request previously cleared a successfully loaded current-user inventory and made users appear to have no cards.

**How to apply:** Keep the current-user card grid authoritative and visible whenever `/api/tradeable-cards/self` succeeds, even if the peer-card or pending-trades request fails.