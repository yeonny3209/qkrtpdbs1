/* ==================================================================
   몬스터 동기화 — 스냅샷 코덱과 보상 귀속 규칙

   [진실은 한 곳에]
   몬스터 HP는 호스트의 Monster 컴포넌트가 소유한다. 여기에 HP를 또
   두면 두 값이 어긋나 "내 화면에선 죽었는데 친구 화면에선 살아있는"
   버그가 생기므로, 이 파일은 저장소가 아니라 전송 형식만 담당한다.

   [막타 규칙]
   HP를 0으로 만든 공격을 보낸 사람만 경험치·골드·아이템을 받는다.
   호스트가 판정해 killerId를 실어 보내고, 각자 자기 것인지 확인한다.
   ================================================================== */

const PHASE_CODE = { alive: 0, dying: 1, dead: 2 }
const PHASE_NAME = ['alive', 'dying', 'dead']

/* world.current.mobs 레지스트리 → 전송용 배열.
   좌표는 소수 2자리로 줄인다 (초당 10회 × 8마리라 누적 크기가 의미 있다). */
export function encodeMobs(mobs) {
  const out = []
  for (const m of mobs.values()) {
    out.push({
      i: m.id,
      t: m.type,
      s: m.scale === 1 ? undefined : m.scale,
      x: Math.round(m.x * 100) / 100,
      z: Math.round(m.z * 100) / 100,
      h: Math.max(0, Math.round(m.hp)),
      m: m.maxHp || undefined,             // 던전 몹은 배율 때문에 최대 HP가 다르다
      p: PHASE_CODE[m.phase] ?? 0,
      k: m.killerId || undefined,
      b: m.dbits || undefined,             // 디버프 비트 (팔로워 시각 효과용)
      r: m.rank && m.rank !== 'normal' ? m.rank : undefined,
    })
  }
  return out
}

export function decodeMobs(list) {
  return (list || []).map((m) => ({
    id: m.i,
    type: m.t,
    scale: m.s == null ? 1 : m.s,
    x: m.x,
    z: m.z,
    hp: m.h,
    maxHp: m.m || null,
    phase: PHASE_NAME[m.p] || 'alive',
    killerId: m.k || null,
    dbits: m.b || 0,
    rank: m.r || 'normal',
  }))
}

/* 몬스터 구성이 바뀌었는지 — 바뀔 때만 컴포넌트를 다시 만든다.
   위치·HP는 매 프레임 ref로 읽으므로 이걸로 리렌더를 일으키지 않는다. */
export function sameIds(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false
  return true
}

/* 이 처치가 내 보상인가. 호스트·팔로워 양쪽이 같은 함수를 쓴다. */
export function isMyKill(killerId, myId) {
  return !!killerId && killerId === myId
}
