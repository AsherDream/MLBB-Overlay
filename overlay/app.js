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

const lastValues = new Map();
let currentLayoutId = null;
let lastState = null;

let lastLayout = null;

let previousState = null;

let volumeSettings = {
    enabled: true,
    master: 1,
    pick: 1,
    ban: 0.6
};

const SERVER_URL = (() => {
    try {
        if (typeof window !== 'undefined' && window.location && window.location.origin) return window.location.origin;
    } catch {
        // ignore
    }
    return 'http://localhost:3000';
})();

const TRANSPARENT_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X6nVsAAAAASUVORK5CYII=';

let lastThemeFontUrl = null;
let lastThemeFontFamily = null;

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

async function loadThemeFont(fontFile) {
    try {
        const f = String(fontFile || '').trim();
        if (!f) return;
        const url = cacheBust(`${SERVER_URL}/Assets/costum/Theme/fonts/${encodeURIComponent(f)}`);
        if (lastThemeFontUrl === url && lastThemeFontFamily) {
            setCssVar('--main-font', `${lastThemeFontFamily}, Arial, sans-serif`);
            return;
        }

        const family = 'ThemeFont';
        const face = new FontFace(family, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        lastThemeFontUrl = url;
        lastThemeFontFamily = family;
        setCssVar('--main-font', `${family}, Arial, sans-serif`);
    } catch (e) {
        console.warn('Theme font load failed:', e?.message || e);
    }
}

async function injectTheme(themeData) {
    try {
        try {
            document.body.style.backgroundColor = '#000';
        } catch {
            // ignore
        }

        const t = themeData && typeof themeData === 'object' ? themeData : {};

        const colors = t.colors && typeof t.colors === 'object' ? t.colors : {};
        Object.entries(colors).forEach(([k, v]) => {
            if (!k) return;
            setCssVar(`--theme-${k}`, v);
        });

        const multiplier = Number(t?.typography?.fontSizeMultiplier);
        setCssVar('--font-size-multiplier', Number.isFinite(multiplier) ? multiplier : 1);

        const disableGlow = !!t?.toggles?.disableGlow;
        const hidePattern = !!t?.toggles?.hidePattern;
        const disableBoxShadow = !!t?.toggles?.disableBoxShadow;
        setCssVar('--toggle-disableGlow', disableGlow ? 1 : 0);
        setCssVar('--toggle-hidePattern', hidePattern ? 1 : 0);
        setCssVar('--toggle-disableBoxShadow', disableBoxShadow ? 1 : 0);

        const useCustomFont = !!t?.typography?.useCustomFont;
        const fontFile = String(t?.typography?.fontFile || '').trim();
        if (useCustomFont && fontFile) {
            await loadThemeFont(fontFile);
        } else {
            lastThemeFontUrl = null;
            lastThemeFontFamily = null;
            setCssVar('--main-font', 'Arial, sans-serif');
        }

        const images = t.images && typeof t.images === 'object' ? t.images : {};
        const heroPickBg = String(images?.heroPickBg || '').trim();
        const lowerBg = String(images?.lowerBg || '').trim();
        const lowerMidBg = String(images?.lowerMidBg || '').trim();
        const masterFrame = String(images?.masterFrame || '').trim();

        const heroPickBgUrl = heroPickBg
            ? cacheBust(`${SERVER_URL}/Assets/costum/Theme/images/${encodeURIComponent(heroPickBg)}`)
            : TRANSPARENT_PX;
        const lowerBgUrl = lowerBg
            ? cacheBust(`${SERVER_URL}/Assets/costum/Theme/images/${encodeURIComponent(lowerBg)}`)
            : TRANSPARENT_PX;
        const lowerMidBgUrl = lowerMidBg
            ? cacheBust(`${SERVER_URL}/Assets/costum/Theme/images/${encodeURIComponent(lowerMidBg)}`)
            : TRANSPARENT_PX;
        const masterFrameUrl = masterFrame
            ? cacheBust(`${SERVER_URL}/Assets/costum/Theme/images/${encodeURIComponent(masterFrame)}`)
            : TRANSPARENT_PX;

        if (themeBackgroundLayer) {
            themeBackgroundLayer.style.backgroundImage = heroPickBgUrl ? `url(\"${heroPickBgUrl}\")` : '';
        }
        if (themeLowerBgLayer) {
            themeLowerBgLayer.style.backgroundImage = lowerBgUrl ? `url(\"${lowerBgUrl}\")` : '';
        }
        if (themeLowerMidBgLayer) {
            themeLowerMidBgLayer.style.backgroundImage = lowerMidBgUrl ? `url(\"${lowerMidBgUrl}\")` : '';
        }
        if (themeMasterFrameLayer) {
            themeMasterFrameLayer.style.backgroundImage = masterFrameUrl ? `url(\"${masterFrameUrl}\")` : '';
        }

        try {
            const bg = themeBackgroundLayer?.style?.backgroundImage || '';
            const isEmpty = !bg || bg === 'none' || bg === 'url("")' || bg === 'url()';
            if (isEmpty) document.body.style.backgroundColor = '#000';
        } catch {
            // ignore
        }

        // Keep stage scaling stable even when theme updates trigger reflow.
        applyOverlayScale();
    } catch {
        // ignore
    }
}

function getHeroAsset(heroName, type) {
    const name = String(heroName || '').trim().toLowerCase();
    if (!name || name === 'none') return TRANSPARENT_PX;
    if (type === 'portrait') return `${SERVER_URL}/Assets/HeroPick/${encodeURIComponent(name)}.png`;
    if (type === 'voice') return `${SERVER_URL}/Assets/VoiceLines/${encodeURIComponent(name)}.ogg`;
    return TRANSPARENT_PX;
}

function getByPath(obj, pathStr) {
    try {
        const path = String(pathStr || '').trim();
        if (!path) return undefined;
        // Supports dot paths + [idx]
        const parts = path
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .filter(Boolean);
        let cur = obj;
        for (const p of parts) {
            if (cur == null) return undefined;
            cur = cur[p];
        }
        return cur;
    } catch {
        return undefined;
    }
}

function componentDomId(c) {
    if (!c || typeof c !== 'object') return '';
    if (c.instanceId) return String(c.instanceId);
    if (c.id) return String(c.id);
    return '';
}

function componentMeta(c) {
    const isNew = !!(c && typeof c === 'object' && c.instanceId && c.atom);
    return { isNew };
}

function resolveComponentRender(c, state) {
    const { isNew } = componentMeta(c);

    // New schema: atom + bind
    if (isNew) {
        const atom = String(c.atom || '').trim();
        const bind = c.bind && typeof c.bind === 'object' ? c.bind : {};
        const side = bind.side === 'blueTeam' ? 'blueTeam' : bind.side === 'redTeam' ? 'redTeam' : null;
        const idx = Number.isFinite(Number(bind.idx)) ? Math.max(0, Math.min(4, Number(bind.idx))) : null;

        if (atom === 'T1_NAME') return { kind: 'text', value: state?.blueTeam?.name || '' };
        if (atom === 'T2_NAME') return { kind: 'text', value: state?.redTeam?.name || '' };

        if (atom === 'T1_SCORE') return { kind: 'text', value: String(state?.blueTeam?.score ?? '') };
        if (atom === 'T2_SCORE') return { kind: 'text', value: String(state?.redTeam?.score ?? '') };

        if (atom === 'T1_PLAYER_NAME' && idx != null) return { kind: 'text', value: state?.blueTeam?.players?.[idx] || '' };
        if (atom === 'T2_PLAYER_NAME' && idx != null) return { kind: 'text', value: state?.redTeam?.players?.[idx] || '' };

        if (atom === 'T1_PICK' && idx != null) {
            const hero = state?.blueTeam?.picks?.[idx] || 'none';
            return { kind: 'image', value: getHeroAsset(hero, 'portrait') };
        }
        if (atom === 'T2_PICK' && idx != null) {
            const hero = state?.redTeam?.picks?.[idx] || 'none';
            return { kind: 'image', value: getHeroAsset(hero, 'portrait') };
        }

        if (atom === 'T1_BAN' && idx != null) {
            const hero = state?.blueTeam?.bans?.[idx] || 'none';
            return { kind: 'image', value: getHeroAsset(hero, 'portrait') };
        }
        if (atom === 'T2_BAN' && idx != null) {
            const hero = state?.redTeam?.bans?.[idx] || 'none';
            return { kind: 'image', value: getHeroAsset(hero, 'portrait') };
        }

        // Escape hatch: bind.path (for fully custom future components)
        if (bind.path) {
            const v = getByPath(state, bind.path);
            const format = String(bind.format || '').trim();
            if (format === 'heroPortrait') return { kind: 'image', value: getHeroAsset(v, 'portrait') };
            if (format === 'mapThumb') return { kind: 'image', value: mapThumb(v) };
            if (format === 'text' || !format) return { kind: 'text', value: String(v ?? '') };
        }

        // Default: show alias/atom
        return { kind: 'text', value: String(c.alias || atom || '') };
    }

    // Legacy schema fallback (id-driven). NOTE: this is a compatibility shim.
    const legacyId = String(c?.id || '').trim();
    if (!legacyId) return { kind: 'text', value: '' };

    const s = legacyId.toLowerCase();
    if (s === 'blue-team-name') return { kind: 'text', value: state?.blueTeam?.name || '' };
    if (s === 'red-team-name') return { kind: 'text', value: state?.redTeam?.name || '' };
    if (s === 'blue-score') return { kind: 'text', value: String(state?.blueTeam?.score ?? '') };
    if (s === 'red-score') return { kind: 'text', value: String(state?.redTeam?.score ?? '') };
    if (s === 'map-slot' || s.includes('map')) return { kind: 'image', value: mapThumb(state?.mapType || state?.map || 'none') };
    const pm = s.match(/(blue|red)-player-(\d+)/);
    if (pm) {
        const team = pm[1];
        const idx = Number(pm[2]) - 1;
        const val = team === 'blue' ? state?.blueTeam?.players?.[idx] : state?.redTeam?.players?.[idx];
        return { kind: 'text', value: String(val || '') };
    }
    const pick = s.match(/(blue|red)-pick-(\d+)/);
    if (pick) {
        const team = pick[1];
        const idx = Number(pick[2]) - 1;
        const hero = team === 'blue' ? state?.blueTeam?.picks?.[idx] : state?.redTeam?.picks?.[idx];
        return { kind: 'image', value: getHeroAsset(hero || 'none', 'portrait') };
    }
    const ban = s.match(/(blue|red)-ban-(\d+)/);
    if (ban) {
        const team = ban[1];
        const idx = Number(ban[2]) - 1;
        const hero = team === 'blue' ? state?.blueTeam?.bans?.[idx] : state?.redTeam?.bans?.[idx];
        return { kind: 'image', value: getHeroAsset(hero || 'none', 'portrait') };
    }

    return { kind: isImageId(legacyId) ? 'image' : 'text', value: String(c?.alias || '') };
}

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
        const url = getHeroAsset(safe, 'voice');

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

        playVoiceLine(name, {
            baseVolume: clamp01(volumeSettings.ban, 0.6),
            playbackRate: 0.9
        });
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

function shouldFollowLiveLayout() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('follow') === '1';
    } catch {
        return false;
    }
}

