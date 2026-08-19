/* ==================================================================
   손에 든 무기 (1인칭 뷰모델)

   카메라에 붙여 놓는다. 월드에 두고 매 프레임 카메라를 따라가게 하면
   한 프레임씩 늦게 따라와 총이 화면에서 미끄러진다. createPortal 로
   카메라의 자식으로 만들면 카메라가 어떻게 움직이든 같이 간다.

   카메라를 scene 에 넣어 주는 게 조건이다 — 씬 그래프에 없는 물체의
   자식은 그려지지 않는다.

   모델은 weaponParts.jsx 의 조각을 조립해 만든다. 총 하나에 스무 개
   안팎의 부품이 들어가는데, 이게 품질의 대부분이다 — 상자 세 개짜리
   실루엣은 아무리 색을 잘 골라도 장난감으로 보인다.
   ================================================================== */
import { useRef, useEffect } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WEAPONS } from '../game/weapons.js'
import {
  Box, Cyl, Barrel, Rail, IronSights, Grip, Trigger, Magazine, Scope, Stock,
} from './weaponParts.jsx'

/* ── 주무기 ────────────────────────────────────────────────────── */

function Rifle() {
  return (
    <group>
      {/* 상부 몸통 */}
      <Box pos={[0, 0.028, -0.16]} size={[0.062, 0.07, 0.44]} mat="polymer" />
      {/* 하부 몸통 — 탄창이 꽂히는 곳 */}
      <Box pos={[0, -0.028, -0.03]} size={[0.058, 0.058, 0.2]} mat="darkPoly" />
      {/* 총열 덮개 — 방열 구멍을 홈으로 흉내낸다 */}
      <Box pos={[0, 0.012, -0.44]} size={[0.05, 0.05, 0.22]} mat="darkPoly" />
      {[-0.5, -0.46, -0.42, -0.38].map((z) => (
        <Box key={z} pos={[0, 0.012, z]} size={[0.054, 0.014, 0.012]} mat="blued" cast={false} />
      ))}
      <Barrel z={-0.62} len={0.2} r={0.019} />
      {/* 노리쇠 손잡이 — 오른쪽으로 튀어나온 작은 막대 */}
      <Cyl pos={[0.038, 0.05, -0.02]} r={0.009} h={0.05} rot={[0, 0, Math.PI / 2]} seg={8} mat="steel" />
      {/* 탄피 배출구 */}
      <Box pos={[0.033, 0.035, -0.09]} size={[0.006, 0.03, 0.075]} mat="blued" cast={false} />
      <Rail pos={[0, 0.066, -0.2]} len={0.34} count={9} />
      <IronSights front={-0.53} rear={-0.05} y={0.082} />
      <Magazine pos={[0, -0.14, -0.02]} size={[0.042, 0.19, 0.085]} tilt={0.14} curved />
      <Grip pos={[0, -0.12, 0.09]} tilt={0.3} h={0.17} />
      <Trigger pos={[0, -0.052, 0.045]} />
      <Stock pos={[0, 0.01, 0.26]} len={0.24} />
    </group>
  )
}

function Shotgun() {
  return (
    <group>
      {/* 나무 몸통 — 다른 총과 재질부터 다르게 해서 한눈에 갈린다 */}
      <Box pos={[0, 0.01, -0.12]} size={[0.07, 0.078, 0.36]} mat="wood" />
      <Box pos={[0, 0.05, -0.2]} size={[0.062, 0.03, 0.42]} mat="blued" cast={false} />
      {/* 굵은 총열 + 아래 탄창관 */}
      <Cyl pos={[0, 0.038, -0.52]} r={0.026} h={0.42} seg={16} mat="blued" />
      <Cyl pos={[0, -0.002, -0.5]} r={0.019} h={0.38} seg={14} mat="blued" />
      <Cyl pos={[0, 0.038, -0.73]} r={0.03} h={0.026} seg={16} mat="steel" />
      {/* 펌프 손잡이 — 홈을 파서 잡는 곳임을 알린다 */}
      <group position={[0, 0.014, -0.42]}>
        <Box size={[0.062, 0.062, 0.17]} mat="wood" />
        {[-0.055, -0.02, 0.015, 0.05].map((z) => (
          <Box key={z} pos={[0, 0, z]} size={[0.066, 0.012, 0.014]} mat="darkPoly" cast={false} />
        ))}
      </group>
      {/* 장전구에 물린 놋쇠 탄피 — 샷건이라는 표시 */}
      <Cyl pos={[0.03, -0.03, -0.08]} r={0.012} h={0.05} rot={[0, 0, Math.PI / 2]} seg={10} mat="brass" />
      <Box pos={[0, 0.078, -0.55]} size={[0.008, 0.016, 0.012]} mat="steel" cast={false} />
      <Grip pos={[0, -0.1, 0.1]} tilt={0.36} h={0.15} w={0.06} />
      <Trigger pos={[0, -0.04, 0.055]} />
      <Stock pos={[0, 0.0, 0.26]} len={0.26} mat="wood" />
    </group>
  )
}

