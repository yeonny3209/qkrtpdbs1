/* ==================================================================
   채집과 상호작용

   §7 의 자원 규칙이 여기 산다. 핵심은 하나 — **자원 노드는 다시 나지
   않는다**(묘목 제외). 그래서 캠프 주변이 비어 가고, 플레이어는
   존을 넓힐 수밖에 없다. 그게 산소·시간과 맞물려 압박이 된다.

   잡동사니가 칸을 하나씩 먹는 것(§7.3)도 여기서 지킨다. addItem 이
   stack=1 을 그대로 따르므로 특례 코드가 없다 — 규칙이 데이터에
   있으면 코드가 조용해진다.
   ================================================================== */
import { BALANCE, ITEMS, FUEL } from '../data/index.ts'
import type { GameState, Harvestable } from '../core/GameState.ts'
import { addItem, removeItem, distance, toast, countItem } from '../core/GameState.ts'
import { makeSapling } from '../world/Spawner.ts'
import { wearAxe } from './CombatSystem.ts'

const P = BALANCE.player

export function chopsNeeded(s: GameState, kind: 'tree_small' | 'tree_large'): number {
  const axe = s.player.equipped
  const def = axe ? ITEMS[axe] : null
  if (!def || (def.chopSmall === undefined && def.chopLarge === undefined)) {
    /* 맨손. 못 팬다고 하면 도끼를 잃었을 때 게임이 멈추므로,
       아주 느리게라도 되게 둔다. */
    return kind === 'tree_small' ? 40 : 90
  }
  return kind === 'tree_small' ? (def.chopSmall ?? 40) : (def.chopLarge ?? 90)
}

/* 묘목은 뺀다. 반환 타입에서도 빼 두면 부르는 쪽이 kind 를 다시
   확인할 필요가 없다 — 타입이 규칙을 대신 지킨다. */
export type ChoppableTree = Harvestable & { kind: 'tree_small' | 'tree_large' }

export function nearestTree(s: GameState): ChoppableTree | null {
  let best: ChoppableTree | null = null
  let bd = P.harvestRange
  for (const t of s.trees) {
    if (t.kind === 'sapling') continue
    const d = distance(s.player.x, s.player.z, t.x, t.z)
    if (d < bd) {
      bd = d
      best = t as ChoppableTree
    }
  }
  return best
}

/** 도끼질 한 번. 다 패면 통나무가 나오고, 작은 나무는 묘목을 남긴다. */
export function chop(s: GameState): boolean {
  const tree = nearestTree(s)
  if (!tree) return false

  tree.hits++
  wearAxe(s)
  s.events.push('chop')

  if (tree.hits < chopsNeeded(s, tree.kind)) return true

  const logs = tree.kind === 'tree_small' ? 3 : 15
  const left = addItem(s, 'wood', logs)
  if (left > 0) toast(s, `가방이 가득 차 통나무 ${left}개를 놓쳤습니다`, 'warn')

  s.trees = s.trees.filter((t) => t.id !== tree.id)

  /* 작은 나무만 묘목을 남긴다(§7.1). 큰 나무는 영구 소멸이라,
     큰 나무가 많은 존일수록 한 번 훑고 나면 돌아올 이유가 없다. */
  if (tree.kind === 'tree_small') {
    addItem(s, 'sapling', 1)
  }
  s.events.push('treeDown')
  return true
}

export function plantSapling(s: GameState): boolean {
  if (countItem(s, 'sapling') <= 0) return false
  if (!removeItem(s, 'sapling', 1)) return false
  s.trees.push(makeSapling(s, s.player.x, s.player.z))
  toast(s, '묘목을 심었습니다 (5분 후 자랍니다)', 'good')
  return true
}

/** 발밑의 주울 것. 잡동사니·연료 통·묘목 모두 이 하나로 처리한다. */
export function pickUp(s: GameState): boolean {
  const p = s.player

  for (const j of s.junk) {
    if (distance(p.x, p.z, j.x, j.z) > P.harvestRange) continue
    if (addItem(s, j.item, 1) > 0) {
      toast(s, '가방이 가득 찼습니다', 'warn')
      return false
    }
    s.junk = s.junk.filter((n) => n.id !== j.id)
    s.events.push('pickup')
    return true
  }

  for (const f of s.fuelNodes) {
    if (distance(p.x, p.z, f.x, f.z) > P.harvestRange) continue
    if (addItem(s, f.item, 1) > 0) {
      toast(s, '가방이 가득 찼습니다', 'warn')
      return false
    }
    s.fuelNodes = s.fuelNodes.filter((n) => n.id !== f.id)
    s.events.push('pickup')
    return true
  }

  return false
}

