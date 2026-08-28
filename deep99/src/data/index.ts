/* ==================================================================
   데이터 진입점

   수치는 전부 JSON 이다(§21.3). 밸런싱할 때 코드를 안 건드리게 하려는
   것이고, §24 의 "JSON 교체만으로 밸런스 모드"도 그래서 가능하다.

   다만 JSON 을 그대로 쓰면 타입이 헐거워 오타가 런타임까지 간다.
   여기서 한 번 형을 입혀 내보내고, 밖에서는 이 모듈만 본다.
   ================================================================== */
import balanceRaw from './balance.json'
import campfireRaw from './campfire.json'
import itemsRaw from './items.json'
import recipesRaw from './recipes.json'
import enemiesRaw from './enemies.json'
import crewRaw from './crew.json'
import jobsRaw from './jobs.json'
import modifiersRaw from './modifiers.json'
import cachesRaw from './caches.json'

export type ItemId = string

export type ItemDef = {
  name: string
  kind: 'fuel' | 'resource' | 'junk' | 'food' | 'tool' | 'gun' | 'ammo' | 'gear' | 'core'
  stack: number
  icon: string
  decays?: boolean
  scrapValue?: number
  hunger?: number
  oxygen?: number
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
  pierce?: boolean
}

export type RecipeDef = {
  name: string
  level: number
  cost: Record<string, number>
  kind: 'building' | 'item' | 'unlock' | 'upgrade' | 'escape' | 'beacon'
  desc: string
  maxCount?: number
  dayRateBonus?: number
  bedFamily?: boolean
  flag?: string
  gives?: Record<string, number>
  maxSuit?: number
  maxOxygen?: number
  wallHp?: number
}

export type EnemyDef = {
  name: string
  hp: number
  speed: number
  damage: number
  radius: number
  senseRange: number
  behavior: 'flee' | 'dart' | 'charge' | 'patrol' | 'hunt' | 'raid' | 'raidRanged'
  /** 이 적이 나타나기 시작하는 캠프파이어 최고 도달 레벨(§3.3) */
  fireLevel: number
  zone: number
  drops: Record<string, number>
  color: string
  size: number
  attackRange?: number
}

export type ZoneDef = {
  id: number
  name: string
  innerRadius: number
  outerRadius: number
  requiredLevel: number
  ground: string
  accent: string
}

export type CrewDef = {
  id: string
  name: string
  role: string
  desc: string
  core: string
  labTier: number
  color: string
  stokeSeconds?: number
  guardDamage?: number
  guardRange?: number
  guardCooldown?: number
}

export type JobDef = {
  id: string
  name: string
  cost: number
  desc: string
  effects: {
    asteroidHitboxFactor?: number
    startItems?: Record<string, number>
    startModuleLevel?: number
    fuelHeatFactor?: number
    startFlags?: string[]
    speedFactor?: number
    startMaxOxygen?: number
    oxygenDrainFactor?: number
    meatFactor?: number
    startTraps?: number
    salvageWindowFactor?: number
    startCrew?: string
  }
}

export type ModifierDef = {
  id: string
  name: string
  desc: string
  multiplier: number
  effects: {
    visionFactor?: number
    oxygenDrainFactor?: number
    extraSpiders?: number
    scrapSpawnFactor?: number
    raidEveryDays?: number
    drainFactor?: number
    resourceSpawnFactor?: number
    daySeconds?: number
    nightSeconds?: number
  }
}

export type CampfireLevel = {
  lv: number
  min: number
  drain: number
  safeRadius: number
  openRadius: number
}

export type FuelDef = { heat: number; unlockLevel: number }

export type CacheTier = {
  id: string
  name: string
  fireLevel: number
  color: string
  loot: Record<string, unknown>[]
}

export const BALANCE = balanceRaw
export const CAMPFIRE = campfireRaw
export const FIRE_LEVELS = campfireRaw.levels as CampfireLevel[]
export const FUELS = campfireRaw.fuels as unknown as Record<string, FuelDef>
export const ITEMS = itemsRaw as unknown as Record<ItemId, ItemDef>
export const RECIPES = recipesRaw.recipes as unknown as Record<string, RecipeDef>
export const MODULE_UPGRADE = recipesRaw.moduleUpgrade as unknown as Record<string, Record<string, number>>
export const ENEMIES = enemiesRaw as unknown as Record<string, EnemyDef>
export const ZONES = balanceRaw.zones as unknown as ZoneDef[]
export const CREW = crewRaw as unknown as CrewDef[]
export const JOBS = jobsRaw as unknown as JobDef[]
export const MODIFIERS = modifiersRaw as unknown as ModifierDef[]
export const CACHES = cachesRaw.tiers as unknown as CacheTier[]
export const CACHE_CONF = cachesRaw

export function itemDef(id: ItemId): ItemDef {
  const d = ITEMS[id]
  if (!d) throw new Error(`알 수 없는 아이템: ${id}`)
  return d
}

export function itemName(id: ItemId): string {
  return ITEMS[id]?.name ?? id
}

/** 지대는 중심에서의 거리로 정해진다. 마지막 지대가 바깥을 전부 받는다. */
export function zoneAt(distanceTiles: number): ZoneDef {
  for (const z of ZONES) {
    if (distanceTiles < z.outerRadius) return z
  }
  return ZONES[ZONES.length - 1]
}

/** 화력 수치가 속한 레벨(§3.1). 0 이면 꺼진 것이다. */
export function levelForHeat(heat: number): number {
  let lv = 0
  for (const l of FIRE_LEVELS) {
    if (heat >= l.min) lv = l.lv
  }
  return lv
}

export function fireLevelDef(lv: number): CampfireLevel | null {
  return FIRE_LEVELS.find((l) => l.lv === lv) ?? null
}
