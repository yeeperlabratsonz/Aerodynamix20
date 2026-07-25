# Aerodynamix

A browser-based game arcade with a Frutiger Aero aesthetic. Hosts 25+ browser games including Run 3, Slope, Minecraft, PvZ, Hobo series, Fruit Ninja, and more. Includes a music player and a settings/theme page.

## Stack

- **Backend:** Python (`server.py`) — simple `http.server` static file server
- **Frontend:** Plain HTML/CSS/JS in `docs/`
- **No build step** — edit files in `docs/` directly

## How to run

```
python server.py
```

Serves `docs/` on port 5000.

## Key files

- `docs/index.html` — main game listing page
- `docs/game-frame.html` — game iframe wrapper
- `docs/auth-overlay.js` — access key / trial gate
- `docs/script.js` — main site logic
- `docs/main.css` — global styles
- `docs/games/` — self-hosted game directories
- `attached_assets/` — additional game HTML files (also served)

## Access

The site has an access key gate. A free 5-minute trial is available with the key `freetrial`.

## User preferences

