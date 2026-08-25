/* ==================================================================
   사망 화면 · 엔딩 화면

   §15.3 의 형태 그대로다. 중요한 건 **무엇을 잃었는지가 아니라
   무엇을 얻었는지**를 보여 주는 것이다. 로그라이크에서 죽음이
   벌처럼 느껴지면 다시 안 한다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { blackboxGain, rankFor, DEATH_TEXT } from '../systems/RunSystem.ts'

export class EndScreen {
  constructor(private root: HTMLElement) {}

  showDeath(s: GameState, onBack: () => void): void {
    const gain = blackboxGain(s)
    this.root.innerHTML = `
      <div class="cinema">
        <div>
          <h1 class="deathline">신호 두절</h1>
          <p>
            <div>DAY ${String(s.day).padStart(3, '0')} 에서 종료</div>
            <div>사인: ${DEATH_TEXT[s.death.cause ?? 'suit'] ?? '알 수 없음'}</div>
          </p>
          <div style="margin-top:26px" class="stat">
            <div>수집한 핵심 부품 &nbsp; <b>${s.coreParts.length}</b></div>
            <div>크래프팅 레벨 &nbsp; <b>${s.craftLevel}</b></div>
            <div>탈출 장비 &nbsp; <b>${s.escapeBuilt.length}</b> / 4</div>
            <div style="margin-top:12px">블랙박스 데이터 &nbsp; <b>+${gain}</b></div>
          </div>
          <div style="margin-top:32px">
            <button class="btn primary" id="back">로비로 (E)</button>
          </div>
        </div>
      </div>`
    this.root.querySelector('#back')?.addEventListener('click', onBack)
  }

  showEscape(s: GameState, onBack: () => void): void {
    const minutes = s.elapsed / 60
    const rank = rankFor(minutes)
    const gain = blackboxGain(s)
    this.root.innerHTML = `
      <div class="cinema">
        <div>
          <h1 style="color:var(--glow)">지구 귀환</h1>
          <div class="rank">${rank}</div>
          <p>
            <div>DAY ${s.day} · 실시간 ${minutes.toFixed(1)}분</div>
            <div>시드 ${s.seed} · ${s.modifier.name}</div>
          </p>
          <div style="margin-top:22px" class="stat">
            <div>소행성 피격 &nbsp; <b>${s.asteroidFailures}</b> / ${s.allowedFailures}</div>
            <div>블랙박스 데이터 &nbsp; <b>+${gain}</b></div>
          </div>
          <div style="margin-top:32px">
            <button class="btn primary" id="back">로비로 (E)</button>
          </div>
        </div>
      </div>`
    this.root.querySelector('#back')?.addEventListener('click', onBack)
  }

  hide(): void {
    this.root.innerHTML = ''
  }
}
