/* ==================================================================
   드래곤 도감 — 종류 · 능력치 · 레벨 · 진화 (순수 로직)

   [구성] 사용자 확정 수량에 맞춘다.
     상시(일반~에픽)  36종   — 일반 16 · 레어 12 · 에픽 8
     상시 레전드      12종
     한정 레전드      52종
     ─────────────────────────
     합계            100종

   [능력치] 사용자 확정 범위를 정확히 지키도록 설계했다.
     HP 500~5000 · ATK/MATK 30~500 · DEF/MDEF 20~300 · AGI 20~300
     최소값 = 일반 등급 Lv.1, 최대값 = 레전드 Lv.100 이 되도록
     기본값과 성장률을 맞췄고, 마지막에 범위로 한 번 더 조인다.
   ================================================================== */
import { ELEMENTS, ELEMENT_IDS } from './elements.js'
import { ABSOLUTE_MAX_LEVEL } from './breakthrough.js'

/* ---------------- 등급 ---------------- */
export const RARITIES = [
  { id: 'common', name: '일반', star: 3, color: '#94a3b8', glow: 'rgba(148,163,184,.45)' },
  { id: 'rare', name: '레어', star: 4, color: '#38bdf8', glow: 'rgba(56,189,248,.5)' },
  { id: 'epic', name: '에픽', star: 5, color: '#c084fc', glow: 'rgba(192,132,252,.55)' },
  { id: 'legend', name: '레전드', star: 6, color: '#fbbf24', glow: 'rgba(251,191,36,.65)' },
]
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map((r) => [r.id, r]))

/* ---------------- 능력치 기준값 (Lv.1) ----------------
   일반 Lv.1이 사용자 지정 최소값(HP 500 · ATK 30 · DEF 20 · AGI 20) 근처,
   레전드 Lv.100이 최대값(5000 / 500 / 300 / 300) 근처가 되도록 잡았다. */
const BASE_BY_RARITY = {
  common: { hp: 520, atk: 34, matk: 34, def: 22, mdef: 22, agi: 24 },
  rare: { hp: 700, atk: 52, matk: 52, def: 34, mdef: 34, agi: 36 },
  epic: { hp: 920, atk: 78, matk: 78, def: 50, mdef: 50, agi: 52 },
  legend: { hp: 1200, atk: 118, matk: 118, def: 70, mdef: 70, agi: 70 },
}

export const STAT_KEYS = ['hp', 'atk', 'matk', 'def', 'mdef', 'agi']
export const STAT_LABEL = { hp: 'HP', atk: '공격', matk: '마공', def: '방어', mdef: '마방', agi: '민첩' }
/* 사용자 확정 범위 — 어떤 계산도 이 밖으로 나가지 않는다 */
export const STAT_MIN = { hp: 500, atk: 30, matk: 30, def: 20, mdef: 20, agi: 20 }
/* 상한은 600레벨·6진화를 감당할 만큼 넉넉해야 한다.
   5000 으로 두었을 때는 진화한 레전드가 100레벨에서 이미 상한에 닿아,
   그 뒤로 아무리 키워도 수치가 안 움직였다. */
export const STAT_MAX = { hp: 60000, atk: 6000, matk: 6000, def: 3600, mdef: 3600, agi: 3600 }

/* 돌파로 열리는 이론상 최대 레벨. 실제 상한은 진화·돌파가 정한다. */
export const MAX_LEVEL = ABSOLUTE_MAX_LEVEL

/* 100레벨까지는 예전 곡선 그대로다 (Lv.100 에서 4.17배).
   그 위로는 완만하게 이어 붙인다 — 같은 기울기로 600까지 가면
   20배가 넘어 전투가 숫자 놀음이 된다. */
export const LEVEL_GROWTH = 0.032
export const LATE_LEVEL_GROWTH = 0.016
export const LATE_LEVEL_FROM = 100

/* ---------------- 진화 (사용자 확정) ---------------- */
export const MAX_EVOLUTION = 6
export const EVOLUTIONS = [
  { step: 1, statUp: 0.15, note: '기본 스탯 +15%, 새로운 패시브 능력 1 획득' },
  { step: 2, statUp: 0.15, note: '기본 스탯 +15%, 패시브 능력 1 추가 (총 2개)' },
  { step: 3, statUp: 0.20, note: '기본 스탯 +20%, 스킬 1개 진화' },
  { step: 4, statUp: 0.20, note: '기본 스탯 +20%, 패시브 능력 1 추가 (총 3개)' },
  { step: 5, statUp: 0.25, note: '기본 스탯 +25%, 궁극기 성능 15% 상향' },
  { step: 6, statUp: 0.30, note: '기본 스탯 +30%, 새로운 스킬 해금 + 특수 능력 부여' },
]
/* 0진화 = 1.0, 6진화 = 1 + 1.25 */
export function evolutionMul(evo) {
  let m = 1
  for (let i = 0; i < Math.min(evo, MAX_EVOLUTION); i++) m += EVOLUTIONS[i].statUp
  return m
}
export const evolutionPassives = (evo) => (evo >= 4 ? 3 : evo >= 2 ? 2 : evo >= 1 ? 1 : 0)

