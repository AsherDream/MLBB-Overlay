import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Rnd } from 'react-rnd'
import SmartImageFrame from './components/SmartImageFrame.jsx'
import RotationHandle from './components/RotationHandle.jsx'

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'

const BASE_W = 1920
const BASE_H = 1080
const IMAGE_ATOMS = ['T1_PICK', 'T2_PICK', 'T1_BAN', 'T2_BAN', 'T1_LOGO', 'T2_LOGO', 'MAP', 'CUSTOM_IMAGE']

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : 0
  return Math.max(min, Math.min(max, Math.round(x)))
}

function sortByZ(components) {
  return [...components].sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0))
}

function normalizeTransform(transform) {
  return {
    scale: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    ...(transform || {}),
  }
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
  matchState,
  editingCropId,
  setEditingCropId
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
      if (prev !== s) {
        // Run the parent update outside of the current render cycle
        setTimeout(() => onScaleChangeRef.current?.(s), 0)
      }
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

  // WASD and Arrow Key Nudging Logic
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Do not nudge if the user is typing in a text box or input field
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (!selectedId) return;
      const c = components?.find((comp) => comp.instanceId === selectedId);
      if (!c || c.locked) return;

      let dx = 0;
      let dy = 0;
      const step = e.shiftKey ? 10 : 1; // Hold Shift to move 10 pixels at a time

      if (e.key === 'ArrowUp' || e.key === 'w') dy = -step;
      else if (e.key === 'ArrowDown' || e.key === 's') dy = step;
      else if (e.key === 'ArrowLeft' || e.key === 'a') dx = -step;
      else if (e.key === 'ArrowRight' || e.key === 'd') dx = step;

      // If a movement key was pressed, apply the nudge and prevent page scrolling
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        onUpdate?.({ ...c, x: c.x + dx, y: c.y + dy });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [components, selectedId, onUpdate]);

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
        onMouseDown={() => {
          onSelect?.(null)
          setEditingCropId?.(null)
        }}
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
          const isEditing = editingCropId === id
          const z = 1 + clampInt(c.zIndex ?? idx, 0, 999)
          const normalizedTransform = normalizeTransform(c.transform)
          const imageSrc = getHeroImage(c)
          const safeFrameRot = Number.isFinite(Number(c.frameRotation)) ? c.frameRotation : 0;

          return (
            <Rnd
              key={id}
              bounds="parent"
              size={{ width: c.width, height: c.height }}
              position={{ x: c.x, y: c.y }}
              scale={scale}
              dragGrid={[1, 1]}
              resizeGrid={[1, 1]}
              disableDragging={!!c.locked || isEditing}
              enableResizing={!c.locked && !isEditing}
              onMouseDown={(e) => {
                e.stopPropagation()
                onSelect?.(id)
              }}
              onDragStop={(e, d) => {
                onUpdate?.({
                  ...c,
                  transform: normalizedTransform,
                  x: Math.round(d.x),
                  y: Math.round(d.y)
                })
              }}
              onResizeStop={(e, dir, ref, delta, pos) => {
                onUpdate?.({
                  ...c,
                  transform: normalizedTransform,
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
                style={{
                  transform: `rotate(${safeFrameRot}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.1s ease-out'
                }}
              >
                <SmartImageFrame
                  src={imageSrc}
                  transform={normalizedTransform}
                  isEditing={isEditing}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (IMAGE_ATOMS.includes(c.atom)) {
                      setEditingCropId?.(id)
                      onSelect?.(id)
                    }
                  }}
                  onTransformChange={(newTransform) => {
                    onUpdate?.({ ...c, transform: newTransform })
                  }}
                />
                <div className="absolute top-1 left-1 bg-black/60 px-1 rounded text-[9px] font-bold text-white/50">
                  {c.alias || c.atom} {c.bind?.idx !== undefined ? `#${c.bind.idx + 1}` : ''}
                </div>
              </div>

              {/* Outer Frame Handle */}
              {isSelected && !isEditing && (
                <RotationHandle
                  theme="purple"
                  currentRotation={c.frameRotation}
                  onRotate={(deg) => onUpdate?.({ ...c, frameRotation: deg })}
                />
              )}
            </Rnd>
          )
        })}
      </div>
    </div>
  )
}
