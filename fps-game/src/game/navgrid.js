/* ==================================================================
   길찾기 격자

   적은 오래 "벽에 막히면 한쪽으로 돌기"만으로 움직였다. 기둥 몇 개짜리
   아레나에서는 그걸로 충분했고, enemies.js 에 그렇게 적어 두었다 —
   모든 스폰에서 중앙까지 닿는지 테스트가 지키고, 그게 깨지면 그때
   길찾기를 들이면 된다고.

   맵을 마흔 장으로 늘리자 깨졌다. 벽 따라가기는 눈앞의 벽만 본다.
   막다른 주머니에 들어가면 나갈 길이 뒤에 있는데도 앞만 더듬고, 빙
   돌아야 하는 배치에서는 돌아야 할 방향이 당장은 플레이어에서 멀어지는
   쪽이라 몇 걸음 가다 되돌아온다. 미궁·나선 같은 맵이 통째로 막혔다.

   그래서 격자를 깐다. 아레나를 반 미터 칸으로 잘라 칸마다 "여기 서면
   발이 어느 높이인가"를 적고, 플레이어 자리에서 다익스트라를 돌려
   거리밭을 만든다. 적은 거리가 줄어드는 쪽으로 간다.

   ── 왜 막힘/트임이 아니라 높이인가

   두 값으로는 이 게임의 맵을 못 적는다. 통로 위를 막힌 것으로 치면
   탑처럼 통째로 솟은 맵이 통째로 닫히고, 트인 것으로 치면 적이 계단을
   찾지 않고 통로 옆구리를 민다. 높이를 적고 "이웃과 한 걸음 이내일 때만
   건너간다"로 두면 둘 다 풀린다. 벽(3.8)은 따로 막을 것도 없이 이웃과
   3.8 이 벌어져 저절로 고립되고, 계단은 한 칸에 한 걸음씩 올라가므로
   저절로 이어진다.

   ── 왜 반 미터인가

   한때 1미터로 잡았다가 계단에서 걸렸다. 계단 한 단이 0.6~0.625 인데
   칸이 1미터면 이웃 칸 사이가 한 걸음을 넘어, 걸어 올라가는 곳이 격자
   위에서만 막혔다. "계단 칸은 무조건 통과"라는 예외를 두었더니 이번엔
   계단 꼭대기 옆구리로도 오를 수 있다고 읽어, 적이 못 오를 자리를
   겨누고 밀기만 했다.

   반 미터면 예외가 필요 없다. 칸 사이 0.5 를 계단 기울기로 환산하면
   한 걸음(0.45) 안에 들고, 꼭대기 옆구리는 1.6 차이라 여전히 막힌다.
   격자를 촘촘히 해서 특례를 없앤 셈이다.

   ── 높이는 칸 한가운데에 선 몸으로 잰다

   그 몸이 겹치는 상자 중 가장 높은 것 위에 선다. 벽에 반쯤 걸치는
   자리는 실제로 물리가 밀어내므로, 그런 칸이 벽 높이로 읽혀 막히는
   것이 맞다. 덕분에 몸 굵기만큼 벽이 두꺼워지고, 굵은 브루트는 좁은
   틈을 길로 세지 않는다.
   ================================================================== */
import { ARENA, CATWALK_H } from './arena.js'
import { STEP_HEIGHT } from './collide.js'

export const NAV_CELL = 0.5
export const NAV_N = Math.round((ARENA.half * 2) / NAV_CELL)   // 60

/* 비용을 5(직진)와 7(대각)로 둔 건 7/5 = 1.4 가 √2 에 가깝기 때문이다.
   둘 다 1로 세면 대각선 길이가 30% 짧게 나와 거리를 못 믿는다. 값이 두
   가지뿐이라 우선순위 큐 대신 거리별 통에 담으면 된다. */
const ORTHO = 5
const DIAG = 7
const UNREACHED = -1

/* 통로 위까지가 설 수 있는 데다. 그보다 높은 것은 엄폐물이거나 담장이다. */
const MAX_STAND = CATWALK_H + STEP_HEIGHT