function Lmg() {
  return (
    <group>
      {/* 크고 각진 몸통 */}
      <Box pos={[0, 0.03, -0.18]} size={[0.082, 0.088, 0.5]} mat="polymer" />
      <Box pos={[0, 0.052, -0.2]} size={[0.088, 0.026, 0.46]} mat="darkPoly" cast={false} />
      {/* 두꺼운 총열 + 방열핀 */}
      <Cyl pos={[0, 0.02, -0.6]} r={0.026} h={0.3} seg={16} mat="blued" />
      {[-0.52, -0.56, -0.6, -0.64, -0.68].map((z) => (
        <Cyl key={z} pos={[0, 0.02, z]} r={0.036} h={0.012} seg={16} mat="steel" cast={false} />
      ))}
      <Cyl pos={[0, 0.02, -0.76]} r={0.032} h={0.03} seg={16} mat="steel" />
      {/* 네모난 대용량 탄통 — 이 실루엣이 경기관총의 정체다 */}
      <Box pos={[0, -0.15, -0.06]} size={[0.11, 0.15, 0.19]} mat="darkPoly" />
      <Box pos={[0, -0.075, -0.06]} size={[0.116, 0.018, 0.196]} mat="blued" cast={false} />
      {/* 탄통에서 몸통으로 물려 들어가는 놋쇠 탄띠 */}
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} pos={[0.052, -0.075 + i * 0.012, -0.02 - i * 0.004]}
          size={[0.016, 0.012, 0.03]} mat="brass" cast={false} />
      ))}
      {/* 접이식 양각대 */}
      <Cyl pos={[-0.045, -0.12, -0.42]} r={0.008} h={0.16} rot={[0, 0, 0.42]} seg={8} mat="steel" />
      <Cyl pos={[0.045, -0.12, -0.42]} r={0.008} h={0.16} rot={[0, 0, -0.42]} seg={8} mat="steel" />
      <Rail pos={[0, 0.075, -0.24]} len={0.36} w={0.038} count={9} />
      <IronSights front={-0.46} rear={-0.06} y={0.092} />
      <Grip pos={[0, -0.12, 0.13]} tilt={0.28} h={0.18} w={0.062} />
      <Trigger pos={[0, -0.05, 0.085]} />
      <Stock pos={[0, 0.02, 0.31]} len={0.26} />
    </group>
  )
}

function Sniper() {
  return (
    <group>
      {/* 길고 낮은 몸통 */}
      <Box pos={[0, 0.02, -0.2]} size={[0.058, 0.066, 0.52]} mat="polymer" />
      {/* 아주 긴 총열 + 총구 제동기 */}
      <Cyl pos={[0, 0.016, -0.72]} r={0.019} h={0.5} seg={16} mat="blued" />
      <Cyl pos={[0, 0.016, -0.98]} r={0.028} h={0.075} seg={16} mat="blued" />
      {[-0.955, -0.985].map((z) => (
        <Box key={z} pos={[0, 0.016, z]} size={[0.062, 0.01, 0.012]} mat="darkPoly" cast={false} />
      ))}
      {/* 볼트 손잡이 — 오른쪽으로 크게 튀어나온다 */}
      <Cyl pos={[0.05, 0.045, 0.02]} r={0.01} h={0.075} rot={[0, 0, Math.PI / 2]} seg={10} mat="steel" />
      <mesh position={[0.09, 0.045, 0.02]} castShadow>
        <sphereGeometry args={[0.019, 12, 12]} />
        <meshStandardMaterial color="#98a0ab" roughness={0.26} metalness={1} />
      </mesh>
      {/* 큰 조준경 — 저격총의 얼굴 */}
      <Scope pos={[0, 0.105, -0.26]} len={0.34} r={0.035} />
      {/* 접이식 양각대 */}
      <Cyl pos={[-0.05, -0.11, -0.56]} r={0.008} h={0.19} rot={[0, 0, 0.36]} seg={8} mat="steel" />
      <Cyl pos={[0.05, -0.11, -0.56]} r={0.008} h={0.19} rot={[0, 0, -0.36]} seg={8} mat="steel" />
      <Magazine pos={[0, -0.11, -0.06]} size={[0.036, 0.13, 0.08]} tilt={0.06} />
      <Grip pos={[0, -0.11, 0.1]} tilt={0.32} h={0.16} />
      <Trigger pos={[0, -0.045, 0.055]} />
      {/* 뺨을 대는 턱이 솟은 개머리판 */}
      <Stock pos={[0, 0.0, 0.32]} len={0.3} mat="wood" />
      <Box pos={[0, 0.062, 0.3]} size={[0.05, 0.045, 0.2]} mat="wood" cast={false} />
    </group>
  )
}

