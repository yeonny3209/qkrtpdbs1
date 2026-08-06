/* ==================================================================
   공격 · 피격 모션 — 진행도(0~1)를 자세로 바꾸는 순수 계산

   렌더링과 분리해 둔 이유: 곡선이 잘못되면 "왜 어색한지"를 눈으로만
   찾아야 하는데, 숫자로 뽑아 보면 바로 안다. 테스트도 가능하다.

   좌표 약속
     push  앞으로(상대 쪽으로) 나아간 정도. 화면 X 로 쓰인다.
     lift  살짝 떠오른 정도
     tilt  기울기(Z 회전)
     scale 순간적으로 커지는 정도
   ================================================================== */

export const ATTACK_MS = 700
export const HURT_MS = 460
/* 타격이 실제로 꽂히는 시점 — 이때 숫자와 이펙트를 띄운다 */
export const IMPACT_AT = 0.46

const clamp01 = (t) => Math.max(0, Math.min(1, t))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/* 0 → 1 → 0 */
const bump = (t) => Math.sin(clamp01(t) * Math.PI)

const NEUTRAL = { push: 0, lift: 0, tilt: 0, scale: 1 }

/* 되감기 → 찌르기 → 복귀.
   되감기에서 살짝 뒤로 빼야 찌르는 순간이 빨라 보인다. */
export function attackPose(p) {
  if (p <= 0 || p >= 1) return { ...NEUTRAL }
  const WIND = 0.30, STRIKE = 0.50
  if (p < WIND) {
    const k = p / WIND
    return { push: -0.34 * easeOut(k), lift: 0.04 * k, tilt: 0.16 * k, scale: 1 - 0.035 * k }
  }
  if (p < STRIKE) {
    const k = (p - WIND) / (STRIKE - WIND)
    return {
      push: -0.34 + 1.66 * easeOut(k),
      lift: 0.20 * bump(k),
      tilt: 0.16 - 0.50 * k,
      scale: 1 + 0.09 * bump(k),
    }
  }
  const k = (p - STRIKE) / (1 - STRIKE)
  const back = 1 - easeInOut(k)
  return { push: 1.32 * back, lift: 0.05 * back, tilt: -0.34 * back, scale: 1 }
}

/* 맞은 쪽 — 뒤로 밀렸다가 부르르 떨며 제자리로 */
export function hurtPose(p) {
  if (p <= 0 || p >= 1) return { ...NEUTRAL }
  const fade = (1 - p) * (1 - p)
  return {
    push: -0.46 * fade,
    lift: 0,
    tilt: -0.28 * fade,
    scale: 1 - 0.05 * fade,
    /* 떨림은 앞부분에서만 크게, 뒤로 갈수록 잦아든다 */
    shake: Math.sin(p * 46) * 0.09 * fade,
    flash: fade,
  }
}

/* 빗나갔을 때 — 맞지 않았으니 살짝 피하기만 한다 */
export function dodgePose(p) {
  if (p <= 0 || p >= 1) return { ...NEUTRAL }
  return { push: -0.20 * bump(p), lift: 0.10 * bump(p), tilt: 0.20 * bump(p), scale: 1 }
}

/* 경과 시간(ms) → 진행도. 끝나면 1을 넘지 않는다. */
export const progress = (elapsed, total) => clamp01(elapsed / total)

/* 화면 흔들림 — 궁극기와 치명타에서만 크게 */
export function shakeAmount(p, strength = 1) {
  if (p <= 0 || p >= 1) return 0
  return Math.sin(p * 38) * 8 * strength * (1 - p) * (1 - p)
}
