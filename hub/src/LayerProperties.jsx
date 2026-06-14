import SmartInput from './SmartInput.jsx'
import { getThemeFontFamily, getThemeFontSize } from './atoms.js'

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : parseInt(String(n || '0'), 10)
  if (Number.isNaN(x)) return min
  return Math.max(min, Math.min(max, Math.trunc(x)))
}

function parseSafeInt(inputValue, min, max) {
  const cleanVal = parseInt(inputValue, 10)
  const finalVal = Number.isNaN(cleanVal) ? 0 : cleanVal
  return clampInt(finalVal, min, max)
}

function parseSafeFloat(inputValue, min, max, fallback) {
  const cleanVal = parseFloat(inputValue)
  const finalVal = Number.isNaN(cleanVal) ? fallback : cleanVal
  return Math.max(min, Math.min(max, finalVal))
}

function isTextStyleAtom(atom) {
  const a = String(atom || '')
  return (
    a.includes('NAME') ||
    a.includes('SCORE') ||
    a === 'CUSTOM_TEXT'
  )
}

function normalizeStyle(style) {
  if (!style || typeof style !== 'object') return {}
  return { ...style }
}

export default function LayerProperties({ selected, onChange, onDelete, theme }) {
  if (!selected) {
    return (
      <aside className="h-full w-[320px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="text-xs font-semibold tracking-[0.22em] text-white/50">PROPERTIES</div>
        <div className="mt-3 text-sm font-semibold text-white/60">Select a component</div>
      </aside>
    )
  }

  const bind = selected.bind && typeof selected.bind === 'object' ? selected.bind : {}
  const idx = clampInt(bind.idx ?? 0, 0, 4)
  const crop =
    selected.crop && typeof selected.crop === 'object'
      ? {
          x: Number.isFinite(selected.crop.x) ? selected.crop.x : 0,
          y: Number.isFinite(selected.crop.y) ? selected.crop.y : 0,
          scale: Number.isFinite(selected.crop.scale) && selected.crop.scale > 0 ? selected.crop.scale : 1
        }
      : { x: 0, y: 0, scale: 1 }

  const baseMask =
    Array.isArray(selected.maskPoints) && selected.maskPoints.length >= 4
      ? selected.maskPoints.slice(0, 4)
      : [
          { x: 0, y: 0 },
          { x: selected.width ?? 0, y: 0 },
          { x: selected.width ?? 0, y: selected.height ?? 0 },
          { x: 0, y: selected.height ?? 0 }
        ]

  const componentStyle = normalizeStyle(selected.style)
  const themeFontSize = getThemeFontSize(selected.atom, theme)
  const themeFontFamily = getThemeFontFamily(theme)
  const hasFontSizeOverride = componentStyle.fontSize != null && componentStyle.fontSize !== ''
  const hasFontFamilyOverride = Boolean(String(componentStyle.fontFamily || '').trim())
  const resolvedFontSize = componentStyle.fontSize ?? themeFontSize ?? ''
  const resolvedFontFamily = componentStyle.fontFamily ?? themeFontFamily ?? ''

  const patchStyle = (field, value) => {
    const nextStyle = { ...componentStyle }
    if (value === '' || value == null) {
      delete nextStyle[field]
    } else {
      nextStyle[field] = value
    }
    const hasKeys = Object.keys(nextStyle).length > 0
    onChange?.({
      ...selected,
      style: hasKeys ? nextStyle : undefined
    })
  }

  return (
    <aside
      className="h-full w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-3 text-xs font-semibold tracking-[0.22em] text-white/50">PROPERTIES</div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="text-[10px] font-bold tracking-[0.22em] text-white/40">INSTANCE</div>
        <div className="mt-1 break-all text-xs font-extrabold text-white">{selected.instanceId}</div>
        <div className="mt-2 text-[10px] font-bold tracking-[0.22em] text-white/40">ATOM</div>
        <div className="mt-1 text-xs font-extrabold text-white">{selected.atom}</div>
      </div>

      <div className="mt-3 space-y-2">
        <SmartInput
          label="Alias"
          value={selected.alias ?? ''}
          commitOn="blur"
          onCommit={(v) => onChange?.({ ...selected, alias: String(v ?? '') })}
        />

        <div className="grid grid-cols-2 gap-2">
          <SmartInput
            label="X"
            type="number"
            value={selected.x ?? 0}
            commitOn="blur"
            onCommit={(v) => onChange?.({ ...selected, x: parseSafeInt(v, 0, 1920) })}
          />
          <SmartInput
            label="Y"
            type="number"
            value={selected.y ?? 0}
            commitOn="blur"
            onCommit={(v) => onChange?.({ ...selected, y: parseSafeInt(v, 0, 1080) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SmartInput
            label="W"
            type="number"
            value={selected.width ?? 0}
            commitOn="blur"
            onCommit={(v) => onChange?.({ ...selected, width: parseSafeInt(v, 10, 1920) })}
          />
          <SmartInput
            label="H"
            type="number"
            value={selected.height ?? 0}
            commitOn="blur"
            onCommit={(v) => onChange?.({ ...selected, height: parseSafeInt(v, 10, 1080) })}
          />
        </div>

        <div className="mt-2">
          <SmartInput
            label="Frame Rotation (deg)"
            type="number"
            value={selected.frameRotation ?? 0}
            commitOn="blur"
            onCommit={(v) => {
              onChange?.({
                ...selected,
                frameRotation: parseSafeFloat(v, -360, 360, 0)
              })
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white/80">
            <input
              type="checkbox"
              checked={selected.visible !== false}
              onChange={(e) => onChange?.({ ...selected, visible: e.target.checked })}
            />
            Visible
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white/80">
            <input
              type="checkbox"
              checked={!!selected.locked}
              onChange={(e) => onChange?.({ ...selected, locked: e.target.checked })}
            />
            Locked
          </label>
        </div>

        <SmartInput
          label="Z-Index"
          type="number"
          value={selected.zIndex ?? 0}
          commitOn="blur"
          onCommit={(v) =>
            onChange?.({
              ...selected,
              zIndex: parseSafeInt(v, -999, 999)
            })
          }
        />

        {isTextStyleAtom(selected.atom) ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] font-bold tracking-[0.22em] text-white/40">TEXT STYLE</div>
            <div className="mt-2 space-y-2">
              <SmartInput
                label="Font Size (px)"
                type="number"
                value={resolvedFontSize}
                inherited={!hasFontSizeOverride}
                commitOn="blur"
                onCommit={(v) => {
                  if (String(v ?? '').trim() === '') {
                    patchStyle('fontSize', null)
                    return
                  }
                  const parsed = parseSafeInt(v, 8, 200)
                  if (parsed === themeFontSize && !hasFontSizeOverride) {
                    return
                  }
                  if (parsed === themeFontSize) {
                    patchStyle('fontSize', null)
                    return
                  }
                  patchStyle('fontSize', parsed)
                }}
              />
              <SmartInput
                label="Font Family"
                value={resolvedFontFamily}
                inherited={!hasFontFamilyOverride}
                commitOn="blur"
                onCommit={(v) => {
                  const trimmed = String(v ?? '').trim()
                  if (!trimmed || trimmed === themeFontFamily) {
                    patchStyle('fontFamily', null)
                    return
                  }
                  patchStyle('fontFamily', trimmed)
                }}
              />
              <div>
                <label className="text-[11px] font-semibold text-white/60">Text Align</label>
                <select
                  value={componentStyle.textAlign ?? 'left'}
                  onChange={(e) => patchStyle('textAlign', e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}

        {String(selected.atom || '').includes('PLAYER_NAME') ||
        String(selected.atom || '').includes('PICK') ||
        String(selected.atom || '').includes('BAN') ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] font-bold tracking-[0.22em] text-white/40">BINDING</div>
            <div className="mt-2">
              <label className="text-[11px] font-semibold text-white/60">Slot (1-5)</label>
              <select
                value={idx}
                onChange={(e) => {
                  const nextIdx = parseSafeInt(e.target.value, 0, 4)
                  onChange?.({
                    ...selected,
                    bind: { ...bind, idx: nextIdx }
                  })
                }}
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] font-bold tracking-[0.22em] text-white/40">FOCUS MODE (CROP)</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <SmartInput
              label="X"
              type="number"
              value={crop.x}
              commitOn="blur"
              onCommit={(v) =>
                onChange?.({
                  ...selected,
                  crop: {
                    ...crop,
                    x: parseSafeInt(v, -1000, 1000)
                  }
                })
              }
            />
            <SmartInput
              label="Y"
              type="number"
              value={crop.y}
              commitOn="blur"
              onCommit={(v) =>
                onChange?.({
                  ...selected,
                  crop: {
                    ...crop,
                    y: parseSafeInt(v, -1000, 1000)
                  }
                })
              }
            />
            <SmartInput
              label="Scale"
              type="number"
              value={crop.scale}
              commitOn="blur"
              onCommit={(v) => {
                const safe = parseSafeFloat(v, 0.1, 4, 1)
                onChange?.({
                  ...selected,
                  crop: {
                    ...crop,
                    scale: safe
                  }
                })
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] font-bold tracking-[0.22em] text-white/40">SMART-FRAME MASK (4 POINTS)</div>
          <div className="mt-2 space-y-2 text-[11px] text-white/70">
            {baseMask.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <SmartInput
                  label={`P${i + 1} X`}
                  type="number"
                  value={p.x}
                  commitOn="blur"
                  onCommit={(v) => {
                    const next = baseMask.map((pt, idx) =>
                      idx === i
                        ? {
                            ...pt,
                            x: parseSafeInt(v, -1000, 3000)
                          }
                        : pt
                    )
                    onChange?.({
                      ...selected,
                      maskPoints: next
                    })
                  }}
                />
                <SmartInput
                  label={`P${i + 1} Y`}
                  type="number"
                  value={p.y}
                  commitOn="blur"
                  onCommit={(v) => {
                    const next = baseMask.map((pt, idx) =>
                      idx === i
                        ? {
                            ...pt,
                            y: parseSafeInt(v, -1000, 3000)
                          }
                        : pt
                    )
                    onChange?.({
                      ...selected,
                      maskPoints: next
                    })
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete?.(selected)}
          className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-extrabold text-red-200 hover:bg-red-500/15"
        >
          DELETE COMPONENT
        </button>
      </div>
    </aside>
  )
}
