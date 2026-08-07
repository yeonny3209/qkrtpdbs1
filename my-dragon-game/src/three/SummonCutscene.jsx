/* ==================================================================
   소환 컷씬

   암전 → 마법진 → 기 모임 → 폭발 → 굴러 들어옴 → 착지 →
   숨 들이켬 → 포효 → 이름

   타이밍 계산은 summonTimeline.js 에 따로 뺐다. 예전 컷씬은 단계
   전환을 rAF 콜백 안에서 직접 만져서, 어긋나도 눈으로밖에 확인할
   길이 없었다.

   포효는 턱이 실제로 벌어지고(DragonModel 의 maw) 숨결이 뿜어져
   나온다(breath). 고개만 젖히던 예전 연출은 포효로 보이지 않았다.
   ================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import DragonModel from './DragonModel.jsx'
import { fitDistance } from './fit.js'
import { ELEMENT_BY_ID } from '../game/elements.js'
import { RARITY_BY_ID } from '../game/dragons.js'
import {
  phaseAt, totalTime, nameVisible, dragonPose, cameraShot,
  mawAt, breathAt, shakeAt, flashAt, chargeAt, circleAt, letterboxAt,
} from './summonTimeline.js'

const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/* 반드시 담아야 하는 건 몸통과 머리지 날개폭이 아니다.
   날개까지 다 넣으려고 상자를 넓게 잡으면(전투용 DRAGON_BOX 처럼)
   세로 화면에서 가로 기준으로 6 유닛 넘게 물러나 드래곤이 손톱만 해진다.
   날개 끝은 잘려도 되고, 잘리는 편이 오히려 커 보인다. */
const CUT_BOX = { w: 2.6, h: 3.0 }
const CUT_SCALE = 1.12

/* 점 스프라이트는 기본이 네모라서 그냥 두면 픽셀 덩어리로 보인다.
   가운데가 밝고 가장자리로 사라지는 원을 한 장 만들어 씌운다. */
let softDot = null
function useSoftDot() {
  return useMemo(() => {
    if (softDot) return softDot
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    const ctx = c.getContext('2d')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    softDot = new THREE.CanvasTexture(c)
    return softDot
  }, [])
}

/* ------------------------------------------------------------------
   빨려드는 입자 — 기를 모으는 동안 사방에서 중앙으로 모인다
   ------------------------------------------------------------------ */
function Motes({ color, charge, count = 420 }) {
  const ref = useRef()
  const dot = useSoftDot()
  const seeds = useMemo(() => Array.from({ length: count }, () => ({
    r: 5 + Math.random() * 9,
    a: Math.random() * Math.PI * 2,
    y: Math.random() * 6 - 0.5,
    spin: 0.4 + Math.random() * 1.2,
    ph: Math.random(),
  })), [count])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    return g
  }, [count])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    if (charge <= 0) { m.material.opacity = 0; return }
    const c = charge
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      /* 모일수록 반지름이 줄고 회전이 빨라진다 */
      const k = clamp01(c * (0.55 + s.ph * 0.7))
      const r = s.r * (1 - easeOut(k)) + 0.25
      const a = s.a + t * s.spin * (1 + c * 3)
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 1.2 + (s.y - 1.2) * (1 - easeOut(k))
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    geo.attributes.position.needsUpdate = true
    m.material.opacity = 0.9 * clamp01(c * 1.6)
    m.material.size = 0.10 + c * 0.10
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={color} map={dot} alphaTest={0.01}
        transparent opacity={0} size={0.10}
        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

/* 위로 떠오르는 잔불 — 착지 이후 분위기를 채운다 */
function Embers({ color, on, count = 90 }) {
  const ref = useRef()
  const dot = useSoftDot()
  const seeds = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 11,
    z: (Math.random() - 0.5) * 11,
    y0: Math.random() * 5,
    sp: 0.25 + Math.random() * 0.6,
  })), [count])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    return g
  }, [count])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      const y = (s.y0 + t * s.sp) % 5.5
      pos[i * 3] = s.x + Math.sin(t * 0.5 + i) * 0.25
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = s.z
    }
    geo.attributes.position.needsUpdate = true
    m.material.opacity = on ? 0.5 : 0
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={color} map={dot} alphaTest={0.01}
        transparent opacity={0} size={0.11}
        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

