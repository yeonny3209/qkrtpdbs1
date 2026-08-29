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

/* 밤 오버레이의 최대 짙기. 예전엔 0.94 였는데, 그 짙기에서 플레이어의
   개인 시야 구멍이 중심부에서도 15%만 지워 실질적으로 화면 전체가
   암전이었다 — "어두워지되 형체는 보인다"가 아니라 그냥 안 보였다.
   0.94 는 캠프 불빛·손전등이 뚫는 "빛의 원" 안쪽엔 그대로 남긴다 —
   그 안은 진짜로 밝아야 한다. 화면 전체의 기본 짙기만 낮춘다. */
const NIGHT_MAX = 0.68

/** 밤의 어둠 정도. 해질녘·동틀녘에 부드럽게 오간다. */
export function darkness(s: GameState): number {
  const FADE = 12
  if (s.phase === 'day') {
    const left = s.daySeconds - s.phaseT
    return left < FADE ? (1 - left / FADE) * NIGHT_MAX : 0
  }
  if (s.phase === 'night') {
    if (s.phaseT < FADE) return NIGHT_MAX
    const left = s.nightSeconds - s.phaseT
    return left < FADE ? (left / FADE) * NIGHT_MAX : NIGHT_MAX
  }
  return 0
}

/** 하늘빛. 시계가 없으면 이것만으로 시간을 읽어야 한다(§19.2). */
export function skyTint(s: GameState): string {
  const d = darkness(s)
  if (d <= 0.01) return '#7FA894'
  const t = Math.min(1, d / NIGHT_MAX)
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

  /* 플레이어 주변의 최소 시야. 없으면 불 꺼진 밤이 그냥 암전이다.

     ★ 중심부 지우개 세기가 0.85 뿐이었다 — NIGHT_MAX(옛 0.94)와 곱하면
     플레이어 발밑조차 14% 검은 막이 남아, "내 눈앞"도 흐릿했다. 광원
     구멍(아래)과 같은 다단 그라디언트로 맞춰 중심은 완전히 지운다. */
  ctx.globalCompositeOperation = 'destination-out'
  const px = cam.toScreenX(s.player.x)
  const py = cam.toScreenY(s.player.z)
  const personal = 5 * TILE * visionFactor
  const g0 = ctx.createRadialGradient(px, py, personal * 0.15, px, py, personal)
  g0.addColorStop(0, 'rgba(0,0,0,1)')
  g0.addColorStop(0.6, 'rgba(0,0,0,0.85)')
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

  drawSpiderGlow(ctx, s, cam, dark)
}

/* §20.4: "거미 접근 — 보이기 전부터 들림." 소리로 먼저 알리고, 그 다음
   에야 형체가 보이는 순서다. 그런데 시야 구멍 바깥에서는 실루엣조차
   destination-out 에 완전히 지워져, 소리만 들리다가 조명 안에 들어온
   순간 갑자기 나타났다 — 다가오는 게 안 보이니 무섭기보다 뜬금없었다.

   destination-out 마스크가 끝난 뒤 'lighter' 로 얹으므로 어둠 위에도
   남는다. §20.1 팔레트가 "이 색이 보이면 이미 늦음"이라 적어 둔 자홍
   (#C8235A, PALETTE.spider 와 같은 값)을 아주 옅게 — 눈이 두 개 있는
   실루엣 정도로만 — 깜빡여, 다가오는 것이 보이되 손전등에 확실히
   담기 전까진 정체가 흐릿하게 남는다. */
function drawSpiderGlow(ctx: CanvasRenderingContext2D, s: GameState, cam: Camera, dark: number): void {
  if (s.spiders.length === 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const sp of s.spiders) {
    const sx = cam.toScreenX(sp.x)
    const sy = cam.toScreenY(sp.z)
    const pulse = 0.55 + 0.45 * Math.sin(s.elapsed * 6 + sp.id)
    const r = TILE * 1.4
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r)
    g.addColorStop(0, `rgba(200, 35, 90, ${0.5 * dark * pulse})`)
    g.addColorStop(1, 'rgba(200, 35, 90, 0)')
    ctx.fillStyle = g
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2)
  }
  ctx.restore()
}
