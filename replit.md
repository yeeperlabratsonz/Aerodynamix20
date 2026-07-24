# Aerodynamix

A browser-based gaming and entertainment site featuring embedded games, music, and apps with a Frutiger Aero aesthetic.

## How to run

The workflow **"Start application"** runs `python server.py` which serves the `Aerodynamix/` directory on port 5000.

To start: use the Run button or the "Start application" workflow.

## Access key

The site has an auth gate. The access key is: `Seewithyourmind666$`

Users without a key get a 5-minute free trial, after which they are locked out.

## Project structure

```
docs/
  index.html          # Home / games listing
  apps.html           # Apps page
  music.html          # Music player page
  games/              # Embedded game HTML files
  apps/soundboard/    # Soundboard app
  images/             # Game cover art and UI images
  attached_assets/    # Cloudflare-cached game assets
  main.css            # Global styles
  auth-overlay.js     # Access key gate
  boot-screen.js      # Boot animation
  music-player.js     # Music player logic
  script.js           # Main page scripts
```

## Stack

- Pure HTML/CSS/JS — no build step
- Python `http.server` as the static file server

## User preferences

_None recorded yet._
