---
name: WebRTC calling architecture
description: One-to-one browser video calls use the Flask app as an authenticated polling-based signaling relay.
---

One-to-one calls keep media peer-to-peer in the browser. The server stores short-lived call sessions and relays SDP offers/answers and ICE candidates through authenticated HTTP polling; it does not proxy audio or video.

**Why:** This fits the existing Flask/vanilla JavaScript architecture without adding a real-time service or provider dependency.

**How to apply:** Keep call endpoints restricted to the two participants, clean up signaling data when calls end, queue ICE candidates until the remote description exists, and configure `TURN_SERVER`, `TURN_USERNAME`, and `TURN_CREDENTIAL` before relying on this for users behind restrictive NATs or firewalls.