const STEPS = [
  [1, 0, ORTHO], [-1, 0, ORTHO], [0, 1, ORTHO], [0, -1, ORTHO],
  [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG],
]

export function navCol(v) {
  return Math.min(NAV_N - 1, Math.max(0, Math.floor((v + ARENA.half) / NAV_CELL)))
}

export function navCenter(i) {
  return -ARENA.half + (i + 0.5) * NAV_CELL
}

function discHits(x, z, radius, b) {
  const nx = Math.min(Math.max(x, b.minX), b.maxX)
  const nz = Math.min(Math.max(z, b.minZ), b.maxZ)
  const ex = x - nx
  const ez = z - nz
  return ex * ex + ez * ez < radius * radius
}

export function buildNav(map, radius) {
  /* 낮은 턱도 빠짐없이 센다. 여기서 재는 것은 "무엇이 막는가"가 아니라
     "무엇을 밟고 서는가"이기 때문이다. 한때 한 걸음보다 낮은 상자를
     걸러 냈다가 계단 첫 단(0.4)이 통째로 빠져, 바닥에서 둘째 단(0.8)
     으로 건너뛰는 모양이 되었다. 격자 위에서만 못 오르는 계단이 생겨
     통로가 있는 맵이 전부 막혔다. */
  const solid = map.boxes
  /* Float64 를 쓴다. Float32 는 3.8 을 3.7999999523 으로 적어서, 높이를
     견줄 때마다 눈에 안 보이는 오차가 따라다닌다. 칸 3600개짜리 배열
     하나라 크기는 문제가 안 된다. */
  const height = new Float64Array(NAV_N * NAV_N)
  const stand = new Uint8Array(NAV_N * NAV_N)

  for (let r = 0; r < NAV_N; r++) {
    const z = navCenter(r)
    for (let c = 0; c < NAV_N; c++) {
      const x = navCenter(c)
      let h = 0
      for (const b of solid) if (b.maxY > h && discHits(x, z, radius, b)) h = b.maxY
      const i = r * NAV_N + c
      height[i] = h
      stand[i] = h <= MAX_STAND ? 1 : 0
    }
  }
  return { height, stand, radius }
}

/* 두 칸 사이를 걸어 건널 수 있는가 */
function linked(nav, a, b) {
  return nav.stand[a] === 1 && nav.stand[b] === 1
    && Math.abs(nav.height[a] - nav.height[b]) <= STEP_HEIGHT
}

/* 대각선으로 갈 때는 옆의 두 칸도 열려 있어야 한다. 두 벽이 꼭짓점만
   맞대고 있으면 격자 위로는 틈이 있어 보이지만 실제로는 못 지난다. */
function canStep(nav, at, c, r, dc, dr) {
  const ni = (r + dr) * NAV_N + (c + dc)
  if (!linked(nav, at, ni)) return -1
  if (dc !== 0 && dr !== 0) {
    if (!linked(nav, at, r * NAV_N + (c + dc))) return -1
    if (!linked(nav, at, (r + dr) * NAV_N + c)) return -1
  }
  return ni
}

/* 설 수 없는 칸에서 시작하면 밭이 통째로 빈다. 플레이어가 벽에 몸을
   비비고 있으면 실제로 그런 자리가 나온다. 조금씩 넓혀 가며 찾는다. */
function nearestStand(nav, c0, r0) {
  if (nav.stand[r0 * NAV_N + c0]) return [c0, r0]
  for (let rad = 1; rad <= 8; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue
        const c = c0 + dc
        const r = r0 + dr
        if (c < 0 || r < 0 || c >= NAV_N || r >= NAV_N) continue
        if (nav.stand[r * NAV_N + c]) return [c, r]
      }
    }
  }
  return null
}

