/* ==================================================================
   드래곤 3D 모델 — 외부 모델 파일 없이 기본 도형으로 조립한다.

   체형(bodyType)마다 뼈대가 다르다. 비늘색만 바꾸면 결국 "색만 다른
   같은 용"이 되므로, 몸통 마디 수·다리 수·날개 종류·머리 모양을
   전부 따로 고른다. 자세한 조합 규칙은 dragonLook.js 에 있다.

   [몸을 이어진 관으로 뽑는 이유]
   전에는 구를 줄지어 놓아 몸통·목·꼬리를 만들었다. 마디마다 경계가
   뚝뚝 끊겨 공을 꿴 애벌레처럼 보였고, 목은 눈사람 세 개였다.
   지금은 bodyMesh.taperedTube 로 굵기가 변하는 관을 한 덩어리로
   뽑는다. 머리도 상자 두 개가 아니라 굵기 곡선을 준 관이다.

   같은 컴포넌트가 도감 미리보기와 소환 컷씬, 전투 무대에 함께 쓰인다.
   어느 체형이든 발끝 y≈0, 머리 끝 y≈2.7 안에 들어오도록 맞춰 두었다.
   카메라 프레이밍이 체형마다 달라지면 안 되기 때문이다.
   ================================================================== */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ELEMENT_BY_ID } from '../game/elements.js'
import {
  dragonLook, shiftHue, spinePoint, headProfile, JAW_PROFILE, JAW_MOUNT, TOOTH,
} from './dragonLook.js'
import { taperedTube, undulate, bellyPlates } from './bodyMesh.js'
import {
  ScalePlates, Runes, Shards, Crown, Halo, ChestCore, MythicWing,
} from './MythicParts.jsx'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/* 프로필([z,y,r] 목록)을 관으로 — 머리·턱이 공통으로 쓴다.
   sn 은 주둥이 길이 배수라 z 에만 곱한다. */
function profileTube(profile, sn, opts) {
  const pts = profile.map(([z, y]) => V(0, y, z * (z > 0 ? sn : 1)))
  const radii = profile.map(([, , r]) => r)
  return taperedTube(pts, radii, opts)
}

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

/* 깃털 한 장 — 새 날개 위에 겹쳐 얹는다 */
const FEATHER_ROW = [
  [0.55, -0.34, 0.62], [0.95, -0.44, 0.74], [1.35, -0.42, 0.72],
  [1.72, -0.32, 0.62], [2.02, -0.18, 0.48],
]

/* 날개 하나 (side: +1 오른쪽 / -1 왼쪽) */
function Wing({ side, geo, flapRef, boneMat, membraneMat, mainMat, type, y, z, tilt }) {
  return (
    <group ref={flapRef} position={[side * 0.40, y, z]} rotation={[0, 0, side * tilt]}>
      <group scale={[side, 1, 1]}>
        <mesh geometry={geo} material={membraneMat} />

        {/* 박쥐 날개뼈 — 어깨에서 각 가리비 꼭짓점으로 뻗는다.
            실린더 축은 기본이 Y라, 그냥 Y로 돌리면 위로 솟은 막대가 된다.
            바깥 group을 방향으로 돌리고 안쪽 mesh를 눕혀 +Z를 향하게 만든다. */}
        {type === 'bat' && WING_TIPS.map(([x, z2], i) => {
          const len = Math.hypot(x, z2)
          return (
            <group key={i} rotation-y={Math.atan2(x, z2)}>
              <mesh material={boneMat} position={[0, 0.02, len / 2]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.045, 0.020, len, 6]} />
              </mesh>
              {/* 마디 관절 — 뼈가 그냥 막대면 우산살처럼 보인다 */}
              <mesh material={boneMat} position={[0, 0.02, len * 0.52]}>
                <sphereGeometry args={[0.045, 8, 6]} />
              </mesh>
            </group>
          )
        })}

        {/* 새 날개 — 깃털을 겹쳐 얹어 판때기 느낌을 지운다 */}
        {type === 'feather' && FEATHER_ROW.map(([x, z2, len], i) => (
          <group key={i} position={[x, 0.015, z2]} rotation-y={-0.35 - i * 0.06}>
            <mesh material={mainMat} position={[0, 0, -len / 2]} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.11, len, 4]} />
            </mesh>
          </group>
        ))}

        {/* 앞가장자리 뼈 — 어느 날개든 앞선이 있어야 형태가 산다 */}
        <group rotation-y={Math.atan2(WING_TIPS[0][0], WING_TIPS[0][1])}>
          <mesh material={boneMat} position={[0, 0.03, Math.hypot(...WING_TIPS[0]) / 2]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.022, Math.hypot(...WING_TIPS[0]), 6]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/* ---------------- 눈 ----------------
   구 하나만 두면 붙여 놓은 구슬로 보인다. 눈알 · 홍채 · 눈꺼풀 ·
   눈두덩을 겹쳐야 표정이 생긴다. */
