/* ==================================================================
   타격 연출 — 예광선과 불꽃

   총알은 히트스캔이라 실제로 날아가는 물체가 없다. 그래서 아무것도
   안 그리면 방아쇠를 당겨도 화면에 변화가 없고, 맞혔는지 빗나갔는지
   알 수가 없다. 총구에서 착탄점까지 선을 잠깐 긋고 그 자리에 불꽃을
   튀기는 것으로 그 공백을 메운다.

   매번 mesh 를 만들고 버리면 쓰레기 수집이 프레임을 먹는다. 미리
   만들어 둔 만큼만 돌려 쓰고, 넘치면 가장 오래된 것을 덮어쓴다 —
   연출이 한둘 빠지는 것보다 끊기는 게 나쁘다.
   ================================================================== */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACERS, SPARKS, TRACER_LIFE, SPARK_LIFE } from './effectPool.js'

export default function Effects({ effectsRef }) {
  const tracerRefs = useRef([])
  const sparkRefs = useRef([])
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const fx = effectsRef.current
    if (!fx) return

    // ── 예광선 ──────────────────────────────────────────────────
    for (const t of fx.tracers) t.t -= dt
    fx.tracers = fx.tracers.filter((t) => t.t > 0)

    for (let i = 0; i < TRACERS; i++) {
      const m = tracerRefs.current[i]
      if (!m) continue
      const t = fx.tracers[i]
      if (!t) { m.visible = false; continue }

      tmpA.set(t.from.x, t.from.y, t.from.z)
      tmpB.set(t.to.x, t.to.y, t.to.z)
      const len = tmpA.distanceTo(tmpB)
      m.visible = true
      m.position.copy(tmpA).lerp(tmpB, 0.5)
      m.lookAt(tmpB)
      /* 박스는 기본이 z 로 1 이라, 길이만 늘이면 선이 된다 */
      m.scale.set(1, 1, Math.max(0.001, len))
      const k = t.t / TRACER_LIFE
      m.material.opacity = k * 0.85
    }

    // ── 불꽃 ────────────────────────────────────────────────────
    for (const s of fx.sparks) s.t -= dt
    fx.sparks = fx.sparks.filter((s) => s.t > 0)

    for (let i = 0; i < SPARKS; i++) {
      const m = sparkRefs.current[i]
      if (!m) continue
      const s = fx.sparks[i]
      if (!s) { m.visible = false; continue }

      const k = s.t / SPARK_LIFE
      m.visible = true
      m.position.set(s.at.x, s.at.y, s.at.z)
      /* 터졌다가 사그라든다 */
      m.scale.setScalar((1 - k) * 0.42 + 0.06)
      m.material.opacity = k * k
      m.material.color.set(s.kind === 'flesh' ? '#ff5a4d' : '#ffd08a')
    }
  })

  return (
    <group>
      {Array.from({ length: TRACERS }, (_, i) => (
        <mesh key={`t${i}`} ref={(el) => { tracerRefs.current[i] = el }} visible={false}>
          <boxGeometry args={[0.022, 0.022, 1]} />
          <meshBasicMaterial
            color="#ffe9a8" transparent opacity={0} toneMapped={false} depthWrite={false}
          />
        </mesh>
      ))}
      {Array.from({ length: SPARKS }, (_, i) => (
        <mesh key={`s${i}`} ref={(el) => { sparkRefs.current[i] = el }} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial
            color="#ffd08a" transparent opacity={0} toneMapped={false} depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
