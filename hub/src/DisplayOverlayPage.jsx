import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import QRCode from "react-qr-code"

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'

function buildOverlayUrl(ip, layoutId, port = 3000) {
  if (!ip || !layoutId) return 'N/A'
  return `http://${ip}:${port}/overlay?id=${layoutId}&follow=1`
}

export default function DisplayOverlayPage() {
  const [serverInfo, setServerInfo] = useState({
    local: '127.0.0.1',
    network: [],
    port: 3000
  })

  const [matchState, setMatchState] = useState(null)

  const [copyState, setCopyState] = useState({
    local: false,
    network: false
  })

  const timers = useRef({})

  // Fetch server info once
  useEffect(() => {
    fetch(`${SERVER_URL}/api/server-info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info || typeof info !== 'object') return
        setServerInfo((prev) => ({
          ...prev,
          ...info,
          network: Array.isArray(info.network) ? info.network : []
        }))
      })
      .catch(() => {
        // leave defaults
      })
  }, [])

  // Hydrate initial state and subscribe to live changes
  useEffect(() => {
    let mounted = true

    async function loadInitialState() {
      try {
        const res = await fetch(`${SERVER_URL}/api/matchdraft`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        if (data && data.draftdata) setMatchState(data.draftdata)
      } catch {
        // ignore
      }
    }

    loadInitialState()

    const socket = io(SERVER_URL)

    socket.on('STATE_SYNC', (state) => {
      if (!mounted) return
      setMatchState(state)
    })

    socket.on('ACTIVE_LAYOUT_CHANGED', (payload) => {
      if (!mounted) return
      const nextId = typeof payload === 'string' ? payload : payload?.id
      if (!nextId) return
      setMatchState((prev) => ({
        ...(prev || {}),
        activeLayout: String(nextId)
      }))
    })

    return () => {
      mounted = false
      socket.disconnect()
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  const activeLayoutId = matchState?.activeLayout || 'default_draft'

  const localUrl = buildOverlayUrl(
    serverInfo.local,
    activeLayoutId,
    serverInfo.port
  )

  const networkIp =
  Array.isArray(serverInfo.network)
    ? serverInfo.network.find(ip => ip.startsWith('192.') || ip.startsWith('10.'))
    : null

  const networkUrl = networkIp
    ? buildOverlayUrl(networkIp, activeLayoutId, serverInfo.port)
    : 'N/A'

    function handleCopy(type, url) {
      if (!url || url === 'N/A') return
    
      const copy = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(url)
      : Promise.reject()

      copy.then(() => {
        setCopyState(prev => ({ ...prev, [type]: true }))
    
        // Clear existing timer for this button
        if (timers.current[type]) {
          clearTimeout(timers.current[type])
        }
    
        timers.current[type] = setTimeout(() => {
          setCopyState(prev => ({ ...prev, [type]: false }))
        }, 1500)
      }).catch((err) => {
        console.warn('Clipboard write failed:', err)
      })
    }

  const canUseNetwork = networkUrl !== 'N/A'

  return (
    <div className="min-h-dvh bg-[#0f0c15] p-6">
      <div className="mb-5 flex flex-col gap-1">
        <div className="text-xs font-semibold tracking-[0.22em] text-white/50">
          DISPLAY OVERLAY
        </div>
        <div className="text-2xl font-extrabold text-white">
          OBS Browser Source Links
        </div>
        <div className="text-sm text-white/60">
          Active Layout: <span className="font-semibold">{activeLayoutId}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Local overlay */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.22em] text-white/50">
                LOCAL OVERLAY
              </div>
              <div className="text-[11px] text-white/60">This Machine</div>
            </div>
          </div>

          <div className="mb-2">
            <input
              type="text"
              readOnly
              value={localUrl}
              className="w-full rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2 text-xs text-white/90 outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleCopy('local', localUrl)}
              className="rounded-xl bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white hover:bg-[#6d28d9]"
            >
              {copyState.local ? '✓ COPIED' : 'COPY URL'}
            </button>
            <div className="text-[11px] text-white/60">
              For testing on this machine
            </div>
          </div>
        </div>

        {/* Network / OBS overlay */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.22em] text-white/50">
                NETWORK OVERLAY
              </div>
              <div className="text-[11px] text-white/60">
                Laptop B / OBS
              </div>
              <div className="text-[10px] text-white/40">
                {networkIp || 'No LAN detected'}
              </div>
            </div>
          </div>

          <div className="mb-2">
            <input
              type="text"
              readOnly
              value={networkUrl}
              className="w-full rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2 text-xs text-white/90 outline-none"
            />
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleCopy('network', networkUrl)}
              disabled={!canUseNetwork}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                canUseNetwork
                  ? 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {canUseNetwork
                ? copyState.network
                  ? '✓ COPIED'
                  : 'COPY URL'
                : 'COPY URL'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (canUseNetwork) {
                  window.location.href = networkUrl
                }
              }}
              disabled={!canUseNetwork}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                canUseNetwork
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              OPEN OVERLAY
            </button>
          </div>

          {canUseNetwork ? (
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-[#0f0c15] p-2">
                <QRCode value={networkUrl} size={120} />
              </div>
              <div className="text-[11px] text-white/60">
                Scan this QR code on another laptop to open the overlay URL
                directly, then paste it into OBS (Browser Source).
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-amber-300/80">
              Connect this machine to WiFi to enable OBS network link.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

