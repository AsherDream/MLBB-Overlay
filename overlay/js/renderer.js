import { SERVER_URL, TRANSPARENT_PX, resolveAssetUrl, cacheBust, setCssVar } from './utils.js'
import { playHeroAudio } from './audioEngine.js'

// DOM references (5-layer pipeline)
const overlayRoot = document.getElementById('overlayRoot')
const overlayFit = document.getElementById('overlayFit')

const bgLayer = document.getElementById('bgLayer')
const backgroundLayer = document.getElementById('background-layer')
const componentsLayer = document.getElementById('componentsLayer')
const frameLayer = document.getElementById('frameLayer')
const topLayer = document.getElementById('topLayer')

const bgImageEl = document.getElementById('bgImage')
const frameImageEl = document.getElementById('frameImage')

// ─────────────────────────────────────────────────────────────
// Rendering state
// ─────────────────────────────────────────────────────────────

const lastValues = new Map() // cache per component-id + field

let previousPicks = {
  blue: [],
  red: [],
}

let previousBans = {
  blue: [],
  red: [],
}

let isFirstRender = true

// ─────────────────────────────────────────────────────────────
// Layout‑driven styling
// ─────────────────────────────────────────────────────────────

function normalizedAssetUrl(maybePath) {
  const s = String(maybePath || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) return s
  return `${SERVER_URL}/Assets/${s}`
}

export function applyLayoutStyles(layout) {
  if (!layout || typeof layout !== 'object') return

  // layout.background → #bgLayer
  const background = normalizedAssetUrl(layout.background || '')
  if (bgImageEl) {
    if (background) {
      bgImageEl.src = cacheBust(background)
    } else {
      bgImageEl.removeAttribute('src')
    }
  }

  // layout.backgroundLayer → #background-layer
  if (backgroundLayer && layout.backgroundLayer) {
    const url = normalizedAssetUrl(layout.backgroundLayer)
    backgroundLayer.style.backgroundImage = url ? `url("${cacheBust(url)}")` : ''
  }

  // layout.frame / layout.masterFrame → #frameLayer
  const frameUrl = normalizedAssetUrl(layout.frame || layout.masterFrame || '')
  if (frameImageEl) {
    if (frameUrl) {
      frameImageEl.src = cacheBust(frameUrl)
    } else {
      frameImageEl.removeAttribute('src')
    }
  }

  const cfg = layout.config && typeof layout.config === 'object' ? layout.config : {}
  const cfgColors = cfg.colors && typeof cfg.colors === 'object' ? cfg.colors : {}
  Object.entries(cfgColors).forEach(([k, v]) => {
    if (!k) return
    setCssVar(`--layout-${k}`, v)
  })
}

// ─────────────────────────────────────────────────────────────
// Layout component DOM wiring
// ─────────────────────────────────────────────────────────────

function componentDomId(component) {
  if (!component || typeof component !== 'object') return ''
  if (component.instanceId) return String(component.instanceId)
  if (component.id) return String(component.id)
  return ''
}

function ensureComponentEl(domId, component) {
  let el = document.getElementById(domId)
  if (!el) {
    el = document.createElement('div')
    el.id = domId
    el.className = 'component'

    const img = document.createElement('img')
    img.alt = ''
    el.appendChild(img)

    componentsLayer.appendChild(el)
  }

  const w = typeof component?.width === 'number' ? component.width : 0
  const h = typeof component?.height === 'number' ? component.height : 0

  el.style.left = `${Math.round(component.x)}px`
  el.style.top = `${Math.round(component.y)}px`
  el.style.width = `${Math.round(w)}px`
  el.style.height = `${Math.round(h)}px`
  el.style.overflow = 'hidden'
  el.style.display = component.visible === false ? 'none' : 'block'

  const isBan = String(component.atom || '').includes('BAN')
  el.classList.toggle('smartbox-ban', isBan)

  return el
}

function getImgTarget(id) {
  const el = document.getElementById(id)
  if (!el) return { el: null, img: null }
  const img = el.querySelector('img')
  return { el, img }
}

function setTextIfExists(id, text) {
  const el = document.getElementById(id)
  if (!el) return
  const v = String(text ?? '')
  const key = `${id}::text`
  if (lastValues.get(key) === v) return
  el.textContent = v
  lastValues.set(key, v)
}

