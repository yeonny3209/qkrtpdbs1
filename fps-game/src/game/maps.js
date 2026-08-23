/* ==================================================================
   맵 열 장

   판마다 하나가 무작위로 뽑힌다. 아레나 크기(30×30)와 담장은 모두
   같고, 안에 무엇이 서 있는지만 다르다. 같은 규칙 위에서 배치만
   갈리기 때문에, 새 맵을 넣어도 충돌·길찾기·사격이 전부 그대로
   굴러간다.

   ── 지켜야 할 선 ────────────────────────────────────────────────
   배치는 취향 문제처럼 보이지만 실제로는 물리를 깨뜨릴 수 있다.
   아래 넷은 전부 테스트가 열 장 모두에 대해 검사한다.

     1. 막는 상자 사이의 틈은 0(붙어 있음)이거나 MIN_GAP 이상.
        어중간한 틈에 낀 것은 양쪽에서 번갈아 밀려 결국 벽을 뚫는다.
     2. 통로(높이 2)는 바닥에서 점프해 못 닿아야 한다. 닿으면 계단이
        장식이 되고, 길목이라는 설계가 사라진다.
     3. 엄폐물은 통로에서 점프해도 못 올라갈 높이여야 한다. 적이 못
        닿는 자리가 생기면 그 판은 거기서 끝난다.
     4. 모든 스폰 지점에서 플레이어에게 닿는 길이 있어야 한다.

   그래서 좌표를 눈대중으로 흩뿌리지 않고, 아래 helper 로 짠다.
   ================================================================== */
import { ARENA, CATWALK_H, STEP_RISE, STEP_RUN, toBox, perimeterCover } from './arena.js'

/* ── 조각 만들기 ────────────────────────────────────────────────── */

const WALL_H = 3.8        // 엄폐물 기본 높이 — 통로에서 점프해도 못 오른다

/* 막는 벽/기둥 */
export function wall(x, z, w, d, h = WALL_H) {
  return { x, z, w, d, h }
}

/* 올라설 수 있는 통로 */
export function walk(x, z, w, d) {
  return { x, z, w, d, h: CATWALK_H }
}

/* 계단 — 통로 가장자리에 붙여 낮은 턱을 층층이 쌓는다.

   edge 는 통로가 시작되는 좌표, dir 은 통로가 있는 쪽(+1/-1).
   계단은 edge 에서 반대 방향으로 뻗어 나가며 낮아진다. */
export function rampX(edge, dir, z, depth) {
  const steps = Math.round(CATWALK_H / STEP_RISE) - 1
  return Array.from({ length: steps }, (_, i) => ({
    x: edge - dir * STEP_RUN * (steps - i - 0.5),
    z,
    w: STEP_RUN,
    d: depth,
    h: STEP_RISE * (i + 1),
  }))
}

export function rampZ(edge, dir, x, width) {
  const steps = Math.round(CATWALK_H / STEP_RISE) - 1
  return Array.from({ length: steps }, (_, i) => ({
    x,
    z: edge - dir * STEP_RUN * (steps - i - 0.5),
    w: width,
    d: STEP_RUN,
    h: STEP_RISE * (i + 1),
  }))
}

/* 네 귀퉁이에 같은 것을 놓는다 — 대칭 배치를 짧게 적기 위해 */
function corners(x, z, make) {
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => make(x * sx, z * sz))
}

/* 가장자리에 흩은 스폰 지점 한 벌.

   전부 담장 가까이에 두고, 가운데(플레이어 시작점)에서 멀리 떨어뜨린다.
   맵마다 막힌 곳이 달라서 몇 개는 빼기도 한다. */
const EDGE_SPAWNS = [
  { x: -13.5, z: -13.5 }, { x: 13.5, z: -13.5 },
  { x: -13.5, z: 13.5 }, { x: 13.5, z: 13.5 },
  { x: 0, z: -13.5 }, { x: 0, z: 13.5 },
  { x: -13.5, z: 0 }, { x: 13.5, z: 0 },
  { x: -13.5, z: -7 }, { x: 13.5, z: -7 },
  { x: -13.5, z: 7 }, { x: 13.5, z: 7 },
  { x: -7, z: -13.5 }, { x: 7, z: -13.5 },
  { x: -7, z: 13.5 }, { x: 7, z: 13.5 },
]

/* 쓰지 않을 지점을 빼고 고른다 */
function spawnsExcept(...drop) {
  const bad = new Set(drop.map(([x, z]) => `${x},${z}`))
  return EDGE_SPAWNS.filter((p) => !bad.has(`${p.x},${p.z}`))
}

/* ── 열 장 ──────────────────────────────────────────────────────── */

