import SmartInput from './SmartInput.jsx'

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : parseInt(String(n || '0'), 10)
  if (Number.isNaN(x)) return min
  return Math.max(min, Math.min(max, Math.trunc(x)))
}

export default function LayerProperties({ selected, onChange, onDelete }) {
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

  return (
    <aside className="h-full w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3">
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
          value={selected.alias || ''}
          onDebouncedChange={(v) => onChange?.({ ...selected, alias: String(v || '') })}
        />

        <div className="grid grid-cols-2 gap-2">
          <SmartInput
            label="X"
            type="number"
            value={selected.x}
            onDebouncedChange={(v) => onChange?.({ ...selected, x: clampInt(Number(v), 0, 1920) })}
          />
          <SmartInput
            label="Y"
            type="number"
            value={selected.y}
            onDebouncedChange={(v) => onChange?.({ ...selected, y: clampInt(Number(v), 0, 1080) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SmartInput
            label="W"
            type="number"
            value={selected.width}
            onDebouncedChange={(v) => onChange?.({ ...selected, width: clampInt(Number(v), 10, 1920) })}
          />
          <SmartInput
            label="H"
            type="number"
            value={selected.height}
            onDebouncedChange={(v) => onChange?.({ ...selected, height: clampInt(Number(v), 10, 1080) })}
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
          onDebouncedChange={(v) =>
            onChange?.({
              ...selected,
              zIndex: clampInt(Number(v), -999, 999)
            })
          }
        />

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
                  const nextIdx = clampInt(Number(e.target.value), 0, 4)
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
              onDebouncedChange={(v) =>
                onChange?.({
                  ...selected,
                  crop: {
                    ...crop,
                    x: clampInt(Number(v), -1000, 1000)
                  }
                })
              }
            />
            <SmartInput
              label="Y"
              type="number"
              value={crop.y}
              onDebouncedChange={(v) =>
                onChange?.({
                  ...selected,
                  crop: {
                    ...crop,
                    y: clampInt(Number(v), -1000, 1000)
                  }
                })
              }
            />
            <SmartInput
              label="Scale"
              type="number"
              value={crop.scale}
              onDebouncedChange={(v) => {
                const raw = Number(v)
                const safe = Number.isFinite(raw) && raw > 0 ? raw : 1
                onChange?.({
                  ...selected,
                  crop: {
                    ...crop,
                    scale: Math.max(0.1, Math.min(4, safe))
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
                  onDebouncedChange={(v) => {
                    const next = baseMask.map((pt, idx) =>
                      idx === i
                        ? {
                            ...pt,
                            x: clampInt(Number(v), -1000, 3000)
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
                  onDebouncedChange={(v) => {
                    const next = baseMask.map((pt, idx) =>
                      idx === i
                        ? {
                            ...pt,
                            y: clampInt(Number(v), -1000, 3000)
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
