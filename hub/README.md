# Hub (React + Vite)

The Hub is the operator UI for the MLBB Broadcast Suite.

## What it contains

- **Control Panel**: updates match state via server-authoritative Socket.IO intents
- **Layout Editor (DrawControl)**: drag/resize components on a 1920x1080 plane and saves layouts to the server
- **Theme Manager**: edits `theme.json` and uploads theme assets (fonts/images) via the server

## Run

```bash
npm install
npm run dev
```

The Hub talks to the server at `http://localhost:3000`.
