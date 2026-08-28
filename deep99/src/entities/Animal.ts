/* ==================================================================
   야생 동물 (§10.1, §10.4)

   성격 차이를 행동 하나씩으로 옮겼다. 스탯만 다르면 전부 "다가와서
   문다"가 되어 구분이 안 된다.

     토끼 (flee)   — 다가가면 도망친다. 그래서 덫이 값을 한다
     늑대 (dart)   — 돌진과 물러나기를 되풀이한다
     곰   (charge) — 물러나지 않는다. 느리지만 계속 온다
     호랑이(patrol)— 순찰하다 25타일에서 문다. 도망칠 수 없다

   ── 스폰은 캠프파이어 최고 레벨이 정한다 (§3.3)

   불이 2레벨에 닿아야 늑대가, 5레벨에 닿아야 호랑이가 나타난다. 불을
   키우면 갈 수 있는 땅이 넓어지는 동시에 만나는 것도 세진다 — 개방이
   보상이자 위험인 구조다.
   ================================================================== */
import { ENEMIES, ZONES } from '../data/index.ts'
import type { GameState, Beast } from '../core/GameState.ts'
import { nextId, distance, addItem, toast } from '../core/GameState.ts'
import { CENTER, TILES, pushOut, type Solid } from '../world/Tilemap.ts'
import { openRadiusOf } from '../world/ZoneGate.ts'
import { damageSuit } from '../systems/SurvivalSystem.ts'

const ATTACK_REACH = 1.05
const ATTACK_CD = 1.1

/** 지대별 유지 마릿수. 불 레벨이 열어 준 종만 채운다. */
const POPULATION: { type: string; zone: number; cap: number }[] = [
  { type: 'rabbit', zone: 1, cap: 16 },
  { type: 'rabbit', zone: 2, cap: 6 },
  { type: 'wolf', zone: 2, cap: 12 },
  { type: 'mutant_wolf', zone: 3, cap: 10 },
  { type: 'bear', zone: 4, cap: 8 },
  { type: 'tiger', zone: 5, cap: 2 },
  { type: 'abyssal', zone: 5, cap: 2 },
]

export function spawnBeast(s: GameState, type: string, x: number, z: number): Beast {
  const def = ENEMIES[type]
  const b: Beast = {
    id: nextId(s), type, x, z, hp: def.hp,
    state: 'idle', stateT: 0, wanderX: 0, wanderZ: 0, attackCd: 0, boundT: 0,
  }
  s.beasts.push(b)
  return b
}

/** 이 종이 지금 나타날 수 있는가 — 불 최고 레벨 기준(§3.3) */
export function unlocked(s: GameState, type: string): boolean {
  return s.campfire.maxReachedLevel >= ENEMIES[type].fireLevel
}

function spawnUpTo(s: GameState, zoneId: number, type: string, cap: number): void {
  if (!unlocked(s, type)) return
  const zone = ZONES.find((z) => z.id === zoneId)!
  const rng = s.streams.spawn
  const open = openRadiusOf(s)
  const have = s.beasts.filter((b) => b.type === type).length

  for (let i = have; i < cap; i++) {
    const a = rng() * Math.PI * 2
    const outer = Math.min(zone.outerRadius, TILES / 2 - 6, open)
    if (outer <= zone.innerRadius) return       // 아직 안 열린 지대
    const r = Math.sqrt(rng.range(zone.innerRadius ** 2, outer ** 2))
    const x = CENTER + Math.cos(a) * r
    const z = CENTER + Math.sin(a) * r
    if (x < 3 || z < 3 || x > TILES - 3 || z > TILES - 3) continue
    /* 캠프 안에는 안 넣는다. 아침에 눈뜨니 곰이 서 있으면 억울하다. */
    if (distance(x, z, CENTER, CENTER) < Math.max(12, s.campfire.safeRadius + 3)) continue
    spawnBeast(s, type, x, z)
  }
}

export function populateInitial(s: GameState): void {
  for (const p of POPULATION) spawnUpTo(s, p.zone, p.type, p.cap)
}

/** 일출마다 조금씩 다시 채운다. 한 번에 다 채우면 아침이 소란스럽다. */
export function repopulate(s: GameState): void {
  for (const p of POPULATION) {
    const have = s.beasts.filter((b) => b.type === p.type).length
    if (have >= p.cap) continue
    spawnUpTo(s, p.zone, p.type, Math.min(p.cap, have + 2))
  }
}

