/* ==================================================================
   한정 레전드 전용 파츠

   한정 레전드는 뽑기 확률 0.25% 짜리다. 그런데 지금까지는 상시
   드래곤과 크기·뿔 개수만 달라서, 어렵게 뽑아도 "좀 큰 용" 이었다.
   여기 있는 파츠들은 한정 레전드에만 붙는다.

     비늘판   등과 옆구리에 겹겹이 박히는 판
     손가락뼈 날개를 막 한 장이 아니라 마디마다 갈라진 막으로
     왕관     뒤통수를 두르는 뿔 무리
     문양     몸을 따라 빛나는 각인
     파편     주위를 도는 결정
     후광     머리 뒤에 기울어 선 고리

   전부 순수 계산이다. 렌더링과 떼어 놓아야 "날개막이 뒤집혔다"
   같은 걸 화면 없이도 잡을 수 있다.
   ================================================================== */
import * as THREE from 'three'

/* ------------------------------------------------------------------
   곡선 위 한 점의 방향 기준

   three 의 computeFrenetFrames 는 곡선이 휘는 방향에 따라 법선이
   제멋대로 돈다. 그걸 "등 위쪽"으로 믿고 쓰면 비늘판이 옆구리에
   붙고 문양이 한쪽으로만 몰린다. 월드의 위쪽에서 접선 성분을 빼
   직접 만든다 — 이러면 a=0 이 언제나 등 한가운데다.
   ------------------------------------------------------------------ */
const WORLD_UP = new THREE.Vector3(0, 1, 0)

function frameAt(curve, t) {
  const T = curve.getTangent(t).normalize()
  const up = WORLD_UP.clone().addScaledVector(T, -WORLD_UP.dot(T))
  /* 몸이 수직으로 서 있으면 위쪽 성분이 없다 — 그땐 앞쪽을 기준으로 */
  if (up.lengthSq() < 1e-6) up.set(0, 0, 1).addScaledVector(T, -T.z).normalize()
  else up.normalize()
  const side = new THREE.Vector3().crossVectors(T, up).normalize()
  return { T, up, side }
}

/* ------------------------------------------------------------------
   비늘판 — 몸 곡선을 따라 윗면에 겹쳐 박는다.

   rows  앞뒤로 몇 줄
   perRow 한 줄에 몇 장 (등 가운데를 기준으로 좌우 대칭)
   arc   덮는 각도. PI 면 위쪽 절반만 덮는다.
   ------------------------------------------------------------------ */
export function scalePlates(pts, radii, { rows = 12, perRow = 5, arc = Math.PI * 0.9 } = {}) {
  if (pts.length < 2) return []
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  const radiusAt = (t) => {
    const x = t * (radii.length - 1)
    const i = Math.min(radii.length - 2, Math.floor(x))
    const f = x - i
    return radii[i] * (1 - f) + radii[i + 1] * f
  }

  const out = []
  for (let r = 0; r < rows; r++) {
    /* 양 끝(코앞·꼬리끝)은 비워 둔다. 거기까지 덮으면 지저분하다 */
    const t = (r + 0.5) / rows
    const P = curve.getPoint(t)
    const { T, up, side } = frameAt(curve, t)
    const rad = radiusAt(t)
    /* 뒤로 갈수록 판이 작아진다 */
    const shrink = 1 - t * 0.45

    for (let k = 0; k < perRow; k++) {
      /* 등 가운데(위)를 0 으로 두고 좌우로 벌린다 */
      const spread = perRow === 1 ? 0 : (k / (perRow - 1) - 0.5) * arc
      /* 줄마다 반 칸씩 어긋나게 — 겹쳐야 비늘로 보인다 */
      const a = spread + (r % 2) * (arc / perRow / 2)
      const dir = new THREE.Vector3()
        .addScaledVector(up, Math.cos(a))
        .addScaledVector(side, Math.sin(a))
        .normalize()
      out.push({
        pos: P.clone().addScaledVector(dir, rad * 0.94).toArray(),
        normal: dir.toArray(),
        tangent: T.toArray(),
        size: rad * 0.52 * shrink,
        /* 가운데 판이 가장 크고 옆으로 갈수록 작아진다 */
        taper: 1 - Math.abs(spread) / (arc * 0.7) * 0.45,
      })
    }
  }
  return out
}

