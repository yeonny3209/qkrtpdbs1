/* ==================================================================
   소리 — 파일 없이 합성한다

   음원 파일을 쓰지 않는 건 이 저장소의 규칙이기도 하지만, 총소리는
   특히 합성이 잘 듣는다. 짧은 잡음 폭발에 저역 통과를 걸면 "탕"이
   되고, 통과 주파수와 길이만 바꾸면 권총·소총·샷건이 갈린다.

   브라우저는 사용자가 뭔가 누르기 전에는 소리를 못 내게 한다.
   그래서 AudioContext 는 시작 버튼을 누르는 순간에 만든다.
   ================================================================== */

let ctx = null
let master = null
let noiseBuf = null

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AC) return null

  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(ctx.destination)

  /* 1초짜리 백색잡음. 총소리·발소리·피격음이 전부 여기서 나온다. */
  const n = ctx.sampleRate
  noiseBuf = ctx.createBuffer(1, n, n)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1

  return ctx
}

export function setVolume(v) {
  if (master) master.gain.value = Math.max(0, Math.min(1, v))
}

export function isMuted() {
  return !master || master.gain.value === 0
}

function noise({ dur = 0.12, freq = 900, q = 1, gain = 0.5, type = 'lowpass', sweep = 0 }) {
  if (!ctx) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true

  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  if (sweep) {
    f.frequency.setValueAtTime(freq, ctx.currentTime)
    f.frequency.exponentialRampToValueAtTime(
      Math.max(60, freq * sweep), ctx.currentTime + dur,
    )
  }

  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur)

  src.connect(f); f.connect(g); g.connect(master)
  src.start()
  src.stop(ctx.currentTime + dur + 0.02)
}

function tone({ freq = 440, dur = 0.1, gain = 0.22, type = 'square', to = null, delay = 0 }) {
  if (!ctx) return
  const t0 = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur)

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  o.connect(g); g.connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

/* 무기마다 다른 "탕".

   총이 아홉 자루라 소리로도 갈려야 한다. 눈은 화면 한가운데를 보고
   있어서 손에 든 것이 뭔지 총소리로 먼저 안다. 큰 총일수록 낮고
   길게, 빠른 총일수록 짧고 높게 잡았다. */
const SHOT = {
  pistol: { dur: 0.13, freq: 1500, gain: 0.42, sweep: 0.25 },
  rifle: { dur: 0.085, freq: 2100, gain: 0.3, sweep: 0.3 },
  shotgun: { dur: 0.3, freq: 750, gain: 0.6, sweep: 0.15 },
  lmg: { dur: 0.075, freq: 1700, gain: 0.34, sweep: 0.28 },
  sniper: { dur: 0.42, freq: 900, gain: 0.72, sweep: 0.1 },
  smg: { dur: 0.055, freq: 2600, gain: 0.24, sweep: 0.35 },
  magnum: { dur: 0.24, freq: 1100, gain: 0.62, sweep: 0.18 },
}

/* 총소리에 얹는 저음. 무거운 총일수록 낮고 길게 울린다 */
const THUMP = {
  pistol: { f: 150, dur: 0.09, gain: 0.2 },
  rifle: { f: 140, dur: 0.09, gain: 0.2 },
  shotgun: { f: 90, dur: 0.14, gain: 0.28 },
  lmg: { f: 110, dur: 0.1, gain: 0.24 },
  sniper: { f: 62, dur: 0.32, gain: 0.4 },
  smg: { f: 190, dur: 0.05, gain: 0.14 },
  magnum: { f: 78, dur: 0.2, gain: 0.34 },
}

export const sfx = {
  shot(weapon) {
    /* 근접무기는 화약이 아니라 바람 소리다. 잡음을 높게 걸고 위에서
       아래로 훑으면 "휙" 이 된다. 도끼는 더 무겁고 느리게. */
    if (weapon === 'knife') {
      noise({ dur: 0.16, freq: 3400, gain: 0.3, q: 1.6, type: 'bandpass', sweep: 0.22 })
      return
    }
    if (weapon === 'axe') {
      noise({ dur: 0.3, freq: 1500, gain: 0.36, q: 1.1, type: 'bandpass', sweep: 0.16 })
      tone({ freq: 120, to: 55, dur: 0.18, gain: 0.16, type: 'sine' })
      return
    }
    const s = SHOT[weapon] || SHOT.pistol
    const th = THUMP[weapon] || THUMP.pistol
    noise({ ...s, q: 0.8 })
    tone({ freq: th.f, to: th.f * 0.32, dur: th.dur, gain: th.gain, type: 'sine' })
    /* 저격총은 여운이 남는다 — 큰 총이라는 걸 소리 길이로 알린다 */
    if (weapon === 'sniper') {
      noise({ dur: 0.5, freq: 420, gain: 0.16, q: 0.6, sweep: 0.35 })
    }
  },
  /* 칼이 살에 닿는 소리 — 총 명중음보다 둔탁하게 */
  meleeHit() {
    noise({ dur: 0.13, freq: 620, gain: 0.4, q: 1.1, sweep: 0.3 })
    tone({ freq: 190, to: 80, dur: 0.11, gain: 0.2, type: 'sawtooth' })
  },
  /* 명중은 짧고 마른 소리. 이게 있어야 맞혔는지 귀로 안다 */
  hit(isHeadshot) {
    tone({
      freq: isHeadshot ? 1500 : 780, to: isHeadshot ? 900 : 520,
      dur: 0.055, gain: 0.17, type: 'square',
    })
  },
  kill() {
    tone({ freq: 520, to: 190, dur: 0.16, gain: 0.2, type: 'triangle' })
    noise({ dur: 0.14, freq: 500, gain: 0.2, sweep: 0.3 })
  },
  hurt() {
    noise({ dur: 0.22, freq: 380, gain: 0.45, sweep: 0.25 })
    tone({ freq: 130, to: 60, dur: 0.2, gain: 0.2, type: 'sawtooth' })
  },
  reload() {
    noise({ dur: 0.05, freq: 2600, gain: 0.22, type: 'highpass' })
    noise({ dur: 0.06, freq: 1800, gain: 0.2, type: 'highpass' })
    setTimeout(() => noise({ dur: 0.05, freq: 2200, gain: 0.24, type: 'highpass' }), 260)
  },
  empty() {
    noise({ dur: 0.04, freq: 3200, gain: 0.16, type: 'highpass' })
  },
  pickup() {
    tone({ freq: 620, dur: 0.09, gain: 0.16, type: 'triangle' })
    tone({ freq: 830, dur: 0.09, gain: 0.16, type: 'triangle', delay: 0.07 })
    tone({ freq: 1120, dur: 0.13, gain: 0.16, type: 'triangle', delay: 0.14 })
  },
  waveStart(wave) {
    const base = 220 + Math.min(6, wave) * 12
    tone({ freq: base, dur: 0.3, gain: 0.16, type: 'sawtooth' })
    tone({ freq: base * 1.5, dur: 0.3, gain: 0.12, type: 'sawtooth', delay: 0.06 })
  },
  waveClear() {
    ;[523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.2, gain: 0.15, type: 'triangle', delay: i * 0.08 }))
  },
  gameOver() {
    ;[440, 349, 262, 175].forEach((f, i) =>
      tone({ freq: f, dur: 0.42, gain: 0.2, type: 'sawtooth', delay: i * 0.14 }))
  },
  enemyShot() {
    noise({ dur: 0.07, freq: 1100, gain: 0.14, sweep: 0.4 })
  },
}
