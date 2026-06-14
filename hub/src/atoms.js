export const ATOMS = [
  { atom: 'T1_NAME', label: 'T1_Name', kind: 'text' },
  { atom: 'T1_SCORE', label: 'T1_Score', kind: 'text' },
  { atom: 'T1_PLAYER_NAME', label: 'T1_Player_Name', kind: 'text', needsIdx: true },
  { atom: 'T1_PICK', label: 'T1_Hero_Pick', kind: 'image', needsIdx: true },
  { atom: 'T1_BAN', label: 'T1_Hero_Ban', kind: 'image', needsIdx: true },
  { atom: 'T1_LOGO', label: 'T1_Logo', kind: 'image' },

  { atom: 'T2_NAME', label: 'T2_Name', kind: 'text' },
  { atom: 'T2_SCORE', label: 'T2_Score', kind: 'text' },
  { atom: 'T2_PLAYER_NAME', label: 'T2_Player_Name', kind: 'text', needsIdx: true },
  { atom: 'T2_PICK', label: 'T2_Hero_Pick', kind: 'image', needsIdx: true },
  { atom: 'T2_BAN', label: 'T2_Hero_Ban', kind: 'image', needsIdx: true },
  { atom: 'T2_LOGO', label: 'T2_Logo', kind: 'image' },

  { atom: 'MAP', label: 'Map_Icon', kind: 'image' }
]

export function isTextAtom(atom) {
  const a = String(atom || '')
  return a.includes('NAME') || a.includes('SCORE') || a === 'CUSTOM_TEXT'
}

export function getThemeFontSize(atom, theme) {
  const typography = theme?.typography && typeof theme.typography === 'object' ? theme.typography : {}
  const multiplier = Number(typography.fontSizeMultiplier)
  const mult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  const a = String(atom || '')

  if (a.includes('PLAYER_NAME')) {
    const base = Number(typography.playerNameSize)
    return Math.round((Number.isFinite(base) && base > 0 ? base : 24) * mult)
  }
  if (a.includes('SCORE')) {
    const base = Number(typography.scoreSize)
    return Math.round((Number.isFinite(base) && base > 0 ? base : 40) * mult)
  }
  if (a.includes('NAME')) {
    const base = Number(typography.teamNameSize)
    return Math.round((Number.isFinite(base) && base > 0 ? base : 32) * mult)
  }
  return Math.round(16 * mult)
}

export function getThemeFontFamily(theme) {
  const typography = theme?.typography && typeof theme.typography === 'object' ? theme.typography : {}
  const fallback = String(typography.defaultFontFamily || 'Arial, sans-serif')
  if (typography.useCustomFont && String(typography.fontFile || '').trim()) {
    return `'MLBBThemeFont', ${fallback}`
  }
  return fallback
}

function clampSpawnDim(n, min, max) {
  const x = Number.isFinite(n) ? n : min
  return Math.max(min, Math.min(max, Math.round(x)))
}

export function proportionalSizeForTextAtom(atom, theme) {
  const fontSize = getThemeFontSize(atom, theme)
  const a = String(atom || '')

  let widthMult = 3.5
  const heightMult = 1.4

  if (a.includes('PLAYER_NAME')) {
    widthMult = 6
  } else if (a.includes('NAME')) {
    widthMult = 8
  } else if (a.includes('SCORE')) {
    widthMult = 3.5
  }

  return {
    width: clampSpawnDim(fontSize * widthMult, 10, 1920),
    height: clampSpawnDim(fontSize * heightMult, 10, 1080),
  }
}

export function spawnSizeForAtom(atom, theme) {
  if (isTextAtom(atom)) {
    return proportionalSizeForTextAtom(atom, theme)
  }
  return defaultSizeForAtom(atom)
}

export function defaultSizeForAtom(atom) {
  const a = String(atom || '')
  if (a.includes('PICK') || a.includes('BAN')) return { width: 120, height: 120 }
  if (a.includes('LOGO')) return { width: 120, height: 120 }
  if (a === 'MAP') return { width: 160, height: 90 }
  if (a.includes('SCORE')) return { width: 80, height: 40 }
  return { width: 260, height: 40 }
}

export function newInstanceId(atom) {
  const safe = String(atom || 'ATOM').replace(/[^a-zA-Z0-9_\-]/g, '_')
  return `${safe}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}