/* 목표 자리에서 모든 칸까지의 거리. 값은 ORTHO 배 단위다. */
export function navField(nav, tx, tz) {
  const dist = new Int32Array(NAV_N * NAV_N).fill(UNREACHED)
  const seed = nearestStand(nav, navCol(tx), navCol(tz))
  if (!seed) return dist

  const from = seed[1] * NAV_N + seed[0]
  dist[from] = 0
  const buckets = [[from]]

  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d]
    if (!bucket) continue
    for (const at of bucket) {
      if (dist[at] !== d) continue          // 더 짧은 길로 이미 지나갔다
      const c = at % NAV_N
      const r = (at - c) / NAV_N
      for (const [dc, dr, cost] of STEPS) {
        const nc = c + dc
        const nr = r + dr
        if (nc < 0 || nr < 0 || nc >= NAV_N || nr >= NAV_N) continue
        const ni = canStep(nav, at, c, r, dc, dr)
        if (ni < 0) continue
        const nd = d + cost
        if (dist[ni] !== UNREACHED && dist[ni] <= nd) continue
        dist[ni] = nd
        ;(buckets[nd] ||= []).push(ni)
      }
    }
    buckets[d] = null                        // 지나간 통은 버린다
  }
  return dist
}

/* 거리밭을 미터로 읽는다. 못 닿으면 Infinity. */
export function navDistance(field, x, z) {
  const d = field[navCol(z) * NAV_N + navCol(x)]
  return d === UNREACHED ? Infinity : (d / ORTHO) * NAV_CELL
}

/* 두 점을 잇는 선을 격자 위에서 걸어갈 수 있는가.

   반 칸 간격으로 짚어 가며 이웃끼리 이어지는지 본다. 정밀한 판정은
   아니고 그럴 필요도 없다 — 실제 이동은 어차피 충돌이 다시 검사한다.
   여기서는 "이 지름길이 말이 되는가"만 보면 된다. */
function clearLine(nav, x0, z0, x1, z1) {
  const n = Math.max(2, Math.ceil((Math.hypot(x1 - x0, z1 - z0) / NAV_CELL) * 2))
  let prev = navCol(z0) * NAV_N + navCol(x0)
  if (!nav.stand[prev]) return false
  for (let i = 1; i <= n; i++) {
    const at = navCol(z0 + ((z1 - z0) * i) / n) * NAV_N + navCol(x0 + ((x1 - x0) * i) / n)
    if (at !== prev && !linked(nav, prev, at)) return false
    prev = at
  }
  return true
}

function downhill(nav, field, c, r) {
  const at = r * NAV_N + c
  let best = field[at]
  let bc = -1
  let br = -1
  for (const [dc, dr] of STEPS) {
    const nc = c + dc
    const nr = r + dr
    if (nc < 0 || nr < 0 || nc >= NAV_N || nr >= NAV_N) continue
    const ni = canStep(nav, at, c, r, dc, dr)
    if (ni < 0) continue
    const nd = field[ni]
    if (nd === UNREACHED || nd >= best) continue
    best = nd
    bc = nc
    br = nr
  }
  return bc < 0 ? null : [bc, br]
}

/* 적이 지금 서 있는 자리를 격자의 어느 칸으로 읽을 것인가.

   그냥 반올림하면 안 된다. 칸은 "그 한가운데에 몸을 두면 어떻게 되는가"로
   매겨 놓았는데 적은 칸 한가운데가 아니라 아무 데나 서 있기 때문이다.
   벽에 몸을 붙인 적의 칸은 "설 수 없음"으로 적혀 있고, 통로 옆을 스치는
   적의 칸은 "통로 위"로 적혀 있다. 그 값을 그대로 읽으면 길이 없다거나
   빙 돌아가라는 답이 나온다.

   그래서 발 높이가 맞는 칸 중에서 고른다. 고르는 값은 "그 칸까지 걸어가는
   비용 + 그 칸에서 플레이어까지의 비용", 곧 그 칸을 거쳐 가는 전체 길이다.

   거리밭 값만 보고 가장 낮은 칸을 고르면 안 된다. 벽 하나를 사이에 두고
   값이 비슷한 칸이 양쪽에 있을 때 적이 반 칸만 움직여도 고르는 칸이 이쪽
   저쪽으로 튀어 방향이 정반대로 뒤집힌다. 걸어가는 비용을 더하면 값이
   위치에 따라 매끄럽게 변해서, 반 칸 움직였다고 결론이 뒤집히지 않는다. */
const ANCHOR_SPAN = 3

