---
name: Scoped session nesting
description: Why helper functions in server.py must not close the shared scoped session when called from inside another database operation.
---

`server.py` uses SQLAlchemy's `scoped_session` for `DBSession()`. Within the same thread, every call to `DBSession()` returns the *same* session object.

**Why:** If a helper function creates its own `DBSession()` and closes it while a caller is still using an object bound to that same session, the object becomes detached and later operations (like `db.refresh(user)`) fail with "Instance is not bound to a Session".

**How to apply:** Pass the caller's session into helpers when they are called from inside another DB operation, and only close the session in the helper when it created the session itself. Never open a second `DBSession()` inside a function that is meant to share a transaction with its caller.
