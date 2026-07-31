---
name: Render Demucs resource ceiling
description: The resource limit that prevents real Demucs separation from completing on the free Render web service.
---

Render's free web service can start the Flask API and load the small `htdemucs_6s` model, but the worker is terminated during inference. The API then returns a proxy 502 and the job later becomes 404 after the instance restarts. The Render blueprint now targets the paid `standard` web tier.

**Why:** The project requires real source separation, not browser frequency filtering. The smallest available Demucs model and strict CPU settings were tested locally and still exceeded the free service's runtime resource ceiling.

**How to apply:** Keep the low-memory settings in the code and run the separation service on the larger Render tier or a separate worker service. Keep one Gunicorn worker because job state is file-backed and process-local. Do not treat more browser polling retries as a fix for a process-level OOM/restart.