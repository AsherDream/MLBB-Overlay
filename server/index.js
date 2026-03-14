// server/index.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { matchStateSchema, layoutSchema } = require('./validators/schema');

// ─────────────────────────────────────────────────────────────
// Core paths (absolute, LAN‑safe)
// ─────────────────────────────────────────────────────────────

const ROOT_DIR = __dirname;

// Persisted JSON files
const STATE_FILE = path.resolve(ROOT_DIR, 'matchState.json');
const DB_DIR = path.resolve(ROOT_DIR, 'public', 'database');
const LAYOUTS_FILE = path.resolve(DB_DIR, 'layouts.json');

// Theme lives with other overlay assets
const THEME_DIR = path.resolve(ROOT_DIR, 'public', 'Assets', 'costum', 'Theme');
const THEME_FILE = path.resolve(THEME_DIR, 'theme.json');

// Asset roots
const ASSETS_ROOT = path.resolve(ROOT_DIR, 'public', 'Assets');
const BACKGROUNDS_DIR = path.resolve(ASSETS_ROOT, 'backgrounds');
const FRAMES_DIR = path.resolve(ASSETS_ROOT, 'frames');
const LOGOS_DIR = path.resolve(ASSETS_ROOT, 'logos');
const MAPS_DIR = path.resolve(ASSETS_ROOT, 'Maps');
const HERO_PICK_DIR = path.resolve(ASSETS_ROOT, 'HeroPick');
const VOICE_LINES_DIR = path.resolve(ASSETS_ROOT, 'VoiceLines');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

