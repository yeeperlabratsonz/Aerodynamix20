---
name: Shared mobile responsive foundation
description: Responsive navigation and install behavior are centralized so new pages do not recreate squeezed mobile headers.
---

The mobile experience uses a shared responsive layer loaded after page-specific styles, plus one navigation script on every navigable page. Phone portrait uses a compact header with a menu panel; phone landscape uses a shorter header and viewport-first content sizing. The web manifest, Apple metadata, and shared 512px icon belong on every route that can be added to the home screen.

**Why:** The original pages had competing inline responsive rules and tried to fit the full desktop navigation into a phone header, which caused cramped portrait and landscape layouts.

**How to apply:** When adding a new page with site navigation, include the shared mobile stylesheet, mobile navigation script, manifest link, Apple touch icon, and theme metadata. Avoid adding a second mobile navigation implementation unless the page is an intentional full-screen player.