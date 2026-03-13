// Overlay Master Resolver Renderer
// - Asset prefetching for hero portraits
// - Data-driven mapping from match state + layout atoms
// - Layout-driven styling
// - 1920x1080 scale-to-fit with Socket.IO sync

// ─────────────────────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────────────────────

const overlayRoot = document.getElementById('overlayRoot');
const overlayFit = document.getElementById('overlayFit');
const componentsLayer = document.getElementById('componentsLayer');

const bgImageEl = document.getElementById('bgImage');
const frameImageEl = document.getElementById('frameImage');

const themeBackgroundLayer = document.getElementById('background-layer');
const themeFrameLayer = document.getElementById('frame-layer');
const themeLowerBgLayer = document.getElementById('lower-bg');
const themeLowerMidBgLayer = document.getElementById('lower-mid-bg');
const themeMasterFrameLayer = document.getElementById('master-frame-layer');

// ─────────────────────────────────────────────────────────────
// Globals / master state references
// ─────────────────────────────────────────────────────────────

const lastValues = new Map(); // cache per component-id + field

let currentLayoutId = null;
let currentLayout = null;
let currentState = null;

// heroId -> { img, ready }
const heroPortraitCache = new Map();

const SERVER_URL = (() => {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch {
    // ignore
  }
  return 'http://localhost:3000';
})();

const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X6nVsAAAAASUVORK5CYII=';

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────

function cacheBust(url) {
  const s = String(url || '');
  if (!s) return s;
  if (s.startsWith('data:')) return s;
  const joiner = s.includes('?') ? '&' : '?';
  return `${s}${joiner}t=${Date.now()}`;
}

function setCssVar(name, value) {
  try {
    document.documentElement.style.setProperty(name, String(value));
  } catch {
    // ignore
  }
}

function getLayoutId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || 'default_draft';
}

function shouldFollowLiveLayout() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('follow') === '1';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Asset helpers & hero pre‑fetching (Task 1)
// ─────────────────────────────────────────────────────────────

function heroPortraitUrl(heroId) {
  const name = String(heroId || '').trim().toLowerCase();
  if (!name || name === 'none') return TRANSPARENT_PX;
  return `${SERVER_URL}/Assets/HeroPick/${encodeURIComponent(name)}.png`;
}

function mapThumbUrl(mapName) {
  if (!mapName || mapName === 'none') return TRANSPARENT_PX;
  const safe = String(mapName).toLowerCase();
  return `${SERVER_URL}/Assets/Maps/${encodeURIComponent(safe)}.png`;
}

function prefetchHeroPortrait(heroId) {
  const key = String(heroId || '').trim().toLowerCase();
  if (!key || key === 'none') return;
  if (heroPortraitCache.has(key)) return;

  const img = new Image();
  const src = heroPortraitUrl(key);

  heroPortraitCache.set(key, { img, ready: false });

  img.onload = () => {
    const entry = heroPortraitCache.get(key);
    if (entry) entry.ready = true;
  };
  img.onerror = () => {
    const entry = heroPortraitCache.get(key);
    if (entry) entry.ready = false;
  };

  img.src = src;
}

async function startHeroPrefetchLoop() {
  try {
    const res = await fetch('/api/heroes');
    if (!res.ok) return;
    const json = await res.json();
    const heroes = Array.isArray(json?.heroes) ? json.heroes : [];

    const ids = heroes
      .map((h) => (h.id || h.name || '').toString().toLowerCase())
      .filter(Boolean);
    if (!ids.length) return;

    // Fire-and-forget loads; the browser cache will ensure zero-latency usage later.
    for (const id of ids) {
      prefetchHeroPortrait(id);
    }
  } catch {
    // ignore – overlay will still function without prefetch
  }
}

// ─────────────────────────────────────────────────────────────
// Layout‑driven styling (Task 3)
// ─────────────────────────────────────────────────────────────

function normalizedAssetUrl(maybePath) {
  const s = String(maybePath || '').trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) return s;
  return `${SERVER_URL}/Assets/${s}`;
}

