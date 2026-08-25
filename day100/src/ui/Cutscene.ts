/* ==================================================================
   컷씬 — 시작과 끝

   §16.4 대로 이륙은 "전체 뮤트 → 엔진음 상승 → 정적"이다. 소리를
   안 쓰는 화면에서도 같은 리듬을 지키려고, 글자를 한 줄씩 늦게
   띄우고 마지막에 한 박자 비운다.
   ================================================================== */

export type CutsceneKind = 'crash' | 'escape'

const SCRIPTS: Record<CutsceneKind, { title: string; lines: string[]; button: string }> = {
  crash: {
    title: 'DAY 001',
    lines: [
      '항로에서 벗어난 지 나흘째.',
      '소행성대가 선체를 갈랐다.',
      '',
      '이름 없는 행성. 산소는 우주복 안에만 있다.',
      '구조 신호는 100일 뒤 궤도가 맞아야 닿는다.',
      '',
      '해가 지기 전에 불을 피워야 한다.',
    ],
    button: '착륙 (E)',
  },
  escape: {
    title: '귀환',
    lines: [
      '엔진이 돌았다.',
      '',
      '행성이 발밑에서 멀어진다.',
      '어둠 속에서 무언가가 아직 따라오고 있었지만,',
      '이제는 닿지 않는다.',
      '',
      '지구까지, 나흘.',
    ],
    button: '기록 보기 (E)',
  },
}

export class Cutscene {
  private timer = 0
  private kind: CutsceneKind = 'crash'
  private done: (() => void) | null = null

  constructor(private root: HTMLElement) {}

  play(kind: CutsceneKind, onDone: () => void): void {
    this.kind = kind
    this.timer = 0
    this.done = onDone
    this.render()
  }

  /** 글자가 한 줄씩 나타난다. 루프에서 불러 준다. */
  tick(dt: number): void {
    if (!this.done) return
    const before = Math.floor(this.timer / 0.55)
    this.timer += dt
    if (Math.floor(this.timer / 0.55) !== before) this.render()
  }

  private render(): void {
    const script = SCRIPTS[this.kind]
    const shown = Math.floor(this.timer / 0.55)
    const lines = script.lines
      .map((l, i) => `<div style="opacity:${i < shown ? 1 : 0};transition:opacity .5s">${l || '&nbsp;'}</div>`)
      .join('')
    const ready = shown >= script.lines.length

    this.root.innerHTML = `
      <div class="cinema">
        <div>
          <h1>${script.title}</h1>
          <p>${lines}</p>
          <div style="margin-top:34px;opacity:${ready ? 1 : 0};transition:opacity .5s">
            <button class="btn primary" id="cut-next">${script.button}</button>
          </div>
        </div>
      </div>`

    if (ready) {
      this.root.querySelector('#cut-next')?.addEventListener('click', () => this.finish())
    }
  }

  /** E 로도 넘어간다. 두 번째 런부터는 컷씬이 방해가 된다. */
  skip(): void {
    const script = SCRIPTS[this.kind]
    if (this.timer < script.lines.length * 0.55) {
      this.timer = script.lines.length * 0.55
      this.render()
      return
    }
    this.finish()
  }

  private finish(): void {
    const cb = this.done
    this.done = null
    this.root.innerHTML = ''
    cb?.()
  }

  get active(): boolean {
    return this.done !== null
  }
}
