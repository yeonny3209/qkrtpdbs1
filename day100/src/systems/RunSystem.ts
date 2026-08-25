/* ==================================================================
   런의 시작과 끝

   §15 의 승리 조건과 §14.2 의 블랙박스 계산이 여기 있다.

   §0-9 에서 확정한 것: 100일에 도달했는데 장비가 모자라면 끝이 아니라
   **25일 뒤 다음 창**을 기다린다. 원본의 "100일이 목표"만으로는
   99일에 장비를 못 갖춘 플레이어에게 무슨 일이 벌어지는지가 비어
   있었다. 기다리게 하면 후반이 벼락치기가 되어 오히려 팽팽해진다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { createRun, toast, type NewRunOptions } from '../core/GameState.ts'
import { generate } from '../world/MapGen.ts'
import { populateInitial } from '../entities/Animal.ts'
import type { Solid } from '../world/Tilemap.ts'
import type { SaveData } from '../core/SaveData.ts'

export const ESCAPE_PARTS = ['escape_radar', 'escape_landing', 'escape_launch', 'escape_fuel']

export function startRun(opts: NewRunOptions): { state: GameState; solids: Solid[] } {
  const state = createRun(opts)
  const { solids } = generate(state)
  populateInitial(state)
  return { state, solids }
}

export function escapeReady(s: GameState): boolean {
  return s.dockBuilt && ESCAPE_PARTS.every((p) => s.escapeBuilt.includes(p))
}

/** 지금 열려 있는 궤도 정렬 창. 100, 125, 150 … */
export function currentWindow(day: number): number {
  const t = BALANCE.time
  if (day < t.targetDay) return t.targetDay
  const over = day - t.targetDay
  return t.targetDay + Math.ceil(over / t.orbitWindowStride) * t.orbitWindowStride
}

export function nextWindowIn(s: GameState): number {
  return Math.max(0, currentWindow(s.day) - s.day)
}

/** 일출마다 본다. 창이 열려 있고 장비가 다 있으면 이륙. */
export function checkEscape(s: GameState): boolean {
  if (s.day < BALANCE.time.targetDay) return false
  if (!escapeReady(s)) {
    /* 창을 놓쳤다. 다음 창까지 기다린다(§15.1). */
    const next = currentWindow(s.day)
    if (s.day >= BALANCE.time.targetDay && s.day <= next) {
      toast(s, `궤도 정렬 실패. 다음 창까지 ${next - s.day}일`, 'warn')
    }
    return false
  }
  s.phase = 'escaped'
  s.events.push('escape')
  return true
}

export function blackboxGain(s: GameState): number {
  const b = BALANCE.blackbox
  return Math.round(
    s.day * b.perDay
    + s.coreParts.length * b.perCorePart
    + s.craftLevel * b.perCraftLevel
    + (s.phase === 'escaped' ? b.escapeBonus : 0),
  )
}

export function rankFor(minutes: number): string {
  for (const r of BALANCE.ranks) {
    if (minutes < r.maxMinutes) return r.rank
  }
  return 'D'
}

export const DEATH_TEXT: Record<string, string> = {
  spider: '외계 거미와의 접촉',
  suit: '우주복 파손',
  oxygen: '산소 고갈',
  hunger: '아사',
  asteroid: '소행성 충돌',
  beast: '야생 동물의 공격',
}

/** 런이 끝났을 때 저장 데이터를 갱신한다. */
export function commitRun(s: GameState, data: SaveData): SaveData {
  const gain = blackboxGain(s)
  const minutes = s.elapsed / 60
  const next: SaveData = {
    ...data,
    blackbox: data.blackbox + gain,
    runs: data.runs + 1,
    bestDay: Math.max(data.bestDay, s.day),
    escapes: data.escapes + (s.phase === 'escaped' ? 1 : 0),
    leaderboard: data.leaderboard.slice(),
  }
  if (s.phase === 'escaped') {
    next.leaderboard.push({
      seed: s.seed,
      modifier: s.modifier.name,
      minutes: Math.round(minutes * 10) / 10,
      rank: rankFor(minutes),
      day: s.day,
    })
    next.leaderboard.sort((a, b) => a.minutes - b.minutes)
    next.leaderboard = next.leaderboard.slice(0, 10)
  }
  return next
}
