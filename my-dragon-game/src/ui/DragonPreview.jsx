/* 도감·배너에 쓰는 작은 3D 미리보기 (천천히 도는 드래곤) */
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import DragonModel from '../three/DragonModel.jsx'
import { fitDistance } from '../three/fit.js'
import { ELEMENT_BY_ID } from '../game/elements.js'

function Turntable({ elementId, rarity, spin }) {
  const g = useRef()
  useFrame(({ camera }, dt) => {
    if (g.current && spin) g.current.rotation.y += dt * 0.45
    /* 미리보기 상자는 화면마다 비율이 달라진다 — 매 프레임 담기는 거리로 맞춘다 */
    const d = fitDistance(camera)
    if (Math.abs(camera.position.z - d) > 0.01) {
      camera.position.set(0, 0.35, d)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }
  })
  /* 드래곤은 발끝 y≈0, 머리 끝 y≈2.7 이라 중심이 1.35다.
     그만큼 내려야 원점(카메라가 보는 곳)에 몸통이 온다. */
  return (
    <group ref={g} position={[0, -1.35, 0]}>
      <DragonModel elementId={elementId} rarity={rarity} />
    </group>
  )
}

export default function DragonPreview({ elementId, rarity, spin = true, className = '' }) {
  const el = ELEMENT_BY_ID[elementId]
  return (
    <div className={className}>
      {/* 날개까지 다 담기도록 넉넉히 물러서 있는다 */}
      <Canvas camera={{ fov: 40, position: [0, 0.35, 8.4] }} gl={{ alpha: true }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 6, 4]} intensity={1.2} />
        <pointLight position={[-3, 2, 3]} intensity={6} distance={12} color={el?.glow || '#fff'} />
        <Turntable elementId={elementId} rarity={rarity} spin={spin} />
      </Canvas>
    </div>
  )
}
