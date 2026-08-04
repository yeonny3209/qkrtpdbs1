/* ==================================================================
   소환(가챠) — 순수 로직. Node에서 그대로 확률 검증이 가능하다.

   [상시 소환]  일반 80%   · 레어 15% · 에픽 4.5% · 상시 레전드 0.5%
   [한정 소환]  일반 80.5% · 레어 15% · 에픽 4%   · 레전드 0.5%
                 └ 레전드 0.5% 를 50:50 으로 갈라
                   한정 레전드 0.25% · 상시 레전드 0.25% (사용자 확정)
   [천장]       한정 소환 80회까지 레전드가 없으면 한정 레전드 확정
   [연속 방지]  상시 레전드가 나온 다음 레전드는 무조건 한정 레전드
   [초기화]     레전드(한정·상시 무관)를 얻으면 천장 스택이 0으로

   연속 방지·천장이 겹치므로 "실제로 손에 들어오는" 한정 비중은
   기본 50% 보다 높아진다 (이론상 2/3 에 수렴). 이는 의도된 결과다.
   ================================================================== */
import { standardLegends, limitedLegends, poolOfRarity, DRAGON_BY_ID } from './dragons.js'

export const PULL_COST = 300
export const TEN_PULL_COST = 3000
export const TEN_PULL_SIZE = 10
export const PITY = 80                  // 한정 소환 천장
export const LIMITED_WIN_RATE = 0.5     // 레전드 0.5% 안에서 한정:상시 = 0.25% : 0.25%

/* 등급 확률 — 소수점 오차를 피하려고 정수(만분율)로 둔다 */
export const BANNERS = {
  standard: {
    id: 'standard', name: '상시 소환', sub: '언제나 열려 있는 기본 소환진',
    rates: { common: 8000, rare: 1500, epic: 450, legend: 50 },   // 80 / 15 / 4.5 / 0.5 %
    pity: 0,                                                       // 상시에는 천장이 없다
  },
  limited: {
    id: 'limited', name: '한정 소환', sub: '픽업 드래곤이 걸린 소환진',
    /* 레전드가 6% → 0.5% 로 내려가면서 남은 5.5% 는 일반이 흡수한다.
       레어·에픽은 기획서 숫자(15% / 4%)를 그대로 둔다. */
    rates: { common: 8050, rare: 1500, epic: 400, legend: 50 },     // 80.5 / 15 / 4 / 0.5 %
    pity: PITY,
  },
}
const TOTAL = 10000

export const createGachaState = () => ({
  pity: 0,                 // 한정 소환에서 레전드 없이 넘어간 횟수
  lastLegendStandard: false, // 직전 레전드가 상시였나 (다음은 한정 확정)
  totalPulls: 0,
})

/* 등급 뽑기 — rng()는 0 이상 1 미만 */
function rollRarity(rates, rng) {
  let roll = Math.floor(rng() * TOTAL)
  for (const key of ['common', 'rare', 'epic', 'legend']) {
    roll -= rates[key]
    if (roll < 0) return key
  }
  return 'common'
}

const pickFrom = (arr, rng) => arr[Math.floor(rng() * arr.length)]

/* ------------------------------------------------------------------
   한 번 뽑기. state를 직접 고치고 결과를 돌려준다.
   featuredId: 한정 소환의 픽업 드래곤 id
   ------------------------------------------------------------------ */
export function pullOnce(state, bannerId, featuredId, rng = Math.random) {
  const banner = BANNERS[bannerId] || BANNERS.standard
  state.totalPulls += 1

  /* ---- 상시 소환: 천장도 픽업도 없다 ---- */
  if (banner.id === 'standard') {
    const rarity = rollRarity(banner.rates, rng)
    const dragon = rarity === 'legend'
      ? pickFrom(standardLegends(), rng)
      : pickFrom(poolOfRarity(rarity), rng)
    return { dragon, rarity, isLimited: false, pity: state.pity, viaPity: false, wonFifty: false }
  }

  /* ---- 한정 소환 ---- */
  state.pity += 1
  const viaPity = state.pity >= banner.pity
  const rarity = viaPity ? 'legend' : rollRarity(banner.rates, rng)

  if (rarity !== 'legend') {
    const dragon = pickFrom(poolOfRarity(rarity), rng)
    return { dragon, rarity, isLimited: false, pity: state.pity, viaPity: false, wonFifty: false }
  }

  /* 레전드 확정 — 한정이냐 상시냐를 가른다.
     천장으로 왔거나 직전이 상시였다면 무조건 한정이다. */
  const guaranteed = viaPity || state.lastLegendStandard
  const wonFifty = guaranteed ? true : rng() < LIMITED_WIN_RATE

  state.pity = 0                       // 레전드를 얻으면 어느 쪽이든 천장 초기화
  state.lastLegendStandard = !wonFifty  // 상시였다면 다음 레전드는 한정 확정

  const dragon = wonFifty
    ? (DRAGON_BY_ID[featuredId] || pickFrom(limitedLegends(), rng))
    : pickFrom(standardLegends(), rng)

  return { dragon, rarity: 'legend', isLimited: wonFifty, pity: 0, viaPity, wonFifty }
}

/* 10연차 — 각 뽑기가 천장 스택을 그대로 이어받는다 */
export function pullMany(state, bannerId, featuredId, count = TEN_PULL_SIZE, rng = Math.random) {
  return Array.from({ length: count }, () => pullOnce(state, bannerId, featuredId, rng))
}

/* 결과 묶음에서 가장 높은 등급 — 컷씬 연출 강도를 정한다 */
export function bestOf(results) {
  const order = { common: 0, rare: 1, epic: 2, legend: 3 }
  return results.reduce((a, b) => (order[b.rarity] > order[a.rarity] ? b : a), results[0])
}

export const costOf = (count) => (count >= TEN_PULL_SIZE ? TEN_PULL_COST : PULL_COST * count)