/* ── 보조무기 ──────────────────────────────────────────────────── */

function Pistol() {
  return (
    <group>
      {/* 슬라이드 — 뒤쪽에 미끄럼 홈 */}
      <Box pos={[0, 0.03, -0.13]} size={[0.05, 0.052, 0.3]} mat="blued" />
      {[0.0, -0.022, -0.044].map((z) => (
        <Box key={z} pos={[0, 0.03, z]} size={[0.054, 0.03, 0.008]} mat="darkPoly" cast={false} />
      ))}
      {/* 프레임 */}
      <Box pos={[0, -0.008, -0.1]} size={[0.046, 0.03, 0.24]} mat="polymer" />
      {/* 총구 */}
      <Cyl pos={[0, 0.03, -0.28]} r={0.014} h={0.03} seg={14} mat="steel" />
      {/* 아래 레일 — 요즘 권총 티가 난다 */}
      <Box pos={[0, -0.026, -0.19]} size={[0.03, 0.014, 0.1]} mat="darkPoly" cast={false} />
      <IronSights front={-0.26} rear={0.0} y={0.058} />
      <Grip pos={[0, -0.115, 0.04]} tilt={0.32} h={0.17} w={0.05} d={0.085} />
      <Trigger pos={[0, -0.042, -0.005]} />
      {/* 탄창 바닥 */}
      <Box pos={[0, -0.2, 0.075]} size={[0.052, 0.014, 0.088]} mat="steel" cast={false} />
    </group>
  )
}

function Smg() {
  return (
    <group>
      {/* 짧고 뭉툭한 몸통 */}
      <Box pos={[0, 0.02, -0.12]} size={[0.056, 0.07, 0.3]} mat="polymer" />
      <Box pos={[0, 0.052, -0.14]} size={[0.05, 0.024, 0.28]} mat="darkPoly" cast={false} />
      {/* 짧은 총열 + 소음기처럼 굵은 앞부분 */}
      <Cyl pos={[0, 0.02, -0.33]} r={0.017} h={0.14} seg={14} mat="blued" />
      <Cyl pos={[0, 0.02, -0.42]} r={0.026} h={0.1} seg={16} mat="darkPoly" />
      <Cyl pos={[0, 0.02, -0.47]} r={0.022} h={0.016} seg={16} mat="steel" />
      {/* 앞 손잡이 — 기관단총을 잡는 자세가 보인다 */}
      <Box pos={[0, -0.075, -0.26]} size={[0.032, 0.11, 0.042]} mat="rubber" />
      <Rail pos={[0, 0.068, -0.16]} len={0.24} w={0.03} count={7} />
      <IronSights front={-0.26} rear={-0.02} y={0.084} />
      {/* 길고 곧은 탄창 */}
      <Magazine pos={[0, -0.14, -0.02]} size={[0.034, 0.2, 0.058]} tilt={0.05} />
      <Grip pos={[0, -0.105, 0.055]} tilt={0.3} h={0.15} w={0.05} />
      <Trigger pos={[0, -0.045, 0.015]} />
      {/* 접이식 철사 개머리판 */}
      {[-0.026, 0.026].map((x) => (
        <Cyl key={x} pos={[x, 0.02, 0.15]} r={0.006} h={0.16} seg={8} mat="steel" />
      ))}
      <Box pos={[0, 0.02, 0.23]} size={[0.07, 0.03, 0.014]} mat="rubber" cast={false} />
    </group>
  )
}

