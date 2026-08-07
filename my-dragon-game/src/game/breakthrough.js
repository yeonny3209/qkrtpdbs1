/* ==================================================================
   돌파 — 레벨 상한을 20씩 밀어 올린다

   경험치만 부으면 20레벨에서 막힌다. 거기서 드래곤 드링크를 써서
   돌파해야 40까지 열리고, 또 막히고, 또 돌파한다.

     [상한]  돌파 n 번 → 20 × (n + 1) 레벨까지
     [천장]  진화 단계가 올려 주는 진짜 상한
             0진화 100 · 1진화 200 · … · 5진화 600
             (6진화는 스탯과 새 스킬을 주지만 상한은 이미 최대다)

   돌파는 상한만 여는 게 아니라 스킬 위력도 올린다. 상한만 열리면
   "귀찮은 관문"이 되고, 위력이 붙으면 "성장"이 된다. 뒤로 갈수록
   더 크게 붙도록 5회마다 추가 보너스를 준다.
   ================================================================== */

export const LEVELS_PER_BREAK = 20        // 돌파 한 번이 여는 레벨 폭
export const BASE_LEVEL_CAP = 100         // 0진화가 가진 상한
export const CAP_PER_EVOLUTION = 100      // 진화 한 단계가 올려 주는 상한
export const ABSOLUTE_MAX_LEVEL = 600     // 이론상 최대

/* 진화 단계가 허용하는 레벨 상한 */
export function evoLevelCap(evo) {
  const raw = BASE_LEVEL_CAP + Math.max(0, evo) * CAP_PER_EVOLUTION
  return Math.min(ABSOLUTE_MAX_LEVEL, raw)
}

/* 그 진화 단계에서 할 수 있는 최대 돌파 횟수 */
export const maxBreaks = (evo) => Math.floor(evoLevelCap(evo) / LEVELS_PER_BREAK) - 1

/* 지금 실제로 올릴 수 있는 레벨 상한 — 돌파와 진화 중 낮은 쪽 */
export function levelCap(evo, breaks) {
  const byBreak = LEVELS_PER_BREAK * (Math.max(0, breaks) + 1)
  return Math.min(byBreak, evoLevelCap(evo))
}

/* 지금 돌파 벽에 막혀 있는가 (레벨은 상한인데 진화 상한엔 여유가 있다) */
export function isWalled(level, evo, breaks) {
  return level >= levelCap(evo, breaks) && breaks < maxBreaks(evo)
}

/* 돌파에 드는 드래곤 드링크 — 뒤로 갈수록 많이 든다.
   n 은 "몇 번째 돌파인가" (0 이면 첫 돌파). */
export const drinkCost = (n) => 1 + Math.floor(Math.max(0, n) / 2)
export const breakGoldCost = (n) => 1500 * (Math.max(0, n) + 1)

/* 돌파할 수 있는 상태인가 */
export function canBreak(level, evo, breaks, drinks, gold) {
  if (breaks >= maxBreaks(evo)) return { ok: false, why: '진화를 더 해야 상한이 열린다' }
  if (level < levelCap(evo, breaks)) return { ok: false, why: `Lv.${levelCap(evo, breaks)} 를 먼저 찍어야 한다` }
  if ((drinks ?? 0) < drinkCost(breaks)) return { ok: false, why: '드래곤 드링크가 모자란다' }
  if ((gold ?? 0) < breakGoldCost(breaks)) return { ok: false, why: '골드가 모자란다' }
  return { ok: true, why: null }
}

/* ---------------- 스킬 위력 ----------------
   "돌파할수록 점점 더 세진다" — 증가폭 자체가 커져야 한다.
   일정하게 2% 씩 더하면 마지막 돌파나 첫 돌파나 체감이 같아서
   뒤로 갈수록 오히려 시시해진다. 제곱 항을 얹어 가속시킨다.

   29회(5진화 600레벨)까지 하면 약 2.07 배.
     0→5 구간   +0.14
     24→29 구간 +0.24   ← 뒤쪽이 더 크다 */
export const BREAK_POWER_STEP = 0.02      // 회당 기본
export const BREAK_POWER_ACCEL = 0.0004   // 제곱 항 — 뒤로 갈수록 가팔라진다
export const BREAK_POWER_BONUS = 0.03     // 5회 단위 보너스
export const BREAK_BONUS_EVERY = 5

export function skillPowerMul(breaks) {
  const n = Math.max(0, breaks)
  return 1
    + n * BREAK_POWER_STEP
    + n * n * BREAK_POWER_ACCEL
    + Math.floor(n / BREAK_BONUS_EVERY) * BREAK_POWER_BONUS
}

/* 다음 돌파로 얼마나 세지는가 (안내용) */
export const nextPowerGain = (breaks) =>
  skillPowerMul(breaks + 1) - skillPowerMul(breaks)

/* ---------------- 드래곤 드링크 ---------------- */
export const DRINK = {
  id: 'drink', name: '드래곤 드링크', icon: '🧪',
  desc: '한 모금에 한계가 밀려난다. 돌파에 쓴다.',
  color: '#f472b6',
}

/* 돌파 한 번을 적용한다. 부족하면 그대로 돌려준다.
   { ok, dragon, drinks, gold } */
export function applyBreak(dragon, drinks, gold) {
  const breaks = dragon.breaks ?? 0
  const chk = canBreak(dragon.level, dragon.evo ?? 0, breaks, drinks, gold)
  if (!chk.ok) return { ok: false, why: chk.why, dragon, drinks, gold }
  return {
    ok: true, why: null,
    dragon: { ...dragon, breaks: breaks + 1 },
    drinks: drinks - drinkCost(breaks),
    gold: gold - breakGoldCost(breaks),
  }
}

/* 600 레벨까지 가는 데 필요한 드링크 총량 — 밸런스 확인용 */
export function totalDrinksTo(evo) {
  let sum = 0
  for (let n = 0; n < maxBreaks(evo); n++) sum += drinkCost(n)
  return sum
}
