/* ==================================================================
   채집과 상호작용 (§7)

   자원 노드는 캐면 사라지고 다시 안 난다(묘목 제외). 그래서 캠프
   주변이 비어 가고, 플레이어는 지대를 넓힐 수밖에 없고, 그러려면
   불을 키울 수밖에 없다. §1.2 의 "불이 곧 지도다"가 여기서 완성된다.

   잡동사니가 칸을 하나씩 먹는 것(§7.3)도 여기서 지킨다. addItem 이
   stack=1 을 그대로 따르므로 특례 코드가 없다 — 규칙이 데이터에
   있으면 코드가 조용해진다.
   ================================================================== */
import { BALANCE, ITEMS } from '../data/index.ts'
import type { GameState, Harvestable } from '../core/GameState.ts'
import { addItem, removeItem, distance, toast, countItem } from '../core/GameState.ts'
import { makeSapling } from '../world/Spawner.ts'
import { wearAxe } from './CombatSystem.ts'

const P = BALANCE.player

export function chopsNeeded(s: GameState, kind: 'tree_small' | 'tree_large'): number {
  const axe = s.player.equipped
  const def = axe ? ITEMS[axe] : null
  if (!def || (def.chopSmall === undefined && def.chopLarge === undefined)) {
    /* 맨손. 못 팬다고 하면 도끼를 잃었을 때 게임이 멈추므로 느리게라도 되게 둔다. */
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

export function chop(s: GameState): boolean {
  const tree = nearestTree(s)
  if (!tree) return false

  tree.hits++
  wearAxe(s)
  s.events.push('chop')
  if (tree.hits < chopsNeeded(s, tree.kind)) return true

  const logs = tree.kind === 'tree_small' ? 3 : 15
  const left = addItem(s, 'log', logs)
  if (left > 0) toast(s, `가방이 가득 차 통나무 ${left}개를 놓쳤습니다`, 'warn')
  s.trees = s.trees.filter((t) => t.id !== tree.id)

  /* 작은 나무만 묘목을 남긴다(§7.1). 큰 나무는 영구 소멸이다. */
  if (tree.kind === 'tree_small') addItem(s, 'sapling', 1)
  s.events.push('treeDown')
  return true
}

export function plantSapling(s: GameState): boolean {
  if (!removeItem(s, 'sapling', 1)) return false
  s.trees.push(makeSapling(s, s.player.x, s.player.z))
  toast(s, '묘목을 심었습니다 (5분 후 자랍니다)', 'good')
  return true
}

/** 발밑의 주울 것 — 잡동사니와 연료 통 */
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
   모아도 10분 뒤에 사라지므로, 고철 2개짜리 저장고가 초반의 숨은
   관문이 된다. 대원 로한도 여기서 연료를 꺼내 쓴다. */

export function storeFuel(s: GameState, id: string, amount: number): number {
  let left = Math.min(amount, countItem(s, id))
  for (const b of s.buildings) {
    if (left <= 0) break
    if (b.type !== 'wood_storage') continue
    b.store ??= []
    const have = b.store.reduce((a, x) => a + x.count, 0)
    const room = BALANCE.decay.storageCapacity - have
    if (room <= 0) continue
    const put = Math.min(room, left)
    const slot = b.store.find((x) => x.id === id)
    if (slot) slot.count += put
    else b.store.push({ id, count: put })
    removeItem(s, id, put)
    left -= put
  }
  return amount - left
}

export function withdrawFuel(s: GameState, id: string, amount: number): number {
  let got = 0
  for (const b of s.buildings) {
    if (got >= amount) break
    if (b.type !== 'wood_storage' || !b.store) continue
    const slot = b.store.find((x) => x.id === id)
    if (!slot || slot.count <= 0) continue
    const take = Math.min(slot.count, amount - got)
    const rejected = addItem(s, id, take)
    const actual = take - rejected
    slot.count -= actual
    got += actual
    if (rejected > 0) break
  }
  s.buildings.forEach((b) => {
    if (b.store) b.store = b.store.filter((x) => x.count > 0)
  })
  return got
}

export function totalStored(s: GameState, id?: string): number {
  let n = 0
  for (const b of s.buildings) {
    if (b.type !== 'wood_storage' || !b.store) continue
    for (const x of b.store) if (!id || x.id === id) n += x.count
  }
  return n
}

/** 저장고에서 가장 좋은 연료를 하나 꺼낸다 — 대원 로한이 쓴다 */
export function takeBestFuelFromStorage(s: GameState): string | null {
  const order = ['gastank', 'oildrum', 'coal', 'log']
  for (const id of order) {
    for (const b of s.buildings) {
      if (b.type !== 'wood_storage' || !b.store) continue
      const slot = b.store.find((x) => x.id === id && x.count > 0)
      if (!slot) continue
      slot.count--
      b.store = b.store.filter((x) => x.count > 0)
      return id
    }
  }
  return null
}

/** 제작 모듈에서 잡동사니를 분해(§7.3) */
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

/** 재활용기(Lv5) — 필요 없는 것을 고철 50% 로 돌려받는다 */
export function recycle(s: GameState, id: string): number {
  if (!s.buildings.some((b) => b.type === 'recycler')) return 0
  const def = ITEMS[id]
  if (!def) return 0
  const n = countItem(s, id)
  if (n <= 0) return 0
  const value = Math.max(1, Math.floor(((def.scrapValue ?? 1) * n) / 2))
  removeItem(s, id, n)
  addItem(s, 'scrap', value)
  s.events.push('grind')
  return value
}
