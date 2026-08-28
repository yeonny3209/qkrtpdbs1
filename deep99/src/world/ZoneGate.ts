/* ==================================================================
   에너지 장벽 — 불이 곧 지도다

   §1.2 의 첫 번째 설계 원칙이 여기 하나로 구현된다. 캠프파이어 레벨이
   갈 수 있는 거리를 정하고, 그 거리가 만날 수 있는 적과 열 수 있는
   보급함을 정한다. 불을 키우는 것이 곧 맵을 여는 것이다.

   ── 기준은 "지금"이 아니라 "최고 도달"이다 (§3.3 확정)

   원작은 불 레벨이 떨어지면 미탐사 지역이 다시 막힌다. 싱글플레이에서
   그러면 밖에 나가 있는 동안 벽이 닫혀 그대로 죽는다. 억울한 죽음은
   난이도가 아니라 결함이라, 개방 반경만 maxReachedLevel 기준으로
   영구히 열어 둔다.

   대신 **야간 안전반경은 현재 레벨** 기준이다. 그래야 "불이 꺼지면
   당장 위험하다"는 압박은 그대로 남는다. 둘을 다른 기준으로 둔 것이
   이 시스템의 요점이다.
   ================================================================== */
import { fireLevelDef } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { CENTER, TILES, distanceFromCenter } from './Tilemap.ts'

/** 지금 열려 있는 반경. 최고 도달 레벨 기준이라 줄어들지 않는다. */
export function openRadiusOf(s: GameState): number {
  const def = fireLevelDef(s.campfire.maxReachedLevel)
  if (!def) return 0
  /* Lv6 은 openRadius 999 — 맵 전체라는 뜻이다 */
  return Math.min(def.openRadius, TILES)
}

/** 이 자리가 장벽 안인가 */
export function isOpen(s: GameState, x: number, z: number): boolean {
  return distanceFromCenter(x, z) <= openRadiusOf(s)
}

/** 장벽 밖으로 나가려 하면 경계에 붙잡는다. 튕겨 내지 않고 미끄러뜨린다 —
    튕기면 조작이 어긋난 것처럼 느껴진다. */
export function clampInside(
  s: GameState,
  x: number,
  z: number,
  margin = 0,
): { x: number; z: number; blocked: boolean } {
  const r = openRadiusOf(s) - margin
  if (r <= 0) return { x, z, blocked: false }
  const d = distanceFromCenter(x, z)
  if (d <= r) return { x, z, blocked: false }
  const a = Math.atan2(z - CENTER, x - CENTER)
  return { x: CENTER + Math.cos(a) * r, z: CENTER + Math.sin(a) * r, blocked: true }
}

/** 매 프레임. 플레이어를 장벽 안에 가둔다. */
export function update(s: GameState): void {
  if (s.activeLab) return
  const p = s.player
  const c = clampInside(s, p.x, p.z, 0.4)
  if (c.blocked) {
    p.x = c.x
    p.z = c.z
    /* 부딪힌 순간에만 알린다. 매 프레임 토스트를 띄우면 화면이 덮인다. */
    if (!barrierHinted) {
      barrierHinted = true
      s.events.push('barrier')
    }
  } else {
    barrierHinted = false
  }
}

/* 장벽에 붙어 있는 동안만 참. 떨어지면 update 의 else 가지가 풀어 준다. */
let barrierHinted = false

/** 런이 바뀔 때 초기화 — RunSystem.startRun 이 부른다.

    사실 없어도 새 런은 중앙에서 시작하니 첫 프레임의 else 가지가
    풀어 준다. 그래도 남겨 둔다. 나중에 누가 시작 위치를 바꾸면
    (예: 마지막 캠프에서 이어 하기) 그 순간 조용히 깨지는 종류의
    의존이라, 여기서 한 줄로 끊어 두는 편이 싸다. */
export function reset(): void {
  barrierHinted = false
}

/** 이 지대를 열려면 불이 몇 레벨이어야 하는가 — UI 안내용 */
export function nextGateInfo(s: GameState): { radius: number; level: number } | null {
  const cur = s.campfire.maxReachedLevel
  if (cur >= 6) return null
  const next = fireLevelDef(cur + 1)
  if (!next) return null
  return { radius: next.openRadius, level: next.lv }
}
