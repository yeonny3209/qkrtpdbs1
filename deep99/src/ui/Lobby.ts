/* ==================================================================
   로비 — 런과 런 사이 (§16.3)

   직책을 하나 고른다. 이 게임의 리플레이 핵심이다.

   §16.3 의 해금 원칙: **전투력을 직접 주지 않는다.** 전부 "초반 20분을
   단축"하는 특전이다. 반복의 지루함만 줄이고 게임을 쉽게 만들지는
   않는다.

   §18 의 화폐 가성비도 여기서 지킨다 — 블랙박스는 1런에 200~500 이
   확실히 들어오므로, 3~5런이면 직책 하나를 산다. 원작의 "다이아가
   너무 안 나온다" 문제를 피하려는 것이다.
   ================================================================== */
import { BALANCE, JOBS } from '../data/index.ts'
import { randomSeed, normalizeSeed } from '../core/RNG.ts'
import { pickModifier } from '../core/GameState.ts'
import type { SaveData } from '../core/SaveData.ts'

export type LobbyResult = { seed: string; jobId: string; modifierId: string }

export class Lobby {
  private seed = randomSeed()
  private rerolls = 0
  private jobId = 'pilot'

  constructor(
    private root: HTMLElement,
    private data: SaveData,
    private onStart: (r: LobbyResult) => void,
    private onSave: (d: SaveData) => void,
  ) {}

  private currentModifier() {
    /* 리롤은 시드를 안 바꾼다 — 같은 행성에서 날씨만 다시 뽑는 셈이라
       스피드런 시드를 유지한 채 변수를 고를 수 있다. */
    return this.rerolls === 0 ? pickModifier(this.seed) : pickModifier(`${this.seed}#${this.rerolls}`)
  }

  show(): void {
    if (!this.data.jobs.includes(this.jobId)) this.jobId = 'pilot'
    this.render()
  }

  private render(): void {
    const mod = this.currentModifier()
    const d = this.data

    const jobCards = JOBS.map((j) => {
      const owned = d.jobs.includes(j.id)
      const afford = d.blackbox >= j.cost
      const selected = this.jobId === j.id
      const cls = selected ? 'card selected' : owned ? 'card owned' : afford ? 'card' : 'card disabled'
      const action = owned ? `data-pick="${j.id}"` : afford ? `data-buy="${j.id}"` : ''
      return `<div class="${cls}" ${action}>
        <div class="name">${j.name}${selected ? ' ◂ 선택' : ''}</div>
        <div class="desc">${j.desc}</div>
        <div class="cost">${owned ? '보유' : `블랙박스 ${j.cost}`}</div>
      </div>`
    }).join('')

    const board = d.leaderboard.length
      ? `<table class="board">
          <tr><th>#</th><th>시드</th><th>직책</th><th>변수</th><th>시간</th><th>랭크</th></tr>
          ${d.leaderboard.map((r, i) => `<tr>
            <td>${i + 1}</td><td>${r.seed}</td><td>${r.job}</td><td>${r.modifier}</td>
            <td>${r.minutes}분</td><td style="color:var(--glow)">${r.rank}</td></tr>`).join('')}
        </table>`
      : '<div class="sub">아직 탈출 기록이 없습니다.</div>'

    this.root.innerHTML = `
      <div class="panel"><div class="panel-inner">
        <h2>행성에서의 99일</h2>
        <div class="sub">지구 귀환선 KEPLER-7 피격. 승무원 4명 실종. 궤도 정렬까지 99일.</div>

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

        <div class="section-title">탑승 직책 · 전부 초반을 줄이는 특전입니다</div>
        <div class="grid cols-3">${jobCards}</div>

        <div class="section-title">기록</div>
        <div class="row" style="font-family:var(--mono);font-size:12px;color:var(--muted)">
          <span>시도 ${d.runs}회</span><span>최고 ${d.bestDay}일</span><span>탈출 ${d.escapes}회</span>
        </div>
        <div style="margin-top:10px">${board}</div>

        <div class="row" style="margin-top:24px">
          <button class="btn primary" id="start">불시착 지점으로 (E)</button>
          <div class="spacer"></div>
          <span class="sub" style="margin:0">WASD 이동 · Shift 달리기(배고픔 3배) · E 상호작용 · Tab 가방</span>
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
    this.root.querySelectorAll<HTMLElement>('[data-pick]').forEach((el) => {
      el.addEventListener('click', () => {
        this.jobId = el.dataset.pick!
        this.render()
      })
    })
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.buy!
        const def = JOBS.find((j) => j.id === id)
        if (!def || this.data.blackbox < def.cost) return
        this.data = {
          ...this.data,
          blackbox: this.data.blackbox - def.cost,
          jobs: [...this.data.jobs, id],
        }
        this.jobId = id
        this.onSave(this.data)
        this.render()
      })
    })
    q('start').addEventListener('click', () => this.start())
  }

  start(): void {
    this.onStart({ seed: this.seed, jobId: this.jobId, modifierId: this.currentModifier().id })
  }

  update(data: SaveData): void {
    this.data = data
  }

  hide(): void {
    this.root.innerHTML = ''
  }
}
