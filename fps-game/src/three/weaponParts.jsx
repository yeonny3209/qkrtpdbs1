/* ==================================================================
   총을 이루는 조각들

   무기가 아홉 자루라 각각을 통째로 손으로 짜면 코드가 길어지기만
   하고 서로 다른 규칙으로 만들어진다. 재질과 기본 도형을 여기 모아
   두고, 각 무기는 "무엇을 어디에 붙일지"만 적게 한다.
   ================================================================== */
import { MAT } from './weaponMaterials.js'

/* 재질 하나 — <M t="blued" /> */
export function M({ t = 'polymer' }) {
  return <meshStandardMaterial {...(MAT[t] || MAT.polymer)} />
}

/* 상자 하나. 총 부품 대부분이 이것이다. */
export function Box({ pos = [0, 0, 0], size, rot = [0, 0, 0], mat = 'polymer', cast = true }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={cast}>
      <boxGeometry args={size} />
      <M t={mat} />
    </mesh>
  )
}

/* 원통. 기본은 앞(-Z)을 향해 눕혀 둔다 — 총열이 제일 흔한 쓰임이라 */
export function Cyl({
  pos = [0, 0, 0], r = 0.03, r2 = null, h = 0.2, seg = 14,
  rot = [Math.PI / 2, 0, 0], mat = 'blued', cast = true,
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow={cast}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <M t={mat} />
    </mesh>
  )
}

/* 총열 — 관에 총구 링을 두른다. 링 하나로 끝이 "열려 있다"고 읽힌다 */
export function Barrel({ z = -0.5, len = 0.3, r = 0.022, mat = 'blued', ring = true }) {
  return (
    <group>
      <Cyl pos={[0, 0, z]} r={r} h={len} mat={mat} />
      {ring && <Cyl pos={[0, 0, z - len / 2 + 0.012]} r={r * 1.35} h={0.024} seg={16} mat="steel" />}
    </group>
  )
}

/* 피카티니 레일 — 위에 얹는 톱니.

   품질이 가장 싸게 올라가는 부분이다. 매끈한 상자 위에 작은 홈 몇
   개만 얹어도 "부품이 조립된 물건"으로 보인다. */
export function Rail({ pos = [0, 0.05, -0.2], len = 0.3, w = 0.032, count = 7 }) {
  const step = len / count
  return (
    <group position={pos}>
      <Box pos={[0, 0, 0]} size={[w, 0.012, len]} mat="darkPoly" cast={false} />
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          pos={[0, 0.012, -len / 2 + step * (i + 0.5)]}
          size={[w, 0.014, step * 0.45]}
          mat="blued"
          cast={false}
        />
      ))}
    </group>
  )
}

/* 가늠쇠 — 앞의 기둥과 뒤의 가늠구멍 */
export function IronSights({ front = -0.5, rear = -0.12, y = 0.07 }) {
  return (
    <group>
      <Box pos={[0, y + 0.018, front]} size={[0.008, 0.036, 0.012]} mat="steel" cast={false} />
      <Box pos={[0, y, front]} size={[0.03, 0.01, 0.014]} mat="blued" cast={false} />
      <group position={[0, y + 0.012, rear]}>
        {[-0.019, 0.019].map((x) => (
          <Box key={x} pos={[x, 0, 0]} size={[0.008, 0.03, 0.016]} mat="steel" cast={false} />
        ))}
        <Box pos={[0, -0.012, 0]} size={[0.046, 0.01, 0.016]} mat="blued" cast={false} />
      </group>
    </group>
  )
}

/* 권총 손잡이 — 뒤로 기울고, 앞면에 미끄럼 방지 홈 */
export function Grip({ pos = [0, -0.12, 0.02], tilt = 0.34, h = 0.19, w = 0.058, d = 0.1 }) {
  return (
    <group position={pos} rotation={[tilt, 0, 0]}>
      <Box pos={[0, 0, 0]} size={[w, h, d]} mat="rubber" />
      {[-0.3, -0.1, 0.1, 0.3].map((f) => (
        <Box
          key={f}
          pos={[0, h * f, -d / 2 + 0.004]}
          size={[w * 0.9, 0.012, 0.012]}
          mat="darkPoly"
          cast={false}
        />
      ))}
    </group>
  )
}

