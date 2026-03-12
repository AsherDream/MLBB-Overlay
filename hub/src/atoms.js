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
