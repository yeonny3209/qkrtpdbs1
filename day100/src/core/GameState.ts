/* ==================================================================
   게임 상태 — 한 덩어리

   런 하나가 이 객체 하나다. 시스템 함수들은 전부 (state, dt) 를 받아
   이걸 고친다. 상태를 여기저기 흩지 않는 이유는 두 가지다.

     - 사망 시 "전부 사라진다"(§14.1)가 객체 하나 버리기로 끝난다
     - 테스트가 브라우저 없이 상태를 만들어 굴려 볼 수 있다

   그래서 이 파일과 systems/ 아래는 DOM 도 Canvas 도 모른다.
   ================================================================== */
import { BALANCE, MODIFIERS, UNLOCKS, itemDef, type ModifierDef } from '../data/index.ts'
import { makeRng, streamOf, type Rng } from './RNG.ts'

export type Vec = { x: number; z: number }

export type Phase = 'day' | 'night' | 'asteroid' | 'dead' | 'escaped'

export type DeathCause =
  | 'spider' | 'suit' | 'oxygen' | 'hunger' | 'asteroid' | 'beast'

export type Stack = { id: string; count: number }

export type Player = {
  x: number
  z: number
  facing: number
  oxygen: number
  maxOxygen: number
  suit: number
  maxSuit: number
  hunger: number
  maxHunger: number
  stamina: number
  running: boolean
  aiming: boolean
  /** 인벤토리는 칸 배열이다. 잡동사니가 한 칸씩 먹는 규칙(§7.3)이 여기서 산다. */
  slots: (Stack | null)[]
  hotbar: number
  equipped: string | null
  axeDurability: number
  gun: string | null
  magazine: number
  reloadT: number
  fireCooldown: number
  flashlightOn: boolean
  flashlightBattery: number
  maxFlashlightBattery: number
  torchCharges: number
  invulnT: number
}

export type Harvestable = {
  id: number
  kind: 'tree_small' | 'tree_large' | 'sapling'
  x: number
  z: number
  hits: number
  /** 묘목이 자라기까지 남은 실시간 초 */
  growT: number
}

export type JunkNode = { id: number; x: number; z: number; item: string }
export type FuelNode = { id: number; x: number; z: number; item: string; grade: number }

export type Building = {
  id: number
  type: string
  x: number
  z: number
  /** 저장고 내용물, 밭 진행도, 포탑 쿨타임 등 종류별 부속 상태 */
  store?: Stack[]
  timerDays?: number
  cooldown?: number
  armed?: boolean
  crop?: string | null
}

export type Beast = {
  id: number
  type: string
  x: number
  z: number
  hp: number
  state: 'idle' | 'chase' | 'flee' | 'attack' | 'recover' | 'bound'
  stateT: number
  targetX: number
  targetZ: number
  attackCd: number
  boundT: number
}

export type Spider = {
  id: number
  x: number
  z: number
  stunT: number
  speed: number
}

export type Lab = {
  id: number
  tier: 1 | 2 | 3 | 4
  x: number
  z: number
  cleared: boolean
  reward: string
}

export type Armory = { id: number; x: number; z: number; opened: boolean }

export type Campfire = {
  /** 타는 중인 연료. 앞에서부터 소모된다. */
  burning: { item: string; grade: number; remain: number }[]
  level: number
  bestLevel: number
  safeRadius: number
  cooking: { item: string; remain: number } | null
}

export type AsteroidRun = {
  active: boolean
  tier: number
  remain: number
  shipX: number
  shipY: number
  rocks: { x: number; y: number; vx: number; vy: number; r: number }[]
  spawnT: number
  hitFlash: number
}

export type RunFlags = {
  hasMap: boolean
  hasClock: boolean
  hasObservatory: boolean
  hasCompass: boolean
}

export type GameState = {
  seed: string
  rng: Rng
  streams: Record<string, Rng>
  modifier: ModifierDef

  phase: Phase
  day: number
  phaseT: number
  daySeconds: number
  nightSeconds: number
  elapsed: number
  warned: boolean

  player: Player
  campfire: Campfire
  craftLevel: number

  trees: Harvestable[]
  junk: JunkNode[]
  fuelNodes: FuelNode[]
  buildings: Building[]
  beasts: Beast[]
  spiders: Spider[]
  labs: Lab[]
  armories: Armory[]
  /* 연구소 안에서는 시간이 멈추고 밖으로 못 나간다(§12.1) */
  activeLab: { id: number; x: number; z: number; radius: number } | null
  bullets: { x: number; z: number; vx: number; vz: number; life: number; dmg: number }[]

  /** 밟은 타일. FogOfWar 가 채운다(§6.4). */
  explored: Uint8Array

  coreParts: string[]
  escapeBuilt: string[]
  dockBuilt: boolean

  asteroid: AsteroidRun
  asteroidFailures: number
  allowedFailures: number
  nextAsteroidDay: number

  flags: RunFlags
  unlocks: string[]

  death: { cause: DeathCause | null; day: number }
  toasts: { text: string; life: number; tone: 'info' | 'warn' | 'good' }[]
  nextId: number

  /** 시스템끼리 주고받는 한 프레임짜리 신호 (사운드·연출용) */
  events: string[]
}

