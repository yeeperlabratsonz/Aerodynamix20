---
name: Server port reuse
description: Avoiding `Address already in use` when restarting the static Python server workflow.
---

`server.py` binds port 5000. If the workflow is restarted before the kernel fully releases the socket, the new process fails with `OSError: [Errno 98] Address already in use`.

**Why:** The default `socketserver.TCPServer` does not set `SO_REUSEADDR`, so a socket in `TIME_WAIT` from the old process blocks the new bind.

**How to apply:** Set `socketserver.TCPServer.allow_reuse_address = True` near the top of `server.py`, before creating the server instance. This lets the new process reuse the port immediately on restart.
