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


/* ── 새로 늘어난 자루들 ─────────────────────────────────────────
   같은 조각을 다른 비율로 쓰면 총기 계열처럼 보인다. 실제 총도
   한 집안이면 닮았으니 전부 딴판일 필요는 없다. 대신 손에 쥐었을 때
   바로 갈리는 특징 하나씩은 반드시 준다 — 배틀라이플은 긴 총열과
   조준경, 미니건은 회전 총열 다발, 레일건은 빛나는 코일. */

function Carbine() {
  return (
    <group>
      <Box pos={[0, 0.026, -0.14]} size={[0.056, 0.064, 0.36]} mat="polymer" />
      <Box pos={[0, 0.008, -0.36]} size={[0.046, 0.046, 0.18]} mat="darkPoly" />
      <Barrel z={-0.5} len={0.16} r={0.017} />
      <Cyl pos={[0.034, 0.046, -0.02]} r={0.008} h={0.044} rot={[0, 0, Math.PI / 2]} seg={8} mat="steel" />
      <Rail pos={[0, 0.06, -0.18]} len={0.3} count={8} />
      <IronSights front={-0.42} rear={-0.04} y={0.076} />
      <Magazine pos={[0, -0.13, -0.01]} size={[0.038, 0.17, 0.078]} tilt={0.12} curved />
      <Grip pos={[0, -0.11, 0.08]} tilt={0.3} h={0.16} />
      <Trigger pos={[0, -0.048, 0.04]} />
      {/* 접이식 개머리판 — 카빈은 짧은 게 정체성이라 뼈대만 */}
      {[-0.024, 0.024].map((x) => (
        <Cyl key={x} pos={[x, 0.026, 0.16]} r={0.007} h={0.18} seg={8} mat="steel" />
      ))}
      <Box pos={[0, 0.026, 0.25]} size={[0.068, 0.034, 0.016]} mat="rubber" cast={false} />
    </group>
  )
}

function Battle() {
  return (
    <group>
      <Box pos={[0, 0.028, -0.2]} size={[0.064, 0.074, 0.5]} mat="polymer" />
      <Box pos={[0, 0.014, -0.5]} size={[0.05, 0.05, 0.24]} mat="darkPoly" />
      {[-0.44, -0.5, -0.56].map((z) => (
        <Box key={z} pos={[0, 0.014, z]} size={[0.056, 0.016, 0.014]} mat="blued" cast={false} />
      ))}
      <Barrel z={-0.72} len={0.24} r={0.021} />
      {/* 총구 제동기 — 묵직한 3점사라는 표시 */}
      <Cyl pos={[0, 0.014, -0.86]} r={0.03} h={0.06} seg={14} mat="blued" />
      <Cyl pos={[0.038, 0.05, -0.04]} r={0.009} h={0.05} rot={[0, 0, Math.PI / 2]} seg={8} mat="steel" />
      <Scope pos={[0, 0.105, -0.24]} len={0.2} r={0.026} />
      <Magazine pos={[0, -0.15, -0.04]} size={[0.044, 0.2, 0.09]} tilt={0.14} curved />
      <Grip pos={[0, -0.12, 0.1]} tilt={0.3} h={0.17} />
      <Trigger pos={[0, -0.052, 0.055]} />
      <Stock pos={[0, 0.012, 0.29]} len={0.26} />
    </group>
  )
}

function AutoShotgun() {
  return (
    <group>
      <Box pos={[0, 0.02, -0.16]} size={[0.072, 0.08, 0.42]} mat="polymer" />
      <Box pos={[0, 0.056, -0.2]} size={[0.064, 0.024, 0.38]} mat="darkPoly" cast={false} />
      <Cyl pos={[0, 0.024, -0.52]} r={0.028} h={0.32} seg={16} mat="blued" />
      <Cyl pos={[0, 0.024, -0.69]} r={0.033} h={0.03} seg={16} mat="steel" />
      {/* 드럼 탄창 — 자동샷건임을 한눈에 알리는 실루엣 */}
      <Cyl pos={[0, -0.15, -0.04]} r={0.1} h={0.062} rot={[0, 0, Math.PI / 2]} seg={20} mat="darkPoly" />
      <Cyl pos={[0.034, -0.15, -0.04]} r={0.035} h={0.016} rot={[0, 0, Math.PI / 2]} seg={14} mat="steel" cast={false} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <Cyl key={i} pos={[0.036, -0.15 + Math.sin(a) * 0.062, -0.04 + Math.cos(a) * 0.062]}
            r={0.013} h={0.014} rot={[0, 0, Math.PI / 2]} seg={10} mat="brass" cast={false} />
        )
      })}
      <IronSights front={-0.6} rear={-0.02} y={0.078} />
      <Grip pos={[0, -0.11, 0.12]} tilt={0.32} h={0.16} w={0.062} />
      <Trigger pos={[0, -0.046, 0.07]} />
      <Stock pos={[0, 0.01, 0.28]} len={0.24} />
    </group>
  )
}

