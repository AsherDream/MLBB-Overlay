import React, { useEffect, useMemo, useState } from 'react'

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'

export default function HeroSelect({ value, onSelect, placeholder = 'Select hero', allowNone = true }) {
  const [heroes, setHeroes] = useState([])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const res = await fetch(`${SERVER_URL}/api/heroes`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        setHeroes(Array.isArray(data?.heroes) ? data.heroes : [])
      } catch {
        // ignore
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const options = useMemo(() => {
    const base = Array.isArray(heroes) ? heroes : []
    return allowNone ? [{ name: 'none', hasAsset: false }, ...base] : base
  }, [allowNone, heroes])

  return (
    <select
      value={value}
      onChange={(e) => onSelect?.(e.target.value)}
      className="h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((h) => (
        <option key={h.name} value={h.name}>
          {h.name}
        </option>
      ))}
    </select>
  )
}
