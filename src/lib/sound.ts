import type { Mode } from './songs'

const KEY = 'reprise.sound'
let ctx: AudioContext | null = null

export const soundOn = () => localStorage.getItem(KEY) !== 'off'
export const setSoundOn = (on: boolean) => localStorage.setItem(KEY, on ? 'on' : 'off')

/** Plays the note for a piano key, or its triad when a mode is given. Silent if sound is off. */
export function playKey(pc: number, mode: Mode | null) {
  if (!soundOn()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const root = 261.63 * 2 ** (pc / 12) // C4 up to B4
    const steps = mode === 'major' ? [0, 4, 7] : mode === 'minor' ? [0, 3, 7] : [0]
    steps.forEach((step, i) => {
      const start = ctx!.currentTime + i * 0.06
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'triangle'
      osc.frequency.value = root * 2 ** (step / 12)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(start)
      osc.stop(start + 1.25)
    })
  } catch {
    /* audio unavailable; the picker still works */
  }
}