function atomicWriteJson(filePath, data) {
  try {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.error('[atomicWriteJson] failed for', filePath, err.message);
  }
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// Basic theme; not schema‑driven yet, but kept minimal and deterministic
function createDefaultTheme() {
  return {
    typography: {
      fontFile: '',
      useCustomFont: false,
      fontSizeMultiplier: 1.0,
    },
    images: {
      heroPickBg: '',
      lowerBg: '',
      lowerMidBg: '',
      masterFrame: '',
    },
    colors: {
      bluePrimary: '#00d2ff',
      blueDark: '#003e4d',
      redPrimary: '#ff2a2a',
      redDark: '#4d0000',
      scoreBlue: '#00d2ff',
      scoreRed: '#ff2a2a',
      playerName: '#ffffff',
      phaseText: '#ffffff',
      auraBan: '#ff0000',
      auraPick: '#ffffff',
    },
    toggles: {
      disableGlow: false,
      hidePattern: false,
      disableBoxShadow: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Absolute Bootstrap (Task 1)
// ─────────────────────────────────────────────────────────────

function createDefaultMatchState() {
  return {
    blueTeam: {
      name: 'TEAM BLUE',
      score: 0,
      players: ['', '', '', '', ''],
      picks: [],
      bans: [],
      logo: 'default_logo.png',
    },
    redTeam: {
      name: 'TEAM RED',
      score: 0,
      players: ['', '', '', '', ''],
      picks: [],
      bans: [],
      logo: 'default_logo.png',
    },
    map: 'The Land of Dawn',
    phase: 'draft',
    activeLayout: 'testing',
  };
}

let matchState = createDefaultMatchState();      // in‑memory master state
let layouts = {};                                // id → layout object
let theme = createDefaultTheme();                // in‑memory theme

function createDefaultLayouts() {
  // Base layouts validated against layoutSchema, using schema defaults
  const draftBase = {
    name: 'default_draft',
    background: '',
    frame: '',
    components: [],
  };
  const testingBase = {
    name: 'testing',
    background: '',
    frame: '',
    components: [],
  };

  return {
    default_draft: layoutSchema.parse(draftBase),
    testing: layoutSchema.parse(testingBase),
  };
}

function hardBootstrap() {
  ensureDir(DB_DIR);
  ensureDir(THEME_DIR);
  ensureDir(ASSETS_ROOT);
  ensureDir(BACKGROUNDS_DIR);
  ensureDir(FRAMES_DIR);
  ensureDir(LOGOS_DIR);
  ensureDir(MAPS_DIR);
  ensureDir(HERO_PICK_DIR);
  ensureDir(VOICE_LINES_DIR);

  // 1) matchState.json – single source of truth for match data
  let stateOk = false;
  if (fs.existsSync(STATE_FILE)) {
    try {
      const parsed = readJson(STATE_FILE);
      matchState = matchStateSchema.parse(parsed);
      stateOk = true;
    } catch (err) {
      console.warn('[hardBootstrap] matchState.json invalid, regenerating:', err.message);
    }
  }
  if (!stateOk) {
    matchState = createDefaultMatchState();
    atomicWriteJson(STATE_FILE, matchState);
    console.log('[hardBootstrap] wrote fresh matchState.json from schema defaults');
  }

  // 2) theme.json – simple default theme if missing/invalid
  let themeOk = false;
  if (fs.existsSync(THEME_FILE)) {
    try {
      const parsed = readJson(THEME_FILE);
      if (parsed && typeof parsed === 'object') {
        theme = parsed;
        themeOk = true;
      }
    } catch (err) {
      console.warn('[hardBootstrap] theme.json invalid, regenerating:', err.message);
    }
  }
  if (!themeOk) {
    theme = createDefaultTheme();
    atomicWriteJson(THEME_FILE, theme);
    console.log('[hardBootstrap] wrote fresh theme.json');
  }

  // 3) layouts.json – basic layouts object validated by layoutSchema
  let layoutsOk = false;
  if (fs.existsSync(LAYOUTS_FILE)) {
    try {
      const parsed = readJson(LAYOUTS_FILE);
      const next = {};
      if (parsed && typeof parsed === 'object') {
        for (const [id, layout] of Object.entries(parsed)) {
          next[id] = layoutSchema.parse(layout);
        }
        layouts = next;
        layoutsOk = true;
      }
    } catch (err) {
      console.warn('[hardBootstrap] layouts.json invalid, regenerating:', err.message);
    }
  }
  if (!layoutsOk) {
    layouts = createDefaultLayouts();
    atomicWriteJson(LAYOUTS_FILE, layouts);
    console.log('[hardBootstrap] wrote fresh layouts.json with default_draft + testing');
  }

  console.log('🛠️ Absolute bootstrap completed');
}

// Run bootstrap once at startup
hardBootstrap();

// ─────────────────────────────────────────────────────────────
// Intent-based reducer (Task 2)
// ─────────────────────────────────────────────────────────────

function applyMatchIntent(current, payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const intent = String(p.intent || '').trim();

  const sideKey = (s) => (s === 'blueTeam' ? 'blueTeam' : 'redTeam');

  const clampIdx = (v, maxInclusive) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(maxInclusive, Math.trunc(n)));
  };

  const clampScore = (v) => {
    const n = parseInt(String(v ?? '0'), 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(99, n));
  };

  if (intent === 'SET_TEAM_NAME') {
    const s = sideKey(p.side);
    const name = String(p.name ?? '');
    return { ...current, [s]: { ...current[s], name } };
  }

  if (intent === 'SET_TEAM_SCORE') {
    const s = sideKey(p.side);
    const score = clampScore(p.score);
    return { ...current, [s]: { ...current[s], score } };
  }

  if (intent === 'SET_PLAYER_NAME') {
    const s = sideKey(p.side);
    const idx = clampIdx(p.idx, 4);
    const name = String(p.name ?? '');
    const players = Array.isArray(current[s]?.players)
      ? [...current[s].players]
      : ['', '', '', '', ''];
    players[idx] = name;
    return { ...current, [s]: { ...current[s], players } };
  }

  if (intent === 'SWAP_PLAYERS') {
    const s = sideKey(p.side);
    const a = clampIdx(p.aIdx, 4);
    const b = clampIdx(p.bIdx, 4);
    const players = Array.isArray(current[s]?.players)
      ? [...current[s].players]
      : ['', '', '', '', ''];
    const tmp = players[a];
    players[a] = players[b];
    players[b] = tmp;
    return { ...current, [s]: { ...current[s], players } };
  }

  if (intent === 'SET_PICK') {
    const s = sideKey(p.side);
    const idx = clampIdx(p.idx, 4);
    const hero = String(p.hero ?? 'none');
    const picks = Array.isArray(current[s]?.picks)
      ? [...current[s].picks]
      : ['none', 'none', 'none', 'none', 'none'];
    picks[idx] = hero;
    return { ...current, [s]: { ...current[s], picks } };
  }

  if (intent === 'SET_BAN') {
    const s = sideKey(p.side);
    const idx = clampIdx(p.idx, 9); // bans allow up to 10
    const hero = String(p.hero ?? 'none');
    const bans = Array.isArray(current[s]?.bans)
      ? [...current[s].bans]
      : Array(10).fill('none');
    bans[idx] = hero;
    return { ...current, [s]: { ...current[s], bans } };
  }

  if (intent === 'SET_PHASE') {
    const phase = String(p.phase ?? 'draft');
    return { ...current, phase };
  }

  if (intent === 'SET_MAP') {
    const map = String(p.map ?? current.map ?? '');
    return { ...current, map };
  }

  if (intent === 'GLOBAL_SWAP') {
    return {
      ...current,
      blueTeam: current.redTeam,
      redTeam: current.blueTeam,
    };
  }

  // Unknown intent → no-op (but still goes through Zod if caller wants)
  return current;
}

// ─────────────────────────────────────────────────────────────
// Express / Socket.IO wiring
// ─────────────────────────────────────────────────────────────

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  },
  pingInterval: 30000,
  pingTimeout: 20000,
});

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '2mb' }));

