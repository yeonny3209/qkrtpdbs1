/* ==================================================================
   몸통·목·꼬리를 이어진 한 덩어리로 뽑는다

   전에는 구를 여러 개 줄지어 놓아 몸통을 만들었다. 가까이서 보면
   공을 꿴 애벌레처럼 마디마다 경계가 뚝뚝 끊겨 보였고, 목은 눈사람
   세 개를 쌓은 꼴이었다. 곡선을 따라 굵기가 변하는 관을 직접 뽑으면
   이음매 없이 매끈하게 이어진다.

   [왜 직접 만드나]
   three 의 TubeGeometry 는 굵기가 일정하다. 드래곤은 가슴에서 꼬리
   끝까지 계속 가늘어져야 하므로 반지름을 마디마다 따로 줘야 한다.

   [애니메이션]
   뱀·동양룡은 몸이 물결쳐야 한다. 매 프레임 곡선을 다시 계산하면
   비싸므로, 만들 때의 좌표를 baseline 으로 남겨 두고 마디 위치(t)에
   따라 옆으로 밀기만 한다. 고리 하나가 통째로 같이 움직이므로
   단면 모양은 그대로 유지된다.
   ================================================================== */
import * as THREE from 'three'

/* ------------------------------------------------------------------
   굵기 곡선 — 준 반지름들 사이를 잇는다.

   부드럽기만 하면 되는 게 아니다. 가슴에서 꼬리로 계속 가늘어지는
   값을 줬는데 중간에 도로 굵어지면 몸통에 혹이 생긴다. 매듭마다
   기울기를 0 으로 만드는 방식(smoothstep)은 매듭마다 살짝 부풀고,
   일반 Catmull-Rom 은 아래위로 넘실댄다. 그래서 단조성을 보장하는
   Fritsch-Carlson 방식을 쓴다 — 준 값이 계속 줄면 결과도 계속 준다.
   ------------------------------------------------------------------ */
export function makeRadiusCurve(radii) {
  const n = radii.length
  if (n === 1) return () => radii[0]

  const h = 1 / (n - 1)
  const d = []                       // 구간 기울기
  for (let i = 0; i < n - 1; i++) d.push((radii[i + 1] - radii[i]) / h)

  const m = [d[0]]                   // 매듭 기울기
  for (let i = 1; i < n - 1; i++) m.push((d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])

  /* 평평한 구간은 양쪽 기울기를 0 으로 — 안 그러면 여기서 넘실댄다 */
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    let a = m[i] / d[i], b = m[i + 1] / d[i]
    /* 구간과 반대 방향으로 기운 기울기는 0 으로 눕힌다.
       봉우리(가슴)에서 이걸 안 하면 준 굵기보다 더 부풀어 오른다. */
    if (a < 0) { m[i] = 0; a = 0 }
    if (b < 0) { m[i + 1] = 0; b = 0 }
    /* 눕힌 뒤의 값으로 다시 재야 한다. 눕히기 전 값으로 재면
       아래 보정이 방금 0 으로 만든 기울기를 도로 음수로 되돌린다. */
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[i] = tau * a * d[i]
      m[i + 1] = tau * b * d[i]
    }
  }

  return (t) => {
    const x = Math.max(0, Math.min(1, t)) * (n - 1)
    const i = Math.min(n - 2, Math.floor(x))
    const f = x - i
    const f2 = f * f, f3 = f2 * f
    /* 에르미트 기저 */
    return (2 * f3 - 3 * f2 + 1) * radii[i]
      + (f3 - 2 * f2 + f) * h * m[i]
      + (-2 * f3 + 3 * f2) * radii[i + 1]
      + (f3 - f2) * h * m[i + 1]
  }
}

/* ------------------------------------------------------------------
   pts    중심선 위의 점들 (THREE.Vector3)
   radii  각 점에서의 반지름 — pts 와 길이가 같아야 한다
   opts   radial 둘레 분할 / rings 길이 분할 / flat 배를 납작하게
   ------------------------------------------------------------------ */
