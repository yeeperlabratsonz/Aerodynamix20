---
name: Media Player folder playback
description: Folder interaction and artwork behavior for ordered playback runs.
---

Double-clicking a playlist folder starts its first item and creates a folder-scoped playback run. Track advancement and previous-track navigation stay within that folder’s item order, while ordinary single-track playback continues to use the global queue.

During a folder-scoped run, the player defaults to the folder’s cover image for every track, even when individual tracks have their own artwork. The player’s artwork toggle switches between the folder cover and the current song cover and keeps that choice as the folder advances. Removing the active folder or its last remaining item must clear the playback context.

**Why:** A folder represents an album-like listening session; crossing into unrelated queue items or changing artwork between tracks breaks that mental model.

**How to apply:** Preserve the folder playback context when advancing or reversing within the folder, and clear it whenever playback starts from a standalone track or the folder is removed.