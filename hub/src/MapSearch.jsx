import { useEffect, useMemo, useRef, useState } from 'react'

const MLBB_MAPS = [
  { name: 'Sanctum Island', file: 'sanctum_island.png' },
  { name: 'Western Expanse', file: 'western_expanse.png' },
  { name: 'Imperial Sanctuary', file: 'imperial_sanctuary.png' },
  { name: 'The Celestial Palace', file: 'celestial_palace.png' },
  { name: 'Moniyan Empire', file: 'moniyan_empire.png' }
]

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function MapSearch({ value = 'none', onChange }) {
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MLBB_MAPS
    return MLBB_MAPS.filter((m) => m.name.toLowerCase().includes(q) || m.file.toLowerCase().includes(q))
  }, [query])

  const selected = useMemo(() => {
    return MLBB_MAPS.find((m) => m.file === value) || null
  }, [value])

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
  }, [open, query])

  function commit(map) {
    onChange?.(map?.file || 'none')
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="relative">
      <div className="text-xs font-semibold tracking-[0.22em] text-white/50">MAP</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-white/90 hover:bg-white/10"
      >
        {selected ? selected.name : value === 'none' ? 'None' : value}
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[86px] z-50 rounded-2xl border border-white/10 bg-[#0f0c15] p-3 shadow-2xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(list.length - 1, i + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(0, i - 1))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                commit(list[activeIndex] || null)
              }
            }}
            placeholder="Search maps..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40"
            autoFocus
          />

          <div className="mt-2 max-h-64 overflow-auto">
            <button
              type="button"
              onClick={() => commit(null)}
              className={cx(
                'w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5',
                value === 'none' ? 'bg-white/10' : ''
              )}
            >
              None
            </button>

            {list.map((m, idx) => (
              <button
                key={m.file}
                type="button"
                onClick={() => commit(m)}
                className={cx(
                  'mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5',
                  idx === activeIndex ? 'bg-white/10' : ''
                )}
              >
                <div className="font-semibold text-white/90">{m.name}</div>
                <div className="text-xs text-white/50">{m.file}</div>
              </button>
            ))}

            {list.length === 0 ? (
              <div className="px-3 py-3 text-sm text-white/50">No matches</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
