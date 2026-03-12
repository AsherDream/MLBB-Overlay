import { ATOMS } from './atoms.js'

export default function ComponentLibrarySidebar({ onSpawn }) {
  return (
    <aside className="h-full w-[260px] shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-3 text-xs font-semibold tracking-[0.22em] text-white/50">COMPONENT LIBRARY</div>
      <div className="space-y-2">
        {ATOMS.map((a) => (
          <button
            key={a.atom}
            type="button"
            onClick={() => onSpawn?.(a)}
            draggable
            onDragStart={(e) => {
              try {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('application/x-mlbb-atom', JSON.stringify(a))
              } catch {
                // ignore
              }
            }}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs font-extrabold text-white hover:bg-white/10"
          >
            {a.label}
            <div className="mt-1 text-[10px] font-semibold text-white/40">{a.atom}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
