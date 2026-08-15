/* ==================================================================
   충돌 — 원 대 상자, XZ 평면

   기획서에는 Rapier(WASM 물리 엔진)를 쓰겠다고 적어 두었지만 직접
   짜기로 바꿨다. 이유는 셋이다.

   1. 이 게임에 필요한 물리는 "벽을 못 지나간다" 하나뿐이다. 아레나가
      전부 축에 나란한 상자라서, 원-상자 밀어내기 60줄이면 끝난다.
   2. 순수 함수라 Node 에서 바로 검증된다. WASM 엔진은 브라우저를
      띄워야 확인이 되고, 그러면 이 저장소가 지켜 온 "규칙은 순수
      함수로, 테스트는 브라우저 없이" 원칙이 깨진다.
   3. 정적 배포에 WASM 을 얹으면 번들이 1MB 넘게 늘고 로딩 실패
      경로가 하나 더 생긴다. 얻는 게 벽 충돌뿐이면 남는 장사가 아니다.

   엄폐물이 전부 점프보다 높아 "위에 올라서기"가 없으므로, 수직 충돌은
   바닥 평면 y=0 하나로 충분하다. 그래서 이 파일은 XZ 만 다룬다.
   ================================================================== */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/* 원이 상자를 파고든 만큼의 밀어내기 벡터. 안 겹치면 null.

   두 경우를 나눈다.
   - 중심이 상자 밖 → 상자 위의 가장 가까운 점에서 중심 쪽으로 민다.
     모서리에서는 이 방향이 대각선이 되어, 기둥 모서리를 스치듯
     돌아 나가게 된다. (상자로 근사하면 여기서 걸리는 느낌이 난다)
   - 중심이 상자 안 → 가장 가까운 면으로 빼낸다. 정상 플레이에서는
     안 생기지만, 순간이동·스폰 겹침 같은 예외에서 끼는 걸 막는다. */
export function pushOut(cx, cz, r, box) {
  const nx = clamp(cx, box.minX, box.maxX)
  const nz = clamp(cz, box.minZ, box.maxZ)
  const dx = cx - nx
  const dz = cz - nz
  const d2 = dx * dx + dz * dz

  if (d2 > 1e-12) {
    if (d2 >= r * r) return null
    const d = Math.sqrt(d2)
    const push = r - d
    return { x: (dx / d) * push, z: (dz / d) * push }
  }

  // 중심이 상자 내부 — 네 면까지의 거리 중 최단으로 탈출
  const toLeft = cx - box.minX
  const toRight = box.maxX - cx
  const toBack = cz - box.minZ
  const toFront = box.maxZ - cz
  const m = Math.min(toLeft, toRight, toBack, toFront)
  if (m === toLeft) return { x: -(toLeft + r), z: 0 }
  if (m === toRight) return { x: toRight + r, z: 0 }
  if (m === toBack) return { x: 0, z: -(toBack + r) }
  return { x: 0, z: toFront + r }
}

/* 이동 후 위치를 벽 밖으로 정리한다.

   축을 나눠 처리하는 흔한 방식 대신, 옮겨 놓고 겹친 만큼 밀어내기를
   몇 번 반복한다. 축 분리는 구현이 짧지만 모서리가 각지게 걸리고,
   두 벽이 만나는 안쪽 구석에서 한쪽 보정이 다른 쪽을 되돌려 떨림이
   생긴다. 반복 밀어내기는 그 구석에서 자연스럽게 수렴한다.

   4회면 실제 배치(최대 3면이 동시에 닿는 구석)에서 충분하다. */
export function resolveMove(fromX, fromZ, dx, dz, radius, boxes, iterations = 8) {
  /* 한 번에 반지름보다 많이 움직이면 벽을 건너뛴다. 밀어내기는
     "지금 겹쳤나"만 보기 때문에, 벽 이쪽에서 저쪽으로 한 프레임에
     넘어가 버리면 겹친 순간이 없어서 아무 일도 일어나지 않는다.

     브루트에게 얻어맞아 크게 밀리는 순간이 정확히 그 경우다. 그래서
     긴 이동은 잘게 쪼개 매 조각마다 밀어낸다. 평소 걸음은 프레임당
     0.1 도 안 되므로 여기 걸리지 않는다 — 빠른 것에만 비용을 낸다. */
  const dist = Math.hypot(dx, dz)
  const maxStep = radius * 0.5
  const steps = dist > maxStep ? Math.ceil(dist / maxStep) : 1

  let x = fromX
  let z = fromZ
  const sx = dx / steps
  const sz = dz / steps

  for (let s = 0; s < steps; s++) {
    x += sx
    z += sz
    for (let i = 0; i < iterations; i++) {
      let touched = false
      for (const b of boxes) {
        const p = pushOut(x, z, radius, b)
        if (p) {
          x += p.x
          z += p.z
          touched = true
        }
      }
      if (!touched) break
    }
  }
  return { x, z }
}

/* 광선 대 축정렬 상자 — 슬랩 기법.

   벽 관통 여부와 적 명중 판정이 같은 함수를 쓴다. 적 히트박스도
   축정렬 상자로 잡았기 때문인데, 이게 단순해서가 아니라 "총알이
   벽에 막히는가"와 "총알이 적에게 맞는가"를 하나의 거리 비교로
   풀 수 있어서다. 둘을 다른 방식으로 재면 언젠가 어긋난다.

   광선 시작점이 상자 안이면 0 을 준다. 총구가 벽에 파묻힌 상태에서
   벽 너머를 쏘는 걸 막는다. */
export function rayBox(ox, oy, oz, dx, dy, dz, box) {
  const inv = (v) => (v === 0 ? Infinity : 1 / v)
  const idx = inv(dx)
  const idy = inv(dy)
  const idz = inv(dz)

  let t1 = (box.minX - ox) * idx
  let t2 = (box.maxX - ox) * idx
  let tmin = Math.min(t1, t2)
  let tmax = Math.max(t1, t2)

  t1 = (box.minY - oy) * idy
  t2 = (box.maxY - oy) * idy
  tmin = Math.max(tmin, Math.min(t1, t2))
  tmax = Math.min(tmax, Math.max(t1, t2))

  t1 = (box.minZ - oz) * idz
  t2 = (box.maxZ - oz) * idz
  tmin = Math.max(tmin, Math.min(t1, t2))
  tmax = Math.min(tmax, Math.max(t1, t2))

  if (tmax < 0 || tmin > tmax) return null
  return tmin < 0 ? 0 : tmin
}

/* 두 점 사이가 뚫려 있는가 — 원거리 적이 쏠지 말지 결정할 때 쓴다.
   벽 뒤에 숨었는데도 계속 맞으면 엄폐물이 있으나 마나다. */
export function hasLineOfSight(ax, ay, az, bx, by, bz, boxes) {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const dist = Math.hypot(dx, dy, dz)
  if (dist < 1e-6) return true

  const nx = dx / dist
  const ny = dy / dist
  const nz = dz / dist
  for (const b of boxes) {
    const t = rayBox(ax, ay, az, nx, ny, nz, b)
    if (t !== null && t < dist) return false
  }
  return true
}