function applyLayoutStyles(layout) {
  if (!layout || typeof layout !== 'object') return;

  const background = normalizedAssetUrl(layout.background || '');
  const frame = normalizedAssetUrl(layout.frame || '');

  if (bgImageEl) {
    if (background) {
      bgImageEl.src = cacheBust(background);
    } else {
      bgImageEl.removeAttribute('src');
    }
  }

  if (frameImageEl) {
    if (frame) {
      frameImageEl.src = cacheBust(frame);
    } else {
      frameImageEl.removeAttribute('src');
    }
  }

  const cfg = layout.config && typeof layout.config === 'object' ? layout.config : {};
  const cfgColors = cfg.colors && typeof cfg.colors === 'object' ? cfg.colors : {};
  Object.entries(cfgColors).forEach(([k, v]) => {
    if (!k) return;
    setCssVar(`--layout-${k}`, v);
  });

  if (themeBackgroundLayer && layout.backgroundLayer) {
    const url = normalizedAssetUrl(layout.backgroundLayer);
    themeBackgroundLayer.style.backgroundImage = url ? `url("${cacheBust(url)}")` : '';
  }
  if (themeFrameLayer && layout.frameLayer) {
    const url = normalizedAssetUrl(layout.frameLayer);
    themeFrameLayer.style.backgroundImage = url ? `url("${cacheBust(url)}")` : '';
  }
  if (themeLowerBgLayer && layout.lowerBg) {
    const url = normalizedAssetUrl(layout.lowerBg);
    themeLowerBgLayer.style.backgroundImage = url ? `url("${cacheBust(url)}")` : '';
  }
  if (themeLowerMidBgLayer && layout.lowerMidBg) {
    const url = normalizedAssetUrl(layout.lowerMidBg);
    themeLowerMidBgLayer.style.backgroundImage = url ? `url("${cacheBust(url)}")` : '';
  }
  if (themeMasterFrameLayer && layout.masterFrame) {
    const url = normalizedAssetUrl(layout.masterFrame);
    themeMasterFrameLayer.style.backgroundImage = url ? `url("${cacheBust(url)}")` : '';
  }
}

// ─────────────────────────────────────────────────────────────
// Layout component DOM wiring
// ─────────────────────────────────────────────────────────────

function componentDomId(component) {
  if (!component || typeof component !== 'object') return '';
  if (component.instanceId) return String(component.instanceId);
  if (component.id) return String(component.id);
  return '';
}

