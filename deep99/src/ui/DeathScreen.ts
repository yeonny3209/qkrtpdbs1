/* ==================================================================
   사망 화면 · 엔딩 화면 (§17.2, §17.4)

   중요한 건 **무엇을 잃었는지가 아니라 무엇을 얻었는지**를 보여 주는
   것이다. 로그라이크에서 죽음이 벌처럼 느껴지면 다시 안 한다.

   엔딩은 셋으로 갈린다 — 정시에 대원 전원이면 완전 귀환, 일부면 부분
   귀환, 124일 이후면 지연 귀환. 대원을 구할 이유가 날짜 가속만이
   아니게 된다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { CREW } from '../data/index.ts'
import { blackboxGain, rankFor, DEATH_TEXT, endingFor, ENDING_TEXT } from '../systems/RunSystem.ts'
import { crewDef } from '../entities/Crew.ts'

export class EndScreen {
  constructor(private root: HTMLElement) {}

  showDeath(s: GameState, onBack: () => void): void {
    const gain = blackboxGain(s)
    this.root.innerHTML = `
      <div class="cinema"><div>
        <h1 class="deathline">신호 두절</h1>
        <p>
          <div>DAY ${String(s.day).padStart(3, '0')} 에서 종료</div>
          <div>사인: ${DEATH_TEXT[s.death.cause ?? 'suit'] ?? '알 수 없음'}</div>
        </p>
        <div style="margin-top:24px" class="stat">
          <div>캠프파이어 최고 레벨 &nbsp; <b>${s.campfire.maxReachedLevel}</b></div>
          <div>구출한 대원 &nbsp; <b>${s.crew.length}</b></div>
          <div>제작 모듈 레벨 &nbsp; <b>${s.moduleLevel}</b></div>
          <div style="margin-top:12px">블랙박스 데이터 &nbsp; <b>+${gain}</b></div>
        </div>
        <div style="margin-top:30px"><button class="btn primary" id="back">로비로 (E)</button></div>
      </div></div>`
    this.root.querySelector('#back')?.addEventListener('click', onBack)
  }

  showEscape(s: GameState, onBack: () => void): void {
    const minutes = s.elapsed / 60
    const rank = rankFor(minutes)
    const gain = blackboxGain(s)
    const ending = endingFor(s)
    const text = ENDING_TEXT[ending]
    const left = CREW.filter((c) => !s.crew.includes(c.id))

    this.root.innerHTML = `
      <div class="cinema"><div>
        <h1 style="color:var(--glow)">${text.title}</h1>
        <div class="rank">${rank}</div>
        <p>
          <div>${text.line}</div>
          <div>DAY ${s.day} · 실시간 ${minutes.toFixed(1)}분</div>
          ${left.length > 0
            ? `<div style="color:var(--spider)">남겨진 대원: ${left.map((c) => crewDef(c.id)?.name).join(', ')}</div>`
            : ''}
        </p>
        <div style="margin-top:20px" class="stat">
          <div>시드 ${s.seed} · ${s.job.name} · ${s.modifier.name}</div>
          <div>캠프파이어 최고 <b>Lv${s.campfire.maxReachedLevel}</b> · 소행성 피격 <b>${s.asteroidFailures}</b>/${s.allowedFailures}</div>
          <div style="margin-top:12px">블랙박스 데이터 &nbsp; <b>+${gain}</b></div>
        </div>
        <div style="margin-top:30px"><button class="btn primary" id="back">로비로 (E)</button></div>
      </div></div>`
    this.root.querySelector('#back')?.addEventListener('click', onBack)
  }

  hide(): void {
    this.root.innerHTML = ''
  }
}
