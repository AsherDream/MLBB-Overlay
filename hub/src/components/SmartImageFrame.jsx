import { useRef } from 'react'
import RotationHandle from './RotationHandle.jsx'

const DEFAULT_TRANSFORM = {
  scale: 1,
  panX: 0,
  panY: 0,
  rotation: 0,
}

export default function SmartImageFrame({
  src,
  transform,
  onTransformChange,
  isEditing = false,
  onDoubleClick,
}) {
  const safeTransform = { ...DEFAULT_TRANSFORM, ...(transform || {}) }
  const dragRef = useRef({
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  })
  const frameRef = useRef(null)

  const handlePointerDown = (e) => {
    if (!isEditing) return

    e.stopPropagation()
    e.preventDefault()

    dragRef.current.dragging = true
    dragRef.current.pointerId = e.pointerId
    dragRef.current.startX = e.clientX
    dragRef.current.startY = e.clientY
    dragRef.current.startPanX = Number(safeTransform.panX) || 0
    dragRef.current.startPanY = Number(safeTransform.panY) || 0

    try {
      frameRef.current?.setPointerCapture?.(e.pointerId)
    } catch {
      // no-op: capture support varies by environment
    }
  }

  const handlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag.dragging) return
    if (drag.pointerId !== e.pointerId) return
    if (!isEditing) return

    e.stopPropagation()
    e.preventDefault()

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY

    onTransformChange?.({
      ...safeTransform,
      panX: drag.startPanX + dx,
      panY: drag.startPanY + dy,
    })
  }

  const finishDrag = (e) => {
    const drag = dragRef.current
    if (!drag.dragging) return
    if (drag.pointerId !== e.pointerId) return

    e.stopPropagation()
    e.preventDefault()

    drag.dragging = false
    try {
      frameRef.current?.releasePointerCapture?.(e.pointerId)
    } catch {
      // no-op
    }
    drag.pointerId = null
  }

  return (
    <div
      ref={frameRef}
      className="w-full h-full overflow-hidden relative select-none"
      onDoubleClick={onDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transformOrigin: 'center center',
            transform: `
              translate(-50%, -50%)
              translate(${Number.isFinite(Number(safeTransform.panX)) ? Number(safeTransform.panX) : 0}px,
                        ${Number.isFinite(Number(safeTransform.panY)) ? Number(safeTransform.panY) : 0}px)
              scale(${Number.isFinite(Number(safeTransform.scale)) ? Number(safeTransform.scale) : 1})
              rotate(${Number.isFinite(Number(safeTransform.rotation)) ? Number(safeTransform.rotation) : 0}deg)
            `,
          }}
          onDragStart={(e) => e.preventDefault()}
        />
      ) : null}

      {isEditing && (
        <>
          <div className="absolute inset-0 border-2 border-purple-400 pointer-events-none" />
          <RotationHandle
            theme="blue"
            currentRotation={safeTransform.rotation}
            onRotate={(deg) => onTransformChange?.({ ...safeTransform, rotation: deg })}
          />
        </>
      )}
    </div>
  )
}
