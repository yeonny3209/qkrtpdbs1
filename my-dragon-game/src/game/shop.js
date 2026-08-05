/* ==================================================================
   상점 — 보석 패키지 · 월정액 (기획서 6장 · 7장)

   ⚠ 실제 결제는 붙어 있지 않다.
   여기서 처리하는 "구매"는 전부 게임 안에서만 일어나는 모의 거래다.
   실제 돈을 받으려면 결제대행사(PG) 연동과 서버 검증이 반드시 필요하고,
   그건 클라이언트 코드로 해서는 안 되는 일이다 (금액·지급을 조작할 수 있다).
   자세한 건 README 참고.

   [보석]   1 피스 = 1,000원, 10 피스 = 100 보석
   [월정액] 4 피스(40,000원) / 30일
            구매 즉시 300 보석 + 매일 90 보석 × 30일 = 총 3,000 보석
            경험치 +10%, 일일 던전 입장 +2, 프리미엄 상점 조기 접근
            중복 구매 불가 (1개만 유지)
   ================================================================== */

export const PIECE_PRICE = 1000                 // 1 피스 = 1,000원

export const GEM_PACKAGES = [
  { id: 'p5', pieces: 5, gems: 50, tag: null },
  { id: 'p10', pieces: 10, gems: 100, tag: null },
  { id: 'p50', pieces: 50, gems: 500, tag: '가장 인기' },
]
export const packagePrice = (pkg) => pkg.pieces * PIECE_PRICE

/* 기획서에는 "4 피스 (40,000원)"로 적혀 있지만 1 피스 = 1,000원이므로
   4 피스 = 4,000원이 맞다 (금액 쪽이 오타). 피스 수를 기준으로 계산한다. */
export const SUBSCRIPTION = {
  id: 'monthly',
  pieces: 4,
  days: 30,
  initialGems: 300,
  dailyGems: 90,
  expBonus: 0.10,          // 경험치 +10%
  dungeonBonus: 2,         // 일일 던전 입장 +2
}
export const subscriptionPrice = () => SUBSCRIPTION.pieces * PIECE_PRICE
/* 300 + 90×30 = 3,000 — 기획서에 적힌 총량과 일치해야 한다 */
export const subscriptionTotalGems = () =>
  SUBSCRIPTION.initialGems + SUBSCRIPTION.dailyGems * SUBSCRIPTION.days

/* ---------------- 날짜 ----------------
   "하루 한 번"을 시간(ms) 차이로 재면 자정을 넘겨도 못 받는 일이 생긴다.
   현지 기준 날짜 번호로 바꿔서 비교한다. */
export function dayIndex(now = Date.now()) {
  const d = new Date(now)
  return Math.floor((now - d.getTimezoneOffset() * 60000) / 86400000)
}

/* ---------------- 월정액 상태 ----------------
   { startDay, claimedDays: [] }  — 지급받은 날짜 번호 목록 */
export const noSubscription = () => null

export function startSubscription(today = dayIndex()) {
  return { startDay: today, claimedDays: [] }
}

/* 아직 유효한가 (구매일 포함 30일) */
export function subActive(sub, today = dayIndex()) {
  if (!sub) return false
  return today >= sub.startDay && today < sub.startDay + SUBSCRIPTION.days
}
export function subDaysLeft(sub, today = dayIndex()) {
  if (!subActive(sub, today)) return 0
  return sub.startDay + SUBSCRIPTION.days - today
}

/* 오늘 일일 보석을 받을 수 있는가 */
export function canClaimDaily(sub, today = dayIndex()) {
  if (!subActive(sub, today)) return false
  return !sub.claimedDays.includes(today)
}

/* 일일 보석 수령. { sub, gems } 를 돌려준다 (못 받으면 gems 0) */
export function claimDaily(sub, today = dayIndex()) {
  if (!canClaimDaily(sub, today)) return { sub, gems: 0 }
  return {
    sub: { ...sub, claimedDays: [...sub.claimedDays, today] },
    gems: SUBSCRIPTION.dailyGems,
  }
}

/* 이미 월정액이 있으면 다시 못 산다 (기획서: 중복 구매 불가) */
export const canBuySubscription = (sub, today = dayIndex()) => !subActive(sub, today)

/* 월정액 보유자가 받는 경험치 배율 */
export const expMultiplier = (sub, today = dayIndex()) =>
  (subActive(sub, today) ? 1 + SUBSCRIPTION.expBonus : 1)

/* 지금까지 이 월정액으로 받은 보석 총량 (UI 표시용) */
export const subGemsReceived = (sub) =>
  (sub ? SUBSCRIPTION.initialGems + sub.claimedDays.length * SUBSCRIPTION.dailyGems : 0)

export const won = (n) => n.toLocaleString('ko-KR') + '원'
