---
name: Server-enforced bans
description: Permanent account and device ban behavior for the social site
---

Permanent bans are enforced in the Flask request guard and authentication routes, not only in the Connect frontend. Banned usernames are normalized case-insensitively; devices are identified by the durable `aerodynamix_device_id` cookie and associated with accounts on successful registration or login.

**Why:** Client-only moderation can be bypassed, while the app needs banned accounts and their known devices blocked across Connect and the rest of the site.

**How to apply:** Keep ban checks before all routes and before password validation. Be transparent that device history from before association tracking existed cannot be reconstructed, and that clearing cookies or changing devices is not a perfect hardware-level identity signal.