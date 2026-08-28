/* ==================================================================
   게임 상태 — 한 덩어리

   런 하나가 이 객체 하나다. 시스템 함수들은 전부 (state, dt) 를 받아
   이걸 고친다. 흩지 않는 이유는 둘이다.

     - 사망 시 "전부 사라진다"(§16.1)가 객체 하나 버리기로 끝난다
     - 테스트가 브라우저 없이 상태를 만들어 굴려 볼 수 있다

   그래서 이 파일과 systems/ 아래는 DOM 도 Canvas 도 모른다.
   ================================================================== */
import {
  BALANCE, CREW, JOBS, MODIFIERS, itemDef,
  type ModifierDef, type JobDef,
} from '../data/index.ts'
import { makeRng, streamOf, type Rng } from './RNG.ts'

export type Phase = 'day' | 'night' | 'asteroid' | 'dead' | 'escaped'

export type DeathCause =
  | 'spider' | 'spider_hungry' | 'suit' | 'oxygen' | 'hunger'
  | 'asteroid' | 'beast' | 'raider' | 'storm'

export type WeatherKind = 'clear' | 'acid_rain' | 'magnetic_storm' | 'spore_fog'

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
  /** 잡동사니가 한 칸씩 먹는 규칙(§7.3)이 여기서 산다 */
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
  /** 자기폭풍 낙뢰 판정용 — 얼마나 가만히 있었나 */
  stillT: number
  stormWarnT: number
}

export type Harvestable = {
  id: number
  kind: 'tree_small' | 'tree_large' | 'sapling'
  x: number
  z: number
  hits: number
  growT: number
}

export type JunkNode = { id: number; x: number; z: number; item: string }
export type FuelNode = { id: number; x: number; z: number; item: string }
export type SalvageNode = { id: number; x: number; z: number }

export type Building = {
  id: number
  type: string
  x: number
  z: number
  store?: Stack[]
  timerDays?: number
  cooldown?: number
  armed?: boolean
  crop?: string | null
  hp?: number
  maxHp?: number
}

export type Beast = {
  id: number
  type: string
  x: number
  z: number
  hp: number
  state: 'idle' | 'chase' | 'flee' | 'recover' | 'bound'
  stateT: number
  wanderX: number
  wanderZ: number
  attackCd: number
  boundT: number
}

export type Spider = {
  id: number
  x: number
  z: number
  stunT: number
  rollT: number
}

export type Lab = {
  id: number
  tier: 1 | 2 | 3 | 4
  x: number
  z: number
  cleared: boolean
  crew: string
  core: string
}

export type Cache = {
  id: number
  x: number
  z: number
  tier: string
  opened: boolean
}

export type Outpost = { id: number; x: number; z: number; cleared: boolean }

