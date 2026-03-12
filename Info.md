# MLBB-Overlay / MLBB Broadcast Suite — System Report (Current State)

Last updated: 2026-03-10

This document describes the **current** architecture and behavior of the project in this repository, including:

- What each module does (`server`, `hub`, `overlay`, legacy `control-panel`)
- How clients connect (REST + Socket.IO)
- How data is stored (absolute-path persistence under `server/public/database`)
- The **new component-driven layout model** (atoms + bindings)
- Current refactor status, invariants, and known issues / next steps

---

## 1) High-level Architecture

The system consists of three active modules:

- **`server/`**
  - Node.js + Express + Socket.IO
  - **Authoritative** source of truth for:
    - live match state
    - layouts
    - theme
    - static assets (heroes, maps, backgrounds, frames, etc.)
  - Persists JSON state on disk.

- **`hub/`**
  - Vite + React application (“Hub UI”)
  - Used by the operator to:
    - control match draft state (teams, players, picks/bans, map, phase)
    - manage layouts (select active layout)
    - edit layouts (component-based editor)
    - manage theme (upload images/fonts, change colors/toggles)

- **`overlay/`**
  - Static HTML/CSS/vanilla JS page
  - Renders a 1920×1080 stage scaled to the browser source
  - Loads theme + layout, then renders **layout components** using live match state from server

There is also a **legacy** module:

- **`control-panel/`**
  - Older implementation of the operator UI.
  - Some assets (favicon) may be referenced as a fallback by the server.

---

## 2) Runtime Topology (How the pieces talk)

### Server
- Default address:
  - Binds to `0.0.0.0:3000` so it is reachable on LAN.
- Provides:
  - REST endpoints under `/api/*`
  - Socket.IO endpoint at the same origin
  - Static files under `/Assets/*`
  - Overlay page under `/overlay`

### Hub
- Runs on Vite dev server by default:
  - `http://localhost:5173`
- Must be configured to point to server origin using:
  - `hub/.env` → `VITE_SERVER_URL=http://localhost:3000`
- Uses:
  - REST for “intent updates” to match state (`POST /api/matchdata`)
  - REST for layouts/theme
  - Socket.IO mainly for **subscriptions** (`STATE_SYNC`, etc.)

### Overlay
- Served from the server origin:
  - `http://<server>:3000/overlay/?id=<layoutId>`
- Uses:
  - REST to load theme/layout/initial match state
  - Socket.IO to subscribe to state + layout updates

---

## 3) Persistent Storage (Disk)

### Primary database directory
The authoritative persistent JSON files are stored under:

- `server/public/database/`

This directory is created/populated by `hardBootstrap()` at server startup.

### Key persisted files

- **Layouts**
  - `server/public/database/layouts.json`

- **Live match state**
  - `server/matchState.json`
    - (This file is used by the server’s match state load/save path.)

- **Theme (DB mirror for inspection/debug)**
  - `server/public/database/theme.json`

- **Legacy-ish DB templates (used for ensuring presence / inspection)**
  - `server/public/database/matchdraft.json`
  - `server/public/database/matchdatateam.json`

### Layout file contents
As of now, `server/public/database/layouts.json` contains at minimum:

- `testing`
- `default_draft`

Both are ensured by `ensureDefaultLayoutsExist()`.

---

## 4) Server (`server/index.js`) — Responsibilities

### 4.1 Bootstrapping
At server startup:

- `hardBootstrap()` ensures:
  - `server/public/database/` exists
  - database JSON files exist and are not empty
  - `layouts.json` includes **at least** `testing` and `default_draft`
- A global crash logger is installed:
  - `process.on('uncaughtException')`
  - `process.on('unhandledRejection')`

### 4.2 Static asset serving
The server serves:

- `GET /Assets/*` from `server/public/Assets`
- Optional fallback mounts for voice/sfx from `hub/public/Assets` if present

Asset directories ensured at startup:

