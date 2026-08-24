/* ==================================================================
   격자 맵 — 그림으로 그리는 배치

   맵을 손으로 좌표를 찍어 만들면, 눈으로는 멀쩡해 보이는 배치가
   물리를 깨뜨린다. 앞서 열 장을 그렇게 만들었다가 다섯 장에서
   결함이 나왔다 — 벽끼리 겹쳐 닫힌 고리가 되거나, 지나갈 수 없는
   0.7 짜리 틈이 생기거나.

   그래서 격자에 올린다. 핵심은 하나다.

     칸 크기를 MIN_GAP 보다 크게 잡고 모든 상자가 칸을 통째로
     차지하면, 상자 사이의 틈은 반드시 칸 크기의 배수가 된다.
     즉 0 이거나 자동으로 규격 이상이다.

   "틈이 어중간하지 않은지" 를 더 이상 검사가 아니라 구조로 보장한다.
   30x30 을 12x12 칸으로 나누면 칸이 2.5 — MIN_GAP(2.0)보다 크다.

   덕분에 맵을 글자 그림으로 적을 수 있다. 좌표를 세는 대신 보이는
   대로 그리면 되고, 코드를 읽는 사람도 배치가 한눈에 들어온다.

     .  바닥          #  벽
     =  통로(단)      S  적이 나오는 자리
     P  보급품 자리
     > < v ^  계단 — 화살표 쪽으로 올라간다 (그 옆이 통로여야 한다)

   글자 하나가 한 칸이고, 위쪽 줄이 -z 다.
   ================================================================== */
import { ARENA, CATWALK_H, STEP_RISE, toBox } from './arena.js'

export const GRID = 12
export const CELL = (ARENA.half * 2) / GRID     // 2.5 — MIN_GAP(2.0)보다 크다

const WALL_H = 3.8      // 통로에서 점프해도 못 오르는 높이

/* 칸 → 월드 좌표. 칸의 한가운데. */
export function cellCenter(col, row) {
  return {
    x: -ARENA.half + (col + 0.5) * CELL,
    z: -ARENA.half + (row + 0.5) * CELL,
  }
}

/* 글자 그림을 칸 배열로. 줄 수·글자 수가 안 맞으면 바로 알려준다 —
   한 글자가 밀리면 맵 전체가 조용히 어긋난다. */
export function parseGrid(rows, id) {
  if (rows.length !== GRID) {
    throw new Error(`${id}: 줄이 ${rows.length} 개다. ${GRID} 줄이어야 한다`)
  }
  return rows.map((line, r) => {
    if (line.length !== GRID) {
      throw new Error(`${id}: ${r} 번째 줄이 ${line.length} 글자다. ${GRID} 글자여야 한다`)
    }
    return [...line]
  })
}

/* 같은 글자끼리 큰 사각형으로 묶는다.

   칸마다 상자를 하나씩 만들면 12x12 맵에서 상자가 100개를 넘고,
   충돌은 매 프레임 적마다 상자를 전부 훑는다. 붙어 있는 칸을 묶으면
   보통 10~20 개로 줄어든다 — 보이는 모양은 똑같다.

   오른쪽으로 최대한 늘린 뒤, 같은 폭이 이어지는 만큼 아래로 늘리는
   단순한 방식이다. 최적은 아니지만 직사각형 배치에서는 거의 최적이고,
   무엇보다 결과를 눈으로 따라갈 수 있다. */
export function mergeRects(cells, match) {
  const used = cells.map((row) => row.map(() => false))
  const rects = []

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (used[r][c] || !match(cells[r][c])) continue

      let w = 1
      while (c + w < GRID && !used[r][c + w] && match(cells[r][c + w])) w++

      let h = 1
      outer: while (r + h < GRID) {
        for (let i = 0; i < w; i++) {
          if (used[r + h][c + i] || !match(cells[r + h][c + i])) break outer
        }
        h++
      }

      for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) used[r + dr][c + dc] = true
      rects.push({ c, r, w, h })
    }
  }
  return rects
}

function rectToBox(rect, height) {
  const x0 = -ARENA.half + rect.c * CELL
  const z0 = -ARENA.half + rect.r * CELL
  return {
    x: x0 + (rect.w * CELL) / 2,
    z: z0 + (rect.h * CELL) / 2,
    w: rect.w * CELL,
    d: rect.h * CELL,
    h: height,
  }
}

/* 계단 — 묶인 사각형을 화살표 방향으로 네 칸 올린다.

   한 칸 높이가 STEP_RISE(0.4)라 네 계단이면 1.6 이고, 그 위 통로가
   2.0 이다. 마지막 계단에서 통로까지도 한 걸음이라 걸어 올라간다. */
const RAMP_DIRS = {
  '>': { dx: 1, dz: 0 },
  '<': { dx: -1, dz: 0 },
  v: { dx: 0, dz: 1 },
  '^': { dx: 0, dz: -1 },
}

function rampBoxes(rect, dir) {
  const steps = Math.round(CATWALK_H / STEP_RISE) - 1     // 4
  const { dx, dz } = RAMP_DIRS[dir]
  const x0 = -ARENA.half + rect.c * CELL
  const z0 = -ARENA.half + rect.r * CELL
  const spanX = rect.w * CELL
  const spanZ = rect.h * CELL

  return Array.from({ length: steps }, (_, i) => {
    /* i 가 클수록 높고, 화살표 쪽(통로 쪽)에 가깝다 */
    const t = i / steps
    if (dx !== 0) {
      const run = spanX / steps
      const cx = dx > 0 ? x0 + t * spanX + run / 2 : x0 + spanX - t * spanX - run / 2
      return { x: cx, z: z0 + spanZ / 2, w: run, d: spanZ, h: STEP_RISE * (i + 1) }
    }
    const run = spanZ / steps
    const cz = dz > 0 ? z0 + t * spanZ + run / 2 : z0 + spanZ - t * spanZ - run / 2
    return { x: x0 + spanX / 2, z: cz, w: spanX, d: run, h: STEP_RISE * (i + 1) }
  })
}

/* 글자 그림 하나를 맵 재료로 바꾼다 */
export function buildGrid(rows, id) {
  const cells = parseGrid(rows, id)

  const cover = [
    ...mergeRects(cells, (ch) => ch === '#').map((r) => rectToBox(r, WALL_H)),
    ...mergeRects(cells, (ch) => ch === '=').map((r) => rectToBox(r, CATWALK_H)),
  ]

  const stairs = []
  for (const dir of Object.keys(RAMP_DIRS)) {
    for (const rect of mergeRects(cells, (ch) => ch === dir)) {
      stairs.push(...rampBoxes(rect, dir))
    }
  }

  const spawns = []
  const pickups = []
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (cells[r][c] === 'S') spawns.push(cellCenter(c, r))
      if (cells[r][c] === 'P') pickups.push(cellCenter(c, r))
    }
  }

  return { cover, stairs, spawns, pickups, cells }
}

/* 격자 맵도 손으로 만든 맵과 같은 모양으로 내보낸다 */
export function gridMap({ id, name, blurb, rows }) {
  const g = buildGrid(rows, id)
  return {
    id,
    name,
    blurb,
    cover: g.cover,
    stairs: g.stairs,
    spawns: g.spawns,
    pickups: g.pickups.map((p) => [p.x, p.z]),
    /* 격자 맵은 언제나 한가운데에서 시작한다. 가운데 네 칸은
       비어 있어야 하고, 그건 테스트가 검사한다. */
    playerStart: { x: 0, z: 0 },
  }
}

export { toBox }
