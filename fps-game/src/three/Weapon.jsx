/* ==================================================================
   손에 든 무기 (1인칭 뷰모델)

   카메라에 붙여 놓는다. 월드에 두고 매 프레임 카메라를 따라가게 하면
   한 프레임씩 늦게 따라와 총이 화면에서 미끄러진다. createPortal 로
   카메라의 자식으로 만들면 카메라가 어떻게 움직이든 같이 간다.

   카메라를 scene 에 넣어 주는 게 조건이다 — 씬 그래프에 없는 물체의
   자식은 그려지지 않는다.
   ================================================================== */
import { useRef, useEffect } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WEAPONS } from '../game/weapons.js'

/* 총구가 화면 어디쯤 오는지. 오른손에 들고 약간 아래로 내린 자세. */
const REST = new THREE.Vector3(0.26, -0.24, -0.52)

function Pistol() {
  return (
    <group>
      <mesh position={[0, 0, -0.1]} castShadow>
        <boxGeometry args={[0.07, 0.1, 0.28]} />
        <meshStandardMaterial color="#2b303a" roughness={0.45} metalness={0.75} />
      </mesh>
      <mesh position={[0, -0.12, 0.02]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.06, 0.18, 0.09]} />
        <meshStandardMaterial color="#1b1e25" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.055, -0.16]}>
        <boxGeometry args={[0.02, 0.02, 0.05]} />
        <meshStandardMaterial color="#8fa3b8" roughness={0.4} metalness={0.9} />
      </mesh>
    </group>
  )
}

function Rifle() {
  return (
    <group>
      <mesh position={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[0.07, 0.09, 0.56]} />
        <meshStandardMaterial color="#333a45" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.26, 8]} />
        <meshStandardMaterial color="#1a1d23" roughness={0.35} metalness={0.9} />
      </mesh>
      <mesh position={[0, -0.13, -0.1]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.055, 0.2, 0.1]} />
        <meshStandardMaterial color="#20242c" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.1, 0.04]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.06, 0.15, 0.08]} />
        <meshStandardMaterial color="#1b1e25" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* 조준경 — 소총이라는 걸 실루엣으로 알린다 */}
      <mesh position={[0, 0.075, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.16, 10]} />
        <meshStandardMaterial color="#151820" roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  )
}

function Shotgun() {
  return (
    <group>
      <mesh position={[0, 0, -0.22]} castShadow>
        <boxGeometry args={[0.095, 0.105, 0.62]} />
        <meshStandardMaterial color="#4a3527" roughness={0.75} metalness={0.25} />
      </mesh>
      {/* 쌍대 총열 — 샷건은 이 실루엣으로 바로 읽힌다 */}
      {[-0.03, 0.03].map((x) => (
        <mesh key={x} position={[x, 0.02, -0.56]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.3, 10]} />
          <meshStandardMaterial color="#22262e" roughness={0.35} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, -0.075, -0.34]}>
        <boxGeometry args={[0.075, 0.07, 0.2]} />
        <meshStandardMaterial color="#33251b" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.11, 0.02]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[0.07, 0.18, 0.11]} />
        <meshStandardMaterial color="#3d2c20" roughness={0.85} metalness={0.1} />
      </mesh>
    </group>
  )
}

function Knife() {
  return (
    <group rotation={[0, 0, -0.3]}>
      {/* 칼날 — 한쪽만 각지게 깎아 날처럼 보이게 한다 */}
      <mesh position={[0, 0.02, -0.24]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.045, 0.42, 4]} />
        <meshStandardMaterial color="#cdd6e2" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.02, -0.03]}>
        <boxGeometry args={[0.09, 0.022, 0.06]} />
        <meshStandardMaterial color="#8b9099" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0, -0.02, 0.08]} rotation={[0.25, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.19, 8]} />
        <meshStandardMaterial color="#2a2118" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  )
}

const MODELS = { pistol: Pistol, rifle: Rifle, shotgun: Shotgun, knife: Knife }

/* 총구 위치 — 화염과 예광선이 여기서 나간다 */
const MUZZLE = { pistol: -0.26, rifle: -0.64, shotgun: -0.72, knife: -0.4 }

export default function Weapon({ sessionRef, flashRef }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const rig = useRef()
  const flash = useRef()
  const light = useRef()

  /* 카메라를 씬에 넣는다. 안 넣으면 자식이 렌더 대상에서 빠진다. */
  useEffect(() => {
    scene.add(camera)
    return () => { scene.remove(camera) }
  }, [scene, camera])

  useFrame((state, dt) => {
    const s = sessionRef.current
    if (!s || !rig.current) return
    const p = s.player
    const w = WEAPONS[p.weapon]

    /* 걸음에 맞춘 흔들림. 멈추면 잦아든다 — 가만히 서 있는데 총이
       계속 흔들리면 멀미가 난다. */
    const bobX = Math.sin(p.bob) * 0.016
    const bobY = Math.abs(Math.cos(p.bob)) * 0.012

    /* 반동 — 뒤로 밀리며 총구가 들린다 */
    const r = p.recoil
    const kick = r * r * 0.09 * w.recoil

    /* 재장전 — 아래로 내렸다가 올라온다 */
    let reloadDip = 0
    let reloadRoll = 0
    if (p.reloading > 0 && w.reload > 0) {
      const prog = 1 - p.reloading / w.reload
      const arc = Math.sin(prog * Math.PI)
      reloadDip = arc * 0.22
      reloadRoll = arc * 0.7
    }

    if (w.melee) {
      /* 근접무기는 뒤로 밀리는 게 아니라 가로로 베어 나간다.
         총과 같은 반동 애니메이션을 쓰면 칼로 찌르는 것처럼 보여서,
         부채꼴로 여럿을 벤다는 실제 판정과 어긋난다. */
      const sw = r * r
      rig.current.position.set(
        REST.x + bobX + sw * 0.34,
        REST.y + bobY + sw * 0.12,
        REST.z + sw * 0.16,
      )
      rig.current.rotation.set(sw * 0.5, sw * 1.15, -sw * 1.5)
    } else {
      rig.current.position.set(
        REST.x + bobX,
        REST.y + bobY - reloadDip,
        REST.z + kick,
      )
      rig.current.rotation.set(-r * 0.28 * w.recoil + reloadRoll, 0, reloadRoll * 0.4)
    }

    // 총구 화염 — flashRef 에 남은 시간이 있으면 보인다.
    // 칼에는 화염이 없다.
    const f = flashRef.current
    if (f.t > 0) f.t = Math.max(0, f.t - dt)
    const on = f.t > 0 && !w.melee
    if (flash.current) {
      flash.current.visible = on
      if (on) {
        const k = f.t / 0.055
        flash.current.scale.setScalar(0.5 + k * 0.9)
        flash.current.rotation.z = f.seed
      }
    }
    if (light.current) light.current.intensity = on ? (f.t / 0.055) * 9 : 0
  })

  const s = sessionRef.current
  const id = s?.player.weapon || 'pistol'
  const Model = MODELS[id] || Pistol
  const muzzleZ = MUZZLE[id] ?? -0.3

  return createPortal(
    <group ref={rig}>
      <Model />
      <group position={[0, 0.02, muzzleZ]}>
        {/* 원뿔은 기본이 +Y 방향이라 앞(-Z)으로 눕힌다 */}
        <mesh ref={flash} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.12, 0.3, 6]} />
          <meshBasicMaterial
            color="#ffd27a" transparent opacity={0.92} toneMapped={false}
            side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>
        <pointLight ref={light} color="#ffb347" intensity={0} distance={7} />
      </group>
    </group>,
    camera,
  )
}
