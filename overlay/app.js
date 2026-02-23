const overlayRoot = document.getElementById('overlayRoot');
const overlayFit = document.getElementById('overlayFit');
const componentsLayer = document.getElementById('componentsLayer');
const bgImageEl = document.getElementById('bgImage');
const frameImageEl = document.getElementById('frameImage');

const lastValues = new Map();
let currentLayoutId = null;
let lastState = null;

let previousState = null;

let volumeSettings = {
    enabled: true,
    master: 1,
    pick: 1,
    ban: 0.6
};

const SERVER_URL = 'http://localhost:3000';

const TRANSPARENT_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X6nVsAAAAASUVORK5CYII=';

function isImageId(componentId) {
    const id = String(componentId || '').toLowerCase();
    return id.includes('pick') || id.includes('ban') || id.includes('logo') || id.includes('map');
}

function clamp01(n, fallback) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.max(0, Math.min(1, x));
}

async function audioExists(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return !!res.ok;
    } catch {
        return false;
    }
}

async function playVoiceLine(heroName, { baseVolume = 1, playbackRate = 1 } = {}) {
    try {
        if (!volumeSettings.enabled) return;
        const name = String(heroName || '').trim();
        if (!name || name === 'none') return;
        const safe = name.toLowerCase();
        const url = `${SERVER_URL}/Assets/VoiceLines/${safe}.ogg`;

        const ok = await audioExists(url);
        if (!ok) {
            console.warn('Missing Audio File:', name);
            return;
        }

        const audio = new Audio(url);
        audio.volume = clamp01(volumeSettings.master, 1) * clamp01(baseVolume, 1);
        audio.playbackRate = Number.isFinite(playbackRate) ? playbackRate : 1;
        audio.onerror = () => {
            // Missing voiceline -> ignore.
        };
        audio.play().catch(() => {
            // Autoplay restrictions / decode errors -> ignore.
        });
    } catch {
        // ignore
    }
}

async function playBanSequence(heroName) {
    try {
        if (!volumeSettings.enabled) return;
        const name = String(heroName || '').trim();
        if (!name || name === 'none') return;

        const slamUrl = `${SERVER_URL}/Assets/Sfx/ban_slam.mp3`;
        const hasSlam = await audioExists(slamUrl);
        if (!hasSlam) {
            console.warn('Missing Audio File:', 'ban_slam');
        }

        const slamSfx = new Audio(slamUrl);
        slamSfx.volume = clamp01(volumeSettings.master, 1) * 0.8;
        slamSfx.onerror = () => {
            // ignore
        };
        slamSfx.play().catch(() => {
            // ignore
        });

        window.setTimeout(() => {
            playVoiceLine(name, {
                baseVolume: clamp01(volumeSettings.ban, 0.6),
                playbackRate: 0.9
            });
        }, 200);
    } catch {
        // ignore
    }
}

function triggerBanEntry(slotId) {
    try {
        const el = document.getElementById(slotId);
        if (!el) return;
        el.classList.remove('ban-entry');
        // eslint-disable-next-line no-unused-expressions
        el.offsetWidth;
        el.classList.add('ban-entry');
        window.setTimeout(() => el.classList.remove('ban-entry'), 250);
    } catch {
        // ignore
    }
}

function getLayoutId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'default_draft';
}

function setBackground(background) {
    if (!bgImageEl) return;
    if (!background) {
        bgImageEl.removeAttribute('src');
        return;
    }
    bgImageEl.src = background;
}

function setFrame(frame) {
    if (!frameImageEl) return;
    if (!frame) {
        frameImageEl.removeAttribute('src');
        return;
    }
    frameImageEl.src = frame;
}

