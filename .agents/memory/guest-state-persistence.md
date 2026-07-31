---
name: Guest state persistence
description: Durable storage rule for anonymous arcade progress before account creation
---

Anonymous progress must be stored server-side using the long-lived device identifier, with the signed Flask session retained only for authentication and small transient values. This includes discs, purchased games, themes, media unlocks, daily timestamps, and trading cards.

**Why:** Large JSON card inventories and purchase state can exceed practical signed-cookie limits or become unreliable across revisits and deployments.

**How to apply:** Keep guest reads and writes behind the shared guest-state helpers, and merge all guest progress into the user record at registration or login before clearing the guest row.