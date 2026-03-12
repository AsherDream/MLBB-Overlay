import { useMemo } from 'react'
import { Rnd } from 'react-rnd'

const BASE_W = 1920
const BASE_H = 1080

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : 0
  return Math.max(min, Math.min(max, Math.round(x)))
}

function sortByZ(components) {
  return [...components].sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0))
}

export default function ModularCanvas({ scale, components, selectedId, onSelect, onUpdate }) {
  const sorted = useMemo(() => sortByZ(components || []), [components])

  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 p-3 overflow-hidden">
      <div className="h-full w-full overflow-hidden">
        <div
          className="relative origin-top-left overflow-hidden rounded-xl"
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})` }}
          onMouseDown={() => onSelect?.(null)}
          onDragOver={(e) => {
            e.preventDefault()
            try {
              e.dataTransfer.dropEffect = 'copy'
            } catch {
              // ignore
            }
          }}
          onDrop={(e) => {
            // handled by parent via custom event, but keep preventDefault here
            e.preventDefault()
          }}
        >
          <div className="absolute inset-0" style={{ zIndex: 0, background: 'rgba(255,255,255,0.02)' }} />

          <div className="absolute inset-0" style={{ zIndex: 10 }}>
            {sorted.map((c, idx) => {
              const id = c.instanceId
              const isSelected = id === selectedId
              const z = 1 + clampInt(c.zIndex ?? idx, 0, 999)

              return (
                <Rnd
                  key={id}
                  bounds="parent"
                  size={{ width: c.width, height: c.height }}
                  position={{ x: c.x, y: c.y }}
                  scale={scale}
                  disableDragging={!!c.locked}
                  enableResizing={!c.locked}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    onSelect?.(id)
                  }}
                  onDragStop={(e, d) => {
                    onUpdate?.({
                      ...c,
                      x: clampInt(d.x, 0, BASE_W),
                      y: clampInt(d.y, 0, BASE_H)
                    })
                  }}
                  onResizeStop={(e, dir, ref, delta, pos) => {
                    onUpdate?.({
                      ...c,
                      x: clampInt(pos.x, 0, BASE_W),
                      y: clampInt(pos.y, 0, BASE_H),
                      width: clampInt(ref.offsetWidth, 10, BASE_W),
                      height: clampInt(ref.offsetHeight, 10, BASE_H)
                    })
                  }}
                  style={{ zIndex: z, opacity: c.visible === false ? 0 : 1 }}
                >
                  <div
                    className={`h-full w-full overflow-hidden rounded-lg border ${
                      isSelected ? 'border-[#a78bfa]' : 'border-white/10'
                    } bg-[#1a1625]/70`}
                  >
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-extrabold text-white/90">
                      {c.alias || c.atom}
                    </div>
                  </div>
                </Rnd>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
