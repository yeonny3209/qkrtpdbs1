/* ==================================================================
   스킬 — 드래곤마다 자기만의 스킬셋

   [구성] 드래곤 한 마리당 정확히 4개
     1스킬   홀수 라운드에만 쓸 수 있다
     2스킬   짝수 라운드에만 쓸 수 있다
     궁극기  쓴 뒤 5라운드가 지나야 다시 쓴다
     패시브  항상 켜져 있다 (battle.js 가 읽는다)

   턴 패리티가 자원 역할을 하므로 MP 는 쓰지 않는다. 홀·짝이 번갈아
   열리기 때문에 "이번 턴에 뭘 할 수 있나"가 매 턴 바뀐다.

   [어떻게 100마리가 다 다른가] 속성마다 1스킬 3종·2스킬 3종·궁극기
   2종·패시브 풀을 두고, 드래곤 id 해시로 고른다. 수치도 해시로 ±8%
   흔들어서 같은 조합이라도 미묘하게 다르다.
   ================================================================== */

export const BASE_CRIT = 5             // 기본 크리티컬 5%
export const CRIT_MUL = 1.6
export const ULT_COOLDOWN = 5          // 궁극기 — 쓴 시점부터 5라운드

/* MP 는 더 이상 쓰지 않지만, 예전 코드가 참조하던 이름이라 남겨둔다 */
export const MP_MAX = 100
export const MP_PER_TURN = 15

/* 상태이상 — 속성 정체성을 전투에서 드러내는 장치 */
export const STATUS = {
  burn: { name: '화상', icon: '🔥', kind: 'dot', desc: '매 턴 피해' },
  freeze: { name: '빙결', icon: '❄️', kind: 'skip', desc: '행동 불가' },
  stun: { name: '감전', icon: '⚡', kind: 'skip', desc: '행동 불가' },
  atkDown: { name: '약화', icon: '🔻', kind: 'buff', desc: '공격 감소' },
  defDown: { name: '취약', icon: '🛡️', kind: 'buff', desc: '방어 감소' },
  regen: { name: '재생', icon: '💚', kind: 'hot', desc: '매 턴 회복' },
  shield: { name: '보호막', icon: '🔰', kind: 'shield', desc: '피해 흡수' },
  haste: { name: '가속', icon: '💨', kind: 'buff', desc: '민첩 증가' },
  blind: { name: '실명', icon: '🌑', kind: 'buff', desc: '명중 감소' },
}

/* 모든 드래곤 공통 — 언제든 쓸 수 있는 최후의 수단 */
export const BASIC_ATTACK = {
  id: 'basic', name: '기본 공격', icon: '⚔', kind: 'basic',
  turn: null, cd: 0, power: 1.0, acc: 95, stat: 'atk', target: 'enemy',
  desc: '언제든 쓸 수 있는 물리 공격.',
}

/* ==================================================================
   패시브 — battle.js 가 passiveEffect(unit, key) 로 조회한다.
   정의만 있고 전투가 안 읽으면 설명뿐인 장식이 되므로,
   여기 있는 key 는 전부 전투 쪽에 대응 코드가 있어야 한다.
   ================================================================== */