function Minigun() {
  const barrels = useRef()
  useFrame((state, dt) => {
    /* 총열 다발은 늘 조금씩 돈다. 예열 상태를 여기서 읽을 수도
       있지만, 뷰모델이 세션을 직접 들여다보면 조각들이 서로 얽힌다.
       "돌고 있다"는 인상만으로 충분하다. */
    if (barrels.current) barrels.current.rotation.z += dt * 6
  })
  return (
    <group>
      <Box pos={[0, 0.02, -0.06]} size={[0.11, 0.11, 0.34]} mat="polymer" />
      <Box pos={[0, 0.08, -0.06]} size={[0.09, 0.03, 0.3]} mat="darkPoly" cast={false} />
      {/* 회전 총열 다발 — 미니건의 전부 */}
      <group ref={barrels} position={[0, 0.02, -0.44]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <Cyl key={i} pos={[Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0]}
              r={0.014} h={0.44} seg={10} mat="blued" />
          )
        })}
        <Cyl pos={[0, 0, -0.23]} r={0.055} h={0.03} seg={18} mat="steel" />
        <Cyl pos={[0, 0, 0.2]} r={0.05} h={0.04} seg={18} mat="darkPoly" />
      </group>
      {/* 탄통과 탄띠 */}
      <Box pos={[0.06, -0.16, 0.06]} size={[0.13, 0.16, 0.2]} mat="darkPoly" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} pos={[0.06, -0.08 + i * 0.016, 0.02 - i * 0.012]}
          size={[0.02, 0.014, 0.03]} mat="brass" cast={false} />
      ))}
      {/* 두 손으로 잡는 손잡이 */}
      <Grip pos={[0, -0.12, 0.16]} tilt={0.22} h={0.16} w={0.056} />
      <Box pos={[-0.075, -0.04, 0.02]} size={[0.03, 0.11, 0.036]} mat="rubber" />
      <Trigger pos={[0, -0.05, 0.12]} />
    </group>
  )
}

function Railgun() {
  return (
    <group>
      <Box pos={[0, 0.03, -0.16]} size={[0.07, 0.08, 0.46]} mat="polymer" />
      {/* 두 줄 레일 — 사이에서 튀어나간다 */}
      {[-0.032, 0.032].map((x) => (
        <Box key={x} pos={[x, 0.04, -0.56]} size={[0.018, 0.05, 0.44]} mat="steel" />
      ))}
      {/* 코일 — 빛나는 고리 넷. 차지한다는 인상을 이걸로 준다 */}
      {[-0.42, -0.52, -0.62, -0.72].map((z) => (
        <mesh key={z} position={[0, 0.04, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.052, 0.009, 8, 20]} />
          <meshStandardMaterial
            color="#8fdcff" emissive="#2f9fd4" emissiveIntensity={2.2} toneMapped={false}
          />
        </mesh>
      ))}
      <Box pos={[0, 0.088, -0.24]} size={[0.03, 0.016, 0.3]} mat="darkPoly" cast={false} />
      {/* 등에 진 전원부 */}
      <Box pos={[0, -0.02, 0.2]} size={[0.09, 0.1, 0.16]} mat="darkPoly" />
      <mesh position={[0, 0.036, 0.2]}>
        <boxGeometry args={[0.05, 0.014, 0.1]} />
        <meshStandardMaterial
          color="#b6f0ff" emissive="#3fb0e0" emissiveIntensity={2.6} toneMapped={false}
        />
      </mesh>
      <Scope pos={[0, 0.13, -0.22]} len={0.22} r={0.028} />
      <Grip pos={[0, -0.12, 0.08]} tilt={0.32} h={0.17} />
      <Trigger pos={[0, -0.052, 0.035]} />
      <Stock pos={[0, 0.0, 0.31]} len={0.22} />
    </group>
  )
}

