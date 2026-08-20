/* ==================================================================
   난이도 다섯 단계

   같은 판을 얼마나 험하게 굴릴지 하나의 표로 모아 둔다. 여기저기
   흩어 두면 "고급이 중급보다 정말 어려운가"를 확인할 방법이 없다.
   한곳에 모아 두면 표만 보고도 서로의 관계가 읽히고, 테스트도
   단계 사이의 순서를 그대로 검사할 수 있다.

   손대는 것은 다섯 가지다.
     hp       적이 얼마나 단단한가
     damage   한 대가 얼마나 아픈가
     speed    얼마나 빨리 오는가
     accuracy 원거리 적이 얼마나 잘 맞히는가
     count    한 웨이브에 몇이 오는가
     regen    플레이어 회복이 얼마나 빠른가 (0 이면 회복 없음)

   난이도를 올릴 때 속도를 크게 건드리지 않는 것이 중요하다. 적이
   플레이어보다 빨라지는 순간 "물러나며 쏘기"가 통하지 않게 되는데,
   그건 어려워지는 게 아니라 대응할 방법이 사라지는 것이다. 그래서
   속도만은 아래 clampSpeedScale 로 천장을 강제한다.
   ================================================================== */
import { ENEMY_TYPES } from './enemies.js'
import { PLAYER } from './player.js'

export const DIFFICULTIES = [
  {
    id: 'novice',
    name: '초급',
    tag: '처음이라면',
    desc: '적이 무르고 느리게 온다. 조작과 무기를 익히기 좋다.',
    color: '#7CFFB2',
    hp: 0.65, damage: 0.55, speed: 0.88, accuracy: 0.6, count: 0.65, regen: 1.6,
  },
  {
    id: 'normal',
    name: '중급',
    tag: '기준',
    desc: '설계된 그대로. 다른 단계는 전부 여기서 재고 뺀 것이다.',
    color: '#7fd4ff',
    hp: 1, damage: 1, speed: 1, accuracy: 1, count: 1, regen: 1,
  },
  {
    id: 'expert',
    name: '고급',
    tag: '익숙해졌다면',
    desc: '더 단단하고 더 많이 온다. 엄폐물과 높은 자리를 써야 한다.',
    color: '#ffd166',
    hp: 1.35, damage: 1.3, speed: 1.04, accuracy: 1.2, count: 1.25, regen: 0.7,
  },
  {
    id: 'extreme',
    name: '익스트림',
    tag: '실수 한 번이 비싸다',
    desc: '한 대가 크게 아프고 회복이 느리다. 물러날 때를 알아야 한다.',
    color: '#ff8a6b',
    hp: 1.85, damage: 1.75, speed: 1.09, accuracy: 1.4, count: 1.5, regen: 0.35,
  },
  {
    id: 'mythic',
    name: '신화',
    tag: '회복 없음',
    desc: '체력이 저절로 차지 않는다. 받은 피해는 그대로 남는다.',
    color: '#e0a3ff',
    hp: 2.6, damage: 2.3, speed: 1.14, accuracy: 1.65, count: 1.8, regen: 0,
  },
]

export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]))
export const DEFAULT_DIFFICULTY = 'normal'

export function getDifficulty(id) {
  return DIFFICULTY_BY_ID[id] || DIFFICULTY_BY_ID[DEFAULT_DIFFICULTY]
}

/* 가장 빠른 적조차 플레이어보다 느리도록 배율에 천장을 씌운다.

   웨이브 배율과 난이도 배율이 곱해지므로, 각각은 얌전해 보여도
   합치면 넘길 수 있다. 그래서 마지막에 한 번 잘라 준다. 여기서
   자르지 않으면 후반 신화에서 크롤러가 플레이어를 따라잡는다. */
const FASTEST = Math.max(...Object.values(ENEMY_TYPES).map((t) => t.speed))
export const SPEED_CEILING = (PLAYER.speed * 0.96) / FASTEST

export function clampSpeedScale(scale) {
  return Math.min(scale, SPEED_CEILING)
}

/* 웨이브 배율과 난이도 배율을 합친 최종 값 */
export function combinedScaling(waveScale, diff) {
  return {
    hp: waveScale.hp * diff.hp,
    speed: clampSpeedScale(waveScale.speed * diff.speed),
    damage: diff.damage,
    accuracy: diff.accuracy,
  }
}
