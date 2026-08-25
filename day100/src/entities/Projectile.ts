/* ==================================================================
   총알

   히트스캔이 아니라 실제로 날아가는 탄이다. 탑다운에서는 총알이
   보이는 편이 훨씬 읽히고, 샷건의 펠릿이 퍼지는 그림도 그대로 나온다.

   샷건은 §11.1 대로 거리에 따라 명중이 떨어진다. 펠릿마다 각도를
   흩뿌리면 "5타일에서 전탄, 15타일에서 30%"가 저절로 나온다 —
   거리별 확률표를 따로 둘 필요가 없다.
   ================================================================== */
import { ITEMS } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { distance } from '../core/GameState.ts'
import { type Solid, segmentBlocked } from '../world/Tilemap.ts'
import { damageBeast } from './Animal.ts'
import { ENEMIES } from '../data/index.ts'

const BULLET_SPEED = 42
const BULLET_LIFE = 0.65

export function fire(s: GameState, gun: string): boolean {
  const def = ITEMS[gun]
  if (!def || def.kind !== 'gun') return false
  const p = s.player
  if (p.fireCooldown > 0 || p.reloadT > 0 || p.magazine <= 0) return false

  p.magazine--
  p.fireCooldown = def.fireSec ?? 0.3

  const pellets = def.pellets ?? 1
  const spread = (def.spread ?? 0.05) * (p.aiming ? 0.6 : 1)
  for (let i = 0; i < pellets; i++) {
    const a = p.facing + (s.streams.loot() - 0.5) * spread * 2 * (pellets > 1 ? 6 : 1)
    s.bullets.push({
      x: p.x,
      z: p.z,
      vx: Math.cos(a) * BULLET_SPEED,
      vz: Math.sin(a) * BULLET_SPEED,
      life: BULLET_LIFE,
      dmg: def.damage ?? 10,
    })
  }
  s.events.push(pellets > 1 ? 'shotgun' : 'gunshot')
  return true
}

export function update(s: GameState, dt: number, solids: readonly Solid[]): void {
  if (s.bullets.length === 0) return
  const alive: typeof s.bullets = []

  for (const b of s.bullets) {
    const nx = b.x + b.vx * dt
    const nz = b.z + b.vz * dt
    b.life -= dt

    /* 지형에 박히면 사라진다. 큰 나무 뒤로 숨을 수 있다는 뜻이고,
       짐승도 그 뒤로 돌면 총이 안 통한다. */
    if (segmentBlocked(b.x, b.z, nx, nz, 0.05, solids)) continue

    let hit = false
    for (const beast of s.beasts) {
      if (beast.hp <= 0) continue
      const def = ENEMIES[beast.type]
      if (distance(nx, nz, beast.x, beast.z) <= def.radius + 0.12) {
        damageBeast(s, beast, b.dmg)
        hit = true
        break
      }
    }
    if (hit) continue

    b.x = nx
    b.z = nz
    if (b.life > 0) alive.push(b)
  }

  s.bullets = alive
}