function Silenced() {
  return (
    <group>
      <Box pos={[0, 0.03, -0.13]} size={[0.048, 0.05, 0.3]} mat="blued" />
      <Box pos={[0, -0.008, -0.1]} size={[0.044, 0.03, 0.24]} mat="polymer" />
      {/* 굵고 긴 소음기 — 이 실루엣이 정체성이다 */}
      <Cyl pos={[0, 0.03, -0.4]} r={0.031} h={0.26} seg={18} mat="darkPoly" />
      {[-0.32, -0.4, -0.48].map((z) => (
        <Cyl key={z} pos={[0, 0.03, z]} r={0.034} h={0.012} seg={18} mat="blued" cast={false} />
      ))}
      <Cyl pos={[0, 0.03, -0.53]} r={0.024} h={0.014} seg={16} mat="steel" />
      <IronSights front={-0.24} rear={0.0} y={0.056} />
      <Grip pos={[0, -0.115, 0.04]} tilt={0.32} h={0.17} w={0.05} d={0.085} />
      <Trigger pos={[0, -0.042, -0.005]} />
      <Box pos={[0, -0.2, 0.075]} size={[0.05, 0.014, 0.086]} mat="steel" cast={false} />
    </group>
  )
}

function BurstPistol() {
  return (
    <group>
      <Box pos={[0, 0.03, -0.16]} size={[0.05, 0.054, 0.36]} mat="blued" />
      {[0.0, -0.024].map((z) => (
        <Box key={z} pos={[0, 0.03, z]} size={[0.054, 0.032, 0.008]} mat="darkPoly" cast={false} />
      ))}
      <Box pos={[0, -0.008, -0.14]} size={[0.046, 0.03, 0.3]} mat="polymer" />
      <Cyl pos={[0, 0.03, -0.35]} r={0.014} h={0.04} seg={14} mat="steel" />
      {/* 총열 아래로 뻗은 앞 손잡이 — 3점사를 눌러 잡는 자세 */}
      <Box pos={[0, -0.055, -0.24]} size={[0.028, 0.075, 0.034]} mat="rubber" />
      <IronSights front={-0.32} rear={0.0} y={0.06} />
      <Grip pos={[0, -0.115, 0.05]} tilt={0.32} h={0.17} w={0.05} d={0.085} />
      <Trigger pos={[0, -0.042, 0.005]} />
    </group>
  )
}

function DualOne({ side }) {
  return (
    <group position={[side * 0.13, side === 1 ? 0 : 0.02, side === 1 ? 0 : 0.03]}
      rotation={[0, side * 0.09, side * -0.06]}>
      <Box pos={[0, 0.03, -0.12]} size={[0.045, 0.048, 0.27]} mat="blued" />
      <Box pos={[0, -0.008, -0.09]} size={[0.041, 0.028, 0.22]} mat="polymer" />
      <Cyl pos={[0, 0.03, -0.26]} r={0.013} h={0.03} seg={12} mat="steel" />
      <Box pos={[0, 0.058, -0.24]} size={[0.008, 0.016, 0.012]} mat="steel" cast={false} />
      <Grip pos={[0, -0.1, 0.04]} tilt={0.32} h={0.15} w={0.045} d={0.078} />
      <Trigger pos={[0, -0.038, -0.005]} />
    </group>
  )
}

/* 두 자루를 좌우로 벌려 든다. 하나짜리와 헷갈릴 수 없는 실루엣 */
function DualPistol() {
  return (
    <group>
      <DualOne side={-1} />
      <DualOne side={1} />
    </group>
  )
}

function MachinePistol() {
  return (
    <group>
      <Box pos={[0, 0.026, -0.11]} size={[0.05, 0.062, 0.28]} mat="polymer" />
      <Box pos={[0, 0.054, -0.13]} size={[0.044, 0.022, 0.24]} mat="darkPoly" cast={false} />
      <Cyl pos={[0, 0.026, -0.29]} r={0.015} h={0.12} seg={12} mat="blued" />
      <Cyl pos={[0, 0.026, -0.36]} r={0.019} h={0.016} seg={14} mat="steel" />
      {/* 아주 긴 탄창 — 눈 깜짝할 새 빈다는 인상 */}
      <Magazine pos={[0, -0.17, -0.01]} size={[0.03, 0.26, 0.05]} tilt={0.04} />
      <Grip pos={[0, -0.1, 0.05]} tilt={0.3} h={0.15} w={0.046} d={0.078} />
      <Trigger pos={[0, -0.04, 0.012]} />
      <Cyl pos={[0.03, 0.05, -0.02]} r={0.007} h={0.036} rot={[0, 0, Math.PI / 2]} seg={8} mat="steel" />
    </group>
  )
}