const P = BALANCE.player

function emptySlots(n: number): (Stack | null)[] {
  return Array.from({ length: n }, () => null)
}

export function unlockEffects(unlocks: string[]) {
  const owned = UNLOCKS.filter((u) => unlocks.includes(u.id))
  const merged: {
    flashlightBatterySeconds: number
    startItems: Record<string, number>
    startCraftLevel: number
    startFlags: string[]
    startMaxSuit: number
    startMaxOxygen: number
    startFuel: Record<string, number>
    allowedFailures: number
  } = {
    flashlightBatterySeconds: BALANCE.spider.flashlightBatterySeconds,
    startItems: {},
    startCraftLevel: 1,
    startFlags: [],
    startMaxSuit: P.maxSuit,
    startMaxOxygen: P.maxOxygen,
    startFuel: {},
    allowedFailures: BALANCE.asteroid.allowedFailures,
  }
  for (const u of owned) {
    const e = u.effects
    if (e.flashlightBatterySeconds) merged.flashlightBatterySeconds = e.flashlightBatterySeconds
    if (e.startItems) Object.assign(merged.startItems, e.startItems)
    if (e.startCraftLevel) merged.startCraftLevel = Math.max(merged.startCraftLevel, e.startCraftLevel)
    if (e.startFlags) merged.startFlags.push(...e.startFlags)
    if (e.startMaxSuit) merged.startMaxSuit = e.startMaxSuit
    if (e.startMaxOxygen) merged.startMaxOxygen = e.startMaxOxygen
    if (e.startFuel) Object.assign(merged.startFuel, e.startFuel)
    if (e.allowedFailures) merged.allowedFailures = e.allowedFailures
  }
  return merged
}

export function pickModifier(seed: string): ModifierDef {
  return streamOf(seed, 'modifier').pick(MODIFIERS)
}

export type NewRunOptions = {
  seed: string
  unlocks?: string[]
  modifierId?: string
}

/** 월드는 아직 비어 있다. MapGen 이 채운다. */
export function createRun(opts: NewRunOptions): GameState {
  const seed = opts.seed
  const unlocks = opts.unlocks ?? []
  const eff = unlockEffects(unlocks)
  const modifier = opts.modifierId
    ? (MODIFIERS.find((m) => m.id === opts.modifierId) ?? MODIFIERS[0])
    : pickModifier(seed)

  const tiles = BALANCE.map.tiles
  const mods = modifier.effects

  const player: Player = {
    x: BALANCE.map.centerTile,
    z: BALANCE.map.centerTile + 2,
    facing: -Math.PI / 2,
    oxygen: eff.startMaxOxygen,
    maxOxygen: eff.startMaxOxygen,
    suit: eff.startMaxSuit,
    maxSuit: eff.startMaxSuit,
    hunger: P.maxHunger,
    maxHunger: P.maxHunger,
    stamina: P.maxStamina,
    running: false,
    aiming: false,
    slots: emptySlots(P.inventorySlots),
    hotbar: 0,
    equipped: 'axe_old',
    axeDurability: 60,
    gun: null,
    magazine: 0,
    reloadT: 0,
    fireCooldown: 0,
    flashlightOn: false,
    flashlightBattery: eff.flashlightBatterySeconds,
    maxFlashlightBattery: eff.flashlightBatterySeconds,
    torchCharges: 0,
    invulnT: 0,
  }

  const state: GameState = {
    seed,
    rng: makeRng(seed),
    streams: {
      map: streamOf(seed, 'map'),
      spawn: streamOf(seed, 'spawn'),
      loot: streamOf(seed, 'loot'),
      ai: streamOf(seed, 'ai'),
      asteroid: streamOf(seed, 'asteroid'),
      farm: streamOf(seed, 'farm'),
    },
    modifier,

    phase: 'day',
    day: 1,
    phaseT: 0,
    daySeconds: mods.daySeconds ?? BALANCE.time.daySeconds,
    nightSeconds: mods.nightSeconds ?? BALANCE.time.nightSeconds,
    elapsed: 0,
    warned: false,

    player,
    campfire: {
      burning: [],
      level: 0,
      bestLevel: 0,
      safeRadius: 0,
      cooking: null,
    },
    craftLevel: eff.startCraftLevel,

    trees: [],
    junk: [],
    fuelNodes: [],
    buildings: [],
    beasts: [],
    spiders: [],
    labs: [],
    armories: [],
    activeLab: null,
    bullets: [],

    explored: new Uint8Array(tiles * tiles),

    coreParts: [],
    escapeBuilt: [],
    dockBuilt: false,

    asteroid: {
      active: false,
      tier: 1,
      remain: 0,
      shipX: 0,
      shipY: 0,
      rocks: [],
      spawnT: 0,
      hitFlash: 0,
    },
    asteroidFailures: 0,
    allowedFailures: eff.allowedFailures,
    nextAsteroidDay: mods.asteroidEveryDays ?? BALANCE.asteroid.everyDays,

    flags: {
      hasMap: eff.startFlags.includes('hasMap'),
      hasClock: eff.startFlags.includes('hasClock'),
      hasObservatory: eff.startFlags.includes('hasObservatory'),
      hasCompass: eff.startFlags.includes('hasCompass'),
    },
    unlocks,

    death: { cause: null, day: 0 },
    toasts: [],
    nextId: 1,
    events: [],
  }

  /* 해금으로 받는 시작 물자 */
  for (const [id, n] of Object.entries(eff.startItems)) {
    addItem(state, id, n)
  }
  for (const [id, n] of Object.entries(eff.startFuel)) {
    const grade = (BALANCE.fuel as Record<string, { grade: number; burnSeconds: number }>)[id]
    for (let i = 0; i < n; i++) {
      state.campfire.burning.push({ item: id, grade: grade.grade, remain: grade.burnSeconds })
    }
  }

  return state
}

