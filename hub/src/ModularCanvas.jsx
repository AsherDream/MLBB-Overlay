import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Rnd } from 'react-rnd'

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'

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
  if (!viewportW || !viewportH) return 1
  return Math.min(viewportW / 1920, viewportH / 1080) * 0.92;
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
  const [scale, setScale] = useState(1)
  const sorted = useMemo(() => sortByZ(components || []), [components])
  const onScaleChangeRef = useRef(onScaleChange)
  useEffect(() => {
    onScaleChangeRef.current = onScaleChange
  }, [onScaleChange])

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

  const getHeroImage = (c) => {
    if (!matchState) return null
    const idx = c.bind?.idx ?? 0
    let heroId = 'none'

    if (c.atom === 'T1_PICK') heroId = matchState.blueTeam?.picks?.[idx]
    else if (c.atom === 'T2_PICK') heroId = matchState.redTeam?.picks?.[idx]
    else if (c.atom === 'T1_BAN') heroId = matchState.blueTeam?.bans?.[idx]
    else if (c.atom === 'T2_BAN') heroId = matchState.redTeam?.bans?.[idx]
    else if (c.atom === 'MAP') {
      const mapId = matchState.map
      if (!mapId || mapId === 'none') return null
      return `${SERVER_URL}/Assets/Maps/${encodeURIComponent(String(mapId).toLowerCase())}.png`
    }

    if (!heroId || heroId === 'none') return null
    return `${SERVER_URL}/Assets/HeroPick/${encodeURIComponent(String(heroId).toLowerCase())}.png`
  }
    
  return (
    <div
      className="flex-1 w-full h-full relative overflow-hidden bg-black/20 rounded-2xl border border-white/10"
      ref={viewportRef}
    >
      {/* By using absolute positioning and CSS calc(), the inner canvas size 
        never dictates the outer container size. The feedback loop is broken! 
      */}
      <div
        style={{
          position: 'absolute',
          width: BASE_W,
          height: BASE_H,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          // Mathematically center the scaled 1920x1080 box within the flexible container
          left: `calc(50% - ${(BASE_W * scale) / 2}px)`,
          top: `calc(50% - ${(BASE_H * scale) / 2}px)`,
          backgroundColor: '#000'
        }}
        onMouseDown={() => onSelect?.(null)}
      >
        {/* Background Layer */}
        {backgroundUrl && (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url("${backgroundUrl}")`, backgroundSize: 'cover' }}
          />
        )}

        {/* Frame Layer */}
        {frameUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 50,
              backgroundImage: `url("${frameUrl}")`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat'
            }}
          />
        )}

        {/* Components */}
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
              dragGrid={[1, 1]}
              resizeGrid={[1, 1]}
              disableDragging={!!c.locked}
              enableResizing={!c.locked}
              onMouseDown={(e) => {
                e.stopPropagation()
                onSelect?.(id)
              }}
              onDragStop={(e, d) => {
                onUpdate?.({
                  ...c,
                  x: Math.round(d.x),
                  y: Math.round(d.y)
                })
              }}
              onResizeStop={(e, dir, ref, delta, pos) => {
                onUpdate?.({
                  ...c,
                  x: Math.round(pos.x),
                  y: Math.round(pos.y),
                  width: Math.round(ref.offsetWidth),
                  height: Math.round(ref.offsetHeight)
                })
              }}
              style={{ zIndex: z, opacity: c.visible === false ? 0 : 1 }}
            >
              <div
                className={`h-full w-full overflow-hidden rounded-lg border ${
                  isSelected ? 'border-[#a78bfa] shadow-[0_0_15px_rgba(167,139,250,0.5)]' : 'border-white/10'
                } bg-[#1a1625]/70`}
              >
                {getHeroImage(c) && (
                  <img
                    src={getHeroImage(c)}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    alt=""
                    draggable="false"
                    onDragStart={(e) => e.preventDefault()}
                  />
                )}
                <div className="absolute top-1 left-1 bg-black/60 px-1 rounded text-[9px] font-bold text-white/50">
                  {c.alias || c.atom} {c.bind?.idx !== undefined ? `#${c.bind.idx + 1}` : ''}
                </div>
              </div>
            </Rnd>
          )
        })}
      </div>
    </div>
  )
}
