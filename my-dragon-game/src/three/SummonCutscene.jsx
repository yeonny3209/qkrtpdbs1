/* ==================================================================
   소환 컷씬 — 드래곤이 굴러 들어와 포효한다 (사용자 확정 연출)

   [단계]  charge 기가 모임 → roll 회전하며 등장 → roar 착지·포효 → done
   등급이 높을수록 길고 화려하다. 아무 때나 건너뛸 수 있다.
   ================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import DragonModel from './DragonModel.jsx'
import { fitDistance } from './fit.js'
import { ELEMENT_BY_ID } from '../game/elements.js'
import { RARITY_BY_ID } from '../game/dragons.js'

/* 등급별 연출 길이(초) */
const TIMING = {
  common: { charge: 0.45, roll: 0.70, roar: 0.55 },
  rare: { charge: 0.60, roll: 0.85, roar: 0.70 },
  epic: { charge: 0.95, roll: 1.15, roar: 1.10 },
  legend: { charge: 1.35, roll: 1.45, roar: 1.60 },
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

/* ------------------------------------------------------------------
   3D 무대 — 시간에 따라 드래곤과 카메라를 움직인다
   ------------------------------------------------------------------ */
function Stage({ dragon, t, phase, onRoarHit }) {
  const el = ELEMENT_BY_ID[dragon.element]
  const holder = useRef()
  const ringsRef = useRef()
  const burst = useRef()
  const hitOnce = useRef(false)
  const time = useMemo(() => TIMING[dragon.rarity] || TIMING.common, [dragon.rarity])

  useFrame(({ camera, clock }) => {
    const g = holder.current
    if (!g) return
    const now = clock.elapsedTime
    /* 세로 화면에서도 날개가 잘리지 않는 거리 */
    const D = fitDistance(camera)
    const far = D + 1.6

    if (phase === 'charge') {
      /* 아직 화면 밖. 기운만 모인다 */
      g.position.set(0, 0.4, -22)
      g.rotation.set(0, 0, 0)
      g.scale.setScalar(0.6)
      camera.position.set(0, 1.9, far)
      camera.lookAt(0, 1.25, 0)
    } else if (phase === 'roll') {
      /* 멀리서 굴러 들어온다 — 회전하며 다가온다 */
      const p = Math.min(1, t / time.roll)
      const e = easeOut(p)
      g.position.set(0, 0.4 + Math.sin(p * Math.PI) * 1.5, -22 + e * 22)
      /* 배럴롤 + 앞구르기를 섞어 역동적으로 */
      g.rotation.set(p * Math.PI * 2.4, Math.sin(p * Math.PI) * 0.5, p * Math.PI * 3.2 * (1 - e * 0.55))
      g.scale.setScalar(0.6 + e * 0.4)
      camera.position.set(Math.sin(now * 0.6) * 1.2, 2.1 + (1 - e) * 1.4, far + (1 - e) * 2.2)
      camera.lookAt(0, 1.25, 0)
    } else {
      /* 착지 후 포효 — 살짝 튕기며 자리를 잡는다 */
      const p = Math.min(1, t / time.roar)
      const settle = easeOut(Math.min(1, p * 2.2))
      g.position.set(0, 0.4 + (1 - settle) * 0.55 + Math.sin(now * 1.4) * 0.05, 0)
      g.rotation.set(0, Math.sin(now * 0.5) * 0.12, 0)
      g.scale.setScalar(1)
      /* 이름표가 아래에 뜨므로 살짝 위를 본다 */
      camera.position.set(Math.sin(now * 0.35) * 1.2, 1.9, D + 0.25 - p * 0.4)
      camera.lookAt(0, 1.5, 0)

      /* 착지 순간 한 번만 충격파 */
      if (!hitOnce.current && p > 0.12) { hitOnce.current = true; onRoarHit?.() }
      if (burst.current) {
        const b = Math.min(1, p * 1.8)
        burst.current.scale.setScalar(0.3 + b * 7)
        burst.current.material.opacity = Math.max(0, 0.55 * (1 - b))
      }
    }

    if (ringsRef.current) ringsRef.current.rotation.y += 0.02
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 5]} intensity={1.1} />
      <pointLight position={[0, 3, 5]} intensity={12} distance={18} color={el.glow} />

      {/* 바닥 — 반사되는 어두운 무대 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial color="#0a0a12" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* 마법진 */}
      <group ref={ringsRef}>
        {[2.2, 3.0, 3.9].map((r, i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.01 + i * 0.004, 0]}>
            <ringGeometry args={[r, r + 0.045, 64]} />
            <meshBasicMaterial color={el.glow} transparent opacity={0.5 - i * 0.11} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* 착지 충격파 */}
      <mesh ref={burst} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.7, 1, 48]} />
        <meshBasicMaterial color={el.glow} transparent opacity={0} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      <group ref={holder}>
        <DragonModel elementId={dragon.element} rarity={dragon.rarity} dragonId={dragon.id} roar={phase === 'roar'} />
      </group>
    </>
  )
}

