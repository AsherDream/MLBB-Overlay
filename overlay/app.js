const overlayRoot = document.getElementById('overlayRoot');
const componentsLayer = document.getElementById('componentsLayer');
const bgImageEl = document.getElementById('bgImage');
const frameImageEl = document.getElementById('frameImage');

const lastValues = new Map();
let currentLayoutId = null;
let lastState = null;

function getLayoutId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'default_draft';
}

function setBackground(backgroundImage) {
    if (!bgImageEl) return;
    if (!backgroundImage) {
        bgImageEl.removeAttribute('src');
        return;
    }
    bgImageEl.src = backgroundImage;
}

function setFrame(frameImage) {
    if (!frameImageEl) return;
    if (!frameImage) {
        frameImageEl.removeAttribute('src');
        return;
    }
    frameImageEl.src = frameImage;
}

function ensureComponentEl(componentId, component) {
    let el = document.getElementById(componentId);
    if (!el) {
        el = document.createElement('div');
        el.id = componentId;
        el.className = 'component';

        // If this looks like an image slot, mount an <img> inside
        const id = String(componentId).toLowerCase();
        const wantsImg = id.includes('pick') || id.includes('ban') || id.includes('map');
        if (wantsImg) {
            const img = document.createElement('img');
            img.alt = '';
            el.appendChild(img);
        } else {
            el.classList.add('text');
        }

        (componentsLayer || overlayRoot).appendChild(el);
    }

    el.style.left = `${component.x}px`;
    el.style.top = `${component.y}px`;
    el.style.width = `${component.width}px`;
    el.style.height = `${component.height}px`;
    return el;
}

function paintLayout(layout) {
    if (componentsLayer) componentsLayer.innerHTML = '';
    lastValues.clear();

    setBackground(layout.backgroundImage);
    setFrame(layout.frameImage);

    (layout.components || []).forEach((c) => {
        ensureComponentEl(c.id, c);
    });
}

function mapThumb(mapName) {
    if (!mapName || mapName === 'none') return '/Assets/Maps/idle.png';
    const safe = String(mapName).toLowerCase();
    return `/Assets/Maps/${safe}.png`;
}

function heroThumb(hero) {
    if (!hero || hero === 'none') return '/Assets/HeroPick/idle.png';
    const safe = String(hero).toLowerCase();
    return `/Assets/HeroPick/${safe}.png`;
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
    }
}

function updateOverlay(state) {
    // Map syncing (mapType preferred)
    const mapType = state?.mapType || state?.map || 'none';
    const showMap = mapType && mapType !== 'none';
    setImageIfExists('map-slot', mapThumb(mapType), showMap);

    // Hero picks & bans (1..5)
    for (let i = 0; i < 5; i++) {
        const idx = i + 1;

        const bp = state?.blueTeam?.picks?.[i] || 'none';
        const rp = state?.redTeam?.picks?.[i] || 'none';
        const bb = state?.blueTeam?.bans?.[i] || 'none';
        const rb = state?.redTeam?.bans?.[i] || 'none';

        setImageIfExists(`blue-pick-${idx}`, heroThumb(bp), bp !== 'none');
        setImageIfExists(`red-pick-${idx}`, heroThumb(rp), rp !== 'none');
        setImageIfExists(`blue-ban-${idx}`, heroThumb(bb), bb !== 'none');
        setImageIfExists(`red-ban-${idx}`, heroThumb(rb), rb !== 'none');
    }

    // Text fields
    setTextIfExists('blue-team-name', state?.blueTeam?.name || '');
    setTextIfExists('red-team-name', state?.redTeam?.name || '');
    setTextIfExists('blue-score', String(state?.blueTeam?.score ?? ''));
    setTextIfExists('red-score', String(state?.redTeam?.score ?? ''));

    for (let i = 0; i < 5; i++) {
        const idx = i + 1;
        setTextIfExists(`blue-player-${idx}`, state?.blueTeam?.players?.[i]?.name || '');
        setTextIfExists(`red-player-${idx}`, state?.redTeam?.players?.[i]?.name || '');
    }
}

async function bootstrap() {
    const layoutId = getLayoutId();
    console.log('Overlay boot: layoutId=', layoutId);
    currentLayoutId = layoutId;

    try {
        const res = await fetch(`/api/layouts/${encodeURIComponent(layoutId)}`);
        if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
        const data = await res.json();
        paintLayout(data.layout);
    } catch (e) {
        console.error(e);
        overlayRoot.innerHTML = `<div class="component text" style="left:20px;top:20px;width:800px;height:40px;">Layout load error: ${e.message}</div>`;
        return;
    }

    const socket = io('http://localhost:3000');

    async function loadAndApplyLayout(nextId) {
        const id = String(nextId || '').trim();
        if (!id || id === currentLayoutId) return;
        try {
            const res = await fetch(`/api/layouts/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
            const data = await res.json();
            paintLayout(data.layout);
            currentLayoutId = id;
            if (lastState) updateOverlay(lastState);
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
        updateOverlay(data);
    });

    socket.on('ACTIVE_LAYOUT_CHANGED', (payload) => {
        loadAndApplyLayout(payload?.id);
    });

    socket.on('STATE_ERROR', (error) => {
        console.error('State error:', error);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from MLBB State Server');
    });
}

bootstrap();
