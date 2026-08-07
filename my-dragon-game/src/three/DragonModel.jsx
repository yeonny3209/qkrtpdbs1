/* ==================================================================
   드래곤 3D 모델 — 외부 모델 파일 없이 기본 도형으로 조립한다.

   체형(bodyType)마다 뼈대가 다르다. 비늘색만 바꾸면 결국 "색만 다른
   같은 용"이 되므로, 몸통 마디 수·다리 수·날개 종류·머리 모양을
   전부 따로 고른다. 자세한 조합 규칙은 dragonLook.js 에 있다.

   같은 컴포넌트가 도감 미리보기와 소환 컷씬, 전투 무대에 함께 쓰인다.
   어느 체형이든 발끝 y≈0, 머리 끝 y≈2.7 안에 들어오도록 맞춰 두었다.
   카메라 프레이밍이 체형마다 달라지면 안 되기 때문이다.
   ================================================================== */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ELEMENT_BY_ID } from '../game/elements.js'
import { dragonLook, shiftHue, spinePoint } from './dragonLook.js'

/* ---------------- 날개 막 (박쥐형) ----------------
   박쥐 날개처럼 가리비(scallop) 모양으로 파낸 실루엣.
   Shape의 (x, y)를 그대로 월드 (x, z)로 눕히므로, 아래 뼈 좌표와 짝이 맞는다. */
const WING_TIPS = [[2.15, 0.42], [1.55, -0.86], [0.98, -1.02], [0.45, -1.02]]