export function damageBeast(s: GameState, b: Beast, amount: number): boolean {
  /* 이미 죽은 것은 다시 안 죽는다.

     이 문이 없으면 시체를 때릴 때마다 전리품이 새로 떨어진다. 목록에서
     걷어내기 전 한 프레임이라도 다른 시스템(포탑·덫)이 때리면 그대로
     복사기가 된다. */
  if (b.hp <= 0) return false
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
  /* 직책 '밀렵꾼'은 고기가 두 배(§16.3) */
  const meatFactor = s.job.effects.meatFactor ?? 1
  let lost = 0
  for (const [id, n] of Object.entries(def.drops)) {
    const amount = id.startsWith('meat_') ? n * meatFactor : n
    lost += addItem(s, id, amount)
  }
  if (lost > 0) toast(s, '가방이 가득 차 일부를 놓쳤습니다', 'warn')
  s.events.push('beastDown')
}

function wander(b: Beast, rng: { (): number }, dt: number): void {
  b.stateT += dt
  if (b.stateT > 2.5 || (b.wanderX === 0 && b.wanderZ === 0)) {
    const a = rng() * Math.PI * 2
    b.wanderX = Math.cos(a)
    b.wanderZ = Math.sin(a)
    b.stateT = 0
  }
}

export function updateAll(s: GameState, dt: number, solids: readonly Solid[]): void {
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return
  const p = s.player
  const rng = s.streams.ai
  const alive: Beast[] = []

  /* 캠프 안의 플레이어는 못 건드린다. 단 불이 꺼져 있으면 안전지대가
     아예 없다 — 거미뿐 아니라 짐승도 들어온다. */
  const playerSafe = !s.campfire.extinguished
    && s.campfire.level > 0
    && distance(p.x, p.z, CENTER, CENTER) <= s.campfire.safeRadius

  for (const b of s.beasts) {
    if (b.hp <= 0) continue
    alive.push(b)
    const def = ENEMIES[b.type]
    if (b.attackCd > 0) b.attackCd -= dt
    if (b.boundT > 0) {
      b.boundT -= dt
      continue
    }

    const d = distance(b.x, b.z, p.x, p.z)
    const sees = d <= def.senseRange && !playerSafe
    const toP = d > 1e-4 ? { x: (p.x - b.x) / d, z: (p.z - b.z) / d } : { x: 0, z: 0 }
    let vx = 0
    let vz = 0

    switch (def.behavior) {
      case 'flee':
        if (sees) {
          vx = -toP.x
          vz = -toP.z
          b.state = 'flee'
        } else {
          wander(b, rng, dt)
          vx = b.wanderX
          vz = b.wanderZ
          b.state = 'idle'
        }
        break

      case 'dart':
        if (!sees) {
          wander(b, rng, dt)
          vx = b.wanderX
          vz = b.wanderZ
          b.state = 'idle'
          break
        }
        /* 돌진 → 물러남을 되풀이한다. 물러나는 동안 반격할 틈이 생겨서
           무리여도 대응이 가능해진다. */
        b.stateT += dt
        if (b.state === 'recover') {
          vx = -toP.x * 0.8
          vz = -toP.z * 0.8
          if (b.stateT > 0.9) {
            b.state = 'chase'
            b.stateT = 0
          }
        } else {
          b.state = 'chase'
          vx = toP.x
          vz = toP.z
        }
        break

      case 'charge':
        if (sees) {
          b.state = 'chase'
          vx = toP.x
          vz = toP.z
        } else {
          wander(b, rng, dt)
          vx = b.wanderX
          vz = b.wanderZ
          b.state = 'idle'
        }
        break

      case 'patrol':
        if (sees) {
          b.state = 'chase'
          vx = toP.x
          vz = toP.z
        } else {
          wander(b, rng, dt)
          vx = b.wanderX
          vz = b.wanderZ
          b.state = 'idle'
        }
        break

      default:
        break
    }

    const speed = def.speed * (b.state === 'idle' ? 0.45 : 1)
    if (vx !== 0 || vz !== 0) {
      const len = Math.hypot(vx, vz) || 1
      const moved = pushOut(
        b.x + (vx / len) * speed * dt,
        b.z + (vz / len) * speed * dt,
        def.radius, solids,
      )
      b.x = moved.x
      b.z = moved.z
    }

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
