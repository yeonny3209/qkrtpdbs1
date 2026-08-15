/* ==================================================================
   아레나를 그린다

   game/arena.js 의 상자 목록을 그대로 받아 세운다. 위치를 여기서
   다시 정하지 않는 게 중요하다 — 충돌이 쓰는 좌표와 눈에 보이는
   벽이 어긋나면, 보이지 않는 벽에 막히거나 벽을 뚫고 보이게 된다.

   외부 텍스처 파일은 쓰지 않는다. 바닥 격자는 캔버스에 그려서
   texture 로 올린다 — 파일이 아니라 코드라, 받아올 것이 없다.
   ================================================================== */
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { ARENA, COVER_BOXES, WALL_BOXES } from '../game/arena.js'

/* 바닥 격자. 어두운 바탕에 옅은 선 — 넓은 평면은 무늬가 없으면
   내가 움직이는지 알 수 없다. 속도감은 이 선들에서 나온다. */
function useFloorTexture() {
  return useMemo(() => {
    const S = 256
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')

    g.fillStyle = '#12161d'
    g.fillRect(0, 0, S, S)

    g.strokeStyle = '#1e2732'
    g.lineWidth = 6
    g.strokeRect(0, 0, S, S)

    g.strokeStyle = '#191f28'
    g.lineWidth = 2
    for (let i = 1; i < 4; i++) {
      const p = (S / 4) * i
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke()
      g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke()
    }

    // 군데군데 얼룩 — 완전히 균일하면 인쇄물처럼 보인다
    g.fillStyle = 'rgba(255,255,255,0.015)'
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      g.fillRect(x, y, 2 + Math.random() * 10, 2 + Math.random() * 10)
    }

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(ARENA.half, ARENA.half)
    tex.anisotropy = 4
    return tex
  }, [])
}

/* 벽 하나. 위쪽 모서리에 가는 발광 띠를 둘러 윤곽을 세운다 —
   어두운 방에서 벽과 바닥이 같은 검정이면 거리를 못 읽는다. */
function Block({ box, color, trim }) {
  const w = box.maxX - box.minX
  const h = box.maxY - box.minY
  const d = box.maxZ - box.minZ
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2

  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
      </mesh>
      {trim && (
        <mesh position={[0, h + 0.03, 0]}>
          <boxGeometry args={[w + 0.06, 0.07, d + 0.06]} />
          <meshStandardMaterial
            color={trim}
            emissive={trim}
            emissiveIntensity={1.7}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}

export default function Arena() {
  const floor = useFloorTexture()
  useEffect(() => () => floor.dispose(), [floor])

  const span = ARENA.half * 2

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[span, span]} />
        <meshStandardMaterial map={floor} roughness={0.95} metalness={0.05} />
      </mesh>

      {/* 천장 — 없으면 위가 뻥 뚫려 실내 느낌이 안 난다.
          빛을 안 받는 어두운 판이면 충분하다. */}
      <mesh position={[0, ARENA.wallHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[span, span]} />
        <meshStandardMaterial color="#080b10" roughness={1} side={THREE.FrontSide} />
      </mesh>

      {WALL_BOXES.map((b, i) => (
        <Block key={`w${i}`} box={b} color="#1a212b" trim="#2f6f8f" />
      ))}
      {COVER_BOXES.map((b, i) => (
        <Block key={`c${i}`} box={b} color="#232b36" trim="#c2452f" />
      ))}

      {/* ── 조명 ──────────────────────────────────────────────────
          그림자를 만드는 빛은 하나만 둔다. 여러 개가 그림자를 그리면
          적 20마리가 나올 때 프레임이 눈에 띄게 떨어진다. */}
      <ambientLight intensity={0.35} color="#7f8fa6" />
      <hemisphereLight args={['#4b6076', '#0a0d12', 0.6]} />
      <directionalLight
        position={[8, 18, 6]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={45}
      />
      <pointLight position={[-11, 3.2, -11]} intensity={22} distance={20} color="#ff7043" />
      <pointLight position={[11, 3.2, 11]} intensity={22} distance={20} color="#4fc3f7" />
      <pointLight position={[0, 3.6, 0]} intensity={28} distance={18} color="#ffd54f" />
    </group>
  )
}
