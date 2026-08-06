---
name: Guest state persistence
description: Durable storage rule for anonymous arcade progress before account creation
---

Anonymous progress must be stored server-side using the long-lived device identifier, with the signed Flask session retained only for authentication and small transient values. This includes discs, purchased games, themes, media unlocks, daily timestamps, and trading cards.

**Why:** Large JSON card inventories and purchase state can exceed practical signed-cookie limits or become unreliable across revisits and deployments.

**How to apply:** Keep guest reads and writes behind the shared guest-state helpers, and merge all guest progress into the user record at registration or login before clearing the guest row.

The device identifier cookie must always use `Path=/`; without an explicit root path, browsers can create separate anonymous identities for different URL paths, resetting balances and daily-claim eligibility during navigation.

**Why:** The default cookie path is derived from the response URL, so a cookie created by an API route can be unavailable to page routes and vice versa.

**How to apply:** Any response that creates or refreshes `aerodynamix_device_id` must set the root path explicitly.