function usable(nav, field, i, feetY) {
  return nav.stand[i] === 1
    && Math.abs(nav.height[i] - feetY) <= STEP_HEIGHT
    && field[i] !== UNREACHED
}

function anchorCell(nav, field, x, z, feetY) {
  const c0 = navCol(x)
  const r0 = navCol(z)

  /* 제 칸이 멀쩡하면 그것을 쓴다. 이웃 중에 값이 조금 더 낮은 칸이
     있어도 옮겨 잡지 않는다 — 그러면 칸 하나 차이로 기준이 이리저리
     옮겨 다녀서, 아래에서 재는 "길 위에 있는가"가 계속 뒤집힌다. */
  const own = r0 * NAV_N + c0
  if (usable(nav, field, own, feetY)) return [c0, r0]

  let best = Infinity
  let bc = -1
  let br = -1
  for (let dr = -ANCHOR_SPAN; dr <= ANCHOR_SPAN; dr++) {
    for (let dc = -ANCHOR_SPAN; dc <= ANCHOR_SPAN; dc++) {
      const c = c0 + dc
      const r = r0 + dr
      if (c < 0 || r < 0 || c >= NAV_N || r >= NAV_N) continue
      const i = r * NAV_N + c
      if (!usable(nav, field, i, feetY)) continue
      const d = field[i]
      const walk = Math.hypot(navCenter(c) - x, navCenter(r) - z) / NAV_CELL
      const score = d + walk * ORTHO
      if (score >= best) continue
      best = score
      bc = c
      br = r
    }
  }
  return bc < 0 ? null : [bc, br]
}

/* 이 자리에서 어느 쪽으로 가야 하는가.

   칸을 하나씩 따라가면 여덟 방향으로만 움직여 통로를 지그재그로 긁는다.
   그래서 밭을 따라 앞으로 몇 칸 미리 걸어 보고, 곧장 갈 수 있는 가장 먼
   칸을 목표로 삼는다(string pulling). 트인 데서는 그 칸이 곧 플레이어
   쪽이라 예전처럼 직선으로 가고, 모퉁이에서는 모퉁이 너머를 겨눈다.

   한때는 "돌아가는 길이 직선보다 얼마나 긴가"로 길찾기를 켜고 껐다.
   그 기준선 위에 선 적은 매 프레임 켰다 껐다 하며 제자리에서 떨었다 —
   격자 거리는 칸 단위로 툭툭 뛰는데 기준은 연속이라, 한 걸음 옮길
   때마다 판정이 뒤집혔다. 지금은 언제나 밭을 따르고 대신 목표를 멀리
   잡아 움직임을 편다. 켜고 끄는 자리가 없으면 떨 자리도 없다.

   null 은 "격자가 못 읽는 자리"라는 뜻이다. 그때는 부르는 쪽이 하던
   대로 플레이어를 향해 곧장 간다. */
export function navDir(nav, field, x, z, px, pz, feetY = 0) {
  const anchor = anchorCell(nav, field, x, z, feetY)
  if (!anchor) return null

  let c = anchor[0]
  let r = anchor[1]
  let tx = navCenter(c)
  let tz = navCenter(r)
  const ax = tx
  const az = tz

  for (let i = 0; i < 24; i++) {
    const nxt = downhill(nav, field, c, r)
    if (!nxt) break
    c = nxt[0]
    r = nxt[1]
    const cx = navCenter(c)
    const cz = navCenter(r)
    /* 여기서 막히면 그 앞은 볼 것도 없다 — 직전까지가 지름길이다 */
    if (!clearLine(nav, ax, az, cx, cz)) break
    tx = cx
    tz = cz
  }

  /* 마지막 칸이 플레이어가 선 칸이면 칸 한가운데가 아니라 사람을 겨눈다.
     안 그러면 코앞에서 반 칸씩 어긋나 게걸음을 한다. */
  if (px !== undefined && navCol(px) === c && navCol(pz) === r) {
    tx = px
    tz = pz
  }

  const ux = tx - x
  const uz = tz - z
  const len = Math.hypot(ux, uz)
  if (len < 1e-4) return null
  return { x: ux / len, z: uz / len }
}