export function nextId(s: GameState): number {
  return s.nextId++
}

export function toast(s: GameState, text: string, tone: 'info' | 'warn' | 'good' = 'info') {
  s.toasts.push({ text, life: 3.2, tone })
  if (s.toasts.length > 5) s.toasts.shift()
}

/* ── 인벤토리 ─────────────────────────────────────────────────────
   잡동사니는 stack 이 1 이라 칸을 하나씩 먹는다(§7.3). 이게 왕복
   동선을 만드는 장치라, 특례를 두지 않고 stack 값으로만 처리한다. */

export function countItem(s: GameState, id: string): number {
  let n = 0
  for (const slot of s.player.slots) if (slot && slot.id === id) n += slot.count
  return n
}

export function freeSlots(s: GameState): number {
  return s.player.slots.filter((x) => x === null).length
}


/** 넣을 수 있는 만큼 넣고, 못 넣은 개수를 돌려준다. */
export function addItem(s: GameState, id: string, count: number): number {
  const def = itemDef(id)
  let left = count
  const slots = s.player.slots
  if (def.stack > 1) {
    for (const slot of slots) {
      if (left <= 0) break
      if (slot && slot.id === id && slot.count < def.stack) {
        const room = def.stack - slot.count
        const put = Math.min(room, left)
        slot.count += put
        left -= put
      }
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] === null) {
      const put = Math.min(def.stack, left)
      slots[i] = { id, count: put }
      left -= put
    }
  }
  return left
}

export function removeItem(s: GameState, id: string, count: number): boolean {
  if (countItem(s, id) < count) return false
  let left = count
  const slots = s.player.slots
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const slot = slots[i]
    if (!slot || slot.id !== id) continue
    const take = Math.min(slot.count, left)
    slot.count -= take
    left -= take
    if (slot.count <= 0) slots[i] = null
  }
  return true
}

export function hasAll(s: GameState, cost: Record<string, number>): boolean {
  for (const [id, n] of Object.entries(cost)) {
    if (id.startsWith('core_')) {
      if (!s.coreParts.includes(id)) return false
    } else if (countItem(s, id) < n) return false
  }
  return true
}

export function payAll(s: GameState, cost: Record<string, number>): boolean {
  if (!hasAll(s, cost)) return false
  for (const [id, n] of Object.entries(cost)) {
    if (id.startsWith('core_')) {
      s.coreParts = s.coreParts.filter((c) => c !== id)
    } else {
      removeItem(s, id, n)
    }
  }
  return true
}

export function distance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz)
}

export function inCampfire(s: GameState): boolean {
  if (s.campfire.level <= 0) return false
  const c = BALANCE.map.centerTile
  return distance(s.player.x, s.player.z, c, c) <= s.campfire.safeRadius
}
