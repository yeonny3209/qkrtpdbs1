/* ==================================================================
   크래프팅

   레시피는 전부 JSON 이고(§17.3), 여기서는 "만들 수 있는가 / 값을
   치르고 무엇이 되는가"만 판단한다.

   §8.5 의 설계 노트대로, 4레벨의 존재 이유는 **탈출선 정비 도크**다.
   원본에는 4레벨을 찍을 이유가 없었다. 도크를 엔딩 필수로 두면
   40나무/40고철짜리 업그레이드가 비로소 의미를 가진다.
   ================================================================== */
import { RECIPES, MACHINE_UPGRADE, type RecipeDef } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { hasAll, payAll, addItem, toast, nextId, distance } from '../core/GameState.ts'
import { CENTER } from '../world/Tilemap.ts'
import { BALANCE } from '../data/index.ts'

export function builtCount(s: GameState, recipeId: string): number {
  const def = RECIPES[recipeId]
  const family = def?.sharedCountWith ?? recipeId
  let n = 0
  for (const b of s.buildings) {
    const bdef = RECIPES[b.type]
    const bfam = bdef?.sharedCountWith ?? b.type
    if (bfam === family) n++
  }
  return n
}

export type CraftBlock =
  | null
  | 'level'
  | 'cost'
  | 'max'
  | 'placement'
  | 'dockMissing'
  | 'alreadyBuilt'

/** 왜 못 만드는지까지 돌려준다 — UI 가 회색 버튼만 보여 주면 답답하다. */
export function blockedReason(s: GameState, id: string): CraftBlock {
  const def = RECIPES[id]
  if (!def) return 'level'
  if (def.level > s.craftLevel) return 'level'

  if (def.kind === 'escape') {
    if (!s.dockBuilt) return 'dockMissing'
    if (s.escapeBuilt.includes(id)) return 'alreadyBuilt'
  }
  if (def.maxCount !== undefined && builtCount(s, id) >= def.maxCount) return 'max'
  if (def.dayRateBonus && bedTotal(s) >= BALANCE.map.maxBeds) return 'max'
  if (def.dayRateBonus && !nearShip(s)) return 'placement'
  if (!hasAll(s, def.cost)) return 'cost'
  return null
}

function bedTotal(s: GameState): number {
  let n = 0
  for (const b of s.buildings) if (RECIPES[b.type]?.dayRateBonus) n++
  return n
}

/** 침대는 우주선 반경 15타일 안에만(§5.2) */
function nearShip(s: GameState): boolean {
  return distance(s.player.x, s.player.z, CENTER, CENTER) <= BALANCE.map.bedPlacementRadius
}

export function canCraft(s: GameState, id: string): boolean {
  return blockedReason(s, id) === null
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

function blockMessage(reason: CraftBlock, def: RecipeDef | undefined): string {
  switch (reason) {
    case 'level': return '크래프팅 기계 레벨이 부족합니다'
    case 'cost': return '재료가 부족합니다'
    case 'max': return `${def?.name ?? '이것'}은(는) 더 지을 수 없습니다`
    case 'placement': return '침대는 우주선 근처에만 놓을 수 있습니다'
    case 'dockMissing': return '먼저 탈출선 정비 도크를 지어야 합니다'
    case 'alreadyBuilt': return '이미 설치했습니다'
    default: return '만들 수 없습니다'
  }
}

function applyRecipe(s: GameState, id: string, def: RecipeDef): void {
  switch (def.kind) {
    case 'item': {
      for (const [gid, n] of Object.entries(def.gives ?? {})) addItem(s, gid, n)
      break
    }
    case 'unlock': {
      if (def.flag) (s.flags as unknown as Record<string, boolean>)[def.flag] = true
      break
    }
    case 'upgrade': {
      if (def.maxSuit) {
        /* 최대치만 올린다. 지금 값은 안 채운다 — 우주복은 캡슐 외에
           회복되지 않는다는 규칙(§4)이 여기서도 지켜져야 한다. */
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
    }
    case 'escape': {
      s.escapeBuilt.push(id)
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
      })
      if (id === 'repair_dock') s.dockBuilt = true
      break
    }
  }
}

export function upgradeCost(level: number): Record<string, number> | null {
  return MACHINE_UPGRADE[String(level + 1)] ?? null
}

export function upgradeMachine(s: GameState): boolean {
  const cost = upgradeCost(s.craftLevel)
  if (!cost) {
    toast(s, '이미 최고 레벨입니다', 'warn')
    return false
  }
  if (!hasAll(s, cost)) {
    toast(s, '재료가 부족합니다', 'warn')
    return false
  }
  payAll(s, cost)
  s.craftLevel++
  s.events.push('upgrade')
  toast(s, `크래프팅 기계 Lv${s.craftLevel}`, 'good')
  return true
}

/** 탄약 압착기 — 고철 4 → 탄약 6발(§8.4). 지금 든 총 기준. */
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

/** 지금 레벨에서 보이는 목록. 잠긴 것도 보여 준다 — 목표가 보여야 모은다. */
export function visibleRecipes(s: GameState): { id: string; def: RecipeDef; blocked: CraftBlock }[] {
  return Object.entries(RECIPES)
    .filter(([, def]) => def.level <= s.craftLevel + 1)
    .map(([id, def]) => ({ id, def, blocked: blockedReason(s, id) }))
}
