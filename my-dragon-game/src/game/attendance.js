/* ==================================================================
   일일 출석 보상

   하루에 한 번, 28일 주기로 받는다. 7·14·21·28일째가 큰 보상이다.

   [빠뜨려도 밀리지 않는다]
   출석 칸은 "받은 횟수"로 나아간다. 날짜로 칸을 정하면 하루 걸렀을 때
   그 칸의 보상을 영영 못 받는다. 큰 보상만 골라 받는 걸 막으려고
   순서대로만 열리게 해 두었으니, 밀린다고 손해 볼 이유가 없다.

   [하루 한 번의 기준]
   시간(ms) 차이로 재면 자정을 넘겨도 못 받는 일이 생긴다.
   shop.js 의 dayIndex — 현지 날짜 번호 — 로 비교한다.
   ================================================================== */
import { dayIndex } from './shop.js'
import { subActive } from './shop.js'

export const CYCLE = 28

/* 보상 한 칸의 생김새
     gems / gold / stones / drinks   숫자
     orbs                            { 구슬id: 개수 }
   big 이 붙은 칸은 화면에서 크게 보여준다. */
const DAY = (gems, extra = {}, big = false) => ({ gems, ...extra, big })

export const REWARDS = [
  /* 1주차 — 매일 오는 습관을 들이는 구간 */
  DAY(100, { gold: 3000 }),
  DAY(120, { orbs: { small: 3 } }),
  DAY(140, { gold: 6000 }),
  DAY(160, { stones: 4 }),
  DAY(180, { orbs: { small: 6 } }),
  DAY(200, { gold: 12000 }),
  DAY(600, { drinks: 1, orbs: { big: 2 } }, true),

  /* 2주차 */
  DAY(220, { gold: 15000 }),
  DAY(240, { orbs: { big: 1 } }),
  DAY(260, { stones: 8 }),
  DAY(280, { gold: 20000 }),
  DAY(300, { orbs: { big: 2 } }),
  DAY(320, { drinks: 1 }),
  DAY(1000, { drinks: 2, orbs: { huge: 1 } }, true),

  /* 3주차 */
  DAY(340, { gold: 26000 }),
  DAY(360, { orbs: { big: 3 } }),
  DAY(380, { stones: 14 }),
  DAY(400, { gold: 34000 }),
  DAY(420, { orbs: { huge: 1 } }),
  DAY(440, { drinks: 2 }),
  DAY(1600, { drinks: 3, orbs: { huge: 2 }, stones: 25 }, true),

  /* 4주차 — 마지막 칸이 가장 크다 */
  DAY(460, { gold: 42000 }),
  DAY(480, { orbs: { huge: 1 } }),
  DAY(500, { stones: 20 }),
  DAY(520, { orbs: { huge: 2 } }),
  DAY(540, { drinks: 3 }),
  DAY(560, { gold: 60000 }),
  DAY(3000, { drinks: 6, orbs: { radiant: 1 }, stones: 50 }, true),
]

export const freshAttendance = () => ({ claimed: 0, lastDay: -1, totalDays: 0 })

/* 지금 열려 있는 칸 (0-based). 28칸을 다 받으면 처음으로 돌아간다. */
export const slotOf = (att) => (att?.claimed ?? 0) % CYCLE
export const rewardAt = (slot) => REWARDS[((slot % CYCLE) + CYCLE) % CYCLE]
export const todayReward = (att) => rewardAt(slotOf(att))

/* 오늘 받을 수 있는가 */
export function canClaim(att, now = Date.now()) {
  if (!att) return true
  return att.lastDay !== dayIndex(now)
}

/* 받는다. { attendance, reward } — 못 받으면 reward 가 null */
export function claim(att, now = Date.now()) {
  const cur = att || freshAttendance()
  if (!canClaim(cur, now)) return { attendance: cur, reward: null }
  const reward = todayReward(cur)
  return {
    attendance: {
      claimed: (cur.claimed ?? 0) + 1,
      lastDay: dayIndex(now),
      totalDays: (cur.totalDays ?? 0) + 1,
    },
    reward,
  }
}

/* 월정액이면 보석을 1.5배로 준다 — 월정액의 값어치를 붙여 준다 */
export const ATTEND_SUB_BONUS = 0.5
export function scaledReward(reward, sub) {
  if (!reward) return null
  if (!subActive(sub)) return reward
  return { ...reward, gems: Math.round(reward.gems * (1 + ATTEND_SUB_BONUS)) }
}

/* 화면 표시용 — 28칸의 상태 */
export function calendar(att, now = Date.now()) {
  const slot = slotOf(att)
  const claimable = canClaim(att, now)
  return REWARDS.map((r, i) => ({
    day: i + 1,
    reward: r,
    done: i < slot,
    today: i === slot,
    open: i === slot && claimable,
  }))
}

/* 이번 주기에서 다음 큰 보상까지 며칠 */
export function daysToBig(att) {
  const slot = slotOf(att)
  for (let i = slot; i < CYCLE; i++) if (REWARDS[i].big) return i - slot
  return null
}
