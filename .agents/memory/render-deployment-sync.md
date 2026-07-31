---
name: Render deployment sync
description: Operational constraint for verifying code changes on the external Render service.
---

The external Render service must be checked independently after a GitHub push. A successful push and a successful GitHub Pages build do not prove that Render has deployed the same commit; the live service can continue serving an older build when automatic deploys are disabled or the service is connected differently.

**Why:** Production debugging can otherwise mistake stale deployment behavior for a code defect, especially when the static GitHub Pages frontend and Render API are updated at different times.

**How to apply:** After pushing backend changes, verify a distinctive response/header or source marker on the Render URL. If it remains stale, trigger Render’s manual deploy for the latest `main` commit and confirm the service start command matches the repository’s `render.yaml`.