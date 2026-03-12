const express = require('express');
const cors = require('cors');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { matchStateSchema, layoutSchema } = require('./validators/schema');

process.on('uncaughtException', (err) => {
  try {
    console.error('[uncaughtException]', err && err.stack ? err.stack : err);
  } catch {
    // ignore
  }
});

process.on('unhandledRejection', (reason) => {
  try {
    console.error('[unhandledRejection]', reason && reason.stack ? reason.stack : reason);
  } catch {
    // ignore
  }
});

const app = express();

app.get('/favicon.ico', (req, res) => {
  try {
    const serverIconPath = path.join(__dirname, 'public/favicon.ico');
    if (fs.existsSync(serverIconPath)) return res.sendFile(serverIconPath);

    const legacyControlPanelIcon = path.join(__dirname, '../control-panel/public/favicon.ico');
    if (fs.existsSync(legacyControlPanelIcon)) return res.sendFile(legacyControlPanelIcon);
  } catch {
    // ignore
  }

  return res.status(204).end();
});

app.use(cors({
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false
}));

// Explicit CORS headers middleware for PUT support
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  },
  // Heartbeat tuning for LAN stability
  pingInterval: 30000,
  pingTimeout: 20000
});

app.use(express.json({ limit: '2mb' }));

const STATE_FILE = path.join(__dirname, 'matchState.json');
const LEGACY_LAYOUTS_FILE = path.join(__dirname, 'layouts.json');
const DB_DIR = path.resolve(__dirname, 'public', 'database');
const LAYOUTS_FILE = path.join(DB_DIR, 'layouts.json');

const THEME_DIR = path.join(__dirname, 'public/Assets/costum/Theme');
const THEME_FONTS_DIR = path.join(THEME_DIR, 'fonts');
const THEME_IMAGES_DIR = path.join(THEME_DIR, 'images');
const THEME_FILE = path.join(THEME_DIR, 'theme.json');

let layouts = {};

function ensureDefaultLayoutsExist() {
  try {
    const base = layouts && typeof layouts === 'object' ? layouts : {};
    let changed = false;

    if (!base.default_draft) {
      base.default_draft = {
        name: 'default_draft',
        background: '',
        frame: '',
        components: []
      };
      changed = true;
    }

    if (!base.testing) {
      base.testing = {
        name: 'testing',
        background: '',
        frame: '',
        components: []
      };
      changed = true;
    }

    layouts = base;
    if (changed) saveLayouts();
  } catch {
    // ignore
  }
}

function loadLayouts() {
  try {
    const loadFrom = (filePath) => {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') layouts = parsed;
    };

    if (fs.existsSync(LAYOUTS_FILE)) {
      loadFrom(LAYOUTS_FILE);
      ensureDefaultLayoutsExist();
      console.log('Layouts loaded from file');
      return;
    }

    if (fs.existsSync(LEGACY_LAYOUTS_FILE)) {
      loadFrom(LEGACY_LAYOUTS_FILE);
      ensureDefaultLayoutsExist();
      try {
        ensureDir(DB_DIR);
        const tmp = LAYOUTS_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(layouts, null, 2));
        fs.renameSync(tmp, LAYOUTS_FILE);
      } catch {
        // ignore
      }
      console.log('Layouts loaded from legacy file');
    }
  } catch (error) {
    console.error('Error loading layouts:', error.message);
    layouts = {};
  }
}

function saveLayouts() {
  try {
    ensureDir(DB_DIR);
    const tempFile = LAYOUTS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(layouts, null, 2));
    fs.renameSync(tempFile, LAYOUTS_FILE);
  } catch (error) {
    console.error('Error saving layouts:', error.message);
  }
}