function useBatWing() {
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

/* 새 날개 — 가리비 없이 매끈하게 뻗고 끝이 갈라진다 */
function useFeatherWing() {
  return useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(2.35, 0.18)
    s.lineTo(2.20, -0.30)
    s.lineTo(1.70, -0.20)
    s.lineTo(1.55, -0.62)
    s.lineTo(1.05, -0.48)
    s.lineTo(0.90, -0.86)
    s.lineTo(0.40, -0.70)
    s.lineTo(0, -0.26)
    s.closePath()
    const g = new THREE.ShapeGeometry(s, 12)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
}

/* 곤충 날개 — 얇고 둥근 타원 */
function useInsectWing() {
  return useMemo(() => {
    const s = new THREE.Shape()
    s.ellipse(0.85, 0, 0.95, 0.34, 0, Math.PI * 2)
    const g = new THREE.ShapeGeometry(s, 20)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
}

/* 날개 하나 (side: +1 오른쪽 / -1 왼쪽) */
function Wing({ side, geo, flapRef, boneMat, membraneMat, bones, y, z, tilt }) {
  return (
    <group ref={flapRef} position={[side * 0.40, y, z]} rotation={[0, 0, side * tilt]}>
      <group scale={[side, 1, 1]}>
        <mesh geometry={geo} material={membraneMat} />
        {/* 날개뼈 — 어깨에서 각 가리비 꼭짓점으로 뻗는다.
            실린더 축은 기본이 Y라, 그냥 Y로 돌리면 위로 솟은 막대가 된다.
            바깥 group을 방향으로 돌리고 안쪽 mesh를 눕혀 +Z를 향하게 만든다. */}
        {bones && WING_TIPS.map(([x, z2], i) => {
          const len = Math.hypot(x, z2)
          return (
            <group key={i} rotation-y={Math.atan2(x, z2)}>
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

/* ---------------- 머리 ----------------
   headType 이 두개골 자체를 바꾼다. hornStyle 은 뿔만 바꾼다.
   jawRef 로 아래턱을 따로 잡아 두어, 포효할 때 실제로 입이 벌어진다.
   턱이 안 움직이면 아무리 고개를 젖혀도 "포효"로 보이지 않는다. */
function Head({ el, shape, mainMat, bellyMat, jawRef, maw }) {
  const sn = shape.snout ?? 1
  const type = shape.headType || 'horned'
  const horns = []
  const hornCount = type === 'blunt' ? Math.min(2, shape.horns) : shape.horns

  for (let i = 0; i < hornCount; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const row = Math.floor(i / 2)
    const len = shape.hornLen - row * 0.09
    const pos = [side * (0.17 + row * 0.045), 0.20 - row * 0.07, -0.10 - row * 0.16]
    if (shape.hornStyle === 'curved') {
      horns.push(
        <group key={i} position={pos} rotation={[-0.55 - row * 0.2, side * 0.3, side * 0.55]}>
          {[0, 1, 2].map((seg) => (
            <mesh key={seg} position={[0, seg * len * 0.32, -seg * len * 0.12]} rotation={[seg * 0.28, 0, 0]}>
              <coneGeometry args={[(0.052 - seg * 0.012) - row * 0.006, len * 0.4, 6]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.35} />
            </mesh>
          ))}
        </group>,
      )
    } else if (shape.hornStyle === 'crown') {
      horns.push(
        <mesh key={i} position={pos} rotation={[-1.15 - row * 0.15, 0, side * 0.16]}>
          <coneGeometry args={[0.048 - row * 0.007, len * 1.15, 3]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.5} />
        </mesh>,
      )
    } else if (shape.hornStyle === 'straight') {
      horns.push(
        <mesh key={i} position={pos} rotation={[-1.45, side * 0.1, side * 0.12]}>
          <cylinderGeometry args={[0.020, 0.038 - row * 0.005, len * 1.25, 6]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.3} />
        </mesh>,
      )
    } else {
      horns.push(
        <mesh key={i} position={pos} rotation={[-0.85 - row * 0.22, side * 0.24, side * 0.30]}>
          <coneGeometry args={[0.055 - row * 0.008, len, 6]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.35} />
        </mesh>,
      )
    }
  }

  return (
    <group scale={shape.headSize ?? 1}>
      {/* 두개골 — 종류마다 형태가 다르다 */}
      {type === 'beak' ? (
        <mesh material={mainMat} castShadow>
          <coneGeometry args={[0.28, 0.62, 7]} />
        </mesh>
      ) : type === 'blunt' ? (
        <mesh material={mainMat} castShadow>
          <sphereGeometry args={[0.28, 14, 12]} />
        </mesh>
      ) : (
        <mesh material={mainMat} castShadow>
          <boxGeometry args={[0.46, 0.40, 0.52]} />
        </mesh>
      )}

      {/* 주둥이 — 부리형은 뾰족하게 하나로 뻗는다 */}
      {type === 'beak' ? (
        <mesh position={[0, -0.02, 0.34 * sn]} rotation={[Math.PI / 2, 0, 0]} material={mainMat}>
          <coneGeometry args={[0.13, 0.55 * sn, 6]} />
        </mesh>
      ) : (
        <>
          {/* 주둥이 — 한 덩어리 상자로 뻗으면 얼굴에 판때기를 붙인 꼴이라
              앞으로 갈수록 좁아지도록 세 마디로 깎았다. 옆에서 봤을 때
              두개골에서 코끝까지 선이 이어져야 얼굴로 읽힌다. */}
          <mesh position={[0, -0.03, 0.30 * sn]} material={mainMat} castShadow>
            <boxGeometry args={[0.34, 0.26, 0.24 * sn]} />
          </mesh>
          <mesh position={[0, -0.04, 0.46 * sn]} material={mainMat} castShadow>
            <boxGeometry args={[0.27, 0.20, 0.18 * sn]} />
          </mesh>
          <mesh position={[0, -0.05, 0.58 * sn]} material={mainMat}>
            <boxGeometry args={[0.20, 0.15, 0.12 * sn]} />
          </mesh>
          {/* 콧구멍 */}
          {[-0.055, 0.055].map((x, i) => (
            <mesh key={i} position={[x, -0.02, 0.635 * sn]}>
              <boxGeometry args={[0.035, 0.032, 0.02]} />
              <meshStandardMaterial color={el.deep} roughness={0.95} />
            </mesh>
          ))}
          {/* 윗니 — 위턱에 붙어 있으므로 벌어져도 안 움직인다 */}
          {[-0.085, 0.085].map((x, i) => (
            <mesh key={i} position={[x, -0.14, 0.48 * sn]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.026, 0.11, 4]} />
              <meshStandardMaterial color="#fff" roughness={0.4} />
            </mesh>
          ))}
          {/* 아래턱 — 턱관절에서 회전한다. 축을 입 안쪽에 두어야
              벌릴 때 턱이 미끄러지지 않고 제대로 열린다. */}
          <group ref={jawRef} position={[0, -0.12, 0.14]}>
            {/* 턱 바깥은 몸 색이어야 한다. 속성 색(el.deep)으로 칠했더니
                입을 다물고 있어도 얼굴에 색다른 판때기가 박힌 것처럼 보였다 */}
            <mesh position={[0, -0.05, 0.24 * sn]} material={mainMat} castShadow>
              <boxGeometry args={[0.24, 0.10, 0.34 * sn]} />
            </mesh>
            {/* 입 안쪽 — 벌어졌을 때만 보인다 */}
            <mesh position={[0, 0.005, 0.24 * sn]}>
              <boxGeometry args={[0.21, 0.02, 0.30 * sn]} />
              <meshStandardMaterial color={el.deep} roughness={0.9} />
            </mesh>
            {/* 아랫니 — 입을 다물면 위턱에 가려 안 보일 만큼만 세운다.
                길게 뽑았더니 다문 입에서 이빨이 뚫고 나왔다 */}
            {[-0.075, 0.075].map((x, i) => (
              <mesh key={i} position={[x, 0.0, 0.38 * sn]}>
                <coneGeometry args={[0.024, 0.07, 4]} />
                <meshStandardMaterial color="#fff" roughness={0.4} />
              </mesh>
            ))}
          </group>
          {/* 목구멍 — 입이 벌어지면 안쪽에서 빛이 새어나온다 */}
          {maw > 0.02 && (
            <mesh position={[0, -0.10, 0.34 * sn]}>
              <sphereGeometry args={[0.12 + maw * 0.05, 12, 10]} />
              <meshBasicMaterial color={el.glow} transparent opacity={0.55 * maw} toneMapped={false} />
            </mesh>
          )}
        </>
      )}

      {/* 눈 — 속성 색으로 빛난다 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.17, 0.06, 0.20]}>
          <sphereGeometry args={[0.062, 12, 10]} />
          <meshStandardMaterial color={el.glow} emissive={el.glow} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
      {/* 콧구멍 */}
      {type !== 'beak' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, 0.02, 0.645 * sn]}>
          <sphereGeometry args={[0.017, 8, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {horns}

      {/* 볏 — crest 형은 머리 위로 부채가 선다 */}
      {type === 'crest' && [0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0.24 + i * 0.02, -0.02 - i * 0.11]} rotation={[-0.5, 0, 0]} material={bellyMat}>
          <coneGeometry args={[0.055, 0.30 - i * 0.04, 4]} />
        </mesh>
      ))}
      {/* 볼 지느러미 (에픽 이상) */}
      {shape.frill && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.24, -0.02, -0.16]} rotation={[0, 0, s * -0.5]} material={bellyMat}>
          <coneGeometry args={[0.10, 0.30, 3]} />
        </mesh>
      ))}
      {/* 동양룡 수염 */}
      {shape.bodyType === 'eastern' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.13, -0.02, 0.55 * sn]} rotation={[0.5, 0, s * 0.5]}>
          <cylinderGeometry args={[0.012, 0.004, 0.85, 5]} />
          <meshStandardMaterial color={el.glow} emissive={el.glow} emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/* 다리 하나 */
function Leg({ x, y, z, len, mainMat, thick }) {
  return (
    <group position={[x, y, z]} scale={[1, len, 1]}>
      <mesh position={[0, -0.12, 0]} material={mainMat} castShadow>
        <capsuleGeometry args={[0.13 * thick, 0.30, 4, 8]} />
      </mesh>
      <mesh position={[0, -0.40, 0.09]} material={mainMat}>
        <boxGeometry args={[0.22 * thick, 0.11, 0.30]} />
      </mesh>
      {[-0.07, 0, 0.07].map((cx, j) => (
        <mesh key={j} position={[cx * thick, -0.43, 0.24]} rotation={[1.25, 0, 0]}>
          <coneGeometry args={[0.026, 0.11, 4]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
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
  dragonId = null,       // 있으면 이 드래곤만의 생김새가 나온다
  scale = 1,
  animate = true,
  roar = false,          // 자세만 바꾸는 간이 포효 (전투용)
  /* 컷씬용 — 0~1 로 세밀하게 제어한다.
     maw 는 입이 벌어진 정도, breath 는 뿜어져 나오는 숨의 세기.
     roar 만 있을 때는 턱이 안 움직여서 "포효"로 안 보였다. */
  maw = 0,
  breath = 0,
}) {
  const el = ELEMENT_BY_ID[elementId] || ELEMENT_BY_ID.fire
  const shape = useMemo(() => dragonLook(dragonId, rarity), [dragonId, rarity])
  const batGeo = useBatWing()
  const featherGeo = useFeatherWing()
  const insectGeo = useInsectWing()
  const wingGeo = shape.wingType === 'feather' ? featherGeo
    : shape.wingType === 'insect' ? insectGeo : batGeo

  const root = useRef()
  const neck = useRef()
  const headRef = useRef()
  const tail = useRef()
  const wingL = useRef()
  const wingR = useRef()
  const wingL2 = useRef()
  const wingR2 = useRef()
  const auraRef = useRef()
  const segs = useRef([])
  const jawRef = useRef()
  const breathRef = useRef()
  /* 포효(전투용 간이 신호)도 입을 조금은 벌리게 해준다 */
  const mawAmt = Math.max(maw, roar ? 0.45 : 0)

  /* 재질은 한 번만 만들어 모든 부위가 공유한다 (드로우콜·GC 절약) */
  const mats = useMemo(() => {
    /* 개체마다 색조를 조금 비튼다 — 속성은 알아볼 수 있는 범위 안에서 */
    const main = shiftHue(el.color, shape.hue)
    const glow = shiftHue(el.glow, shape.hue)
    const deep = shiftHue(el.deep, shape.hue)
    return {
      main: new THREE.MeshStandardMaterial({ color: main, roughness: 0.55, metalness: 0.25 }),
      belly: new THREE.MeshStandardMaterial({ color: glow, roughness: 0.7, metalness: 0.1 }),
      bone: new THREE.MeshStandardMaterial({ color: deep, roughness: 0.6, metalness: 0.2 }),
      membrane: new THREE.MeshStandardMaterial({
        color: deep, emissive: main, emissiveIntensity: 0.35,
        roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
        transparent: true, opacity: shape.wingType === 'insect' ? 0.6 : 0.93,
      }),
    }
  }, [el, shape.hue, shape.wingType])

  /* 몸통 마디 — 체형에 따라 3개(짧고 굵게)에서 11개(뱀처럼)까지 */
  const spine = useMemo(
    () => Array.from({ length: shape.spine }, (_, i) => spinePoint(i, shape.spine, shape)),
    [shape],
  )
  const long = shape.spine > 5      // 뱀·동양룡 계열인가

  useFrame((state, dt) => {
    if (!animate) return
    const t = state.clock.elapsedTime
    /* 숨쉬기 + 부유 */
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.5) * 0.06
      root.current.rotation.z = Math.sin(t * 0.7) * 0.02
    }
    /* 긴 몸은 마디마다 시차를 두고 물결친다 */
    if (long) {
      segs.current.forEach((m, i) => {
        if (!m) return
        const p = spine[i]
        if (!p) return
        const w = Math.sin(t * 1.6 - i * 0.55) * 0.13
        m.position.x = p.x + w
        m.position.y = p.y + Math.cos(t * 1.4 - i * 0.5) * 0.05
      })
    }
    /* 날갯짓 — 포효 중엔 크게 펼친다. 곤충 날개는 빠르게 떤다 */
    const speed = shape.wingType === 'insect' ? 16 : 2.1
    const amp = shape.wingType === 'insect' ? 0.34 : 0.26
    const flap = mawAmt > 0.05
      ? (0.30 + mawAmt * 0.55) + Math.sin(t * 5) * 0.16 * mawAmt
      : Math.sin(t * speed) * amp
    if (wingR.current) wingR.current.rotation.z = 0.45 + flap
    if (wingL.current) wingL.current.rotation.z = -0.45 - flap
    if (wingR2.current) wingR2.current.rotation.z = 0.30 + flap * 0.8
    if (wingL2.current) wingL2.current.rotation.z = -0.30 - flap * 0.8
    /* 목·머리 — 입을 벌린 만큼 고개를 젖힌다.
       포효는 턱만 벌려선 안 되고 목이 같이 따라 올라가야 힘이 실린다. */
    if (neck.current) neck.current.rotation.x = -0.05 - mawAmt * 0.60 + Math.sin(t * 1.3) * 0.05
    if (headRef.current) headRef.current.rotation.x = 0.08 - mawAmt * 1.00 + Math.sin(t * 1.7) * 0.05
    /* 꼬리 */
    if (tail.current) tail.current.rotation.y = Math.sin(t * 1.1) * 0.28
    /* 턱 — 벌어진 만큼 아래로 돈다. 살짝 떨어 포효에 힘이 실린다 */
    if (jawRef.current) {
      const tremble = mawAmt > 0.5 ? Math.sin(t * 34) * 0.035 * mawAmt : 0
      jawRef.current.rotation.x = mawAmt * 0.62 + tremble
    }
    /* 숨결 — 입 앞으로 뻗는 원뿔. 세기에 따라 길고 굵어진다 */
    if (breathRef.current) {
      breathRef.current.visible = breath > 0.01
      const flick = 1 + Math.sin(t * 26) * 0.10
      breathRef.current.scale.set(breath * flick, breath * 2.6 * flick, breath * flick)
      if (breathRef.current.material) breathRef.current.material.opacity = 0.72 * breath
    }
    /* 레전드 오라 회전 */
    if (auraRef.current) auraRef.current.rotation.y += dt * 0.6
  })

  /* 등줄기 가시 — 마디를 따라 박힌다 */
  const spikes = useMemo(() => Array.from({ length: shape.spikes }, (_, i) => {
    const f = i / Math.max(1, shape.spikes - 1)
    const p = spinePoint(f * (shape.spine - 1), shape.spine, shape)
    return { x: p.x, y: p.y + p.r * 0.85, z: p.z, s: (0.13 - f * 0.05) * (long ? 0.8 : 1) }
  }), [shape, long])

  /* 다리 위치 — 다리 수에 따라 앞/뒤로 붙는다 */
  const legs = useMemo(() => {
    const n = shape.legs
    if (!n) return []
    const hip = spinePoint(long ? 1.2 : 0.2, shape.spine, shape)
    const rear = spinePoint(long ? shape.spine * 0.55 : shape.spine - 1.2, shape.spine, shape)
    const w = 0.34 * shape.body
    const out = []
    /* 뒷다리는 어느 체형이나 있다 */
    out.push({ x: w, y: hip.y - hip.r * 0.5, z: hip.z + 0.30 }, { x: -w, y: hip.y - hip.r * 0.5, z: hip.z + 0.30 })
    if (n >= 4) {
      out.push({ x: w * 0.9, y: rear.y - rear.r * 0.5, z: rear.z }, { x: -w * 0.9, y: rear.y - rear.r * 0.5, z: rear.z })
    }
    return out
  }, [shape, long])

  const shoulder = spine[0]
  const tailBase = spine[spine.length - 1]
  const wingY = shoulder.y + shoulder.r * 0.42
  const wingZ = shoulder.z - 0.18

  return (
    <group ref={root} scale={scale * shape.size}>
      {/* ---------- 몸통 ---------- */}
      {spine.map((p, i) => (
        <mesh key={i} ref={(m) => { segs.current[i] = m }}
          position={[p.x, p.y, p.z]} material={mats.main} castShadow>
          <sphereGeometry args={[p.r, long ? 12 : 20, long ? 10 : 16]} />
        </mesh>
      ))}
      {/* 가슴 — 마디가 적은 체형만 따로 부풀린다 */}
      {!long && (
        <>
          <mesh position={[0, shoulder.y - 0.03, shoulder.z + 0.57]} material={mats.main} castShadow>
            <sphereGeometry args={[0.46 * shape.body, 18, 14]} />
          </mesh>
          <mesh position={[0, shoulder.y - 0.25, shoulder.z + 0.25]} material={mats.belly}>
            <sphereGeometry args={[0.40 * shape.body, 16, 12]} />
          </mesh>
        </>
      )}

      {/* ---------- 목 · 머리 ---------- */}
      <group ref={neck} position={[0, shoulder.y + 0.27, shoulder.z + 0.70]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, i * 0.20 * shape.neck, i * 0.17 * shape.neck]} material={mats.main} castShadow>
            <sphereGeometry args={[(0.24 - i * 0.028) * (long ? 0.8 : 1), 14, 12]} />
          </mesh>
        ))}
        <group ref={headRef} position={[0, 0.66 * shape.neck, 0.56 * shape.neck]}>
          <Head el={el} shape={shape} mainMat={mats.main} bellyMat={mats.belly}
            jawRef={jawRef} maw={mawAmt} />
          {/* 숨결 — 주둥이 끝에서 앞으로 뿜는다.
              머리 안에 두어야 체형이 달라도 항상 입에서 나온다. */}
          <mesh ref={breathRef} visible={false}
            position={[0, -0.08, 0.85 * (shape.snout ?? 1)]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.42, 1.6, 16, 1, true]} />
            <meshBasicMaterial color={el.glow} transparent opacity={0}
              toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
        {/* 동양룡 갈기 */}
        {shape.bodyType === 'eastern' && [0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.16 + i * 0.20, -0.10 + i * 0.14]} rotation={[-0.7, 0, 0]} material={mats.belly}>
            <coneGeometry args={[0.13, 0.34, 4]} />
          </mesh>
        ))}
      </group>

      {/* ---------- 날개 ---------- */}
      {shape.wingType !== 'none' && (
        <group scale={shape.wingScale}>
          <Wing side={1} geo={wingGeo} flapRef={wingR} boneMat={mats.bone} membraneMat={mats.membrane}
            bones={shape.wingType === 'bat'} y={wingY} z={wingZ} tilt={0.45} />
          <Wing side={-1} geo={wingGeo} flapRef={wingL} boneMat={mats.bone} membraneMat={mats.membrane}
            bones={shape.wingType === 'bat'} y={wingY} z={wingZ} tilt={0.45} />
          {/* 곤충 날개는 두 쌍 */}
          {shape.wingPairs > 1 && (
            <group scale={0.78}>
              <Wing side={1} geo={wingGeo} flapRef={wingR2} boneMat={mats.bone} membraneMat={mats.membrane}
                bones={false} y={wingY - 0.16} z={wingZ - 0.34} tilt={0.30} />
              <Wing side={-1} geo={wingGeo} flapRef={wingL2} boneMat={mats.bone} membraneMat={mats.membrane}
                bones={false} y={wingY - 0.16} z={wingZ - 0.34} tilt={0.30} />
            </group>
          )}
        </group>
      )}

      {/* ---------- 꼬리 ---------- */}
      <group ref={tail} position={[tailBase.x, tailBase.y, tailBase.z]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, -i * 0.045, -i * 0.30 * shape.tailLen]} material={mats.main} castShadow>
            <sphereGeometry args={[Math.max(0.05, tailBase.r * (1 - i * 0.19)), 12, 10]} />
          </mesh>
        ))}
        {/* 꼬리 끝 — 드래곤마다 다르다 */}
        <group position={[0, -0.20, -1.42 * shape.tailLen]}>
          {shape.tailTip === 'spike' && (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.13, 0.72, 6]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.4} />
            </mesh>
          )}
          {shape.tailTip === 'club' && (
            <mesh material={mats.main}>
              <sphereGeometry args={[0.26, 12, 10]} />
            </mesh>
          )}
          {shape.tailTip === 'fan' && [-1, 0, 1].map((s) => (
            <mesh key={s} rotation={[0.35, s * 0.5, 0]} material={mats.membrane}>
              <coneGeometry args={[0.15, 0.52, 4]} />
            </mesh>
          ))}
          {shape.tailTip === 'blade' && (
            <mesh rotation={[0.35, 0, 0]} material={mats.membrane}>
              <coneGeometry args={[0.26, 0.52, 4]} />
            </mesh>
          )}
        </group>
      </group>

      {/* ---------- 다리 ---------- */}
      {legs.map((L, i) => (
        <Leg key={i} x={L.x} y={L.y} z={L.z} len={shape.legLen}
          thick={shape.bodyType === 'titan' ? 1.4 : shape.bodyType === 'eastern' ? 0.65 : 1}
          mainMat={mats.main} />
      ))}

      {/* ---------- 등줄기 가시 ---------- */}
      {spikes.map((sp, i) => (
        <mesh key={i} position={[sp.x, sp.y, sp.z]} rotation={[shape.spikeTilt, 0, 0]}>
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
