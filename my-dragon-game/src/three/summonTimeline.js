/* ==================================================================
   소환 컷씬 타임라인 — 순수 계산

   연출을 단계(phase)로 쪼개고, "지금 몇 초인가"만 주면 어느 단계의
   어디쯤인지 돌려준다. 렌더링과 분리해 둔 이유는 이전 컷씬에서
   단계 전환을 rAF 콜백 안에서 직접 만지다 보니 타이밍이 어긋나도
   눈으로밖에 확인할 수 없었기 때문이다. 숫자로 뽑으면 바로 보인다.

   [단계]
     dark    암전. 정적
     circle  마법진이 그려진다
     charge  기가 모인다 — 입자가 중앙으로 빨려든다
     burst   빛이 터진다
     roll    드래곤이 굴러 들어온다
     land    착지 — 충격파
     rear    몸을 세우고 숨을 들이켠다 (가슴이 부푼다)
     roar    포효 — 턱이 벌어지고 숨결이 터진다
     settle  자세를 가다듬고 이름이 뜬다
   ================================================================== */

/* 등급이 높을수록 길고 화려하다. 일반은 군더더기를 걷어낸다. */
export const TIMELINES = {
  /* 일반도 rear(숨 들이켬)를 아주 짧게라도 거쳐야 한다.
     이 단계에서 몸을 세우고 앞으로 나오는데, 건너뛰면 포효 첫 프레임에
     그 자세가 통째로 튀어 들어온다. */
  common: [
    ['circle', 0.35], ['charge', 0.40], ['burst', 0.20],
    ['roll', 0.70], ['land', 0.30], ['rear', 0.20], ['roar', 0.45], ['settle', 0.80],
  ],
  rare: [
    ['dark', 0.20], ['circle', 0.45], ['charge', 0.55], ['burst', 0.22],
    ['roll', 0.80], ['land', 0.32], ['rear', 0.28], ['roar', 0.60], ['settle', 0.90],
  ],
  epic: [
    ['dark', 0.35], ['circle', 0.70], ['charge', 0.85], ['burst', 0.28],
    ['roll', 1.00], ['land', 0.38], ['rear', 0.42], ['roar', 0.95], ['settle', 1.05],
  ],
  legend: [
    ['dark', 0.50], ['circle', 0.95], ['charge', 1.20], ['burst', 0.32],
    ['roll', 1.15], ['land', 0.45], ['rear', 0.60], ['roar', 1.50], ['settle', 1.25],
  ],
}

export const timelineOf = (rarity) => TIMELINES[rarity] || TIMELINES.common
export const totalTime = (rarity) => timelineOf(rarity).reduce((a, [, d]) => a + d, 0)

/* 시작 시각(초) 목록 — 어느 단계가 언제 시작하는지 */
export function phaseStarts(rarity) {
  const out = {}
  let at = 0
  for (const [name, dur] of timelineOf(rarity)) { out[name] = at; at += dur }
  return out
}

/* 경과 시간 → { phase, p, index }  (p 는 그 단계 안에서의 0~1) */
export function phaseAt(rarity, elapsed) {
  const tl = timelineOf(rarity)
  let at = 0
  for (let i = 0; i < tl.length; i++) {
    const [name, dur] = tl[i]
    if (elapsed < at + dur) {
      return { phase: name, p: dur > 0 ? (elapsed - at) / dur : 1, index: i }
    }
    at += dur
  }
  const last = tl[tl.length - 1]
  return { phase: last[0], p: 1, index: tl.length - 1 }
}

/* 그 단계가 타임라인에 들어 있는가 (일반은 dark·rear 가 없다) */
export const hasPhase = (rarity, name) => timelineOf(rarity).some(([n]) => n === name)

/* 이름표는 포효가 끝나갈 때부터 뜬다 */
export function nameVisible(rarity, elapsed) {
  const starts = phaseStarts(rarity)
  const roarStart = starts.roar ?? 0
  const roarDur = (timelineOf(rarity).find(([n]) => n === 'roar') || ['roar', 0])[1]
  return elapsed >= roarStart + roarDur * 0.55
}

/* 건너뛰기 버튼이 "확인"으로 바뀌는 시점 */
export const canFinishAt = (rarity, elapsed) => nameVisible(rarity, elapsed)

/* ---------------- 연출 수치 ----------------
   각 단계에서 화면이 얼마나 밝아지고 흔들리는지. 전부 0~1. */

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const bump = (t) => Math.sin(clamp01(t) * Math.PI)

