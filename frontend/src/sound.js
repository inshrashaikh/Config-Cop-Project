/* Alert sounds via the Web Audio API — no audio files needed.
 *
 * Demo sounds: drift inject (alarm), scan result, fix verified (chime),
 * errors (buzz), self-heal events. Toggleable from the header; the choice is
 * remembered in localStorage. Browsers require a user gesture before audio can
 * play, so the context is created lazily and unlocked on the first click.
 */

let ctx = null
let enabled = localStorage.getItem('configcop-sound') !== 'off'

function ensureCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// unlock audio on the first interaction anywhere (browser autoplay policy)
if (typeof window !== 'undefined') {
  const unlock = () => { ensureCtx() }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

function tone({ freq = 660, end = null, dur = 0.12, at = 0, type = 'sine', gain = 0.16 }) {
  const c = ensureCtx()
  if (!c) return
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (end) osc.frequency.exponentialRampToValueAtTime(end, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function isSoundEnabled() {
  return enabled
}

export function setSoundEnabled(on) {
  enabled = !!on
  localStorage.setItem('configcop-sound', enabled ? 'on' : 'off')
  if (enabled) blip() // little "sound is on" feedback when enabling
}

/* ------------------------------------------------------------- presets */

/** drift injected / drift detected — two-tone alarm, gets attention */
export function alarm() {
  if (!enabled) return
  tone({ freq: 620, end: 480, dur: 0.18, type: 'square', gain: 0.12 })
  tone({ freq: 620, end: 480, dur: 0.18, type: 'square', gain: 0.12, at: 0.24 })
}

/** fix verified / self-heal restored — rising two-note chime */
export function success() {
  if (!enabled) return
  tone({ freq: 523, dur: 0.12, type: 'triangle', gain: 0.16 })           // C5
  tone({ freq: 784, dur: 0.18, type: 'triangle', gain: 0.16, at: 0.13 }) // G5
}

/** failure / crash / AI error — low double buzz */
export function errorBuzz() {
  if (!enabled) return
  tone({ freq: 220, end: 150, dur: 0.16, type: 'sawtooth', gain: 0.12 })
  tone({ freq: 220, end: 150, dur: 0.16, type: 'sawtooth', gain: 0.12, at: 0.2 })
}

/** clean scan / neutral info — single soft blip */
export function blip() {
  if (!enabled) return
  tone({ freq: 700, dur: 0.08, type: 'sine', gain: 0.12 })
}
