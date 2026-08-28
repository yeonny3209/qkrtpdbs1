/* ==================================================================
   화면 연출

   §20.3 의 시그니처: **산소가 30 아래로 떨어지면 HUD 가 아니라 화면
   전체가 반응한다.** 가장자리에 성에가 끼고, 채도가 빠지고, 시야가
   좁아진다. 숫자를 읽어야 아는 위험은 위험처럼 느껴지지 않는다.

   불이 꺼졌을 때의 붉은 경고(§3.4)도 여기서 그린다. 이 게임에서 가장
   중요한 한 줄이라, 배너와 별개로 화면 자체를 물들인다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { effective } from '../systems/WeatherSystem.ts'

/** 0(멀쩡) ~ 1(질식 직전) */
export function suffocation(s: GameState): number {
  const ratio = s.player.oxygen / s.player.maxOxygen
  const start = 0.3
  return ratio >= start ? 0 : Math.min(1, (start - ratio) / start)
}

export function drawFrost(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number): void {
  const f = suffocation(s)
  if (f <= 0.01) return

  ctx.save()
  const inset = Math.min(w, h) * (0.5 - 0.34 * f)
  const g = ctx.createRadialGradient(w / 2, h / 2, inset * 0.55, w / 2, h / 2, Math.max(w, h) * 0.72)
  g.addColorStop(0, 'rgba(180, 220, 235, 0)')
  g.addColorStop(0.55, `rgba(170, 214, 232, ${0.16 * f})`)
  g.addColorStop(1, `rgba(206, 236, 248, ${0.55 * f})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  /* 결정 자국 몇 개. 많으면 지저분하고, 없으면 그냥 흐림이다. */
  ctx.strokeStyle = `rgba(226, 244, 252, ${0.35 * f})`
  ctx.lineWidth = 1.2
  const spikes = Math.floor(10 + 26 * f)
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + i * 0.37
    const r0 = Math.max(w, h) * 0.62
    const len = (30 + ((i * 37) % 70)) * f
    const cx = w / 2 + Math.cos(a) * r0
    const cy = h / 2 + Math.sin(a) * r0
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx - Math.cos(a) * len, cy - Math.sin(a) * len)
    ctx.stroke()
  }
  ctx.restore()
}

export function desaturationAlpha(s: GameState): number {
  const ratio = s.player.oxygen / s.player.maxOxygen
  return ratio > 0.1 ? 0 : Math.min(0.6, ((0.1 - ratio) / 0.1) * 0.6)
}

export function drawDesaturation(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number): void {
  const a = desaturationAlpha(s)
  if (a <= 0.01) return
  ctx.save()
  ctx.globalCompositeOperation = 'saturation'
  ctx.fillStyle = `rgba(128,128,128,${a})`
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** 밤 예고 — 보라 비네트 + 중앙 대형 텍스트(§19.2) */
export function drawNightWarning(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number): void {
  if (s.phase !== 'day') return
  const left = s.daySeconds - s.phaseT
  if (left > 10 || left < 0) return

  const pulse = 0.5 + 0.5 * Math.sin(s.elapsed * 7)
  ctx.save()
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.7)
  g.addColorStop(0, 'rgba(90, 20, 120, 0)')
  g.addColorStop(1, `rgba(120, 28, 160, ${0.32 + 0.22 * pulse})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 40px "Pretendard", system-ui, sans-serif'
  ctx.fillStyle = `rgba(255, 230, 245, ${0.75 + 0.25 * pulse})`
  ctx.fillText('밤이 오고 있습니다', w / 2, 92)
  ctx.font = '600 19px "Space Mono", ui-monospace, monospace'
  ctx.fillStyle = 'rgba(226, 190, 240, 0.9)'
  ctx.fillText(`캠프로 돌아가세요 · ${Math.ceil(left)}`, w / 2, 128)
  ctx.restore()
}

/** ★ 불이 꺼졌다 — 이 게임에서 가장 무서운 상태(§3.4) */
export function drawExtinguished(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number): void {
  if (!s.campfire.extinguished || s.phase !== 'night') return
  const pulse = 0.5 + 0.5 * Math.sin(s.elapsed * 3.2)
  ctx.save()
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.72)
  g.addColorStop(0, 'rgba(200, 35, 90, 0)')
  g.addColorStop(1, `rgba(160, 20, 60, ${0.24 + 0.16 * pulse})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** 날씨 오버레이 */
export function drawWeather(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number): void {
  const kind = effective(s)
  if (kind === 'clear') return
  ctx.save()
  if (kind === 'acid_rain') {
    ctx.strokeStyle = 'rgba(150, 220, 140, 0.28)'
    ctx.lineWidth = 1.4
    const t = s.elapsed * 900
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137 + t) % (w + 100)) - 50
      const y = ((i * 219 + t * 1.6) % (h + 100)) - 50
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 4, y + 16)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(90, 140, 90, 0.10)'
    ctx.fillRect(0, 0, w, h)
  } else if (kind === 'magnetic_storm') {
    const flash = Math.max(0, Math.sin(s.elapsed * 2.1) - 0.93) * 10
    ctx.fillStyle = `rgba(180, 200, 255, ${0.06 + flash * 0.5})`
    ctx.fillRect(0, 0, w, h)
    /* 낙뢰 예고 — 플레이어 머리 위가 밝아진다 */
    if (s.player.stormWarnT > 0) {
      ctx.fillStyle = 'rgba(220, 235, 255, 0.3)'
      ctx.fillRect(0, 0, w, h)
    }
  } else if (kind === 'spore_fog') {
    ctx.fillStyle = 'rgba(95, 242, 200, 0.07)'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.6)
    g.addColorStop(0, 'rgba(40, 60, 55, 0)')
    g.addColorStop(1, 'rgba(30, 48, 44, 0.55)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()
}

export function drawHurt(ctx: CanvasRenderingContext2D, alpha: number, w: number, h: number): void {
  if (alpha <= 0.01) return
  ctx.save()
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.65)
  g.addColorStop(0, 'rgba(200, 35, 90, 0)')
  g.addColorStop(1, `rgba(200, 35, 90, ${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

export function shakeOffset(intensity: number, t: number): { x: number; y: number } {
  if (intensity <= 0) return { x: 0, y: 0 }
  return { x: Math.sin(t * 47) * intensity, y: Math.cos(t * 61) * intensity }
}
