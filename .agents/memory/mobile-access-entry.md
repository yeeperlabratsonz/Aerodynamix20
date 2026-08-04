---
name: Mobile access entry
description: Touch-friendly path for entering the full-access code on phones and tablets
---

The Shop page provides an “Enter access code” button that opens a touch-friendly modal for phones and tablets. It must use the same access endpoint and persistent browser flag as the desktop code path and hidden Shop sequence. The endpoint must validate the submitted mobile code server-side; browser-only validation is not sufficient for the deployed site.

**Why:** Mobile devices cannot reliably perform the desktop keyboard sequence, but the user still needs access to the same one-time unlock behavior.

**How to apply:** Keep the control in the Shop header, preserve responsive sizing and focus behavior, and do not create a separate access state or validation rule. Keep the code optional for the hidden keyboard sequence, but reject non-empty incorrect codes server-side.