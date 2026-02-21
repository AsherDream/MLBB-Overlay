import { NavLink } from 'react-router-dom'
import { Copy, LayoutDashboard, PanelsTopLeft, ScreenShare, Settings, Signal } from 'lucide-react'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Sidebar({ serverAddress = '192.168.1.190:3000', onCopyServer }) {
  return (
    <aside className="fixed left-0 top-0 z-50 h-dvh w-[280px] border-r border-white/10 bg-gradient-to-b from-[#1a1625] to-[#0f0c15]">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white/10">
            <PanelsTopLeft className="size-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-xs tracking-[0.22em] text-white/60">OVERLAY TOOL</div>
            <div className="text-sm font-semibold text-white">Central Hub</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Signal className="size-4 text-emerald-400" />
              <span className="text-xs font-medium text-white/80">SERVER STATUS</span>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">LIVE</span>
          </div>

          <div className="mt-2 text-sm font-semibold text-white">{serverAddress}</div>

          <button
            type="button"
            onClick={() => onCopyServer?.(serverAddress)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/15"
          >
            <Copy className="size-4" />
            COPY IP
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          <NavItem to="/" icon={LayoutDashboard} label="DASHBOARD" />
          <NavItem to="/control" icon={Settings} label="CONTROL PANEL" />
          <NavItem to="/display" icon={ScreenShare} label="DISPLAY OVERLAY" />
        </nav>

        <div className="mt-auto pt-6">
          <div className="text-xs text-white/40">MLBB Broadcast Suite</div>
        </div>
      </div>
    </aside>
  )
}

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition',
          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}
