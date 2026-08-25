/* ==================================================================
   전투 — 근접·포탑·덫

   총은 Projectile 이 맡고, 여기서는 도끼와 설치물이 사는 곳이다.

   도끼는 나무를 패는 도구이면서 무기다. 낡은 도끼가 60타 만에
   부러지는 규칙(§7.2 확정)이 여기 붙어 있어서, 나무를 팬 만큼
   싸울 밑천이 준다 — 하나의 자원을 두 곳에 나눠 쓰게 만든다.
   ================================================================== */
import { ITEMS, ENEMIES } from '../data/index.ts'
import type { GameState, Beast } from '../core/GameState.ts'
import { distance, toast, removeItem, addItem, countItem } from '../core/GameState.ts'
import { damageBeast } from '../entities/Animal.ts'

const MELEE_ARC = Math.PI * 0.55
const MELEE_REACH = 1.55

export function meleeDamage(s: GameState): number {
  const id = s.player.equipped
  if (!id) return 5
  return ITEMS[id]?.melee ?? 5
}

/** 앞쪽 부채꼴 안에서 가장 가까운 한 마리만 벤다. 광역은 총의 몫이다. */
export function swing(s: GameState): Beast | null {
  const p = s.player
  let best: Beast | null = null
  let bd = Infinity
  for (const b of s.beasts) {
    if (b.hp <= 0) continue
    const def = ENEMIES[b.type]
    const d = distance(p.x, p.z, b.x, b.z) - def.radius
    if (d > MELEE_REACH) continue
    const a = Math.atan2(b.z - p.z, b.x - p.x)
    let diff = Math.abs(a - p.facing)
    while (diff > Math.PI) diff = Math.PI * 2 - diff
    if (diff > MELEE_ARC / 2) continue
    if (d < bd) {
      bd = d
      best = b
    }
  }
  if (best) {
    damageBeast(s, best, meleeDamage(s))
    wearAxe(s)
    s.events.push('melee')
  }
  return best
}

/** 낡은 도끼만 닳는다. 철·합금은 내구도가 없다(§7.2). */
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

/* 포탑과 덫. 둘 다 "자리를 정해 두고 오는" 장치라, 어디에 놓았는지가
   플레이어의 계획이 된다. */
export function updateStructures(s: GameState, dt: number): void {
  for (const b of s.buildings) {
    if (b.type === 'turret') {
      b.cooldown = (b.cooldown ?? 0) - dt
      let target: Beast | null = null
      let bd = Infinity
      for (const beast of s.beasts) {
        if (beast.hp <= 0) continue
        const d = distance(b.x, b.z, beast.x, beast.z)
        if (d <= TURRET_RANGE && d < bd) {
          bd = d
          target = beast
        }
      }
      if (!target) continue
      /* 총알 대신 고철을 먹는다. 10초에 하나 — 켜 두면 자원이 새므로
         "지킬 값어치가 있는 밤인가"를 묻게 된다. */
      if ((b.cooldown ?? 0) <= 0) {
        if (countItem(s, 'scrap') <= 0) continue
        removeItem(s, 'scrap', 1)
        b.cooldown = TURRET_SCRAP_INTERVAL
      }
      damageBeast(s, target, TURRET_DPS * dt)
    }

    if (b.type === 'bear_trap' && b.armed) {
      for (const beast of s.beasts) {
        if (beast.hp <= 0) continue
        if (distance(b.x, b.z, beast.x, beast.z) > 0.8) continue
        damageBeast(s, beast, 25)
        beast.boundT = 2
        b.armed = false
        s.events.push('trap')
        break
      }
    }

    if (b.type === 'rabbit_trap' && b.armed) {
      for (const beast of s.beasts) {
        if (beast.type !== 'rabbit' || beast.hp <= 0) continue
        if (distance(b.x, b.z, beast.x, beast.z) > 0.8) continue
        beast.hp = 0
        /* 덫으로 잡으면 고기가 셋. 총알을 안 쓰는 대신 자리를 미리
           읽어야 하는 보상이다(§7.5). */
        addItem(s, 'meat_small_raw', 3)
        b.armed = false
        s.events.push('trap')
        break
      }
    }
  }

  /* 발동한 덫은 치운다 */
  s.buildings = s.buildings.filter(
    (b) => !((b.type === 'bear_trap' || b.type === 'rabbit_trap') && b.armed === false),
  )
}
