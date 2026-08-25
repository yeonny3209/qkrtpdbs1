/* ==================================================================
   배치

   존마다 자원 밀도는 고정, 위치만 시드 난수다(§6.3). "이 시드는
   고철이 많다"가 아니라 "이 시드는 고철이 저기 있다"가 되어야
   스피드런 비교가 성립한다.

   자원 노드는 캐면 사라지고 다시 안 난다. 묘목만 예외다. 그래서
   플레이어는 존을 넓혀 갈 수밖에 없고, 그게 이 게임의 압박이다.
   ================================================================== */
import { BALANCE, ZONES } from '../data/index.ts'
import type { GameState, Harvestable, JunkNode, FuelNode, Lab, Armory } from '../core/GameState.ts'
import { nextId } from '../core/GameState.ts'
import { CENTER, TILES, distanceFromCenter } from './Tilemap.ts'
import type { Rng } from '../core/RNG.ts'

/* 존별 배치표. 여기 숫자가 곧 "낮 3분에 얼마나 모이는가"를 정한다.
   §부록B-2 가 검증하라고 지목한 부분이라, 테스트에서 총량을 잰다. */
type ZonePlan = {
  zone: number
  smallTrees: number
  largeTrees: number
  junk: { item: string; count: number }[]
  fuel: { item: string; count: number }[]
}

export const ZONE_PLANS: ZonePlan[] = [
  {
    zone: 1,
    smallTrees: 46,
    largeTrees: 4,
    junk: [
      { item: 'junk_screw', count: 26 },
      { item: 'junk_fan', count: 12 },
      { item: 'junk_mouse', count: 12 },
    ],
    fuel: [],
  },
  {
    zone: 2,
    smallTrees: 58,
    largeTrees: 26,
    junk: [
      { item: 'junk_mouse', count: 14 },
      { item: 'junk_tire', count: 22 },
      { item: 'junk_laptop', count: 22 },
    ],
    fuel: [{ item: 'coal', count: 26 }],
  },
  {
    zone: 3,
    smallTrees: 40,
    largeTrees: 34,
    junk: [
      { item: 'junk_fridge', count: 22 },
      { item: 'junk_engine', count: 22 },
    ],
    fuel: [{ item: 'oil_drum', count: 14 }],
  },
  {
    zone: 4,
    smallTrees: 22,
    largeTrees: 26,
    junk: [
      { item: 'junk_fridge', count: 16 },
      { item: 'junk_engine', count: 20 },
    ],
    fuel: [{ item: 'gas_tank', count: 12 }],
  },
]

/** 링 안의 아무 자리. 우주선 바로 옆은 비워 둔다. */
function pointInRing(rng: Rng, inner: number, outer: number): { x: number; z: number } {
  const capped = Math.min(outer, TILES / 2 - 4)
  for (let tries = 0; tries < 40; tries++) {
    const a = rng() * Math.PI * 2
    /* 반지름을 제곱근으로 뽑아야 고리 안에 고르게 퍼진다. 그냥 뽑으면
       안쪽에 몰려서 바깥 존이 텅 비어 보인다. */
    const r = Math.sqrt(rng.range(inner * inner, capped * capped))
    const x = CENTER + Math.cos(a) * r
    const z = CENTER + Math.sin(a) * r
    if (x < 3 || z < 3 || x > TILES - 3 || z > TILES - 3) continue
    if (distanceFromCenter(x, z) < 4) continue
    return { x, z }
  }
  return { x: CENTER + inner + 1, z: CENTER }
}

export function populate(s: GameState): void {
  const rng = s.streams.map
  const mods = s.modifier.effects
  const resFactor = mods.resourceSpawnFactor ?? 1
  const scrapFactor = mods.scrapSpawnFactor ?? 1

  for (const plan of ZONE_PLANS) {
    const z = ZONES.find((zz) => zz.id === plan.zone)!
    const scaled = (n: number, f: number) => Math.round(n * f)

    for (let i = 0; i < scaled(plan.smallTrees, resFactor); i++) {
      const p = pointInRing(rng, z.innerRadius, z.outerRadius)
      s.trees.push(mkTree(s, 'tree_small', p.x, p.z))
    }
    for (let i = 0; i < scaled(plan.largeTrees, resFactor); i++) {
      const p = pointInRing(rng, z.innerRadius, z.outerRadius)
      s.trees.push(mkTree(s, 'tree_large', p.x, p.z))
    }
    for (const j of plan.junk) {
      for (let i = 0; i < scaled(j.count, resFactor * scrapFactor); i++) {
        const p = pointInRing(rng, z.innerRadius, z.outerRadius)
        const node: JunkNode = { id: nextId(s), x: p.x, z: p.z, item: j.item }
        s.junk.push(node)
      }
    }
    for (const f of plan.fuel) {
      for (let i = 0; i < scaled(f.count, resFactor); i++) {
        const p = pointInRing(rng, z.innerRadius, z.outerRadius)
        const grade = (BALANCE.fuel as Record<string, { grade: number }>)[f.item].grade
        const node: FuelNode = { id: nextId(s), x: p.x, z: p.z, item: f.item, grade }
        s.fuelNodes.push(node)
      }
    }
  }

  /* 연구소 넷. 단계마다 정해진 존에 하나씩(§6.3). */
  const labPlan: { tier: 1 | 2 | 3 | 4; zone: number; reward: string }[] = [
    { tier: 1, zone: 2, reward: 'core_radar' },
    { tier: 2, zone: 2, reward: 'core_landing' },
    { tier: 3, zone: 3, reward: 'core_launch' },
    { tier: 4, zone: 4, reward: 'core_fuel' },
  ]
  for (const lp of labPlan) {
    const z = ZONES.find((zz) => zz.id === lp.zone)!
    const p = pointInRing(rng, z.innerRadius + 3, Math.min(z.outerRadius, 88) - 3)
    const lab: Lab = { id: nextId(s), tier: lp.tier, x: p.x, z: p.z, cleared: false, reward: lp.reward }
    s.labs.push(lab)
  }

  /* 무기고 2~3개, 3존에. 호랑이가 도는 자리이기도 하다. */
  const z3 = ZONES.find((zz) => zz.id === 3)!
  const armories = 2 + rng.int(2)
  for (let i = 0; i < armories; i++) {
    const p = pointInRing(rng, z3.innerRadius + 2, z3.outerRadius - 2)
    const a: Armory = { id: nextId(s), x: p.x, z: p.z, opened: false }
    s.armories.push(a)
  }
}

function mkTree(s: GameState, kind: 'tree_small' | 'tree_large', x: number, z: number): Harvestable {
  return { id: nextId(s), kind, x, z, hits: 0, growT: 0 }
}

export function makeSapling(s: GameState, x: number, z: number): Harvestable {
  return {
    id: nextId(s),
    kind: 'sapling',
    x,
    z,
    hits: 0,
    growT: BALANCE.decay.saplingGrowSeconds,
  }
}