/* ------------------------------------------------------------------
   컷씬 전체 (3D + 화면 위 글자)
   ------------------------------------------------------------------ */
export default function SummonCutscene({ result, onDone }) {
  const dragon = result.dragon
  const el = ELEMENT_BY_ID[dragon.element]
  const rar = RARITY_BY_ID[dragon.rarity]
  const time = TIMING[dragon.rarity] || TIMING.common

  const [phase, setPhase] = useState('charge')
  const [t, setT] = useState(0)
  const [shock, setShock] = useState(false)
  const startRef = useRef(0)

  /* 단계 진행 — rAF로 직접 잰다 (setInterval보다 매끄럽다) */
  useEffect(() => {
    let raf = 0
    let cur = 'charge'
    startRef.current = performance.now()
    const tick = () => {
      const dt = (performance.now() - startRef.current) / 1000
      setT(dt)
      if (cur === 'charge' && dt >= time.charge) {
        cur = 'roll'; startRef.current = performance.now(); setPhase('roll'); setT(0)
      } else if (cur === 'roll' && dt >= time.roll) {
        cur = 'roar'; startRef.current = performance.now(); setPhase('roar'); setT(0)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [time])

  const showName = phase === 'roar'
  const canFinish = phase === 'roar' && t > time.roar * 0.55

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={() => canFinish && onDone()}>
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 100, position: [0, 2, 7.4] }}>
        <color attach="background" args={['#05050b']} />
        <fog attach="fog" args={['#05050b', 9, 26]} />
        <Stage dragon={dragon} t={t} phase={phase} onRoarHit={() => setShock(true)} />
      </Canvas>

      {/* 기 모으는 동안의 빛 기둥 */}
      {phase === 'charge' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-full w-1 animate-pulse" style={{ background: `linear-gradient(transparent, ${el.glow}, transparent)`, boxShadow: `0 0 90px 30px ${el.glow}` }} />
        </div>
      )}

      {/* 착지 순간 화면 플래시 */}
      {shock && (
        <div className="pointer-events-none absolute inset-0 [animation:flash_.5s_ease-out_forwards]"
          style={{ background: `radial-gradient(circle at 50% 55%, ${el.glow}, transparent 60%)` }} />
      )}

      {/* 등급 띠 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5" style={{ background: rar.color, boxShadow: `0 0 24px ${rar.color}` }} />

      {/* 이름 · 등급 */}
      {showName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 text-center [animation:rise_.6s_cubic-bezier(.2,1.3,.4,1)]">
          {result.isLimited && (
            <div className="mb-2 inline-block rounded-full px-4 py-1 text-[11px] font-black tracking-[0.3em]"
              style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2466' }}>
              한정 픽업
            </div>
          )}
          <div className="text-[11px] font-black tracking-[0.5em]" style={{ color: rar.color }}>
            {'★'.repeat(rar.star)} {rar.name}
          </div>
          <h1 className="mt-2 text-5xl font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,.9)] sm:text-6xl">
            {dragon.name}
          </h1>
          <div className="mt-2 text-lg font-bold" style={{ color: el.glow }}>
            {el.icon} {el.name} · {dragon.epithet}
          </div>
          {result.viaPity && (
            <div className="mt-3 text-[12px] font-bold text-amber-300/90">천장 도달 — 한정 확정</div>
          )}
        </div>
      )}

      {/* 건너뛰기 / 확인 */}
      <button onClick={onDone}
        className="absolute right-5 top-5 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-xs font-bold text-white/80 backdrop-blur-sm transition hover:bg-white/10">
        {canFinish ? '확인 →' : '건너뛰기 ✕'}
      </button>
      {canFinish && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-[12px] text-white/45">
          화면을 눌러 계속
        </div>
      )}

      <style>{`
        @keyframes flash { from { opacity: .85 } to { opacity: 0 } }
        @keyframes rise { from { opacity: 0; transform: translateY(26px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}