- `server/public/Assets/backgrounds`
- `server/public/Assets/frames`
- `server/public/Assets/logos`
- `server/public/Assets/Maps`
- `server/public/Assets/HeroPick`
- `server/public/Assets/VoiceLines`
- `server/public/Assets/Sfx`
- Theme assets:
  - `server/public/Assets/costum/Theme/fonts`
  - `server/public/Assets/costum/Theme/images`

### 4.3 Hero discovery
`scanHeroAssets()` scans discovered files and returns:

- `GET /api/heroes` → `{ heroes: [{ name, hasPortrait, hasVoice, hasAsset }] }`

This is used by Hub hero pick dropdowns.

### 4.4 REST API endpoints (current)

#### Heroes
- `GET /api/heroes`

#### Theme
- `GET /api/theme`
  - Sanitizes `theme.images.heroPickBg` if the referenced file is missing.
- `POST /api/theme`
- `POST /api/theme-reset`
- `POST /api/theme-upload` (multipart)

#### Uploads
- `POST /api/upload` (multipart, categorized)
- `POST /api/uploads/:kind` (multipart)

#### Layouts
- `GET /api/layouts`
- `GET /api/layouts/:id`
  - Case-insensitive lookup.
- `PUT /api/layouts/:id`
  - Validates via Zod layout schema.
  - Case-insensitive write key resolution.
- `POST /api/layouts`
  - Accepts several shapes for bulk/compat.
- `PUT /api/active-layout`

#### Match state
- `GET /api/matchdraft` → `{ draftdata: matchState }`
- `POST /api/matchdata`
  - Intent-based updates.
  - Emits `STATE_SYNC`.
- `POST /api/match-reset`
- `POST /api/state-reset` (legacy naming retained)

### 4.5 Socket.IO events

#### Server → Clients
- `STATE_SYNC` (broadcast)
- `MATCH_STATE_CLEARED` (broadcast)
- `ACTIVE_LAYOUT_CHANGED` (broadcast)
- `LAYOUT_UPDATE` (broadcast)
- `theme_update` (broadcast)
- `VOLUME_CHANGE` (broadcast)

#### Clients → Server
- Legacy/compat:
  - `UPDATE_STATE`
  - `RESET_STATE`
- Intent style:
  - `SET_TEAM_NAME`
  - `SET_TEAM_SCORE`
  - `SET_PLAYER_NAME`
  - `SWAP_PLAYERS`
  - `SET_PICK`
  - `SET_BAN`
  - `SET_MAP_TYPE`
  - `SET_PHASE`
  - `GLOBAL_SWAP`
  - `SET_ACTIVE_LAYOUT`
  - `VOLUME_CHANGE`

**Design direction**: Hub primarily uses REST intents (`/api/matchdata`) and listens to Socket.IO for sync.

---

## 5) Match State Model (Authoritative)

Validated by Zod in `server/validators/schema.js`:

```js
{
  blueTeam: {
    name: string,
    score: number,
    players: string[5],
    picks: string[5], // hero id (lowercase) or "none"
    bans: string[5]
  },
  redTeam: { ...same },
  map: string,
  mapType: string,
  activeLayout: string,
  phase: "draft" | "game" | "ended"
}
```

---

## 6) Layout Model (Component-driven)

Layouts are validated by Zod `layoutSchema` (`server/validators/schema.js`).

A layout looks like:

```js
{
  name: string,
  background: string, // typically "/Assets/backgrounds/<file>" or ""
  frame: string,      // typically "/Assets/frames/<file>" or ""
  components: LayoutComponent[]
}
```

### 6.1 LayoutComponent shapes
The server accepts both:

#### A) Legacy components (id/type driven)
```js
{
  id: string,
  type: "text" | "image",
  x, y, width, height,
  visible?, locked?, alias?, zIndex?, src?
}
```

#### B) New components (component-driven)
```js
{
  instanceId: string,
  atom: string, // e.g. "T1_PICK", "T2_PLAYER_NAME"
  x, y, width, height,
  visible?, locked?, alias?, zIndex?, src?,
  bind: { ... } // flexible object (passthrough)
}
```