export const PASSIVES = [
  { id: 'thorns', name: '가시 비늘', icon: '🌵', effect: 'thorns', value: 0.18,
    desc: (v) => `피격 시 받은 피해의 ${Math.round(v * 100)}%를 되돌려준다` },
  { id: 'bulwark', name: '단단한 껍질', icon: '🪨', effect: 'bulwark', value: 0.12,
    desc: (v) => `받는 피해 ${Math.round(v * 100)}% 감소` },
  { id: 'lifesteal', name: '피의 갈증', icon: '🩸', effect: 'lifesteal', value: 0.15,
    desc: (v) => `준 피해의 ${Math.round(v * 100)}%를 회복한다` },
  { id: 'swift', name: '바람의 발', icon: '💨', effect: 'swift', value: 0.20,
    desc: (v) => `민첩 +${Math.round(v * 100)}%` },
  { id: 'precision', name: '매의 눈', icon: '🎯', effect: 'precision', value: 12,
    desc: (v) => `크리티컬 확률 +${v}%` },
  { id: 'execute', name: '처형자', icon: '🔪', effect: 'execute', value: 0.35,
    desc: (v) => `체력 30% 이하인 적에게 피해 +${Math.round(v * 100)}%` },
  { id: 'resolve', name: '불굴', icon: '🔥', effect: 'resolve', value: 0.30,
    desc: (v) => `자신의 체력이 40% 이하일 때 공격력 +${Math.round(v * 100)}%` },
  { id: 'barrier', name: '선천의 방벽', icon: '🔰', effect: 'barrier', value: 0.22,
    desc: (v) => `전투 시작 시 ${Math.round(v * 100)}% 보호막을 두른다` },
  { id: 'venom', name: '맹독 송곳니', icon: '🧪', effect: 'venom', value: 35,
    desc: (v) => `공격 시 ${v}% 확률로 화상을 남긴다` },
  { id: 'mend', name: '느린 회복', icon: '💚', effect: 'mend', value: 0.04,
    desc: (v) => `매 턴 최대 체력의 ${Math.round(v * 100)}%를 회복한다` },
  { id: 'vigil', name: '불침의 의지', icon: '🛡', effect: 'vigil', value: 1,
    desc: () => '쓰러지는 순간 체력 1로 한 번 버틴다' },
  { id: 'hunter', name: '선제의 감각', icon: '⚡', effect: 'hunter', value: 25,
    desc: (v) => `${v}% 확률로 라운드 선공을 잡는다` },
]
export const PASSIVE_BY_ID = Object.fromEntries(PASSIVES.map((p) => [p.id, p]))

/* ==================================================================
   속성별 스킬 풀
   ================================================================== */
