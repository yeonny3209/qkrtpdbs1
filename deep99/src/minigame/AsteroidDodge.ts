/* ==================================================================
   소행성 밤 — 보스 밤 (§14)

   25 / 50 / 75 / 99일. 런당 정확히 네 번.

   ── 왜 "5일마다"에서 "고정 마일스톤"으로 바꿨나 (§14.2)

   5일마다로 두면 침대로 날짜가 여러 칸 점프할 때 건너뛰어진다. 고정
   네 번으로 바꾸니 (1) 건너뛰기가 사라지고 (2) 희소해져 임팩트가 커지고
   (3) **운석 파편이 정확히 여기서만 나와** 제작 Lv5 와 물린다.

   실패는 즉사가 아니라 런 전체 누적 5회다. 한 번 맞았다고 45분이
   날아가면 아무도 이 콘텐츠를 반기지 않는다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { toast, addItem, banner } from '../core/GameState.ts'
import { kill } from '../systems/SurvivalSystem.ts'

const A = BALANCE.asteroid

export type DodgeInput = { up: boolean; down: boolean; left: boolean; right: boolean }

/** 몇 번째 소행성 밤인가 → 난이도 단계.

    날짜가 뛰어서 25·50·75·99 를 정확히 안 밟을 수 있으므로, "그날까지
    지나온 마일스톤이 몇 개인가"로 센다. 정확히 밟은 경우도 같은 답이
    나오므로 특례를 따로 두지 않는다. */
export function tierForDay(day: number): number {
  const passed = A.days.filter((d) => d <= day).length
  return Math.min(A.tiers.length, Math.max(1, passed))
}

export function begin(s: GameState, day: number): void {
  const tier = Math.min(A.tiers.length, Math.max(1, tierForDay(day)))
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
  banner(s, `소행성대 진입 — ${tier}단계`, 3)
}

function spawnRock(s: GameState): void {
  const a = s.asteroid
  const cfg = A.tiers[a.tier - 1]
  const rng = s.streams.asteroid

  /* 네 변 중 한 곳에서 들어와 가운데를 지난다. 한쪽에서만 오면
     화면 구석에 붙어 있는 것이 정답이 되어 버린다. */
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

  a.spawnT -= dt
  if (a.spawnT <= 0) {
    spawnRock(s)
    a.spawnT = 0.42 / cfg.density
  }

  /* 직책 '조종사'는 피격 판정이 25% 작다(§16.3) */
  const hitR = A.shipRadius * (s.job.effects.asteroidHitboxFactor ?? 1)
  const alive: typeof a.rocks = []
  for (const rock of a.rocks) {
    rock.x += rock.vx * dt
    rock.y += rock.vy * dt

    if (a.hitFlash <= 0 && Math.hypot(rock.x - a.shipX, rock.y - a.shipY) <= rock.r + hitR) {
      s.asteroidFailures++
      a.hitFlash = 0.9
      s.events.push('asteroidHit')
      if (s.asteroidFailures >= s.allowedFailures) {
        a.active = false
        kill(s, 'asteroid')
        return
      }
      toast(s, `피격 — 누적 ${s.asteroidFailures}/${s.allowedFailures}`, 'danger')
      continue
    }

    const m = 80
    if (rock.x > -m && rock.x < A.fieldWidth + m && rock.y > -m && rock.y < A.fieldHeight + m) {
      alive.push(rock)
    }
  }
  a.rocks = alive

  if (a.remain <= 0) {
    a.active = false
    /* 성공 보상 — 운석 파편. 제작 Lv5 로 가는 유일한 길이다. */
    const left = addItem(s, 'meteorite', A.fragmentReward)
    s.events.push('asteroidClear')
    toast(
      s,
      left > 0 ? '소행성대 통과 — 가방이 가득 차 파편을 놓쳤습니다' : `소행성대 통과 — 운석 파편 ${A.fragmentReward}개`,
      left > 0 ? 'warn' : 'good',
    )
  }
}

export function isOver(s: GameState): boolean {
  return !s.asteroid.active
}
