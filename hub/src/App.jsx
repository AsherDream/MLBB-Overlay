import { Route, Routes, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import HubCard from './HubCard.jsx'
import ControlPanel from './ControlPanel.jsx'

const SERVER_ADDRESS = '192.168.1.190:3000'

function copy(text) {
  return navigator.clipboard.writeText(text)
}

function DashboardPage() {
  const navigate = useNavigate()

  const cards = [
    {
      key: 'control',
      title: 'CONTROL',
      subtitle: 'Live match state input',
      accent: '#7c3aed',
      open: () => navigate('/control'),
      copy: () => copy(`http://${SERVER_ADDRESS}/`)
    },
    {
      key: 'controlbang',
      title: 'CONTROLBANG',
      subtitle: 'Quick actions (placeholder)',
      accent: '#a855f7',
      open: () => navigate('/control'),
      copy: () => copy(`http://${SERVER_ADDRESS}/`)
    },
    {
      key: 'drawcontrol',
      title: 'DRAWCONTROL',
      subtitle: 'Layout tools (placeholder)',
      accent: '#22c55e',
      open: () => navigate('/display'),
      copy: () => copy(`http://${SERVER_ADDRESS}/overlay/?id=default_draft`)
    },
    {
      key: 'display',
      title: 'DISPLAY OVERLAY',
      subtitle: 'OBS renderer link',
      accent: '#60a5fa',
      open: () => navigate('/display'),
      copy: () => copy(`http://${SERVER_ADDRESS}/overlay/?id=default_draft`)
    }
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="text-xs font-semibold tracking-[0.22em] text-white/50">MLBB BROADCAST SUITE</div>
        <div className="mt-2 text-2xl font-extrabold text-white">Central Hub</div>
        <div className="mt-1 text-sm text-white/60">Server: {SERVER_ADDRESS}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <HubCard
            key={c.key}
            title={c.title}
            subtitle={c.subtitle}
            accent={c.accent}
            onOpen={c.open}
            onCopy={c.copy}
          />
        ))}
      </div>
    </div>
  )
}

function DisplayOverlayPage() {
  const overlayUrl = `http://${SERVER_ADDRESS}/overlay/?id=default_draft`

  return (
    <div className="p-6">
      <div className="text-2xl font-extrabold text-white">Display Overlay</div>
      <div className="mt-2 text-sm text-white/60">Use this URL in OBS (Browser Source):</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">{overlayUrl}</code>
        <button
          type="button"
          onClick={() => copy(overlayUrl)}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
        >
          COPY IP
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-dvh bg-[#0f0c15]">
      <Sidebar serverAddress={SERVER_ADDRESS} onCopyServer={(v) => copy(`http://${v}`)} />

      <main className="ml-[280px] min-h-dvh">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/control" element={<ControlPanel />} />
          <Route path="/display" element={<DisplayOverlayPage />} />
        </Routes>
      </main>
    </div>
  )
}
