/* ==================================================================
   스테이지 → 실제 적 편성

   스테이지 데이터(속성·레벨·마릿수·배율)와 난이도를 받아
   전투 엔진에 넘길 유닛 목록을 만든다. 시드를 넣으면 같은 편성이
   재현되므로 테스트가 가능하다.
   ================================================================== */
import { DRAGONS } from './dragons.js'
import { DIFFICULTIES } from './campaign.js'
import { makeRng } from './battle.js'

const RARITY_BY_LEVEL = (lv, boss) => {
  if (boss) return lv >= 70 ? 'legend' : lv >= 40 ? 'epic' : 'rare'
  if (lv >= 60) return 'epic'
  if (lv >= 25) return 'rare'
  return 'common'
}

/* 요청한 속성/등급에 맞는 드래곤을 고른다. 없으면 속성만 맞춘다. */
function pickDragon(rng, element, rarity) {
  const exact = DRAGONS.filter((d) => d.element === element && d.rarity === rarity)
  if (exact.length) return exact[Math.floor(rng() * exact.length)]
  const byEl = DRAGONS.filter((d) => d.element === element)
  if (byEl.length) return byEl[Math.floor(rng() * byEl.length)]
  return DRAGONS[Math.floor(rng() * DRAGONS.length)]
}

/* 적 능력치 배율 — 공격과 방어를 같은 비율로 올리면 안 된다.
   방어가 오르면 내 피해가 줄고, 공격이 오르면 내가 더 맞으므로
   체감 난이도가 배율의 제곱처럼 뛴다. 그래서 "덩치(HP)"를 주로 키우고
   공격·방어는 완만하게만 올린다. */
export function enemyMultipliers(stage, diff) {
  const d = diff.mul - 1                       // 0 / 0.9 / 2.4
  const boss = stage.boss
  /* 초반 완충 — 플레이어는 1장을 드래곤 한 마리로 시작한다.
     동레벨끼리 붙이면 첫 스테이지부터 운으로 지는 일이 생기므로
     조작을 익히는 1~2장은 적을 확실히 약하게 둔다. */
  const early = stage.chapter === 1 ? 0.62 : stage.chapter === 2 ? 0.82 : 1
  return {
    hp: early * (boss ? 1.8 : 1) * (1 + d * 0.80),
    atk: early * (boss ? 1.15 : 1) * (1 + d * 0.35),
    matk: early * (boss ? 1.15 : 1) * (1 + d * 0.35),
    def: (boss ? 1.08 : 1) * (1 + d * 0.20),
    mdef: (boss ? 1.08 : 1) * (1 + d * 0.20),
    agi: (boss ? 1.05 : 1) * (1 + d * 0.15),
  }
}

export function buildEncounter(stage, difficultyId = 'normal', seed = 1, teamSize = 3) {
  const diff = DIFFICULTIES.find((d) => d.id === difficultyId) || DIFFICULTIES[0]
  const rng = makeRng(seed)
  const rarity = RARITY_BY_LEVEL(stage.level, stage.boss)
  const statMul = enemyMultipliers(stage, diff)
  /* 적은 내 편성 인원을 넘지 않는다.
     스타터 한 마리로 시작하는 플레이어가 3대1로 몰리면 이길 방법이 없다.
     보상은 스테이지 고정이라 혼자 깬다고 손해 보지도 않는다. */
  const count = Math.max(1, Math.min(stage.count, teamSize))

  const enemies = Array.from({ length: count }, (_, i) => {
    const element = stage.elements[i % stage.elements.length]
    return {
      dragon: pickDragon(rng, element, rarity),
      level: stage.level,
      evo: stage.boss ? 1 : 0,
      statMul,
    }
  })
  return { enemies, difficulty: diff, rarity }
}

export const stageReward = (stage, difficultyId = 'normal') => {
  const diff = DIFFICULTIES.find((d) => d.id === difficultyId) || DIFFICULTIES[0]
  return {
    exp: Math.round(stage.exp * diff.expMul),
    gold: Math.round(stage.gold * diff.goldMul),
  }
}
