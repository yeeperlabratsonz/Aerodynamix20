---
name: Beat Lab stem separation
description: The durable architecture and constraints for separating imported Beat Lab songs into editable stems.
---

Stem Seperator uses local Demucs `htdemucs_6s` processing on the Flask server for actual source separation. The browser uploads the selected local audio only when the user explicitly chooses “Separate stems”; the server queues a background job, exposes status polling, and then returns temporary vocals, drums, bass, and other WAV URLs, which the browser mixes with independent gain and mute controls.

**Why:** The existing browser tone filters only changed frequency content and could not honestly be described as stem separation. A real model was required, while keeping imported songs local by default.

**How to apply:** Keep uploads bounded and temporary, clean expired stem jobs, use the small six-source model with one-thread CPU inference, one-second chunks, no overlap, and no shifts on constrained hosts, expose only the four app-supported stems, use asynchronous processing for normal-length songs so proxy request timeouts do not interrupt Demucs, and do not label frequency filters as source separation.