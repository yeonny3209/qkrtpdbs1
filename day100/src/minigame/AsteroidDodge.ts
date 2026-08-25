/* ==================================================================
   소행성 회피

   §13 의 규칙이 이 게임의 두 번째 설계 축("빠를수록 위험하다")을
   실제 게임플레이로 만든다.

   침대를 여섯 개 깔면 일출마다 날짜가 11 씩 뛴다. 그러면 5의 배수를
   한 번에 두세 개 넘기게 되고, 넘긴 개수만큼 난이도 단계가 오른다.
   즉 46분 클리어 빌드는 매 소행성 밤마다 탄막을 뚫어야 한다.

   실패는 즉사가 아니라 **런 전체 누적 5회**다. 한 번 맞았다고
   45분이 날아가면 아무도 빠른 빌드를 안 고른다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { toast } from '../core/GameState.ts'
import { kill } from '../systems/SurvivalSystem.ts'

const A = BALANCE.asteroid

export type DodgeInput = { up: boolean; down: boolean; left: boolean; right: boolean }

export function tierFor(crossings: number): number {
  /* 1칸만 넘겼으면 1단계. 넘긴 만큼 오르고 5에서 멈춘다(§13.3). */
  return Math.max(1, Math.min(A.tiers.length, crossings))
}

export function begin(s: GameState, crossings: number): void {
  const tier = tierFor(crossings)
  s.phase = 'asteroid'
  s.asteroid = {
    active: true,
    tier,
    remain: A.durationSeconds,
    shipX: A.fieldWidth / 2,
    shipY: A.fieldHeight / 2,
    rocks: [],
    spawnT: 0,
    hitFlash: 0,
  }
  s.events.push('asteroidStart')
  toast(s, `소행성 접근 — 난이도 ${tier}단계`, 'warn')
}

function spawnRock(s: GameState): void {
  const a = s.asteroid
  const cfg = A.tiers[a.tier - 1]
  const rng = s.streams.asteroid

  /* 네 변 중 한 곳에서 들어와 반대편으로 지난다. 한 방향에서만 오면
     화면 한쪽에 붙어 있는 것이 정답이 되어 버린다. */
  const side = rng.int(4)
  const r = 9 + rng() * 16
  let x = 0
  let y = 0
  if (side === 0) { x = -r; y = rng() * A.fieldHeight }
  else if (side === 1) { x = A.fieldWidth + r; y = rng() * A.fieldHeight }
  else if (side === 2) { x = rng() * A.fieldWidth; y = -r }
  else { x = rng() * A.fieldWidth; y = A.fieldHeight + r }

  const tx = A.fieldWidth * (0.25 + rng() * 0.5)
  const ty = A.fieldHeight * (0.25 + rng() * 0.5)
  const dx = tx - x
  const dy = ty - y
  const len = Math.hypot(dx, dy) || 1
  const speed = (110 + rng() * 90) * cfg.speed

  a.rocks.push({ x, y, vx: (dx / len) * speed, vy: (dy / len) * speed, r })
}

export function update(s: GameState, dt: number, input: DodgeInput): void {
  const a = s.asteroid
  if (!a.active) return
  const cfg = A.tiers[a.tier - 1]

  a.remain -= dt
  if (a.hitFlash > 0) a.hitFlash = Math.max(0, a.hitFlash - dt)

  /* 배 조작 */
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy)
    dx /= len
    dy /= len
    a.shipX += dx * A.shipSpeed * dt
    a.shipY += dy * A.shipSpeed * dt
  }
  a.shipX = Math.min(A.fieldWidth - A.shipRadius, Math.max(A.shipRadius, a.shipX))
  a.shipY = Math.min(A.fieldHeight - A.shipRadius, Math.max(A.shipRadius, a.shipY))

  /* 소행성 생성. 밀도가 단계마다 오른다. */
  a.spawnT -= dt
  if (a.spawnT <= 0) {
    spawnRock(s)
    a.spawnT = 0.42 / cfg.density
  }

  const alive: typeof a.rocks = []
  for (const rock of a.rocks) {
    rock.x += rock.vx * dt
    rock.y += rock.vy * dt

    const hit = Math.hypot(rock.x - a.shipX, rock.y - a.shipY) <= rock.r + A.shipRadius
    if (hit && a.hitFlash <= 0) {
      s.asteroidFailures++
      a.hitFlash = 0.9
      s.events.push('asteroidHit')
      if (s.asteroidFailures >= s.allowedFailures) {
        a.active = false
        kill(s, 'asteroid')
        return
      }
      toast(s, `피격 — 누적 ${s.asteroidFailures}/${s.allowedFailures}`, 'warn')
      continue
    }

    const margin = 80
    if (
      rock.x > -margin && rock.x < A.fieldWidth + margin
      && rock.y > -margin && rock.y < A.fieldHeight + margin
    ) alive.push(rock)
  }
  a.rocks = alive

  if (a.remain <= 0) {
    a.active = false
    s.events.push('asteroidClear')
    toast(s, '소행성대 통과 — 날이 밝았습니다', 'good')
  }
}

export function isOver(s: GameState): boolean {
  return !s.asteroid.active
}
