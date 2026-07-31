---
name: Card inventory authentication boundary
description: Anonymous and authenticated card collections must merge at account authentication.
---

Cards collected before login live in the Flask session; once a user registers or logs in, those cards must be merged into the database inventory before authenticated card features such as trading or selling read the collection.

**Why:** Users can legitimately open packs before creating an account, and losing that inventory at login makes the collection UI disagree with server-authoritative trade ownership.

**How to apply:** Preserve the merge during both registration and login, deduplicate by card ID, and clear the anonymous inventory only after the database write succeeds.