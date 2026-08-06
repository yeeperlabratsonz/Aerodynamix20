---
name: Media Player starter pack loading
description: Fast loading and access-gating conventions for bundled Media Player tracks.
---

Bundled Media Player tracks should be represented as metadata-backed items with direct served MP3 audio URLs, rather than downloading every large audio file into browser memory during page initialization. Group the bundled catalog into the named starter pack and load audio on selection. Keep original lossless files outside the playback bundle when archival copies are needed.

The unlock overlay must start hidden while access is checked. Use an explicit pending-access state so the page neither flashes the purchase screen for already-unlocked users nor exposes the player before the server confirms access.

**Why:** Large FLAC downloads made page entry slow and sequential loading could fail independently; smaller MP3 playback files reduce transfer and buffering time, while the visible overlay was rendered before the asynchronous unlock check completed.

**How to apply:** When adding or changing bundled tracks, keep metadata and cover URLs lightweight at startup, keep the shared starter-pack grouping, and preserve the pending-access guard around playlist interaction and loading.