/* ── 나무 저장고 ─────────────────────────────────────────────────
   부패를 막는 유일한 방법이다(§7.1). 저장고가 없으면 통나무를 아무리
   모아도 10분 뒤에 사라지므로, 탈출 장비에 필요한 270개를 모으려면
   저장고를 먼저 지어야 한다. 이게 초반의 숨은 관문이다. */

export function storageCapacityLeft(s: GameState): number {
  let total = 0
  for (const b of s.buildings) {
    if (b.type !== 'wood_storage') continue
    const have = (b.store ?? []).reduce((a, x) => a + x.count, 0)
    total += BALANCE.decay.storageCapacity - have
  }
  return total
}

export function storeWood(s: GameState, amount: number): number {
  let left = Math.min(amount, countItem(s, 'wood'))
  for (const b of s.buildings) {
    if (left <= 0) break
    if (b.type !== 'wood_storage') continue
    b.store ??= []
    const slot = b.store.find((x) => x.id === 'wood') ?? (b.store.push({ id: 'wood', count: 0 }), b.store[b.store.length - 1])
    const room = BALANCE.decay.storageCapacity - slot.count
    const put = Math.min(room, left)
    if (put <= 0) continue
    slot.count += put
    removeItem(s, 'wood', put)
    left -= put
  }
  return amount - left
}

export function withdrawWood(s: GameState, amount: number): number {
  let got = 0
  for (const b of s.buildings) {
    if (got >= amount) break
    if (b.type !== 'wood_storage' || !b.store) continue
    const slot = b.store.find((x) => x.id === 'wood')
    if (!slot || slot.count <= 0) continue
    const take = Math.min(slot.count, amount - got)
    const rejected = addItem(s, 'wood', take)
    const actual = take - rejected
    slot.count -= actual
    got += actual
    if (rejected > 0) break
  }
  return got
}

export function totalStoredWood(s: GameState): number {
  let n = 0
  for (const b of s.buildings) {
    if (b.type !== 'wood_storage' || !b.store) continue
    for (const x of b.store) if (x.id === 'wood') n += x.count
  }
  return n
}

/** 무기고 열기. 소음이 나고 40타일 안의 짐승이 몰려온다(§11.2). */
export function openArmory(s: GameState): boolean {
  const p = s.player
  for (const a of s.armories) {
    if (a.opened) continue
    if (distance(p.x, p.z, a.x, a.z) > P.interactRange) continue

    const roll = s.streams.loot()
    const gun = roll < 0.5 ? 'pistol' : roll < 0.8 ? 'rifle' : 'shotgun'
    addItem(s, gun, 1)
    addItem(s, `ammo_${gun}`, 6)
    a.opened = true

    for (const b of s.beasts) {
      if (distance(b.x, b.z, a.x, a.z) <= 40) {
        b.state = 'chase'
        b.stateT = 0
      }
    }
    toast(s, `${ITEMS[gun].name} 획득 — 소리를 들었습니다`, 'warn')
    s.events.push('armory')
    return true
  }
  return false
}

/** 크래프팅 기계에 잡동사니를 갈아 넣는다(§7.3). */
export function grindJunk(s: GameState): number {
  let gained = 0
  for (const slot of s.player.slots) {
    if (!slot) continue
    const def = ITEMS[slot.id]
    if (def?.kind !== 'junk') continue
    gained += (def.scrapValue ?? 1) * slot.count
  }
  if (gained <= 0) return 0
  for (let i = 0; i < s.player.slots.length; i++) {
    const slot = s.player.slots[i]
    if (slot && ITEMS[slot.id]?.kind === 'junk') s.player.slots[i] = null
  }
  const left = addItem(s, 'scrap', gained)
  if (left > 0) toast(s, `가방이 가득 차 고철 ${left}개를 놓쳤습니다`, 'warn')
  s.events.push('grind')
  return gained - left
}

export function isFuel(id: string): boolean {
  return FUEL[id] !== undefined
}
