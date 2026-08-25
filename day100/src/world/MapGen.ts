/* ==================================================================
   맵 생성

   할 일은 두 가지다 — 배치를 부르고, 부딪히는 것 목록을 만든다.

   막는 것을 미리 뽑아 두는 이유는 성능이다. 큰 나무만 300그루 가까이
   되는데 매 프레임 전체를 훑으면 사람과 짐승과 거미가 다 같이 훑는다.
   나무는 캘 때만 바뀌므로, 바뀔 때 다시 만드는 편이 싸다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { populate } from './Spawner.ts'
import { CENTER, type Solid } from './Tilemap.ts'

/** 불시착한 우주선. 중앙 고정이고 부딪힌다. */
export const SHIP: Solid = { x: CENTER, z: CENTER, r: 2.1 }

/** 큰 나무만 막는다. 작은 나무까지 막으면 1존이 걸어 다니기 답답하다. */
const LARGE_TREE_R = 0.62

export function buildSolids(s: GameState): Solid[] {
  const out: Solid[] = [SHIP]
  for (const t of s.trees) {
    if (t.kind === 'tree_large') out.push({ x: t.x, z: t.z, r: LARGE_TREE_R })
  }
  return out
}

/** 나무가 사라지거나 생기면 부른다. */
export function refreshSolids(s: GameState, cache: { solids: Solid[] }): void {
  cache.solids = buildSolids(s)
}

export function generate(s: GameState): { solids: Solid[] } {
  populate(s)
  return { solids: buildSolids(s) }
}
