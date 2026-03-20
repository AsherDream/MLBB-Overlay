import { SERVER_URL } from './utils.js'

let currentAudioConfig = { enabled: true, master: 1, pick: 1, ban: 0.6 }
const lastPlayedAudio = new Map() // anti-spam

export function updateAudioConfig(cfg) {
  if (cfg && typeof cfg === 'object') {
    currentAudioConfig = { ...currentAudioConfig, ...cfg }
  }
}

// ─────────────────────────────────────────────
// 🔊 BROWSER AUDIO UNLOCKER (Production Safe)
// ─────────────────────────────────────────────
export function initAudioUnlocker() {
  // Global unlock flag
  window.__audioUnlocked = false

  try {
    // Persist unlock state across reloads (browser-only)
    if (localStorage?.getItem('__audioUnlocked') === '1') window.__audioUnlocked = true
  } catch {
    // ignore
  }

  // OBS Studio bypass (OBS has no autoplay restriction)
  if (!window.obsstudio) {
    if (!window.__audioUnlocked) {
      const unlockScreen = document.createElement('div')
      unlockScreen.id = 'audio-unlocker'

      unlockScreen.style.cssText = `
        position: absolute;
        inset: 0;
        z-index: 999999;
        background: rgba(15, 12, 21, 0.96);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        font-family: sans-serif;
        text-align: center;
      `

      unlockScreen.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">🔇</div>
        <h1 style="font-size: 32px; font-weight: bold; letter-spacing: 2px;">
          CLICK TO ENABLE AUDIO
        </h1>
        <p style="color: #a78bfa; margin-top: 10px;">
          (Only required in browser preview)
        </p>
      `

      document.body.appendChild(unlockScreen)

      unlockScreen.addEventListener('click', () => {
        try {
          const wakeAudio = new Audio(
            'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
          )

          wakeAudio.volume = 0.01

          wakeAudio
            .play()
            .then(() => {
              window.__audioUnlocked = true
              try {
                localStorage?.setItem('__audioUnlocked', '1')
              } catch {
                // ignore
              }
              // eslint-disable-next-line no-console
              unlockScreen.remove()
            })
            .catch(() => {
              // eslint-disable-next-line no-console
              console.warn('⚠️ Audio unlock attempt failed')
            })
        } catch {
          // ignore
        }
      })
    }
  } else {
    // OBS environment (no restriction)
    window.__audioUnlocked = true
    // eslint-disable-next-line no-console
  }
}

// heroId should be the raw hero name/id from match state (renderer will decide gating)
export function playHeroAudio(heroId, isPick) {
  if (!window.__audioUnlocked) {
    console.warn(`[AudioEngine] 🛑 Blocked: audio not unlocked`)
    return
  }

  if (!currentAudioConfig || !currentAudioConfig.enabled) {
    console.warn(`[AudioEngine] 🛑 Blocked: audio disabled`)
    return
  }

  const volMultiplier = isPick ? currentAudioConfig.pick : currentAudioConfig.ban
  const finalVolume = Math.max(0, Math.min(1, currentAudioConfig.master * volMultiplier))

  if (finalVolume <= 0) {
    console.warn(`[AudioEngine] 🛑 Blocked: volume = 0`)
    return
  }

  try {
    const cleanId = String(heroId || '').trim().toLowerCase()
    if (!cleanId || cleanId === 'none') return

    const now = Date.now()
    const last = lastPlayedAudio.get(cleanId) || 0
    if (now - last < 300) {
      console.warn(`[AudioEngine] 🛑 Anti-spam: ${cleanId}`)
      return
    }
    lastPlayedAudio.set(cleanId, now)

    const oggSrc = `${SERVER_URL}/Assets/VoiceLines/${encodeURIComponent(cleanId)}.ogg`
    const mp3Src = `${SERVER_URL}/Assets/VoiceLines/${encodeURIComponent(cleanId)}.mp3`

    const audio = new Audio()
    audio.volume = finalVolume
    audio.src = oggSrc

    audio.play().catch((err) => {
      if (err.name === 'NotAllowedError') {
        console.error('🔇 Chrome autoplay blocked')
        return
      }

      console.warn(`[AudioEngine] ⚠️ OGG failed → fallback to MP3`)

      audio.src = mp3Src
      audio.play().catch((e) => {
        console.error(`[AudioEngine] ❌ MP3 failed`, e)
      })
    })
  } catch (err) {
    console.error('[AudioEngine] 💥 Fatal:', err)
  }
}