function Eye({ side, el, mainMat, x, y, z, size }) {
  return (
    <group position={[side * x, y, z]}>
      {/* 눈알 */}
      <mesh>
        <sphereGeometry args={[size, 14, 12]} />
        <meshStandardMaterial color="#0b0b12" roughness={0.25} metalness={0.1} />
      </mesh>
      {/* 홍채 — 속성 색으로 빛난다 */}
      <mesh position={[side * size * 0.42, 0, size * 0.52]}>
        <sphereGeometry args={[size * 0.62, 12, 10]} />
        <meshStandardMaterial color={el.glow} emissive={el.glow}
          emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      {/* 세로 동공 — 파충류 눈 */}
      <mesh position={[side * size * 0.52, 0, size * 0.62]} scale={[0.28, 1, 0.28]}>
        <sphereGeometry args={[size * 0.46, 8, 8]} />
        <meshBasicMaterial color="#07070c" toneMapped={false} />
      </mesh>
      {/* 위 눈꺼풀 — 살짝 덮어야 노려보는 눈이 된다 */}
      <mesh position={[0, size * 0.52, 0]} rotation={[-0.35, 0, 0]} material={mainMat}>
        <sphereGeometry args={[size * 1.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
      </mesh>
      {/* 눈두덩 — 눈 위로 튀어나온 뼈 */}
      <mesh position={[0, size * 0.95, -size * 0.15]} rotation={[0.25, side * 0.25, 0]} material={mainMat}>
        <boxGeometry args={[size * 2.3, size * 0.55, size * 1.5]} />
      </mesh>
    </group>
  )
}

/* ---------------- 머리 ----------------
   headType 이 두개골 곡선 자체를 바꾼다. hornStyle 은 뿔만 바꾼다.
   jawRef 로 아래턱을 따로 잡아 두어, 포효할 때 실제로 입이 벌어진다.
   턱이 안 움직이면 아무리 고개를 젖혀도 "포효"로 보이지 않는다. */
function Head({ el, shape, mainMat, bellyMat, boneMat, jawRef, maw }) {
  const myth = shape.mythic
  const sn = shape.snout ?? 1
  const type = shape.headType || 'horned'

  const skullGeo = useMemo(
    () => profileTube(headProfile(type), sn, { radial: 14, rings: 26, flat: 0.74 }),
    [type, sn],
  )
  const jawGeo = useMemo(
    () => profileTube(JAW_PROFILE, sn, { radial: 10, rings: 16, flat: 0.62 }),
    [sn],
  )

  const horns = []
  const hornCount = type === 'blunt' ? Math.min(2, shape.horns) : shape.horns
  for (let i = 0; i < hornCount; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const row = Math.floor(i / 2)
    const len = shape.hornLen - row * 0.09
    const pos = [side * (0.15 + row * 0.045), 0.20 - row * 0.07, -0.14 - row * 0.14]
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
      {/* 두개골 — 코끝에서 뒤통수까지 한 덩어리 */}
      <mesh geometry={skullGeo} material={mainMat} castShadow />

      {/* 볼 근육 — 턱을 무는 힘이 붙는 자리. 없으면 얼굴이 납작하다 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.19, -0.03, -0.06]} scale={[0.75, 0.9, 1.15]} material={mainMat}>
          <sphereGeometry args={[0.135, 12, 10]} />
        </mesh>
      ))}

      {/* 콧등 능선 — 눈 사이에서 코끝까지 얇게 솟는다 */}
      {type !== 'blunt' && [0.10, 0.28, 0.46].map((z, i) => (
        <mesh key={i} position={[0, 0.055 - i * 0.022, z * sn]} rotation={[0.12, 0, 0]} material={boneMat}>
          <boxGeometry args={[0.075 - i * 0.014, 0.05, 0.16]} />
        </mesh>
      ))}

      {/* 윗니 — 위턱에 붙어 있으므로 벌어져도 안 움직인다.
          턱보다 바깥쪽(x)에 세워야 다물었을 때 턱을 뚫지 않는다. */}
      {type !== 'beak' && [-TOOTH.upperX, TOOTH.upperX].map((x, i) => (
        <mesh key={i} position={[x, TOOTH.upperY, 0.40 * sn]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.024, 0.10, 4]} />
          <meshStandardMaterial color="#fff" roughness={0.4} />
        </mesh>
      ))}

      {/* 아래턱 — 턱관절에서 회전한다. 축을 입 안쪽에 두어야
          벌릴 때 턱이 미끄러지지 않고 제대로 열린다. */}
      <group ref={jawRef} position={[0, JAW_MOUNT.y, JAW_MOUNT.z]}>
        <mesh geometry={jawGeo} material={mainMat} castShadow />
        {/* 입 안쪽 — 벌어졌을 때만 보인다 */}
        <mesh position={[0, 0.05, 0.24 * sn]}>
          <boxGeometry args={[0.155, 0.02, 0.42 * sn]} />
          <meshStandardMaterial color={el.deep} roughness={0.95} />
        </mesh>
        {/* 아랫니 — 입을 다물면 위턱 안에 숨는다 */}
        {[-TOOTH.lowerX, TOOTH.lowerX].map((x, i) => (
          <mesh key={i} position={[x, TOOTH.lowerY, 0.34 * sn]}>
            <coneGeometry args={[0.022, 0.07, 4]} />
            <meshStandardMaterial color="#fff" roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* 목구멍 — 입이 벌어지면 안쪽에서 빛이 새어나온다 */}
      {maw > 0.02 && (
        <mesh position={[0, -0.20, 0.18 * sn]}>
          <sphereGeometry args={[0.11 + maw * 0.06, 12, 10]} />
          <meshBasicMaterial color={el.glow} transparent opacity={0.6 * maw} toneMapped={false} />
        </mesh>
      )}

      {/* 눈 */}
      {[-1, 1].map((s) => (
        <Eye key={s} side={s} el={el} mainMat={mainMat} x={0.185} y={0.055} z={0.075} size={0.058} />
      ))}

      {/* 콧구멍 */}
      {type !== 'beak' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.048, -0.015, 0.585 * sn]}>
          <sphereGeometry args={[0.018, 8, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {horns}
      {/* 한정 레전드 — 뒤통수를 두르는 왕관 */}
      {myth && <Crown n={myth.crown} color={el.glow} />}

      {/* 볏 — crest 형은 머리 위로 부채가 선다 */}
      {type === 'crest' && [0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0.26 + i * 0.02, -0.06 - i * 0.11]} rotation={[-0.5, 0, 0]} material={bellyMat}>
          <coneGeometry args={[0.055, 0.30 - i * 0.04, 4]} />
        </mesh>
      ))}
      {/* 볼 지느러미 (에픽 이상) */}
      {shape.frill && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.245, -0.02, -0.20]} rotation={[0, 0, s * -0.5]} material={bellyMat}>
          <coneGeometry args={[0.10, 0.32, 3]} />
        </mesh>
      ))}
      {/* 동양룡 수염 */}
      {shape.bodyType === 'eastern' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.11, -0.06, 0.50 * sn]} rotation={[0.5, 0, s * 0.5]}>
          <cylinderGeometry args={[0.012, 0.004, 0.85, 5]} />
          <meshStandardMaterial color={el.glow} emissive={el.glow} emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- 다리 ----------------
   막대 하나로 두면 의자 다리처럼 보인다. 허벅지가 뒤로, 정강이가
   앞으로 꺾이는 새·도마뱀식 뒷다리라야 딛고 선 느낌이 난다. */
