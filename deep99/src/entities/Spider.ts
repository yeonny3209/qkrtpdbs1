/* ==================================================================
   외계 거미 — 이 게임의 정체성 (§10.2)

   §22 가 "M2와 M4가 이 게임의 전부"라고 적은 이유가 이것이다. 거미가
   안 무서우면 나머지는 전부 헛돈다.

   ── 원작의 사슴을 그대로 옮긴 두 가지 상태

     평시 (불 켜짐)   속도 3.6 — 걷기(4.0)보다도 느리다. 걸어서 도망친다.
                     캠프 안전반경에 못 들어온다. 경계에서 배회한다.

     굶주림 (불 꺼짐) 속도 6.5 — 달리기(6.0)보다 빠르다. 못 도망친다.
                     **캠프 안까지 들어온다.** 손전등이 절반만 듣는다.
                     두 마리가 된다.

   평시에 3.6 이라는 것이 중요하다. 느려서 안 무서운 게 아니라, 느리기
   때문에 "불만 지키면 괜찮다"가 성립하고, 그래서 불이 꺼지는 순간의
   낙차가 공포가 된다. 거미는 죽일 수 없다 — 총도 포탑도 덫도 안 통한다.
   유일한 답은 불을 꺼뜨리지 않는 것이다.
   ================================================================== */
import { BALANCE, ENEMIES } from '../data/index.ts'
import type { GameState, Spider } from '../core/GameState.ts'
import { nextId, distance } from '../core/GameState.ts'
import { CENTER, TILES, type Solid, segmentBlocked } from '../world/Tilemap.ts'
import { kill } from '../systems/SurvivalSystem.ts'
import { isTutorialDay } from '../systems/TimeSystem.ts'

const S = BALANCE.spider
const DEF = ENEMIES.spider

export function isHungry(s: GameState): boolean {
  return s.campfire.extinguished
}

export function spiderCount(s: GameState): number {
  const base = isHungry(s) ? S.countHungry : S.countNormal
  return base + (s.modifier.effects.extraSpiders ?? 0)
}

export function spiderSpeed(s: GameState): number {
  const raw = isHungry(s) ? S.speedHungry : S.speed
  const suppressed = s.buildings.some((b) => b.type === 'spider_suppressor')
  return suppressed ? raw * S.suppressorSlowFactor : raw
}

/** 밤 시작 시. 1일차는 튜토리얼이라 안 나온다(§18). */
export function spawnForNight(s: GameState): void {
  s.spiders.length = 0
  if (isTutorialDay(s)) return

  const rng = s.streams.ai
  for (let i = 0; i < spiderCount(s); i++) {
    let x = CENTER
    let z = CENTER
    for (let tries = 0; tries < 30; tries++) {
      const a = rng() * Math.PI * 2
      const r = S.spawnDistance + rng() * 8
      x = s.player.x + Math.cos(a) * r
      z = s.player.z + Math.sin(a) * r
      if (x > 2 && z > 2 && x < TILES - 2 && z < TILES - 2) break
    }
    s.spiders.push({ id: nextId(s), x, z, stunT: 0, rollT: 0 })
  }
  s.events.push('spiderSpawn')
}

function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

/** 손전등 60° 콘 안인가 */
export function inFlashlightCone(s: GameState, sp: Spider): boolean {
  const p = s.player
  if (!p.flashlightOn || p.flashlightBattery <= 0) return false
  if (distance(p.x, p.z, sp.x, sp.z) > S.flashlightRange) return false
  const half = (S.flashlightConeDegrees * Math.PI) / 180 / 2
  return angleDiff(Math.atan2(sp.z - p.z, sp.x - p.x), p.facing) <= half
}

/** 횃불 — Q 즉발. 반경 안 전부를 5초 확정 정지(§10.3). */
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
  if (s.phase !== 'night' || s.activeLab) return
  const p = s.player
  const hungry = isHungry(s)
  const speed = spiderSpeed(s)

  for (const sp of s.spiders) {
    if (sp.stunT > 0) {
      sp.stunT -= dt
      continue
    }

    /* 손전등. 굶주림 상태에서는 매 0.5초마다 50% 판정(§10.3) —
       매 프레임 굴리면 사실상 항상 걸려서 "절반만 통함"이 무의미해진다. */
    if (inFlashlightCone(s, sp)) {
      if (!hungry) continue
      sp.rollT -= dt
      if (sp.rollT <= 0) {
        sp.rollT = S.hungryStunRollSeconds
        if (s.streams.ai.chance(S.hungryStunChance)) {
          sp.stunT = S.hungryStunRollSeconds
          continue
        }
      }
    }

    const dx = p.x - sp.x
    const dz = p.z - sp.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) continue

    if (d <= DEF.radius + BALANCE.player.radius) {
      kill(s, hungry ? 'spider_hungry' : 'spider')
      return
    }

    let ux = dx / d
    let uz = dz / d

    /* 장애물만 피한다(§10.2). 길찾기가 아니라 "앞이 막히면 옆으로"다 —
       거미는 영리해서 무서운 게 아니라 멈추지 않아서 무섭다. */
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

    let nx = sp.x + ux * speed * dt
    let nz = sp.z + uz * speed * dt

    /* ★ 굶주리면 캠프에 들어온다(§3.4). 평시에는 경계에서 미끄러진다 —
       그 그림이 안전선을 눈에 보이게 만들고, "한 번만 더"를 유혹한다. */
    if (!hungry) {
      const safe = s.campfire.safeRadius
      if (safe > 0 && distance(nx, nz, CENTER, CENTER) < safe) {
        const a = Math.atan2(nz - CENTER, nx - CENTER)
        nx = CENTER + Math.cos(a) * safe
        nz = CENTER + Math.sin(a) * safe
      }
    }

    sp.x = nx
    sp.z = nz
  }
}
