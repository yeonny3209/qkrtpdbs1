/* ==================================================================
   사이드 던전 (기획서 "사이드 던전")

   경험치 · 금전 · 진화석 세 종류. 각각 초급/중급/상급 3단계이고
   윗단계는 캠페인을 그만큼 진행해야 열린다.

   입장 횟수는 하루 3회로 제한한다. 월정액이면 +2 (기획서 7장),
   프리미엄 상점의 입장권으로 더 늘릴 수 있다.

   전투 자체는 캠페인과 같은 엔진을 쓴다. buildEncounter 가 받는
   "스테이지" 모양을 그대로 만들어 넘기면 된다.
   ================================================================== */
import { dayIndex, SUBSCRIPTION, subActive } from './shop.js'

export const BASE_ENTRIES = 3

export const DUNGEONS = [
  {
    id: 'exp', icon: '📖', name: '수련의 회랑', currency: 'exp',
    color: '#38bdf8',
    desc: '드래곤을 빠르게 키운다. 골드는 나오지 않는다.',
    elements: ['mystic', 'light'],
  },
  {
    id: 'gold', icon: '🪙', name: '보물 금고', currency: 'gold',
    color: '#fbbf24',
    desc: '골드가 쏟아진다. 대신 경험치는 거의 없다.',
    elements: ['earth', 'thunder'],
  },
  {
    id: 'stone', icon: '💠', name: '결정 동굴', currency: 'stones',
    color: '#a78bfa',
    desc: '진화석이 나온다. 진화에 부족한 분신을 대신할 수 있다.',
    elements: ['ice', 'dark'],
  },
]
export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]))

/* 단계별 적 레벨 · 해금 조건(클리어한 스테이지 수) · 보상 배수 */
export const TIERS = [
  { id: 'low', name: '초급', level: 12, needCleared: 5, mul: 1 },
  { id: 'mid', name: '중급', level: 40, needCleared: 30, mul: 3.4 },
  { id: 'high', name: '상급', level: 78, needCleared: 60, mul: 9 },
]
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]))

/* 종류마다 주력 보상만 크게 주고 나머지는 거의 안 준다.
   그래야 "오늘은 뭘 돌지" 고르는 의미가 생긴다. */
const BASE_REWARD = {
  exp: { exp: 900, gold: 60, stones: 0 },
  gold: { exp: 90, gold: 5200, stones: 0 },
  stone: { exp: 120, gold: 200, stones: 8 },
}

export function dungeonReward(dungeonId, tierId) {
  const base = BASE_REWARD[dungeonId]
  const tier = TIER_BY_ID[tierId]
  if (!base || !tier) return { exp: 0, gold: 0, stones: 0 }
  return {
    exp: Math.round(base.exp * tier.mul),
    gold: Math.round(base.gold * tier.mul),
    stones: Math.round(base.stones * tier.mul),
  }
}

export const tierUnlocked = (tierId, clearedCount) => {
  const tier = TIER_BY_ID[tierId]
  return !!tier && clearedCount >= tier.needCleared
}

/* buildEncounter 에 넘길 스테이지 모양 */
export function dungeonStage(dungeonId, tierId) {
  const d = DUNGEON_BY_ID[dungeonId]
  const t = TIER_BY_ID[tierId]
  const reward = dungeonReward(dungeonId, tierId)
  return {
    id: `dg-${dungeonId}-${tierId}`,
    chapter: 99,               // 캠페인 초반 완화가 걸리지 않도록 장 번호를 벗어나게 둔다
    no: 1,
    name: `${d.name} · ${t.name}`,
    boss: false,
    level: t.level,
    count: 3,
    elements: d.elements,
    statMul: 1,
    beat: null,
    exp: reward.exp,
    gold: reward.gold,
    dungeon: dungeonId,
    stones: reward.stones,
  }
}

/* ---------------- 일일 입장 횟수 ---------------- */
export const freshEntries = (today = dayIndex()) => ({ day: today, used: 0, bonus: 0 })

/* 날짜가 바뀌면 사용 횟수와 입장권을 모두 초기화한다.
   입장권을 남겨두면 쌓아뒀다가 한 번에 쓰는 게 가능해져서
   "하루 몇 판"이라는 제한 자체가 의미를 잃는다. */
export function rollEntries(entries, today = dayIndex()) {
  if (!entries || entries.day !== today) return freshEntries(today)
  return entries
}

export function maxEntries(entries, sub, today = dayIndex()) {
  const e = rollEntries(entries, today)
  return BASE_ENTRIES + (subActive(sub, today) ? SUBSCRIPTION.dungeonBonus : 0) + e.bonus
}

export function entriesLeft(entries, sub, today = dayIndex()) {
  const e = rollEntries(entries, today)
  return Math.max(0, maxEntries(e, sub, today) - e.used)
}

export const canEnter = (entries, sub, today = dayIndex()) => entriesLeft(entries, sub, today) > 0

export function spendEntry(entries, today = dayIndex()) {
  const e = rollEntries(entries, today)
  return { ...e, used: e.used + 1 }
}

/* 프리미엄 상점 입장권 */
export function addTickets(entries, n, today = dayIndex()) {
  const e = rollEntries(entries, today)
  return { ...e, bonus: e.bonus + n }
}
