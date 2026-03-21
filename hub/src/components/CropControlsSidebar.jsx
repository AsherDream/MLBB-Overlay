const DEFAULT_TRANSFORM = {
  scale: 1,
  panX: 0,
  panY: 0,
  rotation: 0,
}

export default function CropControlsSidebar({ transform, onChange, onClose }) {
  const safe = {
    ...DEFAULT_TRANSFORM,
    ...(transform || {}),
  }

  const disabled = !transform

  const update = (patch) => {
    if (!onChange) return
    onChange({ ...safe, ...patch })
  }

  return (
    <aside
      className="h-full w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl border border-white/10 bg-[#1a1625] p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-white/60">Crop Controls</div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/15"
          >
            Close
          </button>
        </div>

      <label className="block text-xs text-white/70">
        Scale ({Number(safe.scale).toFixed(2)})
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.01}
          value={Number(safe.scale) || 1}
          disabled={disabled}
          onChange={(e) => update({ scale: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      <label className="block text-xs text-white/70">
        Rotation ({Number(safe.rotation)}deg)
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={Number(safe.rotation) || 0}
          disabled={disabled}
          onChange={(e) => update({ rotation: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-white/70">
          Pan X
          <input
            type="number"
            value={Number(safe.panX) || 0}
            disabled={disabled}
            onChange={(e) => update({ panX: Number(e.target.value) })}
            className="mt-1 w-full rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>
        <label className="text-xs text-white/70">
          Pan Y
          <input
            type="number"
            value={Number(safe.panY) || 0}
            disabled={disabled}
            onChange={(e) => update({ panY: Number(e.target.value) })}
            className="mt-1 w-full rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>
      </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange?.({
              scale: 1,
              panX: 0,
              panY: 0,
              rotation: 0,
            })
          }
          className="w-full rounded-md bg-purple-500/80 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </aside>
  )
}
