/* ==================================================================
   생존 — 산소·우주복·배고픔·스태미나 (§5)

   우주복이 곧 체력이다. 별도 HP 바가 없다. 산소가 마르면 우주복이
   깎이고, 배가 고파도 깎이고, 맞아도 깎인다. 죽는 길이 하나뿐이라
   UI 가 단순해지고, "회복 캡슐 말고는 못 고친다"가 무겁게 느껴진다.

   ── 달리기는 배고픔을 3배로 먹는다 (§5, 원작 그대로)

   이게 있어야 "급하지 않으면 걷는 게 이득"이라는 판단이 생긴다. 없으면
   모두가 항상 달리고, 스태미나는 그냥 쿨타임이 된다.
   ================================================================== */
import { BALANCE, CAMPFIRE, ITEMS } from '../data/index.ts'
import type { GameState, DeathCause } from '../core/GameState.ts'
import { inCampfire, countItem, removeItem } from '../core/GameState.ts'

const P = BALANCE.player

export function kill(s: GameState, cause: DeathCause): void {
  if (s.phase === 'dead' || s.phase === 'escaped') return
  s.phase = 'dead'
  s.death = { cause, day: s.day }
  s.events.push('death')
}

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

/** 산소 소모 배율 — 모디파이어와 직책이 곱해진다 */
export function oxygenFactor(s: GameState): number {
  return (s.modifier.effects.oxygenDrainFactor ?? 1) * (s.job.effects.oxygenDrainFactor ?? 1)
}

export function update(s: GameState, dt: number): void {
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return
  const p = s.player
  const safe = inCampfire(s)

  /* 산소 — 불이 살아 있는 캠프 안에서만 찬다(§3.4: 꺼지면 회복 안 됨).

     extinguished 를 따로 안 본다. inCampfire 가 이미 level > 0 을 요구하고,
     불이 꺼지면 레벨이 0이라 safe 자체가 거짓이 된다. 두 번 검사하면
     변이 시험에서 지워도 아무 일이 안 일어나는 죽은 조건이 된다. */
  if (safe) {
    p.oxygen = Math.min(p.maxOxygen, p.oxygen + CAMPFIRE.oxygenRegen * dt)
  } else {
    p.oxygen = Math.max(0, p.oxygen - P.oxygenDrain * oxygenFactor(s) * dt)
  }

  /* 배고픔은 어디서든 준다. 달리면 3배(§5). */
  const hungerRate = P.hungerDrainWalk * (p.running ? P.hungerRunMultiplier : 1)
  p.hunger = Math.max(0, p.hunger - hungerRate * dt)

  if (p.oxygen <= 0) damageSuit(s, P.suitDrainNoOxygen * dt, 'oxygen')
  if (p.hunger <= 0) damageSuit(s, P.suitDrainNoFood * dt, 'hunger')

  if (p.running) {
    p.stamina = Math.max(0, p.stamina - P.staminaDrain * dt)
    if (p.stamina <= 0) p.running = false
  } else {
    p.stamina = Math.min(P.maxStamina, p.stamina + P.staminaRegen * dt)
  }

  if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt)
  if (p.reloadT > 0) {
    p.reloadT = Math.max(0, p.reloadT - dt)
    if (p.reloadT === 0) finishReload(s)
  }

  /* 손전등 배터리(§10.3). 이게 있어야 횃불이 산다. */
  if (p.flashlightOn) {
    p.flashlightBattery = Math.max(0, p.flashlightBattery - dt)
    if (p.flashlightBattery <= 0) {
      p.flashlightOn = false
      s.events.push('flashlightDead')
    }
  } else if (safe && !s.campfire.extinguished) {
    const rate = p.maxFlashlightBattery / CAMPFIRE.flashlightRechargeSeconds
    p.flashlightBattery = Math.min(p.maxFlashlightBattery, p.flashlightBattery + rate * dt)
  }
}

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
  const take = Math.min(def.mag - p.magazine, countItem(s, ammoIdFor(p.gun)))
  if (take > 0) {
    removeItem(s, ammoIdFor(p.gun), take)
    p.magazine += take
  }
}

/** 음식. 날고기는 배를 채우되 우주복을 깎는다(§7.5). 스튜는 산소도 준다. */
export function eat(s: GameState, id: string): boolean {
  const def = ITEMS[id]
  if (!def || def.kind !== 'food') return false
  if (!removeItem(s, id, 1)) return false
  s.player.hunger = Math.min(s.player.maxHunger, s.player.hunger + (def.hunger ?? 0))
  if (def.oxygen) {
    s.player.oxygen = Math.min(s.player.maxOxygen, s.player.oxygen + def.oxygen)
  }
  if (def.suitCost) damageSuit(s, def.suitCost, 'suit')
  s.events.push('eat')
  return true
}

/** 붕대 — 보급함에서 나온다. 우주복을 조금 고치는 유일한 소모품. */
export function useBandage(s: GameState): boolean {
  if (!removeItem(s, 'bandage', 1)) return false
  s.player.suit = Math.min(s.player.maxSuit, s.player.suit + 25)
  s.events.push('eat')
  return true
}
