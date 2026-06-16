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
let activeTheme = null

const TEXT_ATOMS = new Set([
  'T1_NAME',
  'T2_NAME',
  'T1_SCORE',
  'T2_SCORE',
  'T1_PLAYER_NAME',
  'T2_PLAYER_NAME',
  'CUSTOM_TEXT',
])

// ─────────────────────────────────────────────────────────────
// Theme injection (Hub theme.json → CSS variables + layers)
// ─────────────────────────────────────────────────────────────

const THEME_COLOR_KEYS = [
  'bluePrimary',
  'blueDark',
  'redPrimary',
  'redDark',
  'scoreBlue',
  'scoreRed',
  'playerName',
  'phaseText',
  'auraBan',
  'auraPick',
]

function themeAssetUrl(filename, subdir) {
  const s = String(filename || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) return s
  return `${SERVER_URL}/Assets/costum/Theme/${subdir}/${encodeURIComponent(s)}`
}

function ensureThemeFontFace(fontFile) {
  const url = themeAssetUrl(fontFile, 'fonts')
  if (!url) return

  let el = document.getElementById('mlbb-theme-font-face')
  if (!el) {
    el = document.createElement('style')
    el.id = 'mlbb-theme-font-face'
    document.head.appendChild(el)
  }

  el.textContent = `
    @font-face {
      font-family: 'MLBBThemeFont';
      src: url("${cacheBust(url)}") format('opentype'), url("${cacheBust(url)}") format('truetype');
      font-display: swap;
    }
  `
}

function removeThemeFontFace() {
  const el = document.getElementById('mlbb-theme-font-face')
  if (el) el.textContent = ''
}

export function applyThemeStyles(themeData) {
  if (!themeData || typeof themeData !== 'object') return

  activeTheme = themeData

  const colors = themeData.colors && typeof themeData.colors === 'object' ? themeData.colors : {}
  THEME_COLOR_KEYS.forEach((key) => {
    const value = colors[key]
    if (value == null || value === '') return
    document.documentElement.style.setProperty(`--theme-${key}`, value)
  })

  if (colors.bluePrimary) {
    document.documentElement.style.setProperty('--primary-color', colors.bluePrimary)
  }
  if (colors.redPrimary) {
    document.documentElement.style.setProperty('--secondary-color', colors.redPrimary)
  }

  const typography =
    themeData.typography && typeof themeData.typography === 'object' ? themeData.typography : {}
  const fontMultiplier = Number(typography.fontSizeMultiplier)
  const safeMultiplier = Number.isFinite(fontMultiplier) && fontMultiplier > 0 ? fontMultiplier : 1
  document.documentElement.style.setProperty('--font-size-multiplier', safeMultiplier)

  const teamNameSize = Number(typography.teamNameSize)
  const playerNameSize = Number(typography.playerNameSize)
  const scoreSize = Number(typography.scoreSize)
  document.documentElement.style.setProperty(
    '--theme-teamNameSize',
    `${Number.isFinite(teamNameSize) && teamNameSize > 0 ? teamNameSize : 32}px`
  )
  document.documentElement.style.setProperty(
    '--theme-playerNameSize',
    `${Number.isFinite(playerNameSize) && playerNameSize > 0 ? playerNameSize : 24}px`
  )
  document.documentElement.style.setProperty(
    '--theme-scoreSize',
    `${Number.isFinite(scoreSize) && scoreSize > 0 ? scoreSize : 40}px`
  )

  const defaultFontFamily = String(typography.defaultFontFamily || 'Arial, sans-serif')
  document.documentElement.style.setProperty('--theme-defaultFontFamily', defaultFontFamily)

  const useCustomFont = Boolean(typography.useCustomFont)
  const fontFile = String(typography.fontFile || '').trim()
  if (useCustomFont && fontFile) {
    ensureThemeFontFace(fontFile)
    document.documentElement.style.setProperty('--main-font', `'MLBBThemeFont', ${defaultFontFamily}`)
  } else {
    removeThemeFontFace()
    document.documentElement.style.setProperty('--main-font', defaultFontFamily)
  }

  const toggles = themeData.toggles && typeof themeData.toggles === 'object' ? themeData.toggles : {}
  document.documentElement.style.setProperty('--toggle-disableGlow', toggles.disableGlow ? '1' : '0')
  document.documentElement.style.setProperty('--toggle-hidePattern', toggles.hidePattern ? '1' : '0')
  document.documentElement.style.setProperty('--toggle-disableBoxShadow', toggles.disableBoxShadow ? '1' : '0')

  const images = themeData.images && typeof themeData.images === 'object' ? themeData.images : {}

  const heroPickBg = themeAssetUrl(images.heroPickBg, 'images')
  if (backgroundLayer && heroPickBg) {
    backgroundLayer.style.backgroundImage = `url("${cacheBust(heroPickBg)}")`
    backgroundLayer.style.backgroundRepeat = 'no-repeat'
    backgroundLayer.style.backgroundPosition = 'center'
    backgroundLayer.style.backgroundSize = '100% 100%'
  }

  const masterFrame = themeAssetUrl(images.masterFrame, 'images')
  if (frameImageEl && masterFrame) {
    frameImageEl.src = cacheBust(masterFrame)
  }

  const lowerBg = themeAssetUrl(images.lowerBg, 'images')
  const lowerMidBg = themeAssetUrl(images.lowerMidBg, 'images')
  if (topLayer && (lowerBg || lowerMidBg)) {
    const layers = []
    if (lowerBg) layers.push(`url("${cacheBust(lowerBg)}")`)
    if (lowerMidBg) layers.push(`url("${cacheBust(lowerMidBg)}")`)
    topLayer.style.backgroundImage = layers.join(', ')
    topLayer.style.backgroundRepeat = 'no-repeat'
    topLayer.style.backgroundPosition = 'center bottom'
    topLayer.style.backgroundSize = '100% auto'
  } else if (topLayer) {
    topLayer.style.backgroundImage = ''
  }

  try {
    document.body.style.color = colors.playerName || 'var(--theme-playerName)'
    document.body.style.fontFamily = 'var(--main-font)'
  } catch {
    // ignore
  }
}

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
  const atom = String(component?.atom || '')
  const isText = TEXT_ATOMS.has(atom)

  if (!el) {
    el = document.createElement('div')
    el.id = domId
    el.className = isText ? 'component text' : 'component'

    if (!isText) {
      const img = document.createElement('img')
      img.alt = ''
      img.style.position = 'absolute'
      img.style.top = '50%'
      img.style.left = '50%'
      img.style.transformOrigin = 'center center'
      el.appendChild(img)
    }

    componentsLayer.appendChild(el)
  } else if (isText) {
    el.classList.add('text')
  }

  const w = typeof component?.width === 'number' ? component.width : 0
  const h = typeof component?.height === 'number' ? component.height : 0

  el.style.left = `${Math.round(component.x)}px`
  el.style.top = `${Math.round(component.y)}px`
  el.style.width = `${Math.round(w)}px`
  el.style.height = `${Math.round(h)}px`
  el.style.overflow = 'hidden'
  el.style.display = component.visible === false ? 'none' : 'block'
  el.style.position = 'absolute'

  const fRot = Number.isFinite(Number(component.frameRotation)) ? Number(component.frameRotation) : 0
  const baseTransform = (el.style.transform || '').replace(/rotate\([^)]+\)/g, '').trim()
  el.style.transform = `${baseTransform} rotate(${fRot}deg)`.trim()
  el.style.transformOrigin = 'center center'

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

