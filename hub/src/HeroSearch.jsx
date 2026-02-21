import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export const MLBB_HEROES = [
  'none',
  'aamon',
  'akai',
  'aldous',
  'alice',
  'alpha',
  'alucard',
  'angela',
  'argus',
  'arlot',
  'atlas',
  'aulus',
  'aurora',
  'badang',
  'balmond',
  'bane',
  'barats',
  'baxia',
  'beatrix',
  'beleric',
  'benedetta',
  'brody',
  'bruno',
  'carmila',
  'cecilion',
  "chang'e",
  'chang_e',
  'chip',
  'chou',
  'cici',
  'claude',
  'clint',
  'cyclops',
  'diggie',
  'dyroth',
  'edith',
  'esmeralda',
  'estes',
  'eudora',
  'fanny',
  'faramis',
  'floryn',
  'franco',
  'fredrin',
  'freya',
  'gatotkaca',
  'gloo',
  'gord',
  'granger',
  'grock',
  'guinevere',
  'gusion',
  'hanabi',
  'hanzo',
  'harith',
  'harley',
  'hayabusa',
  'helcurt',
  'hilda',
  'hylos',
  'irithel',
  'ixia',
  'jawhead',
  'johnson',
  'joy',
  'julian',
  'kadita',
  'kagura',
  'kaja',
  'kalea',
  'karina',
  'karrie',
  'khaleed',
  'khufra',
  'kimmy',
  'lancelot',
  'lapu lapu',
  'lapulapu',
  'layla',
  'leomord',
  'lesley',
  'ling',
  'lolita',
  'lukas',
  'lunox',
  'luoyi',
  'lylia',
  'martis',
  'masha',
  'mathilda',
  'melissa',
  'minotour',
  'minsitthar',
  'miya',
  'moskov',
  'nana',
  'natalia',
  'natan',
  'nolan',
  'novaria',
  'obsidia',
  'odette',
  'paquito',
  'pharsa',
  'phoveus',
  'popolandkupa',
  'rafaela',
  'roger',
  'ruby',
  'saber',
  'selena',
  'silvanna',
  'sora',
  'sun',
  'suyou',
  'terizla',
  'thamuz',
  'tigreal',
  'uranus',
  'vale',
  'valentina',
  'valir',
  'vexana',
  'wanwan',
  'xavier',
  'xborg',
  'yin',
  'yisunshin',
  'yuzhong',
  'yve',
  'zetian',
  'zhask',
  'zhuxin',
  'zilong'
]

function getThumb(hero) {
  if (hero === 'none') return '/Assets/HeroPick/idle.png'
  return `/Assets/HeroPick/${hero}.png`
}

function normalize(s) {
  return (s || '').toLowerCase().trim()
}

export default function HeroSearch({ value, onSelect, placeholder = 'Search hero…' }) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  const items = useMemo(() => {
    const q = normalize(query)
    const base = MLBB_HEROES

    if (!q) return base
    return base.filter((h) => normalize(h).includes(q))
  }, [query])

  const safeHighlight = Math.min(highlight, Math.max(0, items.length - 1))

  useEffect(() => {
    setHighlight(0)
  }, [query])

  function commit(hero) {
    onSelect?.(hero)
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }

    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[safeHighlight]) commit(items[safeHighlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 pr-9 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-[#7c3aed]"
        />
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-white/50" />
      </div>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#1a1625] p-1 shadow-xl"
          onMouseDown={(e) => {
            // keep focus to avoid blur closing before click
            e.preventDefault()
          }}
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-white/40">No heroes found</div>
          ) : (
            items.map((hero, idx) => {
              const active = idx === safeHighlight
              return (
                <button
                  key={`${hero}-${idx}`}
                  type="button"
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => commit(hero)}
                  className={
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ' +
                    (active ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5')
                  }
                >
                  <img
                    src={getThumb(hero)}
                    alt=""
                    className="h-6 w-6 rounded-md border border-white/10 bg-black/20 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/Assets/HeroPick/idle.png'
                    }}
                  />
                  <span className="truncate">{hero === 'none' ? 'None' : hero}</span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