/* ==================================================================
   이름 생성 — 속성별 어감이 다른 이름 풀에서 조합한다
   ================================================================== */
const CORE = {
  fire: ['이그니스', '플레어', '인페르노', '엠버', '살라만드라', '볼케이노', '블레이즈', '파이라', '카르마', '아그니', '프로메', '루비아'],
  ice: ['글라시아', '프로스트', '블리자드', '크리스탈', '코키투스', '크리오스', '아이시클', '시린', '보레아', '펜리르', '스노우', '헤이즈'],
  earth: ['가이아', '테라', '그라니트', '골렘하', '오브시디', '몬타나', '바위갑', '이그드라', '루타일', '아다만', '크래그', '스톤하'],
  thunder: ['볼테아', '레이든', '썬더러', '스파크', '플라즈마', '토르가', '아크라이', '엘렉트라', '자우르', '스톰볼트', '기가', '라이트닝'],
  mystic: ['아르카나', '루멘시아', '오라클', '에테르', '셀레스타', '미스티아', '루나리아', '아스트라', '세라피', '엘프리', '위스퍼', '리버리'],
  wind: ['제피르', '실피드', '가스트', '토네이드', '아에라', '윈드러너', '스카이', '템페스타', '브리즈', '팔콘하', '사이클', '노투스'],
  dark: ['녹티스', '아비스', '섀도우', '헤카테', '보이드', '네뷸라', '이클립스', '움브라', '나이트메어', '카오스', '레퀴엠', '오블리'],
  light: ['루시아', '아우로라', '솔라리스', '라디안', '세인트', '헬리오스', '프리즘', '글로리아', '단델리', '유클리', '베리타스', '엘리시아'],
}
const TITLE = {
  common: ['어린', '들판의', '떠도는', '작은', '수줍은', '갓 깨어난', '연습생', '잿빛'],
  rare: ['날카로운', '숲의', '단단한', '푸른', '사나운', '고요한', '붉은', '은빛'],
  epic: ['폭풍의', '심연의', '고대의', '왕가의', '별을 삼킨', '불멸의', '천공의', '봉인된'],
  legend: ['창세의', '종언의', '세계를 잇는', '태초의', '신좌의', '멸망을 부르는', '영원의', '만물의'],
}
const EPITHET = {
  common: ['새끼용', '어린 날개', '견습'],
  rare: ['수호자', '사냥꾼', '파수꾼'],
  epic: ['군주', '재앙', '패왕'],
  legend: ['원초룡', '신룡', '천제룡'],
}

/* 결정적 의사난수 — id만 같으면 언제 만들어도 같은 드래곤이 나온다 */
function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const pickBy = (arr, seed) => arr[seed % arr.length]

/* ---------------- 도감 만들기 ---------------- */
function makeDragon(id, rarity, elementId, kind) {
  const seed = hash32(id)
  const core = pickBy(CORE[elementId], seed)
  const title = pickBy(TITLE[rarity], seed >>> 3)
  const epithet = pickBy(EPITHET[rarity], seed >>> 7)
  const el = ELEMENTS.find((e) => e.id === elementId)

  /* 기본 스탯 = 등급 기준값 × 속성 성향 × 개체 편차(±6%) */
  const base = {}
  STAT_KEYS.forEach((k, i) => {
    const varia = 0.94 + (((seed >>> (i * 3)) % 13) / 100)   // 0.94 ~ 1.06
    base[k] = Math.round(BASE_BY_RARITY[rarity][k] * el.bias[k] * varia)
  })

  return {
    id,
    name: `${title} ${core}`,
    epithet,                       // 카드 뒤에 붙는 칭호
    rarity,
    element: elementId,
    kind,                          // 'standard' | 'standardLegend' | 'limitedLegend'
    base,
  }
}

