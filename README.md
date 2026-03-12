# MLBB Broadcast Suite

A real-time esports broadcast suite for Mobile Legends: Bang Bang (MLBB) built around a **server-authoritative state API**, a **React Hub** (control + editor), and a **dynamic overlay renderer**. Layouts are stored as JSON and the overlay is generated at runtime from a `layout_id` (no hardcoded CSS positions).

## Architecture Overview

The system is composed of three interconnected modules:

### 1. The Core API (State, Layout, Theme Authority)
- **Location**: `/server`
- **Technology**: Node.js, Express, Socket.io, Zod
- **Purpose**: Source of truth for **live match state**, **saved overlay layouts**, and **theme.json**
- **Features**:
  - Binds to `0.0.0.0:3000` for LAN access
  - Zod schema validation for data integrity
  - Atomic state persistence to `matchState.json`
  - Layout persistence to `layouts.json`
  - Theme persistence to `server/public/Assets/costum/Theme/theme.json`
  - Real-time state synchronization via Socket.io (`STATE_SYNC`)
  - Theme broadcast via Socket.io (`theme_update`)

### 2. The Dynamic OBS Overlay (Renderer)
- **Location**: `/overlay`
- **Technology**: Vanilla HTML/JavaScript/CSS
- **Purpose**: A “dumb shell” that:
  - Loads a layout by id (ex: `/overlay/?id=default_draft`)
  - Paints background + positioned components from JSON
  - Injects live match state into those components

- **Features**:
  - Connects to State Server via Socket.io
  - Dynamic DOM updates based on match state
  - Proportional 1920x1080 stage scaling using `Math.min(wRatio, hRatio)`
  - Theme engine: `injectTheme()` maps `theme.json` to CSS variables and image layers
  - Minimal UI proving the data bridge works

### 3. The Hub (React)
- **Location**: `/hub`
- **Technology**: Vite + React
- **Views**:
  - Control Panel (server-authoritative state intents)
  - Layout Editor (WYSIWYG drag/resize, saves to `layouts.json`)
  - Theme Manager (uploads + live theme updates)

## Quick Start

### Prerequisites
- Node.js (v14 or higher)

1. **Clone or navigate to the project directory**
   ```bash
   cd MLBB-Overlay
   ```

2. **Install Server Dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Start the State Server**
   ```bash
   cd ../server
   node index.js
   ```
   The server will start on `http://0.0.0.0:3000`

4. **View the Overlay**
   - Open:
     - `http://localhost:3000/overlay/?id=default_draft`
   - To allow the overlay to follow Hub scene changes live:
     - `http://localhost:3000/overlay/?id=default_draft&follow=1`
   - Add that URL as an OBS Browser Source.

5. **Run the Hub (Vite dev)**
   ```bash
   cd hub
   npm install
   npm run dev
   ```

## Usage

### Testing the Data Flow

1. **Start the server** - You should see "MLBB State Server running on http://0.0.0.0:3000"
2. **Open the overlay** - Navigate to `http://localhost:3000` to see the basic overlay
3. **Open browser console** - You should see connection logs and state updates

### Manual State Testing (Socket.io)

You can test state updates by opening the browser console on any client and emitting Socket.io events:

```javascript
// Connect to socket
const socket = io('http://localhost:3000');

// Preferred: intent-style updates
socket.emit('SET_TEAM_NAME', { side: 'blueTeam', name: 'Team Alpha' });
socket.emit('SET_TEAM_SCORE', { side: 'blueTeam', score: 1 });
socket.emit('SET_PLAYER_NAME', { side: 'blueTeam', idx: 0, name: 'Player 1' });
socket.emit('SET_PICK', { side: 'blueTeam', idx: 0, hero: 'ling' });
socket.emit('SET_BAN', { side: 'redTeam', idx: 0, hero: 'arlott' });
socket.emit('SWAP_PLAYERS', { side: 'blueTeam', aIdx: 0, bIdx: 1 });
socket.emit('GLOBAL_SWAP');
```

