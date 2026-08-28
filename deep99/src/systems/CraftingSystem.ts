/* ==================================================================
   제작 모듈 (§8) — 5레벨

   §8.6 의 설계 노트가 요점이다. 원본은 4레벨이 끝인데 4레벨을 찍을
   이유가 없었다. 5레벨에 **시간 가속기**(날짜 +3)를 두면, 스피드런을
   노리는 순간 5레벨이 필수가 된다. 그리고 시간 가속기는 운석 파편을
   요구하고, 운석 파편은 소행성 밤에서만 나오므로 콘텐츠끼리 물린다.

   4레벨의 이유는 **탈출선 정비 도크**다. 없으면 탈출 장비를 못 만든다.
   ================================================================== */
import { RECIPES, MODULE_UPGRADE, BALANCE, type RecipeDef } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { hasAll, payAll, addItem, toast, nextId, distance } from '../core/GameState.ts'
import { CENTER } from '../world/Tilemap.ts'

export function builtCount(s: GameState, recipeId: string): number {
  const def = RECIPES[recipeId]
  if (def?.bedFamily) return s.buildings.filter((b) => RECIPES[b.type]?.bedFamily).length
  return s.buildings.filter((b) => b.type === recipeId).length
}

export type CraftBlock =
  | null | 'level' | 'cost' | 'max' | 'placement' | 'dockMissing' | 'alreadyBuilt'

/** 왜 못 만드는지까지 돌려준다 — 회색 버튼만 보여 주면 답답하다. */
export function blockedReason(s: GameState, id: string): CraftBlock {
  const def = RECIPES[id]
  if (!def) return 'level'
  if (def.level > s.moduleLevel) return 'level'

  if (def.kind === 'escape') {
    if (!s.dockBuilt) return 'dockMissing'
    if (s.escapeBuilt.includes(id)) return 'alreadyBuilt'
  }
  if (def.bedFamily && builtCount(s, id) >= BALANCE.map.maxBeds) return 'max'
  if (def.maxCount !== undefined && builtCount(s, id) >= def.maxCount) return 'max'
  if (def.bedFamily && !nearShip(s)) return 'placement'
  if (!hasAll(s, def.cost)) return 'cost'
  return null
}

/** 침대는 본선 반경 15타일 안에만 */
function nearShip(s: GameState): boolean {
  return distance(s.player.x, s.player.z, CENTER, CENTER) <= BALANCE.map.bedPlacementRadius
}

export function canCraft(s: GameState, id: string): boolean {
  return blockedReason(s, id) === null
}

function blockMessage(reason: CraftBlock, def: RecipeDef | undefined): string {
  switch (reason) {
    case 'level': return '제작 모듈 레벨이 부족합니다'
    case 'cost': return '재료가 부족합니다'
    case 'max': return `${def?.name ?? '이것'}은(는) 더 지을 수 없습니다`
    case 'placement': return '침대는 본선 근처에만 놓을 수 있습니다'
    case 'dockMissing': return '먼저 탈출선 정비 도크를 지어야 합니다'
    case 'alreadyBuilt': return '이미 설치했습니다'
    default: return '만들 수 없습니다'
  }
}

export function craft(s: GameState, id: string): boolean {
  const def = RECIPES[id]
  const reason = blockedReason(s, id)
  if (!def || reason !== null) {
    if (reason) toast(s, blockMessage(reason, def), 'warn')
    return false
  }
  if (!payAll(s, def.cost)) return false
  applyRecipe(s, id, def)
  s.events.push('craft')
  toast(s, `${def.name} 완성`, 'good')
  return true
}

