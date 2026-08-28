/* ==================================================================
   메타 진행 (블랙박스 · 직책 해금)

   §16.1 대로 **런 상태는 저장하지 않는다.** 죽으면 끝이다. 저장되는
   것은 블랙박스 잔고와 해금한 직책, 리더보드뿐이다.

   §21.1 의 주의사항대로 localStorage 가 없는 환경에서도 돌아가야 하므로
   접근을 한 겹 감싸고, 실패하면 메모리로 물러난다. 저장이 안 되는 것이
   게임이 안 도는 것보다는 낫다.
   ================================================================== */

export type LeaderRow = {
  seed: string
  job: string
  modifier: string
  minutes: number
  rank: string
  day: number
  ending: string
}

export type SaveData = {
  blackbox: number
  jobs: string[]
  runs: number
  bestDay: number
  escapes: number
  leaderboard: LeaderRow[]
}

const KEY = 'deep99.save.v1'

const EMPTY: SaveData = {
  blackbox: 0,
  jobs: ['pilot'],
  runs: 0,
  bestDay: 0,
  escapes: 0,
  leaderboard: [],
}

let memory: SaveData | null = null

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage
    /* 존재만으로는 모자라다 — 비공개 모드처럼 쓰기에서 던지는 경우가
       있어서 실제로 한 번 써 본다. */
    const probe = '__deep99probe'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function load(): SaveData {
  const st = storage()
  if (!st) return memory ?? (memory = { ...EMPTY })
  try {
    const raw = st.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw) as Partial<SaveData>
    return {
      blackbox: p.blackbox ?? 0,
      jobs: p.jobs?.length ? p.jobs : ['pilot'],
      runs: p.runs ?? 0,
      bestDay: p.bestDay ?? 0,
      escapes: p.escapes ?? 0,
      leaderboard: p.leaderboard ?? [],
    }
  } catch {
    return { ...EMPTY }
  }
}

export function save(data: SaveData): void {
  const st = storage()
  if (!st) {
    memory = data
    return
  }
  try {
    st.setItem(KEY, JSON.stringify(data))
  } catch {
    memory = data
  }
}

export function reset(): void {
  memory = { ...EMPTY }
  const st = storage()
  if (st) {
    try {
      st.removeItem(KEY)
    } catch {
      /* 못 지우면 메모리 쪽만 비운다 */
    }
  }
}