const POOLS = {
  fire: {
    s1: [
      { name: '화염 발톱', icon: '🔥', power: 1.45, acc: 95, stat: 'atk', target: 'enemy',
        status: { key: 'burn', chance: 60, turns: 2, value: 0.06 }, desc: '불붙은 발톱으로 할퀸다.' },
      { name: '불티 연격', icon: '✨', power: 0.85, acc: 100, stat: 'atk', target: 'enemy', hits: 2,
        desc: '불티를 튀기며 두 번 벤다. 빗나가지 않는다.' },
      { name: '용암 채찍', icon: '🌡', power: 1.35, acc: 92, stat: 'matk', target: 'enemy',
        status: { key: 'defDown', chance: 55, turns: 2, value: 0.22 }, desc: '녹아내린 채찍이 비늘을 태운다.' },
    ],
    s2: [
      { name: '작열 브레스', icon: '☄️', power: 2.05, acc: 88, stat: 'matk', target: 'enemyAll',
        status: { key: 'burn', chance: 45, turns: 2, value: 0.05 }, desc: '전체를 태우는 화염 브레스.' },
      { name: '폭염 강타', icon: '💥', power: 2.35, acc: 85, stat: 'atk', target: 'enemy',
        status: { key: 'burn', chance: 70, turns: 3, value: 0.06 }, desc: '한 점에 열을 몰아 터뜨린다.' },
      { name: '불의 결계', icon: '🕯', power: 1.1, acc: 100, stat: 'matk', target: 'enemyAll',
        status: { key: 'atkDown', chance: 70, turns: 2, value: 0.25 }, desc: '열풍으로 적의 기세를 꺾는다.' },
    ],
    ult: [
      { name: '멸화의 숨결', icon: '🌋', power: 3.4, acc: 100, stat: 'matk', target: 'enemyAll',
        status: { key: 'burn', chance: 100, turns: 3, value: 0.08 }, desc: '전장을 불바다로 만든다.' },
      { name: '태양의 심장', icon: '☀️', power: 4.2, acc: 100, stat: 'atk', target: 'enemy',
        status: { key: 'burn', chance: 100, turns: 3, value: 0.09 }, desc: '심장의 불을 한 점에 쏟는다.' },
    ],
  },
  ice: {
    s1: [
      { name: '서리 송곳', icon: '❄️', power: 1.4, acc: 95, stat: 'matk', target: 'enemy',
        status: { key: 'freeze', chance: 30, turns: 1 }, desc: '얼음 창을 던진다.' },
      { name: '한파 베기', icon: '🗡', power: 1.5, acc: 92, stat: 'atk', target: 'enemy',
        status: { key: 'atkDown', chance: 55, turns: 2, value: 0.22 }, desc: '냉기로 근육을 굳힌다.' },
      { name: '얼음 파편', icon: '🧊', power: 0.95, acc: 100, stat: 'matk', target: 'enemyAll',
        desc: '파편을 흩뿌려 전체를 긁는다.' },
    ],
    s2: [
      { name: '절대영도', icon: '🧊', power: 1.6, acc: 82, stat: 'matk', target: 'enemy',
        status: { key: 'freeze', chance: 85, turns: 2 }, desc: '대상을 얼려 행동을 봉인한다.' },
      { name: '빙벽', icon: '🛡', power: 0, acc: 100, stat: 'matk', target: 'selfAll',
        status: { key: 'shield', chance: 100, turns: 3, value: 0.30 }, desc: '얼음 벽으로 아군을 감싼다.' },
      { name: '동결 폭풍', icon: '🌨', power: 1.85, acc: 88, stat: 'matk', target: 'enemyAll',
        status: { key: 'freeze', chance: 35, turns: 1 }, desc: '눈보라가 전장을 삼킨다.' },
    ],
    ult: [
      { name: '영겁의 빙하', icon: '🏔️', power: 2.9, acc: 100, stat: 'matk', target: 'enemyAll',
        status: { key: 'freeze', chance: 60, turns: 1 }, desc: '전장을 얼려붙인다.' },
      { name: '천 년의 관', icon: '⚰️', power: 3.8, acc: 100, stat: 'matk', target: 'enemy',
        status: { key: 'freeze', chance: 100, turns: 2 }, desc: '한 명을 영원 속에 가둔다.' },
    ],
  },
  earth: {
    s1: [
      { name: '암석 강타', icon: '🪨', power: 1.5, acc: 90, stat: 'atk', target: 'enemy',
        status: { key: 'defDown', chance: 50, turns: 2, value: 0.25 }, desc: '바위로 내려찍는다.' },
      { name: '가시 돌진', icon: '🌵', power: 1.42, acc: 95, stat: 'atk', target: 'enemy',
        desc: '비늘을 세우고 그대로 들이받는다.' },
      { name: '모래 지옥', icon: '🏜', power: 1.05, acc: 95, stat: 'atk', target: 'enemyAll',
        status: { key: 'blind', chance: 50, turns: 2, value: 0.25 }, desc: '모래를 일으켜 시야를 덮는다.' },
    ],
    s2: [
      { name: '대지의 수호', icon: '🛡️', power: 0, acc: 100, stat: 'atk', target: 'selfAll',
        status: { key: 'shield', chance: 100, turns: 3, value: 0.28 }, desc: '아군 전체에 보호막을 두른다.' },
      { name: '단층 붕괴', icon: '⛏', power: 2.2, acc: 85, stat: 'atk', target: 'enemyAll',
        status: { key: 'defDown', chance: 60, turns: 2, value: 0.25 }, desc: '땅을 갈라 전체를 무너뜨린다.' },
      { name: '반석의 의지', icon: '🗿', power: 0, acc: 100, stat: 'atk', target: 'self',
        status: { key: 'shield', chance: 100, turns: 3, value: 0.40 }, desc: '스스로를 바위로 굳힌다.' },
    ],
    ult: [
      { name: '지각 붕괴', icon: '⛰️', power: 3.0, acc: 100, stat: 'atk', target: 'enemyAll',
        status: { key: 'defDown', chance: 100, turns: 3, value: 0.3 }, desc: '대지를 무너뜨려 전체를 짓누른다.' },
      { name: '세계수의 뿌리', icon: '🌳', power: 2.4, acc: 100, stat: 'atk', target: 'enemyAll',
        heal: 0.5, status: { key: 'shield', chance: 100, turns: 3, value: 0.3 },
        desc: '뿌리가 적을 옭아매고 아군을 감싼다.' },
    ],
  },
  thunder: {
    s1: [
      { name: '전격', icon: '⚡', power: 1.4, acc: 95, stat: 'matk', target: 'enemy',
        status: { key: 'stun', chance: 25, turns: 1 }, desc: '번개를 내리꽂는다.' },
      { name: '섬광 연타', icon: '💫', power: 0.72, acc: 100, stat: 'atk', target: 'enemy', hits: 3,
        desc: '눈으로 좇을 수 없는 3연격.' },
      { name: '전하 방출', icon: '🔌', power: 1.15, acc: 95, stat: 'matk', target: 'enemyAll',
        status: { key: 'stun', chance: 20, turns: 1 }, desc: '주변으로 전류를 흘린다.' },
    ],
    s2: [
      { name: '뇌속 가속', icon: '💨', power: 0, acc: 100, stat: 'atk', target: 'self',
        status: { key: 'haste', chance: 100, turns: 3, value: 0.35 }, desc: '자신을 가속시켜 턴을 앞당긴다.' },
      { name: '벼락 낙하', icon: '🌩', power: 2.3, acc: 85, stat: 'matk', target: 'enemy',
        status: { key: 'stun', chance: 55, turns: 1 }, desc: '하늘에서 벼락을 떨군다.' },
      { name: '폭풍 충전', icon: '🔋', power: 0, acc: 100, stat: 'matk', target: 'selfAll',
        status: { key: 'haste', chance: 100, turns: 2, value: 0.25 }, desc: '아군 전체를 가속시킨다.' },
    ],
    ult: [
      { name: '천벌의 뇌창', icon: '🌩️', power: 3.6, acc: 100, stat: 'matk', target: 'enemy',
        status: { key: 'stun', chance: 100, turns: 1 }, desc: '단일 대상에게 최대 화력.' },
      { name: '뇌신 강림', icon: '⛈', power: 2.7, acc: 100, stat: 'matk', target: 'enemyAll',
        status: { key: 'stun', chance: 55, turns: 1 }, desc: '전장에 벼락을 퍼붓는다.' },
    ],
  },
  mystic: {
    /* 회복형이지만 공격 수단이 없으면 안 된다. 스스로를 계속 치유하기만
       하는 적은 잡을 수가 없고, 아군으로 데려가도 자리만 차지한다. */
    s1: [
      { name: '심판의 빛줄기', icon: '✨', power: 1.35, acc: 95, stat: 'matk', target: 'enemy',
        desc: '신성한 빛으로 꿰뚫는다.' },
      { name: '정신 붕괴', icon: '🌀', power: 1.28, acc: 92, stat: 'matk', target: 'enemy',
        status: { key: 'atkDown', chance: 60, turns: 2, value: 0.25 }, desc: '정신을 흔들어 힘을 뺀다.' },
      { name: '별빛 화살', icon: '🌠', power: 0.8, acc: 100, stat: 'matk', target: 'enemy', hits: 2,
        desc: '별빛을 모아 두 번 쏜다.' },
    ],
    s2: [
      { name: '생명의 순환', icon: '💚', power: 0, acc: 100, stat: 'matk', target: 'selfAll', heal: 0.55,
        status: { key: 'regen', chance: 100, turns: 3, value: 0.07 }, desc: '아군 전체를 회복하고 재생을 준다.' },
      { name: '마력 정화', icon: '🕊', power: 0, acc: 100, stat: 'matk', target: 'selfAll', heal: 0.4,
        status: { key: 'shield', chance: 100, turns: 2, value: 0.22 }, desc: '아군을 치유하고 감싼다.' },
      { name: '운명 왜곡', icon: '🔮', power: 1.9, acc: 88, stat: 'matk', target: 'enemyAll',
        status: { key: 'blind', chance: 65, turns: 2, value: 0.3 }, desc: '적의 운을 비틀어 놓는다.' },
    ],
    ult: [
      { name: '창세의 축복', icon: '🌟', power: 0, acc: 100, stat: 'matk', target: 'selfAll', heal: 1.3,
        status: { key: 'regen', chance: 100, turns: 3, value: 0.1 }, desc: '아군 전체를 크게 되살린다.' },
      { name: '종말의 예언', icon: '📜', power: 3.1, acc: 100, stat: 'matk', target: 'enemyAll',
        status: { key: 'atkDown', chance: 100, turns: 3, value: 0.3 }, desc: '끝을 선언해 전체를 꺾는다.' },
    ],
  },
  wind: {
    s1: [
      { name: '질풍 참격', icon: '🌪️', power: 1.35, acc: 100, stat: 'atk', target: 'enemy', hits: 2,
        desc: '바람을 타고 2연속 벤다. 절대 빗나가지 않는다.' },
      { name: '칼바람', icon: '🍃', power: 1.48, acc: 96, stat: 'atk', target: 'enemy',
        status: { key: 'blind', chance: 40, turns: 2, value: 0.22 }, desc: '바람날로 눈을 스친다.' },
      { name: '활공 강타', icon: '🕊', power: 1.55, acc: 90, stat: 'atk', target: 'enemy',
        desc: '높이 올라 내리꽂는다.' },
    ],
    s2: [
      { name: '폭풍의 눈', icon: '🍃', power: 1.2, acc: 92, stat: 'atk', target: 'enemyAll',
        status: { key: 'blind', chance: 60, turns: 2, value: 0.3 }, desc: '모래바람으로 시야를 빼앗는다.' },
      { name: '상승 기류', icon: '🎐', power: 0, acc: 100, stat: 'atk', target: 'selfAll',
        status: { key: 'haste', chance: 100, turns: 3, value: 0.3 }, desc: '아군을 띄워 속도를 올린다.' },
      { name: '회오리 감옥', icon: '🌀', power: 1.95, acc: 88, stat: 'atk', target: 'enemy', hits: 2,
        status: { key: 'defDown', chance: 60, turns: 2, value: 0.24 }, desc: '회오리에 가둬 두 번 찢는다.' },
    ],
    ult: [
      { name: '천공 폭풍', icon: '🌀', power: 1.5, acc: 100, stat: 'atk', target: 'enemyAll', hits: 3,
        desc: '전체를 3번 휩쓴다.' },
      { name: '창천의 칼날', icon: '🗡', power: 4.0, acc: 100, stat: 'atk', target: 'enemy',
        desc: '하늘이 벼려낸 한 칼.' },
    ],
  },
  dark: {
    s1: [
      { name: '잠식', icon: '🌑', power: 1.45, acc: 90, stat: 'matk', target: 'enemy', drain: 0.4,
        desc: '피해의 40%를 흡혈한다.' },
      { name: '그림자 손톱', icon: '🖤', power: 1.5, acc: 93, stat: 'atk', target: 'enemy',
        status: { key: 'blind', chance: 45, turns: 2, value: 0.25 }, desc: '어둠이 시야를 덮는다.' },
      { name: '공포 각인', icon: '👁', power: 1.25, acc: 95, stat: 'matk', target: 'enemy',
        status: { key: 'atkDown', chance: 65, turns: 2, value: 0.28 }, desc: '공포로 손을 떨게 만든다.' },
    ],
    s2: [
      { name: '저주의 낙인', icon: '💀', power: 1.1, acc: 88, stat: 'matk', target: 'enemy',
        status: { key: 'atkDown', chance: 90, turns: 3, value: 0.3 }, desc: '적의 힘을 뿌리째 꺾는다.' },
      { name: '어둠의 파도', icon: '🌊', power: 1.9, acc: 88, stat: 'matk', target: 'enemyAll', drain: 0.25,
        desc: '검은 파도가 전체를 삼킨다.' },
      { name: '생명 갈취', icon: '🩸', power: 2.1, acc: 85, stat: 'matk', target: 'enemy', drain: 0.55,
        desc: '생명을 뽑아 자신을 채운다.' },
    ],
    ult: [
      { name: '심연의 포옹', icon: '🕳️', power: 3.2, acc: 100, stat: 'matk', target: 'enemy', drain: 0.6,
        desc: '피해의 60%를 흡수한다.' },
      { name: '무명의 밤', icon: '🌘', power: 2.6, acc: 100, stat: 'matk', target: 'enemyAll',
        status: { key: 'blind', chance: 100, turns: 3, value: 0.35 }, desc: '전장에서 빛을 지운다.' },
    ],
  },
  light: {
    s1: [
      { name: '성광 강타', icon: '☀️', power: 1.5, acc: 95, stat: 'atk', target: 'enemy',
        desc: '빛을 실어 내려친다. 군더더기 없는 한 방.' },
      { name: '심판의 창', icon: '🔱', power: 1.42, acc: 96, stat: 'matk', target: 'enemy',
        status: { key: 'defDown', chance: 50, turns: 2, value: 0.24 }, desc: '빛의 창이 방어를 꿰뚫는다.' },
      { name: '축복의 일격', icon: '🤍', power: 1.3, acc: 98, stat: 'atk', target: 'enemy', heal: 0.2,
        desc: '때리면서 아군을 조금 되살린다.' },
    ],
    s2: [
      { name: '수호의 서약', icon: '🔰', power: 0, acc: 100, stat: 'matk', target: 'selfAll', heal: 0.35,
        status: { key: 'shield', chance: 100, turns: 2, value: 0.2 }, desc: '아군을 회복하고 보호막을 준다.' },
      { name: '광휘 폭발', icon: '💡', power: 2.15, acc: 88, stat: 'matk', target: 'enemyAll',
        status: { key: 'blind', chance: 55, turns: 2, value: 0.28 }, desc: '터지는 빛이 눈을 태운다.' },
      { name: '성역 선포', icon: '⛪', power: 0, acc: 100, stat: 'atk', target: 'selfAll', heal: 0.45,
        status: { key: 'regen', chance: 100, turns: 3, value: 0.06 }, desc: '성역을 펼쳐 아군을 지킨다.' },
    ],
    ult: [
      { name: '여명의 심판', icon: '🌅', power: 3.1, acc: 100, stat: 'atk', target: 'enemyAll', heal: 0.3,
        desc: '전체를 심판하고 아군을 회복한다.' },
      { name: '천상의 재림', icon: '👼', power: 2.5, acc: 100, stat: 'atk', target: 'enemyAll', heal: 0.9,
        status: { key: 'shield', chance: 100, turns: 3, value: 0.25 }, desc: '빛이 아군을 되살리고 적을 태운다.' },
    ],
  },
}

