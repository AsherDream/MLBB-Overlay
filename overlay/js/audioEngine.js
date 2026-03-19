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
              console.log('✅ [Audio Engine] Browser audio unlocked')
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
    console.log('🎥 [Audio Engine] OBS detected → autoplay enabled')
  }
}

// heroId should be the raw hero name/id from match state (renderer will decide gating)
export function playHeroAudio(heroId, isPick) {
  // Block audio if browser not unlocked yet
  if (!window.__audioUnlocked) return
  if (!currentAudioConfig || !currentAudioConfig.enabled) return

  const volMultiplier = isPick ? currentAudioConfig.pick : currentAudioConfig.ban
  const finalVolume = Math.max(0, Math.min(1, currentAudioConfig.master * volMultiplier))

  if (finalVolume <= 0) return

  try {
    const heroIdNorm = String(heroId || '').trim().toLowerCase()
    if (!heroIdNorm || heroIdNorm === 'none') return

    // Anti-spam (300ms throttle)
    const now = Date.now()
    const last = lastPlayedAudio.get(heroIdNorm) || 0
    if (now - last < 300) return
    lastPlayedAudio.set(heroIdNorm, now)

    const audio = new Audio()
    audio.volume = finalVolume

    const oggSrc = `${SERVER_URL}/Assets/VoiceLines/${encodeURIComponent(heroIdNorm)}.ogg`
    const mp3Src = `${SERVER_URL}/Assets/VoiceLines/${encodeURIComponent(heroIdNorm)}.mp3`

    audio.src = oggSrc

    audio.play().then(() => {
      console.log(`[Audio] Playing: ${heroIdNorm}`)
    }).catch((err) => {
      // If Chrome blocked it, DON'T try the mp3. Just warn the user.
      if (err.name === 'NotAllowedError') {
        console.warn('🔇 [Audio Blocked]: You must CLICK anywhere on this Overlay page to unlock sound!')
        return
      }

      // If it was a 404 or missing file, THEN try the .mp3 fallback
      console.warn(`[Audio] .ogg missing for ${heroIdNorm}. Trying .mp3 fallback...`)
      audio.src = mp3Src
      audio.play().catch(() => console.error(`[Audio] Both formats missing for: ${heroIdNorm}`))
    })
  } catch {
    // ignore
  }
}

