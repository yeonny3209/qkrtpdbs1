/* ==================================================================
   한정 레전드 전용 렌더 파츠

   기하 계산은 mythic.js 가 하고, 여기서는 그리기만 한다.
   전부 shape.mythic 이 있을 때만 붙는다.
   ================================================================== */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  scalePlates, bakePlates, runeMarks, orbitShards, shardAt, crownHorns,
  WING_FINGERS, fingerTip, membraneShape, membraneVeins,
} from './mythic.js'

/* ------------------------------------------------------------------
   비늘판 — 몸을 따라 겹겹이 박힌 판. 삼각형 덩어리 하나로 굽는다.
   ------------------------------------------------------------------ */
export function ScalePlates({ pts, radii, rows, perRow, material }) {
  const geo = useMemo(
    () => bakePlates(scalePlates(pts, radii, { rows, perRow })),
    [pts, radii, rows, perRow],
  )
  return <mesh geometry={geo} material={material} castShadow />
}

/* ------------------------------------------------------------------
   문양 — 옆구리에서 빛나는 각인. 숨 쉬듯 밝기가 오르내린다.
   ------------------------------------------------------------------ */
export function Runes({ pts, radii, n, color }) {
  const marks = useMemo(() => runeMarks(pts, radii, n), [pts, radii, n])
  const group = useRef()

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.children.forEach((m, i) => {
      /* 각인마다 위상을 어긋나게 — 동시에 깜빡이면 전광판이 된다 */
      const p = 0.55 + Math.sin(t * 1.6 + i * 1.1) * 0.45
      if (m.material) m.material.opacity = 0.35 + p * 0.55
      m.scale.setScalar(0.9 + p * 0.2)
    })
  })

  return (
    <group ref={group}>
      {marks.map((r, i) => {
        /* 각인이 몸 표면을 바라보도록 눕힌다 */
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1), new THREE.Vector3(...r.normal),
        )
        const e = new THREE.Euler().setFromQuaternion(q)
        return (
          <mesh key={i} position={r.pos} rotation={[e.x, e.y, e.z]}>
            {/* 6각형 글리프 — 원보다 인공물처럼 보인다 */}
            <circleGeometry args={[r.size, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.7}
              toneMapped={false} side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------
   주위를 도는 결정 파편
   ------------------------------------------------------------------ */
export function Shards({ n, color, boneMat }) {
  const shards = useMemo(() => orbitShards(n), [n])
  const group = useRef()

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.children.forEach((m, i) => {
      const s = shards[i]
      if (!s) return
      m.position.set(...shardAt(s, t))
      m.rotation.x = t * s.speed * 1.7
      m.rotation.y = t * s.speed * 2.3
    })
  })

  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <group key={i}>
          {/* 결정 심 */}
          <mesh material={boneMat}>
            <octahedronGeometry args={[s.size, 0]} />
          </mesh>
          {/* 겉으로 새어 나오는 빛 */}
          <mesh>
            <octahedronGeometry args={[s.size * 1.7, 0]} />
            <meshBasicMaterial color={color} transparent opacity={0.30}
              toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------
   왕관 — 뒤통수를 두르는 뿔 무리
   ------------------------------------------------------------------ */
export function Crown({ n, color }) {
  const horns = useMemo(() => crownHorns(n), [n])
  return (
    <group position={[0, 0.10, -0.20]}>
      {horns.map((h, i) => (
        <group key={i} rotation={[0, h.angle, 0]}>
          <mesh position={[0, h.len * 0.42, -0.14]} rotation={[h.tilt, 0, 0]}>
            <coneGeometry args={[h.radius, h.len, 5]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.6} />
          </mesh>
          {/* 뿔뿌리에 박힌 보석 */}
          <mesh position={[0, 0.06, -0.16]}>
            <octahedronGeometry args={[h.radius * 1.3, 0]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------
   후광 — 머리 뒤에 기울어 선 고리. 층마다 반대로 돈다.
   ------------------------------------------------------------------ */
export function Halo({ rings, color }) {
  const group = useRef()
  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.children.forEach((m, i) => {
      /* 층마다 반대로 돌려야 겹쳐 보이지 않는다 */
      m.rotation.z = t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1)
    })
  })
  return (
    <group ref={group} position={[0, 0.16, -0.46]} rotation={[0.42, 0, 0]}>
      {Array.from({ length: rings }, (_, i) => (
        <mesh key={i} rotation={[0, 0, i * 0.5]}>
          <torusGeometry args={[0.40 + i * 0.11, 0.008 + i * 0.002, 4, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.55 - i * 0.12}
            toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------
   가슴 코어 — 심장 자리에 박힌 결정. 박동한다.
   ------------------------------------------------------------------ */
export function ChestCore({ color, boneMat, size = 1 }) {
  const core = useRef()
  useFrame(({ clock }) => {
    if (!core.current) return
    /* 두 번 뛰고 쉬는 심장 박자 */
    const t = clock.elapsedTime * 1.6
    const beat = Math.pow(Math.max(0, Math.sin(t)), 6) + Math.pow(Math.max(0, Math.sin(t - 0.5)), 6) * 0.6
    core.current.scale.setScalar(size * (1 + beat * 0.16))
    core.current.children.forEach((m, i) => {
      if (i > 0 && m.material) m.material.opacity = (0.34 - (i - 1) * 0.11) * (0.7 + beat * 0.6)
    })
  })
  return (
    <group ref={core}>
      <mesh material={boneMat}>
        <octahedronGeometry args={[0.13, 0]} />
      </mesh>
      {[0.22, 0.32].map((r, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[r, 0]} />
          <meshBasicMaterial color={color} transparent opacity={0.3 - i * 0.11}
            toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------
   날개 — 손가락뼈와 마디마다 갈라진 막

   막 한 장짜리 날개는 종잇장으로 보인다. 손가락 사이마다 막을 따로
   치고 뒷단을 늘어뜨려야 박쥐 날개가 된다.
   ------------------------------------------------------------------ */
export function MythicWing({ side, flapRef, boneMat, membraneMat, color, y, z, tilt }) {
  const panels = useMemo(() => WING_FINGERS.slice(0, -1).map((f, i) => {
    const g = new THREE.ShapeGeometry(membraneShape(f, WING_FINGERS[i + 1], 0.20), 10)
    /* Shape 의 (x, y) 를 월드 (x, z) 로 눕힌다 — 뼈 좌표와 짝을 맞춘다 */
    g.rotateX(Math.PI / 2)
    return g
  }), [])

  return (
    <group ref={flapRef} position={[side * 0.40, y, z]} rotation={[0, 0, side * tilt]}>
      <group scale={[side, 1, 1]}>
        {/* 막 */}
        {panels.map((g, i) => (
          <mesh key={i} geometry={g} material={membraneMat} position={[0, i * 0.002, 0]} />
        ))}

        {/* 손가락뼈 — 마디 관절까지 */}
        {WING_FINGERS.map((f, i) => {
          const [x, z2] = fingerTip(f)
          const len = Math.hypot(x, z2)
          return (
            <group key={i} rotation-y={Math.atan2(x, z2)}>
              <mesh material={boneMat} position={[0, 0.012, len / 2]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.042 - i * 0.004, 0.016, len, 6]} />
              </mesh>
              {/* 마디 — 뼈가 밋밋한 막대면 우산살이 된다 */}
              {[0.36, 0.68].map((f2, j) => (
                <mesh key={j} material={boneMat} position={[0, 0.012, len * f2]}>
                  <sphereGeometry args={[0.038 - i * 0.004, 8, 6]} />
                </mesh>
              ))}
              {/* 발톱 */}
              <mesh position={[0, 0.012, len + 0.05]} rotation-x={Math.PI / 2}>
                <coneGeometry args={[0.022, 0.11, 5]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.3} metalness={0.4} />
              </mesh>
            </group>
          )
        })}

        {/* 힘줄 — 막 안쪽으로 뻗는 가는 선 */}
        {WING_FINGERS.slice(0, -1).flatMap((f, i) =>
          membraneVeins(f, WING_FINGERS[i + 1], 2).map((v, j) => {
            const len = v.len
            return (
              <group key={`${i}-${j}`} rotation-y={Math.atan2(v.to[0], v.to[1])}>
                <mesh position={[0, 0.006, len / 2]} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.008, 0.003, len, 4]} />
                  <meshBasicMaterial color={color} transparent opacity={0.34}
                    toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
              </group>
            )
          }),
        )}
      </group>
    </group>
  )
}
