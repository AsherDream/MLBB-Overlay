import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { ArrowLeftRight, RefreshCcw, Shuffle } from 'lucide-react'
import HeroSearch from './HeroSearch.jsx'

const SERVER_URL = 'http://localhost:3000'

const DEFAULT_TEAM = {
  name: '',
  score: 0,
  players: [{ name: '' }, { name: '' }, { name: '' }, { name: '' }, { name: '' }],
  picks: ['none', 'none', 'none', 'none', 'none'],
  bans: ['none', 'none', 'none', 'none', 'none']
}

const DEFAULT_STATE = {
  blueTeam: JSON.parse(JSON.stringify(DEFAULT_TEAM)),
  redTeam: JSON.parse(JSON.stringify(DEFAULT_TEAM)),
  phase: 'draft'
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
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

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-[#7c3aed]"
    />
  )
}

function NumberInput({ value, onChange }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(clampScore(e.target.value))}
      className="h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none focus:border-[#7c3aed]"
    />
  )
}

export default function ControlPanel() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [state, setState] = useState(() => deepClone(DEFAULT_STATE))

  const serverLabel = useMemo(() => SERVER_URL.replace('http://', ''), [])

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('STATE_SYNC', (s) => {
      setState(s)
    })

    socket.on('STATE_ERROR', (msg) => {
      console.error('STATE_ERROR:', msg)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  function emit(next) {
    setState(next)
    socketRef.current?.emit('UPDATE_STATE', next)
  }

  function updateTeam(side, updater) {
    const next = deepClone(state)
    next[side] = updater(next[side])
    emit(next)
  }

  function resetAll() {
    emit(deepClone(DEFAULT_STATE))
  }

  function switchTeams() {
    const next = deepClone(state)
    const tmp = next.blueTeam
    next.blueTeam = next.redTeam
    next.redTeam = tmp
    emit(next)
  }

  function swapPlayers(side, aIdx, bIdx) {
    updateTeam(side, (t) => {
      const team = deepClone(t)
      const tmp = team.players[aIdx]
      team.players[aIdx] = team.players[bIdx]
      team.players[bIdx] = tmp
      return team
    })
  }

  function setPick(side, idx, hero) {
    updateTeam(side, (t) => {
      const team = deepClone(t)
      team.picks[idx] = hero
      return team
    })
  }

  function setBan(side, idx, hero) {
    updateTeam(side, (t) => {
      const team = deepClone(t)
      team.bans[idx] = hero
      return team
    })
  }

  function setPlayer(side, idx, name) {
    updateTeam(side, (t) => {
      const team = deepClone(t)
      team.players[idx] = { ...team.players[idx], name }
      return team
    })
  }

  function setTeamName(side, name) {
    updateTeam(side, (t) => ({ ...t, name }))
  }

  function setTeamScore(side, score) {
    updateTeam(side, (t) => ({ ...t, score: clampScore(score) }))
  }

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

        <div className="flex flex-wrap gap-2">
          <CompactButton icon={RefreshCcw} onClick={resetAll} variant="ghost">
            RESET
          </CompactButton>
          <CompactButton icon={Shuffle} onClick={switchTeams}>
            GLOBAL SWAP
          </CompactButton>
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
                value={team?.players?.[idx]?.name || ''}
                onChange={(v) => onPlayer(idx, v)}
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
                <HeroSearch
                  value={team?.picks?.[idx] || 'none'}
                  onSelect={(hero) => onPick(idx, hero)}
                  placeholder="Select hero"
                />
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
                <HeroSearch
                  value={team?.bans?.[idx] || 'none'}
                  onSelect={(hero) => onBan(idx, hero)}
                  placeholder="Select hero"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}
