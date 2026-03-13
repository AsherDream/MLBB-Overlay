import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { ArrowLeftRight, RefreshCcw, Shuffle } from 'lucide-react'
import BattlefieldSelector from './BattlefieldSelector.jsx'
import SmartInput from './SmartInput.jsx'
import HeroSelect from './HeroSelect.jsx'
import ThemeManager from './ThemeManager.jsx'

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'

const DEFAULT_TEAM = {
  name: '',
  score: 0,
  players: ['', '', '', '', ''],
  picks: ['none', 'none', 'none', 'none', 'none'],
  bans: ['none', 'none', 'none', 'none', 'none']
}

const DEFAULT_STATE = {
  blueTeam: JSON.parse(JSON.stringify(DEFAULT_TEAM)),
  redTeam: JSON.parse(JSON.stringify(DEFAULT_TEAM)),
  map: 'none',
  mapType: 'none',
  phase: 'draft'
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function coerceMap(v) {
  const s = String(v || 'none').trim()
  return s.length ? s : 'none'
}

function coerceMapType(v) {
  const s = String(v || 'none').trim()
  return s.length ? s : 'none'
}

function clampScore(n) {
  const x = Number.isFinite(n) ? n : parseInt(String(n || '0'), 10)
  if (Number.isNaN(x)) return 0
  return Math.max(0, Math.min(99, x))
}

function Panel({ title, side, children }) {
  const accent = side === 'blue' ? '#60a5fa' : '#fb7185'
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
      style={{ boxShadow: `0 0 0 1px ${accent}22, 0 0 40px ${accent}10` }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-white/50">{side.toUpperCase()} SIDE</div>
          <div className="mt-1 text-xl font-extrabold text-white">{title}</div>
        </div>
      </div>
      {children}
    </section>
  )
}

function CompactButton({ children, onClick, variant = 'primary', icon: Icon }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition'
  const cls =
    variant === 'primary'
      ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]'
      : variant === 'danger'
        ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
        : variant === 'ghost'
        ? 'bg-white/10 text-white hover:bg-white/15'
        : 'border border-white/10 bg-transparent text-white/85 hover:bg-white/5'

  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  )
}

function FieldLabel({ children }) {
  return <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-white/45">{children}</div>
}

function TextInput({ value, onChange, placeholder, onBlur, onFocus }) {
  return (
    <SmartInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      debounceMs={300}
    />
  )
}

function NumberInput({ value, onChange }) {
  return (
    <SmartInput
      type="number"
      value={value}
      onChange={(v) => onChange(clampScore(v))}
      debounceMs={300}
    />
  )
}

