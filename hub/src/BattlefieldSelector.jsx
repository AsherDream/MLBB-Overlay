import { useMemo } from 'react'

const EFFECTS = [
  { key: 'broken_walls', label: 'Broken Walls' },
  { key: 'dangerous_grass', label: 'Dangerous Grass' },
  { key: 'flying_clouds', label: 'Flying Clouds' },
  { key: 'expanding_rivers', label: 'Expanding Rivers' }
]

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function BattlefieldSelector({ value = 'none', onChange }) {
  const active = String(value || 'none')

  const buttons = useMemo(() => EFFECTS, [])

  return (
    <div>
      <div className="text-xs font-semibold tracking-[0.22em] text-white/50">BATTLEFIELD EFFECT</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {buttons.map((b) => {
          const isActive = active === b.key
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onChange?.(isActive ? 'none' : b.key)}
              className={cx(
                'rounded-xl border px-3 py-2 text-left text-xs font-bold transition',
                isActive
                  ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                  : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10'
              )}
            >
              {b.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