function Leg({ x, y, z, len, mainMat, boneMat, thick, front }) {
  const thighA = front ? 0.22 : 0.55         // 허벅지가 뒤로 눕는 각
  const shinA = front ? -0.42 : -0.95        // 정강이가 앞으로 꺾이는 각
  const thighL = 0.34 * len
  const shinL = 0.32 * len

  return (
    <group position={[x, y, z]}>
      {/* 허벅지 */}
      <group rotation={[thighA, 0, 0]}>
        <mesh position={[0, -thighL / 2, 0]} material={mainMat} castShadow>
          <capsuleGeometry args={[0.145 * thick, thighL * 0.8, 4, 10]} />
        </mesh>
        {/* 무릎 */}
        <group position={[0, -thighL, 0]}>
          <mesh material={boneMat}>
            <sphereGeometry args={[0.10 * thick, 10, 8]} />
          </mesh>
          {/* 정강이 */}
          <group rotation={[shinA, 0, 0]}>
            <mesh position={[0, -shinL / 2, 0]} material={mainMat} castShadow>
              <capsuleGeometry args={[0.095 * thick, shinL * 0.8, 4, 8]} />
            </mesh>
            {/* 발목 · 발 */}
            <group position={[0, -shinL, 0]} rotation={[-(thighA + shinA), 0, 0]}>
              <mesh material={boneMat}>
                <sphereGeometry args={[0.078 * thick, 8, 8]} />
              </mesh>
              <mesh position={[0, -0.045, 0.075]} material={mainMat}>
                <boxGeometry args={[0.20 * thick, 0.085, 0.26]} />
              </mesh>
              {/* 발가락 세 개 + 발톱 */}
              {[-0.068, 0, 0.068].map((cx, j) => (
                <group key={j} position={[cx * thick, -0.05, 0.19]}>
                  <mesh material={mainMat}>
                    <boxGeometry args={[0.055 * thick, 0.06, 0.10]} />
                  </mesh>
                  <mesh position={[0, -0.005, 0.085]} rotation={[1.25, 0, 0]}>
                    <coneGeometry args={[0.024, 0.11, 4]} />
                    <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.3} />
                  </mesh>
                </group>
              ))}
              {/* 뒷발톱 */}
              <mesh position={[0, -0.04, -0.07]} rotation={[-1.5, 0, 0]}>
                <coneGeometry args={[0.020, 0.08, 4]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
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
  const bodyRef = useRef()
  const tailMeshRef = useRef()
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
      /* 한정 레전드는 비늘이 금속처럼 받아쳐야 한다.
         같은 무광 재질을 쓰면 장식을 아무리 붙여도 상시와 같아 보인다. */
      main: new THREE.MeshStandardMaterial(shape.mythic
        ? { color: main, roughness: 0.30, metalness: 0.62, emissive: deep, emissiveIntensity: 0.22 }
        : { color: main, roughness: 0.55, metalness: 0.25 }),
      belly: new THREE.MeshStandardMaterial({ color: glow, roughness: 0.7, metalness: 0.1 }),
      bone: new THREE.MeshStandardMaterial({ color: deep, roughness: 0.6, metalness: 0.2 }),
      plate: new THREE.MeshStandardMaterial({ color: glow, roughness: 0.85, metalness: 0.05 }),
      /* 비늘판은 금속처럼 번들거려야 갑주로 보인다 */
      plateHard: new THREE.MeshStandardMaterial({
        color: deep, emissive: glow, emissiveIntensity: 0.28,
        roughness: 0.22, metalness: 0.85, side: THREE.DoubleSide,
      }),
      membrane: new THREE.MeshStandardMaterial({
        color: deep, emissive: main, emissiveIntensity: 0.35,
        roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
        transparent: true, opacity: shape.wingType === 'insect' ? 0.6 : 0.93,
      }),
    }
  }, [el, shape.hue, shape.wingType, shape.mythic])

  /* 몸통 마디 — 체형에 따라 3개(짧고 굵게)에서 11개(뱀처럼)까지 */
  const spine = useMemo(
    () => Array.from({ length: shape.spine }, (_, i) => spinePoint(i, shape.spine, shape)),
    [shape],
  )
  const long = shape.spine > 5      // 뱀·동양룡 계열인가

  /* ---- 몸통 중심선 ----
     어깨 앞으로 가슴을 한 번 더 내밀어야 목이 몸에 얹힌 것처럼 보인다.
     마디 좌표만 이으면 목이 몸통에서 갑자기 튀어나온다. */
  const bodyPath = useMemo(() => {
    const s0 = spine[0]
    const pts = [], radii = []
    const reach = long ? 0.42 : 0.95
    pts.push(V(s0.x, s0.y + 0.20, s0.z + reach * shape.body))
    radii.push(s0.r * 0.46)
    pts.push(V(s0.x, s0.y + 0.05, s0.z + reach * 0.52 * shape.body))
    radii.push(s0.r * (long ? 0.86 : 1.06))
    spine.forEach((p) => { pts.push(V(p.x, p.y, p.z)); radii.push(p.r) })
    return { pts, radii }
  }, [spine, shape.body, long])

  const bodyGeo = useMemo(
    () => taperedTube(bodyPath.pts, bodyPath.radii, {
      radial: long ? 12 : 16,
      rings: Math.max(22, bodyPath.pts.length * 5),
      flat: long ? 0.92 : 0.86,
    }),
    [bodyPath, long],
  )

  /* ---- 목 ---- */
  const neckGeo = useMemo(() => {
    const n = shape.neck
    const pts = [
      V(0, -0.12, -0.10), V(0, 0.16 * n, 0.06 * n),
      V(0, 0.42 * n, 0.26 * n), V(0, 0.62 * n, 0.48 * n),
    ]
    const base = (long ? 0.20 : 0.27) * (shape.body * 0.5 + 0.6)
    return taperedTube(pts, [base * 1.15, base, base * 0.86, base * 0.72],
      { radial: 12, rings: 20, flat: 0.9 })
  }, [shape.neck, shape.body, long])

  /* ---- 꼬리 ---- */
  const tailGeo = useMemo(() => {
    const r0 = spine[spine.length - 1].r
    const L = shape.tailLen
    const pts = [
      V(0, 0, 0.06), V(0, -0.05, -0.42 * L),
      V(0, -0.12, -0.86 * L), V(0, -0.18, -1.24 * L), V(0, -0.22, -1.52 * L),
    ]
    return taperedTube(pts, [r0 * 1.02, r0 * 0.74, r0 * 0.48, r0 * 0.26, r0 * 0.10],
      { radial: 10, rings: 24, flat: 0.9 })
  }, [spine, shape.tailLen])

  /* ---- 배 비늘판 ---- */
  const plates = useMemo(
    () => bellyPlates(bodyPath.pts, bodyPath.radii, long ? 14 : 8),
    [bodyPath, long],
  )

  useFrame((state, dt) => {
    if (!animate) return
    const t = state.clock.elapsedTime
    /* 숨쉬기 + 부유 */
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.5) * 0.06
      root.current.rotation.z = Math.sin(t * 0.7) * 0.02
    }
    /* 긴 몸은 통째로 물결친다 — 마디마다 따로 움직이면 이음매가 벌어진다 */
    if (long && bodyRef.current) undulate(bodyRef.current.geometry, t * 1.6, 0.20, 3.4)
    if (tailMeshRef.current) undulate(tailMeshRef.current.geometry, t * 1.3, long ? 0.16 : 0.10, 2.4)

    /* 날갯짓 — 입을 벌린 만큼 크게 펼친다. 곤충 날개는 빠르게 떤다 */
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
    return { x: p.x, y: p.y + p.r * 0.82, z: p.z, s: (0.13 - f * 0.05) * (long ? 0.8 : 1) }
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
    out.push({ x: w, y: hip.y - hip.r * 0.42, z: hip.z + 0.30, front: true },
      { x: -w, y: hip.y - hip.r * 0.42, z: hip.z + 0.30, front: true })
    if (n >= 4) {
      out.push({ x: w * 0.9, y: rear.y - rear.r * 0.42, z: rear.z, front: false },
        { x: -w * 0.9, y: rear.y - rear.r * 0.42, z: rear.z, front: false })
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
      <mesh ref={bodyRef} geometry={bodyGeo} material={mats.main} castShadow />

      {/* 배 비늘판 — 아래쪽에 가로로 늘어선다 */}
      {plates.map((pl, i) => (
        <mesh key={i} position={pl.pos} rotation={[pl.pitch, 0, 0]} material={mats.plate}>
          <boxGeometry args={[pl.w, 0.035, pl.d]} />
        </mesh>
      ))}

      {/* ---------- 한정 레전드 장식 ---------- */}
      {shape.mythic && (
        <>
          <ScalePlates pts={bodyPath.pts} radii={bodyPath.radii}
            rows={shape.mythic.plateRows} perRow={shape.mythic.perRow} material={mats.plateHard} />
          <Runes pts={bodyPath.pts} radii={bodyPath.radii} n={shape.mythic.runes} color={el.glow} />
          <Shards n={shape.mythic.shards} color={el.glow} boneMat={mats.bone} />
          <group position={[0, shoulder.y - 0.02, shoulder.z + 0.62 * shape.body]}>
            <ChestCore color={el.glow} boneMat={mats.bone} size={0.9 + shape.body * 0.25} />
          </group>
        </>
      )}

      {/* 어깨 근육 — 날개가 붙는 자리가 밋밋하면 날개가 얹힌 것처럼 보인다 */}
      {shape.wingType !== 'none' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.30 * shape.body, wingY - 0.06, wingZ + 0.12]}
          scale={[0.9, 1, 1.25]} material={mats.main}>
          <sphereGeometry args={[0.24 * shape.body, 12, 10]} />
        </mesh>
      ))}

      {/* ---------- 목 · 머리 ---------- */}
      <group ref={neck} position={[0, shoulder.y + 0.16, shoulder.z + 0.72 * (long ? 0.6 : 1)]}>
        <mesh geometry={neckGeo} material={mats.main} castShadow />
        <group ref={headRef} position={[0, 0.66 * shape.neck, 0.52 * shape.neck]}>
          <Head el={el} shape={shape} mainMat={mats.main} bellyMat={mats.belly}
            boneMat={mats.bone} jawRef={jawRef} maw={mawAmt} />
          {/* 숨결 — 주둥이 끝에서 앞으로 뿜는다.
              머리 안에 두어야 체형이 달라도 항상 입에서 나온다. */}
          <mesh ref={breathRef} visible={false}
            position={[0, -0.19, 0.88 * (shape.snout ?? 1)]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.42, 1.6, 16, 1, true]} />
            <meshBasicMaterial color={el.glow} transparent opacity={0}
              toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
        {/* 한정 레전드 — 머리 뒤 후광 */}
        {shape.mythic && (
          <group position={[0, 0.62 * shape.neck, 0.48 * shape.neck]}>
            <Halo rings={shape.mythic.halo} color={el.glow} />
          </group>
        )}

        {/* 목 비늘 — 앞쪽에 가로줄 */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={mats.plate}
            position={[0, 0.06 + i * 0.17 * shape.neck, 0.14 + i * 0.13 * shape.neck]}
            rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.26 - i * 0.02, 0.03, 0.13]} />
          </mesh>
        ))}
        {/* 동양룡 갈기 */}
        {shape.bodyType === 'eastern' && [0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.16 + i * 0.20, -0.14 + i * 0.12]} rotation={[-0.7, 0, 0]} material={mats.belly}>
            <coneGeometry args={[0.13, 0.34, 4]} />
          </mesh>
        ))}
      </group>

      {/* ---------- 날개 ----------
           한정 레전드는 손가락뼈가 갈라진 날개를 단다 */}
      {shape.wingType !== 'none' && (
        <group scale={shape.wingScale}>
          {shape.mythic ? (
            <>
              <MythicWing side={1} flapRef={wingR} boneMat={mats.bone} membraneMat={mats.membrane}
                color={el.glow} y={wingY} z={wingZ} tilt={0.45} />
              <MythicWing side={-1} flapRef={wingL} boneMat={mats.bone} membraneMat={mats.membrane}
                color={el.glow} y={wingY} z={wingZ} tilt={0.45} />
            </>
          ) : (
            <>
              <Wing side={1} geo={wingGeo} flapRef={wingR} boneMat={mats.bone} membraneMat={mats.membrane}
                mainMat={mats.main} type={shape.wingType} y={wingY} z={wingZ} tilt={0.45} />
              <Wing side={-1} geo={wingGeo} flapRef={wingL} boneMat={mats.bone} membraneMat={mats.membrane}
                mainMat={mats.main} type={shape.wingType} y={wingY} z={wingZ} tilt={0.45} />
            </>
          )}
          {/* 곤충 날개는 두 쌍 */}
          {shape.wingPairs > 1 && (
            <group scale={0.78}>
              <Wing side={1} geo={wingGeo} flapRef={wingR2} boneMat={mats.bone} membraneMat={mats.membrane}
                mainMat={mats.main} type={shape.wingType} y={wingY - 0.16} z={wingZ - 0.34} tilt={0.30} />
              <Wing side={-1} geo={wingGeo} flapRef={wingL2} boneMat={mats.bone} membraneMat={mats.membrane}
                mainMat={mats.main} type={shape.wingType} y={wingY - 0.16} z={wingZ - 0.34} tilt={0.30} />
            </group>
          )}
        </group>
      )}

      {/* ---------- 꼬리 ---------- */}
      <group ref={tail} position={[tailBase.x, tailBase.y, tailBase.z]}>
        <mesh ref={tailMeshRef} geometry={tailGeo} material={mats.main} castShadow />
        {/* 꼬리 끝 — 드래곤마다 다르다 */}
        <group position={[0, -0.22, -1.58 * shape.tailLen]}>
          {shape.tailTip === 'spike' && (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.11, 0.62, 6]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.4} />
            </mesh>
          )}
          {shape.tailTip === 'club' && (
            <>
              <mesh material={mats.main}>
                <sphereGeometry args={[0.22, 12, 10]} />
              </mesh>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} rotation={[0, (i / 4) * Math.PI * 2, 0]} position={[0, 0.02, 0]}>
                  <coneGeometry args={[0.05, 0.20, 4]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.4} />
                </mesh>
              ))}
            </>
          )}
          {shape.tailTip === 'fan' && [-1, 0, 1].map((s) => (
            <mesh key={s} rotation={[0.35, s * 0.5, 0]} material={mats.membrane}>
              <coneGeometry args={[0.15, 0.52, 4]} />
            </mesh>
          ))}
          {shape.tailTip === 'blade' && (
            <mesh rotation={[0.35, 0, 0]} material={mats.membrane}>
              <coneGeometry args={[0.24, 0.52, 4]} />
            </mesh>
          )}
        </group>
      </group>

      {/* ---------- 다리 ---------- */}
      {legs.map((L, i) => (
        <Leg key={i} x={L.x} y={L.y} z={L.z} len={shape.legLen} front={L.front}
          thick={shape.bodyType === 'titan' ? 1.4 : shape.bodyType === 'eastern' ? 0.65 : 1}
          mainMat={mats.main} boneMat={mats.bone} />
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
      {/* 한정 레전드 — 뒤에서 테두리를 훑는 빛.
          앞에서만 비추면 실루엣이 배경에 묻힌다. */}
      {shape.mythic && (
        <>
          <pointLight position={[0, 2.1, -2.4]} intensity={14} distance={9} color={el.glow} />
          <pointLight position={[-2.2, 1.2, -0.6]} intensity={6} distance={7} color={el.glow} />
        </>
      )}
    </group>
  )
}