function ensureComponentEl(componentId, component) {
    let el = document.getElementById(componentId);
    if (!el) {
        el = document.createElement('div');
        el.id = componentId;
        el.className = 'component component-fade-in';

        // If this looks like an image slot, mount an <img> inside
        const wantsImg = isImageId(componentId);
        if (wantsImg) {
            const img = document.createElement('img');
            img.alt = '';
            el.appendChild(img);
        } else {
            el.classList.add('text');
        }

        (componentsLayer || overlayRoot).appendChild(el);
    }

    // Priority mapping: id-based image detection always wins.
    const wantsImg = isImageId(componentId);
    const hasImg = !!el.querySelector('img');
    if (wantsImg && !hasImg) {
        const img = document.createElement('img');
        img.alt = '';
        el.classList.remove('text');
        el.appendChild(img);
    }
    if (!wantsImg && hasImg) {
        el.querySelector('img')?.remove();
        el.classList.add('text');
    }

    const w = typeof component?.width === 'number' ? component.width : (typeof component?.w === 'number' ? component.w : 0);
    const h = typeof component?.height === 'number' ? component.height : (typeof component?.h === 'number' ? component.h : 0);

    // Diagnostics: verify 1:1 mapping with layouts.json.
    try {
        console.log('Rendering ID:', componentId, 'at X:', component?.x, 'Y:', component?.y);
    } catch {
        // ignore
    }

    el.style.left = `${component.x}px`;
    el.style.top = `${component.y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    // Ban visual container styling.
    const isBan = String(componentId || '').toLowerCase().includes('ban');
    el.classList.toggle('smartbox-ban', isBan);

    // Production visibility toggle: hide entirely on overlay
    el.style.display = component?.visible === false ? 'none' : 'block';
    return el;
}

function applyLayoutInPlace(layout) {
    lastValues.clear();

    setBackground(layout.background);
    setFrame(layout.frame);

    const comps = Array.isArray(layout?.components) ? layout.components : [];
    const seen = new Set();
    comps.forEach((c) => {
        if (!c?.id) return;
        seen.add(c.id);
        ensureComponentEl(c.id, c);
    });

    // Remove stale elements that are no longer in the layout
    const container = componentsLayer || overlayRoot;
    if (container) {
        Array.from(container.querySelectorAll('.component')).forEach((node) => {
            if (node?.id && !seen.has(node.id)) node.remove();
        });
    }
}

function mapThumb(mapName) {
    if (!mapName || mapName === 'none') return TRANSPARENT_PX;
    const safe = String(mapName).toLowerCase();
    return `${SERVER_URL}/Assets/Maps/${safe}.png`;
}

function heroThumb(hero) {
    if (!hero || hero === 'none') return TRANSPARENT_PX;
    const safe = String(hero).toLowerCase();
    return `${SERVER_URL}/Assets/HeroPick/${safe}.png`;
}

function getImgTarget(id) {
    const el = document.getElementById(id);
    if (!el) return { el: null, img: null };
    if (el.tagName === 'IMG') return { el, img: el };
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

function setImageIfExists(id, src, shouldShow) {
    const { el, img } = getImgTarget(id);
    if (!el || !img) return;

    const nextDisplay = shouldShow ? 'block' : 'none';
    const displayKey = `${id}::display`;
    if (lastValues.get(displayKey) !== nextDisplay) {
        el.style.display = nextDisplay;
        lastValues.set(displayKey, nextDisplay);
    }

    const nextSrc = shouldShow ? String(src || '') : '';
    const srcKey = `${id}::src`;
    if (lastValues.get(srcKey) !== nextSrc) {
        img.src = nextSrc;
        lastValues.set(srcKey, nextSrc);

        // Trigger an entry animation when portrait changes.
        try {
            img.classList.remove('img-flash');
            img.classList.remove('img-pop');
            // eslint-disable-next-line no-unused-expressions
            img.offsetWidth;
            img.classList.add(nextSrc && nextSrc !== TRANSPARENT_PX ? 'img-pop' : 'img-flash');
            window.setTimeout(() => {
                img.classList.remove('img-flash');
                img.classList.remove('img-pop');
            }, 300);
        } catch {
            // ignore
        }
    }

    // Priority styling: bans are desaturated/dimmed.
    const wantsBanFilter = String(id || '').toLowerCase().includes('ban');
    const nextFilter = wantsBanFilter ? 'grayscale(100%) brightness(50%)' : '';
    const filterKey = `${id}::filter`;
    if (lastValues.get(filterKey) !== nextFilter) {
        img.style.filter = nextFilter;
        lastValues.set(filterKey, nextFilter);
    }
}

function renderOverlay(state) {
    const prev = previousState;

    // Map syncing (mapType preferred)
    const mapType = state?.mapType || state?.map || 'none';
    setImageIfExists('map-slot', mapThumb(mapType), true);

    // Hero picks & bans (1..5)
    for (let i = 0; i < 5; i++) {
        const idx = i + 1;

        const bp = state?.blueTeam?.picks?.[i] || 'none';
        const rp = state?.redTeam?.picks?.[i] || 'none';
        const bb = state?.blueTeam?.bans?.[i] || 'none';
        const rb = state?.redTeam?.bans?.[i] || 'none';

        setImageIfExists(`blue-pick-${idx}`, heroThumb(bp), true);
        setImageIfExists(`red-pick-${idx}`, heroThumb(rp), true);
        setImageIfExists(`blue-ban-${idx}`, heroThumb(bb), true);
        setImageIfExists(`red-ban-${idx}`, heroThumb(rb), true);

        // Audio triggers + ban entry animation on transitions none -> hero.
        const prevBp = prev?.blueTeam?.picks?.[i] || 'none';
        const prevRp = prev?.redTeam?.picks?.[i] || 'none';
        const prevBb = prev?.blueTeam?.bans?.[i] || 'none';
        const prevRb = prev?.redTeam?.bans?.[i] || 'none';

        if (prevBp === 'none' && bp !== 'none') {
            playVoiceLine(bp, { baseVolume: clamp01(volumeSettings.pick, 1), playbackRate: 1 });
        }
        if (prevRp === 'none' && rp !== 'none') {
            playVoiceLine(rp, { baseVolume: clamp01(volumeSettings.pick, 1), playbackRate: 1 });
        }
        if (prevBb === 'none' && bb !== 'none') {
            triggerBanEntry(`blue-ban-${idx}`);
            playBanSequence(bb);
        }
        if (prevRb === 'none' && rb !== 'none') {
            triggerBanEntry(`red-ban-${idx}`);
            playBanSequence(rb);
        }
    }

    // Text fields
    setTextIfExists('blue-team-name', state?.blueTeam?.name || '');
    setTextIfExists('red-team-name', state?.redTeam?.name || '');
    setTextIfExists('blue-score', String(state?.blueTeam?.score ?? ''));
    setTextIfExists('red-score', String(state?.redTeam?.score ?? ''));

    for (let i = 0; i < 5; i++) {
        const idx = i + 1;
        setTextIfExists(`blue-player-${idx}`, state?.blueTeam?.players?.[i] || '');
        setTextIfExists(`red-player-${idx}`, state?.redTeam?.players?.[i] || '');
    }

    previousState = state;
}

function applyOverlayScale() {
    try {
        if (!overlayFit) return;
        const vw = window.innerWidth || 1920;
        const vh = window.innerHeight || 1080;
        const s = Math.min(vw / 1920, vh / 1080);

        overlayFit.style.transformOrigin = 'top left';
        overlayFit.style.transform = `scale(${Number.isFinite(s) ? s : 1})`;
    } catch {
        // ignore
    }
}

async function bootstrap() {
    const layoutId = getLayoutId();
    console.log('Overlay boot: layoutId=', layoutId);
    currentLayoutId = layoutId;

    applyOverlayScale();
    window.addEventListener('resize', applyOverlayScale);

    try {
        const res = await fetch(`/api/layouts/${encodeURIComponent(layoutId)}`);
        if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
        const data = await res.json();
        applyLayoutInPlace(data.layout);
    } catch (e) {
        console.error(e);
        overlayRoot.innerHTML = `<div class="component text" style="left:20px;top:20px;width:800px;height:40px;">Layout load error: ${e.message}</div>`;
        return;
    }

    const socket = io('http://localhost:3000');

    async function loadAndApplyLayout(nextId, force) {
        const id = String(nextId || '').trim();
        if (!id) return;
        if (!force && id === currentLayoutId) return;
        try {
            const res = await fetch(`/api/layouts/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
            const data = await res.json();
            applyLayoutInPlace(data.layout);
            currentLayoutId = id;
            if (lastState) renderOverlay(lastState);
        } catch (e) {
            console.error('Layout swap failed:', e.message);
        }
    }

    socket.on('connect', () => {
        console.log('Connected to MLBB State Server');
    });

    socket.on('STATE_SYNC', (data) => {
        lastState = data;
        if (data?.activeLayout) loadAndApplyLayout(data.activeLayout);
        renderOverlay(data);
    });

    socket.on('VOLUME_CHANGE', (payload) => {
        try {
            volumeSettings = {
                enabled: typeof payload?.enabled === 'boolean' ? payload.enabled : volumeSettings.enabled,
                master: clamp01(payload?.master, volumeSettings.master),
                pick: clamp01(payload?.pick, volumeSettings.pick),
                ban: clamp01(payload?.ban, volumeSettings.ban)
            };
        } catch {
            // ignore
        }
    });

    socket.on('ACTIVE_LAYOUT_CHANGED', (payload) => {
        loadAndApplyLayout(payload?.id);
    });

    socket.on('STATE_ERROR', (error) => {
        console.error('State error:', error);
    });

    socket.on('LAYOUT_UPDATE', (layoutId) => {
        console.log('Layout update received:', layoutId);
        const id = String(layoutId || '').trim() || currentLayoutId;
        loadAndApplyLayout(id, true);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from MLBB State Server');
    });
}

bootstrap();