function setImageIfExists(id, src, visible) {
  const { el, img } = getImgTarget(id)
  if (!el || !img) return

  const displayValue = visible ? 'block' : 'none'
  const displayKey = `${id}::display`
  if (lastValues.get(displayKey) !== displayValue) {
    el.style.display = displayValue
    lastValues.set(displayKey, displayValue)
  }

  const nextSrc = visible ? String(src || '') : ''
  const srcKey = `${id}::src`
  if (lastValues.get(srcKey) !== nextSrc) {
    img.onerror = () => {
      img.src = TRANSPARENT_PX
      img.onerror = null
    }
    const finalSrc = nextSrc && nextSrc !== TRANSPARENT_PX ? cacheBust(nextSrc) : nextSrc
    img.src = finalSrc
    lastValues.set(srcKey, nextSrc)
  }
}

// ─────────────────────────────────────────────────────────────
// State-to-DOM mapping table (data-driven; no atom-specific logic in renderer)
// ─────────────────────────────────────────────────────────────

function bindIdx(component) {
  const bind = component.bind && typeof component.bind === 'object' ? component.bind : {}
  const idx =
    typeof bind.idx === 'number'
      ? Math.max(0, Math.min(9, bind.idx))
      : Number.isFinite(Number(bind.idx))
        ? Math.max(0, Math.min(9, Number(bind.idx)))
        : null
  return idx
}

const ATOM_MAP = {
  T1_NAME: (state) => ({
    kind: 'text',
    value: state?.blueTeam?.name || '',
  }),
  T2_NAME: (state) => ({
    kind: 'text',
    value: state?.redTeam?.name || '',
  }),
  T1_SCORE: (state) => ({
    kind: 'text',
    value: String(state?.blueTeam?.score ?? ''),
  }),
  T2_SCORE: (state) => ({
    kind: 'text',
    value: String(state?.redTeam?.score ?? ''),
  }),
  T1_PLAYER_NAME: (state, idx) => ({
    kind: 'text',
    value: state?.blueTeam?.players?.[idx] ?? '',
  }),
  T2_PLAYER_NAME: (state, idx) => ({
    kind: 'text',
    value: state?.redTeam?.players?.[idx] ?? '',
  }),
  T1_PICK: (state, idx) => ({
    kind: 'image',
    value: state?.blueTeam?.picks?.[idx] || 'none',
    asset: 'hero',
  }),
  T2_PICK: (state, idx) => ({
    kind: 'image',
    value: state?.redTeam?.picks?.[idx] || 'none',
    asset: 'hero',
  }),
  T1_BAN: (state, idx) => ({
    kind: 'image',
    value: state?.blueTeam?.bans?.[idx] || 'none',
    asset: 'hero',
  }),
  T2_BAN: (state, idx) => ({
    kind: 'image',
    value: state?.redTeam?.bans?.[idx] || 'none',
    asset: 'hero',
  }),
  T1_LOGO: (state) => ({
    kind: 'image',
    value: state?.blueTeam?.logo || 'none',
    asset: 'logo',
  }),
  T2_LOGO: (state) => ({
    kind: 'image',
    value: state?.redTeam?.logo || 'none',
    asset: 'logo',
  }),
  MAP: (state) => ({
    kind: 'image',
    value: state?.map || 'none',
    asset: 'map',
  }),
  CUSTOM_TEXT: (_state, _idx, component) => ({
    kind: 'text',
    value: String(component?.text || ''),
  }),
  CUSTOM_IMAGE: (_state, _idx, component) => ({
    kind: 'image',
    value: component?.src || '',
    asset: 'custom',
  }),
}

// Kept for compatibility with previous codepaths (not currently used in renderOverlay)
function resolveComponentValue(component, state) {
  const atom = String(component?.atom || '').trim()
  const mapper = ATOM_MAP[atom]
  if (!mapper) return { kind: 'text', value: '' }

  const idx = bindIdx(component)
  const result = mapper(state || {}, idx, component)
  return result
}

// Apply image pan/zoom/rotate transform reactively during renderOverlay.
// Uses lastValues caching to avoid redundant style writes.
function applyImageTransform(el, component) {
  if (!el) return
  const img = el.querySelector('img')
  if (!img) return

  const t = {
    scale: component.transform?.scale ?? component.crop?.scale ?? 1,
    panX: component.transform?.panX ?? component.crop?.x ?? 0,
    panY: component.transform?.panY ?? component.crop?.y ?? 0,
    rotation: component.transform?.rotation ?? 0
  }

  const scale = t.scale ?? 1
  const panX = t.panX ?? 0
  const panY = t.panY ?? 0
  const rotation = t.rotation ?? 0

  const next = JSON.stringify({ scale, panX, panY, rotation })
  const transformKey = `${el.id}::transform`

  if (lastValues.get(transformKey) === next) return
  lastValues.set(transformKey, next)

  img.style.position = 'absolute'
  img.style.top = '50%'
  img.style.left = '50%'
  img.style.transformOrigin = 'center center'

  // Critical: translate(-50%, -50%) must come FIRST
  img.style.transform = `
    translate(-50%, -50%)
    translate(${panX || 0}px, ${panY || 0}px)
    scale(${scale || 1})
    rotate(${rotation || 0}deg)
  `
}