### 6.2 Atom semantics (current)
Atoms are defined client-side for the editor in `hub/src/atoms.js`.

Current atom set:

- Team 1:
  - `T1_NAME`
  - `T1_SCORE`
  - `T1_PLAYER_NAME` (bind `idx` 0..4)
  - `T1_PICK` (bind `idx` 0..4)
  - `T1_BAN` (bind `idx` 0..4)
  - `T1_LOGO` (not yet fully wired in overlay)

- Team 2:
  - `T2_NAME`
  - `T2_SCORE`
  - `T2_PLAYER_NAME` (bind `idx` 0..4)
  - `T2_PICK` (bind `idx` 0..4)
  - `T2_BAN` (bind `idx` 0..4)
  - `T2_LOGO` (not yet fully wired in overlay)

- Global:
  - `MAP`

---

## 7) Overlay Renderer (`overlay/app.js`)

### 7.1 Stage + scaling
Overlay renders a 1920×1080 “stage” in `#overlayRoot` and scales it to viewport using a fit calculation.

### 7.2 Bootstrapping
On load it:

- Determines `SERVER_URL`:
  - prefers `window.location.origin`
  - fallback `http://localhost:3000`
- Loads initial state:
  - Layout via `GET /api/layouts/:id`
  - Theme via `GET /api/theme`
  - Match state via `GET /api/matchdraft`
- Connects Socket.IO and subscribes:
  - `STATE_SYNC` to rerender
  - `LAYOUT_UPDATE` / `ACTIVE_LAYOUT_CHANGED` (implementation depends on query params)

### 7.3 Rendering model
Overlay is now **layout-driven**:

- `applyLayoutInPlace(layout)`:
  - creates/removes `.component` DOM nodes so the DOM matches `layout.components`
  - applies layout background/frame URLs

- `renderOverlay(state)`:
  - iterates `layout.components`
  - resolves each component’s output via:
    - **new**: `atom + bind` resolution
    - **legacy**: `id` pattern matching (compat shim)

#### Supported resolutions (new schema)
- `T1_NAME` / `T2_NAME` → team name text
- `T1_SCORE` / `T2_SCORE` → score text
- `T1_PLAYER_NAME` / `T2_PLAYER_NAME` + `bind.idx` → player name
- `T1_PICK` / `T2_PICK` + `bind.idx` → hero portrait
- `T1_BAN` / `T2_BAN` + `bind.idx` → hero portrait (with ban entry animation + SFX)
- Escape hatch:
  - `bind.path` + `bind.format` (`text`, `heroPortrait`, `mapThumb`) for future flexibility

### 7.4 Theme injection
`injectTheme(theme)`:

- sets CSS variables from theme colors/toggles
- loads custom font if configured
- applies theme image layers:
  - heroPickBg → `#background-layer`
  - lowerBg → `#lower-bg`
  - lowerMidBg → `#lower-mid-bg`
  - masterFrame → `#master-frame-layer`

---

## 8) Hub (`hub/`) — Views and Data Flow

### 8.1 Configuration
Hub should be configured via:

- `hub/.env`:
  - `VITE_SERVER_URL=http://localhost:3000`

### 8.2 Routes (App)
`hub/src/App.jsx` uses React Router and provides pages:

- Dashboard (links + utilities)
- `ControlPanel`
- `LayoutManager`
- `DrawControl` (layout editor)

### 8.3 ControlPanel (`hub/src/ControlPanel.jsx`)
Purpose:

- Operator UI for match state

Connectivity:

- Socket.IO:
  - connects to `SERVER_URL`
  - listens to `STATE_SYNC`
- REST intents:
  - all mutations are sent to `POST /api/matchdata`

This implements “server-authoritative intent updates”:

- Team name/score
- Player names
- Picks/bans
- Phase/mapType
- Swap players / global swap

### 8.4 LayoutManager (`hub/src/LayoutManager.jsx`)
Purpose:

- Displays known layout IDs (from `GET /api/layouts`)
- Shows active layout
- Allows setting a layout live (`PUT /api/active-layout`)
- Provides quick overlay URLs

