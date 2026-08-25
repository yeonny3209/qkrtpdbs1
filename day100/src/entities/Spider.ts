/* ==================================================================
   외계 거미 — 이 게임의 정체성

   §18 이 "M3까지가 전체 재미의 70%"라고 적은 이유가 이것이다.
   거미가 안 무서우면 나머지 시스템은 전부 헛돈다.

   무섭게 만드는 장치는 셋이다.

     1. 무적이고 즉사다. 싸울 수 없으니 계산이 "이길까"가 아니라
        "돌아갈 수 있을까"가 된다.
     2. 시야가 무한하다. 숨는 선택지를 없애야 시간이 유일한 변수가 된다.
     3. 캠프 안에는 못 들어오지만 경계에서 배회한다. 안전선이 눈에
        보이면 "한 번만 더"가 유혹이 된다.

   불이 꺼지면 속도 4.5 → 6.5 로 오른다. 달리기(6.0)보다 빠르다.
   즉 불 꺼진 밤에는 도망이라는 선택지가 사라진다(§9.3).
   ================================================================== */
import { BALANCE, ENEMIES } from '../data/index.ts'
import type { GameState, Spider } from '../core/GameState.ts'
import { nextId, distance } from '../core/GameState.ts'
import { CENTER, TILES, type Solid, segmentBlocked } from '../world/Tilemap.ts'
import { kill } from '../systems/SurvivalSystem.ts'

const S = BALANCE.spider
const DEF = ENEMIES.spider

export function spiderCount(s: GameState): number {
  const base = s.campfire.level <= 0 ? S.countNoFire : S.countNormal
  return base + (s.modifier.effects.extraSpiders ?? 0)
}

export function spiderSpeed(s: GameState): number {
  const raw = s.campfire.level <= 0 ? S.speedNoFire : S.speed
  const suppressed = s.buildings.some((b) => b.type === 'spider_suppressor')
  return suppressed ? raw * S.suppressorSlowFactor : raw
}

/** 밤이 시작될 때. 플레이어에게서 30타일 밖에 세운다(§10.2). */
export function spawnForNight(s: GameState): void {
  s.spiders.length = 0
  const rng = s.streams.ai
  const n = spiderCount(s)
  for (let i = 0; i < n; i++) {
    let x = CENTER
    let z = CENTER
    for (let tries = 0; tries < 30; tries++) {
      const a = rng() * Math.PI * 2
      const r = S.spawnDistance + rng() * 8
      x = s.player.x + Math.cos(a) * r
      z = s.player.z + Math.sin(a) * r
      if (x > 2 && z > 2 && x < TILES - 2 && z < TILES - 2) break
    }
    s.spiders.push({ id: nextId(s), x, z, stunT: 0, speed: spiderSpeed(s) })
  }
  s.events.push('spiderSpawn')
}

function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

/** 손전등 콘 안에 있는가. 방향은 플레이어가 보는 쪽. */
export function inFlashlightCone(s: GameState, sp: Spider): boolean {
  const p = s.player
  if (!p.flashlightOn || p.flashlightBattery <= 0) return false
  const d = distance(p.x, p.z, sp.x, sp.z)
  if (d > S.flashlightRange) return false
  const toSpider = Math.atan2(sp.z - p.z, sp.x - p.x)
  const half = (S.flashlightConeDegrees * Math.PI) / 180 / 2
  return angleDiff(toSpider, p.facing) <= half
}

/** 횃불 — Q 즉발. 반경 안 전부를 5초 확정 정지시킨다. */
export function useTorch(s: GameState): boolean {
  const p = s.player
  if (p.torchCharges <= 0) return false
  p.torchCharges--
  for (const sp of s.spiders) {
    if (distance(p.x, p.z, sp.x, sp.z) <= S.torchRadius) {
      sp.stunT = Math.max(sp.stunT, S.torchStunSeconds)
    }
  }
  /* 빗나가도 소모된다. 급할 때 아무 데나 던지는 것까지가 판단이다. */
  s.events.push('torch')
  return true
}

export function update(s: GameState, dt: number, solids: readonly Solid[]): void {
  if (s.phase !== 'night') return
  const p = s.player
  const noFire = s.campfire.level <= 0

  for (const sp of s.spiders) {
    sp.speed = spiderSpeed(s)

    if (sp.stunT > 0) {
      sp.stunT -= dt
      continue
    }

    /* 손전등. 불이 꺼져 있으면 절반만 듣는다 — 매 프레임 굴리면
       사실상 항상 걸리므로, 콘에 "들어오는 순간"에만 굴린다. */
    if (inFlashlightCone(s, sp)) {
      if (!noFire) continue                       // 비추는 동안 정지
      if (s.streams.ai.chance(S.flashlightStunChanceNoFire * dt * 6)) {
        sp.stunT = 0.35
        continue
      }
    }

    const dx = p.x - sp.x
    const dz = p.z - sp.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) continue

    /* 접촉 = 즉사. 캠프 안에 있으면 애초에 닿지 못한다. */
    if (d <= DEF.radius + BALANCE.player.radius) {
      kill(s, 'spider')
      return
    }

    let ux = dx / d
    let uz = dz / d

    /* 장애물만 피한다(§10.2). 길찾기가 아니라 "앞이 막히면 옆으로" 다 —
       거미는 영리해서 무서운 게 아니라 멈추지 않아서 무섭다. */
    const step = sp.speed * dt
    if (segmentBlocked(sp.x, sp.z, sp.x + ux * 1.2, sp.z + uz * 1.2, DEF.radius, solids)) {
      const base = Math.atan2(uz, ux)
      for (const off of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
        const a = base + off
        const nx = Math.cos(a)
        const nz = Math.sin(a)
        if (!segmentBlocked(sp.x, sp.z, sp.x + nx * 1.2, sp.z + nz * 1.2, DEF.radius, solids)) {
          ux = nx
          uz = nz
          break
        }
      }
    }

    let nx = sp.x + ux * step
    let nz = sp.z + uz * step

    /* 캠프 안전반경 안으로는 못 들어온다. 경계에서 미끄러지게 해서
       "문 앞에서 서성이는" 그림을 만든다 — 이게 안전선을 눈에 보이게 한다. */
    const safe = s.campfire.safeRadius
    if (safe > 0) {
      const dc = distance(nx, nz, CENTER, CENTER)
      if (dc < safe) {
        const a = Math.atan2(nz - CENTER, nx - CENTER)
        nx = CENTER + Math.cos(a) * safe
        nz = CENTER + Math.sin(a) * safe
      }
    }

    sp.x = nx
    sp.z = nz
  }
}
