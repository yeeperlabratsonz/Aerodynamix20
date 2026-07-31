---
name: Default basic access
description: The arcade now starts visitors in basic mode while retaining the alternate access implementation internally.
---

The basic arcade experience is the default for new browser sessions. The alternate access path remains in place for internal use, but it must not be required for normal visitors or advertised in the public UI.

**Why:** The product should open directly into the arcade while preserving the existing implementation for internal use and future compatibility.

**How to apply:** When changing access gates, boot behavior, game launch checks, or public copy, keep basic mode functional without a key and avoid exposing alternate-access terminology.