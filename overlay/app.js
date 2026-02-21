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

    const socket = io();

    socket.on('connect', () => {
        console.log('Connected to MLBB State Server');
    });

    socket.on('STATE_SYNC', (state) => {
        applyStateToLayout(state);
    });

    socket.on('STATE_ERROR', (error) => {
        console.error('State error:', error);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from MLBB State Server');
    });
}

bootstrap();
