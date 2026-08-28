/* ==================================================================
   조명 — 밤의 어둠과 캠프의 불빛

   §20.1 의 원칙: **화면에서 따뜻한 색은 캠프파이어뿐**이다. 그래서
   불빛을 밝기가 아니라 색으로 그린다. 플레이어가 주황색을 찾게 되고,
   그게 곧 안전의 신호가 된다.

   광원 반경은 **현재 레벨**의 안전반경을 따른다. 개방 반경(최고 도달
   레벨)과 다르다는 것이 요점이다 — 불이 약해지면 밝은 원이 눈앞에서
   실제로 줄어든다. 숫자를 안 봐도 위험해진 것을 안다.

   어둠은 캔버스를 덮은 뒤 destination-out 으로 구멍을 뚫는다. 광원마다
   그라디언트를 지우면 부드러운 경계가 공짜로 나온다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { BALANCE } from '../data/index.ts'
import { TILE } from '../world/Tilemap.ts'
import type { Camera } from './Camera.ts'

const C = BALANCE.map.centerTile

/** 밤의 어둠 정도. 해질녘·동틀녘에 부드럽게 오간다. */
export function darkness(s: GameState): number {
  const FADE = 12
  if (s.phase === 'day') {
    const left = s.daySeconds - s.phaseT
    return left < FADE ? (1 - left / FADE) * 0.94 : 0
  }
  if (s.phase === 'night') {
    if (s.phaseT < FADE) return 0.94
    const left = s.nightSeconds - s.phaseT
    return left < FADE ? (left / FADE) * 0.94 : 0.94
  }
  return 0
}

/** 하늘빛. 시계가 없으면 이것만으로 시간을 읽어야 한다(§19.2). */
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
  /* 불이 살아 있을 때만 따뜻한 광원이 있다. 꺼지면 캠프도 어둠이다. */
  if (s.campfire.level > 0 && !s.campfire.extinguished) {
    out.push({ x: C, z: C, radius: s.campfire.safeRadius, warm: true })
  }
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

  /* 플레이어 주변의 최소 시야. 없으면 불 꺼진 밤이 그냥 암전이다. */
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
    g.addColorStop(0, `rgba(255, 179, 71, ${0.2 * dark})`)
    g.addColorStop(0.5, `rgba(255, 140, 60, ${0.09 * dark})`)
    g.addColorStop(1, 'rgba(255, 120, 40, 0)')
    ctx.fillStyle = g
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2)
  }
  ctx.restore()
}
