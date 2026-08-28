/* ==================================================================
   HUD — §19.2

   **캠프파이어 게이지가 화면 최상단**이다. 이 게임에서 유일하게 항상
   봐야 하는 숫자이기 때문이다. 레벨·현재 화력·남은 시간·열린 반경을
   한 덩어리로 보여 준다.

   두 가지는 의도적으로 **없다**.
     - 시계를 안 만들었으면 남은 시간이 안 보인다. 하늘빛으로 판단한다.
     - 지도를 안 만들었으면 미니맵이 없다.
   UI 를 감추는 것이 아이템의 값어치를 만드는 가장 정직한 방법이다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { ITEMS, fireLevelDef } from '../data/index.ts'
import { phaseRemaining, dayRate, daysToAsteroid } from '../systems/TimeSystem.ts'
import { secondsLeft, levelProgress } from '../systems/CampfireSystem.ts'
import { compassTarget, remaining as labRemaining } from '../systems/LabSystem.ts'
import { totalStored } from '../systems/InventorySystem.ts'
import { WEATHER_NAME, effective, navDisabled } from '../systems/WeatherSystem.ts'
import { isRaidDay } from '../systems/RaidSystem.ts'
import { currentWindow } from '../systems/RunSystem.ts'
import { crewDef } from '../entities/Crew.ts'
import { windows } from '../minigame/Salvage.ts'
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
    const size = v ? Math.min(window.innerHeight * 0.8, 640) : 150
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
    const fire = s.campfire

    /* §19.2 는 "DAY 041 / 99" 다. 마감일이 화면에 없으면 이 게임의
       전제가 어디에도 안 적혀 있는 셈이 된다. 99일이 지나면 다음 궤도
       정렬 창(124, 149…)으로 바뀐다. */
    const deadline = currentWindow(s.day)
    q('#day').textContent = `DAY ${String(s.day).padStart(3, '0')} / ${deadline}`
    q('#day-sub').textContent = `/ 99  ·  +${dayRate(s)}일`

    /* ★ 캠프파이어 게이지 */
    const bar = q('#fire')
    bar.classList.toggle('out', fire.extinguished)
    q('#fire-lv').textContent = fire.extinguished ? '꺼짐' : `Lv${fire.level}`
    q('#fire-heat').textContent = String(Math.round(fire.heat))
    q('#fire-left').textContent = fire.extinguished ? '—' : fmt(secondsLeft(s))
    ;(q('#fire-fill') as HTMLElement).style.width = `${levelProgress(s) * 100}%`
    const openDef = fireLevelDef(fire.maxReachedLevel)
    const nextDef = fireLevelDef(fire.maxReachedLevel + 1)
    q('#fire-open').textContent = openDef
      ? `개방 ${openDef.openRadius >= 999 ? '전체' : `${openDef.openRadius}타일`}`
        + (nextDef ? ` · 다음 Lv${nextDef.lv} 에서 ${nextDef.openRadius >= 999 ? '전체' : `${nextDef.openRadius}타일`}` : '')
      : `아직 불을 붙이지 않았습니다 (통나무 ${10} 화력)`

    /* 시계 — 없으면 하늘빛으로만 판단(§19.2) */
    const clock = q('#clock')
    if (s.flags.hasClock) {
      clock.classList.remove('hidden')
      q('#clock-phase').textContent = s.phase === 'day' ? '☀ 낮' : s.phase === 'night' ? '☾ 밤' : ''
      q('#clock-time').textContent = fmt(phaseRemaining(s))
    } else {
      clock.classList.add('hidden')
    }

    const right: string[] = []
    right.push(`대원 <b>${s.crew.length}</b>/4`)
    right.push(`탈출 장비 <b>${s.escapeBuilt.length}</b>/4`)
    right.push(`제작 Lv<b>${s.moduleLevel}</b>`)
    if (s.flags.hasObservatory) {
      const d = daysToAsteroid(s)
      if (d !== null) right.push(`소행성까지 <b>${d}</b>일`)
    }
    if (isRaidDay(s)) right.push('<span class="danger">오늘 밤 습격</span>')
    if (s.asteroidFailures > 0) right.push(`<span class="danger">피격 ${s.asteroidFailures}/${s.allowedFailures}</span>`)
    const stored = totalStored(s)
    if (stored > 0) right.push(`저장고 <b>${stored}</b>`)
    q('#hud-right').innerHTML = right.join('<br>')

    /* 날씨 */
    const wx = q('#weather')
    const kind = effective(s)
    if (kind === 'clear') wx.classList.add('hidden')
    else {
      wx.classList.remove('hidden')
      wx.textContent = `${WEATHER_NAME[kind]} · ${Math.ceil(s.weather.remain)}초`
    }

    const p = s.player
    this.bar('#oxygen', p.oxygen, p.maxOxygen, 0.3)
    this.bar('#suit', p.suit, p.maxSuit, 0.25)
    this.bar('#hunger', p.hunger, p.maxHunger, 0.2)
    this.bar('#stamina', p.stamina, 100, -1)

    /* 구출한 대원(§19.2) */
    const crewRow = q('#crew')
    if (s.crew.length === 0) crewRow.classList.add('hidden')
    else {
      crewRow.classList.remove('hidden')
      crewRow.innerHTML = '👤 ' + s.crew.map((id) => `<span>${crewDef(id)?.name.split(' ')[1] ?? id}</span>`).join(' · ')
    }

    /* 퀵슬롯 */
    let html = ''
    for (let i = 0; i < 8; i++) {
      const slot = p.slots[i] ?? null
      const def = slot ? ITEMS[slot.id] : null
      html += `<div class="slot${i === p.hotbar ? ' active' : ''}">`
        + `<span class="n">${i + 1}</span><span>${def?.icon ?? ''}</span>`
        + (slot && slot.count > 1 ? `<span class="c">${slot.count}</span>` : '')
        + '</div>'
    }
    q('#hotbar').innerHTML = html

    const battery = Math.round((p.flashlightBattery / p.maxFlashlightBattery) * 100)
    q('#gear').innerHTML =
      `<span class="${p.flashlightOn ? '' : 'off'}">🔦 <span class="battery-track">`
      + `<span class="battery-fill" style="width:${battery}%"></span></span></span>`
      + `<span class="${p.torchCharges > 0 ? '' : 'off'}">🔥 ×${p.torchCharges}</span>`
      + (p.gun ? `<span>${ITEMS[p.gun].icon} ${p.reloadT > 0 ? '재장전…' : `${p.magazine}/${ITEMS[p.gun].mag}`}</span>` : '')

    /* 나침반 — 자기폭풍 중에는 안 듣는다(§15) */
    const compass = q('#compass')
    if (s.activeLab) {
      compass.textContent = `문이 잠겼습니다 — 남은 적 ${labRemaining(s)}`
      compass.classList.remove('hidden')
    } else if (s.flags.hasCompass && navDisabled(s)) {
      compass.textContent = '자기폭풍 — 나침반이 듣지 않습니다'
      compass.classList.remove('hidden')
    } else {
      const target = s.flags.hasCompass ? compassTarget(s) : null
      if (target) {
        const a = Math.atan2(target.z - p.z, target.x - p.x)
        const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
        const idx = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8
        compass.textContent = `연구소 ${target.tier}단계  ${arrows[idx]}  ${Math.round(Math.hypot(target.x - p.x, target.z - p.z))}타일`
        compass.classList.remove('hidden')
      } else compass.classList.add('hidden')
    }

    /* 배너 — 불 꺼짐, 습격 예고 같은 큰 문구 */
    const banner = q('#banner')
    if (s.banner) {
      banner.textContent = s.banner.text
      banner.classList.remove('hidden')
    } else banner.classList.add('hidden')

    q('#toasts').innerHTML = s.toasts.map((t) => `<div class="toast ${t.tone}">${t.text}</div>`).join('')

    const pr = q('#prompt')
    if (prompt) {
      pr.innerHTML = `<kbd>${prompt.key}</kbd>${prompt.text}`
      pr.classList.remove('hidden')
    } else pr.classList.add('hidden')

    /* 잔해 채취 바(§7.4) */
    const sv = q('#salvage')
    if (s.salvage.active) {
      sv.classList.remove('hidden')
      const w = windows(s)
      const res = s.salvage.resultT > 0 && s.salvage.lastResult
        ? `<div class="result ${s.salvage.lastResult}">${
          s.salvage.lastResult === 'perfect' ? 'PERFECT +4'
            : s.salvage.lastResult === 'good' ? 'GOOD +2' : 'MISS'}</div>`
        : '<div class="result">&nbsp;</div>'
      sv.innerHTML = `
        <div>잔해 채취 · 숙련도 ${s.salvage.level + 1}단계</div>
        <div class="track">
          <div class="good" style="left:50%;width:${w.good * 100}%"></div>
          <div class="perfect" style="left:50%;width:${w.perfect * 100}%"></div>
          <div class="marker" style="left:${s.salvage.marker * 100}%"></div>
        </div>
        ${res}
        <div class="hint">${s.salvage.cooldown > 0
          ? `쿨다운 ${s.salvage.cooldown.toFixed(1)}초`
          : '좌클릭으로 멈추기 · E 로 나가기'}</div>`
    } else sv.classList.add('hidden')

    const wrap = q('#minimap-wrap')
    if (s.flags.hasMap && !navDisabled(s)) {
      wrap.classList.remove('hidden')
      renderer.drawMinimap(s, this.minimapCtx, this.minimapCanvas.width, this.expanded)
    } else wrap.classList.add('hidden')
  }

  private bar(sel: string, value: number, max: number, criticalRatio: number): void {
    const el = this.root.querySelector(sel) as HTMLElement
    if (!el) return
    const ratio = max > 0 ? value / max : 0
    ;(el.querySelector('.fill') as HTMLElement).style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`
    const val = el.querySelector('.value')
    if (val) val.textContent = String(Math.ceil(value))
    el.classList.toggle('critical', criticalRatio > 0 && ratio < criticalRatio)
  }
}

const TEMPLATE = `
<div class="hud-top">
  <div>
    <div class="day-counter" id="day">DAY 001 / 99</div>
    <small id="day-sub">/ 99</small>
  </div>
  <div class="clock hidden" id="clock">
    <div id="clock-phase">☀ 낮</div>
    <div class="big" id="clock-time">03:00</div>
  </div>
  <div class="hud-right" id="hud-right"></div>
</div>

<div class="fire-bar" id="fire">
  <div class="head">
    <span class="lv" id="fire-lv">꺼짐</span>
    <span class="heat" id="fire-heat">0</span>
    <span class="left" id="fire-left">—</span>
  </div>
  <div class="track"><div class="fill" id="fire-fill" style="width:0%"></div></div>
  <div class="open" id="fire-open"></div>
</div>

<div class="weather-tag hidden" id="weather"></div>
<div class="compass hidden" id="compass"></div>
<div class="banner hidden" id="banner"></div>

<div id="minimap-wrap" class="hidden"><canvas id="minimap" width="150" height="150"></canvas></div>

<div class="bars">
  <div class="bar" id="oxygen"><span class="label">O₂</span><span class="track"><span class="fill oxygen"></span></span><span class="value">100</span></div>
  <div class="bar" id="suit"><span class="label">우주복</span><span class="track"><span class="fill suit"></span></span><span class="value">100</span></div>
  <div class="bar" id="hunger"><span class="label">배고픔</span><span class="track"><span class="fill hunger"></span></span><span class="value">100</span></div>
  <div class="bar" id="stamina"><span class="label">기력</span><span class="track"><span class="fill stamina"></span></span><span class="value">100</span></div>
</div>

<div class="crew-row hidden" id="crew"></div>
<div class="hotbar" id="hotbar"></div>
<div class="gear" id="gear"></div>
<div class="toasts" id="toasts"></div>
<div class="salvage hidden" id="salvage"></div>
<div class="prompt hidden" id="prompt"></div>
`
