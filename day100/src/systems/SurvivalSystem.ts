/* ==================================================================
   생존 — 산소·배고픔·우주복·스태미나

   §4 의 핵심 결정: HP 바가 따로 없다. **우주복이 곧 체력**이다.
   그래서 산소가 마르면 우주복이 깎이고, 배가 고파도 우주복이 깎이고,
   맞아도 우주복이 깎인다. 죽는 길이 하나뿐이라 UI 가 단순해지고,
   "우주복은 캡슐 말고는 못 고친다"는 규칙이 실제로 무겁게 느껴진다.

   회복 불가라는 게 이 게임에서 가장 잔인한 규칙이고, §부록B-3 이
   먼저 의심하라고 지목한 부분이기도 하다. 캡슐 쿨타임만 바꾸면
   그 잔인함을 조절할 수 있게 값은 JSON 에 뒀다.
   ================================================================== */
import { BALANCE, ITEMS, zoneAt } from '../data/index.ts'
import type { GameState, DeathCause } from '../core/GameState.ts'
import { inCampfire, distance, countItem, removeItem } from '../core/GameState.ts'
import { CENTER } from '../world/Tilemap.ts'

const P = BALANCE.player

export function kill(s: GameState, cause: DeathCause): void {
  if (s.phase === 'dead' || s.phase === 'escaped') return
  s.phase = 'dead'
  s.death = { cause, day: s.day }
  s.events.push('death')
}

/** 우주복 피해. 무적 프레임이 없다 — 거미 앞에서 봐주지 않기 위해서다. */
export function damageSuit(s: GameState, amount: number, cause: DeathCause): void {
  if (s.phase === 'dead' || s.phase === 'escaped') return
  s.player.suit = Math.max(0, s.player.suit - amount)
  s.events.push('suitHit')
  if (s.player.suit <= 0) kill(s, cause)
}

export function healFull(s: GameState): void {
  s.player.suit = s.player.maxSuit
  s.player.oxygen = s.player.maxOxygen
}

/** 이 자리의 산소 소모 배율. 4존은 1.5배(§6.2), 모디파이어가 또 곱한다. */
export function oxygenFactorAt(s: GameState): number {
  const zone = zoneAt(distance(s.player.x, s.player.z, CENTER, CENTER))
  return zone.oxygenFactor * (s.modifier.effects.oxygenDrainFactor ?? 1)
}

export function update(s: GameState, dt: number): void {
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return
  const p = s.player
  const safe = inCampfire(s)

  /* 산소 — 불 안에서는 차고, 밖에서는 마른다 */
  if (safe) {
    p.oxygen = Math.min(p.maxOxygen, p.oxygen + P.oxygenRegen * dt)
  } else {
    p.oxygen = Math.max(0, p.oxygen - P.oxygenDrain * oxygenFactorAt(s) * dt)
  }

  /* 배고픔은 어디서든 준다. 캠프가 안식처이긴 해도 식량 문제는 안 풀어 준다. */
  p.hunger = Math.max(0, p.hunger - P.hungerDrain * dt)

  if (p.oxygen <= 0) damageSuit(s, P.suitDrainNoOxygen * dt, 'oxygen')
  if (p.hunger <= 0) damageSuit(s, P.suitDrainNoFood * dt, 'hunger')

  /* 스태미나. 달리는 중일 때만 준다. */
  if (p.running) {
    p.stamina = Math.max(0, p.stamina - P.staminaDrain * dt)
    if (p.stamina <= 0) p.running = false
  } else {
    p.stamina = Math.min(P.maxStamina, p.stamina + P.staminaRegen * dt)
  }

  if (p.invulnT > 0) p.invulnT = Math.max(0, p.invulnT - dt)
  if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt)
  if (p.reloadT > 0) {
    p.reloadT = Math.max(0, p.reloadT - dt)
    if (p.reloadT === 0) finishReload(s)
  }

  /* 손전등 배터리. 켜 두면 준다 — 이게 있어야 횃불이 산다(§10.3). */
  if (p.flashlightOn) {
    p.flashlightBattery = Math.max(0, p.flashlightBattery - dt)
    if (p.flashlightBattery <= 0) {
      p.flashlightOn = false
      s.events.push('flashlightDead')
    }
  } else if (safe) {
    /* 캠프 옆에서 충전. 20초면 가득 찬다. */
    const rate = p.maxFlashlightBattery / BALANCE.spider.flashlightRechargeSeconds
    p.flashlightBattery = Math.min(p.maxFlashlightBattery, p.flashlightBattery + rate * dt)
  }
}

/* 재장전은 총 종류마다 시간이 다르고, 인벤토리의 탄약을 실제로 먹는다. */

export function ammoIdFor(gun: string): string {
  return `ammo_${gun}`
}

export function startReload(s: GameState): boolean {
  const p = s.player
  if (!p.gun || p.reloadT > 0) return false
  const def = ITEMS[p.gun]
  if (!def?.mag || p.magazine >= def.mag) return false
  if (countItem(s, ammoIdFor(p.gun)) <= 0) return false
  p.reloadT = def.reloadSec ?? 1.5
  s.events.push('reload')
  return true
}

function finishReload(s: GameState): void {
  const p = s.player
  if (!p.gun) return
  const def = ITEMS[p.gun]
  if (!def?.mag) return
  const want = def.mag - p.magazine
  const have = countItem(s, ammoIdFor(p.gun))
  const take = Math.min(want, have)
  if (take > 0) {
    removeItem(s, ammoIdFor(p.gun), take)
    p.magazine += take
  }
}

/** 음식 먹기. 날고기는 배는 채우되 우주복을 깎는다(§7.5). */
export function eat(s: GameState, id: string): boolean {
  const def = ITEMS[id]
  if (!def || def.kind !== 'food') return false
  if (!removeItem(s, id, 1)) return false
  s.player.hunger = Math.min(s.player.maxHunger, s.player.hunger + (def.hunger ?? 0))
  if (def.suitCost) damageSuit(s, def.suitCost, 'suit')
  s.events.push('eat')
  return true
}
