/* ==================================================================
   시간

   하루 = 낮 180 + 밤 120 = 300초. 일출에 날짜가 오른다.

     날짜 += 1 + 침대수 + 보유 핵심부품수      (§5.2, §12.3)

   여기서 이 게임의 중심 트레이드오프가 나온다. 침대를 깔수록 100일이
   빨리 오지만, 5의 배수를 한 번에 여러 개 뛰어넘게 되고 그만큼
   소행성이 세진다(§13.1). 그래서 "몇 칸을 넘겼는가"를 세서
   AsteroidDodge 에 넘긴다.
   ================================================================== */
import { BALANCE, RECIPES } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { toast } from '../core/GameState.ts'

export function bedCount(s: GameState): number {
  let n = 0
  for (const b of s.buildings) {
    const r = RECIPES[b.type]
    if (r?.dayRateBonus) n += r.dayRateBonus
  }
  return n
}

export function dayRate(s: GameState): number {
  return 1 + bedCount(s) + s.coreParts.length
}

export function asteroidStride(s: GameState): number {
  return s.modifier.effects.asteroidEveryDays ?? BALANCE.asteroid.everyDays
}

/** 이번 일출로 5의 배수를 몇 번 넘겼는가 — 소행성 난이도 단계가 된다. */
export function crossings(fromDay: number, toDay: number, stride: number): number {
  return Math.floor(toDay / stride) - Math.floor(fromDay / stride)
}

export function isDay(s: GameState): boolean {
  return s.phase === 'day'
}

export function phaseRemaining(s: GameState): number {
  if (s.phase === 'day') return Math.max(0, s.daySeconds - s.phaseT)
  if (s.phase === 'night') return Math.max(0, s.nightSeconds - s.phaseT)
  return 0
}

export type TimeEvent =
  | { type: 'nightWarning' }
  | { type: 'nightFall' }
  | { type: 'sunrise'; newDay: number; crossings: number }

export function update(s: GameState, dt: number): TimeEvent[] {
  const out: TimeEvent[] = []
  if (s.phase !== 'day' && s.phase !== 'night') return out

  /* 연구소 안에서는 시간이 흐르지 않는다(§12.1). 안 그러면 3단계를
     공략하다 밤을 맞고, 문이 잠긴 채로 무조건 죽는다. */
  if (s.activeLab) return out

  s.phaseT += dt
  s.elapsed += dt

  if (s.phase === 'day') {
    if (!s.warned && s.phaseT >= BALANCE.time.warnAtDaySecond) {
      s.warned = true
      out.push({ type: 'nightWarning' })
      toast(s, '밤이 오고 있습니다. 우주선으로 돌아가세요', 'warn')
    }
    if (s.phaseT >= s.daySeconds) {
      s.phase = 'night'
      s.phaseT = 0
      s.warned = false
      out.push({ type: 'nightFall' })
    }
    return out
  }

  /* 밤 */
  if (s.phaseT >= s.nightSeconds) {
    out.push(sunrise(s))
  }
  return out
}

/** 밤을 건너뛰고 바로 아침으로. 소행성을 버텨 낸 보상(§13.2). */
export function forceSunrise(s: GameState): TimeEvent {
  return sunrise(s)
}

function sunrise(s: GameState): TimeEvent {
  const stride = asteroidStride(s)
  const from = s.day
  const rate = dayRate(s)
  s.day = from + rate
  s.phase = 'day'
  s.phaseT = 0
  s.warned = false
  s.spiders.length = 0

  const crossed = crossings(from, s.day, stride)
  s.nextAsteroidDay = (Math.floor(s.day / stride) + 1) * stride

  /* 밭은 실시간이 아니라 날짜로 자란다. 날짜가 뛰면 같이 뛴다. */
  for (const b of s.buildings) {
    if (b.type !== 'farm') continue
    b.timerDays = (b.timerDays ?? 0) + rate
  }

  return { type: 'sunrise', newDay: s.day, crossings: crossed }
}

/** 다음 소행성까지 남은 일수. 관측기가 있을 때만 보여 준다(§8.3). */
export function daysToAsteroid(s: GameState): number {
  return Math.max(0, s.nextAsteroidDay - s.day)
}
