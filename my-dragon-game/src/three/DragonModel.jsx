/* ==================================================================
   드래곤 3D 모델 — 외부 모델 파일 없이 기본 도형으로 조립한다.

   속성이 색을, 등급이 형태(뿔 수·볏·오라)를 바꾼다.
   같은 컴포넌트가 도감 미리보기와 소환 컷씬 양쪽에 쓰인다.
   ================================================================== */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ELEMENT_BY_ID } from '../game/elements.js'

/* 등급이 올라갈수록 크고, 뿔이 늘고, 장식이 붙는다 */
const RARITY_SHAPE = {
  common: { size: 0.86, horns: 2, hornLen: 0.30, spikes: 5, frill: false, aura: 0 },
  rare: { size: 0.94, horns: 2, hornLen: 0.42, spikes: 7, frill: false, aura: 0 },
  epic: { size: 1.04, horns: 4, hornLen: 0.52, spikes: 9, frill: true, aura: 0.5 },
  legend: { size: 1.16, horns: 6, hornLen: 0.66, spikes: 11, frill: true, aura: 1 },
}

/* ---------------- 날개 막 ----------------
   박쥐 날개처럼 가리비(scallop) 모양으로 파낸 실루엣.
   Shape의 (x, y)를 그대로 월드 (x, z)로 눕히므로, 아래 뼈 좌표와 짝이 맞는다. */
const WING_TIPS = [[2.15, 0.42], [1.55, -0.86], [0.98, -1.02], [0.45, -1.02]]

function useWingGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(2.15, 0.42)      // 날개 끝
    s.lineTo(1.82, -0.18)
    s.lineTo(1.55, -0.86)     // 가리비 1
    s.lineTo(1.26, -0.34)
    s.lineTo(0.98, -1.02)     // 가리비 2
    s.lineTo(0.70, -0.44)
    s.lineTo(0.45, -1.02)     // 가리비 3
    s.lineTo(0.20, -0.52)
    s.lineTo(0, -0.22)
    s.closePath()
    const g = new THREE.ShapeGeometry(s, 12)
    /* +PI/2 로 눕혀야 Shape의 -y(가리비)가 월드 -z(뒤쪽)로 간다.
       -PI/2 로 눕히면 날개가 앞으로 접혀 머리를 덮는다. */
    g.rotateX(Math.PI / 2)
    return g
  }, [])
}

/* 날개 하나 (side: +1 오른쪽 / -1 왼쪽) */
function Wing({ side, geo, flapRef, boneMat, membraneMat }) {
  return (
    <group ref={flapRef} position={[side * 0.40, 1.40, -0.18]} rotation={[0, 0, side * 0.45]}>
      <group scale={[side, 1, 1]}>
        <mesh geometry={geo} material={membraneMat} />
        {/* 날개뼈 — 어깨에서 각 가리비 꼭짓점으로 뻗는다.
            실린더 축은 기본이 Y라, 그냥 Y로 돌리면 위로 솟은 막대가 된다.
            바깥 group을 방향으로 돌리고 안쪽 mesh를 눕혀 +Z를 향하게 만든다. */}
        {WING_TIPS.map(([x, z], i) => {
          const len = Math.hypot(x, z)
          return (
            <group key={i} rotation-y={Math.atan2(x, z)}>
              <mesh material={boneMat} position={[0, 0.02, len / 2]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.045, 0.026, len, 6]} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}

/* ---------------- 머리 ---------------- */
function Head({ el, shape, mainMat, bellyMat }) {
  const horns = []
  for (let i = 0; i < shape.horns; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const row = Math.floor(i / 2)
    horns.push(
      <mesh key={i}
        position={[side * (0.17 + row * 0.045), 0.20 - row * 0.07, -0.10 - row * 0.16]}
        rotation={[-0.85 - row * 0.22, side * 0.24, side * 0.30]}>
        <coneGeometry args={[0.055 - row * 0.008, shape.hornLen - row * 0.09, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.35} />
      </mesh>,
    )
  }
  return (
    <group>
      {/* 두개골 */}
      <mesh material={mainMat} castShadow>
        <boxGeometry args={[0.46, 0.40, 0.52]} />
      </mesh>
      {/* 주둥이 */}
      <mesh position={[0, -0.05, 0.40]} material={mainMat} castShadow>
        <boxGeometry args={[0.30, 0.24, 0.36]} />
      </mesh>
      <mesh position={[0, -0.055, 0.60]} material={mainMat}>
        <boxGeometry args={[0.22, 0.16, 0.10]} />
      </mesh>
      {/* 아래턱 */}
      <mesh position={[0, -0.17, 0.38]}>
        <boxGeometry args={[0.24, 0.10, 0.34]} />
        <meshStandardMaterial color={el.deep} roughness={0.75} />
      </mesh>
      {/* 이빨 */}
      {[-0.08, 0.08].map((x, i) => (
        <mesh key={i} position={[x, -0.13, 0.55]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.026, 0.10, 4]} />
          <meshStandardMaterial color="#fff" roughness={0.4} />
        </mesh>
      ))}
      {/* 눈 — 속성 색으로 빛난다 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.17, 0.06, 0.20]}>
          <sphereGeometry args={[0.062, 12, 10]} />
          <meshStandardMaterial color={el.glow} emissive={el.glow} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
      {/* 콧구멍 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, 0.02, 0.645]}>
          <sphereGeometry args={[0.017, 8, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {horns}
      {/* 볏 (에픽 이상) */}
      {shape.frill && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.24, -0.02, -0.16]} rotation={[0, 0, s * -0.5]} material={bellyMat}>
          <coneGeometry args={[0.10, 0.30, 3]} />
        </mesh>
      ))}
    </group>
  )
}

