/* ==================================================================
   무한의 탑 (기획서 8.1 "무한 도전")

   500층. 층마다 보상이 있고, 50층부터 룬이 나온다.

   난이도 구간
     1~50     초급          기본 난이도
     51~100   중급          점진적 상향
     101~200  상급          급격한 상승 시작
     201~300  매우 어려움
     301~400  극난이도
     401~499  최악
     500      최종 보스

   [난이도를 올리는 방식] 캠페인과 같은 원칙을 지킨다 — 공격과 방어를
   같은 비율로 올리면 체감 난이도가 배율의 제곱으로 뛴다. 그래서 HP를
   주로 키우고 공격은 완만하게, 방어는 더 완만하게 올린다.
   방어를 크게 올리면 내 피해가 감쇠식에 막혀 전투가 한없이 길어진다.
   ================================================================== */
import { makeRng } from './rng.js'
import { DRAGONS } from './dragons.js'
import { rollGear, GRADE_IDS } from './equipment.js'
import { rollRune, runeGradeForFloor, RUNE_FIRST_FLOOR } from './runes.js'
import { ELEMENT_IDS } from './elements.js'

export const MAX_FLOOR = 500

export const BANDS = [
  { from: 1, to: 50, name: '초급', color: '#4ade80' },
  { from: 51, to: 100, name: '중급', color: '#38bdf8' },
  { from: 101, to: 200, name: '상급', color: '#a78bfa' },
  { from: 201, to: 300, name: '매우 어려움', color: '#f472b6' },
  { from: 301, to: 400, name: '극난이도', color: '#fb923c' },
  { from: 401, to: 499, name: '최악', color: '#ef4444' },
  { from: 500, to: 500, name: '최종 보스', color: '#fde047' },
]
export const bandOf = (floor) => BANDS.find((b) => floor >= b.from && floor <= b.to) || BANDS[0]

/* 10층마다 보스. 층 이름과 편성에 쓴다. */
export const isBossFloor = (floor) => floor % 10 === 0
export const isMilestone = (floor) => !!MILESTONES[floor]

/* 적 레벨 — 100층이면 이미 Lv.100 이다. 그 위로는 레벨이 아니라
   배율로 어려워진다. 레벨만 올리면 Lv.100 상한에 막혀 버린다. */
export function floorLevel(floor) {
  return Math.max(1, Math.min(100, Math.round(1 + (floor - 1) * 0.99)))
}

/* 구간별 난이도 진척도 0~1. 구간이 올라갈수록 같은 층수를 올라도
   더 많이 오른다 — 기획서의 "100층 이상 급격한 상승". */
const CURVE = [
  [1, 0.00], [50, 0.05], [100, 0.13], [200, 0.30],
  [300, 0.50], [400, 0.74], [500, 1.00],
]
export function growth(floor) {
  const f = Math.max(1, Math.min(MAX_FLOOR, floor))
  for (let i = 1; i < CURVE.length; i++) {
    const [f0, g0] = CURVE[i - 1]
    const [f1, g1] = CURVE[i]
    if (f <= f1) return g0 + ((f - f0) / (f1 - f0)) * (g1 - g0)
  }
  return 1
}

/* 방어력은 거의 올리지 않는다.
   피해 감쇠식이 power × K/(K+def) 라서, 방어가 조금만 높아져도 내
   피해가 급감한다. 적 방어를 몇 배로 올리면 때려도 안 죽는 사태가
   되어 라운드 제한에 걸려 무승부만 난다. 난이도는 체력이 진다. */
export function towerMultipliers(floor) {
  const g = growth(floor)
  const boss = isBossFloor(floor)
  return {
    hp: (1 + g * 8.5) * (boss ? 1.4 : 1),
    atk: (1 + g * 2.2) * (boss ? 1.12 : 1),
    matk: (1 + g * 2.2) * (boss ? 1.12 : 1),
    def: (1 + g * 0.35) * (boss ? 1.05 : 1),
    mdef: (1 + g * 0.35) * (boss ? 1.05 : 1),
    agi: (1 + g * 0.25) * (boss ? 1.05 : 1),
  }
}

/* 구간 안내에 쓰는 "보스 보정을 뺀" 체력 배수.
   towerMultipliers 를 그대로 쓰면 층에 따라 보스 보정이 붙었다 말았다 해서
   위 구간이 아래 구간보다 낮아 보이는 일이 생긴다. */
export const baseHpMul = (floor) => 1 + growth(floor) * 8.5

/* 고층은 적 체력이 커서 캠페인용 50라운드 제한에 먼저 걸린다.
   탑에서는 길게 싸울 수 있도록 상한을 따로 준다. */
export const TOWER_MAX_ROUNDS = 110

/* 층마다 등장 속성이 돌아간다 — 같은 팀으로 500층을 밀 수 없도록 */
export function floorElements(floor) {
  const rng = makeRng(floor * 7919 + 13)
  const n = floor <= 20 ? 1 : 2
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(ELEMENT_IDS[(floor * 3 + i * 5 + Math.floor(rng() * 8)) % ELEMENT_IDS.length])
  }
  return out
}

function rarityForFloor(floor) {
  if (floor >= 200) return 'legend'
  if (floor >= 90) return 'epic'
  if (floor >= 35) return 'rare'
  return 'common'
}