/* 비늘판 목록을 삼각형 덩어리 하나로 굽는다 — 드로우콜 하나면 된다 */
export function bakePlates(plates) {
  const pos = [], nor = []
  const P = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3()
  const Bv = new THREE.Vector3(), v = new THREE.Vector3()

  for (const p of plates) {
    P.fromArray(p.pos); N.fromArray(p.normal); T.fromArray(p.tangent)
    Bv.crossVectors(N, T).normalize()
    const w = p.size * p.taper, len = p.size * 1.5, h = p.size * 0.30

    /* 꼬리 쪽으로 뾰족한 물방울. 네 점을 두 삼각형으로 */
    const tip = v.copy(P).addScaledVector(T, -len).addScaledVector(N, h * 0.2).toArray()
    const left = new THREE.Vector3().copy(P).addScaledVector(Bv, -w).addScaledVector(N, h).toArray()
    const right = new THREE.Vector3().copy(P).addScaledVector(Bv, w).addScaledVector(N, h).toArray()
    const root = new THREE.Vector3().copy(P).addScaledVector(T, len * 0.45).toArray()

    pos.push(...root, ...left, ...tip)
    pos.push(...root, ...tip, ...right)
    for (let i = 0; i < 6; i++) nor.push(...p.normal)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}

/* ------------------------------------------------------------------
   날개 — 손가락뼈와 그 사이의 막

   막 한 장을 통째로 쓰면 종잇장처럼 보인다. 손가락 사이마다
   따로 막을 치고 뒷단을 안쪽으로 늘어뜨려야 박쥐 날개가 된다.
   좌표는 (x, z) 평면. x 가 바깥, z 가 뒤쪽(음수)이다.
   ------------------------------------------------------------------ */
export const WING_FINGERS = [
  { len: 2.55, ang: 0.14 },   // 앞가장자리
  { len: 2.30, ang: -0.30 },
  { len: 1.96, ang: -0.72 },
  { len: 1.55, ang: -1.10 },
  { len: 1.05, ang: -1.46 },  // 몸에 붙는 쪽
]

export const fingerTip = (f) => [Math.cos(f.ang) * f.len, Math.sin(f.ang) * f.len]

/* 손가락 사이 막 한 장의 외곽선. sag 는 뒷단이 안으로 파이는 정도 */
export function membraneOutline(a, b, sag = 0.22) {
  const [ax, az] = fingerTip(a)
  const [bx, bz] = fingerTip(b)
  /* 두 끝 사이 중점을 원점 쪽으로 당겨 가리비를 만든다 */
  const mx = (ax + bx) / 2, mz = (az + bz) / 2
  return [
    [0, 0],
    [ax, az],
    [mx * (1 - sag), mz * (1 - sag)],
    [bx, bz],
  ]
}

export function membraneShape(a, b, sag) {
  const pts = membraneOutline(a, b, sag)
  const s = new THREE.Shape()
  s.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1])
  s.closePath()
  return s
}

/* 막에 새기는 힘줄 — 손가락에서 뒷단으로 뻗는 가는 선 */
export function membraneVeins(a, b, n = 3) {
  const [ax, az] = fingerTip(a)
  const [bx, bz] = fingerTip(b)
  const out = []
  for (let i = 1; i <= n; i++) {
    const f = i / (n + 1)
    const x = ax + (bx - ax) * f, z = az + (bz - az) * f
    out.push({ to: [x * 0.86, z * 0.86], len: Math.hypot(x, z) * 0.86 })
  }
  return out
}

/* ------------------------------------------------------------------
   왕관 — 뒤통수를 두르는 뿔.
   가운데가 가장 길고 옆으로 갈수록 짧아진다.
   ------------------------------------------------------------------ */
