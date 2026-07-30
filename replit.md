# Aerodynamix

A browser-based game arcade with a Frutiger Aero aesthetic. Hosts 25+ browser games including Run 3, Slope, Minecraft, PvZ, Hobo series, Fruit Ninja, and more. Includes a music player, trading card system, virtual currency (Dynamix Discs), shop, and social features (profiles, friends, DMs, WebRTC calls).

## Stack

- **Backend:** Python/Flask (`server.py`) — REST API + serves static frontend from `docs/`
- **Database:** SQLite (local: `dynamix.db`) / PostgreSQL (production via `DATABASE_URL`)
- **Frontend:** Plain HTML/CSS/JS in `docs/` — no build step
- **ORM:** SQLAlchemy

## How to run

```
python server.py
```

Serves on port 5000. The `SESSION_SECRET` environment variable is used for Flask session signing.

## Access

The site has an access key gate. A free 5-minute trial is available with the key `freetrial`.

## Key files

- `docs/index.html` — main game listing page
- `docs/game-frame.html` — game iframe wrapper
- `docs/auth-overlay.js` — access key / trial gate
- `docs/script.js` — main site logic
- `docs/main.css` — global styles
- `docs/games/` — self-hosted game directories
- `docs/shop.html` / `docs/shop.js` — Dynamix Discs shop
- `docs/discs.html` — virtual currency display
- `docs/card-collection.html` — trading card collection
- `docs/dynamix-connect.html` — social/friends hub
- `attached_assets/` — additional game HTML files (also served under `docs/attached_assets/`)

## User preferences