/* buildEncounter 가 받는 "스테이지" 모양 */
export function towerStage(floor) {
  const boss = isBossFloor(floor)
  const rw = floorReward(floor)
  return {
    id: `tower-${floor}`,
    chapter: 99,                 // 캠페인 초반 완화가 걸리지 않도록
    no: floor,
    name: boss ? `${floor}층 — 수호자` : `무한의 탑 ${floor}층`,
    boss,
    level: floorLevel(floor),
    count: floor <= 10 ? 1 : floor <= 40 ? 2 : 3,
    elements: floorElements(floor),
    statMul: towerMultipliers(floor),
    beat: false,
    exp: rw.exp,
    gold: rw.gold,
    tower: floor,
  }
}

/* 탑 전용 적 — 속성/등급만 맞추면 되므로 도감에서 골라 쓴다 */
export function towerEnemies(floor, teamSize = 3, seed = floor) {
  const rng = makeRng(seed * 2654435761 >>> 0)
  const stage = towerStage(floor)
  const rarity = rarityForFloor(floor)
  const count = Math.max(1, Math.min(stage.count, teamSize))
  return Array.from({ length: count }, (_, i) => {
    const element = stage.elements[i % stage.elements.length]
    const pool = DRAGONS.filter((d) => d.element === element && d.rarity === rarity)
    const list = pool.length ? pool : DRAGONS.filter((d) => d.element === element)
    return {
      dragon: list[Math.floor(rng() * list.length)] || DRAGONS[0],
      level: stage.level,
      evo: floor >= 150 ? 3 : floor >= 60 ? 1 : 0,
      statMul: stage.statMul,
    }
  })
}

/* ---------------- 보상 ---------------- */
export function floorReward(floor) {
  const g = growth(floor)
  return {
    exp: Math.round((120 + floor * 14) * (1 + g * 0.25)),
    gold: Math.round((90 + floor * 11) * (1 + g * 0.22)),
    gems: isBossFloor(floor) ? 20 + Math.floor(floor / 10) * 2 : 0,
    stones: isBossFloor(floor) ? 4 + Math.floor(floor / 25) : 0,
  }
}

/* 장비 드롭 등급 — 층이 오를수록 좋은 게 나온다 */
export function gearGradeForFloor(floor, rng) {
  const table =
    floor >= 400 ? ['legend', 'mythic', 'mythic', 'transcend']
      : floor >= 300 ? ['epic', 'legend', 'mythic', 'mythic']
        : floor >= 200 ? ['epic', 'legend', 'legend', 'mythic']
          : floor >= 100 ? ['rare', 'epic', 'epic', 'legend']
            : floor >= 40 ? ['common', 'rare', 'rare', 'epic']
              : ['common', 'common', 'rare']
  return table[Math.floor(rng() * table.length)]
}

/* 장비는 5층마다, 보스층은 항상 떨어진다 */
export const gearDropsAt = (floor) => isBossFloor(floor) || floor % 5 === 0

/* 룬은 50층부터, 10층마다 (보스층과 같은 주기) */
export const runeDropsAt = (floor) => floor >= RUNE_FIRST_FLOOR && isBossFloor(floor)

/* ---------------- 이정표 보상 (기획서 8.1) ---------------- */
export const MILESTONES = {
  50: { text: '첫 룬 획득', rune: 'common', gems: 300 },
  100: { text: '에픽 등급 룬', rune: 'epic', gems: 600 },
  200: { text: '레전더리 등급 룬', rune: 'legendary', gems: 1200 },
  300: { text: '신화 등급 장비', gear: 'mythic', gems: 2000 },
  400: { text: '특수 드래곤 알', dragonEgg: true, gems: 3000 },
  500: { text: '전설의 보상', gear: 'transcend', rune: 'legendary', dragonEgg: true, gems: 10000 },
}

/* 한 층을 깼을 때 실제로 주는 것 전부 */
export function climbRewards(floor, seed = Date.now()) {
  const rng = makeRng((seed ^ (floor * 40503)) >>> 0)
  const base = floorReward(floor)
  const out = { ...base, gear: [], runes: [], dragonEgg: false, milestone: null }

  if (gearDropsAt(floor)) out.gear.push(rollGear(rng, gearGradeForFloor(floor, rng)))
  if (runeDropsAt(floor)) out.runes.push(rollRune(rng, runeGradeForFloor(floor)))

  const ms = MILESTONES[floor]
  if (ms) {
    out.milestone = ms
    out.gems += ms.gems || 0
    if (ms.rune) out.runes.push(rollRune(rng, ms.rune))
    if (ms.gear) out.gear.push(rollGear(rng, ms.gear))
    if (ms.dragonEgg) out.dragonEgg = true
  }
  return out
}

/* 특수 드래곤 알 — 한정 레전드 한 마리 */
export function hatchEgg(seed = Date.now()) {
  const rng = makeRng(seed >>> 0)
  const pool = DRAGONS.filter((d) => d.kind === 'limitedLegend')
  return pool[Math.floor(rng() * pool.length)]
}

/* ---------------- 진행 상태 ---------------- */
export const freshTower = () => ({ best: 0 })
/* 다음에 도전할 층 = 최고 기록 +1 */
export const nextFloor = (tower) => Math.min(MAX_FLOOR, (tower?.best ?? 0) + 1)
export const towerCleared = (tower) => (tower?.best ?? 0) >= MAX_FLOOR

/* 앞으로 남은 이정표 중 가장 가까운 것 */
export function nextMilestone(tower) {
  const cur = tower?.best ?? 0
  const floors = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b)
  const f = floors.find((x) => x > cur)
  return f ? { floor: f, ...MILESTONES[f] } : null
}

export { GRADE_IDS }
