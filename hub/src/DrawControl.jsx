import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useLayout } from './App.jsx'
import { Save, Upload } from 'lucide-react'
import ComponentLibrarySidebar from './ComponentLibrarySidebar.jsx'
import ModularCanvas from './ModularCanvas.jsx'
import LayerProperties from './LayerProperties.jsx'
import { defaultSizeForAtom, newInstanceId } from './atoms.js'

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'


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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : parseInt(String(n || '0'), 10)
  if (Number.isNaN(x)) return min
  return Math.max(min, Math.min(max, Math.round(x)))
}

function classifyAtom(atom) {
  const a = String(atom || '')
  let side = null
  if (a.startsWith('T1_')) side = 'T1'
  else if (a.startsWith('T2_')) side = 'T2'

  let kind = null
  if (a.endsWith('PLAYER_NAME')) kind = 'PLAYER_NAME'
  else if (a.endsWith('PICK')) kind = 'PICK'
  else if (a.endsWith('BAN')) kind = 'BAN'
  else if (a.endsWith('SCORE')) kind = 'SCORE'
  else if (a.endsWith('NAME')) kind = 'NAME'

  return { side, kind }
}

function normalizeNewComponent(c, fallbackZ) {
  const size = defaultSizeForAtom(c?.atom)
  const rawBind = c?.bind && typeof c.bind === 'object' ? c.bind : {}
  const { kind } = classifyAtom(c?.atom)

  let bind = rawBind
  if (kind === 'PLAYER_NAME' || kind === 'PICK' || kind === 'BAN') {
    const n = Number(rawBind.idx)
    const clamped = Number.isFinite(n) ? clampInt(n, 0, 4) : 0
    bind = { ...rawBind, idx: clamped }
  } else {
    bind = rawBind
  }
  const crop =
    c?.crop && typeof c.crop === 'object'
      ? {
          x: Number.isFinite(c.crop.x) ? c.crop.x : 0,
          y: Number.isFinite(c.crop.y) ? c.crop.y : 0,
          scale: Number.isFinite(c.crop.scale) && c.crop.scale > 0 ? c.crop.scale : 1
        }
      : { x: 0, y: 0, scale: 1 }
  const maskPoints =
    Array.isArray(c?.maskPoints) && c.maskPoints.length
      ? c.maskPoints.map((p) => ({
          x: Number.isFinite(p.x) ? p.x : 0,
          y: Number.isFinite(p.y) ? p.y : 0
        }))
      : undefined

  return {
    instanceId: String(c?.instanceId || newInstanceId(c?.atom || 'ATOM')),
    atom: String(c?.atom || ''),
    x: typeof c?.x === 'number' ? c.x : 0,
    y: typeof c?.y === 'number' ? c.y : 0,
    width: typeof c?.width === 'number' ? c.width : size.width,
    height: typeof c?.height === 'number' ? c.height : size.height,
    visible: typeof c?.visible === 'boolean' ? c.visible : true,
    locked: typeof c?.locked === 'boolean' ? c.locked : false,
    alias: typeof c?.alias === 'string' ? c.alias : '',
    zIndex: typeof c?.zIndex === 'number' ? c.zIndex : fallbackZ,
    src: typeof c?.src === 'string' ? c.src : '',
    bind,
    crop,
    maskPoints
  }
}

