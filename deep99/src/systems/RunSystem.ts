/* ==================================================================
   런의 시작과 끝 (§17)

   §18 의 첫 줄이 이 파일의 존재 이유다 — **99일에 게임이 확실히
   끝난다.** 원작의 난이도 붕괴(숙련자가 1000일도 쉽게 넘겨 목표가
   사라지는 것)를 피하려면, 재미가 "얼마나 오래"가 아니라 "얼마나
   빨리"로 측정되어야 한다.

   99일에 장비가 모자라면 25일 뒤 다음 창을 기다린다. 그리고 엔딩이
   셋으로 갈린다(§17.2) — 정시에 대원 전원이면 완전 귀환, 일부면 부분
   귀환, 124일 이후면 지연 귀환. 대원을 구할 이유가 날짜 가속만이
   아니게 된다.
   ================================================================== */
import { BALANCE, CREW } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { createRun, toast, type NewRunOptions } from '../core/GameState.ts'
import { generate } from '../world/MapGen.ts'
import { populateInitial } from '../entities/Animal.ts'
import { reset as resetGate } from '../world/ZoneGate.ts'
import type { Solid } from '../world/Tilemap.ts'
import type { SaveData } from '../core/SaveData.ts'

export const ESCAPE_PARTS = ['escape_radar', 'escape_landing', 'escape_launch', 'escape_fuel']

export type Ending = 'full' | 'partial' | 'late'

export function startRun(opts: NewRunOptions): { state: GameState; solids: Solid[] } {
  resetGate()
  const state = createRun(opts)
  const { solids } = generate(state)
  populateInitial(state)
  return { state, solids }
}

export function escapeReady(s: GameState): boolean {
  return s.dockBuilt && ESCAPE_PARTS.every((p) => s.escapeBuilt.includes(p))
}

/** 지금 열려 있는 궤도 정렬 창. 99, 124, 149 … */
export function currentWindow(day: number): number {
  const t = BALANCE.time
  if (day <= t.targetDay) return t.targetDay
  const over = day - t.targetDay
  return t.targetDay + Math.ceil(over / t.orbitWindowStride) * t.orbitWindowStride
}

export function nextWindowIn(s: GameState): number {
  return Math.max(0, currentWindow(s.day) - s.day)
}

/** §17.2 — 언제 떠났고 몇 명을 데려가는가로 엔딩이 갈린다 */
export function endingFor(s: GameState): Ending {
  if (s.day > BALANCE.time.targetDay) return 'late'
  return s.crew.length >= CREW.length ? 'full' : 'partial'
}

/** 일출마다 본다. 창이 열려 있고 장비가 다 있으면 이륙. */
export function checkEscape(s: GameState): boolean {
  if (s.day < BALANCE.time.targetDay) return false
  if (!escapeReady(s)) {
    /* 오늘이 그 창이었다면 nextWindowIn 은 0 이다. 그때는 오늘을 놓친
       것이므로 그 다음 정렬까지를 알려 준다 — 안 그러면 99일 아침에
       아무 말도 없이 창이 지나간다. */
    const days = nextWindowIn(s) || currentWindow(s.day + 1) - s.day
    toast(s, `궤도 정렬 실패. 다음 창까지 ${days}일`, 'danger')
    return false
  }
  s.phase = 'escaped'
  s.events.push('escape')
  return true
}

export function blackboxGain(s: GameState): number {
  const b = BALANCE.blackbox
  const base = s.day * b.perDay
    + s.crew.length * b.perCrew
    + s.moduleLevel * b.perCraftLevel
    + s.campfire.maxReachedLevel * b.perFireLevel
    + (s.phase === 'escaped' ? b.escapeBonus : 0)
  /* 어려운 행성일수록 더 준다(§16.4) */
  return Math.round(base * s.modifier.multiplier)
}

export function rankFor(minutes: number): string {
  for (const r of BALANCE.ranks) {
    if (minutes < r.maxMinutes) return r.rank
  }
  return 'D'
}

export const DEATH_TEXT: Record<string, string> = {
  spider: '외계 거미와의 접촉',
  spider_hungry: '굶주린 거미와의 접촉',
  suit: '우주복 파손',
  oxygen: '산소 고갈',
  hunger: '아사',
  asteroid: '소행성 충돌',
  beast: '야생 동물의 공격',
  raider: '약탈자의 공격',
  storm: '자기폭풍 낙뢰',
}

export const ENDING_TEXT: Record<Ending, { title: string; line: string }> = {
  full: { title: '완전 귀환', line: '다섯 명 모두 지구를 밟았다.' },
  partial: { title: '부분 귀환', line: '남겨진 대원의 무전이 궤도에서 끊겼다.' },
  late: { title: '지연 귀환', line: '지구는 이미 수색을 종료한 뒤였다.' },
}

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
      job: s.job.name,
      modifier: s.modifier.name,
      minutes: Math.round(minutes * 10) / 10,
      rank: rankFor(minutes),
      day: s.day,
      ending: endingFor(s),
    })
    next.leaderboard.sort((a, b) => a.minutes - b.minutes)
    next.leaderboard = next.leaderboard.slice(0, 10)
  }
  return next
}
