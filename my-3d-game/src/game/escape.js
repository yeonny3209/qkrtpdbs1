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

/* ---------------- 난이도 (5단계) ----------------
   난이도는 "얼마나 빡센가"만 정한다 (잠금 개수·시간·힌트·가짜 단서·잠긴 서랍).
   실제로 어떤 장치가 나오는지와 방의 분위기는 아래 ESC_STAGES가 정한다. */
export const ESC_DIFFS = [
  {
    id: 0, name: '입문', icon: '🚪', color: '#4ade80',
    desc: '방 하나, 자물쇠 하나. 조작법을 익히는 방입니다.',
    lockCount: 1, codeLen: 3, timeLimit: 0, hints: 3, decoys: 0, keyLocks: 0, minHalf: 6,
  },
  {
    id: 1, name: '초급', icon: '🔑', color: '#38bdf8',
    desc: '잠긴 서랍이 있습니다. 열쇠부터 찾으세요.',
    lockCount: 2, codeLen: 4, timeLimit: 0, hints: 3, decoys: 1, keyLocks: 1, minHalf: 7,
  },
  {
    id: 2, name: '중급', icon: '🧩', color: '#a78bfa',
    desc: '단서가 흩어져 있고, 장치의 규칙까지 읽어내야 합니다.',
    lockCount: 3, codeLen: 4, timeLimit: 600, hints: 2, decoys: 2, keyLocks: 2, minHalf: 8,
  },
  {
    id: 3, name: '고급', icon: '🔥', color: '#fb923c',
    desc: '계산까지 해야 합니다. 시간도 넉넉하지 않습니다.',
    lockCount: 4, codeLen: 5, timeLimit: 480, hints: 1, decoys: 3, keyLocks: 2, minHalf: 9,
  },
  {
    id: 4, name: '지옥', icon: '💀', color: '#f43f5e',
    desc: '가짜 단서가 섞여 있습니다. 힌트는 없습니다.',
    lockCount: 5, codeLen: 6, timeLimit: 420, hints: 0, decoys: 5, keyLocks: 3, minHalf: 11,
  },
]
export const ESC_DIFF_BY_ID = Object.fromEntries(ESC_DIFFS.map((d) => [d.id, d]))

/* ---------------- 방 15개 — 난이도마다 3개 ----------------
   같은 난이도라도 나오는 장치 조합과 분위기가 달라서 다른 방처럼 느껴진다.
   theme: floor 바닥 · wall 벽 · ceil 천장 · accent 문/조명 강조색 · light 조명 색 */