export function taperedTube(pts, radii, opts = {}) {
  const radial = opts.radial ?? 14
  const rings = opts.rings ?? Math.max(16, pts.length * 5)
  const flat = opts.flat ?? 0.88        // 세로를 살짝 눌러 원통 느낌을 지운다
  const cap = opts.cap ?? true

  if (pts.length < 2) throw new Error('taperedTube: 점이 2개는 있어야 한다')
  if (pts.length !== radii.length) throw new Error('taperedTube: 점과 반지름 개수가 다르다')

  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  const frames = curve.computeFrenetFrames(rings, false)

  const radiusAt = makeRadiusCurve(radii)

  const pos = []
  const seg = []          // 각 정점이 몸통의 어디쯤인지 (0~1) — 물결 계산용
  for (let i = 0; i <= rings; i++) {
    const t = i / rings
    const P = curve.getPoint(t)
    const N = frames.normals[Math.min(i, rings - 1)]
    const B = frames.binormals[Math.min(i, rings - 1)]
    const r = radiusAt(t)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const cx = Math.cos(a) * r
      const cy = Math.sin(a) * r * flat
      pos.push(P.x + N.x * cx + B.x * cy, P.y + N.y * cx + B.y * cy, P.z + N.z * cx + B.z * cy)
      seg.push(t)
    }
  }

  const idx = []
  const stride = radial + 1
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j, b = a + stride
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  /* 양 끝 마개 — 없으면 안이 뻥 뚫려 뒤가 비쳐 보인다 */
  if (cap) {
    for (const end of [0, 1]) {
      const t = end
      const P = curve.getPoint(t)
      const center = pos.length / 3
      pos.push(P.x, P.y, P.z)
      seg.push(t)
      const ringStart = end === 0 ? 0 : rings * stride
      for (let j = 0; j < radial; j++) {
        const a = ringStart + j, b = ringStart + j + 1
        if (end === 0) idx.push(center, a, b)
        else idx.push(center, b, a)
      }
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('seg', new THREE.Float32BufferAttribute(seg, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  /* 물결칠 때 되돌아갈 기준 좌표 */
  g.userData.baseline = Float32Array.from(pos)
  return g
}

/* ------------------------------------------------------------------
   물결 — baseline 을 기준으로 옆·위아래로 민다.
   amp 세기 / k 파장(클수록 잔물결) / phase 시간
   ------------------------------------------------------------------ */
export function undulate(geo, phase, amp, k = 3.2) {
  const base = geo.userData.baseline
  if (!base || amp <= 0) return
  const pos = geo.attributes.position.array
  const seg = geo.attributes.seg.array
  for (let i = 0; i < seg.length; i++) {
    const t = seg[i]
    /* 머리 쪽(t=0)은 거의 안 움직이고 꼬리로 갈수록 크게 흔들린다 */
    const w = amp * t
    pos[i * 3] = base[i * 3] + Math.sin(phase - t * k) * w
    pos[i * 3 + 1] = base[i * 3 + 1] + Math.cos(phase * 0.9 - t * k) * w * 0.35
    pos[i * 3 + 2] = base[i * 3 + 2]
  }
  geo.attributes.position.needsUpdate = true
  geo.computeVertexNormals()
}

/* ------------------------------------------------------------------
   배 비늘판 — 아래쪽에 가로로 늘어놓는 판때기들의 자리.
   중심선을 따라가며 각 판의 위치·크기·기울기를 돌려준다.
   ------------------------------------------------------------------ */
export function bellyPlates(pts, radii, count) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  const out = []
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const P = curve.getPoint(t)
    const T = curve.getTangent(t)
    const x = t * (radii.length - 1)
    const j = Math.min(radii.length - 2, Math.floor(x))
    const f = x - j
    const r = radii[j] * (1 - f) + radii[j + 1] * f
    out.push({
      pos: [P.x, P.y - r * 0.84, P.z],
      /* 몸이 굽은 만큼 판도 같이 기운다 */
      pitch: Math.atan2(T.y, -T.z),
      w: r * 1.24,
      d: (0.9 / count) * curveLength(pts) * 1.15,
    })
  }
  return out
}

function curveLength(pts) {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += pts[i].distanceTo(pts[i - 1])
  return d
}
