const express = require('express');
const cors = require('cors');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { matchStateSchema, layoutSchema } = require('./validators/schema');

const app = express();

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
  }
});

app.use(express.json({ limit: '2mb' }));

const STATE_FILE = path.join(__dirname, 'matchState.json');
const LAYOUTS_FILE = path.join(__dirname, 'layouts.json');

let layouts = {};

function loadLayouts() {
  try {
    if (fs.existsSync(LAYOUTS_FILE)) {
      const data = fs.readFileSync(LAYOUTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        layouts = parsed;
      }
      console.log('Layouts loaded from file');
    }
  } catch (error) {
    console.error('Error loading layouts:', error.message);
    layouts = {};
  }
}

function saveLayouts() {
  try {
    const tempFile = LAYOUTS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(layouts, null, 2));
    fs.renameSync(tempFile, LAYOUTS_FILE);
  } catch (error) {
    console.error('Error saving layouts:', error.message);
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

ensureDir(backgroundsDir);
ensureDir(logosDir);
ensureDir(mapsDir);
ensureDir(framesDir);
ensureDir(voiceLinesDir);
ensureDir(sfxDir);

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

// Fallback: if voice/sfx are stored in hub/public/Assets, serve them too.
const hubPublicAssetsRoot = path.join(__dirname, '../hub/public/Assets');
const hubVoiceLinesDir = path.join(hubPublicAssetsRoot, 'VoiceLines');
const hubSfxDir = path.join(hubPublicAssetsRoot, 'Sfx');
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
  const layout = layouts[id];
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
    if (!layouts[id]) return res.status(404).json({ error: 'Layout not found' });

    matchState = matchStateSchema.parse({ ...matchState, activeLayout: id });
    saveState();
    io.emit('STATE_SYNC', matchState);
    io.emit('ACTIVE_LAYOUT_CHANGED', { id });
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

app.put('/api/layouts/:id', (req, res) => {
  const { id } = req.params;
  try {
    const validated = layoutSchema.parse(req.body);
    layouts[id] = validated;
    saveLayouts();
    io.emit('LAYOUT_UPDATE', id);
    return res.json({ ok: true, id, layout: layouts[id] });
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
let matchState = {
  blueTeam: {
    name: "Blue Team",
    score: 0,
    players: ["", "", "", "", ""],
    picks: ["none", "none", "none", "none", "none"],
    bans: ["none", "none", "none", "none", "none"]
  },
  redTeam: {
    name: "Red Team", 
    score: 0,
    players: ["", "", "", "", ""],
    picks: ["none", "none", "none", "none", "none"],
    bans: ["none", "none", "none", "none", "none"]
  },
  map: "none",
  mapType: "none",
  activeLayout: "default_draft",
  phase: "draft"
};

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
  
  // Send current state to newly connected client
  io.emit('STATE_SYNC', matchState);
  
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`MLBB State Server running on http://0.0.0.0:${PORT}`);
  console.log(`Overlay available at http://localhost:${PORT}/overlay`);
  console.log(`Control panel can connect to ws://0.0.0.0:${PORT}`);
});
