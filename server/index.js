const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { matchStateSchema, layoutSchema } = require('./validators/schema');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
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

app.get('/api/layouts', (req, res) => {
  res.json({ layouts });
});

app.get('/api/layouts/:id', (req, res) => {
  const { id } = req.params;
  const layout = layouts[id];
  if (!layout) return res.status(404).json({ error: 'Layout not found' });
  return res.json({ id, layout });
});

app.put('/api/layouts/:id', (req, res) => {
  const { id } = req.params;
  try {
    const validated = layoutSchema.parse(req.body);
    layouts[id] = validated;
    saveLayouts();
    return res.json({ ok: true, id, layout: layouts[id] });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Initialize default match state
let matchState = {
  blueTeam: {
    name: "Blue Team",
    score: 0,
    picks: ["none", "none", "none", "none", "none"],
    bans: ["none", "none", "none", "none", "none"]
  },
  redTeam: {
    name: "Red Team", 
    score: 0,
    picks: ["none", "none", "none", "none", "none"],
    bans: ["none", "none", "none", "none", "none"]
  },
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

// Serve static files
const overlayPath = path.join(__dirname, '../overlay');
app.use('/overlay', express.static(overlayPath));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

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
