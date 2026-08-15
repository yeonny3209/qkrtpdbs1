/* ==================================================================
   명중과 피해

   이 파일에는 Three.js 가 없다. 렌더링 쪽은 실제로 Three 의
   Raycaster 를 쓰지만, 규칙 자체는 여기 순수 함수가 정하고 테스트도
   여기에 건다. 두 곳이 다른 답을 내면 화면에 보이는 것과 점수판이
   어긋나므로, 실제 판정 호출은 항상 이쪽을 거치게 한다.
   ================================================================== */
import { rayBox } from './collide.js'
import { ENEMY_TYPES } from './enemies.js'

export const HEADSHOT_MULTIPLIER = 2.0

/* 적의 히트박스 두 짝.

   머리를 몸통 위에 얹은 별도 상자로 두는 이유는, 겹쳐 두면 어느
   쪽이 먼저 맞았는지가 광선 거리로만 갈려서 몸통 앞면을 맞아도
   머리 판정이 나오는 일이 생기기 때문이다. 머리 상자는 몸통
   위쪽 밖에만 둔다. */
export function hitboxesOf(enemy) {
  const t = ENEMY_TYPES[enemy.type]
  const r = t.radius
  const h = t.height
  const headH = h * 0.26
  const bodyTop = h - headH
  const headR = r * 0.62

  return {
    body: {
      minX: enemy.x - r, maxX: enemy.x + r,
      minY: 0, maxY: bodyTop,
      minZ: enemy.z - r, maxZ: enemy.z + r,
    },
    head: {
      minX: enemy.x - headR, maxX: enemy.x + headR,
      minY: bodyTop, maxY: h,
      minZ: enemy.z - headR, maxZ: enemy.z + headR,
    },
  }
}

/* 거리 감쇠 배율. falloffStart 까지는 그대로, 거기서 falloffEnd 까지
   선형으로 falloffMin 까지 떨어지고, 그 뒤로는 계속 최소값이다.

   사거리 밖을 0 으로 자르지 않는 건 의도다. 샷건으로 먼 적을 긁는
   것도 조금은 통해야, 사거리 경계에서 갑자기 총이 고장난 느낌이
   나지 않는다. */
export function falloffAt(weapon, distance) {
  const { falloffStart: a, falloffEnd: b, falloffMin: m } = weapon
  if (distance <= a) return 1
  if (distance >= b) return m
  return 1 + (m - 1) * ((distance - a) / (b - a))
}

/* 최종 피해량 */
export function applyDamage(weapon, isHeadshot, distance) {
  const base = weapon.damage * falloffAt(weapon, distance)
  return base * (isHeadshot ? HEADSHOT_MULTIPLIER : 1)
}

/* 광선 하나가 맞은 것.

   벽까지의 거리를 먼저 재고, 그보다 가까운 적만 인정한다. 이래야
   엄폐물 뒤 적이 안 맞는다 — 적을 먼저 훑고 나중에 벽을 보면,
   벽 검사를 빠뜨린 경로 하나에서 관통 버그가 난다.

   반환:
     { kind:'enemy', enemy, isHeadshot, t, point }
     { kind:'wall', t, point }
     null (허공)  */
export function raycast(origin, dir, enemies, boxes, maxDist) {
  const { x: ox, y: oy, z: oz } = origin
  const { x: dx, y: dy, z: dz } = dir

  let wallT = maxDist
  for (const b of boxes) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b)
    if (t !== null && t < wallT) wallT = t
  }

  let best = null
  for (const e of enemies) {
    if (e.state === 'dead') continue
    const { body, head } = hitboxesOf(e)

    const tHead = rayBox(ox, oy, oz, dx, dy, dz, head)
    const tBody = rayBox(ox, oy, oz, dx, dy, dz, body)

    /* 둘 다 맞으면 가까운 쪽이 실제로 먼저 닿은 부위다. */
    let t = null
    let isHeadshot = false
    if (tHead !== null && (tBody === null || tHead <= tBody)) {
      t = tHead
      isHeadshot = true
    } else if (tBody !== null) {
      t = tBody
    }

    if (t === null || t >= wallT) continue
    if (best === null || t < best.t) best = { kind: 'enemy', enemy: e, isHeadshot, t }
  }

  if (best) {
    return { ...best, point: pointAt(origin, dir, best.t) }
  }
  if (wallT < maxDist) {
    return { kind: 'wall', t: wallT, point: pointAt(origin, dir, wallT) }
  }
  return null
}

function pointAt(o, d, t) {
  return { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }
}

/* 조준선을 탄퍼짐만큼 흔든다.

   원 안에서 균등하게 뽑으려면 반지름에 제곱근을 씌워야 한다. 안
   그러면 중심에 몰려서, 명목상 12도 퍼지는 샷건이 실제로는 훨씬
   좁게 뭉친다. */
export function spreadDir(dir, spreadDeg, rng) {
  if (spreadDeg <= 0) return { ...dir }

  const maxRad = (spreadDeg * Math.PI) / 180
  const angle = rng() * Math.PI * 2
  const radius = Math.sqrt(rng()) * maxRad

  /* 조준 방향에 수직인 두 축을 만든다. 위쪽 벡터가 조준선과
     나란하면(바로 위/아래를 볼 때) 외적이 0 이 되므로 다른 축을 쓴다. */
  const up = Math.abs(dir.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const right = normalize(cross(dir, up))
  const realUp = cross(right, dir)

  const sx = Math.cos(angle) * Math.sin(radius)
  const sy = Math.sin(angle) * Math.sin(radius)
  const sz = Math.cos(radius)

  return normalize({
    x: right.x * sx + realUp.x * sy + dir.x * sz,
    y: right.y * sx + realUp.y * sy + dir.y * sz,
    z: right.z * sx + realUp.z * sy + dir.z * sz,
  })
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function normalize(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

/* 한 번의 발사 — 산탄 무기는 알 개수만큼 광선을 쏜다.
   같은 적을 여러 알이 맞으면 피해가 합산되도록 적별로 모아 준다. */
export function fireShot(weapon, origin, aimDir, enemies, boxes, rng) {
  const hits = []
  const damageByEnemy = new Map()

  for (let i = 0; i < weapon.pellets; i++) {
    const dir = spreadDir(aimDir, weapon.spread, rng)
    const hit = raycast(origin, dir, enemies, boxes, weapon.range)
    if (!hit) continue

    if (hit.kind === 'enemy') {
      const dmg = applyDamage(weapon, hit.isHeadshot, hit.t)
      const prev = damageByEnemy.get(hit.enemy.id)
      if (prev) {
        prev.damage += dmg
        prev.isHeadshot = prev.isHeadshot || hit.isHeadshot
      } else {
        damageByEnemy.set(hit.enemy.id, {
          enemy: hit.enemy, damage: dmg, isHeadshot: hit.isHeadshot,
        })
      }
    }
    hits.push(hit)
  }

  return { hits, damages: [...damageByEnemy.values()] }
}
