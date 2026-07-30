/* ==================================================================
   아이템 등급 · 드랍 확률 · 거래가 (사용자 확정 수치)

   등급별 드랍 확률 — 한 번의 사냥에서 그 등급이 나올 확률
     일반 1%  · 레어 0.1%  · 에픽 0.05%
     유니크 0.01%  · 레전더리 0.0005%  · 신화 0.0001%
   확률이 겹치지 않게 "높은 등급부터" 판정한다.

   획득 경로 제한
     룬        — 사냥에서 0.001%, 상점 구매 불가, 룬 퀘스트로 획득 가능
     아티팩트  — 40레벨 이상 던전에서 0.001%, 상점·퀘스트로는 획득 불가

   순수 데이터·로직이라 Node에서 그대로 테스트할 수 있다.
   ================================================================== */

export const GRADES = [
  { key: 0, name: '일반',     color: '#cbd5e1', mult: 1,   rate: 0.01,     price: [150, 300] },
  { key: 1, name: '레어',     color: '#60a5fa', mult: 2.2, rate: 0.001,    price: [1000, 2000] },
  { key: 2, name: '에픽',     color: '#a78bfa', mult: 3.6, rate: 0.0005,   price: [5000, 6000] },
  { key: 3, name: '유니크',   color: '#fbbf24', mult: 6.0, rate: 0.0001,   price: [30000, 40000] },
  { key: 4, name: '레전더리', color: '#f472b6', mult: 11,  rate: 0.000005, price: [150000, 300000] },
  { key: 5, name: '신화',     color: '#ef4444', mult: 20,  rate: 0.000001, price: [1000000, 10000000] },
]
export const GRADE_COUNT = GRADES.length
export const MAX_GRADE = GRADE_COUNT - 1

export const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v | 0))
export const gradeOf = (g) => GRADES[clampInt(g, 0, MAX_GRADE)]

/* 룬 · 아티팩트 전용 확률 (사용자 확정: 둘 다 0.001%) */
export const RUNE_DROP = 0.00001
export const ARTIFACT_DROP = 0.00001
export const ARTIFACT_MIN_LEVEL = 40      // 아티팩트는 40레벨 이상 던전에서만

/* 한 번의 사냥에서 장비가 떨어지는가 — 떨어졌다면 그 등급을 돌려준다.
   luck은 행운 보너스(1 = 기본). 아무것도 안 나오면 null. */
export function rollDrop(luck = 1) {
  const r = Math.random()
  let acc = 0
  /* 희귀한 것부터 검사해 확률이 서로를 잡아먹지 않게 한다 */
  for (let g = MAX_GRADE; g >= 0; g--) {
    acc += GRADES[g].rate * luck
    if (r < acc) return g
  }
  return null
}

/* 등급별 거래가 — 같은 등급 안에서도 값이 조금씩 다르다 */
export function itemPrice(grade, kind) {
  const g = gradeOf(grade)
  const [lo, hi] = g.price
  const base = lo + Math.random() * (hi - lo)
  /* 아티팩트는 구할 길이 거의 없어 값이 더 높다 */
  const mul = kind === 'artifact' ? 2.5 : kind === 'rune' ? 1.6 : 1
  return Math.round(base * mul)
}

/* 판매가 — 거래가의 일부만 받는다 (상점 마진) */
export function sellPrice(item) {
  const g = gradeOf(item.grade)
  const mid = (g.price[0] + g.price[1]) / 2
  const mul = item.kind === 'artifact' ? 2.5 : item.kind === 'rune' ? 1.6 : 1
  return Math.max(1, Math.round(mid * mul * 0.35))
}

/* 상점에서 팔 수 있는 종류인가 (룬·아티팩트는 불가) */
export const shopSellable = (kind) => kind !== 'rune' && kind !== 'artifact'

/* 퀘스트 보상으로 줄 수 있는 종류인가 (아티팩트는 불가) */
export const questRewardable = (kind) => kind !== 'artifact'

/* 아티팩트를 이 던전에서 얻을 수 있는가 */
export const artifactAllowed = (dungeonReqLv) => (dungeonReqLv || 0) >= ARTIFACT_MIN_LEVEL