function buildRoster() {
  const list = []
  /* 상시 일반~에픽 36종 — 속성이 고르게 퍼지도록 순번으로 돌린다 */
  const spread = [['common', 16], ['rare', 12], ['epic', 8]]
  let n = 0
  spread.forEach(([rarity, count]) => {
    for (let i = 0; i < count; i++) {
      const el = ELEMENT_IDS[n % ELEMENT_IDS.length]
      list.push(makeDragon(`${rarity}_${i}`, rarity, el, 'standard'))
      n++
    }
  })
  /* 상시 레전드 12종 — 8속성을 한 바퀴 돌고 4종 더 */
  for (let i = 0; i < 12; i++) {
    list.push(makeDragon(`slegend_${i}`, 'legend', ELEMENT_IDS[i % ELEMENT_IDS.length], 'standardLegend'))
  }
  /* 한정 레전드 52종 */
  for (let i = 0; i < 52; i++) {
    list.push(makeDragon(`llegend_${i}`, 'legend', ELEMENT_IDS[(i * 3 + 1) % ELEMENT_IDS.length], 'limitedLegend'))
  }
  return list
}

export const DRAGONS = buildRoster()
export const DRAGON_BY_ID = Object.fromEntries(DRAGONS.map((d) => [d.id, d]))

export const standardPool = () => DRAGONS.filter((d) => d.kind === 'standard')
export const standardLegends = () => DRAGONS.filter((d) => d.kind === 'standardLegend')
export const limitedLegends = () => DRAGONS.filter((d) => d.kind === 'limitedLegend')
export const poolOfRarity = (rarity) => DRAGONS.filter((d) => d.kind === 'standard' && d.rarity === rarity)

/* ==================================================================
   실제 능력치 — 레벨과 진화를 반영한 값
   ================================================================== */
export function levelMul(level) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, level))
  if (lv <= LATE_LEVEL_FROM) return 1 + (lv - 1) * LEVEL_GROWTH
  const atCut = 1 + (LATE_LEVEL_FROM - 1) * LEVEL_GROWTH
  return atCut + (lv - LATE_LEVEL_FROM) * LATE_LEVEL_GROWTH
}

export function statsOf(dragon, level = 1, evo = 0) {
  const lm = levelMul(level)
  const em = evolutionMul(evo)
  const out = {}
  for (const k of STAT_KEYS) {
    const raw = Math.round(dragon.base[k] * lm * em)
    out[k] = Math.max(STAT_MIN[k], Math.min(STAT_MAX[k], raw))
  }
  return out
}

/* ---------------- 성장 (경험치) ----------------
   100레벨까지는 예전 곡선 그대로. 그 위는 지수를 크게 낮춘다.
   1.52 를 600까지 끌고 가면 한 레벨에 100만 경험치가 필요해져서,
   구슬을 아무리 부어도 눈금이 안 움직인다. */
const EXP_AT_CUT = Math.round(58 * Math.pow(LATE_LEVEL_FROM, 1.52))
export function expToNext(level) {
  const lv = Math.max(1, level)
  if (lv < LATE_LEVEL_FROM) return Math.round(58 * Math.pow(lv, 1.52))
  return Math.round(EXP_AT_CUT * Math.pow(lv / LATE_LEVEL_FROM, 0.25))
}

/* 지금 상태에서 만렙까지 남은 총 경험치.
   구슬을 "만렙까지 알아서 먹이기" 할 때 얼마나 필요한지 계산한다. */
export function expToMax(level, exp, cap = MAX_LEVEL) {
  const top = Math.min(cap, MAX_LEVEL)
  if (level >= top) return 0
  let need = -exp
  for (let lv = level; lv < top; lv++) need += expToNext(lv)
  return Math.max(0, need)
}

/* 경험치를 넣고 레벨업을 처리한다. { level, exp, gained } 를 돌려준다. */
/* cap 은 돌파·진화가 정한 지금의 상한이다. 거기 닿으면 경험치는
   더 쌓이지 않는다 — 벽에 막힌 채 경험치만 계속 먹으면
   돌파하는 순간 몇 레벨이 한꺼번에 올라 이상하다. */
export function gainExp(level, exp, amount, cap = MAX_LEVEL) {
  const top = Math.min(cap, MAX_LEVEL)
  let lv = level, ex = exp + amount, gained = 0
  while (lv < top && ex >= expToNext(lv)) {
    ex -= expToNext(lv)
    lv += 1
    gained += 1
  }
  if (lv >= top) { lv = top; ex = 0 }
  return { level: lv, exp: ex, gained }
}

/* 진화에 필요한 같은 드래곤 수 (기획서 4.2 — 1진화 1개 … 6진화 6개) */
export const evoCost = (nextStep) => nextStep
export const evoGoldCost = (nextStep) => 2000 * nextStep * nextStep

/* 전투력 — 카드 정렬·비교용 한 줄 요약 */
export function power(dragon, level = 1, evo = 0) {
  const s = statsOf(dragon, level, evo)
  return Math.round(s.hp * 0.25 + (s.atk + s.matk) * 1.6 + (s.def + s.mdef) * 1.2 + s.agi * 1.4)
}