function Magnum() {
  return (
    <group>
      {/* 묵직한 몸통 + 위에 솟은 조준용 리브 */}
      <Box pos={[0, 0.032, -0.16]} size={[0.048, 0.056, 0.34]} mat="steel" />
      <Box pos={[0, 0.062, -0.18]} size={[0.022, 0.014, 0.3]} mat="blued" cast={false} />
      {/* 굵고 긴 총열 */}
      <Cyl pos={[0, 0.026, -0.34]} r={0.019} h={0.14} seg={16} mat="steel" />
      <Cyl pos={[0, 0.026, -0.41]} r={0.023} h={0.02} seg={16} mat="blued" />
      {/* 실린더 — 리볼버라는 증거. 놋쇠 탄약이 보이게 */}
      <Cyl pos={[0, -0.004, -0.05]} r={0.038} h={0.085} seg={6} mat="blued" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <Cyl
            key={i}
            pos={[Math.cos(a) * 0.023, -0.004 + Math.sin(a) * 0.023, -0.092]}
            r={0.008} h={0.012} seg={8} mat="brass" cast={false}
          />
        )
      })}
      {/* 공이치기 — 뒤로 젖혀진 모양 */}
      <Box pos={[0, 0.062, 0.04]} size={[0.016, 0.036, 0.022]} mat="blued" cast={false} />
      <IronSights front={-0.38} rear={0.0} y={0.072} />
      {/* 나무 손잡이 */}
      <Grip pos={[0, -0.115, 0.055]} tilt={0.36} h={0.17} w={0.054} d={0.095} />
      <Box pos={[0, -0.115, 0.055]} size={[0.058, 0.14, 0.088]} mat="wood" cast={false} />
      <Trigger pos={[0, -0.042, 0.005]} />
    </group>
  )
}

/* ── 근접무기 ──────────────────────────────────────────────────── */

function Knife() {
  return (
    <group rotation={[0, 0, -0.3]}>
      {/* 칼날 — 한쪽만 각지게 깎아 날처럼 보이게 한다 */}
      <mesh position={[0, 0.02, -0.26]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.048, 0.46, 4]} />
        <meshStandardMaterial color="#cdd6e2" roughness={0.18} metalness={0.98} />
      </mesh>
      {/* 날 등의 톱니 */}
      {[-0.36, -0.32, -0.28, -0.24].map((z) => (
        <Box key={z} pos={[0, 0.045, z]} size={[0.01, 0.014, 0.016]} mat="steel" cast={false} />
      ))}
      {/* 손잡이와 날 사이 가드 */}
      <Box pos={[0, 0.02, -0.03]} size={[0.095, 0.024, 0.055]} mat="blued" cast={false} />
      <Cyl pos={[0, -0.015, 0.08]} r={0.028} r2={0.032} h={0.2} seg={10} mat="rubber" rot={[Math.PI / 2 - 0.22, 0, 0]} />
      {/* 손잡이 미끄럼 방지 홈 */}
      {[0.03, 0.07, 0.11, 0.15].map((z) => (
        <Cyl key={z} pos={[0, -0.012 - (z - 0.03) * 0.12, z]} r={0.031} h={0.012} seg={10}
          mat="darkPoly" rot={[Math.PI / 2 - 0.22, 0, 0]} cast={false} />
      ))}
      <Cyl pos={[0, -0.04, 0.185]} r={0.02} h={0.022} seg={10} mat="steel" cast={false} />
    </group>
  )
}