/* 입이 벌어진 정도 — 숨을 들이켤 때 살짝, 포효에서 크게 */
export function mawAt(phase, p) {
  if (phase === 'rear') return 0.18 * easeOut(p)
  if (phase === 'roar') {
    /* 앞부분에 확 벌리고, 숨결이 완전히 끊긴 뒤에 다문다.
       (0.76 은 breathAt 이 0 이 되는 0.74 보다 뒤여야 한다.
        안 그러면 다문 입에서 불이 새어 나온다) */
    if (p < 0.18) return 0.18 + 0.82 * easeOut(p / 0.18)
    if (p < 0.76) return 1
    return 1 - easeOut((p - 0.76) / 0.24)
  }
  if (phase === 'settle') return 0
  return 0
}

/* 숨결 세기 — 입이 다 벌어진 뒤에 터져나온다 */
export function breathAt(phase, p) {
  if (phase !== 'roar') return 0
  if (p < 0.16) return 0
  if (p < 0.34) return easeOut((p - 0.16) / 0.18)
  if (p < 0.62) return 1
  return clamp01(1 - (p - 0.62) / 0.12)
}

/* 화면 흔들림 — 착지와 포효에서만 */
export function shakeAt(phase, p) {
  if (phase === 'land') return (1 - easeOut(p)) * 1
  if (phase === 'roar') return p < 0.7 ? bump(p / 0.7) * 0.7 : 0
  return 0
}

/* 화면 번쩍임 */
export function flashAt(phase, p) {
  if (phase === 'burst') return 1 - easeOut(p)
  if (phase === 'land') return (1 - easeOut(p)) * 0.55
  if (phase === 'roar' && p < 0.3) return bump(p / 0.3) * 0.45
  return 0
}

/* 기 모으는 정도 — 입자가 중앙으로 얼마나 빨려들었나 */
export function chargeAt(phase, p) {
  if (phase === 'circle') return 0.15 * p
  if (phase === 'charge') return 0.15 + 0.85 * easeOut(p)
  if (phase === 'burst') return 1 - p
  return 0
}

/* 마법진이 그려진 정도 */
export function circleAt(phase, p) {
  if (phase === 'dark') return 0
  if (phase === 'circle') return easeOut(p)
  return 1
}

/* 시네마 레터박스 — 시작에 닫히고 끝에 열린다 */
export function letterboxAt(rarity, elapsed) {
  const total = totalTime(rarity)
  const inAt = clamp01(elapsed / 0.45)
  const outAt = clamp01((total - elapsed) / 0.5)
  return Math.min(inAt, outAt)
}

/* ==================================================================
   카메라 워크와 드래곤 자세

   렌더러 없이도 "드래곤이 화면 안에 있나" 를 계산할 수 있도록
   순수 함수로 빼 두었다. useFrame 안에 박아 두었을 때는 포물선을
   너무 높게 잡아 드래곤이 화면 위로 통째로 빠져나가는 걸 눈으로만
   잡을 수 있었다. 이제는 투영해서 숫자로 확인한다.

   t 는 흔들림·부유처럼 시간에 따라 떠는 값에 쓰는 절대 시각(초).
   ================================================================== */

