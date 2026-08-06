/* ==================================================================
   드래곤별 생김새 — 등급/속성만으로는 같은 등급·속성이 전부 똑같이
   생긴다. 드래곤 id 를 해시해 몸 비율·뿔·목·꼬리·색조를 흔든다.
   같은 id 면 언제 그려도 같은 모습이 나온다.

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

const HORN_STYLES = ['cone', 'curved', 'crown', 'straight']
const TAIL_TIPS = ['blade', 'spike', 'club', 'fan']

export function dragonLook(dragonId, rarity) {
  const base = RARITY_SHAPE[rarity] || RARITY_SHAPE.common
  if (!dragonId) return { ...base, body: 1, neck: 1, snout: 1, legs: 1, tailLen: 1, hue: 0, hornStyle: 'cone', tailTip: 'blade', wingScale: 1, spikeTilt: -0.3 }
  const h = hash32(dragonId)
  const f = (shift, lo, hi) => lo + (((h >>> shift) % 100) / 100) * (hi - lo)
  return {
    ...base,
    /* 몸통 굵기 · 목 길이 · 주둥이 · 다리 · 꼬리 길이 */
    body: f(0, 0.86, 1.18),
    neck: f(4, 0.78, 1.30),
    snout: f(8, 0.82, 1.26),
    legs: f(12, 0.85, 1.18),
    tailLen: f(16, 0.80, 1.32),
    wingScale: f(20, 0.85, 1.22),
    /* 속성 색을 살짝 비틀어 개체색을 만든다 (속성은 알아볼 수 있게 좁게) */
    hue: f(24, -18, 18),
    spikeTilt: f(2, -0.55, -0.05),
    hornStyle: HORN_STYLES[(h >>> 6) % HORN_STYLES.length],
    tailTip: TAIL_TIPS[(h >>> 10) % TAIL_TIPS.length],
    /* 뿔 개수도 등급 범위 안에서 ±2 흔든다 */
    horns: Math.max(2, base.horns + ((h >>> 14) % 3) - 1),
  }
}

/* 색조만 살짝 돌린다 — 속성 색은 알아볼 수 있어야 하므로 폭이 좁다 */
export function shiftHue(hex, deg) {
  const c = new THREE.Color(hex)
  const hsl = {}
  c.getHSL(hsl)
  c.setHSL((hsl.h + deg / 360 + 1) % 1, hsl.s, hsl.l)
  return c
}