function resolveTextFontSize(component, atom) {
  const customSize = Number(component?.style?.fontSize)
  if (Number.isFinite(customSize) && customSize > 0) {
    return Math.round(customSize)
  }

  const typography =
    activeTheme?.typography && typeof activeTheme.typography === 'object' ? activeTheme.typography : {}
  const multiplier = Number(typography.fontSizeMultiplier)
  const mult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  const a = String(atom || '')

  if (a.includes('PLAYER_NAME')) {
    const base = Number(typography.playerNameSize)
    return Math.round((Number.isFinite(base) && base > 0 ? base : 24) * mult)
  }
  if (a.includes('SCORE')) {
    const base = Number(typography.scoreSize)
    return Math.round((Number.isFinite(base) && base > 0 ? base : 40) * mult)
  }
  if (a.includes('NAME')) {
    const base = Number(typography.teamNameSize)
    return Math.round((Number.isFinite(base) && base > 0 ? base : 32) * mult)
  }
  return Math.round(16 * mult)
}

function resolveTextFontFamily(component) {
  const override = String(component?.style?.fontFamily || '').trim()
  if (override) return override

  const typography =
    activeTheme?.typography && typeof activeTheme.typography === 'object' ? activeTheme.typography : {}
  if (typography.useCustomFont && String(typography.fontFile || '').trim()) {
    const fallback = String(typography.defaultFontFamily || 'Arial, sans-serif')
    return `'MLBBThemeFont', ${fallback}`
  }
  return String(typography.defaultFontFamily || 'Arial, sans-serif')
}

function applyTextStyles(el, component, atom) {
  if (!el) return

  const fontSize = resolveTextFontSize(component, atom)
  const fontFamily = resolveTextFontFamily(component)
  const textAlign = component?.style?.textAlign || 'left'
  const styleKey = `${el.id}::textStyle`
  const next = JSON.stringify({ fontSize, fontFamily, textAlign })

  el.classList.add('text')

  if (lastValues.get(styleKey) === next) return
  lastValues.set(styleKey, next)

  el.style.fontSize = `${fontSize}px`
  el.style.fontFamily = fontFamily
  el.style.textAlign = textAlign
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.overflow = 'hidden'
  el.style.fontWeight = 'bold'
  el.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'

  if (textAlign === 'right') {
    el.style.justifyContent = 'flex-end'
  } else if (textAlign === 'center') {
    el.style.justifyContent = 'center'
  } else {
    el.style.justifyContent = 'flex-start'
  }
}

function setTextIfExists(id, text, component, atom) {
  const el = document.getElementById(id)
  if (!el) return
  const v = String(text ?? '')
  const key = `${id}::text`
  if (lastValues.get(key) !== v) {
    el.textContent = v
    lastValues.set(key, v)
  }
  applyTextStyles(el, component, atom)
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

  const t = component.transform || component.crop || {}

  const safeScale = Number.isFinite(Number(t.scale)) ? Number(t.scale) : 1
  const safePanX = Number.isFinite(Number(t.panX ?? t.x)) ? Number(t.panX ?? t.x) : 0
  const safePanY = Number.isFinite(Number(t.panY ?? t.y)) ? Number(t.panY ?? t.y) : 0
  const safeRot = Number.isFinite(Number(t.rotation)) ? Number(t.rotation) : 0

  const next = JSON.stringify({ safeScale, safePanX, safePanY, safeRot })
  const transformKey = `${el.id}::transform`

  if (lastValues.get(transformKey) === next) return
  lastValues.set(transformKey, next)

  img.style.width = '100%'
  img.style.height = '100%'
  img.style.objectFit = 'cover'
  img.style.transform = `translate(-50%, -50%) translate(${safePanX}px, ${safePanY}px) scale(${safeScale}) rotate(${safeRot}deg)`
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
      setTextIfExists(domId, result.value, component, component.atom)
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

