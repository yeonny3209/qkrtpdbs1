/* ==================================================================
   데이터 진입점

   수치는 전부 JSON 에 있다(§17.3). 밸런스를 고칠 때 코드를 안 건드리게
   하려는 것이고, 나중에 JSON 만 갈아 끼우는 모드도 그래서 가능하다.

   다만 JSON 을 그대로 쓰면 타입이 헐거워서 오타가 런타임까지 간다.
   그래서 여기서 한 번 형을 입혀 내보내고, 밖에서는 이 모듈만 본다.
   ================================================================== */
import balanceRaw from './balance.json'
import itemsRaw from './items.json'
import recipesRaw from './recipes.json'
import enemiesRaw from './enemies.json'
import modifiersRaw from './modifiers.json'
import unlocksRaw from './unlocks.json'

export type ItemId = string

export type ItemDef = {
  name: string
  kind: 'resource' | 'fuel' | 'junk' | 'food' | 'tool' | 'gun' | 'ammo' | 'gear' | 'core'
  stack: number
  icon: string
  decays?: boolean
  scrapValue?: number
  hunger?: number
  suitCost?: number
  chopSmall?: number
  chopLarge?: number
  melee?: number
  durability?: number
  mag?: number
  damage?: number
  pellets?: number
  reloadSec?: number
  fireSec?: number
  spread?: number
}

export type RecipeDef = {
  name: string
  level: number
  cost: Record<string, number>
  kind: 'building' | 'item' | 'unlock' | 'upgrade' | 'escape'
  desc: string
  maxCount?: number
  sharedCountWith?: string
  dayRateBonus?: number
  flag?: string
  gives?: Record<string, number>
  maxSuit?: number
  maxOxygen?: number
}

export type EnemyDef = {
  name: string
  hp: number
  speed: number
  damage: number
  radius: number
  senseRange: number
  behavior: 'flee' | 'dart' | 'charge' | 'patrol' | 'hunt'
  packMin?: number
  packMax?: number
  drops: Record<string, number>
  zone: number
  color: string
  size: number
}

export type ZoneDef = {
  id: number
  name: string
  innerRadius: number
  outerRadius: number
  oxygenFactor: number
  ground: string
  accent: string
}

export type ModifierDef = {
  id: string
  name: string
  desc: string
  multiplier: number
  effects: {
    visionFactor?: number
    oxygenDrainFactor?: number
    asteroidEveryDays?: number
    extraSpiders?: number
    scrapSpawnFactor?: number
    resourceSpawnFactor?: number
    daySeconds?: number
    nightSeconds?: number
  }
}

export type UnlockDef = {
  id: string
  name: string
  cost: number
  desc: string
  effects: {
    flashlightBatterySeconds?: number
    startItems?: Record<string, number>
    startCraftLevel?: number
    startFlags?: string[]
    startMaxSuit?: number
    startMaxOxygen?: number
    startFuel?: Record<string, number>
    allowedFailures?: number
  }
}

export const BALANCE = balanceRaw
export const ITEMS = itemsRaw as unknown as Record<ItemId, ItemDef>
export const RECIPES = recipesRaw.recipes as unknown as Record<string, RecipeDef>
export const MACHINE_UPGRADE = recipesRaw.machineUpgrade as unknown as Record<string, Record<string, number>>
export const ENEMIES = enemiesRaw as unknown as Record<string, EnemyDef>
export const ZONES = balanceRaw.zones as unknown as ZoneDef[]
export const MODIFIERS = modifiersRaw as unknown as ModifierDef[]
export const UNLOCKS = unlocksRaw as unknown as UnlockDef[]

export const FUEL = BALANCE.fuel as unknown as Record<string, { grade: number; burnSeconds: number }>

export function itemDef(id: ItemId): ItemDef {
  const d = ITEMS[id]
  if (!d) throw new Error(`알 수 없는 아이템: ${id}`)
  return d
}

export function itemName(id: ItemId): string {
  return ITEMS[id]?.name ?? id
}

/** 존은 중심에서의 거리로 정해진다. 마지막 존이 바깥을 전부 받는다. */
export function zoneAt(distanceTiles: number): ZoneDef {
  for (const z of ZONES) {
    if (distanceTiles < z.outerRadius) return z
  }
  return ZONES[ZONES.length - 1]
}
