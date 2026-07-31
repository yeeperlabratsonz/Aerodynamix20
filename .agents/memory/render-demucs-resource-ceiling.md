---
name: Render Demucs resource ceiling
description: The resource limit that prevents real Demucs separation from completing on the free Render web service.
---

Render's undersized web service can start the Flask API and load Demucs models, but the worker is terminated during inference. The API then returns a proxy 502 and the job later becomes 404 after the instance restarts. The Render blueprint now targets the paid `pro` web tier and uses the lighter single `83fc094f` model.

**Why:** The project requires real source separation, not browser frequency filtering. The live service reported a 512 MB container limit, while the single MDX model peaks around 1.2 GB locally; Pro provides 4 GB for the Flask process and inference subprocess.

**How to apply:** Keep the low-memory settings in the code and run the separation service on the Pro Render tier or a separate worker service. Keep one Gunicorn worker because job state is file-backed and process-local. Do not treat more browser polling retries as a fix for a process-level OOM/restart.