let layoutsWatchTimer = null;
function watchLayoutsFile() {
  try {
    if (!fs.existsSync(LAYOUTS_FILE)) return;
    fs.watchFile(LAYOUTS_FILE, { interval: 300 }, () => {
      if (layoutsWatchTimer) clearTimeout(layoutsWatchTimer);
      layoutsWatchTimer = setTimeout(() => {
        layoutsWatchTimer = null;
        loadLayouts();
        try {
          Object.keys(layouts || {}).forEach((layoutId) => {
            io.emit('LAYOUT_UPDATE', layoutId);
          });
        } catch {
          // ignore
        }
      }, 150);
    });
  } catch (e) {
    console.error('Error watching layouts file:', e.message);
  }
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

const serverAssetsRoot = path.join(__dirname, 'public/Assets');
const backgroundsDir = path.join(serverAssetsRoot, 'backgrounds');
const logosDir = path.join(serverAssetsRoot, 'logos');
const mapsDir = path.join(serverAssetsRoot, 'Maps');
const framesDir = path.join(serverAssetsRoot, 'frames');
const voiceLinesDir = path.join(serverAssetsRoot, 'VoiceLines');
const sfxDir = path.join(serverAssetsRoot, 'Sfx');
const heroPickDir = path.join(serverAssetsRoot, 'HeroPick');

ensureDir(backgroundsDir);
ensureDir(logosDir);
ensureDir(mapsDir);
ensureDir(framesDir);
ensureDir(voiceLinesDir);
ensureDir(sfxDir);
ensureDir(heroPickDir);

ensureDir(THEME_DIR);
ensureDir(THEME_FONTS_DIR);
ensureDir(THEME_IMAGES_DIR);

function createDefaultTheme() {
  return {
    typography: {
      fontFile: '',
      useCustomFont: false,
      fontSizeMultiplier: 1.0
    },
    images: {
      heroPickBg: 'default_bg.jpg',
      lowerBg: '',
      lowerMidBg: '',
      masterFrame: ''
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
      auraPick: '#ffffff'
    },
    animations: {
      banType: 'pulse',
      pickType: 'fade',
      heroAnim: 'slam'
    },
    toggles: {
      disableGlow: false,
      hidePattern: false,
      disableBoxShadow: false
    }
  };
}

let theme = createDefaultTheme();

function loadTheme() {
  try {
    if (!fs.existsSync(THEME_FILE)) {
      theme = createDefaultTheme();
      saveTheme();
      return;
    }
    const raw = fs.readFileSync(THEME_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') theme = parsed;
  } catch (e) {
    console.error('Error loading theme:', e.message);
    theme = createDefaultTheme();
  }
}

function saveTheme() {
  try {
    const tempFile = THEME_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(theme, null, 2));
    fs.renameSync(tempFile, THEME_FILE);
  } catch (e) {
    console.error('Error saving theme:', e.message);
  }
}

loadTheme();

function hardBootstrap() {
  const dbDir = DB_DIR;
  function isMissingOrEmpty(filePath) {
    try {
      if (!fs.existsSync(filePath)) return true;
      const st = fs.statSync(filePath);
      return !st.isFile() || st.size === 0;
    } catch {
      return true;
    }
  }

  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    console.error('hardBootstrap mkdir failed:', e?.message || e);
  }

  try {
    ensureDir(THEME_DIR);
    ensureDir(THEME_FONTS_DIR);
    ensureDir(THEME_IMAGES_DIR);
  } catch (e) {
    console.error('hardBootstrap theme dirs failed:', e?.message || e);
  }

  try {
    const dbThemeFile = path.join(dbDir, 'theme.json');
    if (isMissingOrEmpty(dbThemeFile)) {
      const t = createDefaultTheme();
      const tmp = dbThemeFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
      fs.renameSync(tmp, dbThemeFile);
      console.log('hardBootstrap wrote:', dbThemeFile);
    }
  } catch (e) {
    console.error('hardBootstrap theme.json failed:', e?.message || e);
  }

  try {
    if (isMissingOrEmpty(THEME_FILE)) {
      theme = createDefaultTheme();
      saveTheme();
      console.log('hardBootstrap wrote:', THEME_FILE);
    }
  } catch (e) {
    console.error('hardBootstrap THEME_FILE failed:', e?.message || e);
  }

  try {
    const matchDraftFile = path.join(dbDir, 'matchdraft.json');
    if (isMissingOrEmpty(matchDraftFile)) {
      const out = {
        draftdata: {
          blueside: { picks: ['none', 'none', 'none', 'none', 'none'], bans: ['none', 'none', 'none', 'none', 'none'] },
          redside: { picks: ['none', 'none', 'none', 'none', 'none'], bans: ['none', 'none', 'none', 'none', 'none'] },
          phase: 'draft'
        }
      };
      const tmp = matchDraftFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
      fs.renameSync(tmp, matchDraftFile);
      console.log('hardBootstrap wrote:', matchDraftFile);
    }
  } catch (e) {
    console.error('hardBootstrap matchdraft.json failed:', e?.message || e);
  }

  try {
    const matchTeamFile = path.join(dbDir, 'matchdatateam.json');
    if (isMissingOrEmpty(matchTeamFile)) {
      const out = {
        blueTeam: { name: 'BLUE', score: 0 },
        redTeam: { name: 'RED', score: 0 }
      };
      const tmp = matchTeamFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
      fs.renameSync(tmp, matchTeamFile);
      console.log('hardBootstrap wrote:', matchTeamFile);
    }
  } catch (e) {
    console.error('hardBootstrap matchdatateam.json failed:', e?.message || e);
  }

  try {
    if (isMissingOrEmpty(STATE_FILE)) {
      matchState = matchStateSchema.parse(createDefaultMatchState());
      saveState();
      console.log('hardBootstrap wrote:', STATE_FILE);
    }
  } catch (e) {
    console.error('hardBootstrap STATE_FILE failed:', e?.message || e);
  }

  try {
    if (isMissingOrEmpty(LAYOUTS_FILE)) {
      layouts = {
        testing: {
          name: 'testing',
          background: '',
          frame: '',
          components: []
        }
      };
      ensureDefaultLayoutsExist();
      saveLayouts();
      console.log('hardBootstrap wrote:', LAYOUTS_FILE);
    }
  } catch (e) {
    console.error('hardBootstrap layouts.json failed:', e?.message || e);
  }

  console.log('🛠️ Database populated at: ' + dbDir);
}

