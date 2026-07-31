---
name: Persistent full access
description: Rules for remembering the arcade's alternate full-access unlock
---

Once a visitor successfully uses the direct access key or the hidden Shop sequence, full access should return on later visits without another code entry. The browser flag is only a fast UI restore; the server must also persist the unlock by device and account.

**Why:** Session storage is cleared when a browser session ends, while the user's requested behavior spans future visits and must keep server-side features consistent.

**How to apply:** Preserve the shared access endpoint, restore the client authorization state from persistent browser storage, and merge guest full access into the user record during registration/login. Do not change the default basic-access behavior for users who have never unlocked it.