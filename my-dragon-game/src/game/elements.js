/* ==================================================================
   8가지 속성 (사용자 확정)

   속성은 두 가지를 결정한다.
     1) 겉모습 — 비늘·눈·오라 색 (3d/DragonModel.jsx)
     2) 능력치 성향 — 같은 등급이라도 화염은 공격이, 대지는 방어가 높다
   ================================================================== */

export const ELEMENTS = [
  {
    id: 'fire', name: '화염', role: '공격형', icon: '🔥',
    color: '#ef4444', glow: '#ff8a5c', deep: '#7f1d1d',
    desc: '가장 높은 공격력. 지속 화상 피해로 굳히는 정통 딜러.',
    /* 능력치 성향 — 1.0이 기준 */
    bias: { hp: 0.95, atk: 1.25, matk: 1.10, def: 0.90, mdef: 0.95, agi: 1.00 },
  },
  {
    id: 'ice', name: '빙결', role: '제어형', icon: '❄️',
    color: '#38bdf8', glow: '#a5f3fc', deep: '#0c4a6e',
    desc: '적을 얼려 turn을 빼앗는다. 마법 공격이 주력.',
    bias: { hp: 1.00, atk: 0.90, matk: 1.20, def: 1.00, mdef: 1.10, agi: 1.05 },
  },
  {
    id: 'earth', name: '대지', role: '방어형', icon: '⛰️',
    color: '#a16207', glow: '#fbbf24', deep: '#422006',
    desc: '압도적인 체력과 방어. 느리지만 무너지지 않는다.',
    bias: { hp: 1.25, atk: 0.95, matk: 0.90, def: 1.30, mdef: 1.15, agi: 0.80 },
  },
  {
    id: 'thunder', name: '뇌전', role: '속도형', icon: '⚡',
    color: '#facc15', glow: '#fef08a', deep: '#713f12',
    desc: '가장 먼저 움직인다. 연속 행동으로 판을 흔든다.',
    bias: { hp: 0.90, atk: 1.10, matk: 1.05, def: 0.90, mdef: 0.90, agi: 1.30 },
  },
  {
    id: 'mystic', name: '신비', role: '회복형', icon: '✨',
    color: '#c084fc', glow: '#f0abfc', deep: '#4c1d95',
    desc: '아군을 되살리고 지켜낸다. 장기전의 핵심.',
    bias: { hp: 1.05, atk: 0.85, matk: 1.15, def: 1.00, mdef: 1.25, agi: 1.00 },
  },
  {
    id: 'wind', name: '풍', role: '기동형', icon: '🌪️',
    color: '#4ade80', glow: '#bbf7d0', deep: '#14532d',
    desc: '회피와 기동. 맞지 않는 것이 최고의 방어다.',
    bias: { hp: 0.95, atk: 1.05, matk: 1.05, def: 0.85, mdef: 0.95, agi: 1.25 },
  },
  {
    id: 'dark', name: '암흑', role: '특수형', icon: '🌑',
    color: '#7c3aed', glow: '#c4b5fd', deep: '#2e1065',
    desc: '규칙을 비트는 특수 능력. 다루기 어렵지만 강력하다.',
    bias: { hp: 0.95, atk: 1.15, matk: 1.15, def: 0.95, mdef: 0.90, agi: 1.10 },
  },
  {
    id: 'light', name: '빛', role: '밸런스형', icon: '☀️',
    color: '#fde68a', glow: '#fffbeb', deep: '#78350f',
    desc: '약점이 없다. 어떤 조합에도 무난하게 들어간다.',
    bias: { hp: 1.05, atk: 1.05, matk: 1.05, def: 1.05, mdef: 1.05, agi: 1.05 },
  },
]

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]))
export const ELEMENT_IDS = ELEMENTS.map((e) => e.id)