const RAW = [
  {
    id: 'bunker',
    name: '벙커',
    blurb: '중앙 광장과 양옆 통로. 높은 자리와 네 귀퉁이 입구',
    cover: [
      wall(0, -6, 6, 1.2), wall(0, 6, 6, 1.2),
      wall(-6, 0, 1.2, 6), wall(6, 0, 1.2, 6),
      ...corners(10.5, 10.5, (x, z) => wall(x, z, 2.4, 2.4)),
      walk(13, 0, 4, 8), walk(-13, 0, 4, 8),
    ],
    stairs: [...rampX(11, 1, 0, 4), ...rampX(-11, -1, 0, 4)],
    spawns: spawnsExcept([13.5, 0], [-13.5, 0]),
    pickups: [[-6.5, -6.5], [6.5, 6.5], [6.5, -6.5], [-6.5, 6.5]],
  },

  {
    id: 'crossroads',
    name: '십자로',
    blurb: '담장까지 뻗은 십자 벽. 중앙을 거치지 않으면 못 넘어간다',
    cover: [
      wall(0, -10, 1.6, 10), wall(0, 10, 1.6, 10),
      wall(-10, 0, 10, 1.6), wall(10, 0, 10, 1.6),
      ...corners(10, 10, (x, z) => wall(x, z, 2.6, 2.6)),
    ],
    stairs: [],
    spawns: spawnsExcept([0, -13.5], [0, 13.5], [-13.5, 0], [13.5, 0]),
    pickups: [[-7, -7], [7, 7], [7, -7], [-7, 7]],
  },

  {
    id: 'cloister',
    name: '회랑',
    blurb: '두꺼운 벽이 가운데를 두르고, 네 귀퉁이에만 문이 있다',
    cover: [
      /* 두께 3 의 벽 넷이 가운데를 두른다. 네 귀퉁이에 2.0 짜리
         문을 남겨야 한다 — 처음엔 벽끼리 겹쳐서 완전히 닫힌 고리가
         되었고, 안에 선 플레이어에게 적이 영영 못 왔다.

         문 너비는 MIN_GAP(2.0)이 아니라 3.0 으로 벌렸다. 2.0 은
         브루트(지름 1.64)가 물리적으로 지나가긴 하지만, 벽을 따라
         도는 단순한 회피로 3유닛 깊이의 좁은 문을 꿰기는 어렵다.
         "지나갈 수 있다"와 "찾아 들어간다"는 다른 문제다. */
      wall(0, -6, 14, 3), wall(0, 6, 14, 3),
      wall(-6, 0, 3, 3), wall(6, 0, 3, 3),
      ...corners(11, 11, (x, z) => wall(x, z, 2.6, 2.6)),
      walk(-13.5, 0, 3, 10), walk(13.5, 0, 3, 10),
    ],
    stairs: [...rampX(12, 1, 0, 5), ...rampX(-12, -1, 0, 5)],
    spawns: spawnsExcept([13.5, 0], [-13.5, 0], [13.5, -7], [-13.5, -7], [13.5, 7], [-13.5, 7]),
    pickups: [[0, 0], [-8, -8], [8, 8], [8, -8]],
  },

  {
    id: 'pillars',
    name: '기둥숲',
    blurb: '기둥만 늘어선 트인 곳. 빠르게 돌며 싸운다',
    cover: [
      ...corners(4.5, 4.5, (x, z) => wall(x, z, 2, 2)),
      ...corners(11, 4.5, (x, z) => wall(x, z, 2, 2)),
      ...corners(4.5, 11, (x, z) => wall(x, z, 2, 2)),
      ...corners(11, 11, (x, z) => wall(x, z, 2, 2)),
    ],
    stairs: [],
    spawns: EDGE_SPAWNS,
    pickups: [[0, -8], [0, 8], [-8, 0], [8, 0]],
  },

  {
    id: 'trenches',
    name: '참호',
    blurb: '나란한 긴 벽 사이. 옆으로는 못 가고 끝까지 돌아야 한다',
    cover: [
      wall(-6, 0, 1.4, 16), wall(6, 0, 1.4, 16),
      wall(-11, -4, 1.4, 10), wall(11, 4, 1.4, 10),
      walk(0, 12.5, 12, 5),
    ],
    stairs: [...rampZ(10, 1, 0, 5)],
    spawns: spawnsExcept([-7, 13.5], [7, 13.5]),
    pickups: [[0, 0], [-8.5, -6], [8.5, 6], [0, 12]],
  },

  {
    id: 'colosseum',
    name: '투기장',
    blurb: '가장자리를 두른 높은 관람석. 가운데는 완전히 트였다',
    cover: [
      walk(0, -13, 30, 4), walk(0, 13, 30, 4),
      walk(-13, 0, 4, 22), walk(13, 0, 4, 22),
      ...corners(6, 6, (x, z) => wall(x, z, 2.2, 2.2)),
    ],
    stairs: [
      ...rampZ(-11, -1, 0, 5), ...rampZ(11, 1, 0, 5),
      ...rampX(-11, -1, 0, 5), ...rampX(11, 1, 0, 5),
    ],
    /* 관람석이 가장자리를 다 덮어서, 적은 그 위에서 나온다 */
    spawns: [
      { x: -13, z: -13 }, { x: 13, z: -13 }, { x: -13, z: 13 }, { x: 13, z: 13 },
      { x: 0, z: -13 }, { x: 0, z: 13 }, { x: -13, z: 0 }, { x: 13, z: 0 },
    ],
    pickups: [[-4, -4], [4, 4], [4, -4], [-4, 4]],
  },

  {
    id: 'maze',
    name: '미로',
    blurb: '엇갈린 벽이 길을 꺾는다. 코너마다 무엇이 있을지 모른다',
    cover: [
      wall(-9, -9, 8, 1.4), wall(9, 9, 8, 1.4),
      wall(-9, 9, 8, 1.4), wall(9, -9, 8, 1.4),
      wall(-4, -2, 1.4, 6), wall(4, 2, 1.4, 6),
      wall(0, 9, 1.4, 6), wall(0, -9, 1.4, 6),
      ...corners(12, 3, (x, z) => wall(x, z, 2, 2)),
    ],
    stairs: [],
    spawns: EDGE_SPAWNS,
    pickups: [[-9, 0], [9, 0], [0, 0], [-12, -12]],
  },

  {
    id: 'tower',
    name: '탑',
    blurb: '가운데 솟은 단. 올라서면 다 보이지만 사방에서 올라온다',
    cover: [
      walk(0, 0, 9, 9),
      ...corners(11, 11, (x, z) => wall(x, z, 2.6, 2.6)),
      wall(-12, 0, 1.4, 7), wall(12, 0, 1.4, 7),
    ],
    stairs: [
      /* 단의 동·서면 전체를 계단으로 덮는다. 4폭짜리 좁은 계단으로
         두었더니, 벽을 따라 도는 적이 그 입구를 못 찾고 단 둘레만
         돌았다. 면 전체가 계단이면 어디서 붙든 그냥 걸어 올라온다 —
         높은 자리가 안전지대가 되지 않는다. */
      ...rampX(4.5, -1, 0, 9), ...rampX(-4.5, 1, 0, 9),
    ],
    spawns: spawnsExcept([-13.5, 0], [13.5, 0]),
    pickups: [[0, -8], [0, 8], [-8, -8], [8, 8]],
  },

  {
    id: 'split',
    name: '분할',
    blurb: '가운데를 가르는 긴 벽. 넘어가려면 양끝 통로를 거친다',
    cover: [
      wall(0, -9.5, 1.6, 11), wall(0, 8, 1.6, 14),
      walk(-10, -12.25, 10, 5.5), walk(10, 12.25, 10, 5.5),
      ...corners(9, 6, (x, z) => wall(x, z, 2.2, 2.2)),
    ],
    stairs: [
      ...rampZ(-9.5, -1, -10, 6), ...rampZ(9.5, 1, 10, 6),
    ],
    spawns: spawnsExcept([0, -13.5], [0, 13.5]),
    pickups: [[-6, 11], [6, -11], [-12, -2], [12, 2]],
  },

  {
    id: 'openfield',
    name: '개활지',
    blurb: '숨을 곳이 거의 없다. 거리로만 버텨야 한다',
    cover: [
      wall(-7, -7, 3, 3), wall(7, 7, 3, 3),
      wall(0, 11, 5, 1.6), wall(0, -11, 5, 1.6),
      walk(-12.5, 8, 5, 5),
    ],
    stairs: [...rampX(-10, -1, 8, 3)],
    spawns: EDGE_SPAWNS,
    pickups: [[-4, 4], [4, -4], [10, -10], [-10, 10]],
  },
]

