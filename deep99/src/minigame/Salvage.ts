/* ==================================================================
   잔해 채취 — 무한 고철 (§7.4)

   원작이 낚시를 넣어 고철을 무한히 얻게 한 것과 같은 역할이다. 후반의
   자원 병목을 **탐험이 아니라 숙련도**로 풀 수 있게 해서, 파밍이
   지루한 이동 노동이 되는 걸 막는다.

   움직이는 표시를 정확한 구간에서 멈춘다. Perfect 4 / Good 2 / Miss 0.
   누적 성공으로 채취 레벨이 오르고, 오르면 판정 구간이 넓어진다.
   그래서 "잘하게 되는 것"이 실제로 보상이 된다.

   직책 '고철상'은 판정 구간이 두 배다(§16.3).
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { addItem, toast, distance } from '../core/GameState.ts'

const S = BALANCE.salvage

/** 지금 채취 레벨의 판정 폭 (0~1 구간 기준). 표시는 중앙 0.5 를 노린다. */
export function windows(s: GameState): { perfect: number; good: number } {
  const lv = S.levels[Math.min(S.levels.length - 1, s.salvage.level)]
  const f = s.job.effects.salvageWindowFactor ?? 1
  return { perfect: lv.perfect * f, good: lv.good * f }
}

export function nearestNode(s: GameState) {
  let best = null
  let bd = BALANCE.player.interactRange
  for (const n of s.salvageNodes) {
    const d = distance(s.player.x, s.player.z, n.x, n.z)
    if (d < bd) {
      bd = d
      best = n
    }
  }
  return best
}

export function begin(s: GameState, nodeId: number): void {
  s.salvage.active = true
  s.salvage.nodeId = nodeId
  s.salvage.marker = 0
  s.salvage.dir = 1
  s.salvage.cooldown = 0
  s.salvage.lastResult = null
  s.salvage.resultT = 0
  s.events.push('salvageStart')
}

export function stop(s: GameState): void {
  s.salvage.active = false
}

export function update(s: GameState, dt: number): void {
  const sv = s.salvage
  if (sv.resultT > 0) sv.resultT = Math.max(0, sv.resultT - dt)
  if (!sv.active) return

  if (sv.cooldown > 0) {
    sv.cooldown -= dt
    return
  }

  /* 왕복 운동. 한 방향으로만 돌면 리듬을 외워 버린다. */
  sv.marker += (sv.dir * dt) / S.cycleSeconds
  if (sv.marker >= 1) {
    sv.marker = 1
    sv.dir = -1
  } else if (sv.marker <= 0) {
    sv.marker = 0
    sv.dir = 1
  }
}

export type SalvageResult = 'perfect' | 'good' | 'miss'

/** 지금 멈춘다 */
export function strike(s: GameState): SalvageResult | null {
  const sv = s.salvage
  if (!sv.active || sv.cooldown > 0) return null

  const w = windows(s)
  const off = Math.abs(sv.marker - 0.5)
  let result: SalvageResult
  let scrap = 0

  if (off <= w.perfect / 2) {
    result = 'perfect'
    scrap = S.perfectScrap
  } else if (off <= w.good / 2) {
    result = 'good'
    scrap = S.goodScrap
  } else {
    result = 'miss'
    sv.cooldown = S.missCooldown
  }

  if (scrap > 0) {
    /* 성공해도 쉰다. 이게 없으면 표시가 가운데를 지날 때마다 칠 수 있어
       분당 300 고철이 나온다 — 재 보고 알았다. §7.4 가 말한 "1회당 약
       4초"는 쿨다운이 있어야 성립하고, 그래야 잔해 채취가 병목을 푸는
       수단이지 병목을 없애는 치트가 안 된다. */
    sv.cooldown = S.successCooldown
    const left = addItem(s, 'scrap', scrap)
    if (left > 0) toast(s, '가방이 가득 찼습니다', 'warn')
    sv.successes++
    /* 누적 성공으로 레벨이 오른다 — 판정 구간이 넓어진다 */
    const need = S.successToLevelUp[sv.level]
    if (need !== undefined && sv.successes >= need) {
      sv.level++
      toast(s, `채취 숙련도 ${sv.level + 1}단계 — 판정이 넓어졌습니다`, 'good')
      s.events.push('salvageLevel')
    }
  }

  sv.lastResult = result
  sv.resultT = 0.6
  s.events.push(result === 'miss' ? 'salvageMiss' : 'salvageHit')

  /* 다음 판을 위해 표시를 되돌린다. 같은 자리에서 다시 시작하면
     리듬이 그대로라 눈감고도 맞힌다. */
  sv.marker = s.streams.loot()
  sv.dir = s.streams.loot() < 0.5 ? 1 : -1
  return result
}
