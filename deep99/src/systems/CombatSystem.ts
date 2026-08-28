/* ==================================================================
   전투 — 근접·포탑·덫

   총은 Projectile 이 맡고, 여기는 도끼와 설치물이 사는 곳이다.

   도끼는 나무를 패는 도구이면서 무기다. 낡은 도끼가 60타에 부러지는
   규칙(§7.2)이 여기 붙어 있어서, 나무를 팬 만큼 싸울 밑천이 준다 —
   하나의 자원을 두 곳에 나눠 쓰게 만든다.
   ================================================================== */
import { ITEMS, ENEMIES } from '../data/index.ts'
import type { GameState, Beast } from '../core/GameState.ts'
import { distance, toast, removeItem, addItem, countItem } from '../core/GameState.ts'
import { damageBeast } from '../entities/Animal.ts'
import { damageRaider } from '../entities/Raider.ts'

const MELEE_ARC = Math.PI * 0.55
const MELEE_REACH = 1.55

export function meleeDamage(s: GameState): number {
  const id = s.player.equipped
  return id ? (ITEMS[id]?.melee ?? 5) : 5
}

/** 앞쪽 부채꼴 안에서 가장 가까운 하나만 벤다. 광역은 총의 몫이다. */
export function swing(s: GameState): Beast | null {
  const p = s.player
  let best: Beast | null = null
  let fromRaiders = false
  let bd = Infinity

  const consider = (b: Beast, raider: boolean) => {
    if (b.hp <= 0) return
    const def = ENEMIES[b.type]
    const d = distance(p.x, p.z, b.x, b.z) - def.radius
    if (d > MELEE_REACH) return
    let diff = Math.abs(Math.atan2(b.z - p.z, b.x - p.x) - p.facing)
    while (diff > Math.PI) diff = Math.PI * 2 - diff
    if (diff > MELEE_ARC / 2) return
    if (d < bd) {
      bd = d
      best = b
      fromRaiders = raider
    }
  }
  for (const b of s.beasts) consider(b, false)
  for (const b of s.raiders) consider(b, true)

  if (best) {
    const dmg = meleeDamage(s)
    if (fromRaiders) damageRaider(s, best, dmg)
    else damageBeast(s, best, dmg)
    wearAxe(s)
    s.events.push('melee')
  }
  return best
}

/** 낡은 도끼만 닳는다. 철·합금·절단기는 내구도가 없다(§7.2). */
export function wearAxe(s: GameState): void {
  const p = s.player
  if (p.equipped !== 'axe_old') return
  p.axeDurability--
  if (p.axeDurability <= 0) {
    p.equipped = null
    toast(s, '낡은 도끼가 부러졌습니다', 'warn')
    s.events.push('axeBroke')
  }
}

const TURRET_RANGE = 10
const TURRET_DPS = 30
const TURRET_SCRAP_INTERVAL = 10

export function updateStructures(s: GameState, dt: number): void {
  for (const b of s.buildings) {
    if (b.type === 'turret') {
      b.cooldown = (b.cooldown ?? 0) - dt
      let target: Beast | null = null
      let raider = false
      let bd = Infinity
      const consider = (x: Beast, isRaider: boolean) => {
        if (x.hp <= 0) return
        const d = distance(b.x, b.z, x.x, x.z)
        if (d <= TURRET_RANGE && d < bd) {
          bd = d
          target = x
          raider = isRaider
        }
      }
      /* 약탈자를 먼저 본다 — 포탑은 습격 방어용이다 */
      for (const x of s.raiders) consider(x, true)
      if (!target) for (const x of s.beasts) consider(x, false)
      if (!target) continue

      /* 총알 대신 고철을 먹는다. 켜 두면 자원이 새므로 "지킬 값어치가
         있는 밤인가"를 묻게 된다. */
      if ((b.cooldown ?? 0) <= 0) {
        if (countItem(s, 'scrap') <= 0) continue
        removeItem(s, 'scrap', 1)
        b.cooldown = TURRET_SCRAP_INTERVAL
      }
      if (raider) damageRaider(s, target, TURRET_DPS * dt)
      else damageBeast(s, target, TURRET_DPS * dt)
    }

    if (b.type === 'bear_trap' && b.armed) {
      const hit = [...s.raiders, ...s.beasts].find(
        (x) => x.hp > 0 && distance(b.x, b.z, x.x, x.z) <= 0.8,
      )
      if (hit) {
        if (s.raiders.includes(hit)) damageRaider(s, hit, 25)
        else damageBeast(s, hit, 25)
        hit.boundT = 2
        b.armed = false
        s.events.push('trap')
      }
    }

    if (b.type === 'rabbit_trap' && b.armed) {
      const rabbit = s.beasts.find(
        (x) => x.type === 'rabbit' && x.hp > 0 && distance(b.x, b.z, x.x, x.z) <= 0.8,
      )
      if (rabbit) {
        rabbit.hp = 0
        /* 덫으로 잡으면 고기가 셋. 총알을 안 쓰는 대신 자리를 미리
           읽어야 하는 보상이다(§7.5). */
        addItem(s, 'meat_small_raw', 3 * (s.job.effects.meatFactor ?? 1))
        b.armed = false
        s.events.push('trap')
      }
    }
  }

  /* 발동한 덫은 치운다 */
  s.buildings = s.buildings.filter(
    (b) => !((b.type === 'bear_trap' || b.type === 'rabbit_trap') && b.armed === false),
  )
  s.beasts = s.beasts.filter((b) => b.hp > 0)
}