/* 등급이 높을수록 스킬 배율이 조금 더 붙는다 */
const RARITY_POWER = { common: 1.0, rare: 1.06, epic: 1.13, legend: 1.22 }

/* 결정적 해시 — id만 같으면 언제 불러도 같은 스킬셋이 나온다 */
function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shape(base, dragon, slot, seed) {
  const rp = RARITY_POWER[dragon.rarity] ?? 1
  /* 같은 조합이라도 개체마다 ±8% 흔든다 */
  const varia = 0.92 + ((seed >>> 5) % 17) / 100
  const out = {
    ...base,
    id: `${dragon.id}_${slot}`,
    kind: slot,
    turn: slot === 's1' ? 'odd' : slot === 's2' ? 'even' : null,
    cd: slot === 'ult' ? ULT_COOLDOWN : 0,
  }
  if (base.power) out.power = Number((base.power * rp * varia).toFixed(3))
  if (base.heal) out.heal = Number((base.heal * rp * varia).toFixed(3))
  return out
}

/* 드래곤의 고유 스킬셋 — { s1, s2, ult, passive } */
export function skillsetOf(dragon) {
  const pool = POOLS[dragon.element] || POOLS.fire
  const h = hash32(dragon.id)
  const s1 = shape(pool.s1[h % pool.s1.length], dragon, 's1', h)
  const s2 = shape(pool.s2[(h >>> 3) % pool.s2.length], dragon, 's2', h >>> 3)
  const ult = shape(pool.ult[(h >>> 7) % pool.ult.length], dragon, 'ult', h >>> 7)
  const passive = PASSIVES[(h >>> 11) % PASSIVES.length]
  return { s1, s2, ult, passive }
}

/* 전투 화면에 늘어놓는 순서 */
export function skillsOf(dragon) {
  const set = skillsetOf(dragon)
  return [BASIC_ATTACK, set.s1, set.s2, set.ult]
}

export const passiveOf = (dragon) => skillsetOf(dragon).passive
export const ultOf = (dragon) => skillsetOf(dragon).ult
export const isUlt = (skill) => skill.kind === 'ult'

/* 이번 라운드에 이 스킬이 열려 있는가 (홀/짝) */
export function turnOpen(skill, round) {
  if (!skill.turn) return true
  return skill.turn === 'odd' ? round % 2 === 1 : round % 2 === 0
}

/* 패시브 수치 조회 — battle.js 가 쓴다 */
export function passiveEffect(unit, effect) {
  const p = unit?.passive
  if (!p || p.effect !== effect) return 0
  return p.value
}
export const passiveDesc = (p) => (p ? p.desc(p.value) : '')
