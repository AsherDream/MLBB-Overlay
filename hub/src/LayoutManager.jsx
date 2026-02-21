import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

const SERVER_URL = 'http://localhost:3000'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function getLanIpGuess() {
  return '192.168.x.x'
}

export default function LayoutManager() {
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const [layouts, setLayouts] = useState([])
  const [activeLayout, setActiveLayout] = useState('default_draft')

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('STATE_SYNC', (state) => {
      if (state?.activeLayout) setActiveLayout(state.activeLayout)
    })

    socket.on('ACTIVE_LAYOUT_CHANGED', (payload) => {
      if (payload?.id) setActiveLayout(payload.id)
    })

    return () => socket.disconnect()
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      const res = await fetch(`${SERVER_URL}/api/layouts`)
      const data = await res.json()
      const keys = Object.keys(data?.layouts || {})
      if (!mounted) return
      setLayouts(keys.sort())
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const overlayUrls = useMemo(() => {
    const id = encodeURIComponent(activeLayout || 'default_draft')
    return {
      localhost: `http://localhost:3000/overlay/?id=${id}`,
      lan: `http://${getLanIpGuess()}:3000/overlay/?id=${id}`
    }
  }, [activeLayout])

  async function setLive(id) {
    const res = await fetch(`${SERVER_URL}/api/active-layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (!res.ok) throw new Error(await res.text())
  }

  return (
    <div className="min-h-dvh bg-[#0f0c15] p-6">
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold tracking-[0.22em] text-white/50">LAYOUT MANAGER</div>
        <div className="mt-1 text-xl font-extrabold text-white">Layouts</div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs font-semibold text-white/60">Active Layout</div>
            <div className="mt-1 text-sm font-bold text-white/90">{activeLayout}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs font-semibold text-white/60">Overlay URLs</div>
            <div className="mt-1 text-xs text-white/80">{overlayUrls.localhost}</div>
            <div className="mt-1 text-xs text-white/60">{overlayUrls.lan}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {layouts.map((id) => {
          const isLive = id === activeLayout
          return (
            <div key={id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">{id}</div>
                  <div className={cx('mt-1 text-xs font-semibold', isLive ? 'text-[#a78bfa]' : 'text-white/40')}>
                    {isLive ? 'LIVE' : '—'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/draw/${encodeURIComponent(id)}`)}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
                  >
                    Edit Layout
                  </button>
                  <button
                    type="button"
                    onClick={() => setLive(id)}
                    className={cx(
                      'rounded-xl px-3 py-2 text-xs font-bold',
                      isLive ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-white hover:bg-white/15'
                    )}
                  >
                    Set Live
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
