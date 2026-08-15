/* ==================================================================
   보급품

   웨이브 사이에 아레나 한복판에 놓인다. 집으려면 엄폐물 밖으로
   나와야 하고, 그 몇 초가 이 게임에서 스스로 감수하는 유일한
   위험이다. 그래서 멀리서도 보이게 띄우고 돌리고 빛나게 한다.

   개수가 적고 자주 바뀌지 않지만, React 목록으로 관리하면 웨이브마다
   목록이 갈려 다시 그려진다. 미리 만들어 둔 자리 몇 개를 세션의
   배열에 맞춰 켜고 끄는 편이 조용하다.
   ================================================================== */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const SLOTS = 8

const LOOK = {
  weapon: { color: '#7fd4ff', emissive: '#2f9fd4' },
  ammo: { color: '#ffd166', emissive: '#d49b2f' },
  health: { color: '#7CFFB2', emissive: '#2fd47f' },
}

function Shape({ kind }) {
  if (kind === 'health') {
    /* 십자 — 체력이라는 걸 설명 없이 알린다 */
    return (
      <group>
        <mesh><boxGeometry args={[0.44, 0.15, 0.15]} /><meshStandardMaterial
          color={LOOK.health.color} emissive={LOOK.health.emissive}
          emissiveIntensity={1.6} toneMapped={false} /></mesh>
        <mesh><boxGeometry args={[0.15, 0.44, 0.15]} /><meshStandardMaterial
          color={LOOK.health.color} emissive={LOOK.health.emissive}
          emissiveIntensity={1.6} toneMapped={false} /></mesh>
      </group>
    )
  }
  if (kind === 'ammo') {
    return (
      <group>
        <mesh><boxGeometry args={[0.34, 0.26, 0.24]} /><meshStandardMaterial
          color={LOOK.ammo.color} emissive={LOOK.ammo.emissive}
          emissiveIntensity={1.3} metalness={0.5} roughness={0.4} toneMapped={false} /></mesh>
        <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.37, 0.06, 0.27]} />
          <meshStandardMaterial color="#3a2f16" roughness={0.8} /></mesh>
      </group>
    )
  }
  // 무기 — 길쭉한 상자에 총열 하나
  return (
    <group rotation={[0, 0, 0.35]}>
      <mesh><boxGeometry args={[0.52, 0.13, 0.16]} /><meshStandardMaterial
        color={LOOK.weapon.color} emissive={LOOK.weapon.emissive}
        emissiveIntensity={1.4} metalness={0.6} roughness={0.35} toneMapped={false} /></mesh>
      <mesh position={[0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.3, 8]} />
        <meshStandardMaterial color="#1c2029" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  )
}

function Slot({ index, sessionRef }) {
  const group = useRef()
  const kindRef = useRef(null)

  useFrame((state) => {
    const s = sessionRef.current
    const g = group.current
    if (!s || !g) return
    const p = s.pickups[index]
    if (!p) { g.visible = false; return }

    g.visible = true
    kindRef.current = p.kind
    const t = state.clock.elapsedTime
    g.position.set(p.x, 0.75 + Math.sin(t * 2 + index) * 0.13, p.z)
    g.rotation.y = t * 1.1 + index
  })

  const s = sessionRef.current
  const kind = s?.pickups[index]?.kind || 'ammo'
  const look = LOOK[kind] || LOOK.ammo

  return (
    <group ref={group} visible={false}>
      <Shape kind={kind} />
      {/* 바닥에 빛 웅덩이 — 어두운 곳에서 위치를 알려준다 */}
      <pointLight color={look.emissive} intensity={5} distance={5} />
    </group>
  )
}

export default function Pickups({ sessionRef, revision }) {
  return (
    <group>
      {Array.from({ length: SLOTS }, (_, i) => (
        <Slot key={`${i}-${revision}`} index={i} sessionRef={sessionRef} />
      ))}
    </group>
  )
}