export const ESC_STAGES = [
  /* ---- 입문: 장치를 하나씩 배운다 ---- */
  { id: 0, diffId: 0, name: '잠긴 서재', icon: '📚', desc: '숫자 자물쇠 하나. 책 사이를 뒤져보세요.',
    locks: ['keypad'],
    theme: { floor: '#3f342a', wall: '#2b3040', ceil: '#1c2029', accent: '#d8a04a', light: '#ffe8c4' } },
  { id: 1, diffId: 0, name: '색채 공방', icon: '🎨', desc: '물감통 사이 어딘가에 순서가 적혀 있습니다.',
    locks: ['colorpad'],
    theme: { floor: '#4a4038', wall: '#343a4e', ceil: '#20232e', accent: '#a855f7', light: '#f0dcff' } },
  { id: 2, diffId: 0, name: '배전반 창고', icon: '🔌', desc: '스위치를 올바르게 올려야 문이 열립니다.',
    locks: ['switchboard'],
    theme: { floor: '#34362f', wall: '#2b3134', ceil: '#1b1f21', accent: '#22c55e', light: '#dfffe4' } },

  /* ---- 초급: 장치 둘 + 잠긴 서랍 ---- */
  { id: 3, diffId: 1, name: '오래된 저택', icon: '🕯️', desc: '먼지 쌓인 가구 어딘가에 열쇠가 있습니다.',
    locks: ['keypad', 'colorpad'],
    theme: { floor: '#3d2f26', wall: '#342a3c', ceil: '#211a26', accent: '#c084fc', light: '#ffe0c0' } },
  { id: 4, diffId: 1, name: '멈춘 시계탑', icon: '🕰️', desc: '시계를 맞춰야 다음으로 넘어갑니다.',
    locks: ['clockface', 'keypad'],
    theme: { floor: '#3b3629', wall: '#2f3343', ceil: '#1e2029', accent: '#fbbf24', light: '#fff0c8' } },
  { id: 5, diffId: 1, name: '유리 온실', icon: '🪴', desc: '화분 아래를 살펴보세요. 숫자가 자랍니다.',
    locks: ['colorpad', 'dial'],
    theme: { floor: '#2f3a30', wall: '#26382f', ceil: '#182219', accent: '#4ade80', light: '#e2ffe6' } },

  /* ---- 중급: 장치 셋 ---- */
  { id: 6, diffId: 2, name: '폐병원 3층', icon: '🏥', desc: '차트와 병실 번호가 뒤섞여 있습니다.',
    locks: ['keypad', 'colorpad', 'switchboard'],
    theme: { floor: '#353c3c', wall: '#2a353b', ceil: '#1a2225', accent: '#67e8f9', light: '#dcf7ff' } },
  { id: 7, diffId: 2, name: '지하 서고', icon: '🗄️', desc: '오래된 장부의 셈이 자물쇠를 엽니다.',
    locks: ['dial', 'keypad', 'colorpad'],
    theme: { floor: '#352d24', wall: '#2b2622', ceil: '#1a1614', accent: '#eab308', light: '#ffeec2' } },
  { id: 8, diffId: 2, name: '기관실', icon: '⚙️', desc: '배전반이 둘. 어느 쪽 단서인지 잘 보세요.',
    locks: ['switchboard', 'switchboard', 'keypad'],
    theme: { floor: '#2f2f33', wall: '#35302c', ceil: '#1d1b19', accent: '#fb923c', light: '#ffe4c0' } },

  /* ---- 고급: 장치 넷 ---- */
  { id: 9, diffId: 3, name: '천문대', icon: '🔭', desc: '별자리 기록과 계산이 함께 필요합니다.',
    locks: ['keypad', 'colorpad', 'switchboard', 'dial'],
    theme: { floor: '#282a3c', wall: '#1f2233', ceil: '#141626', accent: '#818cf8', light: '#dfe3ff' } },
  { id: 10, diffId: 3, name: '감시실', icon: '📹', desc: '키패드가 둘입니다. 이름표를 확인하세요.',
    locks: ['keypad', 'keypad', 'switchboard', 'clockface'],
    theme: { floor: '#2c3230', wall: '#262b2e', ceil: '#171b1d', accent: '#f43f5e', light: '#ffdfe4' } },
  { id: 11, diffId: 3, name: '봉인된 금고실', icon: '🔐', desc: '색 자물쇠가 둘, 계산 자물쇠가 하나.',
    locks: ['colorpad', 'colorpad', 'dial', 'keypad'],
    theme: { floor: '#322b2b', wall: '#2b2527', ceil: '#1a1617', accent: '#d4d4d8', light: '#f2f2f5' } },

  /* ---- 지옥: 장치 다섯 + 가짜 단서 5개 + 힌트 0 ---- */
  { id: 12, diffId: 4, name: '심연의 방', icon: '🌑', desc: '모든 장치가 한 방에. 가짜 단서를 조심하세요.',
    locks: ['keypad', 'colorpad', 'switchboard', 'dial', 'keypad'],
    theme: { floor: '#221d2c', wall: '#181524', ceil: '#100e18', accent: '#7c3aed', light: '#ded0ff' } },
  { id: 13, diffId: 4, name: '광기의 미술관', icon: '🖼️', desc: '색 자물쇠 셋. 순서를 전부 외워야 합니다.',
    locks: ['colorpad', 'colorpad', 'colorpad', 'dial', 'keypad'],
    theme: { floor: '#2c202c', wall: '#231b26', ceil: '#151016', accent: '#db2777', light: '#ffd9ec' } },
  { id: 14, diffId: 4, name: '마지막 실험실', icon: '⚗️', desc: '다섯 장치가 전부 다릅니다. 마지막 방.',
    locks: ['keypad', 'colorpad', 'switchboard', 'dial', 'clockface'],
    theme: { floor: '#1e2628', wall: '#172022', ceil: '#0e1416', accent: '#06b6d4', light: '#d2f7ff' } },
]
export const ESC_STAGE_BY_ID = Object.fromEntries(ESC_STAGES.map((s) => [s.id, s]))
export const stagesOfDiff = (diffId) => ESC_STAGES.filter((s) => s.diffId === diffId)

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

