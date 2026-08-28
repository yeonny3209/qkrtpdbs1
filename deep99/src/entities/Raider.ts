/* ==================================================================
   약탈자 (§10.1, §13)

   먼저 불시착해 미쳐버린 조난자들. 거미와 달리 **죽일 수 있다.**
   그래서 밤이 "버티는 시간"에서 "싸우는 시간"으로 바뀐다.

   행동은 단순하다 — 캠프 바깥 원주에서 불빛을 향해 곧장 온다. 길을
   막는 벽이 있으면 벽을 때린다. 그게 벽을 짓는 이유다.

   석궁잡이만 원거리다. 11타일에서 멈춰 쏘므로, 벽 뒤에 숨어도
   시야가 열려 있으면 맞는다.
   ================================================================== */
import { ENEMIES } from '../data/index.ts'
import type { GameState, Beast, Building } from '../core/GameState.ts'
import { nextId, distance, addItem } from '../core/GameState.ts'
import { CENTER, pushOut, type Solid } from '../world/Tilemap.ts'
import { damageSuit } from '../systems/SurvivalSystem.ts'

const ATTACK_REACH = 1.05
const ATTACK_CD = 1.2
const WALL_DPS = 40

export function spawnRaider(s: GameState, type: string, x: number, z: number): Beast {
  const def = ENEMIES[type]
  const b: Beast = {
    id: nextId(s), type, x, z, hp: def.hp,
    state: 'chase', stateT: 0, wanderX: 0, wanderZ: 0, attackCd: 0, boundT: 0,
  }
  s.raiders.push(b)
  return b
}

export function damageRaider(s: GameState, b: Beast, amount: number): boolean {
  /* 시체를 때려도 전리품이 다시 나오지 않게 (Animal.damageBeast 와 같은 이유) */
  if (b.hp <= 0) return false
  b.hp -= amount
  if (b.hp <= 0) {
    const def = ENEMIES[b.type]
    for (const [id, n] of Object.entries(def.drops)) addItem(s, id, n)
    s.events.push('raiderDown')
    return true
  }
  return false
}

/** 앞을 막는 벽을 찾는다. 없으면 null. */
function blockingWall(s: GameState, b: Beast): Building | null {
  let best: Building | null = null
  let bd = 1.3
  for (const w of s.buildings) {
    if (w.type !== 'wall_wood' && w.type !== 'wall_steel') continue
    const d = distance(b.x, b.z, w.x, w.z)
    if (d < bd) {
      bd = d
      best = w
    }
  }
  return best
}

export function updateAll(s: GameState, dt: number, solids: readonly Solid[]): void {
  if (s.raiders.length === 0) return
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return

  const p = s.player
  const alive: Beast[] = []

  for (const b of s.raiders) {
    if (b.hp <= 0) continue
    alive.push(b)
    const def = ENEMIES[b.type]
    if (b.attackCd > 0) b.attackCd -= dt
    if (b.boundT > 0) {
      b.boundT -= dt
      continue
    }

    const d = distance(b.x, b.z, p.x, p.z)
    const ranged = def.behavior === 'raidRanged'
    const range = ranged ? (def.attackRange ?? 11) : ATTACK_REACH + def.radius

    /* 벽이 앞을 막으면 벽부터 부순다 */
    const wall = blockingWall(s, b)
    if (wall) {
      wall.hp = (wall.hp ?? 1) - WALL_DPS * dt
      if (wall.hp <= 0) {
        s.buildings = s.buildings.filter((x) => x.id !== wall.id)
        s.events.push('wallBroke')
      }
      continue
    }

    if (d > range) {
      const ux = (p.x - b.x) / (d || 1)
      const uz = (p.z - b.z) / (d || 1)
      const moved = pushOut(
        b.x + ux * def.speed * dt,
        b.z + uz * def.speed * dt,
        def.radius, solids,
      )
      b.x = moved.x
      b.z = moved.z
    } else if (b.attackCd <= 0) {
      if (ranged) {
        /* 석궁 — 실제로 화살을 날린다. 벽에 막히게 하려면 투사체여야 한다. */
        const ux = (p.x - b.x) / (d || 1)
        const uz = (p.z - b.z) / (d || 1)
        s.bullets.push({
          x: b.x, z: b.z, vx: ux * 22, vz: uz * 22,
          life: 1.2, dmg: def.damage, fromPlayer: false, pierce: false,
        })
        s.events.push('crossbow')
      } else {
        damageSuit(s, def.damage, 'raider')
        s.events.push('raiderHit')
      }
      b.attackCd = ATTACK_CD
    }
  }

  s.raiders = alive
}

/** 캠프 바깥 원주에 고르게 세운다 — 사방에서 온다는 그림(§13.1) */
export function ringPosition(
  index: number, total: number, radius: number, jitter: number,
): { x: number; z: number } {
  const a = (index / Math.max(1, total)) * Math.PI * 2 + jitter
  return { x: CENTER + Math.cos(a) * radius, z: CENTER + Math.sin(a) * radius }
}
