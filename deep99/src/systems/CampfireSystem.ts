/* ==================================================================
   캠프파이어 — 게임의 심장 (§3)

   이 게임의 다른 모든 것이 여기에 매달려 있다. 단일 **화력 수치**
   하나가 레벨을 정하고, 레벨이 안전반경·개방 반경·몹 등급·보급함
   등급을 전부 정한다.

   ── 두 개의 레벨을 구별하는 것이 요점이다

     level           지금 화력이 속한 구간. 야간 안전반경을 정한다.
     maxReachedLevel 이번 런에서 찍은 최고. 개방 반경과 몹 등급을 정한다.

   전자는 오르내리고 후자는 오르기만 한다. 그래야 "불이 꺼지면 당장
   위험하지만, 이미 열어 둔 땅이 닫혀 억울하게 죽지는 않는다"가 된다.
   (§3.3 확정)

   ── 화력은 쌓이는 게 아니라 새는 것이다

   연료를 넣으면 heat 이 오르고, 매 초 drain 만큼 샌다. drain 은
   레벨이 높을수록 크다 — Lv6 은 초당 3이라 1500을 유지하려면 8분마다
   가스 통 다섯 개다. 후반 게임 전체가 "가스 통을 어디서 더 구하나"로
   바뀌는 것이 의도다(§3.2).

   습격에 실패하면 drain 이 2배가 된다. 이 게임에서 가장 무서운
   디버프고, §부록B-6 이 "너무 가혹한가" 의심하는 부분이다.
   ================================================================== */
import {
  BALANCE, CAMPFIRE, FUELS, fireLevelDef, levelForHeat,
} from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { addItem, removeItem, toast, banner } from '../core/GameState.ts'

/** 이 연료를 넣을 수 있는가. 상위 연료는 불을 키워 본 뒤에 나타난다(§3.2). */
export function fuelUnlocked(s: GameState, item: string): boolean {
  const def = FUELS[item]
  if (!def) return false
  return s.campfire.maxReachedLevel >= def.unlockLevel
}

/** 직책 '화부'는 화력이 30% 더 오른다(§16.3). */
export function heatOf(s: GameState, item: string): number {
  const def = FUELS[item]
  if (!def) return 0
  return def.heat * (s.job.effects.fuelHeatFactor ?? 1)
}

export function addFuel(s: GameState, item: string): boolean {
  if (!FUELS[item]) return false
  if (!fuelUnlocked(s, item)) {
    toast(s, '아직 이 연료를 다룰 수 없습니다', 'warn')
    return false
  }
  if (!removeItem(s, item, 1)) return false
  s.campfire.heat += heatOf(s, item)
  s.events.push('fuelAdded')
  return true
}

/** 대원 로한이 저장고에서 자동으로 넣을 때 쓴다 — 가방을 안 거친다. */
export function addFuelDirect(s: GameState, item: string): void {
  s.campfire.heat += heatOf(s, item)
  s.events.push('fuelAdded')
}

/** 지금 새는 속도. 레벨 · 습격 실패 · 산성비 · 모디파이어가 곱해진다. */
export function drainRate(s: GameState): number {
  const def = fireLevelDef(s.campfire.level)
  if (!def) return 0
  let m = s.campfire.drainMultiplier
  if (s.weather.kind === 'acid_rain' && !hasStabilizer(s)) m *= CAMPFIRE.acidRainMultiplier
  m *= s.modifier.effects.drainFactor ?? 1
  return def.drain * m
}

export function hasStabilizer(s: GameState): boolean {
  return s.buildings.some((b) => b.type === 'weather_stabilizer')
}

export function startCooking(s: GameState, raw: string): boolean {
  if (s.campfire.level <= 0 || s.campfire.cooking) return false
  const map: Record<string, { out: string; sec: number }> = {
    meat_small_raw: { out: 'meat_small_cooked', sec: CAMPFIRE.cookSmallSeconds },
    meat_large_raw: { out: 'meat_large_cooked', sec: CAMPFIRE.cookLargeSeconds },
  }
  const plan = map[raw]
  if (!plan) return false
  if (!removeItem(s, raw, 1)) return false
  s.campfire.cooking = { item: plan.out, remain: plan.sec }
  return true
}

export function update(s: GameState, dt: number): void {
  const fire = s.campfire
  const before = fire.level

  fire.heat = Math.max(0, fire.heat - drainRate(s) * dt)
  fire.level = levelForHeat(fire.heat)

  /* Lv1 문턱(1) 아래로 떨어진 잔불은 불이 아니다.

     여기서 안 지우면 heat 이 0.3 같은 값에 갇힌다 — 레벨이 0이라
     drain 도 0이 되어 영영 안 줄고, 그렇다고 0도 아니라서 "꺼졌다"로
     안 읽힌다. 안전반경은 0인데 굶주림 판정은 안 켜지는 어긋난 상태다. */
  if (fire.level <= 0) fire.heat = 0
  if (fire.level > fire.maxReachedLevel) {
    fire.maxReachedLevel = fire.level
    s.events.push('fireLevelUp')
    const def = fireLevelDef(fire.level)
    toast(s, `캠프파이어 Lv${fire.level} — 반경 ${def?.openRadius}타일까지 열렸습니다`, 'good')
  }

  const def = fireLevelDef(fire.level)
  fire.safeRadius = def?.safeRadius ?? 0
  const maxDef = fireLevelDef(fire.maxReachedLevel)
  fire.openRadius = maxDef?.openRadius ?? 0

  /* 꺼짐 판정. 여기가 §3.4 의 전부다 — 거미가 굶주리고 캠프까지 들어온다. */
  const wasOut = fire.extinguished
  /* 레벨로 판단한다. 화력 수치로 보면 문턱 아래 잔불이 새어 나간다. */
  fire.extinguished = fire.level <= 0
  if (fire.extinguished && !wasOut) {
    s.events.push('fireOut')
    banner(s, '캠프파이어가 꺼졌습니다. 더 이상 안전하지 않습니다.', 5)
  }
  if (!fire.extinguished && wasOut && fire.heat > 0) {
    s.events.push('fireLit')
  }
  if (before > 0 && fire.level < before) s.events.push('fireDrop')

  if (fire.cooking) {
    fire.cooking.remain -= dt
    if (fire.cooking.remain <= 0) {
      const left = addItem(s, fire.cooking.item, 1)
      toast(s, left > 0 ? '가방이 가득 차 고기가 탔습니다' : '고기가 익었습니다', left > 0 ? 'warn' : 'good')
      fire.cooking = null
    }
  }
}

/** 지금 화력으로 몇 초 더 버티는가 — HUD 가 보여 준다. */
export function secondsLeft(s: GameState): number {
  const rate = drainRate(s)
  if (rate <= 0) return 0
  return s.campfire.heat / rate
}

/** 다음 레벨까지 얼마나 남았나 */
export function heatToNextLevel(s: GameState): number {
  const next = fireLevelDef(s.campfire.level + 1)
  if (!next) return 0
  return Math.max(0, next.min - s.campfire.heat)
}

/** 이 레벨 구간 안에서의 진행도 0~1 — 게이지용 */
export function levelProgress(s: GameState): number {
  const cur = fireLevelDef(s.campfire.level)
  const next = fireLevelDef(s.campfire.level + 1)
  if (!cur) return Math.min(1, s.campfire.heat / BALANCE.map.tileSize)
  if (!next) return 1
  const span = next.min - cur.min
  return Math.min(1, Math.max(0, (s.campfire.heat - cur.min) / span))
}
