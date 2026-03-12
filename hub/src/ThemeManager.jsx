import React, { useEffect, useState } from 'react'

const SERVER_URL = import.meta?.env?.VITE_SERVER_URL || 'http://localhost:3000'

const DEFAULT_THEME = {
  typography: {
    fontFile: '',
    useCustomFont: false,
    fontSizeMultiplier: 1.0
  },
  images: {
    heroPickBg: '',
    lowerBg: '',
    lowerMidBg: '',
    masterFrame: ''
  },
  colors: {
    bluePrimary: '#00d2ff',
    blueDark: '#003e4d',
    redPrimary: '#ff2a2a',
    redDark: '#4d0000',
    scoreBlue: '#00d2ff',
    scoreRed: '#ff2a2a',
    playerName: '#ffffff',
    phaseText: '#ffffff',
    auraBan: '#ff0000',
    auraPick: '#ffffff'
  },
  animations: {
    banType: 'pulse',
    pickType: 'fade',
    heroAnim: 'slam'
  },
  toggles: {
    disableGlow: false,
    hidePattern: false,
    disableBoxShadow: false
  }
}

function ImageUploader({ label, themeKey, value, onChange }) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'image')
    formData.append('key', themeKey)
    setUploading(true)
    try {
      const res = await fetch(`${SERVER_URL}/api/theme-upload`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onChange?.(data.filename)
    } catch (e) {
      console.error('Image upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
      <span className="text-xs font-bold text-white/80">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={handleFile}
          disabled={uploading}
          className="text-xs text-white/60 file:mr-2 file:py-1"
        />
        {uploading && <span className="text-xs text-white/60">Uploading...</span>}
        {value && <span className="text-xs text-white/60 truncate max-w-24">{value}</span>}
      </div>
    </label>
  )
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
      <span className="text-xs font-bold text-white/80">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-16 h-8 rounded border border-white/10"
      />
    </label>
  )
}

function FontUploader({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'font')
    formData.append('key', 'typography.fontFile')
    setUploading(true)
    try {
      const res = await fetch(`${SERVER_URL}/api/theme-upload`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onChange?.(data.filename)
    } catch (e) {
      console.error('Font upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
      <span className="text-xs font-bold text-white/80">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".otf,.ttf"
          onChange={handleFile}
          disabled={uploading}
          className="text-xs text-white/60 file:mr-2 file:py-1"
        />
        {uploading && <span className="text-xs text-white/60">Uploading...</span>}
        {value && <span className="text-xs text-white/60 truncate max-w-24">{value}</span>}
      </div>
    </label>
  )
}

export default function ThemeManager() {
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [activeTab, setActiveTab] = useState('colors')

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch(`${SERVER_URL}/api/theme`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        setTheme(data.theme || DEFAULT_THEME)
      } catch {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const updateTheme = async (next) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      })
      if (!res.ok) throw new Error('Theme save failed')
      const data = await res.json()
      setTheme(data.theme || next)
    } catch (e) {
      console.error('Theme update error:', e)
    }
  }

  const resetTheme = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/theme-reset`, { method: 'POST' })
      if (!res.ok) throw new Error('Theme reset failed')
      const data = await res.json()
      setTheme(data.theme || DEFAULT_THEME)
    } catch (e) {
      console.error('Theme reset error:', e)
    }
  }

  const setNested = (section, field, value) => {
    setTheme((prev) => {
      const next = { ...prev }
      if (!next[section]) next[section] = {}
      next[section][field] = value
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold tracking-[0.22em] text-white/50">THEME MANAGER</div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('colors')}
            className={`px-3 py-1 text-xs font-bold rounded transition ${
              activeTab === 'colors' ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-white/60'
            }`}
          >
            Colors
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className={`px-3 py-1 text-xs font-bold rounded transition ${
              activeTab === 'typography' ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-white/60'
            }`}
          >
            Typography
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-3 py-1 text-xs font-bold rounded transition ${
              activeTab === 'images' ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-white/60'
            }`}
          >
            Images
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={resetTheme} className="px-3 py-1 text-xs font-bold rounded bg-white/10 text-white/60 hover:bg-white/15">
            Reset
          </button>
          <button onClick={() => updateTheme(theme)} className="px-3 py-1 text-xs font-bold rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9]">
            Apply
          </button>
        </div>
      </div>

      {activeTab === 'colors' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ColorInput label="Blue Primary" value={theme.colors?.bluePrimary} onChange={(v) => setNested('colors', 'bluePrimary', v)} />
          <ColorInput label="Blue Dark" value={theme.colors?.blueDark} onChange={(v) => setNested('colors', 'blueDark', v)} />
          <ColorInput label="Red Primary" value={theme.colors?.redPrimary} onChange={(v) => setNested('colors', 'redPrimary', v)} />
          <ColorInput label="Red Dark" value={theme.colors?.redDark} onChange={(v) => setNested('colors', 'redDark', v)} />
          <ColorInput label="Score Blue" value={theme.colors?.scoreBlue} onChange={(v) => setNested('colors', 'scoreBlue', v)} />
          <ColorInput label="Score Red" value={theme.colors?.scoreRed} onChange={(v) => setNested('colors', 'scoreRed', v)} />
          <ColorInput label="Player Name" value={theme.colors?.playerName} onChange={(v) => setNested('colors', 'playerName', v)} />
          <ColorInput label="Phase Text" value={theme.colors?.phaseText} onChange={(v) => setNested('colors', 'phaseText', v)} />
          <ColorInput label="Aura Ban" value={theme.colors?.auraBan} onChange={(v) => setNested('colors', 'auraBan', v)} />
          <ColorInput label="Aura Pick" value={theme.colors?.auraPick} onChange={(v) => setNested('colors', 'auraPick', v)} />
        </div>
      )}

      {activeTab === 'typography' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <span className="text-xs font-bold text-white/80">Use Custom Font</span>
            <input
              type="checkbox"
              checked={theme.typography?.useCustomFont}
              onChange={(e) => setNested('typography', 'useCustomFont', e.target.checked)}
              className="w-4 h-4"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f0c15] px-3 py-2">
            <span className="text-xs font-bold text-white/80">Font Size Multiplier</span>
            <input
              type="number"
              min="0.5"
              max="3"
              step="0.1"
              value={theme.typography?.fontSizeMultiplier}
              onChange={(e) => setNested('typography', 'fontSizeMultiplier', Number(e.target.value))}
              className="w-20 h-9 rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <FontUploader
            label="Font File"
            value={theme.typography?.fontFile}
            onChange={(v) => setNested('typography', 'fontFile', v)}
          />
        </div>
      )}

      {activeTab === 'images' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ImageUploader
            label="Hero Pick BG"
            themeKey="images.heroPickBg"
            value={theme.images?.heroPickBg}
            onChange={(v) => setNested('images', 'heroPickBg', v)}
          />
          <ImageUploader
            label="Lower BG"
            themeKey="images.lowerBg"
            value={theme.images?.lowerBg}
            onChange={(v) => setNested('images', 'lowerBg', v)}
          />
          <ImageUploader
            label="Lower Mid BG"
            themeKey="images.lowerMidBg"
            value={theme.images?.lowerMidBg}
            onChange={(v) => setNested('images', 'lowerMidBg', v)}
          />
          <ImageUploader
            label="Master Frame"
            themeKey="images.masterFrame"
            value={theme.images?.masterFrame}
            onChange={(v) => setNested('images', 'masterFrame', v)}
          />
        </div>
      )}
    </div>
  )
}