/* 방아쇠와 방아쇠울 */
export function Trigger({ pos = [0, -0.05, -0.01] }) {
  return (
    <group position={pos}>
      <Box pos={[0, -0.035, 0]} size={[0.03, 0.01, 0.075]} mat="blued" cast={false} />
      <Box pos={[0, -0.016, 0.03]} size={[0.014, 0.03, 0.014]} mat="steel" cast={false} />
      <Box pos={[0, -0.016, -0.035]} size={[0.03, 0.03, 0.012]} mat="blued" cast={false} />
    </group>
  )
}

/* 탄창 — 살짝 기울여 꽂는다. 바나나처럼 휘게 하려면 seg 를 늘린다 */
export function Magazine({
  pos = [0, -0.16, -0.08], size = [0.05, 0.2, 0.09], tilt = 0.12, mat = 'darkPoly', curved = false,
}) {
  return (
    <group position={pos} rotation={[tilt, 0, 0]}>
      {curved ? (
        /* 휘어진 탄창은 짧은 토막을 조금씩 꺾어 이어 붙인다 */
        Array.from({ length: 4 }, (_, i) => (
          <group key={i} position={[0, -size[1] * (i / 4), size[1] * 0.055 * i * i * 0.35]}
            rotation={[i * 0.09, 0, 0]}>
            <Box size={[size[0], size[1] / 3.4, size[2]]} mat={mat} />
          </group>
        ))
      ) : (
        <Box size={size} mat={mat} />
      )}
      <Box pos={[0, size[1] * 0.5 - 0.008, 0]} size={[size[0] * 1.08, 0.016, size[2] * 1.06]}
        mat="blued" cast={false} />
    </group>
  )
}

/* 조준경 — 몸통, 대물렌즈, 마운트 */
export function Scope({ pos = [0, 0.115, -0.22], len = 0.24, r = 0.032 }) {
  return (
    <group position={pos}>
      <Cyl pos={[0, 0, 0]} r={r} h={len} seg={18} mat="blued" />
      <Cyl pos={[0, 0, -len / 2 - 0.012]} r={r * 1.25} h={0.03} seg={18} mat="blued" />
      {/* 렌즈 — 살짝 빛나서 어디가 앞인지 알려준다 */}
      <mesh position={[0, 0, -len / 2 - 0.026]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 1.1, r * 1.1, 0.006, 18]} />
        <meshStandardMaterial {...MAT.lens} emissive="#2f7fbf" emissiveIntensity={0.7} />
      </mesh>
      <Cyl pos={[0, 0, len / 2 + 0.01]} r={r * 0.95} h={0.026} seg={18} mat="blued" />
      {/* 마운트 링 두 개 */}
      {[-len * 0.28, len * 0.28].map((z) => (
        <Box key={z} pos={[0, -r * 0.85, z]} size={[0.03, 0.05, 0.026]} mat="darkPoly" cast={false} />
      ))}
      {/* 조절 노브 */}
      <Cyl pos={[0.032, 0.01, 0]} r={0.014} h={0.026} rot={[0, 0, Math.PI / 2]} seg={10} mat="steel" />
      <Cyl pos={[0, 0.042, 0]} r={0.014} h={0.026} rot={[0, 0, 0]} seg={10} mat="steel" />
    </group>
  )
}

/* 개머리판 — 어깨에 닿는 부분. 뒤로 갈수록 좁아진다 */
export function Stock({ pos = [0, -0.02, 0.2], len = 0.26, mat = 'polymer' }) {
  return (
    <group position={pos}>
      <Box pos={[0, 0.005, 0]} size={[0.045, 0.075, len]} mat={mat} />
      <Box pos={[0, -0.03, len * 0.5 - 0.02]} size={[0.05, 0.05, 0.05]} mat={mat} cast={false} />
      {/* 개머리판 끝 고무판 */}
      <Box pos={[0, 0, len / 2 + 0.008]} size={[0.052, 0.09, 0.016]} mat="rubber" cast={false} />
    </group>
  )
}
