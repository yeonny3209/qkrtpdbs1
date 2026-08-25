/* ==================================================================
   화면 연출

   §16.3 의 시그니처: **산소가 30 아래로 떨어지면 HUD 가 아니라 화면
   전체가 반응한다.** 가장자리에 성에가 끼고, 채도가 빠지고, 화면이
   좁아진다. 게이지를 안 봐도 몸으로 알게 만드는 것이 목표다.

   숫자를 읽어야 아는 위험은 위험처럼 느껴지지 않는다. 그래서 산소는
   숫자가 아니라 시야로 말한다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'

/** 0(멀쩡) ~ 1(질식 직전) */
export function suffocation(s: GameState): number {
  const p = s.player
  const ratio = p.oxygen / p.maxOxygen
  const start = 0.3
  if (ratio >= start) return 0
  return Math.min(1, (start - ratio) / start)
}

export function drawFrost(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number): void {
  const f = suffocation(s)
  if (f <= 0.01) return

  /* 가장자리에서 안쪽으로 파고드는 성에 */
  ctx.save()
  const inset = Math.min(w, h) * (0.5 - 0.34 * f)
  const g = ctx.createRadialGradient(w / 2, h / 2, inset * 0.55, w / 2, h / 2, Math.max(w, h) * 0.72)
  g.addColorStop(0, 'rgba(180, 220, 235, 0)')
  g.addColorStop(0.55, `rgba(170, 214, 232, ${0.16 * f})`)
  g.addColorStop(1, `rgba(206, 236, 248, ${0.55 * f})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  /* 결정 자국 몇 개. 많이 그리면 지저분해지고, 없으면 그냥 흐림이다. */
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

/** 산소 10 이하에서 채도를 뺀다(§16.3). */
export function desaturationAlpha(s: GameState): number {
  const ratio = s.player.oxygen / s.player.maxOxygen
  if (ratio > 0.1) return 0
  return Math.min(0.6, (0.1 - ratio) / 0.1 * 0.6)
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

/** 밤 예고 — 보라 비네트 + 중앙 대형 텍스트(§3.2) */
export function drawNightWarning(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  w: number,
  h: number,
): void {
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
  ctx.font = '700 42px "Bebas Neue", "Pretendard", system-ui, sans-serif'
  ctx.fillStyle = `rgba(255, 230, 245, ${0.75 + 0.25 * pulse})`
  ctx.fillText('밤이 오고 있습니다', w / 2, 96)
  ctx.font = '600 20px "Space Mono", ui-monospace, monospace'
  ctx.fillStyle = 'rgba(226, 190, 240, 0.9)'
  ctx.fillText(`우주선으로 돌아가세요 · ${Math.ceil(left)}`, w / 2, 132)
  ctx.restore()
}

/** 피격 섬광 */
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

/** 화면 흔들림 — 소행성 피격과 곰의 돌진에 쓴다 */
export function shakeOffset(intensity: number, t: number): { x: number; y: number } {
  if (intensity <= 0) return { x: 0, y: 0 }
  return {
    x: Math.sin(t * 47) * intensity,
    y: Math.cos(t * 61) * intensity,
  }
}