## File Structure

```
MLBB-Overlay/
├── server/
│   ├── index.js              # Main server file
│   ├── validators/
│   │   └── schema.js         # Zod validation schemas
│   ├── public/
│   │   └── assets/           # Static assets for overlay
│   ├── package.json
│   └── matchState.json       # Persistent state storage (auto-generated)
│   └── layouts.json          # Saved overlay layouts
│   └── theme.json            # Saved theme data
├── overlay/
│   ├── index.html            # Overlay HTML
│   └── app.js                # Overlay JavaScript client
├── hub/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HubHome.tsx
│   │   │   ├── ControlPanel.tsx
│   │   │   └── LayoutEditor.tsx
│   │   └── lib/
│   │       ├── api.ts
│   │       └── socket.ts
│   └── package.json
└── README.md
```

## API Endpoints

- **WebSocket**: `ws://localhost:3000` (Socket.io)
- **Overlay**: `http://localhost:3000/overlay/?id=<layout_id>`
- **Static Assets**: `http://localhost:3000/assets/`

### Layout REST API

- `GET /api/layouts` -> returns all layouts
- `GET /api/layouts/:id` -> returns one layout
- `PUT /api/layouts/:id` -> validates + saves one layout

### Socket.io Events

- **STATE_SYNC**: Broadcasted to all clients when state updates
- **theme_update**: Broadcasted to all clients when theme updates
- **UPDATE_STATE**: Legacy full-state update (kept for compatibility)
- **SET_TEAM_NAME**, **SET_TEAM_SCORE**
- **SET_PLAYER_NAME**, **SWAP_PLAYERS**
- **SET_PICK**, **SET_BAN**
- **SET_MAP_TYPE**, **SET_PHASE**
- **GLOBAL_SWAP**
- **STATE_ERROR**: Emitted when state validation fails

### Theme REST API

- `GET /api/theme`
- `POST /api/theme`
- `POST /api/theme-reset`
- `POST /api/theme-upload` (multipart form-data; `kind=font|image`, `key=images.*|typography.fontFile`)

## State Schema

The match state follows this structure:

```javascript
{
  blueTeam: {
    name: string,
    score: number,
    picks: string[5],  // Hero names or "none"
    bans: string[5]    // Hero names or "none"
  },
  redTeam: {
    name: string,
    score: number, 
    picks: string[5],
    bans: string[5]
  },
  phase: "draft" | "game" | "ended"
}
```

## Development Notes

- The server automatically saves state to `matchState.json` on every update
- State validation prevents invalid data from corrupting the system
- The overlay is designed to be "dumb" - it only displays what the server provides
- All state mutations go through the server's validation layer

## Hub (React) Setup (Outline Only)

Initialize the Hub app (recommended):

```bash
mkdir hub
cd hub
npm create vite@latest . -- --template react
npm install
```

Recommended libraries for drag/resize in the Layout Editor:

- `react-rnd` (simple drag + resize boxes)
- or `@dnd-kit/core` + a resize library if you want more control

Suggested component structure:

- `src/pages/HubHome.tsx`
  - Shows server status, local IPs, and links
- `src/pages/ControlPanel.tsx`
  - Forms for team names, scores, picks/bans
  - Emits `UPDATE_STATE`
- `src/pages/LayoutEditor.tsx`
  - Background image upload/url
  - Canvas with draggable/resizable boxes (`react-rnd`)
  - Save -> `PUT /api/layouts/:id`
- `src/lib/api.ts`
  - `getLayout(id)`, `saveLayout(id, layout)`
- `src/lib/socket.ts`
  - Socket.io client wrapper

## Troubleshooting

- **Port conflicts**: Ensure port 3000 is available for the server
- **CORS issues**: The server allows all origins for development
- **Overlay not loading**: Verify the server is running and accessible