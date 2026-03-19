import { getLayoutId, shouldFollowLiveLayout, startHeroPrefetchLoop } from './js/utils.js'
import { initAudioUnlocker, updateAudioConfig } from './js/audioEngine.js'
import { applyOverlayScale, applyLayoutStyles, renderOverlay, setLayoutLoadError } from './js/renderer.js'

let currentLayoutId = null
let currentLayout = null
let currentState = null

// ─────────────────────────────────────────────────────────────
// Scheduled rendering (max once per frame)
// ─────────────────────────────────────────────────────────────

let pendingState = null
let rendering = false

function scheduleRender(state) {
  pendingState = state
  currentState = state
  if (rendering) return
  rendering = true

  requestAnimationFrame(() => {
    renderOverlay(pendingState, currentLayout)
    rendering = false
  })
}

// ─────────────────────────────────────────────────────────────
// Bootstrap (orchestrator only)
// ─────────────────────────────────────────────────────────────

async function bootstrap() {
  // 1. MUST be first (captures first user interaction)
  initAudioUnlocker()

  // Preserve legacy background styling
  try {
    document.body.style.backgroundColor = '#000'
  } catch {
    // ignore
  }

  // 2. Setup scaling
  applyOverlayScale()
  window.addEventListener('resize', applyOverlayScale)

  // 3. Prefetch assets
  startHeroPrefetchLoop()

  // 4. Load layout
  const layoutId = getLayoutId()
  currentLayoutId = layoutId

  try {
    const res = await fetch(`/api/layouts/${encodeURIComponent(layoutId)}`)
    if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`)
    const data = await res.json()
    currentLayout = data.layout

    // 5. Apply layout styles
    applyLayoutStyles(currentLayout)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    setLayoutLoadError()
    return
  }

  // 6. Initial render (if state exists)
  try {
    const res = await fetch('/api/matchdraft')
    if (res.ok) {
      const json = await res.json()
      if (json && json.draftdata) {
        currentState = json.draftdata
        renderOverlay(currentState, currentLayout)
      }
    }
  } catch {
    // ignore
  }

  // 7. Setup sockets
  const socket = io()

  async function reloadLayout(id, force) {
    const nextId = String(id || '').trim()
    if (!nextId) return
    if (!force && nextId === currentLayoutId && currentLayout) return

    try {
      const res = await fetch(`/api/layouts/${encodeURIComponent(nextId)}`)
      if (!res.ok) throw new Error(`Failed to load layout: ${res.status}`)
      const data = await res.json()
      currentLayoutId = nextId
      currentLayout = data.layout

      applyLayoutStyles(currentLayout)
      if (currentState) renderOverlay(currentState, currentLayout)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Layout reload failed:', e.message)
    }
  }

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('Connected to MLBB State Server')
  })

  socket.on('STATE_SYNC', scheduleRender)
  socket.on('AUDIO_SYNC', (cfg) => {
    updateAudioConfig(cfg)
  })

  socket.on('LAYOUT_UPDATE', (layoutIdPayload) => {
    const id = String(layoutIdPayload || '').trim()
    if (id && id !== currentLayoutId) return
    reloadLayout(currentLayoutId, true)
  })

  socket.on('ACTIVE_LAYOUT_CHANGED', (payload) => {
    if (!shouldFollowLiveLayout()) return

    const nextId = typeof payload === 'string' ? payload : payload?.id
    if (!nextId) return

    reloadLayout(String(nextId).trim(), false)
  })

  socket.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log('Disconnected from MLBB State Server')
  })
}

bootstrap()
