import { useRef } from 'react'

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
          className="absolute top-1/2 left-1/2 will-change-transform pointer-events-auto"
          style={{
            transform: `
              translate(-50%, -50%)
              translate(${safeTransform.panX}px, ${safeTransform.panY}px)
              scale(${safeTransform.scale})
              rotate(${safeTransform.rotation}deg)
            `,
            transformOrigin: 'center center',
          }}
          onDragStart={(e) => e.preventDefault()}
        />
      ) : null}

      {isEditing && (
        <div className="absolute inset-0 border-2 border-purple-400 pointer-events-none" />
      )}
    </div>
  )
}
