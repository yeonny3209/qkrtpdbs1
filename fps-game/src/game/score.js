/* ==================================================================
   점수

   콤보는 "빠르게 연달아 잡으면 이득"이라는 한 문장을 규칙으로 옮긴
   것이다. 안전하게 한 마리씩 빼는 것보다 붙어서 몰아치는 쪽이
   점수가 높아야, 겁먹고 구석에 서 있는 플레이가 최선이 되지 않는다.
   ================================================================== */

export const COMBO_WINDOW = 3.0      // 이 시간 안에 다음 처치가 없으면 끊긴다
export const MAX_COMBO_MULT = 4.0
export const HEADSHOT_BONUS = 1.5

export function initialScore() {
  return { points: 0, kills: 0, headshots: 0, combo: 0, comboT: 0, best: 0 }
}

/* 콤보 배율 — 2연속부터 붙고 천천히 오른다.
   처음부터 크게 붙으면 운 좋게 두 마리 겹친 순간이 실력을 덮는다. */
export function comboMultiplier(combo) {
  if (combo <= 1) return 1
  return Math.min(MAX_COMBO_MULT, 1 + (combo - 1) * 0.25)
}

/* 처치 기록. 새 상태를 돌려주고 원본은 안 건드린다. */
export function recordKill(state, enemyType, isHeadshot, baseScore) {
  const combo = state.comboT > 0 ? state.combo + 1 : 1
  const mult = comboMultiplier(combo)
  const bonus = isHeadshot ? HEADSHOT_BONUS : 1
  const gained = Math.round(baseScore * mult * bonus)

  return {
    ...state,
    points: state.points + gained,
    kills: state.kills + 1,
    headshots: state.headshots + (isHeadshot ? 1 : 0),
    combo,
    comboT: COMBO_WINDOW,
    lastGain: gained,
  }
}

/* 웨이브를 넘길 때마다 보너스. 오래 버틴 것 자체에 값을 매긴다. */
export function recordWaveClear(state, wave) {
  return { ...state, points: state.points + wave * 100 }
}

export function tickScore(state, dt) {
  if (state.comboT <= 0) return state
  const t = state.comboT - dt
  return t <= 0 ? { ...state, comboT: 0, combo: 0 } : { ...state, comboT: t }
}

/* ------------------------------------------------------------------
   최고 기록 — localStorage 는 있을 수도, 없을 수도 있다.

   Node 테스트에는 없고, 브라우저라도 사생활 보호 모드에서 접근이
   막히면 예외가 난다. 기록을 못 남기는 건 아쉬운 일이지 게임이
   멈출 일은 아니므로 전부 삼킨다.
   ------------------------------------------------------------------ */
const KEY = 'bunker-break:best'

export function loadBest() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return { points: 0, wave: 0 }
    const v = JSON.parse(raw)
    return {
      points: Number(v.points) || 0,
      wave: Number(v.wave) || 0,
    }
  } catch {
    return { points: 0, wave: 0 }
  }
}

export function saveBest(points, wave) {
  const prev = loadBest()
  const next = {
    points: Math.max(prev.points, points),
    wave: Math.max(prev.wave, wave),
  }
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 저장 실패는 조용히 넘긴다 */
  }
  return next
}

/* 이번 판이 최고 기록을 넘었는가 — 게임오버 화면에서 축하할지 결정 */
export function isNewBest(points, wave) {
  const prev = loadBest()
  return points > prev.points || wave > prev.wave
}