// Basic favicon fallback (server or legacy control-panel)
app.get('/favicon.ico', (req, res) => {
  try {
    const serverIcon = path.resolve(ROOT_DIR, 'public', 'favicon.ico');
    if (fs.existsSync(serverIcon)) return res.sendFile(serverIcon);

    const legacyIcon = path.resolve(ROOT_DIR, '../control-panel/public/favicon.ico');
    if (fs.existsSync(legacyIcon)) return res.sendFile(legacyIcon);
  } catch {
    // ignore
  }
  return res.status(204).end();
});

// Static overlay + assets for OBS & Hub
const OVERLAY_DIR = path.resolve(ROOT_DIR, '../overlay');
app.use('/overlay', express.static(OVERLAY_DIR));
app.use('/Assets', express.static(ASSETS_ROOT));

// Simple home page
app.get('/', (req, res) => {
  res.type('html').send(
    '<h1>MLBB Broadcast Suite</h1>' +
      '<p>Overlay: <a href="/overlay/?id=default_draft">/overlay/?id=default_draft</a></p>',
  );
});

// ─────────────────────────────────────────────────────────────
// REST: match state + intents (Task 2)
// ─────────────────────────────────────────────────────────────

// Read-only snapshot for overlay boot
app.get('/api/matchdraft', (req, res) => {
  return res.json({ draftdata: matchState });
});

// Strict intent endpoint
app.post('/api/matchdata', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    if (!req.body.intent) {
      return res.status(400).json({ error: 'Missing intent' });
    }

    const nextCandidate = applyMatchIntent(matchState, req.body);
    const next = matchStateSchema.parse(nextCandidate); // Zod enforcement

    matchState = next;
    atomicWriteJson(STATE_FILE, matchState);

    io.emit('STATE_SYNC', matchState);

    return res.json({ ok: true, draftdata: matchState });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Hard reset back to schema defaults
app.post('/api/state-reset', (req, res) => {
  try {
    matchState = createDefaultMatchState();
    atomicWriteJson(STATE_FILE, matchState);
    io.emit('STATE_SYNC', matchState);
    io.emit('MATCH_STATE_CLEARED', matchState);
    return res.json({ ok: true, state: matchState });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// REST: theme + layouts (minimal, but schema‑driven)
// ─────────────────────────────────────────────────────────────

app.get('/api/theme', (req, res) => {
  return res.json({ theme });
});

app.post('/api/theme', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid theme payload' });
    }
    theme = req.body;
    atomicWriteJson(THEME_FILE, theme);
    io.emit('theme_update', theme);
    return res.json({ ok: true, theme });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/layouts', (req, res) => {
  return res.json({ layouts });
});

app.get('/api/layouts/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  const layout = layouts[id];
  if (!layout) return res.status(404).json({ error: 'Layout not found' });
  return res.json({ id, layout });
});

function listFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => !name.startsWith('.'));
  } catch {
    return [];
  }
}