export default function DrawControl() {

  const [matchState, setMatchState] = useState(null);

  useEffect(() => {
    // Fetch the current drafting data so the canvas knows who is picked
    async function fetchMatch() {
      const res = await fetch(`${SERVER_URL}/api/matchdraft`);
      if (res.ok) {
        const data = await res.json();
        setMatchState(data.draftdata);
      }
    }
    fetchMatch();
    // Optional: Set an interval to refresh every 5 seconds if you want the Hub to update live
    const int = setInterval(fetchMatch, 5000);
    return () => clearInterval(int);
  }, []);
  const params = useParams()
  const { sidebarCollapsed } = useLayout()
  const layoutId = params?.id || 'testing'
  const wrapRef = useRef(null)

  const [scale, setScale] = useState(0.35)
  const [layoutName, setLayoutName] = useState(layoutId)
  const [selectedId, setSelectedId] = useState(null)
  const [components, setComponents] = useState([])

  const [background, setBackground] = useState('')
  const [frame, setFrame] = useState('')
  const [backgrounds, setBackgrounds] = useState([])
  const [frames, setFrames] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  function showToast(message) {
    if (!message) return
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setToast(message)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, 2000)
  }

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
        setBackground(toServerUrl(layout?.background || ''))
        setFrame(toServerUrl(layout?.frame || ''))
        const comps = Array.isArray(layout?.components) ? layout.components : []

        // Migrate legacy components (id/type) into new schema for editing.
        const migrated = comps.map((c, idx) => {
          if (c && typeof c === 'object' && c.instanceId && c.atom) return normalizeNewComponent(c, idx)

          // Legacy -> atom inference based on id
          const id = String(c?.id || '')
          const s = id.toLowerCase()
          let atom = 'T1_NAME'
          let bind = {}
          if (s === 'blue-team-name') atom = 'T1_NAME'
          else if (s === 'red-team-name') atom = 'T2_NAME'
          else if (s === 'blue-score') atom = 'T1_SCORE'
          else if (s === 'red-score') atom = 'T2_SCORE'
          else if (s.includes('blue-player-')) {
            atom = 'T1_PLAYER_NAME'
            bind = { idx: Math.max(0, Math.min(4, Number(s.split('blue-player-')[1]) - 1)) }
          } else if (s.includes('red-player-')) {
            atom = 'T2_PLAYER_NAME'
            bind = { idx: Math.max(0, Math.min(4, Number(s.split('red-player-')[1]) - 1)) }
          } else if (s.includes('blue-pick-')) {
            atom = 'T1_PICK'
            bind = { idx: Math.max(0, Math.min(4, Number(s.split('blue-pick-')[1]) - 1)) }
          } else if (s.includes('red-pick-')) {
            atom = 'T2_PICK'
            bind = { idx: Math.max(0, Math.min(4, Number(s.split('red-pick-')[1]) - 1)) }
          } else if (s.includes('blue-ban-')) {
            atom = 'T1_BAN'
            bind = { idx: Math.max(0, Math.min(4, Number(s.split('blue-ban-')[1]) - 1)) }
          } else if (s.includes('red-ban-')) {
            atom = 'T2_BAN'
            bind = { idx: Math.max(0, Math.min(4, Number(s.split('red-ban-')[1]) - 1)) }
          } else if (s.includes('map')) {
            atom = 'MAP'
          }

          return normalizeNewComponent(
            {
              instanceId: newInstanceId(atom),
              atom,
              x: c?.x ?? 0,
              y: c?.y ?? 0,
              width: c?.width ?? c?.w,
              height: c?.height ?? c?.h,
              alias: c?.alias || '',
              visible: typeof c?.visible === 'boolean' ? c.visible : true,
              locked: typeof c?.locked === 'boolean' ? c.locked : false,
              zIndex: typeof c?.zIndex === 'number' ? c.zIndex : idx,
              src: c?.src || '',
              bind
            },
            idx
          )
        })

        setComponents(migrated)
      } catch {
        // ignore
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [layoutId])

  useEffect(() => {
    let mounted = true
    async function loadAssets() {
      try {
        const [bgRes, frRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/backgrounds`),
          fetch(`${SERVER_URL}/api/frames`)
        ])
        if (mounted && bgRes.ok) {
          const data = await bgRes.json()
          setBackgrounds(Array.isArray(data?.backgrounds) ? data.backgrounds : [])
        }
        if (mounted && frRes.ok) {
          const data = await frRes.json()
          setFrames(Array.isArray(data?.frames) ? data.frames : [])
        }
      } catch {
        // ignore
      }
    }
    loadAssets()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  function buildPayload(nextComponents, overrides = {}) {
    const list = nextComponents || components || []
    const bgOverride = overrides.background !== undefined ? overrides.background : toRelativeAssetsPath(background)
    const frameOverride = overrides.frame !== undefined ? overrides.frame : toRelativeAssetsPath(frame)
    return {
      name: layoutName,
      background: bgOverride,
      frame: frameOverride,
      components: list.map((c, idx) => ({
        instanceId: String(c.instanceId),
        atom: String(c.atom),
        x: Math.round(c.x),
        y: Math.round(c.y),
        width: Math.round(c.width),
        height: Math.round(c.height),
        visible: typeof c.visible === 'boolean' ? c.visible : true,
        locked: typeof c.locked === 'boolean' ? c.locked : false,
        alias: String(c.alias || ''),
        zIndex: typeof c.zIndex === 'number' ? c.zIndex : idx,
        src: String(c.src || ''),
        bind: c.bind && typeof c.bind === 'object' ? c.bind : {},
        crop:
          c.crop && typeof c.crop === 'object'
            ? {
                x: Number.isFinite(c.crop.x) ? Math.round(c.crop.x) : 0,
                y: Number.isFinite(c.crop.y) ? Math.round(c.crop.y) : 0,
                scale: Number.isFinite(c.crop.scale) && c.crop.scale > 0 ? c.crop.scale : 1
              }
            : { x: 0, y: 0, scale: 1 },
        maskPoints:
          Array.isArray(c.maskPoints) && c.maskPoints.length
            ? c.maskPoints.map((p) => ({
                x: Number.isFinite(p.x) ? Math.round(p.x) : 0,
                y: Number.isFinite(p.y) ? Math.round(p.y) : 0
              }))
            : undefined
      }))
    }
  }

  async function uploadAsset(file, category) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', category)
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

  async function saveLayout(explicitComponents, overrides = {}) {
    const id = String(layoutName || '').trim()
    if (!id) throw new Error('Layout Name is required')

    const body = JSON.stringify(buildPayload(explicitComponents || components, overrides))

    setIsSaving(true)
    const res = await fetch(`${SERVER_URL}/api/layouts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body
    })
    setIsSaving(false)
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

  // Scale is computed inside ModularCanvas; this state is for drop coordination only

  const selected = useMemo(() => (components || []).find((c) => c.instanceId === selectedId) || null, [components, selectedId])

  function computeSpawnBindingAndCheckLimit(baseAtom) {
    const { side, kind } = classifyAtom(baseAtom)
    if (!side || !kind) {
      return { ok: true, bind: {} }
    }

    const needsIdx = kind === 'PLAYER_NAME' || kind === 'PICK' || kind === 'BAN'
    let limit = Infinity
    if (kind === 'PLAYER_NAME' || kind === 'PICK' || kind === 'BAN') {
      limit = 5
    } else if (kind === 'SCORE' || kind === 'NAME') {
      limit = 1
    }

    const existing = (components || []).filter((c) => {
      const meta = classifyAtom(c.atom)
      return meta.side === side && meta.kind === kind
    })

    if (existing.length >= limit) {
      const label =
        kind === 'PICK'
          ? 'Picks'
          : kind === 'BAN'
            ? 'Bans'
            : kind === 'PLAYER_NAME'
              ? 'Player Names'
              : kind === 'SCORE'
                ? 'Score'
                : 'Team Name'
      const sideLabel = side === 'T1' ? 'Blue' : 'Red'
      showToast(`Maximum of ${limit} ${label} allowed for ${sideLabel} team.`)
      return { ok: false, bind: {} }
    }

    if (!needsIdx) {
      return { ok: true, bind: {} }
    }

    const usedIdx = new Set(
      existing
        .map((c) => {
          const b = c.bind && typeof c.bind === 'object' ? c.bind : {}
          const n = Number(b.idx)
          return Number.isFinite(n) ? clampInt(n, 0, 4) : null
        })
        .filter((v) => v != null)
    )

    let nextIdx = 0
    for (let i = 0; i < 5; i += 1) {
      if (!usedIdx.has(i)) {
        nextIdx = i
        break
      }
    }

    return { ok: true, bind: { idx: nextIdx } }
  }

  function updateComponent(next) {
    setComponents((prev) => {
      const updated = prev.map((c) => (c.instanceId === next.instanceId ? next : c))
      // Real-time persistence on drag/resize/property change
      // Fire-and-forget; errors are logged in the network layer/devtools.
      saveLayout(updated).catch(() => {})
      return updated
    })
  }

  function deleteComponent(target) {
    setComponents((prev) => {
      const updated = prev.filter((c) => c.instanceId !== target.instanceId)
      saveLayout(updated).catch(() => {})
      return updated
    })
    if (selectedId === target.instanceId) setSelectedId(null)
  }

  function spawnAtom(atomDef) {
    const base = atomDef?.atom
    const { ok, bind } = computeSpawnBindingAndCheckLimit(base)
    if (!ok) return

    const instanceId = newInstanceId(base)
    const size = defaultSizeForAtom(base)

    const next = normalizeNewComponent(
      {
        instanceId,
        atom: base,
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        alias: '',
        visible: true,
        locked: false,
        zIndex: (components || []).length,
        bind
      },
      (components || []).length
    )

    setComponents((prev) => [...prev, next])
    setSelectedId(instanceId)
  }

  function handleDropOnCanvas(e) {
    try {
      const raw = e.dataTransfer?.getData('application/x-mlbb-atom')
      if (!raw) return
      const atomDef = JSON.parse(raw)
      const base = atomDef?.atom
      if (!base) return

      const { ok, bind } = computeSpawnBindingAndCheckLimit(base)
      if (!ok) return

      // Convert client drop position to layout coordinates
      const host = wrapRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      const s = scale || 0.35
      const stageW = 1920 * s
      const stageH = 1080 * s
      const stageLeft = rect.left + (rect.width - stageW) / 2
      const stageTop = rect.top + (rect.height - stageH) / 2
      const cx = e.clientX - stageLeft
      const cy = e.clientY - stageTop

      const x = clampInt(cx / s, 0, 1920)
      const y = clampInt(cy / s, 0, 1080)

      const instanceId = newInstanceId(base)
      const size = defaultSizeForAtom(base)
      const next = normalizeNewComponent(
        {
          instanceId,
          atom: base,
          x,
          y,
          width: size.width,
          height: size.height,
          alias: '',
          visible: true,
          locked: false,
          zIndex: (components || []).length,
          bind
        },
        (components || []).length
      )

      setComponents((prev) => [...prev, next])
      setSelectedId(instanceId)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0f0c15] p-6">
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
            onChange={(e) => {
              const url = toServerUrl(e.target.value)
              setBackground(url)
              saveLayout(components, { background: toRelativeAssetsPath(url) || '' }).catch(() => {})
            }}
            className="rounded-xl border border-white/10 bg-[#1a1a2e] px-3 py-2 text-xs font-bold text-white"
            style={{ backgroundColor: '#1a1a2e' }}
          >
            <option value="" style={{ backgroundColor: '#1a1a2e' }}>
              Select Background…
            </option>
            {backgrounds.map((f) => (
              <option key={f} value={`/Assets/backgrounds/${f}`} style={{ backgroundColor: '#1a1a2e' }}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={toRelativeAssetsPath(frame)}
            onChange={(e) => {
              const url = toServerUrl(e.target.value)
              setFrame(url)
              saveLayout(components, { frame: toRelativeAssetsPath(url) || '' }).catch(() => {})
            }}
            className="rounded-xl border border-white/10 bg-[#1a1a2e] px-3 py-2 text-xs font-bold text-white"
            style={{ backgroundColor: '#1a1a2e' }}
          >
            <option value="" style={{ backgroundColor: '#1a1a2e' }}>
              Select Frame…
            </option>
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

          <button
            type="button"
            onClick={() => saveLayout()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white hover:bg-[#6d28d9]"
          >
            <Save className="size-4" />
            {isSaving ? 'SAVING…' : 'SAVE LAYOUT'}
          </button>

          <button
            type="button"
            onClick={() => setAsLiveOverlay()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
          >
            SET LIVE
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 w-full items-stretch gap-3 overflow-hidden">
        <ComponentLibrarySidebar onSpawn={spawnAtom} />

        <div
          ref={wrapRef}
          className="relative z-0 flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden"
          style={{ aspectRatio: '16/9', maxHeight: '80vh' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleDropOnCanvas(e)
          }}
        >
          <ModularCanvas
            components={components}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={(next) => updateComponent(next)}
            backgroundUrl={background || ''}
            frameUrl={frame || ''}
            onScaleChange={setScale}
            recalcTrigger={sidebarCollapsed}
            matchState={matchState}
          />
        </div>

        <LayerProperties
          selected={selected}
          onChange={(next) => updateComponent(next)}
          onDelete={(t) => deleteComponent(t)}
        />
      </div>
    </div>
  )
}