hardBootstrap();

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

function scanHeroAssets() {
  const portraits = new Set();
  const voices = new Set();

  const heroPickCandidates = [heroPickDir];
  const voiceCandidates = [voiceLinesDir];

  const portraitExt = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const voiceExt = new Set(['.ogg', '.mp3', '.wav']);

  for (const dir of heroPickCandidates) {
    if (!fs.existsSync(dir)) continue;
    try {
      fs.readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => !name.startsWith('.'))
        .forEach((file) => {
          const ext = path.extname(file).toLowerCase();
          if (!portraitExt.has(ext)) return;
          const hero = sanitizeHeroNameFromFile(file).toLowerCase();
          if (hero) portraits.add(hero);
        });
    } catch {
      // ignore
    }
  }

  for (const dir of voiceCandidates) {
    if (!fs.existsSync(dir)) continue;
    try {
      fs.readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => !name.startsWith('.'))
        .forEach((file) => {
          const ext = path.extname(file).toLowerCase();
          if (!voiceExt.has(ext)) return;
          const hero = sanitizeHeroNameFromFile(file).toLowerCase();
          if (hero) voices.add(hero);
        });
    } catch {
      // ignore
    }
  }

  const allNames = new Set([...portraits, ...voices]);

  const heroList = Array.from(allNames).sort((a, b) => a.localeCompare(b));

  // Empty state fallback (so Hub has usable dropdown even before assets are added)
  if (!heroList.length) {
    const fallback = ['argus', 'fanny', 'ling', 'layla', 'tigreal'];
    const heroes = fallback.map((name) => ({
      name,
      hasPortrait: false,
      hasVoice: false,
      hasAsset: false
    }));

    try {
      const dbDir = path.join(__dirname, 'public/database');
      ensureDir(dbDir);
      const outPath = path.join(dbDir, 'heroes.json');
      const out = {
        generatedAt: new Date().toISOString(),
        source: 'server/public/Assets',
        heroes: heroes.map((h) => ({
          id: h.name,
          name: heroDisplayNameFromId(h.name),
          hasPortrait: false,
          hasVoice: false,
          hasAsset: false
        }))
      };
      const tmp = outPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
      fs.renameSync(tmp, outPath);
    } catch {
      // ignore
    }

    return { heroes };
  }

  // Generate heroes.json for debugging / inspection.
  try {
    const dbDir = path.join(__dirname, 'public/database');
    ensureDir(dbDir);
    const outPath = path.join(dbDir, 'heroes.json');
    const out = {
      generatedAt: new Date().toISOString(),
      source: 'server/public/Assets',
      heroes: heroList.map((id) => ({
        id,
        name: heroDisplayNameFromId(id),
        hasPortrait: portraits.has(id),
        hasVoice: voices.has(id),
        hasAsset: portraits.has(id) || voices.has(id)
      }))
    };
    const tmp = outPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
    fs.renameSync(tmp, outPath);
  } catch {
    // ignore
  }

  const heroes = heroList.map((name) => {
    const hasPortrait = portraits.has(name);
    const hasVoice = voices.has(name);
    return {
      name,
      hasPortrait,
      hasVoice,
      hasAsset: hasPortrait || hasVoice
    };
  });

  return { heroes, portraits, voices };
}
// Fallback: if voice/sfx are stored in hub/public/Assets, serve them too.
const hubPublicAssetsRoot = path.join(__dirname, '../hub/public/Assets');
const hubVoiceLinesDir = path.join(hubPublicAssetsRoot, 'VoiceLines');
const hubSfxDir = path.join(hubPublicAssetsRoot, 'Sfx');

