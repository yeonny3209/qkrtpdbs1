/* ==================================================================
   경험 구슬 — 레벨업 재료

   전투로 드래곤이 직접 경험치를 먹는 대신, 전투는 구슬을 떨구고
   플레이어가 원하는 드래곤에게 직접 먹인다.

   이렇게 하면 편성에 넣지 않은 드래곤도 키울 수 있고, "이번엔 누구를
   키울까"라는 선택이 생긴다. 대신 전투에 나갔다고 저절로 크지는 않는다.
   ================================================================== */

/* 가장 작은 구슬은 초반 스테이지 보상(1-1 은 34)보다 작아야 한다.
   이보다 크면 초반 내내 구슬이 하나도 안 떨어진다. */
export const EXP_ORBS = [
  { id: 'tiny', name: '작은 경험 구슬', icon: '🔹', exp: 100, color: '#7dd3fc' },
  { id: 'small', name: '경험 구슬', icon: '🔷', exp: 1200, color: '#38bdf8' },
  { id: 'big', name: '큰 경험 구슬', icon: '💠', exp: 8000, color: '#818cf8' },
  { id: 'huge', name: '찬란한 경험 구슬', icon: '🌟', exp: 45000, color: '#fbbf24' },
  /* 600레벨까지 4,500만 경험치가 든다. 찬란한 구슬만으로는 천 개를
     넘게 먹여야 해서 손이 남아나지 않는다. 후반용 큰 단위를 둔다. */
  { id: 'radiant', name: '태고의 경험 구슬', icon: '☀️', exp: 300000, color: '#fb923c' },
  { id: 'eternal', name: '영겁의 경험 구슬', icon: '🌌', exp: 2000000, color: '#e879f9' },
]
export const ORB_BY_ID = Object.fromEntries(EXP_ORBS.map((o) => [o.id, o]))
export const ORB_IDS = EXP_ORBS.map((o) => o.id)

export const freshOrbs = () => Object.fromEntries(ORB_IDS.map((id) => [id, 0]))

/* 보상 경험치를 구슬로 바꾼다 — 큰 것부터 채우고 남은 건 작은 것으로.
   그냥 작은 구슬만 잔뜩 주면 후반에 수백 번 눌러야 해서 손이 아프다. */
export function expToOrbs(exp) {
  const out = freshOrbs()
  let left = Math.max(0, Math.round(exp))
  for (let i = EXP_ORBS.length - 1; i >= 0; i--) {
    const o = EXP_ORBS[i]
    /* 가장 작은 구슬이 남은 걸 전부 흡수한다.
       경험치가 조금이라도 있으면 반드시 하나는 준다 — 반올림에 맡기면
       초반 스테이지(1-1 은 34)가 0개로 떨어져 보상이 사라진다. */
    const n = i === 0
      ? Math.max(left > 0 ? 1 : 0, Math.round(left / o.exp))
      : Math.floor(left / o.exp)
    if (n > 0) { out[o.id] += n; left -= n * o.exp }
  }
  return out
}

export function addOrbs(bag, add) {
  const out = { ...freshOrbs(), ...bag }
  for (const id of ORB_IDS) out[id] += add[id] || 0
  return out
}

export const totalOrbExp = (bag) =>
  ORB_IDS.reduce((a, id) => a + (bag?.[id] || 0) * ORB_BY_ID[id].exp, 0)

export const orbCount = (bag) => ORB_IDS.reduce((a, id) => a + (bag?.[id] || 0), 0)

/* 구슬 n개를 쓸 수 있는가 */
export const canSpend = (bag, orbId, n = 1) => (bag?.[orbId] || 0) >= n

export function spendOrbs(bag, orbId, n = 1) {
  const out = { ...freshOrbs(), ...bag }
  out[orbId] = Math.max(0, out[orbId] - n)
  return out
}

/* 필요한 경험치에 맞춰 어떤 구슬을 몇 개 쓸지 계산한다.

   큰 구슬부터 넘치지 않는 만큼 담고, 마지막에 모자란 몫을 채울
   가장 작은 구슬 하나를 더 얹는다. 딱 맞아떨어지길 기다리면
   영영 만렙이 안 되므로, 마지막 한 개는 넘치는 걸 감수한다.

   needExp 가 0 이하이거나 구슬이 없으면 빈 계획을 돌려준다. */
export function planFeed(bag, needExp) {
  const plan = freshOrbs()
  let left = Math.max(0, Math.round(needExp))
  let total = 0
  if (left <= 0) return { plan, total, count: 0 }

  const have = { ...freshOrbs(), ...bag }
  /* 큰 것부터 — 넘치지 않는 선까지만 */
  for (let i = EXP_ORBS.length - 1; i >= 0; i--) {
    const o = EXP_ORBS[i]
    if (left <= 0) break
    const want = Math.floor(left / o.exp)
    const n = Math.min(want, have[o.id])
    if (n > 0) { plan[o.id] += n; have[o.id] -= n; left -= n * o.exp; total += n * o.exp }
  }
  /* 아직 모자라면, 채울 수 있는 가장 작은 구슬 하나를 더 얹는다 */
  if (left > 0) {
    const fill = EXP_ORBS.find((o) => have[o.id] > 0 && o.exp >= left)
      || [...EXP_ORBS].reverse().find((o) => have[o.id] > 0)
    if (fill) { plan[fill.id] += 1; total += fill.exp; left -= fill.exp }
  }
  const count = ORB_IDS.reduce((a, id) => a + plan[id], 0)
  return { plan, total, count }
}

/* 계획대로 가방에서 뺀다 */
export function spendPlan(bag, plan) {
  const out = { ...freshOrbs(), ...bag }
  for (const id of ORB_IDS) out[id] = Math.max(0, out[id] - (plan[id] || 0))
  return out
}
