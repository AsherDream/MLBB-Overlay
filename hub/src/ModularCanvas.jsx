import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
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

function computeScale(viewportW, viewportH) {
  if (!viewportW || !viewportH) return 0.35
  const s = Math.min(viewportW / BASE_W, viewportH / BASE_H)* 0.85 
  return Math.max(0.1, Math.min(1, s))
}

export default function ModularCanvas({
  components,
  selectedId,
  onSelect,
  onUpdate,
  backgroundUrl,
  frameUrl,
  onScaleChange,
  recalcTrigger,
  matchState
}) {
  const viewportRef = useRef(null)
  const [scale, setScale] = useState(0.35)
  const sorted = useMemo(() => sortByZ(components || []), [components])
  const onScaleChangeRef = useRef(onScaleChange)
  onScaleChangeRef.current = onScaleChange

  const recalc = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const s = computeScale(rect.width, rect.height)
    setScale((prev) => {
      if (prev !== s) onScaleChangeRef.current?.(s)
      return s
    })
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    recalc()
    const onResize = () => recalc()
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [recalc])

  useEffect(() => {
    // After nav sidebar toggle, layout transitions 200ms; recalc once settled
    const t = setTimeout(recalc, 220)
    return () => clearTimeout(t)
  }, [recalcTrigger, recalc])

  const bgStyle = backgroundUrl
    ? { backgroundImage: `url("${backgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {}

  const getHeroImage = (c) => {
  if (!matchState) return null;
  const idx = c.bind?.idx ?? 0;
  let heroId = 'none';

  if (c.atom === 'T1_PICK') heroId = matchState.blueTeam?.picks?.[idx];
  else if (c.atom === 'T2_PICK') heroId = matchState.redTeam?.picks?.[idx];
  else if (c.atom === 'T1_BAN') heroId = matchState.blueTeam?.bans?.[idx];
  else if (c.atom === 'T2_BAN') heroId = matchState.redTeam?.bans?.[idx];
  else if (c.atom === 'MAP') return `http://localhost:3000/Assets/Maps/${matchState.map}.png`;

  if (!heroId || heroId === 'none') return null;
  return `http://localhost:3000/Assets/HeroPick/${heroId.toLowerCase()}.png`;
};
    
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 p-3 overflow-hidden">
      <div
        ref={viewportRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
      >
        <div
          className="relative origin-center overflow-hidden rounded-none shrink-0"
          style={{
            width: BASE_W,
            height: BASE_H,
            transform: `scale(${scale})`,
            ...bgStyle
          }}
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
            {frameUrl ? (
              <div
                className="absolute inset-0 bg-no-repeat bg-center"
                style={{
                  zIndex: 9999,
                  pointerEvents: 'none',
                  backgroundImage: `url("${frameUrl}")`,
                  backgroundSize: 'contain'
                }}
              />
            ) : null}
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
                    {/* The Actual Hero Image Preview */}
                    {getHeroImage(c) && (
                      <img 
                        src={getHeroImage(c)} 
                        className="absolute inset-0 w-full h-full object-cover opacity-80" 
                        alt="" 
                      />
                    )}
                    {/* The Label (Moved to a small badge so it doesn't block the face) */}
                    <div className="absolute top-1 left-1 bg-black/60 px-1 rounded text-[9px] font-bold text-white/50">
                      {c.alias || c.atom} {c.bind?.idx !== undefined ? `#${c.bind.idx + 1}` : ''}
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
