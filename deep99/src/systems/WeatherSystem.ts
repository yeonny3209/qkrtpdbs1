/* ==================================================================
   날씨 (§15)

   셋 다 캠프파이어에 악영향이다. 날씨가 "예쁜 연출"이 아니라 "불이
   더 빨리 샌다"로 오게 하려는 것이다.

     산성비    화력 감소 1.5배 + 우주복이 조금씩 깎인다
     자기폭풍  나침반·지도 무력화 + 5초 이상 서 있으면 낙뢰
     포자 안개 시야 50% 감소 — 거미가 코앞까지 안 보인다

   ── 낙뢰를 제한한 이유 (§15 각주)

   원작은 5초 이상 가만히 있으면 낙뢰가 떨어지는데 평이 매우 나쁘다.
   여기서는 **자기폭풍 중에만**, 그리고 1.5초 예고음을 준 뒤에만
   떨어뜨린다. 인벤토리를 열어 두고 생각하는 것까지 벌하지는 않는다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState, WeatherKind } from '../core/GameState.ts'
import { toast } from '../core/GameState.ts'
import { damageSuit } from './SurvivalSystem.ts'
import { hasStabilizer } from './CampfireSystem.ts'

const W = BALANCE.weather

const KINDS: WeatherKind[] = ['acid_rain', 'magnetic_storm', 'spore_fog']

export const WEATHER_NAME: Record<WeatherKind, string> = {
  clear: '맑음',
  acid_rain: '산성비',
  magnetic_storm: '자기폭풍',
  spore_fog: '포자 안개',
}

/** 기상 안정기가 있으면 산성비·자기폭풍이 무효다(§8.6). 안개는 시야라 남는다. */
export function effective(s: GameState): WeatherKind {
  if (s.weather.kind === 'clear') return 'clear'
  if (hasStabilizer(s) && s.weather.kind !== 'spore_fog') return 'clear'
  return s.weather.kind
}

/** 일출마다 굴린다. 50일 이후 빈도 2배(§15). */
export function rollForDay(s: GameState): void {
  if (s.day < s.weather.nextCheckDay) return
  s.weather.nextCheckDay = s.day + 1

  if (s.weather.remain > 0) return

  let chance = W.chancePerDay
  if (s.day >= W.lateGameDay) chance *= W.lateGameMultiplier

  const rng = s.streams.weather
  if (!rng.chance(Math.min(0.9, chance))) return

  s.weather.kind = rng.pick(KINDS)
  s.weather.remain = rng.range(W.minSeconds, W.maxSeconds)
  toast(s, `${WEATHER_NAME[s.weather.kind]}가 시작되었습니다`, 'warn')
  s.events.push('weather')
}

export function update(s: GameState, dt: number): void {
  if (s.phase === 'dead' || s.phase === 'escaped') return

  if (s.weather.remain > 0) {
    s.weather.remain -= dt
    if (s.weather.remain <= 0) {
      s.weather.kind = 'clear'
      s.player.stormWarnT = 0
      toast(s, '날씨가 개었습니다', 'good')
    }
  }

  const kind = effective(s)
  if (kind === 'clear') {
    s.player.stormWarnT = 0
    return
  }

  /* 산성비 — 우주복이 서서히 깎인다. 캠프 안이라고 봐주지 않는다. */
  if (kind === 'acid_rain') {
    damageSuit(s, W.acidSuitDrain * dt, 'suit')
  }

  /* 자기폭풍 — 오래 서 있으면 낙뢰. 예고를 먼저 준다. */
  if (kind === 'magnetic_storm') {
    const p = s.player
    if (p.stillT >= W.stormStillSeconds) {
      if (p.stormWarnT <= 0) {
        p.stormWarnT = W.stormWarnSeconds
        s.events.push('stormWarn')
      } else {
        p.stormWarnT -= dt
        if (p.stormWarnT <= 0) {
          damageSuit(s, W.stormDamage, 'storm')
          s.events.push('lightning')
          p.stillT = 0
          p.stormWarnT = 0
        }
      }
    } else {
      p.stormWarnT = 0
    }
  }
}

/** 시야 배율 — 포자 안개와 모디파이어가 곱해진다 */
export function visionFactor(s: GameState): number {
  const base = s.modifier.effects.visionFactor ?? 1
  return effective(s) === 'spore_fog' ? base * W.fogVisionFactor : base
}

/** 자기폭풍 중에는 나침반과 지도가 안 듣는다(§15) */
export function navDisabled(s: GameState): boolean {
  return effective(s) === 'magnetic_storm'
}
