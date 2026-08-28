/* ==================================================================
   배치

   지대마다 자원 밀도는 고정, 위치만 시드 난수다. "이 시드는 고철이
   많다"가 아니라 "이 시드는 고철이 저기 있다"가 되어야 스피드런
   비교가 성립한다.

   자원 노드는 캐면 사라지고 다시 안 난다(묘목 제외). 그래서 지대를
   넓혀 갈 수밖에 없고, 그건 곧 불을 키울 수밖에 없다는 뜻이다.
   후반의 고철 병목은 §7.4 잔해 채취가 푼다.
   ================================================================== */
import { BALANCE, ZONES, CACHES, CACHE_CONF, CREW } from '../data/index.ts'
import type { GameState, JunkNode, FuelNode, Lab, Cache, Outpost, SalvageNode } from '../core/GameState.ts'
import { nextId } from '../core/GameState.ts'
import { CENTER, TILES, distanceFromCenter } from './Tilemap.ts'
import type { Rng } from '../core/RNG.ts'

type ZonePlan = {
  zone: number
  smallTrees: number
  largeTrees: number
  junk: { item: string; count: number }[]
  fuel: { item: string; count: number }[]
  salvage: number
}

/* 여기 숫자가 곧 "99일 안에 목표 자원이 모이는가"를 정한다.
   §부록B 가 검증하라고 지목한 부분이라 테스트에서 총량을 잰다. */
export const ZONE_PLANS: ZonePlan[] = [
  {
    zone: 1, smallTrees: 54, largeTrees: 4, salvage: 0,
    junk: [
      { item: 'junk_screw', count: 30 },
      { item: 'junk_fan', count: 14 },
      { item: 'junk_mouse', count: 14 },
    ],
    fuel: [],
  },
  {
    zone: 2, smallTrees: 62, largeTrees: 26, salvage: 3,
    junk: [
      { item: 'junk_mouse', count: 16 },
      { item: 'junk_tire', count: 24 },
      { item: 'junk_laptop', count: 24 },
    ],
    fuel: [{ item: 'coal', count: 34 }],
  },
  {
    zone: 3, smallTrees: 46, largeTrees: 32, salvage: 2,
    junk: [
      { item: 'junk_fridge', count: 24 },
      { item: 'junk_engine', count: 24 },
    ],
    fuel: [{ item: 'oildrum', count: 20 }],
  },
  {
    zone: 4, smallTrees: 30, largeTrees: 28, salvage: 1,
    junk: [
      { item: 'junk_fridge', count: 18 },
      { item: 'junk_engine', count: 22 },
    ],
    fuel: [{ item: 'gastank', count: 18 }],
  },
  {
    zone: 5, smallTrees: 20, largeTrees: 22, salvage: 1,
    junk: [{ item: 'junk_engine', count: 20 }],
    fuel: [{ item: 'gastank', count: 22 }],
  },
]

