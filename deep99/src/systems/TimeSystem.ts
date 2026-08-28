/* ==================================================================
   시간 (§4)

   하루 = 낮 180 + 밤 120 = 300초. 일출에 날짜가 오른다.

     날짜 += 1 + 침대수 + 구출대원수 + (시간가속기 ? 3 : 0)

   이 한 줄이 매 런의 핵심 판단을 만든다 — **위험한 연구소에 들어가
   대원을 구할 것인가, 안전하게 침대를 지을 것인가.** 둘 다 +1 인데
   대원은 캠프에서 일까지 해 준다. 대신 죽을 수 있다.

   1일차는 튜토리얼이다(§18). 거미가 안 나오고, 첫 불은 강제로 붙는다.
   원작의 "튜토리얼 없음" 문제를 피하려는 것이다.
   ================================================================== */
import { BALANCE, RECIPES } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { toast } from '../core/GameState.ts'

export function bedCount(s: GameState): number {
  return s.buildings.filter((b) => RECIPES[b.type]?.bedFamily).length
}

export function hasAccelerator(s: GameState): boolean {
  return s.buildings.some((b) => b.type === 'time_accelerator')
}

export function dayRate(s: GameState): number {
  return 1 + bedCount(s) + s.crew.length + (hasAccelerator(s) ? 3 : 0)
}

export function isTutorialDay(s: GameState): boolean {
  return s.day <= BALANCE.time.tutorialDay
}

export function phaseRemaining(s: GameState): number {
  if (s.phase === 'day') return Math.max(0, s.daySeconds - s.phaseT)
  if (s.phase === 'night') return Math.max(0, s.nightSeconds - s.phaseT)
  return 0
}

/** 이번 일출로 넘어선 소행성 마일스톤들(§14). 25/50/75/99 고정이라
    날짜가 여러 칸 뛰어도 건너뛰어지지 않는다. */
export function crossedAsteroidDays(from: number, to: number, done: number[]): number[] {
  return BALANCE.asteroid.days.filter((d) => d > from && d <= to && !done.includes(d))
}

export type TimeEvent =
  | { type: 'nightWarning' }
  | { type: 'nightFall' }
  | { type: 'sunrise'; from: number; to: number; asteroids: number[] }

export function update(s: GameState, dt: number): TimeEvent[] {
  const out: TimeEvent[] = []
  if (s.phase !== 'day' && s.phase !== 'night') return out

  /* 연구소 안에서는 시간이 흐르지 않는다(§12.1). 안 그러면 3단계를
     공략하다 밤을 맞고 문이 잠긴 채로 무조건 죽는다. */
  if (s.activeLab) return out

  s.phaseT += dt
  s.elapsed += dt

  if (s.phase === 'day') {
    if (!s.warned && s.phaseT >= BALANCE.time.warnAtDaySecond) {
      s.warned = true
      out.push({ type: 'nightWarning' })
    }
    if (s.phaseT >= s.daySeconds) {
      s.phase = 'night'
      s.phaseT = 0
      s.warned = false
      out.push({ type: 'nightFall' })
    }
    return out
  }

  if (s.phaseT >= s.nightSeconds) out.push(sunrise(s))
  return out
}

/** 소행성 밤을 버텨 낸 뒤 바로 아침으로(§14.1) */
export function forceSunrise(s: GameState): TimeEvent {
  return sunrise(s)
}

function sunrise(s: GameState): TimeEvent {
  const from = s.day
  const rate = dayRate(s)
  const to = from + rate

  s.day = to
  s.phase = 'day'
  s.phaseT = 0
  s.warned = false
  s.spiders.length = 0

  /* 밭은 실시간이 아니라 날짜로 자란다 */
  for (const b of s.buildings) {
    if (b.type === 'farm') b.timerDays = (b.timerDays ?? 0) + rate
  }

  const asteroids = crossedAsteroidDays(from, to, s.asteroidDone)
  if (rate > 1) toast(s, `${rate}일이 지났습니다`, 'info')

  return { type: 'sunrise', from, to, asteroids }
}

/** 다음 소행성 밤까지 남은 일수 — 관측기가 있을 때만 보여 준다(§8.4) */
export function daysToAsteroid(s: GameState): number | null {
  const next = BALANCE.asteroid.days.find((d) => d > s.day || (d >= s.day && !s.asteroidDone.includes(d)))
  return next === undefined ? null : Math.max(0, next - s.day)
}
