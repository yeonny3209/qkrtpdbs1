/* ==================================================================
   아레나 — 모든 맵이 공유하는 것

   맵은 열 장이지만 크기와 담장은 같다(maps.js). 여기에는 그 공통
   부분과, 배치를 상자로 바꾸는 도구만 둔다.

   축 정렬을 고집하는 이유는 충돌과 레이캐스트 둘 다 상자-검사 하나로
   끝나기 때문이다. 기울어진 벽 하나를 허용하는 순간 두 시스템 모두
   훨씬 복잡해진다.

   좌표는 Three.js 관례를 따른다 — Y 가 위, 바닥은 y=0, XZ 평면이 땅.
   ================================================================== */

export const ARENA = {
  half: 15,          // 30 x 30
  wallHeight: 4.5,
  wallThick: 1,
}

/* 통로 높이와 계단 한 칸의 높이.

   한 칸은 반드시 STEP_HEIGHT(0.45)보다 낮아야 걸어 올라간다.
   통로는 바닥에서 점프해도 못 닿아야 한다 — 닿으면 계단이 장식이
   되고, 계단이라는 길목이 사라진다. */
export const CATWALK_H = 2.0
export const STEP_RISE = 0.4
export const STEP_RUN = 0.6

/* 지나다닐 수 있는 최소 틈. 가장 뚱뚱한 적(브루트, 지름 1.64)이
   여유 있게 통과해야 한다.

   이 값을 지키는 것이 취향 문제가 아니라는 걸 테스트로 확인한다.
   처음 배치에서 중앙 십자의 팔 사이 대각선 틈이 0.57 이었는데,
   플레이어 지름(0.72)보다도 좁았다. 그런 틈에 끼면 밀어내기가
   양쪽에서 번갈아 밀어 수렴하지 못하고, 결국 벽을 뚫고 나간다.
   눈으로는 "좀 좁네" 정도로 보이는 배치가 물리를 깨뜨린 것이다. */
export const MIN_GAP = 2.0

/* 상자를 min/max 형태로 펼친다. 충돌·레이캐스트가 매 프레임 쓰는
   모양이라, 매번 중심에서 계산하지 않고 미리 만들어 둔다. */
export function toBox(c) {
  return {
    minX: c.x - c.w / 2, maxX: c.x + c.w / 2,
    minY: 0, maxY: c.h,
    minZ: c.z - c.d / 2, maxZ: c.z + c.d / 2,
    cx: c.x, cz: c.z, w: c.w, d: c.d, h: c.h,
  }
}

/* 바깥 담장 네 짝. 안쪽 면이 정확히 ±half 에 오도록 바깥으로 두께만큼
   밀어 둔다 — 이래야 "아레나는 30x30" 이라는 말이 실제 플레이 공간과
   일치한다. 모든 맵이 같은 담장을 쓴다. */
export function perimeterCover() {
  const { half: h, wallHeight: wh, wallThick: t } = ARENA
  const span = h * 2 + t * 2
  return [
    { x: 0, z: -(h + t / 2), w: span, d: t, h: wh },
    { x: 0, z: h + t / 2, w: span, d: t, h: wh },
    { x: -(h + t / 2), z: 0, w: t, d: span, h: wh },
    { x: h + t / 2, z: 0, w: t, d: span, h: wh },
  ]
}

/* 점이 아레나 안인지 — 스폰 위치 검증에 쓴다 */
export function insideArena(x, z, margin = 0) {
  const h = ARENA.half - margin
  return x >= -h && x <= h && z >= -h && z <= h
}