/* 드래곤 자세 — { visible, pos:[x,y,z], rot:[x,y,z], scale:[x,y,z] } */
export function dragonPose(phase, p, t = 0) {
  const hidden = { visible: false, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
  const e = easeOut(p)

  if (phase === 'dark' || phase === 'circle' || phase === 'charge' || phase === 'burst') return hidden

  if (phase === 'roll') {
    return {
      visible: true,
      /* 포물선 높이를 1.7 로 잡았더니 화면 위로 완전히 빠져나갔다 */
      pos: [0, 0.4 + Math.sin(p * Math.PI) * 1.0, -24 + e * 24],
      /* 앞구르기 2바퀴 + 옆으로 1바퀴. 회전량을 e 에 정확히 비례시켜야
         끝에서 딱 0 이 된다. p 에 임의의 배수를 곱했더니 착지에서 튀었다 */
      rot: [e * Math.PI * 4, Math.sin(p * Math.PI) * 0.5, e * Math.PI * 2],
      scale: (s => [s, s, s])(0.55 + e * 0.45),
    }
  }
  if (phase === 'land') {
    /* 쿵 — 눌렸다가 펴진다. 내려앉는 양은 0 에서 시작해 0 으로 돌아와야
       한다. 0.15 만큼 내려간 상태로 시작했더니 착지 순간 몸이 툭 꺼졌다 */
    const dip = Math.sin(clamp01(p * 2) * Math.PI)
    const squash = 1 - dip * 0.16
    return {
      visible: true,
      pos: [0, 0.4 - dip * 0.15, 0],
      rot: [0, 0, 0],
      scale: [1 / squash, squash, 1 / squash],
    }
  }
  if (phase === 'rear') {
    /* 몸을 세우고 숨을 들이켠다 — 가슴이 부푼다 */
    const swell = 1 + e * 0.07
    return {
      visible: true,
      pos: [0, 0.4 + e * 0.12, -e * 0.25],
      rot: [-e * 0.14, 0, 0],
      scale: [swell, swell, swell],
    }
  }
  if (phase === 'roar') {
    /* 앞으로 내지르고 반동으로 밀린다 */
    const kick = p < 0.22 ? easeOut(p / 0.22) : 1
    const recoil = p < 0.22 ? 0 : easeOut(clamp01((p - 0.22) / 0.5)) * 0.30
    const s = 1.07 - kick * 0.04
    return {
      visible: true,
      pos: [0, 0.52 - kick * 0.06, -0.25 + kick * 0.30 - recoil],
      rot: [-0.14 - kick * 0.10 + recoil * 0.2, 0, 0],
      scale: [s, s, s],
    }
  }
  /* settle — 포효가 끝난 그 자세에서 평상시 자세로 풀린다.
     시작값을 포효의 마지막 값(아래 END)과 정확히 맞춰야 이음새가 안 보인다.
     예전엔 z 가 -0.25 에서 0 으로 한 프레임 만에 튀었다. */
  const END = { y: 0.46, z: -0.25, rx: -0.18, s: 1.03 }
  const k = easeOut(clamp01(p * 2.5))
  const mix = (a, b) => a + (b - a) * k
  const s = mix(END.s, 1)
  return {
    visible: true,
    pos: [0, mix(END.y, 0.4 + Math.sin(t * 1.4) * 0.05), mix(END.z, 0)],
    rot: [mix(END.rx, 0), Math.sin(t * 0.5) * 0.14 * k, 0],
    scale: [s, s, s],
  }
}

/* 카메라 — { pos:[x,y,z], look:[x,y,z] }.  D 는 fitDistance 가 준 기준 거리 */
export function cameraShot(phase, p, D, t = 0) {
  const charge = chargeAt(phase, p)
  const sh = shakeAt(phase, p)
  const jit = sh ? (Math.sin(t * 47) * 0.10 + Math.sin(t * 31) * 0.06) * sh : 0

  if (phase === 'dark' || phase === 'circle' || phase === 'charge') {
    /* 낮게 깔려 바닥의 마법진을 올려다본다 */
    return {
      pos: [Math.sin(t * 0.25) * 2.0, 0.85 + charge * 0.9, D + 2.6 - charge * 1.5],
      look: [0, 0.7 + charge * 0.6, 0],
    }
  }
  if (phase === 'burst') return { pos: [0, 1.6, D + 1.2], look: [0, 1.2, 0] }
  if (phase === 'roll') {
    /* 가로 흔들림을 넣었더니 착지 지점이 매번 화면 밖으로 밀렸다.
       정면을 유지한 채, 시선만 포물선을 따라 올렸다 내린다 */
    const e = easeOut(p)
    return {
      pos: [0, 2.4 + (1 - e) * 1.4, D + 2.2 - e * 1.8],
      look: [0, 1.0 + Math.sin(p * Math.PI) * 0.6, 0],
    }
  }
  /* 아래 시선 높이들은 머리가 화면 위쪽으로 잘리지 않는 선에서 잡았다.
     1.1~1.6 으로 두었더니 세로 화면에서 머리가 화면 맨 위 가장자리(ndc 0.96)에
     딱 붙어 정수리가 잘렸다. */
  if (phase === 'land') return { pos: [jit, 1.5 + jit * 0.5, D + 0.4], look: [0, 1.62, 0] }
  if (phase === 'rear') {
    /* 천천히 올려다본다 */
    return { pos: [0, 1.35 + p * 0.35, D + 0.1], look: [0, 1.80 + p * 0.15, 0] }
  }
  if (phase === 'roar') {
    /* 확 다가붙고 흔들린다 */
    const push = easeOut(clamp01(p / 0.3)) * 0.85
    return { pos: [jit, 1.75 + jit * 0.4, D + 0.1 - push], look: [0, 1.95, 0] }
  }
  return { pos: [Math.sin(t * 0.32) * 1.3, 1.9, D + 0.2], look: [0, 1.70, 0] }
}