/* 시계 — 시침과 분침을 맞춘다. 분은 5분 단위. */
export const CLOCK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
function makeClockface(rng, id) {
  const t = tagOf(id)
  const h = rint(rng, 1, 12)
  const m = CLOCK_MINUTES[ri(rng, CLOCK_MINUTES.length)]
  return {
    lock: { id, tag: t, kind: 'clockface', len: 2, answer: `${h}:${m}`, label: `[${t}] 멈춘 시계` },
    clues: [
      { lockId: id, text: `[${t}] 시침은 ${h}시를 가리켰다` },
      { lockId: id, text: `[${t}] 분침은 ${m}분을 가리켰다` },
    ],
  }
}

const MAKERS = {
  keypad: (rng, id, d) => makeKeypad(rng, id, d.codeLen),
  colorpad: (rng, id, d) => makeColorpad(rng, id, Math.min(ESC_COLORS.length, 3 + Math.floor(d.id / 2))),
  switchboard: (rng, id, d) => makeSwitchboard(rng, id, 4 + Math.floor(d.id / 2)),
  dial: (rng, id) => makeDial(rng, id),
  clockface: (rng, id) => makeClockface(rng, id),
}

/* 장치별로 "답이 확정되려면 최소 몇 개의 단서가 필요한가" */
export const minCluesFor = (lock) =>
  lock.kind === 'dial' ? 4 : lock.kind === 'clockface' ? 2 : lock.len

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
export function buildRoom(stageId, seed = Date.now()) {
  const stage = ESC_STAGE_BY_ID[stageId] || ESC_STAGES[0]
  const diff = ESC_DIFF_BY_ID[stage.diffId]
  const rng = makeRng(seed)

  /* 1) 잠금장치와 단서 */
  const locks = []
  let clues = []
  stage.locks.forEach((kind, i) => {
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
  const slotCount = propCount + locks.length
  /* 방 크기를 물건 수에서 거꾸로 구한다.
     예전엔 난이도마다 크기를 손으로 박아둬서, 방마다 물건 수가 달라지면
     모퉁이에서 소품이 겹쳤다. 이제 "항상 충분히 넓은" 크기가 보장된다.
     둘레(문 자리 제외) ÷ 슬롯 수 ≥ MIN_SLOT_GAP 이 되도록. */
  const half = +Math.max(diff.minHalf, 1.2 + (slotCount * MIN_SLOT_GAP) / (8 * (1 - DOOR_GAP))).toFixed(2)
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
    stageId: stage.id, diffId: diff.id, seed, half,
    theme: stage.theme,
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
/* 벽에 놓인 물건 사이의 최소 간격.
   모퉁이에서는 두 물건이 직각으로 꺾여 직선거리가 약 0.71배로 줄어든다.
   소품 충돌 지름이 1.24m이므로 1.24 / 0.71 ≈ 1.75 보다 넉넉해야 한다. */
const MIN_SLOT_GAP = 1.9
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
    if (mine.length < minCluesFor(lock)) return false
  }
  return true
}
