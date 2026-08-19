/* ==================================================================
   적을 그린다

   모델 파일은 없다. 전부 기본 도형을 붙여 만든다. 종류별 실루엣이
   확실히 다른 게 이 게임에서는 예쁜 것보다 중요하다 — 어두운 방에서
   덩치만 보고 "저건 브루트다, 피해야 한다"가 즉시 나와야 한다.
   그래서 셋의 높이·폭·색을 겹치지 않게 벌려 두었다.

   같은 종류라도 아이디로부터 체격과 색을 조금씩 흔든다. 완전히
   똑같은 것이 여덟 마리 몰려오면 복사해 붙인 티가 난다.

   React 상태는 매 프레임 건드리지 않는다. 위치는 useFrame 에서
   ref 로 직접 밀어 넣는다 — 적 20마리 × 60fps 로 setState 를 하면
   화면 전체가 다시 그려진다.
   ================================================================== */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ENEMY_TYPES, CORPSE_LINGER } from '../game/enemies.js'
import { variate } from '../game/rng.js'

/* ── 크롤러 — 낮게 기는 벌레. 다리가 번갈아 젓는다 ─────────────── */
function CrawlerBody({ tint, matRef }) {
  const legs = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < legs.current.length; i++) {
      const l = legs.current[i]
      if (l) l.rotation.x = Math.sin(t * 11 + i * 1.7) * 0.55
    }
  })

  const legAt = [
    [-0.34, -0.28], [0.34, -0.28], [-0.34, 0.28], [0.34, 0.28],
  ]

  return (
    <group>
      <mesh position={[0, 0.52, 0]} castShadow scale={[1, 0.62, 1.35]}>
        <octahedronGeometry args={[0.46, 0]} />
        <meshStandardMaterial ref={matRef} color={tint} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* 이마의 눈 — 어디를 보는지 알려주는 유일한 단서 */}
      <mesh position={[0, 0.56, 0.42]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial
          color="#ffef9a" emissive="#ffcc33" emissiveIntensity={3} toneMapped={false}
        />
      </mesh>
      {legAt.map(([x, z], i) => (
        <group key={i} position={[x, 0.42, z]} ref={(el) => { legs.current[i] = el }}>
          <mesh position={[x * 0.5, -0.18, 0]} rotation={[0, 0, x > 0 ? -0.7 : 0.7]} castShadow>
            <cylinderGeometry args={[0.05, 0.035, 0.62, 6]} />
            <meshStandardMaterial color="#2a1a18" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ── 트루퍼 — 총을 든 병사. 걸을 때 다리가 엇갈린다 ─────────────── */
function TrooperBody({ tint, matRef }) {
  const legL = useRef()
  const legR = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (legL.current) legL.current.rotation.x = Math.sin(t * 6) * 0.5
    if (legR.current) legR.current.rotation.x = -Math.sin(t * 6) * 0.5
  })

  return (
    <group>
      <group ref={legL} position={[-0.16, 0.78, 0]}>
        <mesh position={[0, -0.39, 0]} castShadow>
          <boxGeometry args={[0.19, 0.78, 0.21]} />
          <meshStandardMaterial color="#3b3020" roughness={0.9} />
        </mesh>
      </group>
      <group ref={legR} position={[0.16, 0.78, 0]}>
        <mesh position={[0, -0.39, 0]} castShadow>
          <boxGeometry args={[0.19, 0.78, 0.21]} />
          <meshStandardMaterial color="#3b3020" roughness={0.9} />
        </mesh>
      </group>

      <mesh position={[0, 1.14, 0]} castShadow>
        <capsuleGeometry args={[0.29, 0.42, 4, 10]} />
        <meshStandardMaterial ref={matRef} color={tint} roughness={0.65} metalness={0.25} />
      </mesh>

      <mesh position={[0, 1.63, 0]} castShadow>
        <boxGeometry args={[0.34, 0.3, 0.34]} />
        <meshStandardMaterial color="#4a3c26" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* 바이저 — 정면을 향한 가로 띠 */}
      <mesh position={[0, 1.64, 0.18]}>
        <boxGeometry args={[0.27, 0.08, 0.03]} />
        <meshStandardMaterial
          color="#ffd166" emissive="#ff9f1c" emissiveIntensity={3.2} toneMapped={false}
        />
      </mesh>

      {/* 들고 있는 총 — 원거리 적이라는 표시 */}
      <group position={[0.28, 1.16, 0.24]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.62, 8]} />
          <meshStandardMaterial color="#20242c" roughness={0.5} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.09, -0.16]} castShadow>
          <boxGeometry args={[0.09, 0.16, 0.2]} />
          <meshStandardMaterial color="#2b2f38" roughness={0.6} metalness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

