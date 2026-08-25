/* ==================================================================
   로비 — 런과 런 사이

   §14.3 의 해금 설계 원칙이 중요하다: **전투력을 직접 주지 않는다.**
   전부 "초반 30분을 단축시키는" 물건이다. 반복의 지루함은 줄이되
   게임을 쉽게 만들지는 않는다.

   행성 변수(§14.4)는 시작 전에 보여 준다. 어떤 판인지 알고 들어가야
   빌드를 정할 수 있고, 마음에 안 들면 블랙박스 30 을 내고 다시 뽑는다.
   ================================================================== */
import { BALANCE, UNLOCKS } from '../data/index.ts'
import { randomSeed, normalizeSeed } from '../core/RNG.ts'
import { pickModifier } from '../core/GameState.ts'
import type { SaveData } from '../core/SaveData.ts'

export type LobbyResult = { seed: string; modifierId: string; unlocks: string[] }

export class Lobby {
  private seed = randomSeed()
  private rerolls = 0

  constructor(
    private root: HTMLElement,
    private data: SaveData,
    private onStart: (r: LobbyResult) => void,
    private onSave: (d: SaveData) => void,
  ) {}

  private currentModifier() {
    /* 리롤은 시드를 바꾸지 않는다 — 같은 행성에서 날씨만 다시 뽑는
       셈이라, 스피드런 시드를 유지한 채로 변수를 고를 수 있다. */
    return this.rerolls === 0
      ? pickModifier(this.seed)
      : pickModifier(`${this.seed}#${this.rerolls}`)
  }

  show(): void {
    this.render()
  }

  private render(): void {
    const mod = this.currentModifier()
    const d = this.data

    const unlockCards = UNLOCKS.map((u) => {
      const owned = d.unlocks.includes(u.id)
      const afford = d.blackbox >= u.cost
      const cls = owned ? 'card owned' : afford ? 'card' : 'card disabled'
      return `<div class="${cls}" ${owned || !afford ? '' : `data-unlock="${u.id}"`}>
        <div class="name">${u.name}${owned ? ' ✓' : ''}</div>
        <div class="desc">${u.desc}</div>
        <div class="cost ${afford || owned ? 'ok' : ''}">${owned ? '보유' : `블랙박스 ${u.cost}`}</div>
      </div>`
    }).join('')

    const board = d.leaderboard.length
      ? `<table class="board">
          <tr><th>#</th><th>시드</th><th>변수</th><th>시간</th><th>랭크</th></tr>
          ${d.leaderboard.map((r, i) => `<tr>
            <td>${i + 1}</td><td>${r.seed}</td><td>${r.modifier}</td>
            <td>${r.minutes}분</td><td style="color:var(--glow)">${r.rank}</td>
          </tr>`).join('')}
        </table>`
      : '<div class="sub">아직 탈출 기록이 없습니다.</div>'

    this.root.innerHTML = `
      <div class="panel"><div class="panel-inner">
        <h2>DAY 100</h2>
        <div class="sub">불시착한 조종사. 100일 안에 탈출선을 재조립해야 합니다.</div>

        <div class="row">
          <span class="section-title" style="margin:0">시드</span>
          <input class="seed" id="seed-input" value="${this.seed}" maxlength="16" />
          <button class="btn" id="seed-random">무작위</button>
          <div class="spacer"></div>
          <span class="section-title" style="margin:0">블랙박스</span>
          <span style="font-family:var(--mono);color:var(--glow);font-size:19px">${d.blackbox}</span>
        </div>

        <div class="section-title">이번 행성</div>
        <div class="card owned" style="cursor:default">
          <div class="name">${mod.name} <span style="color:var(--muted);font-weight:400">· 블랙박스 ×${mod.multiplier}</span></div>
          <div class="desc">${mod.desc}</div>
        </div>
        <div class="row" style="margin-top:9px">
          <button class="btn ghost" id="reroll" ${d.blackbox < BALANCE.blackbox.rerollCost ? 'disabled' : ''}>
            다시 뽑기 (블랙박스 ${BALANCE.blackbox.rerollCost})
          </button>
        </div>

        <div class="section-title">영구 해금 · 전부 초반을 줄이는 물건입니다</div>
        <div class="grid cols-3">${unlockCards}</div>

        <div class="section-title">기록</div>
        <div class="row" style="font-family:var(--mono);font-size:12px;color:var(--muted)">
          <span>시도 ${d.runs}회</span><span>최고 ${d.bestDay}일</span><span>탈출 ${d.escapes}회</span>
        </div>
        <div style="margin-top:10px">${board}</div>

        <div class="row" style="margin-top:26px">
          <button class="btn primary" id="start">착륙 지점으로 (E)</button>
          <div class="spacer"></div>
          <span class="sub" style="margin:0">WASD 이동 · Shift 달리기 · E 상호작용 · Tab 가방</span>
        </div>
      </div></div>`

    this.bind()
  }

  private bind(): void {
    const q = <T extends HTMLElement>(id: string) => this.root.querySelector(`#${id}`) as T

    q<HTMLInputElement>('seed-input').addEventListener('change', (e) => {
      this.seed = normalizeSeed((e.target as HTMLInputElement).value)
      this.rerolls = 0
      this.render()
    })
    q('seed-random').addEventListener('click', () => {
      this.seed = randomSeed()
      this.rerolls = 0
      this.render()
    })
    q('reroll').addEventListener('click', () => {
      if (this.data.blackbox < BALANCE.blackbox.rerollCost) return
      this.data = { ...this.data, blackbox: this.data.blackbox - BALANCE.blackbox.rerollCost }
      this.rerolls++
      this.onSave(this.data)
      this.render()
    })
    this.root.querySelectorAll<HTMLElement>('[data-unlock]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.unlock!
        const def = UNLOCKS.find((u) => u.id === id)
        if (!def || this.data.blackbox < def.cost) return
        this.data = {
          ...this.data,
          blackbox: this.data.blackbox - def.cost,
          unlocks: [...this.data.unlocks, id],
        }
        this.onSave(this.data)
        this.render()
      })
    })
    q('start').addEventListener('click', () => this.start())
  }

  start(): void {
    this.onStart({
      seed: this.seed,
      modifierId: this.currentModifier().id,
      unlocks: this.data.unlocks,
    })
  }

  update(data: SaveData): void {
    this.data = data
  }

  hide(): void {
    this.root.innerHTML = ''
  }
}