// Static asset serving
app.use(
  '/Assets',
  express.static(serverAssetsRoot, {
    setHeaders: (res, filePath) => {
      try {
        if (String(filePath || '').toLowerCase().endsWith('.ogg')) {
          res.setHeader('Content-Type', 'audio/ogg');
        }
      } catch {
        // ignore
      }
    }
  })
);

if (fs.existsSync(hubVoiceLinesDir)) {
  app.use(
    '/Assets/VoiceLines',
    express.static(hubVoiceLinesDir, {
      setHeaders: (res, filePath) => {
        try {
          if (String(filePath || '').toLowerCase().endsWith('.ogg')) {
            res.setHeader('Content-Type', 'audio/ogg');
          }
        } catch {
          // ignore
        }
      }
    })
  );
}
if (fs.existsSync(hubSfxDir)) {
  app.use('/Assets/Sfx', express.static(hubSfxDir));
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => !name.startsWith('.'));
}

app.get('/api/heroes', (req, res) => {
  try {
    const { heroes } = scanHeroAssets();
    return res.json({ heroes });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/state-reset', (req, res) => {
  try {
    matchState = matchStateSchema.parse(createDefaultMatchState());
    saveState();
    io.emit('STATE_SYNC', matchState);
    io.emit('MATCH_STATE_CLEARED', matchState);
    return res.json({ ok: true, state: matchState });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/matchdraft', (req, res) => {
  return res.json({ draftdata: matchState });
});

app.post('/api/match-reset', (req, res) => {
  try {
    matchState = matchStateSchema.parse(createDefaultMatchState());
    saveState();
    io.emit('STATE_SYNC', matchState);
    io.emit('MATCH_STATE_CLEARED', matchState);
    return res.json({ ok: true, draftdata: matchState });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

function applyMatchIntent(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const intent = String(p.intent || '').trim();

  function sideKey(v) {
    return v === 'blueTeam' ? 'blueTeam' : 'redTeam';
  }

  function clampIdx(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(4, Math.trunc(n)));
  }

  function clampScoreValue(v) {
    const n = parseInt(String(v ?? '0'), 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(99, n));
  }

  if (intent === 'SET_TEAM_NAME') {
    const s = sideKey(p.side);
    const name = String(p.name ?? '');
    return {
      ...matchState,
      [s]: { ...matchState[s], name }
    };
  }

  if (intent === 'SET_TEAM_SCORE') {
    const s = sideKey(p.side);
    const score = clampScoreValue(p.score);
    return {
      ...matchState,
      [s]: { ...matchState[s], score }
    };
  }

  if (intent === 'SET_PLAYER_NAME') {
    const s = sideKey(p.side);
    const idx = clampIdx(p.idx);
    const name = String(p.name ?? '');
    const players = Array.isArray(matchState[s]?.players) ? [...matchState[s].players] : ['', '', '', '', ''];
    players[idx] = name;
    return {
      ...matchState,
      [s]: { ...matchState[s], players }
    };
  }

  if (intent === 'SWAP_PLAYERS') {
    const s = sideKey(p.side);
    const a = clampIdx(p.aIdx);
    const b = clampIdx(p.bIdx);
    const players = Array.isArray(matchState[s]?.players) ? [...matchState[s].players] : ['', '', '', '', ''];
    const tmp = players[a];
    players[a] = players[b];
    players[b] = tmp;
    return {
      ...matchState,
      [s]: { ...matchState[s], players }
    };
  }

  if (intent === 'SET_PICK') {
    const s = sideKey(p.side);
    const idx = clampIdx(p.idx);
    const hero = String(p.hero ?? 'none');
    const picks = Array.isArray(matchState[s]?.picks) ? [...matchState[s].picks] : ['none', 'none', 'none', 'none', 'none'];
    picks[idx] = hero;
    return {
      ...matchState,
      [s]: { ...matchState[s], picks }
    };
  }

  if (intent === 'SET_BAN') {
    const s = sideKey(p.side);
    const idx = clampIdx(p.idx);
    const hero = String(p.hero ?? 'none');
    const bans = Array.isArray(matchState[s]?.bans) ? [...matchState[s].bans] : ['none', 'none', 'none', 'none', 'none'];
    bans[idx] = hero;
    return {
      ...matchState,
      [s]: { ...matchState[s], bans }
    };
  }

  if (intent === 'SET_MAP_TYPE') {
    const mapType = String(p.mapType ?? 'none');
    return { ...matchState, mapType };
  }

  if (intent === 'SET_PHASE') {
    const phase = String(p.phase ?? 'draft');
    return { ...matchState, phase };
  }

  if (intent === 'GLOBAL_SWAP') {
    return {
      ...matchState,
      blueTeam: matchState.redTeam,
      redTeam: matchState.blueTeam
    };
  }

  // Unknown intent -> no-op
  return matchState;
}

app.post('/api/matchdata', (req, res) => {
  try {
    const next = applyMatchIntent(req.body);
    matchState = matchStateSchema.parse(next);
    saveState();
    io.emit('STATE_SYNC', matchState);
    return res.json({ ok: true, draftdata: matchState });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

app.get('/api/theme', (req, res) => {
  try {
    // Avoid clients repeatedly requesting a missing default image (e.g. default_bg.jpg)
    const nextTheme = theme && typeof theme === 'object' ? { ...theme } : createDefaultTheme();
    const img = nextTheme.images && typeof nextTheme.images === 'object' ? { ...nextTheme.images } : {};
    const heroPickBg = String(img.heroPickBg || '').trim();
    if (heroPickBg) {
      const heroPickBgPath = path.join(THEME_IMAGES_DIR, heroPickBg);
      if (!fs.existsSync(heroPickBgPath)) {
        img.heroPickBg = '';
      }
    }
    nextTheme.images = img;
    return res.json({ theme: nextTheme });
  } catch {
    return res.json({ theme });
  }
});

app.post('/api/theme', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Invalid theme payload' });
    }
    theme = incoming;
    saveTheme();
    io.emit('theme_update', theme);
    return res.json({ ok: true, theme });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/theme-reset', (req, res) => {
  try {
    theme = createDefaultTheme();
    saveTheme();
    io.emit('theme_update', theme);
    return res.json({ ok: true, theme });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const themeUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const kind = String(req.body?.kind || '').trim();
      if (kind === 'font') return cb(null, THEME_FONTS_DIR);
      if (kind === 'image') return cb(null, THEME_IMAGES_DIR);
      return cb(new Error('Invalid kind (expected font|image)'));
    },
    filename: (req, file, cb) => {
      const safeName = (file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safeName}`);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 }
});

// POST /api/theme-upload
// Multipart fields: file, kind=font|image, key
// key examples:
// - typography.fontFile
// - images.heroPickBg
app.post('/api/theme-upload', themeUpload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const kind = String(req.body?.kind || '').trim();
    const key = String(req.body?.key || '').trim();
    if (!key) return res.status(400).json({ error: 'Missing key' });

    const filename = req.file.filename;
    const relUrl = kind === 'font'
      ? `/Assets/costum/Theme/fonts/${filename}`
      : `/Assets/costum/Theme/images/${filename}`;

    const parts = key.split('.').filter(Boolean);
    if (parts.length !== 2) return res.status(400).json({ error: 'Invalid key (expected section.field)' });
    const [section, field] = parts;
    if (!theme[section] || typeof theme[section] !== 'object') theme[section] = {};
    theme[section][field] = filename;

    saveTheme();
    io.emit('theme_update', theme);

    return res.json({ ok: true, key, filename, url: relUrl, theme });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const kind = req.params.kind;
      if (kind === 'backgrounds') return cb(null, backgroundsDir);
      if (kind === 'logos') return cb(null, logosDir);
      if (kind === 'Maps' || kind === 'maps') return cb(null, mapsDir);
      if (kind === 'frames') return cb(null, framesDir);
      if (kind === 'VoiceLines' || kind === 'voicelines') return cb(null, voiceLinesDir);
      if (kind === 'Sfx' || kind === 'sfx') return cb(null, sfxDir);
      return cb(new Error('Invalid upload kind'));
    },
    filename: (req, file, cb) => {
      const safeName = (file.originalname || 'upload')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safeName}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/uploads/:kind', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const kind = req.params.kind;
    const urlKind = kind === 'maps' ? 'Maps' : kind;
    const rel = `/Assets/${urlKind}/${req.file.filename}`;
    return res.json({ ok: true, url: rel, filename: req.file.filename });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const categorizedUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const category = String(req.body?.category || '').trim();
      if (category === 'background') return cb(null, backgroundsDir);
      if (category === 'frame') return cb(null, framesDir);
      if (category === 'logo') return cb(null, logosDir);
      if (category === 'voiceline' || category === 'voiceLine' || category === 'voice') return cb(null, voiceLinesDir);
      if (category === 'sfx' || category === 'sound') return cb(null, sfxDir);
      return cb(new Error('Invalid upload category'));
    },
    filename: (req, file, cb) => {
      const safeName = (file.originalname || 'upload')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safeName}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/upload
// Multipart fields:
// - file: the binary
// - category: background | frame | logo (required)
app.post('/api/upload', categorizedUpload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const category = String(req.body?.category || '').trim();

    // Public URLs use the plural folder names.
    const folder =
      category === 'background'
        ? 'backgrounds'
        : category === 'frame'
          ? 'frames'
          : category === 'logo'
            ? 'logos'
            : category === 'voiceline' || category === 'voiceLine' || category === 'voice'
              ? 'VoiceLines'
              : category === 'sfx' || category === 'sound'
                ? 'Sfx'
                : 'logos';
    const rel = `/Assets/${folder}/${req.file.filename}`;
    return res.json({ ok: true, url: rel, filename: req.file.filename, category });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/layouts', (req, res) => {
  res.json({ layouts });
});

app.get('/api/layouts/:id', (req, res) => {
  const { id } = req.params;
  const key = String(id || '').trim();
  let layout = layouts[key];
  if (!layout && key) {
    const found = Object.keys(layouts || {}).find((k) => String(k).toLowerCase() === key.toLowerCase());
    if (found) layout = layouts[found];
  }
  if (!layout) return res.status(404).json({ error: 'Layout not found' });
  return res.json({ id, layout });
});

app.get('/api/backgrounds', (req, res) => {
  try {
    return res.json({ backgrounds: listFiles(backgroundsDir) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/frames', (req, res) => {
  try {
    return res.json({ frames: listFiles(framesDir) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/logos', (req, res) => {
  try {
    return res.json({ logos: listFiles(logosDir) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/active-layout', (req, res) => {
  try {
    const id = String(req.body?.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });

    let resolvedId = id;
    if (!layouts[resolvedId]) {
      const found = Object.keys(layouts || {}).find((k) => String(k).toLowerCase() === resolvedId.toLowerCase());
      if (found) resolvedId = found;
    }
    if (!layouts[resolvedId]) return res.status(404).json({ error: 'Layout not found' });

    matchState = matchStateSchema.parse({ ...matchState, activeLayout: resolvedId });
    saveState();
    io.emit('STATE_SYNC', matchState);
    io.emit('ACTIVE_LAYOUT_CHANGED', { id: resolvedId });
    return res.json({ ok: true, id: resolvedId });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

app.put('/api/layouts/:id', (req, res) => {
  const { id } = req.params;
  try {
    const validated = layoutSchema.parse(req.body);
    const key = String(id || '').trim();
    let writeKey = key;
    if (writeKey) {
      const found = Object.keys(layouts || {}).find((k) => String(k).toLowerCase() === writeKey.toLowerCase());
      if (found) writeKey = found;
    }

    layouts[writeKey] = validated;
    saveLayouts();
    io.emit('LAYOUT_UPDATE', writeKey);
    return res.json({ ok: true, id: writeKey, layout: layouts[writeKey] });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/layouts', (req, res) => {
  try {
    const body = req.body;

    // Accept either:
    // 1) { layouts: { [id]: layout } }
    // 2) { [id]: layout }
    // 3) { id: string, layout: layout }
    let nextLayouts = null;

    if (body && typeof body === 'object' && body.layouts && typeof body.layouts === 'object') {
      nextLayouts = body.layouts;
    } else if (body && typeof body === 'object' && typeof body.id === 'string' && body.layout) {
      nextLayouts = { ...layouts, [body.id]: layoutSchema.parse(body.layout) };
    } else if (body && typeof body === 'object' && typeof body.id === 'string' && body.components) {
      const { id, ...layout } = body;
      nextLayouts = { ...layouts, [id]: layoutSchema.parse(layout) };
    } else if (body && typeof body === 'object') {
      nextLayouts = body;
    }

    if (!nextLayouts || typeof nextLayouts !== 'object') {
      return res.status(400).json({ error: 'Invalid layouts payload' });
    }

    const validatedAll = {};
    for (const [id, layout] of Object.entries(nextLayouts)) {
      validatedAll[id] = layoutSchema.parse(layout);
    }

    layouts = validatedAll;
    saveLayouts();
    Object.keys(validatedAll).forEach(layoutId => {
      io.emit('LAYOUT_UPDATE', layoutId);
    });
    return res.json({ ok: true, layouts });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Initialize default match state
function createDefaultMatchState() {
  return {
    blueTeam: {
      name: 'Blue Team',
      score: 0,
      players: ['', '', '', '', ''],
      picks: ['none', 'none', 'none', 'none', 'none'],
      bans: ['none', 'none', 'none', 'none', 'none']
    },
    redTeam: {
      name: 'Red Team',
      score: 0,
      players: ['', '', '', '', ''],
      picks: ['none', 'none', 'none', 'none', 'none'],
      bans: ['none', 'none', 'none', 'none', 'none']
    },
    map: 'none',
    mapType: 'none',
    activeLayout: 'default_draft',
    phase: 'draft'
  };
}

let matchState = createDefaultMatchState();

// Load state from file if it exists
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsedState = JSON.parse(data);
      const validatedState = matchStateSchema.parse(parsedState);
      matchState = validatedState;
      console.log('State loaded from file');
    }
  } catch (error) {
    console.error('Error loading state:', error.message);
    console.log('Using default state');
  }
}

// Save state to file atomically
function saveState() {
  try {
    const tempFile = STATE_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(matchState, null, 2));
    fs.renameSync(tempFile, STATE_FILE);
  } catch (error) {
    console.error('Error saving state:', error.message);
  }
}

// Serve static files with strict PascalCase Assets
const overlayPath = path.join(__dirname, '../overlay');
app.use('/overlay', express.static(overlayPath));
app.use('/Assets', express.static(path.join(__dirname, 'public/Assets')));

// Server-managed assets (uploads) - only PascalCase
app.use('/Assets', express.static(serverAssetsRoot));

// Serve Hub assets for overlay thumbnails (HeroPick)
const hubAssetsPath = path.join(__dirname, '../hub/public/Assets');
if (fs.existsSync(hubAssetsPath)) {
  app.use('/Assets', express.static(hubAssetsPath));
}

const hubDistPath = path.join(__dirname, '../hub/dist');
if (fs.existsSync(hubDistPath)) {
  app.use(express.static(hubDistPath));
  app.get('/', (req, res) => {
    res.sendFile(path.join(hubDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('html').send('<h1>MLBB Broadcast Suite</h1><p>Overlay: <a href="/overlay/?id=default_draft">/overlay/?id=default_draft</a></p>');
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current state/theme to newly connected client
  socket.emit('STATE_SYNC', matchState);
  socket.emit('theme_update', theme);
  
  // Handle state updates
  socket.on('UPDATE_STATE', (newState) => {
    try {
      const validatedState = matchStateSchema.parse(newState);
      matchState = validatedState;
      saveState();
      io.emit('STATE_SYNC', matchState);
      console.log('State updated and broadcasted');
    } catch (error) {
      console.error('Invalid state update:', error.message);
      socket.emit('STATE_ERROR', error.message);
    }
  });

  socket.on('RESET_STATE', () => {
    try {
      matchState = matchStateSchema.parse(createDefaultMatchState());
      saveState();
      io.emit('STATE_SYNC', matchState);
      io.emit('MATCH_STATE_CLEARED', matchState);
      console.log('State reset and broadcasted');
    } catch (error) {
      console.error('Reset failed:', error.message);
      socket.emit('STATE_ERROR', error.message);
    }
  });

  socket.on('GLOBAL_SWAP', () => {
    try {
      const next = {
        ...matchState,
        blueTeam: matchState.redTeam,
        redTeam: matchState.blueTeam
      };
      matchState = matchStateSchema.parse(next);
      saveState();
      io.emit('STATE_SYNC', matchState);
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  function commitIntent(nextState) {
    const validated = matchStateSchema.parse(nextState);
    matchState = validated;
    saveState();
    io.emit('STATE_SYNC', matchState);
  }

  socket.on('SET_TEAM_NAME', ({ side, name }) => {
    try {
      const s = side === 'blueTeam' ? 'blueTeam' : 'redTeam';
      commitIntent({
        ...matchState,
        [s]: { ...matchState[s], name: String(name ?? '') }
      });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_TEAM_SCORE', ({ side, score }) => {
    try {
      const s = side === 'blueTeam' ? 'blueTeam' : 'redTeam';
      commitIntent({
        ...matchState,
        [s]: { ...matchState[s], score: Number(score) }
      });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_PLAYER_NAME', ({ side, idx, name }) => {
    try {
      const s = side === 'blueTeam' ? 'blueTeam' : 'redTeam';
      const i = Math.max(0, Math.min(4, Number(idx)));
      const players = Array.isArray(matchState[s]?.players) ? [...matchState[s].players] : ['', '', '', '', ''];
      players[i] = String(name ?? '');
      commitIntent({
        ...matchState,
        [s]: { ...matchState[s], players }
      });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SWAP_PLAYERS', ({ side, aIdx, bIdx }) => {
    try {
      const s = side === 'blueTeam' ? 'blueTeam' : 'redTeam';
      const a = Math.max(0, Math.min(4, Number(aIdx)));
      const b = Math.max(0, Math.min(4, Number(bIdx)));
      const players = Array.isArray(matchState[s]?.players) ? [...matchState[s].players] : ['', '', '', '', ''];
      const tmp = players[a];
      players[a] = players[b];
      players[b] = tmp;
      commitIntent({
        ...matchState,
        [s]: { ...matchState[s], players }
      });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_PICK', ({ side, idx, hero }) => {
    try {
      const s = side === 'blueTeam' ? 'blueTeam' : 'redTeam';
      const i = Math.max(0, Math.min(4, Number(idx)));
      const picks = Array.isArray(matchState[s]?.picks) ? [...matchState[s].picks] : ['none', 'none', 'none', 'none', 'none'];
      picks[i] = String(hero ?? 'none');
      commitIntent({
        ...matchState,
        [s]: { ...matchState[s], picks }
      });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_BAN', ({ side, idx, hero }) => {
    try {
      const s = side === 'blueTeam' ? 'blueTeam' : 'redTeam';
      const i = Math.max(0, Math.min(4, Number(idx)));
      const bans = Array.isArray(matchState[s]?.bans) ? [...matchState[s].bans] : ['none', 'none', 'none', 'none', 'none'];
      bans[i] = String(hero ?? 'none');
      commitIntent({
        ...matchState,
        [s]: { ...matchState[s], bans }
      });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_MAP_TYPE', ({ mapType }) => {
    try {
      commitIntent({ ...matchState, mapType: String(mapType ?? 'none') });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_PHASE', ({ phase }) => {
    try {
      commitIntent({ ...matchState, phase: String(phase ?? 'draft') });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('SET_ACTIVE_LAYOUT', (payload) => {
    try {
      const id = String(payload?.id || payload || '').trim();
      if (!id) throw new Error('Missing id');
      if (!layouts[id]) throw new Error('Layout not found');
      matchState = matchStateSchema.parse({ ...matchState, activeLayout: id });
      saveState();
      io.emit('STATE_SYNC', matchState);
      io.emit('ACTIVE_LAYOUT_CHANGED', { id });
    } catch (e) {
      socket.emit('STATE_ERROR', e.message);
    }
  });

  socket.on('VOLUME_CHANGE', (payload) => {
    try {
      // Payload example: { master: 0.8, pick: 1, ban: 0.6, enabled: true }
      io.emit('VOLUME_CHANGE', payload);
    } catch (e) {
      // ignore
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Load initial state
loadState();
loadLayouts();
watchLayoutsFile();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`MLBB State Server running on http://0.0.0.0:${PORT}`);
  console.log(`Overlay available at http://localhost:${PORT}/overlay`);
  console.log(`Control panel can connect to ws://0.0.0.0:${PORT}`);
});
