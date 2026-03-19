// Pure utilities (dependency-free)

export const SERVER_URL = (() => {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin
    }
  } catch {
    // ignore
  }
  return 'http://localhost:3000'
})()

export const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X6nVsAAAAASUVORK5CYII='

export function cacheBust(url) {
  const s = String(url || '')
  if (!s) return s
  if (s.startsWith('data:')) return s
  const joiner = s.includes('?') ? '&' : '?'
  return `${s}${joiner}t=${Date.now()}`
}

export function setCssVar(name, value) {
  try {
    document.documentElement.style.setProperty(name, String(value))
  } catch {
    // ignore
  }
}

export function getLayoutId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id') || 'default_draft'
}

export function shouldFollowLiveLayout() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('follow') === '1'
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// Unified asset resolver (replaces heroPortraitUrl, mapThumbUrl, etc.)
// ─────────────────────────────────────────────────────────────

export function resolveAssetUrl(kind, value) {
  if (!value || value === 'none') return TRANSPARENT_PX

  const v = String(value).trim()
  if (!v) return TRANSPARENT_PX

  if (kind === 'custom') {
    if (v.startsWith('http://') || v.startsWith('https://')) return v
    if (v.startsWith('/')) return SERVER_URL + v
    return `${SERVER_URL}/Assets/${v}`
  }

  const safe = encodeURIComponent(v.toLowerCase())
  let path
  if (kind === 'hero') {
    path = `/Assets/HeroPick/${safe}.png`
  } else if (kind === 'map') {
    let s = v.toLowerCase().trim()
    if (s.endsWith('.png')) s = s.slice(0, -4)
    path = `/Assets/Maps/${encodeURIComponent(s)}.png`
  } else if (kind === 'logo') {
    path = `/Assets/logos/${encodeURIComponent(v)}`
  } else {
    return TRANSPARENT_PX
  }
  return SERVER_URL + path
}

// heroId -> { img, ready }
export const heroPortraitCache = new Map()

export function prefetchHeroPortrait(heroId) {
  const key = String(heroId || '').trim().toLowerCase()
  if (!key || key === 'none') return
  if (heroPortraitCache.has(key)) return

  const img = new Image()
  const src = resolveAssetUrl('hero', key)

  heroPortraitCache.set(key, { img, ready: false })

  img.onload = () => {
    const entry = heroPortraitCache.get(key)
    if (entry) entry.ready = true
  }
  img.onerror = () => {
    const entry = heroPortraitCache.get(key)
    if (entry) entry.ready = false
  }

  img.src = src
}

export async function startHeroPrefetchLoop() {
  try {
    const res = await fetch('/api/heroes')
    if (!res.ok) return
    const json = await res.json()
    const heroes = Array.isArray(json?.heroes) ? json.heroes : []

    const ids = heroes
      .map((h) => (h.id || h.name || '').toString().toLowerCase())
      .filter(Boolean)
    if (!ids.length) return

    // Fire-and-forget loads; the browser cache will ensure zero-latency usage later.
    for (const id of ids) {
      prefetchHeroPortrait(id)
    }
  } catch {
    // ignore – overlay will still function without prefetch
  }
}