### 8.5 Layout Editor (DrawControl) — component-based editor
Files:

- `hub/src/DrawControl.jsx`
- `hub/src/ComponentLibrarySidebar.jsx`
- `hub/src/ModularCanvas.jsx`
- `hub/src/LayerProperties.jsx`
- `hub/src/atoms.js`

Behavior:

- Loads a layout by ID (`GET /api/layouts/:id`)
- Migrates legacy components into new schema for editing
- Allows adding atoms:
  - click-to-add
  - drag from library and drop onto canvas
- Allows per-component editing:
  - alias, x/y, w/h, visible, locked, bind.idx for slot atoms
- Saves layout (`PUT /api/layouts/:id`)
- Can set active layout live (`PUT /api/active-layout`)
- Background/frame selection:
  - fetches available assets from `/api/backgrounds` and `/api/frames`
  - supports upload via `/api/upload`

### 8.6 HeroSelect (`hub/src/HeroSelect.jsx`)
Purpose:

- Dropdown that fetches heroes from `GET /api/heroes`

---

## 9) Key Invariants / Expectations

- The server is the source of truth.
- Clients should not hardcode `localhost` except for safe defaults; prefer `VITE_SERVER_URL` (Hub) and `window.location.origin` (Overlay).
- Layout rendering is **data-driven**:
  - Overlay should render only `layout.components`.
- Layout persistence should use:
  - `server/public/database/layouts.json` (absolute path via `path.resolve`)

---

## 10) Current Refactor Status (Component-driven Editor)

Implemented:

- New component-driven layout schema (server validator supports legacy + new)
- Layout persistence in `server/public/database/layouts.json`
- Default layout keys ensured (`default_draft`, `testing`)
- Hub editor rebuilt into modular UI (library / canvas / properties)
- Overlay renderer can render from new atom+bind schema (legacy shim remains)
- Hero list is dynamically discovered via `/api/heroes`

In progress / next steps:

- Make overlay strictly enforce new schema (remove legacy id shims) once all layouts are migrated.
- Extend overlay atom coverage:
  - `T1_LOGO`, `T2_LOGO`
  - Map rendering nuances
- Integration QA:
  - Hub save → server persistence → overlay render
  - validate all endpoints in LAN usage

---

## 11) Known Issues / Risks

- **Theme DB mirror vs authoritative theme file**:
  - There is `server/public/database/theme.json` and also `server/public/Assets/costum/Theme/theme.json`.
  - `/api/theme` currently serves in-memory `theme` loaded from `THEME_FILE`.

- **Overlay favicon link**:
  - `overlay/index.html` currently references `http://localhost:3000/favicon.ico`.
  - For LAN deployments, this ideally should be relative (`/favicon.ico`).

- **Legacy socket events**:
  - Some legacy events remain for compatibility; the preferred path is REST intents.

---

## 12) Quick “How to run”

### Server
From `server/`:

- `node index.js`

### Hub
From `hub/`:

- Create `hub/.env`:
  - `VITE_SERVER_URL=http://localhost:3000`
- `npm run dev`

### Overlay
Open:

- `http://localhost:3000/overlay/?id=default_draft`

---

## Appendix A — File/Module Map

- `server/index.js`
  - Express + Socket.IO server
  - persistence, REST, sockets, bootstrapping

- `server/validators/schema.js`
  - Zod schemas for match state and layouts

- `overlay/index.html`
  - overlay DOM + CSS layers

- `overlay/app.js`
  - overlay bootstrapping
  - theme injection
  - layout application
  - component rendering

- `hub/src/ControlPanel.jsx`
  - operator controls

- `hub/src/LayoutManager.jsx`
  - list/set active layouts

- `hub/src/DrawControl.jsx`
  - component-driven layout editor

- `hub/src/HeroSelect.jsx`
  - dynamic hero list dropdown

- `hub/src/ThemeManager.jsx`
  - theme editor + uploads

---

If you want, I can add a second section mapping **exact atom → exact matchState field** and a table of all REST endpoints with request/response shapes.
