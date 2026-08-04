/* ==================================================================
   스킬 — 속성별 스킬 + 궁극기 (순수 데이터/로직)

   기획서 5.2:
     · 기본 스킬 (모든 드래곤 보유, MP 0)
     · 속성 스킬 (8속성별)
     · 궁극기 (MP 100 — 매 턴 15씩 차오른다)
     · MP 0~100 · 쿨타임 2~5턴 · 명중률 70~100% · 크리티컬 기본 5%
   ================================================================== */

export const MP_MAX = 100
export const MP_PER_TURN = 15          // 매 턴 자동 충전 (기획서 확정)
export const BASE_CRIT = 5             // 기본 크리티컬 5%
export const CRIT_MUL = 1.6

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

/* 모든 드래곤 공통 — MP를 벌기 위한 기본 공격 */
export const BASIC_ATTACK = {
  id: 'basic', name: '기본 공격', icon: '⚔',
  mp: 0, cd: 0, power: 1.0, acc: 95, stat: 'atk', target: 'enemy',
  desc: '기본 물리 공격. MP를 소모하지 않는다.',
}

/* 속성별 스킬 2개 + 궁극기 1개.
   power = 공격 스탯에 곱하는 배율, stat = 어떤 공격 스탯을 쓰는가 */
export const ELEMENT_SKILLS = {
  fire: {
    skills: [
      { id: 'fire1', name: '화염 발톱', icon: '🔥', mp: 20, cd: 0, power: 1.45, acc: 95, stat: 'atk',
        target: 'enemy', status: { key: 'burn', chance: 60, turns: 2, value: 0.06 },
        desc: '불붙은 발톱으로 할퀸다. 60% 확률로 화상.' },
      { id: 'fire2', name: '작열 브레스', icon: '☄️', mp: 45, cd: 3, power: 2.1, acc: 85, stat: 'matk',
        target: 'enemyAll', status: { key: 'burn', chance: 40, turns: 2, value: 0.05 },
        desc: '전체를 태우는 화염 브레스.' },
    ],
    ult: { id: 'fireU', name: '멸화의 숨결', icon: '🌋', mp: 100, cd: 0, power: 3.4, acc: 100, stat: 'matk',
      target: 'enemyAll', status: { key: 'burn', chance: 100, turns: 3, value: 0.08 },
      desc: '궁극기 — 전장을 불바다로. 반드시 화상.' },
  },
  ice: {
    skills: [
      { id: 'ice1', name: '서리 송곳', icon: '❄️', mp: 20, cd: 0, power: 1.4, acc: 95, stat: 'matk',
        target: 'enemy', status: { key: 'freeze', chance: 30, turns: 1 },
        desc: '얼음 창을 던진다. 30% 확률로 빙결.' },
      { id: 'ice2', name: '절대영도', icon: '🧊', mp: 50, cd: 4, power: 1.6, acc: 80, stat: 'matk',
        target: 'enemy', status: { key: 'freeze', chance: 85, turns: 2 },
        desc: '대상을 얼려 행동을 봉인한다.' },
    ],
    ult: { id: 'iceU', name: '영겁의 빙하', icon: '🏔️', mp: 100, cd: 0, power: 2.9, acc: 100, stat: 'matk',
      target: 'enemyAll', status: { key: 'freeze', chance: 60, turns: 1 },
      desc: '궁극기 — 전장을 얼려붙인다.' },
  },
  earth: {
    skills: [
      { id: 'earth1', name: '암석 강타', icon: '🪨', mp: 18, cd: 0, power: 1.5, acc: 90, stat: 'atk',
        target: 'enemy', status: { key: 'defDown', chance: 50, turns: 2, value: 0.25 },
        desc: '바위로 내려찍어 방어를 무너뜨린다.' },
      { id: 'earth2', name: '대지의 수호', icon: '🛡️', mp: 35, cd: 3, power: 0, acc: 100, stat: 'atk',
        target: 'selfAll', status: { key: 'shield', chance: 100, turns: 3, value: 0.28 },
        desc: '아군 전체에 보호막을 두른다.' },
    ],
    ult: { id: 'earthU', name: '지각 붕괴', icon: '⛰️', mp: 100, cd: 0, power: 3.0, acc: 100, stat: 'atk',
      target: 'enemyAll', status: { key: 'defDown', chance: 100, turns: 3, value: 0.3 },
      desc: '궁극기 — 대지를 무너뜨려 전체를 짓누른다.' },
  },
  thunder: {
    skills: [
      { id: 'th1', name: '전격', icon: '⚡', mp: 18, cd: 0, power: 1.4, acc: 95, stat: 'matk',
        target: 'enemy', status: { key: 'stun', chance: 25, turns: 1 },
        desc: '번개를 내리꽂는다. 25% 확률로 감전.' },
      { id: 'th2', name: '뇌속 가속', icon: '💨', mp: 30, cd: 3, power: 0.9, acc: 100, stat: 'atk',
        target: 'self', status: { key: 'haste', chance: 100, turns: 3, value: 0.35 },
        desc: '자신을 가속시켜 턴을 앞당긴다.' },
    ],
    ult: { id: 'thU', name: '천벌의 뇌창', icon: '🌩️', mp: 100, cd: 0, power: 3.6, acc: 100, stat: 'matk',
      target: 'enemy', status: { key: 'stun', chance: 100, turns: 1 },
      desc: '궁극기 — 단일 대상에게 최대 화력. 반드시 감전.' },
  },
  mystic: {
    /* 회복형이지만 공격 수단이 아예 없으면 안 된다.
       스스로를 계속 치유하기만 하는 적은 잡을 수가 없고,
       아군으로 데려가도 피해량이 0이라 자리만 차지한다.
       그래서 1번은 "회복 겸 공격"으로 둔다. */
    skills: [
      { id: 'my1', name: '심판의 빛줄기', icon: '✨', mp: 22, cd: 0, power: 1.35, acc: 95, stat: 'matk',
        target: 'enemy', desc: '신성한 빛으로 꿰뚫는다.' },
      { id: 'my2', name: '생명의 순환', icon: '💚', mp: 40, cd: 3, power: 0, acc: 100, stat: 'matk',
        target: 'selfAll', heal: 0.55, status: { key: 'regen', chance: 100, turns: 3, value: 0.07 },
        desc: '아군 전체를 회복하고 재생을 부여한다.' },
    ],
    ult: { id: 'myU', name: '창세의 축복', icon: '🌟', mp: 100, cd: 0, power: 0, acc: 100, stat: 'matk',
      target: 'selfAll', heal: 1.3, status: { key: 'regen', chance: 100, turns: 3, value: 0.1 },
      desc: '궁극기 — 아군 전체를 크게 되살린다.' },
  },
  wind: {
    skills: [
      { id: 'wi1', name: '질풍 참격', icon: '🌪️', mp: 18, cd: 0, power: 1.35, acc: 100, stat: 'atk',
        target: 'enemy', hits: 2, desc: '바람을 타고 2연속 벤다. 절대 빗나가지 않는다.' },
      { id: 'wi2', name: '폭풍의 눈', icon: '🍃', mp: 35, cd: 3, power: 1.2, acc: 90, stat: 'atk',
        target: 'enemyAll', status: { key: 'blind', chance: 60, turns: 2, value: 0.3 },
        desc: '모래바람으로 시야를 빼앗는다.' },
    ],
    ult: { id: 'wiU', name: '천공 폭풍', icon: '🌀', mp: 100, cd: 0, power: 1.5, acc: 100, stat: 'atk',
      target: 'enemyAll', hits: 3, desc: '궁극기 — 전체를 3번 휩쓴다.' },
  },
  dark: {
    skills: [
      { id: 'da1', name: '잠식', icon: '🌑', mp: 22, cd: 0, power: 1.45, acc: 90, stat: 'matk',
        target: 'enemy', drain: 0.4, desc: '피해의 40%를 흡혈한다.' },
      { id: 'da2', name: '저주의 낙인', icon: '💀', mp: 38, cd: 3, power: 1.1, acc: 85, stat: 'matk',
        target: 'enemy', status: { key: 'atkDown', chance: 90, turns: 3, value: 0.3 },
        desc: '적의 힘을 뿌리째 꺾는다.' },
    ],
    ult: { id: 'daU', name: '심연의 포옹', icon: '🕳️', mp: 100, cd: 0, power: 3.2, acc: 100, stat: 'matk',
      target: 'enemy', drain: 0.6, desc: '궁극기 — 피해의 60%를 흡수한다.' },
  },
  light: {
    skills: [
      { id: 'li1', name: '성광 강타', icon: '☀️', mp: 20, cd: 0, power: 1.5, acc: 95, stat: 'atk',
        target: 'enemy', desc: '빛을 실어 내려친다. 군더더기 없는 한 방.' },
      { id: 'li2', name: '수호의 서약', icon: '🔰', mp: 35, cd: 3, power: 0, acc: 100, stat: 'matk',
        target: 'selfAll', heal: 0.35, status: { key: 'shield', chance: 100, turns: 2, value: 0.2 },
        desc: '아군을 회복하고 보호막을 준다.' },
    ],
    ult: { id: 'liU', name: '여명의 심판', icon: '🌅', mp: 100, cd: 0, power: 3.1, acc: 100, stat: 'atk',
      target: 'enemyAll', heal: 0.3, desc: '궁극기 — 전체를 심판하고 아군을 회복한다.' },
  },
}

/* 드래곤 한 마리가 실제로 쓰는 스킬 목록 (기본 + 속성 2 + 궁극기) */
export function skillsOf(dragon) {
  const set = ELEMENT_SKILLS[dragon.element] || ELEMENT_SKILLS.fire
  return [BASIC_ATTACK, ...set.skills, set.ult]
}
export const ultOf = (dragon) => (ELEMENT_SKILLS[dragon.element] || ELEMENT_SKILLS.fire).ult
export const isUlt = (skill) => skill.mp >= MP_MAX