/* ── 완성된 맵 ──────────────────────────────────────────────────── */

function build(raw) {
  const coverBoxes = raw.cover.map(toBox)
  const stairBoxes = raw.stairs.map(toBox)
  const wallBoxes = perimeterCover().map(toBox)
  return {
    id: raw.id,
    name: raw.name,
    blurb: raw.blurb,
    coverBoxes,
    stairBoxes,
    wallBoxes,
    /* 충돌·시야가 매 프레임 훑는 목록 */
    boxes: [...wallBoxes, ...coverBoxes, ...stairBoxes],
    /* "지나갈 수 있는 틈" 규칙은 막는 것끼리만 본다. 계단 칸은
       서로 붙어 있어야 계단이고, 낮은 턱은 애초에 벽이 아니다. */
    gapChecked: [...wallBoxes, ...coverBoxes],
    spawns: raw.spawns,
    pickups: raw.pickups.map(([x, z]) => ({ x, z })),
    playerStart: { x: 0, z: 0 },
  }
}

export const MAPS = RAW.map(build)
export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]))
export const DEFAULT_MAP = 'bunker'

export function getMap(id) {
  return MAP_BY_ID[id] || MAP_BY_ID[DEFAULT_MAP]
}

/* 판마다 하나를 뽑는다. 세션의 난수를 받아서, 같은 씨앗이면 같은
   맵이 나오게 한다 — 실패한 판을 그대로 재현할 수 있어야 한다. */
export function pickMap(rng) {
  return MAPS[Math.min(MAPS.length - 1, Math.floor(rng() * MAPS.length))]
}

export { ARENA, CATWALK_H }