function Katana() {
  return (
    <group rotation={[0, 0, -0.26]}>
      {/* 길고 살짝 휜 날 — 토막을 조금씩 꺾어 곡선을 만든다 */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[i * 0.006, i * 0.012, -0.12 - i * 0.13]} rotation={[i * 0.02, 0, 0]}>
          <Box size={[0.016, 0.046, 0.14]} mat="steel" />
          <Box pos={[0, -0.026, 0]} size={[0.02, 0.012, 0.14]} mat="blued" cast={false} />
        </group>
      ))}
      {/* 칼끝 */}
      <mesh position={[0.03, 0.062, -0.79]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.026, 0.1, 4]} />
        <meshStandardMaterial color="#eef3f8" roughness={0.1} metalness={1} />
      </mesh>
      {/* 츠바(코등이) */}
      <Cyl pos={[0, -0.006, -0.06]} r={0.055} h={0.014} seg={16} mat="brass" />
      {/* 자루 — 감은 끈 */}
      <Cyl pos={[0, -0.02, 0.08]} r={0.024} h={0.26} seg={12} mat="darkPoly" rot={[Math.PI / 2 - 0.1, 0, 0]} />
      {[0.0, 0.05, 0.1, 0.15, 0.2].map((z) => (
        <Box key={z} pos={[0, -0.014 - z * 0.1, z]} size={[0.052, 0.014, 0.02]}
          rot={[0.1, 0, Math.PI / 4]} mat="rubber" cast={false} />
      ))}
      <Cyl pos={[0, -0.042, 0.215]} r={0.026} h={0.02} seg={12} mat="brass" cast={false} />
    </group>
  )
}

function Pipe() {
  const rot = [Math.PI / 2 - 0.1, 0, 0]
  return (
    <group rotation={[0, 0, -0.3]}>
      {/* 쇠관 — 끝에 나사산 이음쇠가 남아 있다 */}
      <Cyl pos={[0, 0.0, -0.24]} r={0.036} h={0.7} seg={14} mat="steel" rot={rot} />
      <Cyl pos={[0.008, 0.055, -0.55]} r={0.045} h={0.07} seg={14} mat="blued" rot={rot} />
      {[-0.55, -0.52].map((z) => (
        <Cyl key={z} pos={[0.008, 0.052, z]} r={0.048} h={0.01} seg={14} mat="darkPoly" rot={rot} cast={false} />
      ))}
      {/* 녹슨 자국처럼 보이는 띠 */}
      <Cyl pos={[0, -0.01, -0.1]} r={0.038} h={0.05} seg={14} mat="rubber" rot={rot} cast={false} />
      {/* 손이 닿는 곳에 감은 테이프 */}
      <Cyl pos={[-0.012, -0.055, 0.13]} r={0.04} h={0.2} seg={14} mat="rubber" rot={rot} />
      <Cyl pos={[-0.02, -0.08, 0.22]} r={0.038} h={0.016} seg={14} mat="darkPoly" rot={rot} cast={false} />
      {/* 테이프가 감긴 결 — 이 몇 줄이 "주워서 감아 쓴 것"으로 읽히게 한다 */}
      {[0.06, 0.11, 0.16, 0.21].map((z) => (
        <Cyl key={z} pos={[-0.006 - z * 0.06, -0.03 - z * 0.24, z]} r={0.042} h={0.012}
          seg={14} mat="blued" rot={rot} cast={false} />
      ))}
      {/* 관에 뚫린 구멍 두 개 — 배관에서 뜯어온 티 */}
      {[-0.34, -0.18].map((z) => (
        <Cyl key={z} pos={[0.036, z * 0.06 + 0.01, z]} r={0.009} h={0.02}
          rot={[0, 0, Math.PI / 2]} seg={8} mat="darkPoly" cast={false} />
      ))}
      {/* 끝을 조인 죔쇠 */}
      <Box pos={[0.012, 0.078, -0.62]} size={[0.09, 0.022, 0.03]} rot={[0.1, 0, 0]}
        mat="darkPoly" cast={false} />
      <Cyl pos={[0.012, 0.078, -0.64]} r={0.05} h={0.014} seg={14} mat="steel" rot={rot} cast={false} />
    </group>
  )
}