/** 고리 안의 아무 자리. 본선 바로 옆은 비워 둔다. */
function pointInRing(rng: Rng, inner: number, outer: number): { x: number; z: number } {
  const capped = Math.min(outer, TILES / 2 - 5)
  for (let tries = 0; tries < 40; tries++) {
    const a = rng() * Math.PI * 2
    /* 반지름을 제곱근으로 뽑아야 고리 안에 고르게 퍼진다. 그냥 뽑으면
       안쪽에 몰려서 바깥 지대가 텅 비어 보인다. */
    const r = Math.sqrt(rng.range(inner * inner, capped * capped))
    const x = CENTER + Math.cos(a) * r
    const z = CENTER + Math.sin(a) * r
    if (x < 4 || z < 4 || x > TILES - 4 || z > TILES - 4) continue
    if (distanceFromCenter(x, z) < 5) continue
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
    const n = (v: number, f: number) => Math.round(v * f)

    for (let i = 0; i < n(plan.smallTrees, resFactor); i++) {
      const p = pointInRing(rng, z.innerRadius, z.outerRadius)
      s.trees.push({ id: nextId(s), kind: 'tree_small', x: p.x, z: p.z, hits: 0, growT: 0 })
    }
    for (let i = 0; i < n(plan.largeTrees, resFactor); i++) {
      const p = pointInRing(rng, z.innerRadius, z.outerRadius)
      s.trees.push({ id: nextId(s), kind: 'tree_large', x: p.x, z: p.z, hits: 0, growT: 0 })
    }
    for (const j of plan.junk) {
      for (let i = 0; i < n(j.count, resFactor * scrapFactor); i++) {
        const p = pointInRing(rng, z.innerRadius, z.outerRadius)
        const node: JunkNode = { id: nextId(s), x: p.x, z: p.z, item: j.item }
        s.junk.push(node)
      }
    }
    for (const f of plan.fuel) {
      for (let i = 0; i < n(f.count, resFactor); i++) {
        const p = pointInRing(rng, z.innerRadius, z.outerRadius)
        const node: FuelNode = { id: nextId(s), x: p.x, z: p.z, item: f.item }
        s.fuelNodes.push(node)
      }
    }
    for (let i = 0; i < plan.salvage; i++) {
      const p = pointInRing(rng, z.innerRadius, z.outerRadius)
      const node: SalvageNode = { id: nextId(s), x: p.x, z: p.z }
      s.salvageNodes.push(node)
    }
  }

  /* 연구소 넷 — 대원이 갇힌 곳(§12.1). 지대가 정해져 있다. */
  const labZones: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5 }
  for (const crew of CREW) {
    const zoneId = labZones[crew.labTier]
    const z = ZONES.find((zz) => zz.id === zoneId)!
    const outer = Math.min(z.outerRadius, 110)
    const p = pointInRing(rng, z.innerRadius + 3, outer - 3)
    const lab: Lab = {
      id: nextId(s),
      tier: crew.labTier as 1 | 2 | 3 | 4,
      x: p.x,
      z: p.z,
      cleared: false,
      crew: crew.id,
      core: crew.core,
    }
    s.labs.push(lab)
  }

  /* 보급함 — 등급마다 필요한 불 레벨이 다르다(§9).
     낮은 등급은 안쪽에, 높은 등급은 바깥에 둔다. 그래야 "불을 키워야
     더 좋은 상자를 연다"가 거리로도 느껴진다. */
  const cacheCounts: Record<string, number> = {
    common: 14, precision: 11, military: 9, legendary: 7, gold: 5,
  }
  for (const tier of CACHES) {
    if (tier.id === 'red') continue
    const count = cacheCounts[tier.id] ?? 6
    const zoneId = Math.min(5, Math.max(1, tier.fireLevel - 1))
    const z = ZONES.find((zz) => zz.id === zoneId)!
    for (let i = 0; i < count; i++) {
      const p = pointInRing(rng, z.innerRadius, Math.min(z.outerRadius, 115))
      const c: Cache = { id: nextId(s), x: p.x, z: p.z, tier: tier.id, opened: false }
      s.caches.push(c)
    }
  }

  /* 적색 보급함 — 맵 전체에 딱 둘(§9). 확정 운석 파편. */
  for (let i = 0; i < CACHE_CONF.redCacheCount; i++) {
    const p = pointInRing(rng, 30, 115)
    const c: Cache = { id: nextId(s), x: p.x, z: p.z, tier: 'red', opened: false }
    s.caches.push(c)
  }

  /* 약탈자 전초기지 — 3지대와 5지대에 하나씩. 클리어하면 적색 보급함. */
  for (const zoneId of [3, 5]) {
    const z = ZONES.find((zz) => zz.id === zoneId)!
    const p = pointInRing(rng, z.innerRadius + 4, Math.min(z.outerRadius, 112) - 4)
    const o: Outpost = { id: nextId(s), x: p.x, z: p.z, cleared: false }
    s.outposts.push(o)
  }
}

export function makeSapling(s: GameState, x: number, z: number) {
  return {
    id: nextId(s),
    kind: 'sapling' as const,
    x,
    z,
    hits: 0,
    growT: BALANCE.decay.saplingGrowSeconds,
  }
}
