/* ==================================================================
   드래곤별 생김새

   비율과 색만 흔들면 실루엣이 전부 같아서 결국 "색만 다른 같은 용"이
   된다. 그래서 체형(body) 자체를 여섯 갈래로 나누고, 날개·머리·꼬리도
   따로 고른다. 조합이 6 × 4 × 4 × 4 = 384 가지라 100마리가 서로 겹치기
   어렵다.

   같은 id 면 언제 그려도 같은 모습이 나온다 (해시 기반).
   컴포넌트 파일에서 분리한 이유: 같은 파일에서 컴포넌트가 아닌 것을
   같이 내보내면 Vite 의 빠른 새로고침이 동작하지 않는다.
   ================================================================== */
import * as THREE from 'three'

/* 등급이 올라갈수록 크고, 뿔이 늘고, 장식이 붙는다 */
export const RARITY_SHAPE = {
  common: { size: 0.86, horns: 2, hornLen: 0.30, spikes: 5, frill: false, aura: 0 },
  rare: { size: 0.94, horns: 2, hornLen: 0.42, spikes: 7, frill: false, aura: 0 },
  epic: { size: 1.04, horns: 4, hornLen: 0.52, spikes: 9, frill: true, aura: 0.5 },
  legend: { size: 1.16, horns: 6, hornLen: 0.66, spikes: 11, frill: true, aura: 1 },
}

function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/* ==================================================================
   체형 — 뼈대가 아예 다르다

   legs      다리 수 (0 = 없음)
   spine     몸통을 이루는 마디 수. 많을수록 뱀처럼 길어진다
   curve     마디가 그리는 굽이의 세기
   stance    몸통 높이 (땅에 붙는가, 서 있는가)
   ================================================================== */
export const BODY_TYPES = {
  /* 두 다리 · 큰 날개. 가장 전형적인 서양 비룡 */
  wyvern: { legs: 2, spine: 3, curve: 0.10, stance: 1.15, girth: 1.00, neck: 1.15, tail: 1.10 },
  /* 네 다리 · 다부진 몸. 땅을 딛고 선다 */
  drake: { legs: 4, spine: 3, curve: 0.06, stance: 1.00, girth: 1.22, neck: 0.85, tail: 0.95 },
  /* 다리 없이 길게 이어지는 몸 */
  serpent: { legs: 0, spine: 9, curve: 0.42, stance: 0.72, girth: 0.74, neck: 0.70, tail: 1.35 },
  /* 동양룡 — 아주 길고 굽이치며, 짧은 네 다리가 몸통을 따라 붙는다 */
  eastern: { legs: 4, spine: 11, curve: 0.55, stance: 0.80, girth: 0.68, neck: 0.80, tail: 1.45 },
  /* 거수 — 산더미 같은 몸에 작은 머리 */
  titan: { legs: 4, spine: 3, curve: 0.04, stance: 0.92, girth: 1.55, neck: 0.60, tail: 0.85 },
  /* 요정룡 — 작고 날렵하다. 머리가 크고 날개가 넷 */
  sprite: { legs: 2, spine: 2, curve: 0.14, stance: 1.25, girth: 0.66, neck: 0.95, tail: 0.90 },
}
export const BODY_IDS = Object.keys(BODY_TYPES)

/* 날개 — 없는 체형도 있다 */
export const WING_TYPES = ['bat', 'feather', 'insect', 'none']
/* 머리 */
export const HEAD_TYPES = ['horned', 'beak', 'crest', 'blunt']
export const HORN_STYLES = ['cone', 'curved', 'crown', 'straight']
export const TAIL_TIPS = ['blade', 'spike', 'club', 'fan']

/* 체형마다 어울리는 날개가 정해져 있다.
   동양룡에 박쥐 날개를 달면 그냥 이상하게 생긴 용이 된다. */
