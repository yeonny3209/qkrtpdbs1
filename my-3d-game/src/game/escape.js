/* ==================================================================
   방탈출 — 난이도 정의와 방 생성 (순수 로직, Node에서 그대로 테스트 가능)

   [설계]
   방 하나에 "잠금장치(lock)" 여러 개가 걸려 있고, 전부 풀면 문이 열린다.
   답은 방 안에 그냥 적혀 있지 않다 — 소품(prop)을 조사해 얻은 단서를
   조합해야 나온다. 그래서 생성기는 항상 두 가지를 함께 만든다.
     1) 정답
     2) 그 정답을 되짚을 수 있는 단서들 (전부 방 안에 배치)

   일부 소품은 잠겨 있고, 열쇠는 다른 소품 안에 있다. 열쇠가 열쇠를 여는
   사슬이 생길 수는 있어도 서로를 잠그는 순환은 생기지 않아야 한다.
   solvable() 이 실제로 "빈손으로 시작해 전부 열 수 있는가"를 시뮬레이션해
   검증하므로, 풀 수 없는 방은 만들어지지 않는다.

   난이도는 방 크기·잠금 개수·잠금 종류로 구분한다 (사용자 확정: 5단계).
   ================================================================== */

/* ---------------- 시드 난수 (재현 가능 = 테스트 가능) ---------------- */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const ri = (rng, n) => Math.floor(rng() * n)                 // 0..n-1
const rint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))
function shuffled(rng, arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(rng, i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------------- 난이도 (5단계) ---------------- */
export const ESC_DIFFS = [
  {
    id: 0, name: '입문', icon: '🚪', color: '#4ade80',
    desc: '방 하나, 자물쇠 하나. 조작법을 익히는 방입니다.',
    half: 6, locks: ['keypad'], codeLen: 3, timeLimit: 0, hints: 3, decoys: 0, keyLocks: 0,
  },
  {
    id: 1, name: '초급', icon: '🔑', color: '#38bdf8',
    desc: '잠긴 서랍이 있습니다. 열쇠부터 찾으세요.',
    half: 7, locks: ['keypad', 'colorpad'], codeLen: 4, timeLimit: 0, hints: 3, decoys: 1, keyLocks: 1,
  },
  {
    id: 2, name: '중급', icon: '🧩', color: '#a78bfa',
    desc: '단서가 흩어져 있고, 스위치의 규칙까지 읽어내야 합니다.',
    half: 8, locks: ['keypad', 'colorpad', 'switchboard'], codeLen: 4, timeLimit: 600, hints: 2, decoys: 2, keyLocks: 2,
  },
  {
    id: 3, name: '고급', icon: '🔥', color: '#fb923c',
    desc: '계산까지 해야 합니다. 시간도 넉넉하지 않습니다.',
    half: 9, locks: ['keypad', 'colorpad', 'switchboard', 'dial'], codeLen: 5, timeLimit: 480, hints: 1, decoys: 3, keyLocks: 2,
  },
  {
    id: 4, name: '지옥', icon: '💀', color: '#f43f5e',
    desc: '가짜 단서가 섞여 있습니다. 힌트는 없습니다.',
    /* 소품이 34개나 되므로 방이 좁으면 모퉁이에서 서로 겹친다 — 그래서 가장 넓다 */
    half: 11, locks: ['keypad', 'colorpad', 'switchboard', 'dial', 'keypad'], codeLen: 6, timeLimit: 420, hints: 0, decoys: 5, keyLocks: 3,
  },
]
export const ESC_DIFF_BY_ID = Object.fromEntries(ESC_DIFFS.map((d) => [d.id, d]))

/* ---------------- 색 (colorpad) ---------------- */
export const ESC_COLORS = [
  { key: 'r', name: '빨강', hex: '#ef4444' },
  { key: 'y', name: '노랑', hex: '#eab308' },
  { key: 'g', name: '초록', hex: '#22c55e' },
  { key: 'b', name: '파랑', hex: '#3b82f6' },
  { key: 'p', name: '보라', hex: '#a855f7' },
]

/* ---------------- 소품 종류 ----------------
   wall: 벽에 거는 물건. 벽면까지 밀어 붙여 그리고, 몸으로 부딪히지 않는다. */
export const PROP_KINDS = [
  { kind: 'desk', name: '책상', lockable: true, wall: false },
  { kind: 'cabinet', name: '캐비닛', lockable: true, wall: false },
  { kind: 'shelf', name: '책장', lockable: false, wall: false },
  { kind: 'painting', name: '액자', lockable: false, wall: true },
  { kind: 'clock', name: '벽시계', lockable: false, wall: true },
  { kind: 'crate', name: '나무 상자', lockable: true, wall: false },
  { kind: 'plant', name: '화분', lockable: false, wall: false },
  { kind: 'lamp', name: '스탠드', lockable: false, wall: false },
]
export const PROP_BY_KIND = Object.fromEntries(PROP_KINDS.map((p) => [p.kind, p]))

/* ==================================================================
   잠금장치 생성 — 정답과 "그 정답으로 이어지는 단서"를 함께 만든다
   ================================================================== */

/* 잠금장치 이름표.
   지옥 난이도처럼 같은 종류가 두 개 있으면 "키패드 3번째 자리는 7" 이라는 단서가
   어느 키패드 것인지 알 수 없다. 그래서 장치마다 기호를 붙이고 단서에도 같이 적는다. */
export const LOCK_TAGS = ['가', '나', '다', '라', '마']
const tagOf = (id) => LOCK_TAGS[id] || `#${id + 1}`

/* 키패드 — N자리 숫자. 단서는 "n번째 자리는 d" 로 쪼개 흩뿌린다. */
function makeKeypad(rng, id, len) {
  const t = tagOf(id)
  const digits = Array.from({ length: len }, () => ri(rng, 10))
  return {
    lock: { id, tag: t, kind: 'keypad', len, answer: digits.join(''), label: `[${t}] ${len}자리 키패드` },
    clues: digits.map((d, i) => ({ lockId: id, text: `[${t}] 키패드 ${i + 1}번째 자리는 ${d}` })),
  }
}

/* 색 버튼 — 순서대로 눌러야 한다. */
function makeColorpad(rng, id, len) {
  const t = tagOf(id)
  const seq = shuffled(rng, ESC_COLORS).slice(0, len)
  return {
    lock: { id, tag: t, kind: 'colorpad', len, answer: seq.map((c) => c.key).join(''), label: `[${t}] 색 버튼 ${len}개` },
    clues: seq.map((c, i) => ({ lockId: id, text: `[${t}] ${i + 1}번째로 누를 색은 ${c.name}` })),
  }
}

/* 스위치 — 올릴 자리를 맞춘다. 전부 같은 방향이면 퍼즐이 아니므로 섞는다. */
function makeSwitchboard(rng, id, len) {
  const t = tagOf(id)
  const bits = Array.from({ length: len }, () => (rng() < 0.5 ? 1 : 0))
  if (bits.every((b) => b === 0)) bits[ri(rng, len)] = 1
  if (bits.every((b) => b === 1)) bits[ri(rng, len)] = 0
  return {
    lock: { id, tag: t, kind: 'switchboard', len, answer: bits.join(''), label: `[${t}] 스위치 ${len}개` },
    clues: bits.map((b, i) => ({ lockId: id, text: `[${t}] ${i + 1}번 스위치는 ${b ? '올림' : '내림'}` })),
  }
}

/* 다이얼 — 계산 결과를 맞춘다. */
function makeDial(rng, id) {
  const t = tagOf(id)
  const a = rint(rng, 2, 12)
  const b = rint(rng, 2, 12)
  const c = rint(rng, 1, 30)
  const answer = String(a * b + c)
  return {
    lock: { id, tag: t, kind: 'dial', len: answer.length, answer, label: `[${t}] 숫자 다이얼`, max: 999 },
    clues: [
      { lockId: id, text: `[${t}] 벽에 새겨진 식: (첫째 수 × 둘째 수) + 셋째 수` },
      { lockId: id, text: `[${t}] 첫째 수 = ${a}` },
      { lockId: id, text: `[${t}] 둘째 수 = ${b}` },
      { lockId: id, text: `[${t}] 셋째 수 = ${c}` },
    ],
  }
}

const MAKERS = {
  keypad: (rng, id, d) => makeKeypad(rng, id, d.codeLen),
  colorpad: (rng, id, d) => makeColorpad(rng, id, Math.min(ESC_COLORS.length, 3 + Math.floor(d.id / 2))),
  switchboard: (rng, id, d) => makeSwitchboard(rng, id, 4 + Math.floor(d.id / 2)),
  dial: (rng, id) => makeDial(rng, id),
}

/* 가짜 단서 — 어떤 잠금과도 이어지지 않는다 (높은 난이도의 함정) */
const DECOY_TEXTS = [
  '누군가 낙서했다: "여긴 아니야"',
  '빛바랜 메모 — 숫자가 지워져 읽을 수 없다',
  '찢어진 종이 조각. 다른 방의 것 같다',
  '오래된 영수증. 아무 의미 없어 보인다',
  '뒤집힌 카드. 뒷면은 비어 있다',
  '먼지뿐이다',
  '"거짓말쟁이의 단서를 믿지 마라"',
]

/* ==================================================================
   방 생성
   ================================================================== */
export function buildRoom(diffId, seed = Date.now()) {
  const diff = ESC_DIFF_BY_ID[diffId] || ESC_DIFFS[0]
  const rng = makeRng(seed)

  /* 1) 잠금장치와 단서 */
  const locks = []
  let clues = []
  diff.locks.forEach((kind, i) => {
    const made = MAKERS[kind](rng, i, diff)
    locks.push(made.lock)
    clues = clues.concat(made.clues)
  })

  /* 2) 가짜 단서 섞기 */
  for (let i = 0; i < diff.decoys; i++) {
    clues.push({ lockId: null, text: DECOY_TEXTS[ri(rng, DECOY_TEXTS.length)] })
  }
  clues = shuffled(rng, clues)

  /* 3) 벽 자리 나누기 — 소품과 잠금장치가 같은 자리에 겹치면
        소품이 잠금장치를 가려서 조작할 수 없게 된다. 그래서 둘레를
        (소품 수 + 잠금 수)개의 슬롯으로 쪼개고, 잠금장치에 먼저
        고르게 떨어진 슬롯을 준 뒤 나머지를 소품이 채운다. */
  const propCount = clues.length + 2
  const half = diff.half
  const slotCount = propCount + locks.length
  const lockSlots = new Set(locks.map((_, i) => Math.round((i * slotCount) / locks.length) % slotCount))
  /* 반올림이 겹치면 빈 슬롯으로 밀어 항상 잠금 수만큼 확보한다 */
  for (let s = 0; lockSlots.size < locks.length; s++) lockSlots.add(s % slotCount)
  const lockSlotList = [...lockSlots].sort((a, b) => a - b)
  const propSlots = []
  for (let s = 0; s < slotCount; s++) if (!lockSlots.has(s)) propSlots.push(s)

  const props = []
  for (let i = 0; i < propCount; i++) {
    const { x, z, ry } = wallSlot((propSlots[i] + 0.5) / slotCount, half - 1.2)
    const kindDef = PROP_KINDS[ri(rng, PROP_KINDS.length)]
    props.push({
      id: i,
      kind: kindDef.kind,
      name: kindDef.name,
      wall: !!kindDef.wall,                 // 벽걸이는 벽면까지 붙이고 충돌은 없다
      x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(3),
      clue: clues[i] ? clues[i].text : null,
      lockId: clues[i] ? clues[i].lockId : null,
      locked: false, needKey: null, item: null, searched: false,
    })
  }

  /* 4) 잠긴 소품 + 열쇠.
        열쇠는 "아직 잠기지 않은" 소품에만 넣는다 → 서로를 잠그는 순환이 생기지 않는다.
        (사슬은 허용된다: 열쇠1로 연 상자에서 열쇠2가 나오는 식) */
  const keys = []
  const lockable = props
    .filter((p) => PROP_BY_KIND[p.kind].lockable && p.clue)
    .map((p) => p.id)
  const wanted = Math.min(diff.keyLocks, Math.max(0, lockable.length - 1))
  shuffled(rng, lockable).slice(0, wanted).forEach((idx, n) => {
    const hosts = props.filter((p) => !p.locked && !p.item && p.id !== idx).map((p) => p.id)
    if (!hosts.length) return
    const keyId = `key${n}`
    props[idx].locked = true
    props[idx].needKey = keyId
    const hostId = hosts[ri(rng, hosts.length)]
    props[hostId].item = { id: keyId, name: `열쇠 ${n + 1}`, opens: idx }
    keys.push({ id: keyId, hostProp: hostId, opensProp: idx })
  })

  /* 5) 잠금장치는 자기 몫으로 비워 둔 슬롯의 벽면에 붙인다 (눈높이) */
  locks.forEach((lk, i) => {
    const { x, z, ry } = wallSlot((lockSlotList[i] + 0.5) / slotCount, half - 0.22)
    lk.x = +x.toFixed(2); lk.z = +z.toFixed(2); lk.ry = +ry.toFixed(3)
    lk.solved = false
  })

  return {
    diffId: diff.id, seed, half,
    timeLimit: diff.timeLimit, hints: diff.hints,
    props, locks, keys,
    door: { x: 0, z: -half },
  }
}

/* 벽 둘레 t(0..1) → 좌표.

   둘레를 "실제 길이"로 걷는다. 네 변에 t를 1/4씩 나눠주면 모퉁이에서
   두 변의 끝 슬롯이 같은 지점으로 몰려 물건이 겹친다 — 그래서 호 길이로
   매개화해 t 간격이 곧 실제 간격이 되게 했다.
   북쪽 중앙의 문 주변(둘레의 12%)은 비워 둔다. */
const DOOR_U = 0.625          // 둘레를 한 바퀴 돌 때 북쪽 벽 중앙이 나오는 지점
const DOOR_GAP = 0.12
export function wallSlot(t, r) {
  const u = ((DOOR_U + DOOR_GAP / 2 + (((t % 1) + 1) % 1) * (1 - DOOR_GAP)) % 1 + 1) % 1
  const s = u * 8 * r                       // 둘레 위 이동 거리
  /* ry = 그 벽의 "안쪽 방향" — 모델은 +Z가 정면이다.
     방 중앙을 향하게 하면 모퉁이 근처 물건이 비스듬히 서서 벽을 파고든다. */
  if (s < 2 * r) return { x: -r + s, z: r, ry: Math.PI }              // 남 → 북쪽을 본다
  if (s < 4 * r) return { x: r, z: r - (s - 2 * r), ry: -Math.PI / 2 } // 동 → 서쪽
  if (s < 6 * r) return { x: r - (s - 4 * r), z: -r, ry: 0 }          // 북 → 남쪽
  return { x: -r, z: -r + (s - 6 * r), ry: Math.PI / 2 }              // 서 → 동쪽
}

/* ==================================================================
   판정
   ================================================================== */
export const checkLock = (lock, input) => String(input) === String(lock.answer)
export const allSolved = (room) => room.locks.every((l) => l.solved)
export const solvedCount = (room) => room.locks.filter((l) => l.solved).length
export const roomProgress = (room) => ({ solved: solvedCount(room), total: room.locks.length })

/* 이 방을 빈손으로 시작해 실제로 끝까지 풀 수 있는가.
   1) 열 수 있는 소품을 열어 열쇠를 모으는 것을 더 이상 진행이 없을 때까지 반복
   2) 그렇게 해서 모든 소품을 열 수 있어야 하고
   3) 모든 잠금이 단서만으로 답이 확정돼야 한다 */
export function solvable(room) {
  /* 1~2) 열쇠 사슬을 실제로 따라가 본다 */
  const opened = new Set()
  const held = new Set()
  for (let guard = 0; guard <= room.props.length + 1; guard++) {
    let progressed = false
    for (const p of room.props) {
      if (opened.has(p.id)) continue
      if (p.locked && !held.has(p.needKey)) continue
      opened.add(p.id)
      if (p.item) held.add(p.item.id)
      progressed = true
    }
    if (!progressed) break
  }
  if (opened.size !== room.props.length) return false

  /* 3) 각 잠금의 답이 단서로 확정되는가 */
  for (const lock of room.locks) {
    const mine = room.props.filter((p) => p.lockId === lock.id)
    if (!mine.length) return false
    /* 자리별 단서를 쓰는 잠금은 자리 수만큼 단서가 다 있어야 한다 */
    if (lock.kind !== 'dial' && mine.length < lock.len) return false
    if (lock.kind === 'dial' && mine.length < 4) return false
  }
  return true
}
