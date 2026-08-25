/* ==================================================================
   안개

   §6.4 그대로다. 캠프파이어가 아무리 밝아도 지도에는 안 남는다.
   직접 밟은 타일만 기록한다.

   "밝힌 곳"과 "가 본 곳"을 가르는 게 요점이다. 불을 키워도 지도는
   안 늘어나야, 지도를 넓히려면 몸이 나가야 한다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { TILES, inBounds } from './Tilemap.ts'

/** 발자국 반경. 한 타일만 칠하면 뛰어갈 때 점선이 된다. */
const FOOT_RADIUS = 2

export function markExplored(s: GameState): void {
  const cx = Math.floor(s.player.x)
  const cz = Math.floor(s.player.z)
  for (let dz = -FOOT_RADIUS; dz <= FOOT_RADIUS; dz++) {
    for (let dx = -FOOT_RADIUS; dx <= FOOT_RADIUS; dx++) {
      if (dx * dx + dz * dz > FOOT_RADIUS * FOOT_RADIUS) continue
      const tx = cx + dx
      const tz = cz + dz
      if (!inBounds(tx, tz)) continue
      s.explored[tz * TILES + tx] = 1
    }
  }
}

export function isExplored(s: GameState, tx: number, tz: number): boolean {
  if (!inBounds(tx, tz)) return false
  return s.explored[tz * TILES + tx] === 1
}

export function exploredCount(s: GameState): number {
  let n = 0
  for (let i = 0; i < s.explored.length; i++) n += s.explored[i]
  return n
}
