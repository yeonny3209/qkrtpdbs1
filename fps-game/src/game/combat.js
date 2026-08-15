/* ==================================================================
   명중과 피해

   이 파일에는 Three.js 가 없다. 렌더링 쪽은 실제로 Three 의
   Raycaster 를 쓰지만, 규칙 자체는 여기 순수 함수가 정하고 테스트도
   여기에 건다. 두 곳이 다른 답을 내면 화면에 보이는 것과 점수판이
   어긋나므로, 실제 판정 호출은 항상 이쪽을 거치게 한다.
   ================================================================== */
import { rayBox, hasLineOfSight } from './collide.js'
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

/* ------------------------------------------------------------------
   근접 공격

   광선으로 재지 않는다. 크롤러(키 1.05)가 발밑까지 붙으면 조준선이
   그 머리 위를 지나가서, 눈앞에 있는데도 계속 헛치게 된다. 코앞을
   때리는 무기가 코앞에서 안 맞으면 쓸 이유가 없다.

   대신 "사거리 안 + 부채꼴 안 + 벽에 안 가림"인 적을 전부 벤다.
   여럿을 한 번에 베는 것은 의도한 성격이다 — 탄약을 쓰지 않는 대신
   적 무리 한가운데로 들어가야 하는 무기라, 들어간 값은 해야 한다.

   각도는 수평면에서만 잰다. 위아래로는 관대해야 발밑의 크롤러와
   눈높이의 트루퍼를 같은 동작으로 벨 수 있다.
   ------------------------------------------------------------------ */
export function meleeSwing(weapon, origin, aimDir, enemies, boxes) {
  const half = ((weapon.arc || 60) * Math.PI) / 180 / 2

  /* 조준 방향의 수평 성분. 바로 위를 보고 있으면 길이가 0 이 되는데,
     그때는 각도를 잴 기준이 없으므로 모두 정면으로 친다. */
  const ax = aimDir.x
  const az = aimDir.z
  const aLen = Math.hypot(ax, az)

  const damages = []
  for (const e of enemies) {
    if (e.state === 'dead') continue
    const t = ENEMY_TYPES[e.type]

    /* 거리는 몸통 표면까지로 잰다. 브루트(반지름 0.82)를 중심까지의
       거리로 재면, 분명히 몸이 닿아 있는데도 사거리 밖이 된다. */
    const dx = e.x - origin.x
    const dz = e.z - origin.z
    const dist = Math.hypot(dx, dz) - t.radius
    if (dist > weapon.range) continue

    if (aLen > 1e-6 && dist > 0.05) {
      const d = Math.hypot(dx, dz) || 1
      const cos = (ax / aLen) * (dx / d) + (az / aLen) * (dz / d)
      if (Math.acos(Math.max(-1, Math.min(1, cos))) > half) continue
    }

    /* 벽 너머는 못 벤다. 얇은 엄폐물을 사이에 두고 칼이 통과하면
       그 벽이 왜 있는지 알 수 없게 된다. */
    const cy = t.height * 0.5
    if (!hasLineOfSight(origin.x, origin.y, origin.z, e.x, cy, e.z, boxes)) continue

    /* 근접은 헤드샷을 따지지 않는다. 부채꼴로 여럿을 동시에 베는데
       그중 누구는 머리고 누구는 몸통이라고 하면, 같은 동작의 결과가
       설명되지 않는다. */
    damages.push({ enemy: e, damage: weapon.damage, isHeadshot: false })
  }

  return { hits: [], damages }
}

/* 한 번의 발사 — 산탄 무기는 알 개수만큼 광선을 쏜다.
   같은 적을 여러 알이 맞으면 피해가 합산되도록 적별로 모아 준다. */
export function fireShot(weapon, origin, aimDir, enemies, boxes, rng) {
  if (weapon.melee) return meleeSwing(weapon, origin, aimDir, enemies, boxes)

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