export function crownHorns(n = 7, { spread = Math.PI * 0.78, baseLen = 0.52 } = {}) {
  const out = []
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0.5 : i / (n - 1)
    const a = (f - 0.5) * spread
    /* 가운데가 길다 */
    const t = 1 - Math.abs(f - 0.5) * 2
    out.push({
      angle: a,
      len: baseLen * (0.45 + t * 0.55),
      tilt: -0.9 - t * 0.35,
      radius: 0.030 + t * 0.016,
    })
  }
  return out
}

/* ------------------------------------------------------------------
   문양 — 몸을 따라 빛나는 각인. 좌우 대칭으로 박힌다.
   ------------------------------------------------------------------ */
export function runeMarks(pts, radii, n = 6) {
  if (pts.length < 2) return []
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  const out = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / (n + 0.6)
    const P = curve.getPoint(t)
    const { up, side } = frameAt(curve, t)
    const x = t * (radii.length - 1)
    const j = Math.min(radii.length - 2, Math.floor(x))
    const rad = radii[j] + (radii[j + 1] - radii[j]) * (x - j)
    for (const sgn of [-1, 1]) {
      /* 옆구리 약간 아래 — 등은 비늘판이 덮고 있다 */
      const a = sgn * Math.PI * 0.42
      const dir = new THREE.Vector3()
        .addScaledVector(up, Math.cos(a))
        .addScaledVector(side, Math.sin(a))
        .normalize()
      out.push({
        pos: P.clone().addScaledVector(dir, rad * 1.01).toArray(),
        normal: dir.toArray(),
        size: rad * 0.30,
        seed: i * 2 + (sgn > 0 ? 1 : 0),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------
   주위를 도는 결정 파편
   ------------------------------------------------------------------ */
export function orbitShards(n = 7, { radius = 1.5, height = 1.35 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const f = i / n
    return {
      /* 시작 각도를 고르게 벌려 뭉치지 않게 한다 */
      phase: f * Math.PI * 2,
      /* 높이를 고르게 갈라 준다. sin 으로 흩으면 값이 겹치는 짝이
         생겨 두 파편이 거의 붙어 도는 순간이 나온다. */
      y: height + (f - 0.5) * 1.15,
      /* 반지름을 크게 벌려야 서로 스쳐도 겹쳐 보이지 않는다 */
      radius: radius * (0.72 + ((i * 7) % 5) / 5 * 0.62),
      size: 0.055 + ((i * 3) % 4) / 4 * 0.045,
      speed: 0.30 + ((i * 5) % 3) / 3 * 0.22,
      /* 절반은 반대로 돈다 — 같은 방향이면 고리처럼 보인다 */
      dir: i % 2 === 0 ? 1 : -1,
    }
  })
}

/* 시각 t 에서 파편의 자리 */
export function shardAt(s, t) {
  const a = s.phase + t * s.speed * s.dir
  return [Math.cos(a) * s.radius, s.y + Math.sin(t * 0.8 + s.phase) * 0.10, Math.sin(a) * s.radius]
}

/* ------------------------------------------------------------------
   등급 안의 등급 — 한정 레전드끼리도 차이를 둔다.
   epithet(신룡/천제룡/원초룡)에 따라 장식 밀도가 다르다.
   ------------------------------------------------------------------ */
export const MYTHIC_TIERS = {
  신룡: { plateRows: 11, perRow: 5, crown: 5, shards: 5, runes: 5, halo: 1, aura: 1.15 },
  천제룡: { plateRows: 13, perRow: 5, crown: 7, shards: 7, runes: 6, halo: 2, aura: 1.35 },
  원초룡: { plateRows: 15, perRow: 7, crown: 9, shards: 9, runes: 7, halo: 3, aura: 1.6 },
}
export const mythicTier = (epithet) => MYTHIC_TIERS[epithet] || MYTHIC_TIERS.신룡
