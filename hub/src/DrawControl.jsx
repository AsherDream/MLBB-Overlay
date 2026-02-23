import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Rnd } from 'react-rnd'
import { Save, Upload, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { io } from 'socket.io-client'

const SERVER_URL = 'http://localhost:3000'
const BASE_W = 1920
const BASE_H = 1080
const gridSize = 10

const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X6nVsAAAAASUVORK5CYII='

const DEFAULT_COMPONENT_IDS = ['map-type-icon']

function inferTypeFromId(id) {
  const s = String(id || '').toLowerCase()
  if (s.includes('pick') || s.includes('ban') || s.includes('map')) return 'image'
  return 'text'
}

function isImageId(id) {
  const s = String(id || '').toLowerCase()
  return s.includes('pick') || s.includes('ban') || s.includes('logo') || s.includes('map')
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function toServerUrl(url) {
  const s = String(url || '')
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/')) return `${SERVER_URL}${s}`
  return s
}

function toRelativeAssetsPath(url) {
  const s = String(url || '')
  if (!s) return ''
  if (s.startsWith(SERVER_URL)) return s.slice(SERVER_URL.length)
  return s
}

function normalizeComponent({ id, type, x, y, w, h, width, height }) {
  const ww = typeof width === 'number' ? width : w
  const hh = typeof height === 'number' ? height : h
  return {
    id,
    type: type || inferTypeFromId(id),
    visible: true,
    locked: false,
    alias: '',
    zIndex: undefined,
    src: '',
    x: typeof x === 'number' ? x : 0,
    y: typeof y === 'number' ? y : 0,
    w: typeof ww === 'number' ? ww : 100,
    h: typeof hh === 'number' ? hh : 40
  }
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : 0
  return Math.max(min, Math.min(max, Math.round(x)))
}

function snap(n, step) {
  if (!step) return Math.round(n)
  return Math.round(n / step) * step
}

function getAssetUrlFromId(id, state) {
  const s = String(id || '').toLowerCase()
  if (s.includes('map')) {
    const mapType = state?.mapType || state?.map || 'none'
    if (!mapType || mapType === 'none') return TRANSPARENT_PX
    return `/Assets/Maps/${String(mapType).toLowerCase()}.png`
  }
  if (s.includes('pick-')) {
    const m = s.match(/(blue|red)-pick-(\d+)/)
    if (!m) return ''
    const team = m[1]
    const idx = Number(m[2]) - 1
    const hero = team === 'blue' ? state?.blueTeam?.picks?.[idx] : state?.redTeam?.picks?.[idx]
    if (!hero || hero === 'none') return TRANSPARENT_PX
    return `/Assets/HeroPick/${String(hero).toLowerCase()}.png`
  }
  if (s.includes('ban-')) {
    const m = s.match(/(blue|red)-ban-(\d+)/)
    if (!m) return ''
    const team = m[1]
    const idx = Number(m[2]) - 1
    const hero = team === 'blue' ? state?.blueTeam?.bans?.[idx] : state?.redTeam?.bans?.[idx]
    if (!hero || hero === 'none') return TRANSPARENT_PX
    return `/Assets/HeroPick/${String(hero).toLowerCase()}.png`
  }
  return ''
}

function getTextFromId(id, state) {
  const s = String(id || '').toLowerCase()
  if (s === 'blue-team-name') return state?.blueTeam?.name || ''
  if (s === 'red-team-name') return state?.redTeam?.name || ''
  if (s.includes('score') && s.includes('blue')) return String(state?.blueTeam?.score ?? '')
  if (s.includes('score') && s.includes('red')) return String(state?.redTeam?.score ?? '')
  if (s === 'map-slot') return String(state?.map || '')
  const pm = s.match(/(blue|red)-player-(\d+)/)
  if (pm) {
    const team = pm[1]
    const idx = Number(pm[2]) - 1
    return team === 'blue' ? state?.blueTeam?.players?.[idx] || '' : state?.redTeam?.players?.[idx] || ''
  }
  return ''
}

function SmartBox({ box, matchState }) {
  const id = String(box?.id || '')
  const shouldRenderImage = isImageId(id)
  const imgSrc = shouldRenderImage
    ? box?.src
      ? toServerUrl(box.src)
      : toServerUrl(getAssetUrlFromId(id, matchState))
    : ''
  const text = shouldRenderImage ? '' : getTextFromId(id, matchState)

  if (shouldRenderImage) {
    const fallback = TRANSPARENT_PX
    const isBan = String(id || '').toLowerCase().includes('ban')
    return (
      <img
        src={imgSrc}
        alt=""
        draggable={false}
        onError={(e) => {
          try {
            if (e?.currentTarget?.src !== fallback) e.currentTarget.src = fallback
          } catch {
            // ignore
          }
        }}
        className="pointer-events-none h-full w-full select-none object-contain"
        style={{ filter: isBan ? 'grayscale(100%) brightness(50%)' : undefined }}
      />
    )
  }

  return (
    <div className="pointer-events-none flex h-full w-full select-none items-center px-2 text-xs font-semibold text-white/90">
      {text || box?.alias || box?.id}
    </div>
  )
}

export default function DrawControl() {
  const params = useParams()
  const layoutId = params?.id || 'default_draft'
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  const [background, setBackground] = useState('')
  const [frame, setFrame] = useState('')
  const [backgrounds, setBackgrounds] = useState([])
  const [frames, setFrames] = useState([])
  const [logos, setLogos] = useState([])
  const [layoutName, setLayoutName] = useState(layoutId)
  const [selectedId, setSelectedId] = useState(null)
  const [matchState, setMatchState] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showGrid, setShowGrid] = useState(false)

  const pastRef = useRef([])
  const futureRef = useRef([])
  const [boxes, setBoxes] = useState(() =>
    DEFAULT_COMPONENT_IDS.map((id) => ({
      id,
      type: inferTypeFromId(id),
      visible: true,
      locked: false,
      alias: '',
      zIndex: undefined,
      src: '',
      x: 40,
      y: 40,
      w: 120,
      h: 120
    }))
  )

  useEffect(() => {
    try {
      const socket = io(SERVER_URL)
      socket.on('STATE_SYNC', (state) => {
        try {
          setMatchState(state)
        } catch {
          // ignore
        }
      })
      return () => socket.disconnect()
    } catch {
      return undefined
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadBackgrounds() {
      try {
        const res = await fetch(`${SERVER_URL}/api/backgrounds`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        setBackgrounds(Array.isArray(data?.backgrounds) ? data.backgrounds : [])
      } catch {
        // ignore
      }
    }

    async function loadFrames() {
      try {
        const res = await fetch(`${SERVER_URL}/api/frames`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        setFrames(Array.isArray(data?.frames) ? data.frames : [])
      } catch {
        // ignore
      }
    }

    async function loadLogos() {
      try {
        const res = await fetch(`${SERVER_URL}/api/logos`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        setLogos(Array.isArray(data?.logos) ? data.logos : [])
      } catch {
        // ignore
      }
    }

    loadBackgrounds()
    loadFrames()
    loadLogos()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const res = await fetch(`${SERVER_URL}/api/layouts/${encodeURIComponent(layoutId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        const layout = data?.layout
        setLayoutName(layoutId)
        const bg = layout?.background ?? layout?.backgroundImage
        const fr = layout?.frame ?? layout?.frameImage
        if (bg) setBackground(toServerUrl(bg))
        if (fr) setFrame(toServerUrl(fr))
        if (Array.isArray(layout?.components)) {
          const normalized = layout.components.map((c, idx) => ({
            ...normalizeComponent(c),
            visible: typeof c?.visible === 'boolean' ? c.visible : true,
            locked: typeof c?.locked === 'boolean' ? c.locked : false,
            alias: typeof c?.alias === 'string' ? c.alias : '',
            src: typeof c?.src === 'string' ? c.src : '',
            zIndex: typeof c?.zIndex === 'number' ? c.zIndex : idx
          }))
          setBoxes(normalized)
        }
      } catch {
        // ignore
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [layoutId])
  const payload = useMemo(() => {
    return {
      background: toRelativeAssetsPath(background),
      frame: toRelativeAssetsPath(frame),
      components: boxes.map((b, idx) => ({
        id: b.id,
        type: b.type || inferTypeFromId(b.id),
        visible: typeof b.visible === 'boolean' ? b.visible : true,
        locked: typeof b.locked === 'boolean' ? b.locked : false,
        alias: String(b.alias || ''),
        zIndex: typeof b.zIndex === 'number' ? b.zIndex : idx,
        src: String(b.src || ''),
        // b.x/b.y are already in the 1920x1080 coordinate space (we render scaled)
        x: Math.round(b.x),
        y: Math.round(b.y),
        width: Math.round(b.w),
        height: Math.round(b.h)
      }))
    }
  }, [background, frame, boxes])

  async function uploadAsset(file, category) {
    const fd = new FormData()
    fd.append('file', file)
    if (category) fd.append('category', category)
    const res = await fetch(`${SERVER_URL}/api/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  }

  async function onUploadBackground(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const out = await uploadAsset(file, 'background')
    setBackground(toServerUrl(out.url))

    // refresh library
    try {
      const res = await fetch(`${SERVER_URL}/api/backgrounds`)
      if (res.ok) {
        const data = await res.json()
        setBackgrounds(Array.isArray(data?.backgrounds) ? data.backgrounds : [])
      }
    } catch {
      // ignore
    }
  }

  async function onUploadFrame(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const out = await uploadAsset(file, 'frame')
    setFrame(toServerUrl(out.url))

    // refresh library
    try {
      const res = await fetch(`${SERVER_URL}/api/frames`)
      if (res.ok) {
        const data = await res.json()
        setFrames(Array.isArray(data?.frames) ? data.frames : [])
      }
    } catch {
      // ignore
    }
  }

  async function onUploadLogo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await uploadAsset(file, 'logo')
    try {
      const res = await fetch(`${SERVER_URL}/api/logos`)
      if (res.ok) {
        const data = await res.json()
        setLogos(Array.isArray(data?.logos) ? data.logos : [])
      }
    } catch {
      // ignore
    }
  }

  async function saveLayout() {
    const id = String(layoutName || '').trim()
    if (!id) throw new Error('Layout Name is required')

    const res = await fetch(`${SERVER_URL}/api/layouts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt)
    }
  }

  async function setAsLiveOverlay() {
    const id = String(layoutName || '').trim()
    if (!id) throw new Error('Layout Name is required')
    await saveLayout()
    const res = await fetch(`${SERVER_URL}/api/active-layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (!res.ok) throw new Error(await res.text())
  }

  useEffect(() => {
    function onKeyDown(e) {
      // Undo / Redo
      const key = String(e.key || '').toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && key === 'z') {
        e.preventDefault()
        const past = pastRef.current
        if (!past.length) return
        setBoxes((current) => {
          const prevState = past[past.length - 1]
          pastRef.current = past.slice(0, -1)
          futureRef.current = [...futureRef.current, current]
          return prevState
        })
        return
      }

      if (ctrl && key === 'y') {
        e.preventDefault()
        const future = futureRef.current
        if (!future.length) return
        setBoxes((current) => {
          const nextState = future[future.length - 1]
          futureRef.current = future.slice(0, -1)
          pastRef.current = [...pastRef.current, current]
          return nextState
        })
        return
      }

      // Fine nudging (bypasses grid snap)
      if (!selectedId) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const delta = e.shiftKey ? 10 : 1

      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== selectedId) return b
          const nx = b.x + (e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0)
          const ny = b.y + (e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0)
          return {
            ...b,
            x: clampInt(nx, 0, BASE_W),
            y: clampInt(ny, 0, BASE_H)
          }
        })
      )
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const s = Math.min(rect.width / BASE_W, rect.height / BASE_H)
      setScale(clamp(s || 1, 0.1, 0.45))
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [sidebarCollapsed])

  const sortedBoxes = useMemo(() => {
    return [...boxes].sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0))
  }, [boxes])

  function commitZIndices(next) {
    return next.map((b, idx) => ({ ...b, zIndex: idx }))
  }

  return (
    <div className="min-h-dvh bg-[#0f0c15] p-6">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-white/50">DRAW CONTROL</div>
          <div className="mt-1 text-xl font-extrabold text-white">Layout Editor</div>
          <div className="mt-1 text-sm text-white/60">Editing: {layoutId}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-[10px] font-bold tracking-[0.22em] text-white/50">LAYOUT NAME</span>
            <input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="w-[220px] bg-transparent text-xs font-semibold text-white/90 outline-none"
              placeholder="grand_finals_draft"
            />
          </div>

          <select
            value={toRelativeAssetsPath(background)}
            onChange={(e) => setBackground(toServerUrl(e.target.value))}
            className="rounded-xl border border-white/10 bg-[#1a1a2e] px-3 py-2 text-xs font-bold text-white"
            style={{ backgroundColor: '#1a1a2e' }}
          >
            <option value="" style={{ backgroundColor: '#1a1a2e' }}>Select Background…</option>
            {backgrounds.map((f) => (
              <option key={f} value={`/Assets/backgrounds/${f}`} style={{ backgroundColor: '#1a1a2e' }}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={toRelativeAssetsPath(frame)}
            onChange={(e) => setFrame(toServerUrl(e.target.value))}
            className="rounded-xl border border-white/10 bg-[#1a1a2e] px-3 py-2 text-xs font-bold text-white"
            style={{ backgroundColor: '#1a1a2e' }}
          >
            <option value="" style={{ backgroundColor: '#1a1a2e' }}>Select Frame…</option>
            {frames.map((f) => (
              <option key={f} value={`/Assets/frames/${f}`} style={{ backgroundColor: '#1a1a2e' }}>
                {f}
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
            <Upload className="size-4" />
            BACKGROUND
            <input type="file" accept="image/*" onChange={onUploadBackground} className="hidden" />
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
            <Upload className="size-4" />
            FRAME
            <input type="file" accept="image/*" onChange={onUploadFrame} className="hidden" />
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
            <Upload className="size-4" />
            LOGO
            <input type="file" accept="image/*" onChange={onUploadLogo} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => saveLayout()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white hover:bg-[#6d28d9]"
          >
            <Save className="size-4" />
            SAVE LAYOUT
          </button>

          <button
            type="button"
            onClick={() => setAsLiveOverlay()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
          >
            <Save className="size-4" />
            SET AS LIVE OVERLAY
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
          >
            {showGrid ? 'HIDE GRID' : 'SHOW GRID'}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100dvh-180px)] w-full gap-3">
        <div
          className={`rounded-2xl border border-white/10 bg-white/5 p-3 overflow-y-auto scrollbar-thin scrollbar-track-black/20 scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 ${
            sidebarCollapsed ? 'w-[60px]' : 'w-[320px]'
          }`}
        >
          <style>{`
            .scrollbar-thin::-webkit-scrollbar { width: 6px; }
            .scrollbar-thin::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 3px; }
            .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
            .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
            select, select option { background-color: #1a1a2e !important; color: white !important; }
            select:focus { background-color: #1a1a2e !important; }
          `}</style>
          <div className="mb-2 flex items-center justify-between gap-2">
            {sidebarCollapsed ? null : (
              <div className="text-xs font-semibold tracking-[0.22em] text-white/50">LAYER MANAGER</div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/15"
              title="Collapse sidebar"
            >
              {sidebarCollapsed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>

          <div className="space-y-2" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {sortedBoxes.map((b, idx) => {
              const isSelected = b.id === selectedId
              const label = String(b.alias || b.id)
              return (
                <div
                  key={b.id}
                  className={`rounded-xl border px-2 py-2 ${
                    isSelected ? 'border-[#a78bfa] bg-white/10' : 'border-white/10 bg-black/20'
                  }`}
                  onClick={() => setSelectedId(b.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {sidebarCollapsed ? null : (
                        <>
                          <div className="truncate text-xs font-extrabold text-white">{label}</div>
                          <div className="truncate text-[10px] font-semibold text-white/40">{b.id}</div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setBoxes((prev) => prev.map((p) => (p.id === b.id ? { ...p, visible: !p.visible } : p)))
                        }}
                        className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/15"
                        title="Toggle visibility"
                      >
                        {b.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setBoxes((prev) => prev.map((p) => (p.id === b.id ? { ...p, locked: !p.locked } : p)))
                        }}
                        className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/15"
                        title="Toggle lock"
                      >
                        {b.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {sidebarCollapsed ? null : (
                    <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      value={b.alias}
                      onChange={(e) =>
                        setBoxes((prev) => prev.map((p) => (p.id === b.id ? { ...p, alias: e.target.value } : p)))
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold text-white/90 outline-none"
                      placeholder="Production alias"
                    />

                    {String(b.id).toLowerCase().includes('logo') ? (
                      <select
                        value={b.src || ''}
                        onChange={(e) =>
                          setBoxes((prev) => prev.map((p) => (p.id === b.id ? { ...p, src: e.target.value } : p)))
                        }
                        className="rounded-lg border border-white/10 bg-[#1a1a2e] px-2 py-1 text-xs font-bold text-white"
                        style={{ backgroundColor: '#1a1a2e' }}
                      >
                        <option value="" style={{ backgroundColor: '#1a1a2e' }}>Select Logo…</option>
                        {logos.map((f) => (
                          <option key={f} value={`/Assets/logos/${f}`} style={{ backgroundColor: '#1a1a2e' }}>
                            {f}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (idx === 0) return
                          setBoxes((prev) => {
                            const s = [...prev].sort((a, bb) => Number(a.zIndex ?? 0) - Number(bb.zIndex ?? 0))
                            const i = s.findIndex((x) => x.id === b.id)
                            if (i <= 0) return prev
                            const tmp = s[i - 1]
                            s[i - 1] = s[i]
                            s[i] = tmp
                            return commitZIndices(s)
                          })
                        }}
                        className="w-full rounded-lg bg-white/10 px-2 py-1 text-[10px] font-extrabold text-white hover:bg-white/15"
                      >
                        MOVE UP
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setBoxes((prev) => {
                            const s = [...prev].sort((a, bb) => Number(a.zIndex ?? 0) - Number(bb.zIndex ?? 0))
                            const i = s.findIndex((x) => x.id === b.id)
                            if (i < 0 || i >= s.length - 1) return prev
                            const tmp = s[i + 1]
                            s[i + 1] = s[i]
                            s[i] = tmp
                            return commitZIndices(s)
                          })
                        }}
                        className="w-full rounded-lg bg-white/10 px-2 py-1 text-[10px] font-extrabold text-white hover:bg-white/15"
                      >
                        MOVE DOWN
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 p-3 overflow-hidden">
          <div ref={wrapRef} className="canvas-viewport h-full w-full overflow-hidden">
            <div
              className="relative origin-top-left overflow-hidden rounded-xl"
              style={{
                width: BASE_W,
                height: BASE_H,
                transform: `scale(${scale})`
              }}
              onMouseDown={() => setSelectedId(null)}
            >
              <div id="bg-layer" className="absolute inset-0" style={{ zIndex: 1 }}>
                {background ? (
                  <img
                    src={background}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0" />
                )}

                {showGrid ? (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                      backgroundSize: `${gridSize}px ${gridSize}px`,
                      opacity: 0.6
                    }}
                  />
                ) : null}
              </div>

              <div id="component-layer" className="absolute inset-0" style={{ zIndex: 10 }}>
                {sortedBoxes.map((b) => {
                  const isSelected = b.id === selectedId
                  const z = 1 + clampInt(b.zIndex ?? 0, 0, 500)
                  return (
                    <Rnd
                      key={b.id}
                      bounds="parent"
                      size={{ width: b.w, height: b.h }}
                      position={{ x: b.x, y: b.y }}
                      scale={scale}
                      dragGrid={[gridSize, gridSize]}
                      resizeGrid={[gridSize, gridSize]}
                      disableDragging={!!b.locked}
                      enableResizing={!b.locked}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setSelectedId(b.id)
                      }}
                      onDragStop={(e, d) => {
                        const nx = snap(d.x, gridSize)
                        const ny = snap(d.y, gridSize)
                        setBoxes((prev) => {
                          pastRef.current = [...pastRef.current, prev]
                          futureRef.current = []
                          return prev.map((p) => (p.id === b.id ? { ...p, x: nx, y: ny } : p))
                        })
                      }}
                      onResizeStop={(e, dir, ref, delta, pos) => {
                        const w = snap(ref.offsetWidth, gridSize)
                        const h = snap(ref.offsetHeight, gridSize)
                        const x = snap(pos.x, gridSize)
                        const y = snap(pos.y, gridSize)
                        setBoxes((prev) => {
                          pastRef.current = [...pastRef.current, prev]
                          futureRef.current = []
                          return prev.map((p) => (p.id === b.id ? { ...p, x, y, w, h } : p))
                        })
                      }}
                      style={{
                        zIndex: z,
                        opacity: b.visible ? 1 : 0
                      }}
                    >
                      <div
                        className={`h-full w-full overflow-hidden rounded-lg border ${
                          isSelected ? 'border-[#a78bfa]' : 'border-white/10'
                        } bg-[#1a1625]/70`}
                      >
                        <SmartBox box={b} matchState={matchState} />
                      </div>
                    </Rnd>
                  )
                })}
              </div>

              <div
                id="frame-layer"
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 100 }}
              >
                {frame ? (
                  <img
                    src={frame}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
