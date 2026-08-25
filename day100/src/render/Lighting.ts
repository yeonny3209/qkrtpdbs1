/* ==================================================================
   조명 — 밤의 어둠과 캠프의 불빛

   §16.1 의 원칙: **화면에서 따뜻한 색은 캠프파이어뿐**이다. 그래서
   불빛을 그냥 밝기가 아니라 색으로 그린다. 플레이어가 주황색을
   찾게 되고, 그게 곧 안전의 신호가 된다.

   어둠은 캔버스 하나를 덮어 그린 뒤 destination-out 으로 구멍을
   뚫는 방식이다. 광원마다 그라디언트를 지우면 부드러운 경계가
   공짜로 나오고, 캠프 안전반경이 눈에 정확히 보인다 — 안전선이
   보여야 "한 번만 더"가 유혹이 된다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { TILE } from '../world/Tilemap.ts'
import type { Camera } from './Camera.ts'
import { BALANCE } from '../data/index.ts'

/** 밤의 어둠 정도. 해질녘·동틀녘에 부드럽게 오간다. */
export function darkness(s: GameState): number {
  const FADE = 12
  if (s.phase === 'day') {
    const left = s.daySeconds - s.phaseT
    if (left < FADE) return (1 - left / FADE) * 0.94
    return 0
  }
  if (s.phase === 'night') {
    if (s.phaseT < FADE) return 0.94
    const left = s.nightSeconds - s.phaseT
    if (left < FADE) return (left / FADE) * 0.94
    return 0.94
  }
  return 0
}

/** 하늘빛. 시계가 없으면 이것만으로 시간을 읽어야 한다(§3.2). */
export function skyTint(s: GameState): string {
  const d = darkness(s)
  if (d <= 0.01) return '#7FA894'
  const t = Math.min(1, d / 0.94)
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${lerp(127, 20)},${lerp(168, 17)},${lerp(148, 39)})`
}

export type LightSource = { x: number; z: number; radius: number; warm: boolean }

export function collectLights(s: GameState): LightSource[] {
  const out: LightSource[] = []
  const c = BALANCE.map.centerTile

  if (s.campfire.level > 0) {
    out.push({ x: c, z: c, radius: s.campfire.safeRadius, warm: true })
  }

  /* 손전등은 원이 아니라 콘이라 여기서 다루지 않는다. Renderer 가
     따로 그린다 — 방향이 있는 빛은 어둠 뚫기와 그림이 다르다. */

  for (const b of s.buildings) {
    if (b.type === 'turret') out.push({ x: b.x, z: b.z, radius: 4, warm: false })
  }
  return out
}

export function drawDarkness(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  cam: Camera,
  w: number,
  h: number,
  visionFactor: number,
): void {
  const dark = darkness(s)
  if (dark <= 0.01) return

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = `rgba(6, 5, 14, ${dark})`
  ctx.fillRect(0, 0, w, h)

  /* 플레이어 주변의 최소 시야. 이것마저 없으면 불 꺼진 밤에 아무것도
     안 보여서 게임이 아니라 암전이 된다. */
  ctx.globalCompositeOperation = 'destination-out'
  const px = cam.toScreenX(s.player.x)
  const py = cam.toScreenY(s.player.z)
  const personal = 4.2 * TILE * visionFactor
  const g0 = ctx.createRadialGradient(px, py, personal * 0.25, px, py, personal)
  g0.addColorStop(0, 'rgba(0,0,0,0.85)')
  g0.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g0
  ctx.fillRect(px - personal, py - personal, personal * 2, personal * 2)

  for (const light of collectLights(s)) {
    const lx = cam.toScreenX(light.x)
    const ly = cam.toScreenY(light.z)
    const r = light.radius * TILE * visionFactor
    if (r <= 0) continue
    const g = ctx.createRadialGradient(lx, ly, r * 0.3, lx, ly, r)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.72, 'rgba(0,0,0,0.92)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2)
  }

  /* 손전등 콘도 어둠을 뚫는다 */
  const p = s.player
  if (p.flashlightOn && p.flashlightBattery > 0) {
    const range = BALANCE.spider.flashlightRange * TILE * visionFactor
    const half = (BALANCE.spider.flashlightConeDegrees * Math.PI) / 180 / 2
    const g = ctx.createRadialGradient(px, py, 8, px, py, range)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.arc(px, py, range, p.facing - half, p.facing + half)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()

  /* 불빛의 색. 어둠을 뚫은 자리에 따뜻한 색을 얹는다. */
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const light of collectLights(s)) {
    if (!light.warm) continue
    const lx = cam.toScreenX(light.x)
    const ly = cam.toScreenY(light.z)
    const r = light.radius * TILE * visionFactor
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r)
    g.addColorStop(0, `rgba(255, 179, 71, ${0.20 * dark})`)
    g.addColorStop(0.5, `rgba(255, 140, 60, ${0.09 * dark})`)
    g.addColorStop(1, 'rgba(255, 120, 40, 0)')
    ctx.fillStyle = g
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2)
  }
  ctx.restore()
}
