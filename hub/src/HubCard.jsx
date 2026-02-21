import { Copy, ExternalLink } from 'lucide-react'

export default function HubCard({
  title,
  subtitle,
  thumbnail,
  onOpen,
  onCopy,
  accent = '#7c3aed'
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-white/60">PANEL</div>
          <div className="mt-1 text-lg font-bold text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-white/55">{subtitle}</div> : null}
        </div>
        <div className="h-10 w-10 rounded-xl" style={{ background: `${accent}22`, border: `1px solid ${accent}33` }} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f0c15]">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="h-28 w-full object-cover opacity-90 transition group-hover:opacity-100" />
        ) : (
          <div className="h-28 w-full bg-gradient-to-br from-white/5 to-white/0" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
        >
          <ExternalLink className="size-4" />
          OPEN PANEL
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/5"
        >
          <Copy className="size-4" />
          COPY IP
        </button>
      </div>
    </div>
  )
}