export function triggerSlamAndAudio(component, state) {
  if (isFirstRender) {
    return
  }

  const atom = String(component.atom || '').trim()
  const bind = component.bind || {}
  const idx = typeof bind.idx === 'number' ? bind.idx : Number(bind.idx)
  if (!Number.isFinite(idx)) return

  let prevHero = 'none'
  let nextHero = 'none'
  let sideKey = null
  let isPick = false

  if (atom === 'T1_PICK') {
    sideKey = 'blue'
    isPick = true
    prevHero = previousPicks.blue[idx] || 'none'
    nextHero = state?.blueTeam?.picks?.[idx] || 'none'
  } else if (atom === 'T2_PICK') {
    sideKey = 'red'
    isPick = true
    prevHero = previousPicks.red[idx] || 'none'
    nextHero = state?.redTeam?.picks?.[idx] || 'none'
  } else if (atom === 'T1_BAN') {
    sideKey = 'blue'
    prevHero = previousBans.blue[idx] || 'none'
    nextHero = state?.blueTeam?.bans?.[idx] || 'none'
  } else if (atom === 'T2_BAN') {
    sideKey = 'red'
    prevHero = previousBans.red[idx] || 'none'
    nextHero = state?.redTeam?.bans?.[idx] || 'none'
  }

  if (!sideKey) return

  if (prevHero === nextHero) return

  const toHero = (nextHero && nextHero !== 'none')

  if (!toHero) {
    return
  }

  // Visual
  const el = document.getElementById(component.instanceId || component.id)
  if (el) {
    el.classList.remove('animate-slam')
    void el.offsetWidth
    el.classList.add('animate-slam')
    setTimeout(() => el.classList.remove('animate-slam'), 500)
  }

  // Audio
  playHeroAudio(nextHero, isPick)
}

// renderOverlay: data-driven loop — no atom-specific logic in renderer
export function renderOverlay(state, layout) {
  if (!layout || !Array.isArray(layout.components)) return

  const comps = layout.components
  const seen = new Set()

  for (const component of comps) {
    const domId = componentDomId(component)
    if (!domId) continue

    const mapper = ATOM_MAP[component.atom]
    if (!mapper) continue

    seen.add(domId)
    const el = ensureComponentEl(domId, component)

    const idx = bindIdx(component)
    const result = mapper(state || {}, idx, component)

    if (result.kind === 'image') {
      const url = resolveAssetUrl(result.asset || 'hero', result.value)
      setImageIfExists(domId, url, true)
      // 🔥 Critical: diffing + slam + audio
      triggerSlamAndAudio(component, state)
      // Reactive transform sync (cached for performance)
      applyImageTransform(el, component)
    } else {
      setTextIfExists(domId, result.value)
    }
  }

  Array.from(componentsLayer.querySelectorAll('.component')).forEach((node) => {
    if (node.id && !seen.has(node.id)) node.remove()
  })

  previousPicks = {
    blue: Array.isArray(state?.blueTeam?.picks) ? [...state.blueTeam.picks] : [],
    red: Array.isArray(state?.redTeam?.picks) ? [...state.redTeam.picks] : [],
  }
  previousBans = {
    blue: Array.isArray(state?.blueTeam?.bans) ? [...state.blueTeam.bans] : [],
    red: Array.isArray(state?.redTeam?.bans) ? [...state.redTeam.bans] : [],
  }

  // 🛡️ Disable first-render protection AFTER initial sync
  if (isFirstRender) {
    isFirstRender = false
  }
}

// ─────────────────────────────────────────────────────────────
// Scaling & socket sync
// ─────────────────────────────────────────────────────────────

export function applyOverlayScale() {
  const vw = window.innerWidth || 1920
  const vh = window.innerHeight || 1080

  const scale = Math.min(vw / 1920, vh / 1080)

  overlayRoot.style.transformOrigin = 'top left'
  overlayRoot.style.transform = `scale(${scale})`
  overlayRoot.style.left = `${(vw - 1920 * scale) / 2}px`
  overlayRoot.style.top = `${(vh - 1080 * scale) / 2}px`
}

export function setLayoutLoadError() {
  if (overlayRoot) {
    overlayRoot.innerHTML =
      '<div class="component text" style="left:20px;top:20px;width:800px;height:40px;">Layout load error</div>'
  }
}