function setBackground(background) {
    if (!bgImageEl) return;
    if (!background) {
        bgImageEl.removeAttribute('src');
        return;
    }
    bgImageEl.src = cacheBust(background);
}

function setFrame(frame) {
    if (!frameImageEl) return;
    if (!frame) {
        frameImageEl.removeAttribute('src');
        return;
    }
    frameImageEl.src = cacheBust(frame);
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
    lastLayout = layout;
    lastValues.clear();

    setBackground(layout.background);
    setFrame(layout.frame);

    const comps = Array.isArray(layout?.components) ? layout.components : [];
    const seen = new Set();
    comps.forEach((c) => {
        const domId = componentDomId(c);
        if (!domId) return;
        seen.add(domId);
        ensureComponentEl(domId, c);
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
    return getHeroAsset(hero, 'portrait');
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
        img.src = nextSrc && nextSrc !== TRANSPARENT_PX ? cacheBust(nextSrc) : nextSrc;
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
    const layout = lastLayout;
    const comps = Array.isArray(layout?.components) ? layout.components : [];

    comps.forEach((c) => {
        const domId = componentDomId(c);
        if (!domId) return;
        const r = resolveComponentRender(c, state);
        if (r.kind === 'image') {
            setImageIfExists(domId, String(r.value || ''), true);

            // Optional audio/ban entry behaviors for standard atoms
            try {
                const { isNew } = componentMeta(c);
                if (isNew) {
                    const atom = String(c.atom || '');
                    const bind = c.bind && typeof c.bind === 'object' ? c.bind : {};
                    const idx = Number.isFinite(Number(bind.idx)) ? Math.max(0, Math.min(4, Number(bind.idx))) : null;
                    if (idx != null) {
                        if (atom === 'T1_PICK') {
                            const bp = state?.blueTeam?.picks?.[idx] || 'none';
                            const prevBp = prev?.blueTeam?.picks?.[idx] || 'none';
                            if (prevBp === 'none' && bp !== 'none') playVoiceLine(bp, { baseVolume: clamp01(volumeSettings.pick, 1), playbackRate: 1 });
                        }
                        if (atom === 'T2_PICK') {
                            const rp = state?.redTeam?.picks?.[idx] || 'none';
                            const prevRp = prev?.redTeam?.picks?.[idx] || 'none';
                            if (prevRp === 'none' && rp !== 'none') playVoiceLine(rp, { baseVolume: clamp01(volumeSettings.pick, 1), playbackRate: 1 });
                        }
                        if (atom === 'T1_BAN') {
                            const bb = state?.blueTeam?.bans?.[idx] || 'none';
                            const prevBb = prev?.blueTeam?.bans?.[idx] || 'none';
                            if (prevBb === 'none' && bb !== 'none') {
                                triggerBanEntry(domId);
                                playBanSequence(bb);
                            }
                        }
                        if (atom === 'T2_BAN') {
                            const rb = state?.redTeam?.bans?.[idx] || 'none';
                            const prevRb = prev?.redTeam?.bans?.[idx] || 'none';
                            if (prevRb === 'none' && rb !== 'none') {
                                triggerBanEntry(domId);
                                playBanSequence(rb);
                            }
                        }
                    }
                }
            } catch {
                // ignore
            }
        } else {
            setTextIfExists(domId, String(r.value ?? ''));
        }
    });

    previousState = state;
}

function applyOverlayScale() {
    try {
        if (!overlayRoot) return;
        const vw = window.innerWidth || 1920;
        const vh = window.innerHeight || 1080;
        const widthRatio = vw / 1920;
        const heightRatio = vh / 1080;
        const s = Math.min(widthRatio, heightRatio);

        overlayRoot.style.transformOrigin = 'top left';
        overlayRoot.style.transform = `scale(${Number.isFinite(s) ? s : 1})`;
        overlayRoot.style.left = `${(vw - (1920 * s)) / 2}px`;
        overlayRoot.style.top = `${(vh - (1080 * s)) / 2}px`;
    } catch {
        // ignore
    }
}

async function bootstrap() {
    try {
        document.body.style.backgroundColor = '#000';
    } catch {
        // ignore
    }

    const layoutId = getLayoutId();
    console.log('Overlay boot: layoutId=', layoutId);
    currentLayoutId = layoutId;

    applyOverlayScale();
    window.addEventListener('resize', applyOverlayScale);

    try {
        const themeRes = await fetch('/api/theme');
        if (themeRes.ok) {
            const themeJson = await themeRes.json();
            if (themeJson && themeJson.theme) {
                await injectTheme(themeJson.theme);
            }
        }
    } catch {
        // ignore
    }

    try {
        const res = await fetch(`/api/layouts/${encodeURIComponent(layoutId)}`);
        if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`);
        const data = await res.json();
        applyLayoutInPlace(data.layout);

        // If layout background is empty, keep black body fallback and avoid broken <img> by clearing bg image.
        try {
            if (!data?.layout?.background && !data?.layout?.backgroundImage) {
                setBackground(TRANSPARENT_PX);
            }
        } catch {
            // ignore
        }
    } catch (e) {
        console.error(e);
        overlayRoot.innerHTML = `<div class="component text" style="left:20px;top:20px;width:800px;height:40px;">Layout load error: ${e.message}</div>`;
        return;
    }

    // Initial state hydrate (REST) so the overlay paints immediately even before sockets connect.
    try {
        const res = await fetch('/api/matchdraft');
        if (res.ok) {
            const json = await res.json();
            if (json && json.draftdata) {
                lastState = json.draftdata;
                renderOverlay(json.draftdata);
            }
        }
    } catch {
        // ignore
    }

    const socket = io(SERVER_URL);

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
        renderOverlay(data);
    });

    socket.on('theme_update', (data) => {
        injectTheme(data);
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

    socket.on('STATE_ERROR', (error) => {
        console.error('State error:', error);
    });

    socket.on('LAYOUT_UPDATE', (layoutId) => {
        console.log('Layout update received:', layoutId);
        const id = String(layoutId || '').trim();
        if (id && id !== currentLayoutId) return;
        loadAndApplyLayout(currentLayoutId, true);
    });

    socket.on('ACTIVE_LAYOUT_CHANGED', ({ id }) => {
        try {
            if (!shouldFollowLiveLayout()) return;
            const nextId = String(id || '').trim();
            if (!nextId) return;
            loadAndApplyLayout(nextId, false);
        } catch {
            // ignore
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from MLBB State Server');
    });
}

bootstrap();