export type Campfire = {
  /** §3.1 의 단일 화력 수치. 이 하나가 게임 전체를 정한다. */
  heat: number
  level: number
  /** 개방 반경과 몹 등급은 이 값 기준 — 한번 열리면 안 닫힌다(§3.3) */
  maxReachedLevel: number
  safeRadius: number
  openRadius: number
  extinguished: boolean
  drainMultiplier: number
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

export type SalvageRun = {
  active: boolean
  nodeId: number
  marker: number
  dir: number
  cooldown: number
  level: number
  successes: number
  lastResult: 'perfect' | 'good' | 'miss' | null
  resultT: number
}

export type RaidState = {
  active: boolean
  announced: boolean
  nextDay: number
  wave: number
  failed: boolean
}

export type Weather = {
  kind: WeatherKind
  remain: number
  nextCheckDay: number
}

export type RunFlags = {
  hasMap: boolean
  hasClock: boolean
  hasCompass: boolean
  hasObservatory: boolean
}

export type GameState = {
  seed: string
  rng: Rng
  streams: Record<string, Rng>
  modifier: ModifierDef
  job: JobDef

  phase: Phase
  day: number
  phaseT: number
  daySeconds: number
  nightSeconds: number
  elapsed: number
  warned: boolean

  player: Player
  campfire: Campfire
  moduleLevel: number

  trees: Harvestable[]
  junk: JunkNode[]
  fuelNodes: FuelNode[]
  salvageNodes: SalvageNode[]
  buildings: Building[]
  beasts: Beast[]
  raiders: Beast[]
  spiders: Spider[]
  labs: Lab[]
  caches: Cache[]
  outposts: Outpost[]
  bullets: { x: number; z: number; vx: number; vz: number; life: number; dmg: number; fromPlayer: boolean; pierce: boolean }[]

  /** 밟은 타일만 기록(§6.2) */
  explored: Uint8Array

  crew: string[]
  crewT: Record<string, number>
  coreParts: string[]
  escapeBuilt: string[]
  dockBuilt: boolean

  asteroid: AsteroidRun
  asteroidFailures: number
  allowedFailures: number
  asteroidDone: number[]

  salvage: SalvageRun
  raid: RaidState
  weather: Weather

  /** 연구소 안에서는 시간이 멈추고 밖으로 못 나간다(§12.1) */
  activeLab: { id: number; x: number; z: number; radius: number } | null

  flags: RunFlags

  death: { cause: DeathCause | null; day: number }
  toasts: { text: string; life: number; tone: 'info' | 'warn' | 'good' | 'danger' }[]
  banner: { text: string; life: number } | null
  nextId: number
  events: string[]
}

const P = BALANCE.player

function emptySlots(n: number): (Stack | null)[] {
  return Array.from({ length: n }, () => null)
}

export function jobById(id: string): JobDef {
  return JOBS.find((j) => j.id === id) ?? JOBS[0]
}

export function pickModifier(seed: string): ModifierDef {
  return streamOf(seed, 'modifier').pick(MODIFIERS)
}

export type NewRunOptions = {
  seed: string
  jobId?: string
  modifierId?: string
}

/** 월드는 아직 비어 있다. MapGen 이 채운다. */
export function createRun(opts: NewRunOptions): GameState {
  const seed = opts.seed
  const job = jobById(opts.jobId ?? 'pilot')
  const je = job.effects
  const modifier = opts.modifierId
    ? (MODIFIERS.find((m) => m.id === opts.modifierId) ?? MODIFIERS[0])
    : pickModifier(seed)
  const mods = modifier.effects
  const tiles = BALANCE.map.tiles

  const player: Player = {
    x: BALANCE.map.centerTile,
    z: BALANCE.map.centerTile + 3,
    facing: -Math.PI / 2,
    oxygen: je.startMaxOxygen ?? P.maxOxygen,
    maxOxygen: je.startMaxOxygen ?? P.maxOxygen,
    suit: P.maxSuit,
    maxSuit: P.maxSuit,
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
    flashlightBattery: BALANCE.spider.flashlightBatterySeconds,
    maxFlashlightBattery: BALANCE.spider.flashlightBatterySeconds,
    torchCharges: BALANCE.spider.torchUsesPerPickup,
    stillT: 0,
    stormWarnT: 0,
  }

  const startFlags = je.startFlags ?? []

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
      weather: streamOf(seed, 'weather'),
      raid: streamOf(seed, 'raid'),
    },
    modifier,
    job,

    phase: 'day',
    day: 1,
    phaseT: 0,
    daySeconds: mods.daySeconds ?? BALANCE.time.daySeconds,
    nightSeconds: mods.nightSeconds ?? BALANCE.time.nightSeconds,
    elapsed: 0,
    warned: false,

    player,
    campfire: {
      heat: 0,
      level: 0,
      maxReachedLevel: 0,
      safeRadius: 0,
      openRadius: 0,
      extinguished: true,
      drainMultiplier: 1,
      cooking: null,
    },
    moduleLevel: je.startModuleLevel ?? 1,

    trees: [],
    junk: [],
    fuelNodes: [],
    salvageNodes: [],
    buildings: [],
    beasts: [],
    raiders: [],
    spiders: [],
    labs: [],
    caches: [],
    outposts: [],
    bullets: [],

    explored: new Uint8Array(tiles * tiles),

    crew: [],
    crewT: {},
    coreParts: [],
    escapeBuilt: [],
    dockBuilt: false,

    asteroid: {
      active: false, tier: 1, remain: 0, shipX: 0, shipY: 0,
      rocks: [], spawnT: 0, hitFlash: 0,
    },
    asteroidFailures: 0,
    allowedFailures: BALANCE.asteroid.allowedFailures,
    asteroidDone: [],

    salvage: {
      active: false, nodeId: 0, marker: 0, dir: 1, cooldown: 0,
      level: 0, successes: 0, lastResult: null, resultT: 0,
    },
    raid: {
      active: false,
      announced: false,
      nextDay: mods.raidEveryDays ?? BALANCE.raid.everyDays,
      wave: 0,
      failed: false,
    },
    weather: { kind: 'clear', remain: 0, nextCheckDay: 2 },

    activeLab: null,

    flags: {
      hasMap: startFlags.includes('hasMap'),
      hasClock: startFlags.includes('hasClock'),
      hasCompass: startFlags.includes('hasCompass'),
      hasObservatory: startFlags.includes('hasObservatory'),
    },

    death: { cause: null, day: 0 },
    toasts: [],
    banner: null,
    nextId: 1,
    events: [],
  }

  /* 직책이 주는 시작 물자(§16.3) */
  for (const [id, n] of Object.entries(je.startItems ?? {})) addItem(state, id, n)
  if (je.startTraps) addItem(state, 'log', je.startTraps * 5)

  /* 관제사 — 대원 하나가 이미 구출된 상태로 시작 */
  if (je.startCrew) {
    const def = CREW.find((c) => c.id === je.startCrew)
    if (def) {
      state.crew.push(def.id)
      state.coreParts.push(def.core)
    }
  }

  return state
}

export function nextId(s: GameState): number {
  return s.nextId++
}

export function toast(
  s: GameState,
  text: string,
  tone: 'info' | 'warn' | 'good' | 'danger' = 'info',
): void {
  s.toasts.push({ text, life: 3.4, tone })
  if (s.toasts.length > 5) s.toasts.shift()
}

/** 화면 중앙 대형 문구 — 불이 꺼졌을 때, 습격 예고 같은 것 */
export function banner(s: GameState, text: string, life = 4): void {
  s.banner = { text, life }
}

/* ── 인벤토리 ───────────────────────────────────────────────────── */

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
        const put = Math.min(def.stack - slot.count, left)
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
    if (id.startsWith('core_')) s.coreParts = s.coreParts.filter((c) => c !== id)
    else removeItem(s, id, n)
  }
  return true
}

export function distance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz)
}

const C = BALANCE.map.centerTile

/** 캠프파이어 안전반경 안인가. 불이 꺼져 있으면 안전지대가 없다(§3.4). */
export function inCampfire(s: GameState): boolean {
  if (s.campfire.level <= 0) return false
  return distance(s.player.x, s.player.z, C, C) <= s.campfire.safeRadius
}

export function hasCrew(s: GameState, id: string): boolean {
  return s.crew.includes(id)
}