function Hammer() {
  const haftRot = [Math.PI / 2 - 0.14, 0, 0]
  return (
    <group rotation={[0, 0, -0.2]}>
      <Cyl pos={[0, -0.02, 0.02]} r={0.024} r2={0.028} h={0.66} seg={12} mat="wood" rot={haftRot} />
      <Cyl pos={[0, -0.07, 0.27]} r={0.031} h={0.16} seg={12} mat="rubber" rot={haftRot} />
      <Cyl pos={[0, -0.1, 0.36]} r={0.034} h={0.024} seg={12} mat="steel" rot={haftRot} />
      {/* 머리 — 커다란 쇳덩이 */}
      <group position={[0, 0.07, -0.3]}>
        <Box pos={[0, 0, 0]} size={[0.19, 0.15, 0.15]} mat="blued" />
        {/* 때리는 면 — 밝게 해서 어디로 치는지 알린다 */}
        <Box pos={[-0.1, 0, 0]} size={[0.03, 0.16, 0.16]} mat="steel" />
        {[-0.055, 0.055].map((y) => (
          <Box key={y} pos={[-0.1, y, 0]} size={[0.036, 0.03, 0.17]} mat="darkPoly" cast={false} />
        ))}
        {/* 반대쪽 쐐기 */}
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[0.06, 0.09, 4]} />
          <meshStandardMaterial color="#8d949e" roughness={0.3} metalness={0.98} />
        </mesh>
        {/* 자루를 물린 쇠테와 대갈못 */}
        <Cyl pos={[0, -0.085, 0.03]} r={0.034} h={0.04} seg={12} mat="steel" cast={false} />
        {[-0.04, 0.04].map((y) => (
          <Cyl key={y} pos={[0, y, 0.078]} r={0.009} h={0.012} seg={8} mat="steel" cast={false} />
        ))}
      </group>
    </group>
  )
}

const MODELS = {
  carbine: Carbine, rifle: Rifle, battle: Battle, shotgun: Shotgun,
  autoshotgun: AutoShotgun, lmg: Lmg, minigun: Minigun, sniper: Sniper,
  railgun: Railgun,
  pistol: Pistol, silenced: Silenced, burstpistol: BurstPistol,
  magnum: Magnum, dualpistol: DualPistol, smg: Smg, machinepistol: MachinePistol,
  knife: Knife, katana: Katana, pipe: Pipe, axe: Axe, hammer: Hammer,
}

/* 무기마다 화면에서의 자리와 크기가 달라야 한다.

   하나의 기준으로 다 두면 저격총은 화면 밖으로 뻗고 권총은 저 아래
   구석에 조그맣게 놓인다. 긴 총은 뒤로 당기고 조금 줄이고, 짧은 총은
   앞으로 내민다. z 가 클수록(0 에 가까울수록) 몸 쪽으로 당겨진다. */
const VIEW = {
  carbine: { pos: [0.23, -0.24, -0.46], scale: 1.02 },
  rifle: { pos: [0.24, -0.25, -0.42], scale: 1 },
  battle: { pos: [0.24, -0.25, -0.34], scale: 0.94 },
  autoshotgun: { pos: [0.25, -0.26, -0.36], scale: 0.96 },
  minigun: { pos: [0.24, -0.26, -0.3], scale: 0.92 },
  railgun: { pos: [0.24, -0.25, -0.3], scale: 0.9 },
  silenced: { pos: [0.2, -0.22, -0.46], scale: 1.04 },
  burstpistol: { pos: [0.2, -0.22, -0.46], scale: 1.04 },
  dualpistol: { pos: [0.0, -0.24, -0.5], scale: 1.0 },
  machinepistol: { pos: [0.21, -0.23, -0.48], scale: 1.04 },
  katana: { pos: [0.26, -0.24, -0.32], scale: 0.98 },
  pipe: { pos: [0.27, -0.26, -0.4], scale: 1 },
  hammer: { pos: [0.29, -0.3, -0.36], scale: 0.96 },
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
  carbine: -0.6, rifle: -0.72, battle: -0.9, shotgun: -0.74,
  autoshotgun: -0.7, lmg: -0.78, minigun: -0.68, sniper: -1.02,
  railgun: -0.8,
  pistol: -0.3, silenced: -0.54, burstpistol: -0.37,
  magnum: -0.43, dualpistol: -0.28, smg: -0.52, machinepistol: -0.37,
  knife: -0.4, katana: -0.4, pipe: -0.4, axe: -0.4, hammer: -0.4,
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