/* 바닥에서 솟는 빛기둥.
   균일한 원기둥으로 두면 빛이 아니라 회색 콘크리트 기둥처럼 보인다.
   꼭대기로 갈수록 투명해지도록 정점 색을 먹여 위로 스러지게 만든다. */
function Pillars({ color, k, n = 10 }) {
  const g = useRef()

  const geo = useMemo(() => {
    const c = new THREE.CylinderGeometry(0.05, 0.13, 1, 7, 6, true)
    c.translate(0, 0.5, 0)      /* 바닥에서 자라나도록 기준점을 아래로 */
    const pos = c.attributes.position
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      /* 아래는 밝고 위는 0 — 부드럽게 떨어지도록 제곱 */
      const f = Math.pow(1 - pos.getY(i), 2)
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f
    }
    c.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return c
  }, [])

  useFrame(({ clock }) => {
    if (!g.current) return
    g.current.rotation.y = clock.elapsedTime * 0.18
    g.current.children.forEach((m, i) => {
      const wob = 1 + Math.sin(clock.elapsedTime * 2 + i) * 0.14
      m.scale.set(1, Math.max(0.001, k * 4.2 * wob), 1)
      if (m.material) m.material.opacity = 0.5 * k
    })
  })

  return (
    <group ref={g}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <mesh key={i} geometry={geo} position={[Math.cos(a) * 2.8, 0, Math.sin(a) * 2.8]}>
            <meshBasicMaterial color={color} vertexColors transparent opacity={0}
              side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------
   3D 무대
   ------------------------------------------------------------------ */
function Stage({ dragon, rarity, elapsed, onShake }) {
  const el = ELEMENT_BY_ID[dragon.element]
  const holder = useRef()
  const runes = useRef()
  const ringsRef = useRef()
  const orb = useRef()
  const shock = useRef([])

  useFrame(({ camera, clock }) => {
    const g = holder.current
    if (!g) return
    const now = clock.elapsedTime
    const { phase, p } = phaseAt(rarity, elapsed)
    const D = fitDistance(camera, CUT_BOX)

    const charge = chargeAt(phase, p)
    const circle = circleAt(phase, p)

    /* ---- 드래곤 · 카메라 ----
       자세와 카메라 워크는 summonTimeline 의 순수 함수가 정한다.
       여기서 직접 계산하면 화면 없이는 검증할 방법이 없다. */
    const pose = dragonPose(phase, p, now)
    g.visible = pose.visible
    g.position.set(...pose.pos)
    g.rotation.set(...pose.rot)
    g.scale.set(...pose.scale)

    const shot = cameraShot(phase, p, D, now)
    camera.position.set(...shot.pos)
    camera.lookAt(...shot.look)

    const sh = shakeAt(phase, p)
    onShake?.(sh)

    /* ---- 마법진 ---- */
    if (ringsRef.current) {
      ringsRef.current.rotation.y += 0.008 + charge * 0.05
      const rings = ringsRef.current.children
      rings.forEach((m, i) => {
        /* 안쪽 고리부터 차례로 켜지고, circle 이 1 이면 전부 다 켜진다 */
        const on = clamp01(circle * 1.7 - (i / rings.length) * 0.7)
        m.scale.setScalar(0.3 + on * 0.7)
        if (m.material) m.material.opacity = (0.55 - i * 0.08) * on
      })
    }
    if (runes.current) {
      runes.current.rotation.y -= 0.014 + charge * 0.04
      const rs = runes.current.children
      rs.forEach((m, i) => {
        /* 룬이 시계 방향으로 하나씩 켜진다 */
        const on = clamp01(circle * 2.2 - (i / rs.length) * 1.2)
        m.scale.setScalar(on)
        if (m.material) m.material.opacity = 0.85 * on
      })
    }
    /* ---- 기 덩어리 ---- */
    if (orb.current) {
      const showOrb = phase === 'charge' || phase === 'burst'
      orb.current.visible = showOrb
      if (showOrb) {
        const burst = phase === 'burst' ? easeOut(p) : 0
        const beat = 1 + Math.sin(now * 12) * 0.05 * charge
        orb.current.scale.setScalar((0.20 + charge * 0.90) * beat + burst * 7)
        /* 껍질마다 원래 투명도가 다르므로 배율만 곱한다 */
        const k = burst ? 1 - burst : 0.35 + charge * 0.65
        orb.current.children.forEach((m, i) => {
          m.material.opacity = (i === 0 ? 0.9 : 0.30 - (i - 1) * 0.09) * k
        })
      }
    }
    /* ---- 착지·포효 충격파 ---- */
    shock.current.forEach((m, i) => {
      if (!m) return
      let k = -1
      if (phase === 'land') k = clamp01(p * 1.5 - i * 0.22)
      else if (phase === 'roar' && p < 0.6) k = clamp01((p / 0.6) * 1.5 - i * 0.22)
      if (k <= 0 || k >= 1) { m.visible = false; return }
      m.visible = true
      m.scale.setScalar(0.5 + easeOut(k) * (phase === 'roar' ? 7 : 5))
      m.material.opacity = 0.6 * (1 - k)
    })
  })

  /* 렌더 때 쓰는 값 — elapsed 가 매 프레임 바뀌므로 여기도 매 프레임 갱신된다 */
  const { phase, p } = phaseAt(rarity, elapsed)
  const maw = mawAt(phase, p)
  const breath = breathAt(phase, p)
  const charge = chargeAt(phase, p)
  const landed = phase === 'land' || phase === 'rear' || phase === 'roar' || phase === 'settle'

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[4, 8, 5]} intensity={1.0} />
      <pointLight position={[0, 3, 5]} intensity={14} distance={20} color={el.glow} />

      {/* 바닥 — 지름을 넉넉히 잡아야 끝단이 안개에 묻힌다.
          16 으로 두었더니 화면 한가운데를 가로지르는 선이 생겼다 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[44, 64]} />
        <meshStandardMaterial color="#08080f" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* 마법진 — 고리. 드래곤 발밑에 깔리는 정도여야 한다.
          반지름을 4.7 까지 키웠더니 화면 아래 절반을 잡아먹었다 */}
      <group ref={ringsRef}>
        {[1.5, 2.05, 2.6, 3.15].map((r, i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.01 + i * 0.004, 0]}>
            <ringGeometry args={[r, r + 0.05, 72]} />
            <meshBasicMaterial color={el.glow} transparent opacity={0}
              toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* 마법진 — 둘레에 박힌 룬 조각 */}
      <group ref={runes}>
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 2.35, 0.02, Math.sin(a) * 2.35]}
              rotation={[-Math.PI / 2, 0, -a]}>
              <planeGeometry args={[0.13, 0.26]} />
              <meshBasicMaterial color={el.glow} transparent opacity={0}
                toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          )
        })}
      </group>

      <Pillars color={el.glow} k={charge} />

      {/* 기 덩어리 — 구 하나만 두면 가장자리가 딱 끊겨 원판처럼 보인다.
          작고 밝은 심 + 크고 옅은 겉껍질을 겹쳐 빛이 번지게 한다 */}
      <group ref={orb} position={[0, 1.2, 0]} visible={false}>
        <mesh>
          <sphereGeometry args={[0.45, 20, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9}
            toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {[0.75, 1.05, 1.45].map((r, i) => (
          <mesh key={i}>
            <sphereGeometry args={[r, 20, 16]} />
            <meshBasicMaterial color={el.glow} transparent opacity={0.30 - i * 0.09}
              toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* 충격파 — 세 겹이 시차를 두고 퍼진다 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { shock.current[i] = m }} visible={false}
          rotation-x={-Math.PI / 2} position={[0, 0.05 + i * 0.01, 0]}>
          <ringGeometry args={[0.7, 0.92, 56]} />
          <meshBasicMaterial color={el.glow} transparent opacity={0} toneMapped={false}
            side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      <Motes color={el.glow} charge={charge} />
      <Embers color={el.glow} on={landed} />

      <group ref={holder} visible={false}>
        <DragonModel elementId={dragon.element} rarity={dragon.rarity} dragonId={dragon.id}
          scale={CUT_SCALE} maw={maw} breath={breath} />
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
  const rarity = dragon.rarity

  const [elapsed, setElapsed] = useState(0)
  const [shake, setShake] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    let raf = 0
    startRef.current = performance.now()
    const tick = () => {
      setElapsed((performance.now() - startRef.current) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const { phase, p } = phaseAt(rarity, elapsed)
  const showName = nameVisible(rarity, elapsed)
  const flash = flashAt(phase, p)
  const bars = letterboxAt(rarity, elapsed)
  const done = elapsed >= totalTime(rarity)

  return (
    <div className="fixed inset-0 z-50 select-none bg-black"
      onClick={() => showName && onDone()}
      style={{ transform: shake ? `translate(${Math.sin(elapsed * 91) * 7 * shake}px, ${Math.sin(elapsed * 67) * 5 * shake}px)` : undefined }}>

      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 120, position: [0, 2, 8] }}>
        <color attach="background" args={['#04040a']} />
        <fog attach="fog" args={['#04040a', 10, 30]} />
        <Stage dragon={dragon} rarity={rarity} elapsed={elapsed} onShake={setShake} />
      </Canvas>

      {/* 화면 번쩍임 */}
      {flash > 0.01 && (
        <div className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 52%, #fff ${flash * 12}%, ${el.glow} ${20 + flash * 25}%, transparent 72%)`,
            opacity: flash,
            mixBlendMode: 'screen',
          }} />
      )}

      {/* 가장자리 어둡게 — 시선을 가운데로 모은다 */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,.72) 100%)' }} />

      {/* 시네마 레터박스 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-black transition-none"
        style={{ height: `${bars * 8}vh` }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black"
        style={{ height: `${bars * 8}vh` }} />

      {/* 등급 띠 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: rar.color, boxShadow: `0 0 24px ${rar.color}`, opacity: bars }} />

      {/* 기 모으는 동안의 안내 */}
      {(phase === 'dark' || phase === 'circle' || phase === 'charge') && (
        <div className="pointer-events-none absolute inset-x-0 top-[16%] text-center">
          <div className="text-[11px] font-black tracking-[0.6em] text-white/45">SUMMONING</div>
        </div>
      )}

      {/* 이름 · 등급 */}
      {showName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[14%] text-center">
          {result.isLimited && (
            <div className="mb-3 inline-block rounded-full px-5 py-1.5 text-[11px] font-black tracking-[0.35em] [animation:cutRise_.5s_cubic-bezier(.2,1.3,.4,1)_both]"
              style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2477', boxShadow: '0 0 30px #fbbf2444' }}>
              한정 픽업
            </div>
          )}
          <div className="text-[11px] font-black tracking-[0.5em] [animation:cutRise_.5s_60ms_cubic-bezier(.2,1.3,.4,1)_both]"
            style={{ color: rar.color }}>
            {'★'.repeat(rar.star)} {rar.name}
          </div>
          <h1 className="mt-2 text-5xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,.95)] sm:text-6xl [animation:cutName_.7s_120ms_cubic-bezier(.2,1.2,.35,1)_both]">
            {dragon.name}
          </h1>
          <div className="mt-2 text-lg font-bold [animation:cutRise_.5s_240ms_cubic-bezier(.2,1.3,.4,1)_both]"
            style={{ color: el.glow }}>
            {el.icon} {el.name} · {dragon.epithet}
          </div>
          {result.viaPity && (
            <div className="mt-3 text-[12px] font-bold text-amber-300/90 [animation:cutRise_.5s_360ms_both]">
              천장 도달 — 한정 확정
            </div>
          )}
        </div>
      )}

      {/* 건너뛰기 / 확인 */}
      <button onClick={(e) => { e.stopPropagation(); onDone() }}
        className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-xs font-bold text-white/80 backdrop-blur-sm transition hover:bg-white/10">
        {showName ? '확인 →' : '건너뛰기 ✕'}
      </button>
      {done && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[6%] text-center text-[12px] text-white/45">
          화면을 눌러 계속
        </div>
      )}

      <style>{`
        @keyframes cutRise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        @keyframes cutName {
          from { opacity: 0; transform: translateY(30px) scale(1.25); letter-spacing: .18em; filter: blur(6px) }
          to   { opacity: 1; transform: none; letter-spacing: normal; filter: none }
        }
      `}</style>
    </div>
  )
}