/* ── 브루트 — 크고 각지다. 무겁게 흔들린다 ─────────────────────── */
function BruteBody({ tint, matRef }) {
  const arms = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (arms.current) {
      arms.current.rotation.x = Math.sin(t * 3.1) * 0.28
      arms.current.position.y = 1.55 + Math.sin(t * 3.1 + 1) * 0.05
    }
  })

  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.95, 0.84, 0.75]} />
        <meshStandardMaterial color="#241432" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <boxGeometry args={[1.32, 1.2, 0.92]} />
        <meshStandardMaterial ref={matRef} color={tint} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* 가슴의 균열 — 약점처럼 보이는 발광부. 실제로는 그냥 표식이지만
          이런 게 있어야 어디를 쏠지 눈이 먼저 정한다. */}
      <mesh position={[0, 1.45, 0.47]}>
        <boxGeometry args={[0.5, 0.14, 0.04]} />
        <meshStandardMaterial
          color="#ff9de0" emissive="#e040fb" emissiveIntensity={3.4} toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 2.16, 0.02]} castShadow>
        <boxGeometry args={[0.5, 0.44, 0.5]} />
        <meshStandardMaterial color="#3a2350" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.18, 0.26]}>
        <boxGeometry args={[0.34, 0.09, 0.03]} />
        <meshStandardMaterial
          color="#ffd9f5" emissive="#e040fb" emissiveIntensity={3} toneMapped={false}
        />
      </mesh>

      <group ref={arms} position={[0, 1.55, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.86, -0.3, 0]} castShadow>
            <boxGeometry args={[0.38, 1.05, 0.4]} />
            <meshStandardMaterial color="#4b2d63" roughness={0.8} metalness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const BODIES = { crawler: CrawlerBody, trooper: TrooperBody, brute: BruteBody }

export default function Enemy({ id, sessionRef }) {
  const group = useRef()
  const inner = useRef()
  const matRef = useRef()

  /* 아이디에서 체격과 색조를 뽑는다. 같은 적은 언제 봐도 같은 모습 */
  const look = useMemo(() => {
    const s = sessionRef.current?.enemies.find((e) => e.id === id)
    const type = s?.type || 'crawler'
    const base = new THREE.Color(ENEMY_TYPES[type].color)
    const hsl = {}
    base.getHSL(hsl)
    base.setHSL(
      (hsl.h + variate(id, 'hue') * 0.035 + 1) % 1,
      THREE.MathUtils.clamp(hsl.s + variate(id, 'sat') * 0.12, 0, 1),
      THREE.MathUtils.clamp(hsl.l + variate(id, 'lig') * 0.09, 0.08, 0.7),
    )
    return {
      type,
      tint: `#${base.getHexString()}`,
      scale: 1 + variate(id, 'size') * 0.09,
    }
  }, [id, sessionRef])

  useFrame(() => {
    const s = sessionRef.current
    if (!s || !group.current) return
    const e = s.enemies.find((v) => v.id === id)
    if (!e) return

    group.current.position.set(e.x, e.y || 0, e.z)
    group.current.rotation.y = e.facing

    const t = ENEMY_TYPES[e.type]

    if (e.state === 'spawning') {
      /* 바닥에서 솟아오른다. 갑자기 나타나는 것보다 어디서 나오는지
         알려 주는 편이 낫다 — 반응할 시간이 생긴다. */
      const p = Math.min(1, e.stateT / t.spawnTime)
      group.current.position.y = (e.y || 0) - t.height * (1 - p)
      inner.current.scale.setScalar(look.scale)
    } else if (e.state === 'dead') {
      /* 앞으로 고꾸라지며 가라앉는다 */
      const p = Math.min(1, e.stateT / CORPSE_LINGER)
      inner.current.rotation.x = p * 1.35
      group.current.position.y = (e.y || 0) - p * t.height * 0.75
      inner.current.scale.setScalar(look.scale * (1 - p * 0.25))
    } else {
      group.current.position.y = e.y || 0
      inner.current.rotation.x = 0
      /* 걸을 때 위아래로 조금 흔들린다. 종류마다 주기를 달리해
         무리가 한 몸처럼 움직이지 않게 한다. */
      const bobF = e.type === 'brute' ? 3.1 : e.type === 'trooper' ? 6 : 11
      const bobA = e.type === 'brute' ? 0.05 : 0.035
      group.current.position.y = (e.y || 0) + Math.abs(Math.sin(e.age * bobF)) * bobA
      inner.current.scale.setScalar(look.scale)
    }

    /* 맞으면 잠깐 하얗게 달아오른다. 명중했다는 걸 이걸로 안다. */
    if (matRef.current) {
      const f = e.hitFlash || 0
      matRef.current.emissive.setRGB(f, f * 0.72, f * 0.6)
      matRef.current.emissiveIntensity = f * 2.4
    }
  })

  const Body = BODIES[look.type]
  return (
    <group ref={group}>
      <group ref={inner}>
        <Body tint={look.tint} matRef={matRef} />
      </group>
    </group>
  )
}