const WINGS_FOR = {
  wyvern: ['bat', 'bat', 'feather'],
  drake: ['bat', 'feather', 'none'],
  serpent: ['bat', 'insect', 'none'],
  eastern: ['none', 'none', 'insect'],
  titan: ['bat', 'none', 'none'],
  sprite: ['insect', 'insect', 'feather'],
}

const DEFAULT = {
  ...RARITY_SHAPE.common,
  ...BODY_TYPES.wyvern,
  bodyType: 'wyvern', wingType: 'bat', headType: 'horned',
  hornStyle: 'cone', tailTip: 'blade',
  body: 1, snout: 1, legLen: 1, tailLen: 1, wingScale: 1, hue: 0, spikeTilt: -0.3,
  headSize: 1, wingPairs: 1,
}

export function dragonLook(dragonId, rarity) {
  const base = RARITY_SHAPE[rarity] || RARITY_SHAPE.common
  if (!dragonId) return { ...DEFAULT, ...base }

  const h = hash32(dragonId)
  const f = (shift, lo, hi) => lo + (((h >>> shift) % 100) / 100) * (hi - lo)
  const pickFrom = (arr, shift) => arr[(h >>> shift) % arr.length]

  const bodyType = pickFrom(BODY_IDS, 3)
  const shape = BODY_TYPES[bodyType]
  const wingType = pickFrom(WINGS_FOR[bodyType], 9)

  return {
    ...base,
    ...shape,
    bodyType,
    wingType,
    /* 요정룡은 잠자리처럼 날개가 두 쌍 */
    wingPairs: wingType === 'insect' ? 2 : 1,
    headType: pickFrom(HEAD_TYPES, 13),
    hornStyle: pickFrom(HORN_STYLES, 6),
    tailTip: pickFrom(TAIL_TIPS, 10),

    /* 체형 기본값 위에 개체 편차를 얹는다 */
    body: shape.girth * f(0, 0.88, 1.14),
    neck: shape.neck * f(4, 0.85, 1.18),
    tailLen: shape.tail * f(16, 0.88, 1.16),
    snout: f(8, 0.80, 1.30),
    legLen: f(12, 0.82, 1.20),
    wingScale: f(20, 0.85, 1.25),
    /* 거수는 머리가 작고 요정룡은 크다 */
    headSize: (bodyType === 'titan' ? 0.72 : bodyType === 'sprite' ? 1.35 : 1) * f(18, 0.92, 1.10),

    /* 속성 색을 살짝 비틀어 개체색을 만든다 (속성은 알아볼 수 있게 좁게) */
    hue: f(24, -20, 20),
    spikeTilt: f(2, -0.55, -0.05),
    horns: Math.max(2, base.horns + ((h >>> 14) % 3) - 1),
  }
}

/* 몸통 마디의 위치 — 뱀·동양룡은 이 곡선으로 굽이친다.
   i 는 0(어깨)에서 n-1(꼬리 쪽)까지. */
export function spinePoint(i, n, look) {
  const t = n <= 1 ? 0 : i / (n - 1)
  const z = -t * (0.62 + look.tailLen * 0.55) * (n > 4 ? n * 0.22 : 1.15)
  /* 굽이 — 마디가 많은 체형일수록 크게 물결친다 */
  const wave = Math.sin(t * Math.PI * (n > 6 ? 1.6 : 0.9)) * look.curve
  const y = 1.15 * look.stance - t * 0.10 + wave * 0.55
  const x = wave * (look.bodyType === 'eastern' ? 0.85 : 0.35)
  /* 앞이 굵고 뒤로 갈수록 가늘어진다 */
  const r = (0.62 * look.body) * (1 - t * (n > 6 ? 0.62 : 0.42))
  return { x, y, z, r: Math.max(0.06, r) }
}

/* 색조만 살짝 돌린다 — 속성 색은 알아볼 수 있어야 하므로 폭이 좁다 */
export function shiftHue(hex, deg) {
  const c = new THREE.Color(hex)
  const hsl = {}
  c.getHSL(hsl)
  c.setHSL((hsl.h + deg / 360 + 1) % 1, hsl.s, hsl.l)
  return c
}
