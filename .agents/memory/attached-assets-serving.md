---
name: Attached assets serving path
description: Where user-uploaded attached_assets files live versus where the web server serves them.
---

User uploads arrive at the root `attached_assets/` directory. The Flask app in `server.py` serves static files from `docs/`, so only files inside `docs/` are reachable via URL. Any game or asset that needs to be loaded by the site must be copied into `docs/attached_assets/`, not left in the root upload folder.

**Why:** The preview/game links in `docs/index.html` are relative to `docs/`, so they resolve to `docs/attached_assets/`. Files present only in root `attached_assets/` return 404 when accessed through the site.

**How to apply:** After a user uploads a new game HTML or image to `attached_assets/`, copy it into `docs/attached_assets/` and update `docs/index.html` to reference it. Keep both copies in sync if both directories are tracked in git.
