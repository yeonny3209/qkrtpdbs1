/* ==================================================================
   소리 — §16.4

   기획서는 Howler 를 적었지만 Web Audio 를 직접 쓴다. 이유가 둘이다.
   필요한 것이 공간 오디오와 로우패스 필터인데 그건 Web Audio 의
   기본 기능이고, 음원 파일이 하나도 없어서(전부 합성) 로더가 할 일이
   없다. 의존성 하나를 안 들이는 편이 낫다.

   §16.5 의 규칙이 더 중요하다 — **밤에는 BGM 이 없다.** 발소리와
   거미 소리만 남긴다. 침묵이 가장 무섭다.

   거미 소리는 거리 반비례 볼륨이고, 시야에 들어오기 전부터 들린다.
   보이지 않는데 소리가 커지는 것이 이 게임에서 가장 무서운 순간이다.
   ================================================================== */

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muffle: BiquadFilterNode | null = null
  private spiderOsc: OscillatorNode | null = null
  private spiderGain: GainNode | null = null
  enabled = true

  /** 브라우저는 사용자 제스처 전에는 소리를 안 낸다. 첫 클릭에 부른다. */
  resume(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        this.enabled = false
        return
      }
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.32
      this.muffle = this.ctx.createBiquadFilter()
      this.muffle.type = 'lowpass'
      this.muffle.frequency.value = 20000
      this.muffle.connect(this.master)
      this.master.connect(this.ctx.destination)
    }
    void this.ctx.resume()
  }

  /** 산소가 떨어지면 환경음이 먹먹해진다(§16.3) */
  setMuffle(amount: number): void {
    if (!this.muffle || !this.ctx) return
    const target = 20000 * (1 - amount) + 350 * amount
    this.muffle.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.2)
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    sweepTo?: number,
  ): void {
    if (!this.ctx || !this.muffle || !this.enabled) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.muffle)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, gain: number, filterHz: number): void {
    if (!this.ctx || !this.muffle || !this.enabled) return
    const t = this.ctx.currentTime
    const len = Math.floor(this.ctx.sampleRate * dur)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = filterHz
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(f)
    f.connect(g)
    g.connect(this.muffle)
    src.start(t)
  }

  play(event: string): void {
    switch (event) {
      case 'chop': this.noise(0.13, 0.28, 900); break
      case 'treeDown': this.noise(0.5, 0.34, 320); break
      case 'pickup': this.tone(720, 0.07, 'sine', 0.16, 980); break
      case 'grind': this.noise(0.42, 0.22, 620); break
      case 'craft': this.tone(520, 0.14, 'triangle', 0.2, 780); break
      case 'upgrade': this.tone(420, 0.3, 'triangle', 0.24, 840); break
      case 'gunshot': this.noise(0.11, 0.5, 1500); this.tone(140, 0.1, 'square', 0.22, 60); break
      case 'shotgun': this.noise(0.2, 0.6, 800); this.tone(90, 0.16, 'square', 0.3, 40); break
      case 'reload': this.tone(300, 0.06, 'square', 0.14); break
      case 'melee': this.noise(0.09, 0.24, 1200); break
      case 'beastHit': this.tone(180, 0.16, 'sawtooth', 0.24, 90); break
      case 'beastDown': this.tone(240, 0.34, 'sawtooth', 0.22, 70); break
      /* 우주복 파손 — 유리 균열 + 짧은 정적(§16.4) */
      case 'suitHit': this.noise(0.08, 0.3, 2600); break
      case 'eat': this.tone(380, 0.11, 'sine', 0.14, 500); break
      case 'fuelAdded': this.noise(0.28, 0.2, 420); break
      case 'campLevelUp': this.tone(330, 0.4, 'sine', 0.2, 660); break
      case 'torch': this.noise(0.34, 0.4, 700); this.tone(200, 0.3, 'sawtooth', 0.18, 420); break
      case 'flashlightDead': this.tone(220, 0.18, 'square', 0.12, 110); break
      case 'trap': this.noise(0.1, 0.36, 1800); break
      case 'armory': this.tone(180, 0.5, 'square', 0.2, 300); break
      case 'labEnter': this.tone(90, 0.7, 'square', 0.26, 60); break
      case 'labClear': this.tone(440, 0.5, 'triangle', 0.26, 880); break
      /* 밤 예고 — 낮은 사이렌 두 번 + 서브베이스 스윕(§16.4) */
      case 'nightWarning':
        this.tone(320, 0.55, 'sine', 0.2, 210)
        setTimeout(() => this.tone(320, 0.55, 'sine', 0.2, 210), 650)
        this.tone(70, 1.6, 'sine', 0.18, 34)
        break
      case 'nightFall': this.tone(58, 1.5, 'sine', 0.22, 30); break
      case 'sunrise': this.tone(300, 0.7, 'sine', 0.16, 520); break
      case 'spiderSpawn': this.tone(1400, 0.2, 'sawtooth', 0.08, 600); break
      case 'asteroidStart': this.tone(120, 0.8, 'sawtooth', 0.24, 300); break
      case 'asteroidHit': this.noise(0.3, 0.5, 300); this.tone(80, 0.3, 'square', 0.3, 40); break
      case 'asteroidClear': this.tone(400, 0.6, 'triangle', 0.24, 800); break
      case 'death': this.tone(200, 1.4, 'sine', 0.3, 40); break
      case 'escape': this.tone(160, 2.2, 'sawtooth', 0.28, 900); break
      case 'axeBroke': this.noise(0.2, 0.34, 1400); break
      case 'decay': break
      default: break
    }
  }

  /** 거미의 마찰음. 가까울수록 커진다 — 보이기 전부터 들린다. */
  spider(distance: number | null): void {
    if (!this.ctx || !this.muffle || !this.enabled) return
    if (distance === null) {
      if (this.spiderGain) this.spiderGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
      return
    }
    if (!this.spiderOsc) {
      this.spiderOsc = this.ctx.createOscillator()
      this.spiderGain = this.ctx.createGain()
      this.spiderOsc.type = 'sawtooth'
      this.spiderOsc.frequency.value = 62
      this.spiderGain.gain.value = 0
      this.spiderOsc.connect(this.spiderGain)
      this.spiderGain.connect(this.muffle)
      this.spiderOsc.start()
    }
    const near = Math.max(0, 1 - distance / 34)
    this.spiderGain!.gain.setTargetAtTime(near * near * 0.3, this.ctx.currentTime, 0.15)
    this.spiderOsc.frequency.setTargetAtTime(48 + near * 46, this.ctx.currentTime, 0.3)
  }
}
