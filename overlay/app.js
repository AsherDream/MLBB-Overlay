const overlayRoot = document.getElementById('overlayRoot');

function getLayoutId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'default_draft';
}

function setBackground(backgroundImage) {
    if (!backgroundImage) return;
    overlayRoot.style.backgroundImage = `url(${backgroundImage})`;
}

function ensureComponentEl(componentId, component) {
    let el = document.getElementById(componentId);
    if (el) return el;

    el = document.createElement('div');
    el.id = componentId;
    el.className = 'component text';
    el.style.left = `${component.x}px`;
    el.style.top = `${component.y}px`;
    el.style.width = `${component.width}px`;
    el.style.height = `${component.height}px`;
    overlayRoot.appendChild(el);
    return el;
}

function paintLayout(layout) {
    overlayRoot.innerHTML = '';
    overlayRoot.style.backgroundImage = '';
    setBackground(layout.backgroundImage);

    (layout.components || []).forEach((c) => {
        ensureComponentEl(c.id, c);
    });
}

function getValueForComponentId(state, componentId) {
    switch (componentId) {
        case 'blueTeamName':
            return state?.blueTeam?.name || '';
        case 'redTeamName':
            return state?.redTeam?.name || '';
        case 'bluePick1':
            return state?.blueTeam?.picks?.[0] || '';
        default:
            return '';
    }
}

function applyStateToLayout(state) {
    const els = overlayRoot.querySelectorAll('.component');
    els.forEach((el) => {
        const componentId = el.id;
        const value = getValueForComponentId(state, componentId);
        el.textContent = value;
    });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
}

function setImage(id, src) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'IMG') {
        el.src = src;
        return;
    }
    const img = el.querySelector('img');
    if (img) img.src = src;
}

function heroThumb(hero) {
    if (!hero || hero === 'none') return '/assets/HeroPick/idle.png';
    const safe = String(hero).toLowerCase();
    return `/assets/HeroPick/${safe}.png`;
}

function updateOverlay(data) {
    // Text IDs (support both camelCase and kebab-case)
    setText('blueTeamName', data?.blueTeam?.name || '');
    setText('blue-team-name', data?.blueTeam?.name || '');
    setText('redTeamName', data?.redTeam?.name || '');
    setText('red-team-name', data?.redTeam?.name || '');

    setText('blueScore', String(data?.blueTeam?.score ?? ''));
    setText('blue-score', String(data?.blueTeam?.score ?? ''));
    setText('redScore', String(data?.redTeam?.score ?? ''));
    setText('red-score', String(data?.redTeam?.score ?? ''));

    // Common pick/ban slots (1..5)
    for (let i = 0; i < 5; i++) {
        const idx = i + 1;
        const bp = data?.blueTeam?.picks?.[i] || 'none';
        const rp = data?.redTeam?.picks?.[i] || 'none';
        const bb = data?.blueTeam?.bans?.[i] || 'none';
        const rb = data?.redTeam?.bans?.[i] || 'none';

        setText(`bluePick${idx}`, bp);
        setText(`blue-pick-${idx}`, bp);
        setText(`redPick${idx}`, rp);
        setText(`red-pick-${idx}`, rp);

        setText(`blueBan${idx}`, bb);
        setText(`blue-ban-${idx}`, bb);
        setText(`redBan${idx}`, rb);
        setText(`red-ban-${idx}`, rb);

        // If your layout uses <img> elements with these ids, update the images too
        setImage(`bluePickImg${idx}`, heroThumb(bp));
        setImage(`blue-pick-img-${idx}`, heroThumb(bp));
        setImage(`redPickImg${idx}`, heroThumb(rp));
        setImage(`red-pick-img-${idx}`, heroThumb(rp));

        setImage(`blueBanImg${idx}`, heroThumb(bb));
        setImage(`blue-ban-img-${idx}`, heroThumb(bb));
        setImage(`redBanImg${idx}`, heroThumb(rb));
        setImage(`red-ban-img-${idx}`, heroThumb(rb));
    }

    // Always keep the dynamic layout update too
    applyStateToLayout(data);
}

async function bootstrap() {
    const layoutId = getLayoutId();
    console.log('Overlay boot: layoutId=', layoutId);

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

    socket.on('connect', () => {
        console.log('Connected to MLBB State Server');
    });

    socket.on('STATE_SYNC', (data) => {
        console.log('Data Received:', data);
        updateOverlay(data);
    });

    socket.on('STATE_ERROR', (error) => {
        console.error('State error:', error);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from MLBB State Server');
    });
}

bootstrap();
