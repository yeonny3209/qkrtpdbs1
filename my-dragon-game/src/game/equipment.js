/* ==================================================================
   장비 시스템 (기획서 4.3)

   슬롯 5칸 · 등급 6단계 · 강화 +0~+15 · 세트 효과 4종.

   [저장 방식] 아이템의 능력치를 통째로 저장하지 않는다.
   { uid, slot, grade, seed, plus } 만 남기고 나머지는 seed 로 다시
   만들어낸다. 무한의 탑에서 아이템이 수백 개 쏟아지는데 전부
   펼쳐서 저장하면 localStorage 가 금방 찬다.

   [스탯이 붙는 순서] statsOf 가 이미 기획서 상한(HP 5000 등)으로
   조여진 값을 주므로, 장비는 그 뒤에 더한다. 장비를 끼면 상한을
   넘어설 수 있어야 장비를 모으는 의미가 있다.
   ================================================================== */
import { STAT_KEYS, statsOf } from './dragons.js'
import { makeRng } from './rng.js'

/* ---------------- 슬롯 ---------------- */
export const SLOTS = [
  { id: 'hat', name: '모자', icon: '👑', stats: ['mdef', 'hp'] },
  { id: 'top', name: '상의', icon: '🎽', stats: ['def', 'hp'] },
  { id: 'bottom', name: '하체', icon: '👖', stats: ['agi', 'def'] },
  { id: 'tail', name: '꼬리', icon: '🐉', stats: ['atk', 'matk'] },
  { id: 'acc', name: '장신구', icon: '💍', stats: null },   // null = 아무 스탯이나
]
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]))
export const SLOT_IDS = SLOTS.map((s) => s.id)

/* ---------------- 등급 ---------------- */
export const GEAR_GRADES = [
  { id: 'common', name: '일반', color: '#94a3b8', mul: 1.0 },
  { id: 'rare', name: '희귀', color: '#38bdf8', mul: 1.7 },
  { id: 'epic', name: '에픽', color: '#c084fc', mul: 2.8 },
  { id: 'legend', name: '레전드', color: '#fbbf24', mul: 4.5 },
  { id: 'mythic', name: '신화', color: '#f472b6', mul: 7.0, rainbow: true },
  { id: 'transcend', name: '초월', color: '#fde047', mul: 11.0, dark: true },
]
export const GRADE_BY_ID = Object.fromEntries(GEAR_GRADES.map((g) => [g.id, g]))
export const GRADE_IDS = GEAR_GRADES.map((g) => g.id)
export const gradeRank = (id) => GRADE_IDS.indexOf(id)

/* ---------------- 세트 효과 (5칸 전부 같은 세트) ---------------- */
export const GEAR_SETS = [
  { id: 'attack', name: '공격형', icon: '⚔', desc: 'ATK +20%, 크리티컬 확률 +15%',
    pct: { atk: 0.20 }, critAdd: 15 },
  { id: 'defense', name: '방어형', icon: '🛡', desc: 'DEF +25%, MDEF +20%',
    pct: { def: 0.25, mdef: 0.20 } },
  { id: 'speed', name: '속도형', icon: '💨', desc: 'AGI +25%, 선공 확률 +15%',
    pct: { agi: 0.25 }, firstStrike: 15 },
  { id: 'balance', name: '밸런스', icon: '⚖', desc: '모든 스탯 +12%',
    pct: Object.fromEntries(STAT_KEYS.map((k) => [k, 0.12])) },
]
export const SET_BY_ID = Object.fromEntries(GEAR_SETS.map((s) => [s.id, s]))

/* ---------------- 강화 ---------------- */
export const MAX_PLUS = 15
/* 한 단계마다 기본치의 8%씩. +15면 2.2배 */
export const plusMul = (plus) => 1 + Math.max(0, Math.min(MAX_PLUS, plus)) * 0.08

/* 실패 확률은 +5부터 생기고 최대 40% (기획서 4.3) */
export function failChance(fromPlus) {
  if (fromPlus < 5) return 0
  return Math.min(0.40, (fromPlus - 4) * 0.04)
}
/* 실패해도 아이템이 깨지지는 않는다. 강화 수치만 1 내려간다.
   모아 온 장비가 사라지면 다시 도전할 마음이 사라진다. */
export const enhanceGold = (fromPlus) => Math.round(1200 * Math.pow(1.55, fromPlus))
/* 보호권을 쓰면 실패해도 수치가 내려가지 않는다 */
export const PROTECT_GEM_COST = 80

/* ---------------- 아이템 만들기 ----------------
   같은 seed 면 언제 불러도 같은 아이템이 나온다. */