function ensureComponentEl(domId, component) {
  let el = document.getElementById(domId);
  if (!el) {
    el = document.createElement('div');
    el.id = domId;
    el.className = 'component';

    const img = document.createElement('img');
    img.alt = '';
    el.appendChild(img);

    (componentsLayer || overlayRoot || document.body).appendChild(el);
  }

  const w = typeof component?.width === 'number' ? component.width : 0;
  const h = typeof component?.height === 'number' ? component.height : 0;

  el.style.left = `${component.x}px`;
  el.style.top = `${component.y}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.display = component.visible === false ? 'none' : 'block';

  const isBan = String(component.atom || '').includes('BAN');
  el.classList.toggle('smartbox-ban', isBan);

  return el;
}

function getImgTarget(id) {
  const el = document.getElementById(id);
  if (!el) return { el: null, img: null };
  const img = el.querySelector('img');
  return { el, img };
}

function setTextIfExists(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = String(text ?? '');
  const key = `${id}::text`;
  if (lastValues.get(key) === v) return;
  el.textContent = v;
  lastValues.set(key, v);
}

function setImageIfExists(id, src, visible) {
  const { el, img } = getImgTarget(id);
  if (!el || !img) return;

  const displayValue = visible ? 'block' : 'none';
  const displayKey = `${id}::display`;
  if (lastValues.get(displayKey) !== displayValue) {
    el.style.display = displayValue;
    lastValues.set(displayKey, displayValue);
  }

  const nextSrc = visible ? String(src || '') : '';
  const srcKey = `${id}::src`;
  if (lastValues.get(srcKey) !== nextSrc) {
    img.src = nextSrc && nextSrc !== TRANSPARENT_PX ? cacheBust(nextSrc) : nextSrc;
    lastValues.set(srcKey, nextSrc);
  }
}

// ─────────────────────────────────────────────────────────────
// Master Resolver (Task 2)
// ─────────────────────────────────────────────────────────────

function resolveComponentValue(component, state) {
  const atom = String(component.atom || '').trim();
  const bind = component.bind && typeof component.bind === 'object' ? component.bind : {};

  const idx =
    typeof bind.idx === 'number'
      ? Math.max(0, Math.min(9, bind.idx))
      : Number.isFinite(Number(bind.idx))
      ? Math.max(0, Math.min(9, Number(bind.idx)))
      : null;

  if (!state || typeof state !== 'object') {
    return { kind: 'text', value: '' };
  }

  // Team names
  if (atom === 'T1_NAME') {
    return { kind: 'text', value: state.blueTeam?.name || '' };
  }
  if (atom === 'T2_NAME') {
    return { kind: 'text', value: state.redTeam?.name || '' };
  }

  // Scores
  if (atom === 'T1_SCORE') {
    return { kind: 'text', value: String(state.blueTeam?.score ?? '') };
  }
  if (atom === 'T2_SCORE') {
    return { kind: 'text', value: String(state.redTeam?.score ?? '') };
  }

  // Player names
  if (atom === 'T1_PLAYER_NAME' && idx != null) {
    return { kind: 'text', value: state.blueTeam?.players?.[idx] || '' };
  }
  if (atom === 'T2_PLAYER_NAME' && idx != null) {
    return { kind: 'text', value: state.redTeam?.players?.[idx] || '' };
  }

  // Picks
  if (atom === 'T1_PICK' && idx != null) {
    const hero = state.blueTeam?.picks?.[idx] || 'none';
    return { kind: 'image', value: heroPortraitUrl(hero) };
  }
  if (atom === 'T2_PICK' && idx != null) {
    const hero = state.redTeam?.picks?.[idx] || 'none';
    return { kind: 'image', value: heroPortraitUrl(hero) };
  }

  // Bans
  if (atom === 'T1_BAN' && idx != null) {
    const hero = state.blueTeam?.bans?.[idx] || 'none';
    return { kind: 'image', value: heroPortraitUrl(hero) };
  }
  if (atom === 'T2_BAN' && idx != null) {
    const hero = state.redTeam?.bans?.[idx] || 'none';
    return { kind: 'image', value: heroPortraitUrl(hero) };
  }

  // Logos (optional)
  if (atom === 'T1_LOGO') {
    const logo = state.blueTeam?.logo;
    if (logo) return { kind: 'image', value: normalizedAssetUrl(logo) };
  }
  if (atom === 'T2_LOGO') {
    const logo = state.redTeam?.logo;
    if (logo) return { kind: 'image', value: normalizedAssetUrl(logo) };
  }

  // Map
  if (atom === 'MAP') {
    const mapId = state.map;
    return { kind: 'image', value: mapThumbUrl(mapId) };
  }

  // Custom atoms
  if (atom === 'CUSTOM_TEXT') {
    return { kind: 'text', value: String(component.text || '') };
  }
  if (atom === 'CUSTOM_IMAGE') {
    return { kind: 'image', value: normalizedAssetUrl(component.src || '') };
  }

  return { kind: 'text', value: '' };
}

// Previous picks/bans for slam+audio diffing
let previousPicks = {
  blue: [],
  red: [],
};

let previousBans = {
  blue: [],
  red: [],
};

function triggerSlamForAtom(component, state) {
  const atom = String(component.atom || '').trim();
  const bind = component.bind && typeof component.bind === 'object' ? component.bind : {};
  const idx =
    typeof bind.idx === 'number'
      ? Math.max(0, Math.min(9, bind.idx))
      : Number.isFinite(Number(bind.idx))
      ? Math.max(0, Math.min(9, Number(bind.idx)))
      : null;

  if (idx == null) return;

  let prevHero = 'none';
  let nextHero = 'none';
  let sideKey = null;
  let isPick = false;

  if (atom === 'T1_PICK') {
    sideKey = 'blue';
    isPick = true;
    prevHero = previousPicks.blue[idx] || 'none';
    nextHero = state.blueTeam?.picks?.[idx] || 'none';
  } else if (atom === 'T2_PICK') {
    sideKey = 'red';
    isPick = true;
    prevHero = previousPicks.red[idx] || 'none';
    nextHero = state.redTeam?.picks?.[idx] || 'none';
  } else if (atom === 'T1_BAN') {
    sideKey = 'blue';
    prevHero = previousBans.blue[idx] || 'none';
    nextHero = state.blueTeam?.bans?.[idx] || 'none';
  } else if (atom === 'T2_BAN') {
    sideKey = 'red';
    prevHero = previousBans.red[idx] || 'none';
    nextHero = state.redTeam?.bans?.[idx] || 'none';
  }

  if (!sideKey) return;

  const fromEmpty = !prevHero || prevHero === 'none';
  const toHero = nextHero && nextHero !== 'none';
  if (!(fromEmpty && toHero)) return;

  // Visual slam
  const domId = componentDomId(component);
  const { el } = getImgTarget(domId);
  if (el) {
    el.classList.remove('animate-slam');
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add('animate-slam');
    window.setTimeout(() => {
      el.classList.remove('animate-slam');
    }, 500);
  }

  // Audio: attempt hero-specific voiceline
  try {
    const heroId = String(nextHero || '').trim().toLowerCase();
    if (!heroId || heroId === 'none') return;
    const url = `${SERVER_URL}/Assets/VoiceLines/${encodeURIComponent(heroId)}.ogg`;
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.onerror = () => {
      // Missing file or decode error – fail silently
    };
    audio.play().catch(() => {
      // Autoplay restrictions or other errors – ignore
    });
  } catch {
    // ignore
  }
}

// renderOverlay: pure mapping from unified state + layout → DOM, plus slam/audio
function renderOverlay(state, layout) {
  currentState = state;
  currentLayout = layout || currentLayout;

  if (!currentLayout || !Array.isArray(currentLayout.components)) return;

  const comps = currentLayout.components;
  const seen = new Set();

  for (const component of comps) {
    const domId = componentDomId(component);
    if (!domId) continue;
    seen.add(domId);

    ensureComponentEl(domId, component);
    const resolved = resolveComponentValue(component, state);

    if (resolved.kind === 'image') {
      setImageIfExists(domId, resolved.value, true);
      // After setting the new image, check if this component should slam+sound
      triggerSlamForAtom(component, state);
    } else {
      setTextIfExists(domId, resolved.value);
    }
  }

  const container = componentsLayer || overlayRoot || document.body;
  Array.from(container.querySelectorAll('.component')).forEach((node) => {
    if (node.id && !seen.has(node.id)) node.remove();
  });

  // Update memory for next diff
  previousPicks = {
    blue: Array.isArray(state.blueTeam?.picks) ? [...state.blueTeam.picks] : [],
    red: Array.isArray(state.redTeam?.picks) ? [...state.redTeam.picks] : [],
  };
  previousBans = {
    blue: Array.isArray(state.blueTeam?.bans) ? [...state.blueTeam.bans] : [],
    red: Array.isArray(state.redTeam?.bans) ? [...state.redTeam.bans] : [],
  };
}

// ─────────────────────────────────────────────────────────────
// Scaling & socket sync (Task 4)
// ─────────────────────────────────────────────────────────────

function applyOverlayScale() {
  try {
    if (!overlayRoot) return;
    const vw = window.innerWidth || 1920;
    const vh = window.innerHeight || 1080;
    const widthRatio = vw / 1920;
    const heightRatio = vh / 1080;
    const scale = Math.min(widthRatio, heightRatio);

    overlayRoot.style.transformOrigin = 'top left';
    overlayRoot.style.transform = `scale(${Number.isFinite(scale) ? scale : 1})`;
    overlayRoot.style.left = `${(vw - 1920 * scale) / 2}px`;
    overlayRoot.style.top = `${(vh - 1080 * scale) / 2}px`;
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

async function bootstrap() {
  try {
    document.body.style.backgroundColor = '#000';
  } catch {
    // ignore
  }

  const layoutId = getLayoutId();
  currentLayoutId = layoutId;

  applyOverlayScale();
  window.addEventListener('resize', applyOverlayScale);

  // Start hero prefetch in the background
  startHeroPrefetchLoop();

  // Initial layout load
  try {
    const res = await fetch(`/api/layouts/${encodeURIComponent(layoutId)}`);
    if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
    const data = await res.json();
    currentLayout = data.layout;

    applyLayoutStyles(currentLayout);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    if (overlayRoot) {
      overlayRoot.innerHTML =
        '<div class="component text" style="left:20px;top:20px;width:800px;height:40px;">Layout load error</div>';
    }
    return;
  }

  // Initial state hydrate (REST) so overlay paints even before sockets
  try {
    const res = await fetch('/api/matchdraft');
    if (res.ok) {
      const json = await res.json();
      if (json && json.draftdata) {
        currentState = json.draftdata;
        renderOverlay(currentState, currentLayout);
      }
    }
  } catch {
    // ignore
  }

  const socket = io(SERVER_URL);

  async function reloadLayout(id, force) {
    const nextId = String(id || '').trim();
    if (!nextId) return;
    if (!force && nextId === currentLayoutId && currentLayout) return;

    try {
      const res = await fetch(`/api/layouts/${encodeURIComponent(nextId)}`);
      if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
      const data = await res.json();
      currentLayoutId = nextId;
      currentLayout = data.layout;

      applyLayoutStyles(currentLayout);
      if (currentState) renderOverlay(currentState, currentLayout);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Layout reload failed:', e.message);
    }
  }

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('Connected to MLBB State Server');
  });

  socket.on('STATE_SYNC', (state) => {
    currentState = state;
    renderOverlay(currentState, currentLayout);
  });

  socket.on('LAYOUT_UPDATE', (layoutIdPayload) => {
    const id = String(layoutIdPayload || '').trim();
    if (id && id !== currentLayoutId) return;
    reloadLayout(currentLayoutId, true);
  });

  socket.on('ACTIVE_LAYOUT_CHANGED', ({ id }) => {
    if (!shouldFollowLiveLayout()) return;
    const nextId = String(id || '').trim();
    if (!nextId) return;
    reloadLayout(nextId, false);
  });

  socket.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log('Disconnected from MLBB State Server');
  });
}

bootstrap();

