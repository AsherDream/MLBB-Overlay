import { useMemo } from 'react'

/**
 * Draft Manager — hero search, hero grid, pending hero, pick/ban target buttons.
 * UI-only; calls parent onPick / onBan (parent is responsible for clearing pending after apply).
 */
export default function DraftManager({
  heroes = [],
  heroSearch,
  setHeroSearch,
  pendingHero,
  setPendingHero,
  onPick,
  onBan
}) {
  const filteredHeroes = useMemo(() => {
    const q = String(heroSearch || '').trim().toLowerCase()
    if (!q) return heroes
    return heroes.filter((h) => {
      const id = String(h.id || h.name || '').toLowerCase()
      const name = String(h.name || h.id || '').toLowerCase()
      return id.includes(q) || name.includes(q)
    })
  }, [heroes, heroSearch])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-xs font-semibold tracking-[0.22em] text-white/50">DRAFT MANAGER</div>

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-white/45">SEARCH HEROES</span>
          <input
            type="text"
            value={heroSearch}
            onChange={(e) => setHeroSearch(e.target.value)}
            placeholder="Type hero name…"
            className="h-8 w-[200px] rounded-lg border border-white/10 bg-[#1a1625] px-3 text-xs text-white/90 outline-none"
          />
        </div>
        {pendingHero ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <span className="text-[11px] font-semibold text-emerald-100">Selected:</span>
            <span className="text-xs font-bold text-emerald-100">{pendingHero.display || pendingHero.id}</span>
            <span className="text-[11px] font-semibold text-emerald-100/80">→ choose target below</span>
          </div>
        ) : (
          <div className="text-[11px] font-semibold text-white/40">Click a hero, then choose a target slot.</div>
        )}
      </div>

      <div className="grid max-h-[260px] grid-cols-5 gap-2 overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-2 text-xs md:grid-cols-8">
        {filteredHeroes.map((h) => {
          const id = String(h.id || h.name || '').toLowerCase()
          const label = h.name || h.id || id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPendingHero({ id, display: label })}
              className="min-h-[34px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/15"
            >
              {label}
            </button>
          )
        })}
        {!filteredHeroes.length ? (
          <div className="col-span-full py-6 text-center text-[11px] font-semibold text-white/40">
            No heroes found. Ensure /Assets/HeroPick is populated on the server.
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {['blueTeam', 'redTeam'].map((side) => {
          const isBlue = side === 'blueTeam'
          return (
            <div
              key={side}
              className="rounded-xl border border-white/10 bg-black/30 p-3"
              style={{ boxShadow: `0 0 0 1px ${isBlue ? '#60a5fa22' : '#fb718522'}` }}
            >
              <div className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-white/45">
                {isBlue ? 'BLUE' : 'RED'} TARGETS
              </div>
              <div className="mb-2 text-[11px] font-semibold text-white/50">PICKS</div>
              <div className="mb-3 flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={!pendingHero}
                    onClick={() => {
                      if (!pendingHero) return
                      onPick(side, idx, pendingHero.id)
                    }}
                    className={
                      pendingHero
                        ? 'rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20'
                        : 'rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/40'
                    }
                  >
                    {isBlue ? 'Blue' : 'Red'} Pick {idx + 1}
                  </button>
                ))}
              </div>
              <div className="mb-2 text-[11px] font-semibold text-white/50">BANS</div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={!pendingHero}
                    onClick={() => {
                      if (!pendingHero) return
                      onBan(side, idx, pendingHero.id)
                    }}
                    className={
                      pendingHero
                        ? 'rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/20'
                        : 'rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/40'
                    }
                  >
                    {isBlue ? 'Blue' : 'Red'} Ban {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