/* ==================================================================
   드래곤 본체
   ================================================================== */
export default function DragonModel({
  elementId = 'fire',
  rarity = 'common',
  scale = 1,
  animate = true,
  roar = false,          // 컷씬에서 포효 자세
}) {
  const el = ELEMENT_BY_ID[elementId] || ELEMENT_BY_ID.fire
  const shape = RARITY_SHAPE[rarity] || RARITY_SHAPE.common
  const wingGeo = useWingGeometry()

  const root = useRef()
  const neck = useRef()
  const headRef = useRef()
  const tail = useRef()
  const wingL = useRef()
  const wingR = useRef()
  const auraRef = useRef()

  /* 재질은 한 번만 만들어 모든 부위가 공유한다 (드로우콜·GC 절약) */
  const mats = useMemo(() => ({
    main: new THREE.MeshStandardMaterial({ color: el.color, roughness: 0.55, metalness: 0.25 }),
    belly: new THREE.MeshStandardMaterial({ color: el.glow, roughness: 0.7, metalness: 0.1 }),
    bone: new THREE.MeshStandardMaterial({ color: el.deep, roughness: 0.6, metalness: 0.2 }),
    membrane: new THREE.MeshStandardMaterial({
      color: el.deep, emissive: el.color, emissiveIntensity: 0.35,
      roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
      transparent: true, opacity: 0.93,
    }),
  }), [el])

  useFrame((state, dt) => {
    if (!animate) return
    const t = state.clock.elapsedTime
    /* 숨쉬기 + 부유 */
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.5) * 0.06
      root.current.rotation.z = Math.sin(t * 0.7) * 0.02
    }
    /* 날갯짓 — 포효 중엔 크게 펼친다 */
    const flap = roar ? 0.45 + Math.sin(t * 5) * 0.16 : Math.sin(t * 2.1) * 0.26
    if (wingR.current) wingR.current.rotation.z = 0.45 + flap
    if (wingL.current) wingL.current.rotation.z = -0.45 - flap
    /* 목·머리 */
    if (neck.current) neck.current.rotation.x = (roar ? -0.32 : -0.05) + Math.sin(t * 1.3) * 0.05
    if (headRef.current) headRef.current.rotation.x = (roar ? -0.45 : 0.08) + Math.sin(t * 1.7) * 0.05
    /* 꼬리 */
    if (tail.current) tail.current.rotation.y = Math.sin(t * 1.1) * 0.28
    /* 레전드 오라 회전 */
    if (auraRef.current) auraRef.current.rotation.y += dt * 0.6
  })

  /* 등줄기 가시 */
  const spikes = useMemo(() => Array.from({ length: shape.spikes }, (_, i) => {
    const f = i / (shape.spikes - 1)
    return { z: 0.55 - f * 1.75, y: 1.42 - Math.sin(f * Math.PI) * 0.10, s: 0.13 - f * 0.06 }
  }), [shape.spikes])

  return (
    <group ref={root} scale={scale * shape.size}>
      {/* ---------- 몸통 ---------- */}
      <mesh position={[0, 1.15, -0.15]} material={mats.main} castShadow>
        <sphereGeometry args={[0.62, 20, 16]} />
      </mesh>
      <mesh position={[0, 1.12, 0.42]} material={mats.main} castShadow>
        <sphereGeometry args={[0.46, 18, 14]} />
      </mesh>
      {/* 배 — 밝은 색 */}
      <mesh position={[0, 0.90, 0.10]} material={mats.belly}>
        <sphereGeometry args={[0.40, 16, 12]} />
      </mesh>

      {/* ---------- 목 · 머리 ---------- */}
      <group ref={neck} position={[0, 1.42, 0.55]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, i * 0.20, i * 0.17]} material={mats.main} castShadow>
            <sphereGeometry args={[0.24 - i * 0.028, 14, 12]} />
          </mesh>
        ))}
        <group ref={headRef} position={[0, 0.66, 0.56]}>
          <Head el={el} shape={shape} mainMat={mats.main} bellyMat={mats.belly} />
        </group>
      </group>

      {/* ---------- 날개 ---------- */}
      <Wing side={1} geo={wingGeo} flapRef={wingR} boneMat={mats.bone} membraneMat={mats.membrane} />
      <Wing side={-1} geo={wingGeo} flapRef={wingL} boneMat={mats.bone} membraneMat={mats.membrane} />

      {/* ---------- 꼬리 ---------- */}
      <group ref={tail} position={[0, 1.05, -0.68]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, -i * 0.055, -i * 0.32]} material={mats.main} castShadow>
            <sphereGeometry args={[0.30 - i * 0.052, 12, 10]} />
          </mesh>
        ))}
        {/* 꼬리 날 */}
        <mesh position={[0, -0.24, -1.52]} rotation={[0.35, 0, 0]} material={mats.membrane}>
          <coneGeometry args={[0.26, 0.52, 4]} />
        </mesh>
      </group>

      {/* ---------- 다리 ---------- */}
      {[[0.36, 0.38], [-0.36, 0.38], [0.30, -0.42], [-0.30, -0.42]].map(([x, z], i) => (
        <group key={i} position={[x, 0.62, z]}>
          <mesh position={[0, -0.12, 0]} material={mats.main} castShadow>
            <capsuleGeometry args={[0.13, 0.30, 4, 8]} />
          </mesh>
          <mesh position={[0, -0.40, 0.09]} material={mats.main}>
            <boxGeometry args={[0.22, 0.11, 0.30]} />
          </mesh>
          {/* 발톱 */}
          {[-0.07, 0, 0.07].map((cx, j) => (
            <mesh key={j} position={[cx, -0.43, 0.24]} rotation={[1.25, 0, 0]}>
              <coneGeometry args={[0.026, 0.11, 4]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ---------- 등줄기 가시 ---------- */}
      {spikes.map((sp, i) => (
        <mesh key={i} position={[0, sp.y, sp.z]} rotation={[-0.3, 0, 0]}>
          <coneGeometry args={[sp.s * 0.45, sp.s * 2.2, 4]} />
          <meshStandardMaterial color={el.glow} emissive={el.glow} emissiveIntensity={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* ---------- 레전드 오라 ---------- */}
      {shape.aura > 0 && (
        <group ref={auraRef}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.12 + i * 0.03, 0]} rotation={[-Math.PI / 2, 0, i * 0.6]}>
              <torusGeometry args={[1.5 + i * 0.36, 0.018, 6, 48]} />
              <meshStandardMaterial color={el.glow} emissive={el.glow}
                emissiveIntensity={2.2 * shape.aura} toneMapped={false}
                transparent opacity={0.55 - i * 0.12} />
            </mesh>
          ))}
        </group>
      )}
      {/* 속성 색 조명 — 모델이 어디에 놓여도 자기 색을 낸다 */}
      <pointLight position={[0, 1.5, 1.6]} intensity={shape.aura > 0 ? 9 : 4} distance={7} color={el.glow} />
    </group>
  )
}