// Asset discovery endpoints used by the Hub
app.get('/api/backgrounds', (req, res) => {
  return res.json({ backgrounds: listFiles(BACKGROUNDS_DIR) });
});

app.get('/api/frames', (req, res) => {
  return res.json({ frames: listFiles(FRAMES_DIR) });
});

app.get('/api/logos', (req, res) => {
  return res.json({ logos: listFiles(LOGOS_DIR) });
});

app.get('/api/maps', (req, res) => {
  return res.json({ maps: listFiles(MAPS_DIR) });
});

// Update or create a single layout, strictly validated by Zod
app.put('/api/layouts/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const validated = layoutSchema.parse(req.body);
    layouts[id] = validated;
    atomicWriteJson(LAYOUTS_FILE, layouts);
    io.emit('LAYOUT_UPDATE', id);
    return res.json({ ok: true, id, layout: layouts[id] });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Hero Discovery (Task 3)
// ─────────────────────────────────────────────────────────────

function sanitizeHeroNameFromFile(filename) {
  const base = String(filename || '').replace(/\.[^/.]+$/, '');
  return base.trim();
}

function heroDisplayNameFromId(id) {
  const s = String(id || '').trim();
  if (!s) return '';
  return s
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function walkFilesRecursive(rootDir, allowedExts) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExts.has(ext)) {
          out.push(full);
        }
      }
    }
  }

  return out;
}

function scanHeroAssets() {
  const portraitExts = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const voiceExts = new Set(['.ogg', '.mp3', '.wav']);

  const portraitFiles = walkFilesRecursive(HERO_PICK_DIR, portraitExts);
  const voiceFiles = walkFilesRecursive(VOICE_LINES_DIR, voiceExts);

  const portraitIds = new Set();
  const voiceIds = new Set();

  for (const file of portraitFiles) {
    const hero = sanitizeHeroNameFromFile(path.basename(file)).toLowerCase();
    if (hero) portraitIds.add(hero);
  }

  for (const file of voiceFiles) {
    const hero = sanitizeHeroNameFromFile(path.basename(file)).toLowerCase();
    if (hero) voiceIds.add(hero);
  }

  const allIds = new Set([...portraitIds, ...voiceIds]);
  const heroList = Array.from(allIds).sort((a, b) => a.localeCompare(b));

  // If no physical assets exist yet, still provide a usable dropdown
  if (!heroList.length) {
    const fallback = ['argus', 'fanny', 'ling', 'layla', 'tigreal'];
    return fallback.map((id) => ({
      id,
      name: heroDisplayNameFromId(id),
      hasPortrait: false,
      hasVoice: false,
      hasAsset: false,
    }));
  }

  return heroList.map((id) => {
    const hasPortrait = portraitIds.has(id);
    const hasVoice = voiceIds.has(id);
    return {
      id,
      name: heroDisplayNameFromId(id),
      hasPortrait,
      hasVoice,
      hasAsset: hasPortrait || hasVoice,
    };
  });
}

app.get('/api/heroes', (req, res) => {
  try {
    const heroes = scanHeroAssets();

    // Optional: materialize heroes.json for debugging / offline tools
    try {
      const outPath = path.resolve(DB_DIR, 'heroes.json');
      const payload = {
        generatedAt: new Date().toISOString(),
        source: 'public/Assets/HeroPick + VoiceLines',
        heroes,
      };
      atomicWriteJson(outPath, payload);
    } catch {
      // non‑fatal
    }

    return res.json({ heroes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/backgrounds', (req, res) => {
  const dir = path.resolve(__dirname, 'public/Assets/backgrounds');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  res.json(files);
});

app.get('/api/frames', (req, res) => {
  const dir = path.resolve(__dirname, 'public/Assets/frames');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  res.json(files);
});

// ─────────────────────────────────────────────────────────────
// Socket.IO: state + theme sync
// ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[socket] client connected', socket.id);

  // Immediately sync current state/theme
  socket.emit('STATE_SYNC', matchState);
  socket.emit('theme_update', theme);

  socket.on('disconnect', () => {
    console.log('[socket] client disconnected', socket.id);
  });
});

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MLBB State Server running on http://0.0.0.0:${PORT}`);
  console.log(`Overlay available at http://localhost:${PORT}/overlay`);
});