function applyRecipe(s: GameState, id: string, def: RecipeDef): void {
  switch (def.kind) {
    case 'item':
      for (const [gid, n] of Object.entries(def.gives ?? {})) addItem(s, gid, n)
      break

    case 'unlock':
      if (def.flag) (s.flags as unknown as Record<string, boolean>)[def.flag] = true
      break

    case 'upgrade':
      if (def.maxSuit) {
        /* 최대치만 올린다. 지금 값은 안 채운다 — "회복 캡슐 전용"
           규칙(§5)이 여기서도 지켜져야 한다. */
        s.player.maxSuit = def.maxSuit
      }
      if (def.maxOxygen) {
        s.player.maxOxygen = def.maxOxygen
        s.player.oxygen = Math.min(s.player.oxygen, def.maxOxygen)
      }
      if (id === 'cargo_drone') {
        for (let i = 0; i < 8; i++) s.player.slots.push(null)
      }
      s.buildings.push({ id: nextId(s), type: id, x: CENTER, z: CENTER })
      break

    case 'escape':
      s.escapeBuilt.push(id)
      break

    case 'beacon': {
      /* 보급 신호기 — 랜덤 보급함을 캠프 옆으로 부른다(§8.3) */
      const rng = s.streams.loot
      const tiers = ['common', 'precision', 'military']
      const a = rng() * Math.PI * 2
      s.caches.push({
        id: nextId(s),
        x: CENTER + Math.cos(a) * 5,
        z: CENTER + Math.sin(a) * 5,
        tier: rng.pick(tiers),
        opened: false,
      })
      toast(s, '보급함이 캠프 옆에 떨어졌습니다', 'good')
      break
    }

    case 'building': {
      const armed = id === 'bear_trap' || id === 'rabbit_trap'
      s.buildings.push({
        id: nextId(s),
        type: id,
        x: s.player.x,
        z: s.player.z,
        store: id === 'wood_storage' ? [] : undefined,
        timerDays: id === 'farm' ? 0 : undefined,
        cooldown: 0,
        armed: armed ? true : undefined,
        crop: id === 'farm' ? null : undefined,
        hp: def.wallHp,
        maxHp: def.wallHp,
      })
      if (id === 'repair_dock') s.dockBuilt = true
      break
    }
  }
}

export function upgradeCost(level: number): Record<string, number> | null {
  return MODULE_UPGRADE[String(level + 1)] ?? null
}

export function upgradeModule(s: GameState): boolean {
  const cost = upgradeCost(s.moduleLevel)
  if (!cost) {
    toast(s, '이미 최고 레벨입니다', 'warn')
    return false
  }
  if (!hasAll(s, cost)) {
    toast(s, '재료가 부족합니다', 'warn')
    return false
  }
  payAll(s, cost)
  s.moduleLevel++
  s.events.push('upgrade')
  toast(s, `제작 모듈 Lv${s.moduleLevel}`, 'good')
  return true
}

/** 탄약 압착기 — 고철 4 → 6발(§8.4). 지금 든 총 기준. */
export function pressAmmo(s: GameState): boolean {
  if (!s.buildings.some((b) => b.type === 'ammo_press')) return false
  const gun = s.player.gun
  if (!gun) {
    toast(s, '총을 들고 있어야 합니다', 'warn')
    return false
  }
  if (!payAll(s, { scrap: 4 })) {
    toast(s, '고철이 부족합니다', 'warn')
    return false
  }
  addItem(s, `ammo_${gun}`, 6)
  s.events.push('craft')
  return true
}

/** 조리 냄비 — 스튜(§7.5). 고기 2 + 채소 2 → 배고픔 100 + 산소 20 */
export function cookStew(s: GameState): boolean {
  if (!s.buildings.some((b) => b.type === 'cooking_pot')) return false
  const meats = ['meat_small_cooked', 'meat_large_cooked', 'meat_small_raw', 'meat_large_raw']
  const veg = ['carrot', 'corn']
  const need = (list: string[], n: number): Record<string, number> | null => {
    const take: Record<string, number> = {}
    let left = n
    for (const id of list) {
      if (left <= 0) break
      const have = s.player.slots.reduce((a, sl) => a + (sl?.id === id ? sl.count : 0), 0)
      const use = Math.min(have, left)
      if (use > 0) {
        take[id] = use
        left -= use
      }
    }
    return left > 0 ? null : take
  }
  const m = need(meats, 2)
  const v = need(veg, 2)
  if (!m || !v) {
    toast(s, '고기 2 + 채소 2 가 필요합니다', 'warn')
    return false
  }
  payAll(s, { ...m, ...v })
  addItem(s, 'stew', 1)
  s.events.push('craft')
  toast(s, '스튜를 만들었습니다', 'good')
  return true
}

/** 지금 레벨에서 보이는 목록. 잠긴 것도 보여 준다 — 목표가 보여야 모은다. */
export function visibleRecipes(s: GameState): { id: string; def: RecipeDef; blocked: CraftBlock }[] {
  return Object.entries(RECIPES)
    .filter(([, def]) => def.level <= s.moduleLevel + 1)
    .map(([id, def]) => ({ id, def, blocked: blockedReason(s, id) }))
}
