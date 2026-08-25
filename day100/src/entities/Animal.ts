/* ==================================================================
   짐승 넷

   §10.4 의 성격 차이를 행동 하나씩으로 옮겼다. 스탯만 다르면 전부
   "다가와서 문다"가 되어 구분이 안 된다.

     토끼 (flee)   — 다가가면 도망친다. 그래서 덫이 값을 한다
     늑대 (dart)   — 돌진하고 물러나기를 되풀이한다. 무리로 온다
     곰   (charge) — 물러나지 않는다. 느리지만 계속 온다
     호랑이(patrol)— 순찰하다 25타일에서 문다. 5.5 라 도망칠 수 없다

   호랑이가 도망칠 수 없는 게 재미인지 짜증인지는 §부록B-4 가 의심하는
   부분이다. speed 만 JSON 에서 낮추면 성격이 바뀐다.
   ================================================================== */
import { ENEMIES, ZONES } from '../data/index.ts'
import type { GameState, Beast } from '../core/GameState.ts'
import { nextId, distance, addItem, toast } from '../core/GameState.ts'
import { CENTER, TILES, pushOut, type Solid } from '../world/Tilemap.ts'
import { damageSuit } from '../systems/SurvivalSystem.ts'

const ATTACK_REACH = 1.05
const ATTACK_CD = 1.1

export function spawnBeast(s: GameState, type: string, x: number, z: number): Beast {
  const def = ENEMIES[type]
  const b: Beast = {
    id: nextId(s),
    type,
    x,
    z,
    hp: def.hp,
    state: 'idle',
    stateT: 0,
    targetX: x,
    targetZ: z,
    attackCd: 0,
    boundT: 0,
  }
  s.beasts.push(b)
  return b
}

/* 존마다 유지할 마릿수. 낮에 조금씩 채워 넣어서, 사냥으로 비운
   구역이 영영 비어 있지 않게 한다 — 자원 노드와 달리 고기는
   다시 나야 100일을 버틸 수 있다. */
const POPULATION: Record<number, { type: string; cap: number }[]> = {
  1: [{ type: 'rabbit', cap: 14 }],
  2: [{ type: 'wolf', cap: 12 }, { type: 'rabbit', cap: 6 }],
  3: [{ type: 'mutant_wolf', cap: 10 }],
  4: [{ type: 'bear', cap: 7 }, { type: 'tiger', cap: 1 }],
}

export function populateInitial(s: GameState): void {
  for (const [zoneId, plans] of Object.entries(POPULATION)) {
    for (const plan of plans) spawnUpTo(s, Number(zoneId), plan.type, plan.cap)
  }
}

function spawnUpTo(s: GameState, zoneId: number, type: string, cap: number): void {
  const zone = ZONES.find((z) => z.id === zoneId)!
  const rng = s.streams.spawn
  const have = s.beasts.filter((b) => b.type === type).length
  for (let i = have; i < cap; i++) {
    const a = rng() * Math.PI * 2
    const outer = Math.min(zone.outerRadius, TILES / 2 - 6)
    const r = Math.sqrt(rng.range(zone.innerRadius ** 2, outer ** 2))
    const x = CENTER + Math.cos(a) * r
    const z = CENTER + Math.sin(a) * r
    if (x < 3 || z < 3 || x > TILES - 3 || z > TILES - 3) continue
    /* 캠프 안에는 안 넣는다. 아침에 눈뜨니 곰이 서 있으면 억울하다. */
    if (distance(x, z, CENTER, CENTER) < Math.max(10, s.campfire.safeRadius + 2)) continue
    spawnBeast(s, type, x, z)
  }
}

/** 일출마다 조금씩 다시 채운다. 한 번에 다 채우면 아침이 소란스럽다. */
export function repopulate(s: GameState): void {
  for (const [zoneId, plans] of Object.entries(POPULATION)) {
    for (const plan of plans) {
      const have = s.beasts.filter((b) => b.type === plan.type).length
      if (have >= plan.cap) continue
      spawnUpTo(s, Number(zoneId), plan.type, Math.min(plan.cap, have + 2))
    }
  }
}

export function damageBeast(s: GameState, b: Beast, amount: number): boolean {
  b.hp -= amount
  if (b.state === 'idle') {
    b.state = 'chase'
    b.stateT = 0
  }
  if (b.hp <= 0) {
    dropLoot(s, b)
    return true
  }
  return false
}

function dropLoot(s: GameState, b: Beast): void {
  const def = ENEMIES[b.type]
  let lost = 0
  for (const [id, n] of Object.entries(def.drops)) {
    lost += addItem(s, id, n)
  }
  if (lost > 0) toast(s, '가방이 가득 차 일부를 놓쳤습니다', 'warn')
  s.events.push('beastDown')
}

