/* ==================================================================
   타일맵

   좌표는 전부 "타일" 단위다. 픽셀은 그리는 순간에만 곱한다. 속도 4.0
   이 초당 4타일이라는 뜻이 되어, 기획서의 숫자를 코드에서 그대로 읽는다.

   지형은 저장하지 않는다. 지대는 중심에서의 거리로 정해지므로 함수
   하나면 되고, 240×240 배열을 들고 다닐 이유가 없다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import { hash32 } from '../core/RNG.ts'

export const TILE = BALANCE.map.tileSize
export const TILES = BALANCE.map.tiles
export const CENTER = BALANCE.map.centerTile

export function inBounds(tx: number, tz: number): boolean {
  return tx >= 0 && tz >= 0 && tx < TILES && tz < TILES
}

export function distanceFromCenter(x: number, z: number): number {
  return Math.hypot(x - CENTER, z - CENTER)
}

/* 타일마다 살짝 다른 얼룩. 시드 해시라 저장할 것이 없고, 카메라가
   움직여도 무늬가 미끄러지지 않는다. */
export function tileTint(seed: string, tx: number, tz: number): number {
  return (hash32(`${seed}:${tx}:${tz}`) % 1000) / 1000
}

export function clampToMap(v: number): number {
  return Math.min(TILES - 2, Math.max(2, v))
}

export type Solid = { x: number; z: number; r: number }

/* 원끼리 밀어내기. 지형이 나무·바위 같은 둥근 것들이라 원-원 하나면
   충분하다. 여러 개에 동시에 끼는 경우를 위해 몇 번 되풀이한다. */
export function pushOut(
  x: number,
  z: number,
  radius: number,
  solids: readonly Solid[],
  iterations = 3,
): { x: number; z: number } {
  let px = x
  let pz = z
  for (let it = 0; it < iterations; it++) {
    let moved = false
    for (const s of solids) {
      const dx = px - s.x
      const dz = pz - s.z
      const need = s.r + radius
      const d2 = dx * dx + dz * dz
      if (d2 >= need * need) continue
      const d = Math.sqrt(d2)
      if (d < 1e-6) {
        /* 정확히 겹쳤다. 아무 방향으로나 한 번 밀어야 나눗셈이 안 터진다. */
        px += need
        moved = true
        continue
      }
      const push = (need - d) / d
      px += dx * push
      pz += dz * push
      moved = true
    }
    if (!moved) break
  }
  return { x: clampToMap(px), z: clampToMap(pz) }
}

/** 선분이 막힌 것에 걸리는가 — 거미의 "장애물만 회피"와 총알에 쓴다. */
export function segmentBlocked(
  x0: number, z0: number, x1: number, z1: number,
  radius: number, solids: readonly Solid[],
): boolean {
  const dx = x1 - x0
  const dz = z1 - z0
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-9) return false
  for (const s of solids) {
    const t = Math.max(0, Math.min(1, ((s.x - x0) * dx + (s.z - z0) * dz) / len2))
    const cx = x0 + dx * t
    const cz = z0 + dz * t
    const need = s.r + radius
    if ((cx - s.x) ** 2 + (cz - s.z) ** 2 < need * need) return true
  }
  return false
}
