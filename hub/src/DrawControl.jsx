import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Rnd } from 'react-rnd'
import { Save, Upload } from 'lucide-react'

const SERVER_URL = 'http://localhost:3000'
const BASE_W = 1920
const BASE_H = 1080

const DEFAULT_COMPONENT_IDS = ['map-type-icon']

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

function normalizeComponent({ id, x, y, w, h, width, height }) {
  const ww = typeof width === 'number' ? width : w
  const hh = typeof height === 'number' ? height : h
  return {
    id,
    x: typeof x === 'number' ? x : 0,
    y: typeof y === 'number' ? y : 0,
    w: typeof ww === 'number' ? ww : 100,
    h: typeof hh === 'number' ? hh : 40
  }
}

export default function DrawControl() {
  const params = useParams()
  const layoutId = params?.id || 'default_draft'
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  const [backgroundImage, setBackgroundImage] = useState('')
  const [frameImage, setFrameImage] = useState('')
  const [backgrounds, setBackgrounds] = useState([])
  const [layoutName, setLayoutName] = useState(layoutId)
  const [boxes, setBoxes] = useState(() =>
    DEFAULT_COMPONENT_IDS.map((id) => ({
      id,
      x: 40,
      y: 40,
      w: 120,
      h: 120
    }))
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const s = Math.min(rect.width / BASE_W, rect.height / BASE_H)
      setScale(clamp(s || 1, 0.1, 1))
    })

    ro.observe(el)
    return () => ro.disconnect()
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
    loadBackgrounds()
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
        if (layout?.backgroundImage) setBackgroundImage(toServerUrl(layout.backgroundImage))
        if (layout?.frameImage) setFrameImage(toServerUrl(layout.frameImage))
        if (Array.isArray(layout?.components)) {
          const normalized = layout.components.map((c) => normalizeComponent(c))
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
      backgroundImage: toRelativeAssetsPath(backgroundImage),
      frameImage: toRelativeAssetsPath(frameImage),
      components: boxes.map((b) => ({
        id: b.id,
        // b.x/b.y are already in the 1920x1080 coordinate space (we render scaled)
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: Math.round(b.w),
        h: Math.round(b.h)
      }))
    }
  }, [backgroundImage, frameImage, boxes])

  async function uploadBackground(file) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${SERVER_URL}/api/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  }

  async function onUploadBackground(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const out = await uploadBackground(file)
    setBackgroundImage(toServerUrl(out.url))

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
    const out = await uploadBackground(file)
    setFrameImage(toServerUrl(out.url))
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
            value={toRelativeAssetsPath(backgroundImage)}
            onChange={(e) => setBackgroundImage(toServerUrl(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/90"
          >
            <option value="">Select Background…</option>
            {backgrounds.map((f) => (
              <option key={f} value={`/Assets/backgrounds/${f}`}>
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

          <button
            type="button"
            onClick={() => saveLayout()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white hover:bg-[#6d28d9]"
          >
            <Save className="size-4" />
            SAVE LAYOUT
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="h-[calc(100dvh-180px)] w-full rounded-2xl border border-white/10 bg-black/20 p-3">
        <div
          className="relative origin-top-left overflow-hidden rounded-xl"
          style={{
            width: BASE_W,
            height: BASE_H,
            transform: `scale(${scale})`
          }}
        >
          {backgroundImage ? (
            <img
              src={backgroundImage}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0" />
          )}

          {boxes.map((b) => (
            <Rnd
              key={b.id}
              bounds="parent"
              size={{ width: b.w, height: b.h }}
              position={{ x: b.x, y: b.y }}
              scale={scale}
              onDragStop={(e, d) => {
                setBoxes((prev) => prev.map((p) => (p.id === b.id ? { ...p, x: d.x, y: d.y } : p)))
              }}
              onResizeStop={(e, dir, ref, delta, pos) => {
                const w = ref.offsetWidth
                const h = ref.offsetHeight
                setBoxes((prev) =>
                  prev.map((p) => (p.id === b.id ? { ...p, x: pos.x, y: pos.y, w, h } : p))
                )
              }}
            >
              <div className="h-full w-full rounded-lg border border-white/20 bg-[#1a1625]/70 px-2 py-1 text-xs font-semibold text-white/90 touch-none">
                {b.id}
              </div>
            </Rnd>
          ))}

          {frameImage ? (
            <img
              src={frameImage}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