export function updateAll(s: GameState, dt: number, solids: readonly Solid[]): void {
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return
  const p = s.player
  const rng = s.streams.ai
  const alive: Beast[] = []

  for (const b of s.beasts) {
    if (b.hp <= 0) continue
    alive.push(b)
    const def = ENEMIES[b.type]
    b.stateT += dt
    if (b.attackCd > 0) b.attackCd -= dt

    if (b.boundT > 0) {
      b.boundT -= dt
      continue
    }

    const d = distance(b.x, b.z, p.x, p.z)
    const sees = d <= def.senseRange

    /* 캠프 안의 플레이어는 못 건드린다. 불이 안전한 이유가 거미
       하나뿐이면 캠프가 반쪽짜리가 된다. */
    const playerSafe = s.campfire.level > 0
      && distance(p.x, p.z, CENTER, CENTER) <= s.campfire.safeRadius

    let vx = 0
    let vz = 0
    const toP = d > 1e-4 ? { x: (p.x - b.x) / d, z: (p.z - b.z) / d } : { x: 0, z: 0 }

    switch (def.behavior) {
      case 'flee': {
        if (sees && !playerSafe) {
          vx = -toP.x
          vz = -toP.z
          b.state = 'flee'
        } else {
          wander(b, rng, dt)
          vx = b.targetX
          vz = b.targetZ
        }
        break
      }
      case 'dart': {
        if (!sees || playerSafe) {
          wander(b, rng, dt)
          vx = b.targetX
          vz = b.targetZ
          b.state = 'idle'
          break
        }
        /* 돌진 → 물러남을 되풀이한다. 물러나는 동안 플레이어가
           반격할 틈이 생겨서, 무리여도 대응이 가능해진다. */
        if (b.state !== 'recover' && d > ATTACK_REACH) {
          b.state = 'chase'
          vx = toP.x
          vz = toP.z
        } else if (b.state === 'recover') {
          vx = -toP.x * 0.8
          vz = -toP.z * 0.8
          if (b.stateT > 0.9) {
            b.state = 'chase'
            b.stateT = 0
          }
        }
        break
      }
      case 'charge': {
        if (sees && !playerSafe) {
          b.state = 'chase'
          vx = toP.x
          vz = toP.z
        } else {
          wander(b, rng, dt)
          vx = b.targetX
          vz = b.targetZ
        }
        break
      }
      case 'patrol': {
        if (sees && !playerSafe) {
          b.state = 'chase'
          vx = toP.x
          vz = toP.z
        } else {
          /* 무기고 근처를 돈다(§10.5). 없으면 그냥 배회. */
          const target = nearestArmory(s, b)
          if (target) {
            const td = distance(b.x, b.z, target.x, target.z)
            if (td > 6) {
              vx = (target.x - b.x) / td
              vz = (target.z - b.z) / td
            } else {
              wander(b, rng, dt)
              vx = b.targetX
              vz = b.targetZ
            }
          } else {
            wander(b, rng, dt)
            vx = b.targetX
            vz = b.targetZ
          }
          b.state = 'idle'
        }
        break
      }
    }

    const speed = def.speed * (b.state === 'flee' ? 1.0 : b.state === 'idle' ? 0.45 : 1.0)
    if (vx !== 0 || vz !== 0) {
      const len = Math.hypot(vx, vz) || 1
      const moved = pushOut(
        b.x + (vx / len) * speed * dt,
        b.z + (vz / len) * speed * dt,
        def.radius,
        solids,
      )
      b.x = moved.x
      b.z = moved.z
    }

    /* 공격 */
    if (!playerSafe && d <= ATTACK_REACH + def.radius && b.attackCd <= 0 && def.damage > 0) {
      damageSuit(s, def.damage, 'beast')
      b.attackCd = ATTACK_CD
      if (def.behavior === 'dart') {
        b.state = 'recover'
        b.stateT = 0
      }
      s.events.push('beastHit')
    }
  }

  s.beasts = alive
}

function wander(b: Beast, rng: { (): number; range: (a: number, c: number) => number }, dt: number): void {
  b.stateT += dt
  if (b.stateT > 2.5 || (b.targetX === 0 && b.targetZ === 0)) {
    const a = rng() * Math.PI * 2
    b.targetX = Math.cos(a)
    b.targetZ = Math.sin(a)
    b.stateT = 0
  }
}

function nearestArmory(s: GameState, b: Beast): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null
  let bd = Infinity
  for (const a of s.armories) {
    if (a.opened) continue
    const d = distance(b.x, b.z, a.x, a.z)
    if (d < bd) {
      bd = d
      best = a
    }
  }
  return best
}