const STAT_BASE = { hp: 150, atk: 15, matk: 15, def: 10, mdef: 10, agi: 8 }

const PREFIX = {
  common: ['낡은', '무딘', '평범한'],
  rare: ['벼려진', '숲의', '단단한'],
  epic: ['폭풍의', '심연의', '고대의'],
  legend: ['용왕의', '봉인된', '불멸의'],
  mythic: ['신화의', '창세의', '별을 삼킨'],
  transcend: ['초월의', '경계 너머의', '이름 없는'],
}

export function gearInfo(item) {
  const rng = makeRng(item.seed)
  const slot = SLOT_BY_ID[item.slot]
  const grade = GRADE_BY_ID[item.grade]
  const set = GEAR_SETS[Math.floor(rng() * GEAR_SETS.length)]

  /* 장신구는 아무 스탯이나 2개 — 대신 개당 값이 조금 낮다 */
  let keys = slot.stats
  if (!keys) {
    const pool = [...STAT_KEYS]
    keys = []
    for (let i = 0; i < 2; i++) keys.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }

  const m = plusMul(item.plus || 0)
  const stats = {}
  keys.forEach((k) => {
    const varia = 0.85 + rng() * 0.3
    const flex = slot.stats ? 1 : 0.8
    stats[k] = Math.max(1, Math.round(STAT_BASE[k] * grade.mul * varia * flex * m))
  })

  const prefix = PREFIX[item.grade][Math.floor(rng() * PREFIX[item.grade].length)]
  return { name: `${prefix} ${slot.name}`, slot, grade, set, stats }
}

/* 드롭 — 층/스테이지에서 부르는 진입점 */
export function rollGear(rng, grade, slotId = null) {
  const slot = slotId || SLOT_IDS[Math.floor(rng() * SLOT_IDS.length)]
  return {
    uid: `g${Math.floor(rng() * 0xffffffff).toString(36)}${Date.now().toString(36).slice(-4)}`,
    slot,
    grade,
    seed: Math.floor(rng() * 0xffffffff) >>> 0,
    plus: 0,
  }
}

/* ---------------- 착용 ----------------
   loadout = { hat: uid, top: uid, ... } — 드래곤별로 하나씩 */
export const freshLoadout = () => ({})

/* 5칸이 전부 같은 세트로 채워졌을 때만 세트 효과가 붙는다 */
export function activeSet(items) {
  const worn = SLOT_IDS.map((s) => items[s]).filter(Boolean)
  if (worn.length < SLOT_IDS.length) return null
  const first = gearInfo(worn[0]).set.id
  return worn.every((it) => gearInfo(it).set.id === first) ? SET_BY_ID[first] : null
}

/* 장비가 더해주는 순수 수치 합 */
export function flatBonus(items) {
  const out = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]))
  SLOT_IDS.forEach((s) => {
    const it = items[s]
    if (!it) return
    const info = gearInfo(it)
    for (const [k, v] of Object.entries(info.stats)) out[k] += v
  })
  return out
}

/* 분해 — 되돌려받는 골드 */
export const salvageGold = (item) =>
  Math.round(600 * GRADE_BY_ID[item.grade].mul * (1 + (item.plus || 0) * 0.35))

/* 가방이 무한이면 저장 용량이 계속 불어난다 */
export const INVENTORY_MAX = 150

/* ==================================================================
   최종 능력치 — 레벨/진화 → 장비 → 세트 → 룬

   전투 엔진과 화면이 같은 값을 보게 하려고 여기 하나로 모았다.
   runeMul 은 룬의 스탯 증가율(+5~25%)이며 runes.js 가 계산해 넘긴다.
   ================================================================== */
export function finalStats(dragon, level, evo, items = {}, runeMul = 0) {
  const base = statsOf(dragon, level, evo)
  const flat = flatBonus(items)
  const set = activeSet(items)
  const out = {}
  for (const k of STAT_KEYS) {
    let v = base[k] + flat[k]
    if (set?.pct?.[k]) v *= (1 + set.pct[k])
    if (runeMul) v *= (1 + runeMul)
    out[k] = Math.max(1, Math.round(v))
  }
  return out
}

/* 카드 정렬용 전투력 — dragons.power 와 같은 가중치 */
export function gearedPower(dragon, level, evo, items, runeMul) {
  const s = finalStats(dragon, level, evo, items, runeMul)
  return Math.round(s.hp * 0.25 + (s.atk + s.matk) * 1.6 + (s.def + s.mdef) * 1.2 + s.agi * 1.4)
}