function Axe() {
  const haftRot = [Math.PI / 2 - 0.16, 0, 0]
  return (
    <group rotation={[0, 0, -0.22]}>
      {/* 긴 자루 — 아래로 갈수록 굵어진다 */}
      <Cyl pos={[0, -0.02, 0.0]} r={0.021} r2={0.025} h={0.6} seg={12} mat="wood" rot={haftRot} />
      {/* 자루에 감은 가죽 — 손이 닿는 자리 */}
      <Cyl pos={[0, -0.06, 0.24]} r={0.027} h={0.15} seg={12} mat="rubber" rot={haftRot} />
      {[0.19, 0.29].map((z) => (
        <Cyl key={z} pos={[0, -0.045 - (z - 0.19) * 0.16, z]} r={0.029} h={0.014} seg={12}
          mat="darkPoly" rot={haftRot} cast={false} />
      ))}
      {/* 자루 끝 쇠고리 — 손이 미끄러져 빠지지 않게 */}
      <Cyl pos={[0, -0.085, 0.315]} r={0.03} h={0.022} seg={12} mat="steel" rot={haftRot} />

      {/* 머리와 자루가 만나는 곳의 쇠테. 여기가 비어 있으면 도끼머리가
          자루에 얹혀만 있는 것처럼 보인다 */}
      <Cyl pos={[0, 0.012, -0.215]} r={0.029} h={0.028} seg={12} mat="steel" rot={haftRot} />
      {/* 자루를 타고 내려오는 쇠띠 두 줄 */}
      {[-0.022, 0.022].map((x) => (
        <Box key={x} pos={[x, 0.0, -0.17]} size={[0.008, 0.03, 0.11]} rot={[0.16, 0, 0]}
          mat="blued" cast={false} />
      ))}

      {/* 도끼머리 */}
      <group position={[0, 0.055, -0.29]}>
        <Box pos={[0, 0, 0]} size={[0.034, 0.1, 0.092]} mat="blued" />
        {/* 머리를 자루에 고정한 대갈못 */}
        {[-0.03, 0.03].map((y) => (
          <Cyl key={y} pos={[0, y, 0.048]} r={0.008} h={0.012} seg={8} mat="steel" cast={false} />
        ))}
        {/* 날 — 아래로 갈수록 얇아지게 원뿔을 눕혀 쓴다 */}
        <mesh position={[-0.055, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <coneGeometry args={[0.085, 0.11, 3]} />
          <meshStandardMaterial color="#b9c3d0" roughness={0.2} metalness={0.98} />
        </mesh>
        {/* 갈아 놓은 날끝 — 밝게 빛나서 어디가 베는 쪽인지 알린다 */}
        <mesh position={[-0.102, -0.024, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.062, 0.022, 3]} />
          <meshStandardMaterial color="#eef3f8" roughness={0.09} metalness={1} />
        </mesh>
        {/* 반대쪽 뾰족한 쐐기 */}
        <mesh position={[0.055, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[0.032, 0.075, 4]} />
          <meshStandardMaterial color="#8d949e" roughness={0.28} metalness={0.98} />
        </mesh>
        {/* 머리 위아래를 덮은 두툼한 테 */}
        {[-0.052, 0.052].map((y) => (
          <Box key={y} pos={[0, y, 0]} size={[0.038, 0.014, 0.096]} mat="steel" cast={false} />
        ))}
        {/* 자루에 묶인 가죽끈 */}
        <Cyl pos={[0, -0.062, 0.02]} r={0.027} h={0.03} seg={10} mat="rubber" cast={false} />
      </group>
    </group>
  )
}

const MODELS = {
  rifle: Rifle, shotgun: Shotgun, lmg: Lmg, sniper: Sniper,
  pistol: Pistol, smg: Smg, magnum: Magnum,
  knife: Knife, axe: Axe,
}

/* 무기마다 화면에서의 자리와 크기가 달라야 한다.

   하나의 기준으로 다 두면 저격총은 화면 밖으로 뻗고 권총은 저 아래
   구석에 조그맣게 놓인다. 긴 총은 뒤로 당기고 조금 줄이고, 짧은 총은
   앞으로 내민다. z 가 클수록(0 에 가까울수록) 몸 쪽으로 당겨진다. */
const VIEW = {
  rifle: { pos: [0.24, -0.25, -0.42], scale: 1 },
  shotgun: { pos: [0.24, -0.24, -0.36], scale: 0.98 },
  lmg: { pos: [0.26, -0.28, -0.34], scale: 0.94 },
  sniper: { pos: [0.23, -0.24, -0.26], scale: 0.86 },
  pistol: { pos: [0.2, -0.22, -0.5], scale: 1.06 },
  smg: { pos: [0.22, -0.23, -0.46], scale: 1.04 },
  magnum: { pos: [0.2, -0.22, -0.46], scale: 1.04 },
  knife: { pos: [0.26, -0.26, -0.44], scale: 1.05 },
  axe: { pos: [0.28, -0.3, -0.38], scale: 1 },
}
const DEFAULT_VIEW = { pos: [0.24, -0.24, -0.44], scale: 1 }

/* 총구 위치 — 화염과 예광선이 여기서 나간다 */
const MUZZLE = {
  rifle: -0.72, shotgun: -0.74, lmg: -0.78, sniper: -1.02,
  pistol: -0.3, smg: -0.52, magnum: -0.43,
  knife: -0.4, axe: -0.4,
}

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
    const view = VIEW[p.weapon] || DEFAULT_VIEW

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

    rig.current.scale.setScalar(view.scale)

    if (w.melee) {
      /* 근접무기는 뒤로 밀리는 게 아니라 가로로 베어 나간다.
         총과 같은 반동 애니메이션을 쓰면 칼로 찌르는 것처럼 보여서,
         부채꼴로 여럿을 벤다는 실제 판정과 어긋난다. */
      const sw = r * r
      rig.current.position.set(
        view.pos[0] + bobX + sw * 0.34,
        view.pos[1] + bobY + sw * 0.12,
        view.pos[2] + sw * 0.16,
      )
      rig.current.rotation.set(sw * 0.5, sw * 1.15, -sw * 1.5)
    } else {
      rig.current.position.set(
        view.pos[0] + bobX,
        view.pos[1] + bobY - reloadDip,
        view.pos[2] + kick,
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
