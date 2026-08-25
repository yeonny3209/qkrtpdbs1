/* ==================================================================
   HUD — §3.2 레이아웃

   두 가지가 의도적으로 **없다**.

     - 시계를 안 만들었으면 남은 시간이 안 보인다. 하늘빛으로만
       판단해야 한다. 시계(고철 6)의 값어치가 여기서 생긴다.
     - 지도를 안 만들었으면 미니맵이 없다.

   UI 를 감추는 것이 아이템의 값어치를 만드는 가장 정직한 방법이다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { ITEMS } from '../data/index.ts'
import { phaseRemaining, dayRate, daysToAsteroid } from '../systems/TimeSystem.ts'
import { burnRemaining } from '../systems/CampfireSystem.ts'
import { compassTarget, remaining as labRemaining } from '../systems/LabSystem.ts'
import { totalStoredWood } from '../systems/InventorySystem.ts'
import type { Renderer } from '../render/Renderer.ts'

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type HudPrompt = { key: string; text: string } | null

export class HUD {
  private minimapCanvas: HTMLCanvasElement
  private minimapCtx: CanvasRenderingContext2D
  private expanded = false

  constructor(private root: HTMLElement) {
    root.innerHTML = TEMPLATE
    this.minimapCanvas = root.querySelector('#minimap') as HTMLCanvasElement
    this.minimapCtx = this.minimapCanvas.getContext('2d')!
  }

  setExpanded(v: boolean): void {
    this.expanded = v
    const wrap = this.root.querySelector('#minimap-wrap') as HTMLElement
    const size = v ? Math.min(window.innerHeight * 0.8, 640) : 148
    wrap.classList.toggle('expanded', v)
    this.minimapCanvas.width = size
    this.minimapCanvas.height = size
    this.minimapCanvas.style.width = `${size}px`
    this.minimapCanvas.style.height = `${size}px`
  }

  toggleExpanded(): void {
    this.setExpanded(!this.expanded)
  }

  sync(s: GameState, renderer: Renderer, prompt: HudPrompt): void {
    const q = (sel: string) => this.root.querySelector(sel) as HTMLElement

    q('#day').textContent = `DAY ${String(s.day).padStart(3, '0')}`
    q('#day-sub').textContent = `/ 100  ·  +${dayRate(s)}일`

    /* 시계 — 없으면 하늘빛으로만 판단(§3.2) */
    const clock = q('#clock')
    if (s.flags.hasClock) {
      clock.classList.remove('hidden')
      const label = s.phase === 'day' ? '☀ 낮' : s.phase === 'night' ? '☾ 밤' : ''
      q('#clock-phase').textContent = label
      q('#clock-time').textContent = fmt(phaseRemaining(s))
    } else {
      clock.classList.add('hidden')
    }

    const right: string[] = []
    right.push(`핵심 부품 <b>${s.coreParts.length}</b>/4`)
    right.push(`탈출 장비 <b>${s.escapeBuilt.length}</b>/4`)
    right.push(`기계 Lv<b>${s.craftLevel}</b>`)
    if (s.flags.hasObservatory) right.push(`소행성까지 <b>${daysToAsteroid(s)}</b>일`)
    if (s.asteroidFailures > 0) right.push(`피격 <b>${s.asteroidFailures}</b>/${s.allowedFailures}`)
    const stored = totalStoredWood(s)
    if (stored > 0) right.push(`저장고 <b>${stored}</b>`)
    q('#hud-right').innerHTML = right.join('<br>')

    /* 바 */
    const p = s.player
    this.bar('#oxygen', p.oxygen, p.maxOxygen, 0.3)
    this.bar('#suit', p.suit, p.maxSuit, 0.25)
    this.bar('#hunger', p.hunger, p.maxHunger, 0.2)
    this.bar('#stamina', p.stamina, 100, -1)

    /* 퀵슬롯 */
    const hot = q('#hotbar')
    let html = ''
    for (let i = 0; i < 8; i++) {
      const slot = p.slots[i] ?? null
      const def = slot ? ITEMS[slot.id] : null
      html += `<div class="slot${i === p.hotbar ? ' active' : ''}">`
        + `<span class="n">${i + 1}</span>`
        + `<span>${def?.icon ?? ''}</span>`
        + (slot && slot.count > 1 ? `<span class="c">${slot.count}</span>` : '')
        + '</div>'
    }
    hot.innerHTML = html

    /* 장비 */
    const battery = Math.round((p.flashlightBattery / p.maxFlashlightBattery) * 100)
    q('#gear').innerHTML =
      `<span class="${p.flashlightOn ? '' : 'off'}">🔦 <span class="battery-track">`
      + `<span class="battery-fill" style="width:${battery}%"></span></span></span>`
      + `<span class="${p.torchCharges > 0 ? '' : 'off'}">🔥 ×${p.torchCharges}</span>`
      + (p.gun
        ? `<span>${ITEMS[p.gun].icon} ${p.reloadT > 0 ? '재장전…' : `${p.magazine}/${ITEMS[p.gun].mag}`}</span>`
        : '')
      + `<span>🔥 ${fmt(burnRemaining(s))}</span>`

    /* 나침반(§8.3) */
    const compass = q('#compass')
    const target = s.flags.hasCompass ? compassTarget(s) : null
    if (target) {
      const a = Math.atan2(target.z - p.z, target.x - p.x)
      const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
      const idx = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8
      const dist = Math.round(Math.hypot(target.x - p.x, target.z - p.z))
      compass.textContent = `연구소 ${target.tier}단계  ${arrows[idx]}  ${dist}타일`
      compass.classList.remove('hidden')
    } else {
      compass.classList.add('hidden')
    }

    /* 연구소 교전 중 남은 적 */
    if (s.activeLab) {
      compass.textContent = `문이 잠겼습니다 — 남은 적 ${labRemaining(s)}`
      compass.classList.remove('hidden')
    }

    /* 토스트 */
    q('#toasts').innerHTML = s.toasts
      .map((t) => `<div class="toast ${t.tone}">${t.text}</div>`)
      .join('')

    /* 상호작용 안내 */
    const pr = q('#prompt')
    if (prompt) {
      pr.innerHTML = `<kbd>${prompt.key}</kbd>${prompt.text}`
      pr.classList.remove('hidden')
    } else {
      pr.classList.add('hidden')
    }

    /* 미니맵 — 지도 없으면 통째로 없다 */
    const wrap = q('#minimap-wrap')
    if (s.flags.hasMap) {
      wrap.classList.remove('hidden')
      renderer.drawMinimap(s, this.minimapCtx, this.minimapCanvas.width, this.expanded)
    } else {
      wrap.classList.add('hidden')
    }
  }

  private bar(sel: string, value: number, max: number, criticalRatio: number): void {
    const el = this.root.querySelector(sel) as HTMLElement
    if (!el) return
    const ratio = max > 0 ? value / max : 0
    const fill = el.querySelector('.fill') as HTMLElement
    fill.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`
    const val = el.querySelector('.value')
    if (val) val.textContent = String(Math.ceil(value))
    el.classList.toggle('critical', criticalRatio > 0 && ratio < criticalRatio)
  }
}

const TEMPLATE = `
<div class="hud-top">
  <div>
    <div class="day-counter" id="day">DAY 001</div>
    <small id="day-sub">/ 100</small>
  </div>
  <div class="clock hidden" id="clock">
    <div id="clock-phase">☀ 낮</div>
    <div class="big" id="clock-time">03:00</div>
  </div>
  <div class="hud-right" id="hud-right"></div>
</div>

<div class="compass hidden" id="compass"></div>

<div id="minimap-wrap" class="hidden"><canvas id="minimap" width="148" height="148"></canvas></div>

<div class="bars">
  <div class="bar" id="oxygen"><span class="label">O₂</span><span class="track"><span class="fill oxygen"></span></span><span class="value">100</span></div>
  <div class="bar" id="suit"><span class="label">우주복</span><span class="track"><span class="fill suit"></span></span><span class="value">100</span></div>
  <div class="bar" id="hunger"><span class="label">배고픔</span><span class="track"><span class="fill hunger"></span></span><span class="value">100</span></div>
  <div class="bar" id="stamina"><span class="label">기력</span><span class="track"><span class="fill stamina"></span></span><span class="value">100</span></div>
</div>

<div class="hotbar" id="hotbar"></div>
<div class="gear" id="gear"></div>
<div class="toasts" id="toasts"></div>
<div class="prompt hidden" id="prompt"></div>
`
