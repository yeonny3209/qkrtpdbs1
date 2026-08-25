/* ==================================================================
   캠프파이어 — 게임의 심장

   현재 레벨 = **지금 타고 있는 연료 중 최고 등급**(§9.1). 이게 요점이다.
   기름 통이 다 타면 통나무가 남아 있어도 즉시 Lv1 로 떨어진다.
   "쌓아 둔 것"이 아니라 "지금 타는 것"이 안전반경을 정하므로,
   밤에 나가기 전에 무엇을 넣고 나갈지가 매번 판단이 된다.

   불이 꺼지면 밤이 지옥이 된다(§9.3) — 거미가 플레이어보다 빨라지고,
   두 마리가 되고, 손전등이 절반만 듣는다. 그 규칙은 Spider 쪽에 있고
   여기서는 "지금 몇 레벨인가"만 정직하게 계산한다.
   ================================================================== */
import { BALANCE, FUEL } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { addItem, removeItem, toast } from '../core/GameState.ts'

const LEVELS = BALANCE.campfire.levels

export function radiusForLevel(level: number, pillars: number): number {
  const base = LEVELS.find((l) => l.level === level)?.safeRadius ?? 0
  if (base <= 0) return 0
  return base + pillars * BALANCE.campfire.expansionPillarRadius
}

export function pillarCount(s: GameState): number {
  return s.buildings.filter((b) => b.type === 'camp_pillar').length
}

/** 지금 타는 연료 중 최고 등급이 곧 레벨이다. */
export function currentLevel(s: GameState): number {
  let best = 0
  for (const f of s.campfire.burning) {
    if (f.remain > 0 && f.grade > best) best = f.grade
  }
  return best
}

/** 이 연료를 넣을 수 있는가. 상위 연료는 불을 한 번 키워 본 뒤에 열린다(§7.4). */
export function fuelUnlocked(s: GameState, item: string): boolean {
  const def = FUEL[item]
  if (!def) return false
  /* 등급 1(통나무)은 언제나. 그 위는 "최고 도달 레벨"이 한 단계 아래에 닿아야 한다. */
  return def.grade <= 1 || s.campfire.bestLevel >= def.grade - 1
}

export function addFuel(s: GameState, item: string): boolean {
  const def = FUEL[item]
  if (!def) return false
  if (!fuelUnlocked(s, item)) {
    toast(s, '아직 이 연료를 다룰 수 없습니다', 'warn')
    return false
  }
  if (!removeItem(s, item, 1)) return false
  s.campfire.burning.push({ item, grade: def.grade, remain: def.burnSeconds })
  s.events.push('fuelAdded')
  return true
}

export function startCooking(s: GameState, raw: string): boolean {
  if (s.campfire.level <= 0) return false
  if (s.campfire.cooking) return false
  const map: Record<string, { out: string; sec: number }> = {
    meat_small_raw: { out: 'meat_small_cooked', sec: BALANCE.campfire.cookSmallSeconds },
    meat_large_raw: { out: 'meat_large_cooked', sec: BALANCE.campfire.cookLargeSeconds },
  }
  const plan = map[raw]
  if (!plan) return false
  if (!removeItem(s, raw, 1)) return false
  s.campfire.cooking = { item: plan.out, remain: plan.sec }
  return true
}

export function update(s: GameState, dt: number): void {
  const fire = s.campfire

  /* 높은 등급부터 태운다.

     반대로 하면 §9.1 이 말하는 순간이 영영 안 온다. 레벨은 "지금 타는
     것 중 최고 등급"이라, 낮은 것부터 태우면 기름은 맨 마지막까지
     남아서 그 시간 내내 Lv3 다. 기름 하나로 밤을 통째로 사 버리는 셈이다.

     높은 것부터 태우면 기름 240초 동안 Lv3, 그 뒤로 뚝 떨어진다. 그게
     "기름이 다 타면 통나무가 남아 있어도 즉시 Lv1" 이고, 밤에 나가기 전
     무엇을 넣고 나갈지가 매번 판단이 되는 이유다. */
  let budget = dt
  fire.burning.sort((a, b) => b.grade - a.grade)
  while (budget > 0 && fire.burning.length > 0) {
    const head = fire.burning[0]
    const used = Math.min(budget, head.remain)
    head.remain -= used
    budget -= used
    if (head.remain <= 0) fire.burning.shift()
    else break
  }

  const level = currentLevel(s)
  if (level > fire.bestLevel) {
    fire.bestLevel = level
    s.events.push('campLevelUp')
    toast(s, `캠프파이어 Lv${level} — 상위 연료가 나타나기 시작합니다`, 'good')
  }
  fire.level = level
  fire.safeRadius = radiusForLevel(level, pillarCount(s))

  if (fire.cooking) {
    fire.cooking.remain -= dt
    if (fire.cooking.remain <= 0) {
      const leftover = addItem(s, fire.cooking.item, 1)
      if (leftover > 0) toast(s, '가방이 가득 차 고기가 탔습니다', 'warn')
      else toast(s, '고기가 익었습니다', 'good')
      fire.cooking = null
    }
  }
}

/** 남은 총 연소 시간 — HUD 가 불이 언제 꺼질지 보여 줄 때 쓴다. */
export function burnRemaining(s: GameState): number {
  return s.campfire.burning.reduce((a, f) => a + f.remain, 0)
}