export default function ControlPanel() {
  const socketRef = useRef(null)
  const editingRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [state, setState] = useState(() => deepClone(DEFAULT_STATE))

  const [layouts, setLayouts] = useState([])
  const [selectedLayoutId, setSelectedLayoutId] = useState('')

  const [heroes, setHeroes] = useState([])
  const [heroSearch, setHeroSearch] = useState('')
  const [pendingHero, setPendingHero] = useState(null)

  const [audioEnabled, setAudioEnabled] = useState(true)
  const [masterVolume, setMasterVolume] = useState(1)
  const [pickVolume, setPickVolume] = useState(1)
  const [banVolume, setBanVolume] = useState(0.6)

  const serverLabel = useMemo(() => SERVER_URL.replace('http://', ''), [])

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('STATE_SYNC', (s) => {
      if (editingRef.current) return
      setState(s)
    })

    socket.on('STATE_ERROR', (msg) => {
      console.error('STATE_ERROR:', msg)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadLayouts() {
      try {
        const res = await fetch(`${SERVER_URL}/api/layouts`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        const ids = data?.layouts && typeof data.layouts === 'object' ? Object.keys(data.layouts) : []
        setLayouts(ids)
        if (!selectedLayoutId && ids.length) setSelectedLayoutId(ids[0])
      } catch {
        // ignore
      }
    }
    loadLayouts()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadHeroes() {
      try {
        const res = await fetch(`${SERVER_URL}/api/heroes`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        const hs = Array.isArray(data?.heroes) ? data.heroes : []
        setHeroes(hs)
      } catch {
        // ignore
      }
    }
    loadHeroes()
    return () => {
      mounted = false
    }
  }, [])

  function emitIntent(eventName, payload) {
    const s = socketRef.current
    if (!s) return
    s.emit(eventName, payload)
  }

  async function postMatchIntent(payload) {
    const body = payload && typeof payload === 'object' ? payload : {}
    const res = await fetch(`${SERVER_URL}/api/matchdata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function emitReset() {
    try {
      await fetch(`${SERVER_URL}/api/theme-reset`, { method: 'POST' })
      await fetch(`${SERVER_URL}/api/match-reset`, { method: 'POST' })
    } catch {
      // ignore
    }
  }

  function emitActiveLayout(id) {
    const s = socketRef.current
    if (!s) return
    s.emit('SET_ACTIVE_LAYOUT', { id })
  }

  function emitVolume(next) {
    const s = socketRef.current
    if (!s) return
    s.emit('VOLUME_CHANGE', next)
  }

  useEffect(() => {
    emitVolume({ enabled: audioEnabled, master: masterVolume, pick: pickVolume, ban: banVolume })
  }, [audioEnabled, masterVolume, pickVolume, banVolume])

  const emitDebounceRef = useRef(null)

  function debounceEmit(payload) {
    if (emitDebounceRef.current) window.clearTimeout(emitDebounceRef.current)
    emitDebounceRef.current = window.setTimeout(() => {
      postMatchIntent(payload).catch(() => {})
      emitDebounceRef.current = null
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (emitDebounceRef.current) window.clearTimeout(emitDebounceRef.current)
    }
  }, [])

  function setMap(nextMap) {
    const v = coerceMap(nextMap)
    setState((prev) => ({ ...prev, map: v }))
  }

  function setMapType(nextMapType) {
    const v = coerceMapType(nextMapType)
    setState((prev) => ({ ...prev, mapType: v }))
    postMatchIntent({ intent: 'SET_MAP_TYPE', mapType: v }).catch(() => {})
  }

  function resetAll() {
    emitReset()
  }

  function globalSwapTeams() {
    postMatchIntent({ intent: 'GLOBAL_SWAP' }).catch(() => {})
  }

  function swapPlayers(side, aIdx, bIdx) {
    setState((prev) => {
      const next = deepClone(prev)
      const t = next[side]
      const tmp = t.players[aIdx]
      t.players[aIdx] = t.players[bIdx]
      t.players[bIdx] = tmp
      return next
    })
    postMatchIntent({ intent: 'SWAP_PLAYERS', side, aIdx, bIdx }).catch(() => {})
  }

  function setPick(side, idx, hero) {
    const v = String(hero || 'none')
    setState((prev) => {
      const next = deepClone(prev)
      next[side].picks[idx] = v
      return next
    })
    postMatchIntent({ intent: 'SET_PICK', side, idx, hero: v }).catch(() => {})
  }

  function setBan(side, idx, hero) {
    const v = String(hero || 'none')
    setState((prev) => {
      const next = deepClone(prev)
      next[side].bans[idx] = v
      return next
    })
    postMatchIntent({ intent: 'SET_BAN', side, idx, hero: v }).catch(() => {})
  }

  function setPlayer(side, idx, name) {
    const v = String(name || '')
    setState((prev) => {
      const next = deepClone(prev)
      next[side].players[idx] = v
      return next
    })
    debounceEmit({ intent: 'SET_PLAYER_NAME', side, idx, name: v })
  }

  function flushPlayerEmit() {
    if (emitDebounceRef.current) {
      window.clearTimeout(emitDebounceRef.current)
      emitDebounceRef.current = null
    }
    // no-op: intents are emitted via debounceEmit now
  }

  function onEditStart() {
    editingRef.current = true
  }

  function onEditEnd() {
    editingRef.current = false
  }

  function setTeamName(side, name) {
    const v = String(name || '')
    setState((prev) => {
      const next = deepClone(prev)
      next[side].name = v
      return next
    })
    postMatchIntent({ intent: 'SET_TEAM_NAME', side, name: v }).catch(() => {})
  }

  function setTeamScore(side, score) {
    const v = clampScore(score)
    setState((prev) => {
      const next = deepClone(prev)
      next[side].score = v
      return next
    })
    postMatchIntent({ intent: 'SET_TEAM_SCORE', side, score: v }).catch(() => {})
  }

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
    <div className="min-h-dvh bg-[#0f0c15] p-6">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-white/50">CENTRAL CONTROL BAR</div>
          <div className="mt-1 flex items-center gap-3">
            <div className="text-xl font-extrabold text-white">Control Panel</div>
            <div className="text-xs font-semibold text-white/50">{serverLabel}</div>
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[320px]">
            <BattlefieldSelector value={state.mapType || 'none'} onChange={setMapType} />
          </div>

          <div className="flex flex-wrap gap-2">
          <CompactButton icon={RefreshCcw} onClick={resetAll} variant="danger">
            RESET
          </CompactButton>
          <CompactButton icon={Shuffle} onClick={globalSwapTeams}>
            GLOBAL SWAP
          </CompactButton>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 text-xs font-semibold tracking-[0.22em] text-white/50">SCENE MANAGER</div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <label className="min-w-[280px] rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-white/45">ACTIVE LAYOUT</div>
            <select
              value={selectedLayoutId}
              onChange={(e) => setSelectedLayoutId(e.target.value)}
              onFocus={(e) => e.target.select?.()}
              className="h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none"
            >
              {layouts.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <CompactButton
              onClick={() => {
                const id = String(selectedLayoutId || '').trim()
                if (!id) return
                emitActiveLayout(id)
              }}
              variant="primary"
            >
              GO LIVE
            </CompactButton>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 text-xs font-semibold tracking-[0.22em] text-white/50">AUDIO ENGINE</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <span className="text-xs font-bold text-white/80">ENABLED</span>
            <input
              type="checkbox"
              checked={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <label className="rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-white/45">MASTER</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 text-[11px] font-semibold text-white/60">{Math.round(masterVolume * 100)}%</div>
          </label>

          <label className="rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-white/45">PICK VOLUME</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pickVolume}
              onChange={(e) => setPickVolume(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 text-[11px] font-semibold text-white/60">{Math.round(pickVolume * 100)}%</div>
          </label>

          <label className="rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-white/45">BAN VOLUME</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={banVolume}
              onChange={(e) => setBanVolume(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 text-[11px] font-semibold text-white/60">{Math.round(banVolume * 100)}%</div>
          </label>
        </div>
      </div>

      <div className="mb-5">
        <ThemeManager />
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
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
              <span className="text-xs font-bold text-emerald-100">
                {pendingHero.display || pendingHero.id}
              </span>
              <span className="text-[11px] font-semibold text-emerald-100/80">→ choose target below</span>
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-white/40">
              Click a hero, then choose a target slot.
            </div>
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
                        setPick(side, idx, pendingHero.id)
                      }}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        pendingHero
                          ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                          : 'border border-white/10 bg-white/5 text-white/40'
                      }`}
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
                        setBan(side, idx, pendingHero.id)
                      }}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        pendingHero
                          ? 'border border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
                          : 'border border-white/10 bg-white/5 text-white/40'
                      }`}
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

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <TeamBlock
            side="blueTeam"
            label="Blue"
            team={state.blueTeam}
            onTeamName={(v) => setTeamName('blueTeam', v)}
            onScore={(v) => setTeamScore('blueTeam', v)}
            onPlayer={(idx, v) => setPlayer('blueTeam', idx, v)}
            onBlurPlayer={flushPlayerEmit}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            onSwapPlayers={(a, b) => swapPlayers('blueTeam', a, b)}
            onPick={(idx, hero) => setPick('blueTeam', idx, hero)}
            onBan={(idx, hero) => setBan('blueTeam', idx, hero)}
          />
        </div>

        <div className="flex-1">
          <TeamBlock
            side="redTeam"
            label="Red"
            team={state.redTeam}
            onTeamName={(v) => setTeamName('redTeam', v)}
            onScore={(v) => setTeamScore('redTeam', v)}
            onPlayer={(idx, v) => setPlayer('redTeam', idx, v)}
            onBlurPlayer={flushPlayerEmit}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            onSwapPlayers={(a, b) => swapPlayers('redTeam', a, b)}
            onPick={(idx, hero) => setPick('redTeam', idx, hero)}
            onBan={(idx, hero) => setBan('redTeam', idx, hero)}
          />
        </div>
      </div>
    </div>
  )
}

function TeamBlock({
  side,
  label,
  team,
  onTeamName,
  onScore,
  onPlayer,
  onBlurPlayer,
  onEditStart,
  onEditEnd,
  onSwapPlayers,
  onPick,
  onBan
}) {
  const isBlue = side === 'blueTeam'
  const accent = isBlue ? '#60a5fa' : '#fb7185'

  return (
    <Panel title={`${label} Team`} side={isBlue ? 'blue' : 'red'}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>TEAM NAME</FieldLabel>
          <TextInput value={team?.name || ''} onChange={onTeamName} placeholder={`${label} Team`} />
        </div>
        <div>
          <FieldLabel>SCORE</FieldLabel>
          <NumberInput value={team?.score ?? 0} onChange={onScore} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold tracking-[0.22em] text-white/50">PLAYERS</div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto] gap-2">
              <TextInput
                value={team?.players?.[idx] || ''}
                onChange={(v) => onPlayer(idx, v)}
                onFocus={() => onEditStart?.()}
                onBlur={() => {
                  onEditEnd?.()
                  onBlurPlayer?.()
                }}
                placeholder={`Player ${idx + 1}`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  title="Swap with next"
                  onClick={() => onSwapPlayers(idx, (idx + 1) % 5)}
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-bold text-white/90 hover:bg-white/15"
                >
                  <ArrowLeftRight className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold tracking-[0.22em] text-white/50">PICKS</div>
          <div className="grid grid-cols-1 gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#0f0c15] p-2" style={{ borderColor: `${accent}22` }}>
                <div className="mb-1 text-[11px] font-semibold text-white/50">Pick {idx + 1}</div>
                <HeroSelect value={team?.picks?.[idx] || 'none'} onSelect={(hero) => onPick(idx, hero)} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold tracking-[0.22em] text-white/50">BANS</div>
          <div className="grid grid-cols-1 gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#0f0c15] p-2" style={{ borderColor: `${accent}22` }}>
                <div className="mb-1 text-[11px] font-semibold text-white/50">Ban {idx + 1}</div>
                <HeroSelect value={team?.bans?.[idx] || 'none'} onSelect={(hero) => onBan(idx, hero)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}
