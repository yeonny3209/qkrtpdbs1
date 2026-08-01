/* ==================================================================
   방탈출 — 1인칭 3D 탈출 게임 (난이도 5단계)

   [구조]
   · 방/퍼즐 생성은 game/escape.js (순수 로직) 가 전담한다.
   · 여기서는 그 데이터를 3D로 그리고, 걷고, 조사하고, 잠금을 푸는 일만 한다.

   [조작]
   PC   : WASD 이동 · 마우스 드래그 시점 · E 조사 · Tab 수첩
   모바일: 왼쪽 조이스틱 이동 · 오른쪽 화면 드래그 시점 · 조사 버튼
   ================================================================== */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { clamp, damp, dist2, loadJSON, saveJSON, TOUCH, useIsMobile } from './shared/util.js'
import { VirtualJoystick, TouchBtn } from './shared/ui.jsx'
import {
  ESC_DIFFS, ESC_DIFF_BY_ID, ESC_STAGES, ESC_STAGE_BY_ID, stagesOfDiff,
  ESC_COLORS, CLOCK_MINUTES, buildRoom, checkLock, allSolved, roomProgress,
} from './game/escape.js'

/* 방이 5개에서 15개로 늘면서 기록의 의미(난이도별 → 방별)가 바뀌어 키를 올렸다 */
const LS_ESCAPE = 'escape_records_v2'

const EYE = 1.62              // 눈높이
const MOVE = 3.4
const RUN = 6.0
const ACC = 12
const REACH = 2.9             // 조사 가능 거리
const PROP_R = 0.62           // 소품 충돌 반지름
const LOOK_SENS = 0.0032

const fmtTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/* ==================================================================
   소품 모델 — 기본 도형만으로 (외부 모델 파일 없음)
   ================================================================== */
const WOOD = { color: '#6b4a2f', roughness: 0.85 }
const DARKWOOD = { color: '#4a3220', roughness: 0.9 }
const METAL = { color: '#8a94a6', roughness: 0.4, metalness: 0.6 }

function PropModel({ kind, glow }) {
  const em = glow ? { emissive: '#fbbf24', emissiveIntensity: 0.45 } : {}
  switch (kind) {
    case 'desk':
      return (
        <group>
          <mesh position={[0, 0.74, 0]} castShadow><boxGeometry args={[1.5, 0.09, 0.75]} /><meshStandardMaterial {...WOOD} {...em} /></mesh>
          {[[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.36, z]} castShadow><boxGeometry args={[0.09, 0.72, 0.09]} /><meshStandardMaterial {...DARKWOOD} /></mesh>
          ))}
          <mesh position={[0, 0.52, 0.3]} castShadow><boxGeometry args={[0.85, 0.28, 0.12]} /><meshStandardMaterial {...DARKWOOD} /></mesh>
          <mesh position={[0, 0.52, 0.38]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial {...METAL} /></mesh>
        </group>
      )
    case 'cabinet':
      return (
        <group>
          <RoundedBox args={[1.0, 1.7, 0.6]} radius={0.04} smoothness={2} position={[0, 0.85, 0]} castShadow>
            <meshStandardMaterial {...DARKWOOD} {...em} />
          </RoundedBox>
          {[0.45, 0.95, 1.45].map((y, i) => (
            <mesh key={i} position={[0, y, 0.31]}><boxGeometry args={[0.86, 0.4, 0.03]} /><meshStandardMaterial color="#5c4028" roughness={0.8} /></mesh>
          ))}
          {/* 손잡이 — 회전은 mesh에 줘야 한다 (geometry에 rotation을 주면 무시된다) */}
          <mesh position={[0.3, 0.95, 0.34]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.045, 0.045, 0.06, 10]} /><meshStandardMaterial {...METAL} /></mesh>
        </group>
      )
    case 'shelf':
      return (
        <group>
          <mesh position={[0, 1.0, -0.12]} castShadow><boxGeometry args={[1.3, 2.0, 0.08]} /><meshStandardMaterial {...DARKWOOD} {...em} /></mesh>
          {[0.35, 0.95, 1.55].map((y, i) => (
            <group key={i}>
              <mesh position={[0, y, 0.05]} castShadow><boxGeometry args={[1.3, 0.06, 0.42]} /><meshStandardMaterial {...WOOD} /></mesh>
              {[-0.4, -0.15, 0.12, 0.38].map((x, j) => (
                <mesh key={j} position={[x, y + 0.21, 0.05]} castShadow>
                  <boxGeometry args={[0.11, 0.36, 0.3]} />
                  <meshStandardMaterial color={['#8b3a3a', '#3a5a8b', '#3a8b5a', '#8b7a3a'][(i + j) % 4]} roughness={0.85} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )
    case 'painting':
      return (
        <group position={[0, 1.55, 0]}>
          <mesh castShadow><boxGeometry args={[1.15, 0.85, 0.07]} /><meshStandardMaterial color="#7a5c2e" roughness={0.7} {...em} /></mesh>
          <mesh position={[0, 0, 0.045]}><planeGeometry args={[0.95, 0.65]} /><meshStandardMaterial color="#2b3a55" roughness={0.9} /></mesh>
          <mesh position={[-0.18, -0.08, 0.05]}><circleGeometry args={[0.14, 16]} /><meshStandardMaterial color="#d8c48a" roughness={0.9} /></mesh>
        </group>
      )
    case 'clock':
      return (
        <group position={[0, 1.75, 0]}>
          {/* 몸통은 방을 향해 눕혀야 한다 — 회전을 geometry에 주면 무시되어 원통이 선다 */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.4, 0.4, 0.1, 24]} /><meshStandardMaterial color="#3c3c46" roughness={0.6} {...em} /></mesh>
          <mesh position={[0, 0, 0.06]}><circleGeometry args={[0.34, 24]} /><meshStandardMaterial color="#e8e4d8" roughness={0.9} /></mesh>
          <mesh position={[0, 0.09, 0.08]}><boxGeometry args={[0.03, 0.19, 0.01]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0.07, 0, 0.08]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.03, 0.15, 0.01]} /><meshStandardMaterial color="#222" /></mesh>
        </group>
      )
    case 'crate':
      return (
        <group>
          <RoundedBox args={[0.9, 0.8, 0.9]} radius={0.03} smoothness={2} position={[0, 0.4, 0]} castShadow>
            <meshStandardMaterial {...WOOD} {...em} />
          </RoundedBox>
          {[-0.28, 0.28].map((y, i) => (
            <mesh key={i} position={[0, 0.4 + y, 0.46]}><boxGeometry args={[0.92, 0.09, 0.02]} /><meshStandardMaterial {...DARKWOOD} /></mesh>
          ))}
        </group>
      )
    case 'plant':
      return (
        <group>
          <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.28, 0.21, 0.44, 14]} /><meshStandardMaterial color="#8a5a3a" roughness={0.9} {...em} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.16, 0.72, Math.sin(a) * 0.16]} rotation={[Math.cos(a) * 0.4, 0, Math.sin(a) * -0.4]} castShadow>
                <coneGeometry args={[0.14, 0.72, 6]} />
                <meshStandardMaterial color="#3f8a4a" roughness={0.85} />
              </mesh>
            )
          })}
        </group>
      )
    default: /* lamp */
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.26, 0.3, 0.1, 16]} /><meshStandardMaterial {...METAL} {...em} /></mesh>
          <mesh position={[0, 0.66, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 1.2, 10]} /><meshStandardMaterial {...METAL} /></mesh>
          <mesh position={[0, 1.36, 0]} castShadow><coneGeometry args={[0.32, 0.4, 18, 1, true]} /><meshStandardMaterial color="#e6d8a8" roughness={0.7} side={THREE.DoubleSide} emissive="#ffe9a8" emissiveIntensity={0.9} /></mesh>
          {/* 전구는 발광 재질로만 표현한다 — 스탠드마다 실제 조명을 달면
              지옥 난이도(소품 34개)에서 광원이 10개를 넘어 모바일이 버티지 못한다 */}
          <mesh position={[0, 1.24, 0]}><sphereGeometry args={[0.09, 10, 8]} /><meshBasicMaterial color="#fff2cf" /></mesh>
        </group>
      )
  }
}

/* 소품 하나 — 조준되면 테두리가 빛난다.
   액자·시계 같은 벽걸이는 좌표(벽에서 1.2m)보다 뒤, 벽면에 붙여 그린다.
   ry가 그 벽의 안쪽 방향이므로 local -Z가 정확히 벽 쪽이다. */
const WALL_BACK = 1.14

function PropObj({ prop, aimed }) {
  return (
    <group position={[prop.x, 0, prop.z]} rotation-y={prop.ry}>
      <group position={[0, 0, prop.wall ? -WALL_BACK : 0]}>
        <PropModel kind={prop.kind} glow={aimed} />
        {prop.locked && (
          <mesh position={[0, 1.15, 0.34]}>
            <torusGeometry args={[0.1, 0.03, 8, 16]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
          </mesh>
        )}
      </group>
    </group>
  )
}

/* ==================================================================
   벽에 붙은 잠금장치 패널
   ================================================================== */
const LOCK_TINT = {
  keypad: '#38bdf8', colorpad: '#a855f7', switchboard: '#22c55e', dial: '#fb923c',
}

function LockPanel({ lock, aimed }) {
  const tint = LOCK_TINT[lock.kind] || '#38bdf8'
  const c = lock.solved ? '#22c55e' : tint
  return (
    <group position={[lock.x, 1.5, lock.z]} rotation-y={lock.ry}>
      <RoundedBox args={[0.78, 0.95, 0.12]} radius={0.04} smoothness={2} castShadow>
        <meshStandardMaterial color="#20242e" roughness={0.5} metalness={0.4}
          emissive={aimed ? c : '#000'} emissiveIntensity={aimed ? 0.35 : 0} />
      </RoundedBox>
      {/* 화면 */}
      <mesh position={[0, 0.26, 0.07]}>
        <planeGeometry args={[0.6, 0.24]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={lock.solved ? 1.1 : 0.7} />
      </mesh>
      {/* 버튼 격자 */}
      {[0, 1, 2].map((r) => [0, 1, 2].map((col) => (
        <mesh key={`${r}${col}`} position={[-0.19 + col * 0.19, 0.02 - r * 0.19, 0.07]}>
          <boxGeometry args={[0.14, 0.14, 0.02]} />
          <meshStandardMaterial color={lock.solved ? '#2c4a34' : '#39404e'} roughness={0.6} />
        </mesh>
      )))}
      {/* 장치마다 실제 광원을 달면 지옥 난이도에서 광원이 너무 많아진다 —
          화면은 발광 재질(emissive)만으로도 충분히 눈에 띈다 */}
    </group>
  )
}

/* ==================================================================
   방 — 바닥·벽·천장·문
   ================================================================== */
function RoomShell({ half, open, theme }) {
  const H = 3.2
  const th = theme || { floor: '#3a3128', wall: '#2a2f3d', ceil: '#1b1f28', accent: '#d8a04a', light: '#ffeccc' }
  const wall = { color: th.wall, roughness: 0.95 }
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[half * 2, half * 2]} />
        <meshStandardMaterial color={th.floor} roughness={1} />
      </mesh>
      {/* 천장 */}
      <mesh position={[0, H, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[half * 2, half * 2]} />
        <meshStandardMaterial color={th.ceil} roughness={1} />
      </mesh>
      {/* 벽 4면 — 안쪽을 향하도록 BackSide 대신 각각 배치 */}
      {[
        { p: [0, H / 2, -half], r: [0, 0, 0] },
        { p: [0, H / 2, half], r: [0, Math.PI, 0] },
        { p: [-half, H / 2, 0], r: [0, Math.PI / 2, 0] },
        { p: [half, H / 2, 0], r: [0, -Math.PI / 2, 0] },
      ].map((w, i) => (
        <mesh key={i} position={w.p} rotation={w.r} receiveShadow>
          <planeGeometry args={[half * 2, H]} />
          <meshStandardMaterial {...wall} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 문 (북쪽 벽 중앙) */}
      <group position={[0, 0, -half + 0.06]}>
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[1.35, 2.1, 0.1]} />
          <meshStandardMaterial color={open ? '#1a2e1f' : th.accent} roughness={0.8}
            emissive={open ? '#22c55e' : '#000'} emissiveIntensity={open ? 0.5 : 0} />
        </mesh>
        <mesh position={[0.5, 1.05, 0.08]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color={open ? '#4ade80' : '#c9a227'} metalness={0.7} roughness={0.3}
            emissive={open ? '#22c55e' : '#000'} emissiveIntensity={open ? 0.8 : 0} />
        </mesh>
        {open && (
          <>
            <mesh position={[0, 1.05, 0.12]}>
              <planeGeometry args={[1.2, 1.95]} />
              <meshBasicMaterial color="#bbf7d0" transparent opacity={0.35} />
            </mesh>
            <pointLight position={[0, 1.4, 0.6]} intensity={12} distance={9} color="#86efac" />
          </>
        )}
      </group>
      {/* 천장 조명 — 방이 클수록 밝게 (구석까지 물건이 보여야 탐색이 된다) */}
      <pointLight position={[0, H - 0.35, 0]} intensity={half * 14} distance={half * 4.5} color={th.light} castShadow />
      <mesh position={[0, H - 0.12, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 20]} />
        <meshStandardMaterial color="#fff3d8" emissive={th.light} emissiveIntensity={1.1} />
      </mesh>
      {/* 네 귀퉁이 보조등 — 큰 방에서 벽 쪽이 새까매지지 않게.
          스탠드·잠금장치의 개별 광원을 걷어낸 만큼 여기서 밝기를 메운다 */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <pointLight key={i} position={[sx * half * 0.62, H - 0.7, sz * half * 0.62]}
          intensity={half * 5.5} distance={half * 2.9} color={th.light} />
      ))}
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#cfd8ff', '#3a2f22', 0.7]} />
    </group>
  )
}

/* ==================================================================
   1인칭 컨트롤러 — 이동 · 충돌 · 조준 대상 판정
   ================================================================== */
function FpsController({ live, roomRef, onAim, paused }) {
  const camera = useThree((s) => s.camera)
  const keys = useRef({ f: 0, b: 0, l: 0, r: 0, run: false })
  const vel = useRef(new THREE.Vector3())

  useEffect(() => {
    const MAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' }
    const down = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keys.current.run = true; return }
      const k = MAP[e.code]
      if (!k) return
      if (e.code.startsWith('Arrow')) e.preventDefault()
      keys.current[k] = 1
    }
    const up = (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keys.current.run = false; return }
      const k = MAP[e.code]
      if (k) keys.current[k] = 0
    }
    const blur = () => { keys.current = { f: 0, b: 0, l: 0, r: 0, run: false } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    const L = live.current
    const room = roomRef.current
    if (!room) return

    if (!paused) {
      const k = keys.current
      const fwd = clamp(k.f - k.b - TOUCH.my, -1, 1)
      const str = clamp(k.r - k.l + TOUCH.mx, -1, 1)
      const sy = Math.sin(L.yaw), cy = Math.cos(L.yaw)
      /* 카메라가 보는 방향 기준 */
      let ix = -sy * fwd + cy * str
      let iz = -cy * fwd - sy * str
      const mag = Math.hypot(ix, iz)
      const speed = (k.run || TOUCH.run ? RUN : MOVE) * Math.min(1, Math.hypot(fwd, str))
      if (mag > 0.001) { ix = (ix / mag) * speed; iz = (iz / mag) * speed } else { ix = 0; iz = 0 }
      vel.current.x += (ix - vel.current.x) * damp(ACC, dt)
      vel.current.z += (iz - vel.current.z) * damp(ACC, dt)

      L.x += vel.current.x * dt
      L.z += vel.current.z * dt

      /* 벽 */
      const lim = room.half - 0.45
      L.x = clamp(L.x, -lim, lim)
      L.z = clamp(L.z, -lim, lim)

      /* 소품 밀어내기 — 벽에 걸린 액자·시계는 통과한다 (벽 앞 허공에 막히면 안 된다) */
      const MIN_GAP = PROP_R + 0.34
      for (const p of room.props) {
        if (p.wall) continue
        const dx = L.x - p.x, dz = L.z - p.z
        const d = Math.hypot(dx, dz)
        if (d >= MIN_GAP) continue
        if (d < 1e-4) {
          /* 정확히 소품 한가운데 겹치면 밀어낼 방향이 없다 —
             예전에는 그냥 건너뛰어서 소품 안에 갇혔다. 방 안쪽으로 꺼내준다. */
          const away = Math.atan2(-p.x, -p.z)
          L.x = p.x + Math.sin(away) * MIN_GAP
          L.z = p.z + Math.cos(away) * MIN_GAP
          continue
        }
        const push = MIN_GAP - d
        L.x += (dx / d) * push
        L.z += (dz / d) * push
      }
    }

    camera.position.set(L.x, EYE, L.z)
    camera.rotation.set(L.pitch, L.yaw, 0, 'YXZ')

    /* ---- 조준 대상: 앞쪽 원뿔 안에서 가장 가까운 것 ---- */
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw)
    let best = null, bestScore = -1
    const consider = (type, o, id, label) => {
      const dx = o.x - L.x, dz = o.z - L.z
      const d = Math.hypot(dx, dz)
      if (d > REACH || d < 0.0001) return
      const dot = (dx / d) * fx + (dz / d) * fz
      if (dot < 0.55) return                       // 정면에서 크게 벗어나면 무시
      const score = dot - d * 0.08
      if (score > bestScore) { bestScore = score; best = { type, id, label } }
    }
    for (const p of room.props) consider('prop', p, p.id, p.name)
    for (const lk of room.locks) consider('lock', lk, lk.id, lk.label)
    /* 문 */
    const dd = dist2(L.x, L.z, room.door.x, room.door.z)
    if (dd <= REACH + 0.4) {
      const dx = room.door.x - L.x, dz = room.door.z - L.z
      const d = Math.hypot(dx, dz) || 1
      if ((dx / d) * fx + (dz / d) * fz > 0.4 && 0.9 - dd * 0.08 > bestScore) {
        best = { type: 'door', id: -1, label: '문' }
      }
    }
    onAim(best)
  })
  return null
}

/* ==================================================================
   퍼즐 UI
   ================================================================== */
function Keypad({ lock, onSubmit, onClose }) {
  const [buf, setBuf] = useState('')
  const [err, setErr] = useState(false)
  const push = (d) => { if (buf.length < lock.len) { setBuf(buf + d); setErr(false) } }
  const go = () => {
    if (buf.length !== lock.len) return
    if (onSubmit(buf)) return
    setErr(true); setBuf('')
  }
  return (
    <PuzzleShell title={`🔢 ${lock.label}`} onClose={onClose}>
      <div className={`mx-auto mb-4 flex justify-center gap-1.5 ${err ? '[animation:shake_.35s]' : ''}`}>
        {Array.from({ length: lock.len }, (_, i) => (
          <div key={i} className="flex h-14 w-11 items-center justify-center rounded-xl border-2 border-white/15 bg-black/50 font-mono text-2xl font-black text-sky-300">
            {buf[i] || ''}
          </div>
        ))}
      </div>
      {err && <div className="mb-2 text-center text-xs font-bold text-rose-400">틀렸습니다</div>}
      <div className="mx-auto grid w-[15rem] grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => push(String(d))}
            className="rounded-xl border border-white/12 bg-white/5 py-3 text-xl font-black text-white transition hover:bg-white/15 active:scale-95">{d}</button>
        ))}
        <button onClick={() => setBuf(buf.slice(0, -1))}
          className="rounded-xl border border-white/12 bg-white/5 py-3 text-lg font-black text-slate-300 transition hover:bg-white/15">←</button>
        <button onClick={() => push('0')}
          className="rounded-xl border border-white/12 bg-white/5 py-3 text-xl font-black text-white transition hover:bg-white/15 active:scale-95">0</button>
        <button onClick={go}
          className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3 text-lg font-black text-white transition hover:brightness-110">✔</button>
      </div>
    </PuzzleShell>
  )
}

function ColorPad({ lock, onSubmit, onClose }) {
  const [buf, setBuf] = useState([])
  const [err, setErr] = useState(false)
  const press = (key) => {
    const next = [...buf, key]
    setErr(false)
    if (next.length >= lock.len) {
      if (onSubmit(next.join(''))) return
      setErr(true); setBuf([])
      return
    }
    setBuf(next)
  }
  return (
    <PuzzleShell title={`🎨 ${lock.label}`} onClose={onClose}>
      <div className="mb-3 text-center text-[12px] text-slate-400">순서대로 눌러야 합니다 · {buf.length} / {lock.len}</div>
      <div className={`mb-4 flex justify-center gap-1.5 ${err ? '[animation:shake_.35s]' : ''}`}>
        {Array.from({ length: lock.len }, (_, i) => {
          const c = ESC_COLORS.find((x) => x.key === buf[i])
          return <div key={i} className="h-6 w-6 rounded-full border-2 border-white/20"
            style={{ background: c ? c.hex : 'rgba(255,255,255,.06)' }} />
        })}
      </div>
      {err && <div className="mb-2 text-center text-xs font-bold text-rose-400">순서가 틀렸습니다 — 처음부터</div>}
      <div className="flex flex-wrap justify-center gap-3">
        {ESC_COLORS.map((c) => (
          <button key={c.key} onClick={() => press(c.key)}
            style={{ background: c.hex }}
            className="h-16 w-16 rounded-2xl border-2 border-white/25 font-black text-white shadow-lg transition hover:brightness-125 active:scale-90">
            {c.name}
          </button>
        ))}
      </div>
      <button onClick={() => { setBuf([]); setErr(false) }}
        className="mx-auto mt-4 block rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/5">
        처음부터
      </button>
    </PuzzleShell>
  )
}

function SwitchBoard({ lock, onSubmit, onClose }) {
  const [bits, setBits] = useState(() => Array(lock.len).fill(0))
  const [err, setErr] = useState(false)
  const toggle = (i) => {
    const next = bits.slice()
    next[i] = next[i] ? 0 : 1
    setBits(next); setErr(false)
  }
  const go = () => { if (!onSubmit(bits.join(''))) setErr(true) }
  return (
    <PuzzleShell title={`🎚 ${lock.label}`} onClose={onClose}>
      <div className={`mb-5 flex justify-center gap-3 ${err ? '[animation:shake_.35s]' : ''}`}>
        {bits.map((b, i) => (
          <button key={i} onClick={() => toggle(i)}
            className="flex flex-col items-center gap-1.5">
            <div className={`flex h-20 w-11 items-start justify-center rounded-xl border-2 p-1.5 transition ${b
              ? 'border-emerald-400/70 bg-emerald-500/20' : 'border-white/15 bg-black/40'}`}>
              <div className={`h-8 w-7 rounded-md transition-transform duration-150 ${b
                ? 'bg-emerald-400' : 'translate-y-9 bg-slate-500'}`} />
            </div>
            <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>
          </button>
        ))}
      </div>
      {err && <div className="mb-2 text-center text-xs font-bold text-rose-400">아직 맞지 않습니다</div>}
      <button onClick={go}
        className="mx-auto block w-40 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-black text-white transition hover:brightness-110">
        확인
      </button>
    </PuzzleShell>
  )
}

function Dial({ lock, onSubmit, onClose }) {
  const [v, setV] = useState(0)
  const [err, setErr] = useState(false)
  const bump = (n) => { setV((x) => clamp(x + n, 0, lock.max || 999)); setErr(false) }
  return (
    <PuzzleShell title={`🔟 ${lock.label}`} onClose={onClose}>
      <div className={`mx-auto mb-4 w-40 rounded-2xl border-2 border-orange-400/40 bg-black/60 py-4 text-center font-mono text-4xl font-black text-orange-300 ${err ? '[animation:shake_.35s]' : ''}`}>
        {String(v).padStart(3, '0')}
      </div>
      {err && <div className="mb-2 text-center text-xs font-bold text-rose-400">맞지 않습니다</div>}
      <div className="mx-auto grid w-64 grid-cols-4 gap-2">
        {[-100, -10, -1, 0, 100, 10, 1, 0].map((n, i) => (
          n === 0
            ? <div key={i} />
            : <button key={i} onClick={() => bump(n)}
              className="rounded-xl border border-white/12 bg-white/5 py-2.5 text-sm font-black text-white transition hover:bg-white/15 active:scale-95">
              {n > 0 ? `+${n}` : n}
            </button>
        ))}
      </div>
      <button onClick={() => { if (!onSubmit(String(v))) setErr(true) }}
        className="mx-auto mt-4 block w-40 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 font-black text-white transition hover:brightness-110">
        맞추기
      </button>
    </PuzzleShell>
  )
}

/* 시계 — 시침·분침을 돌려 멈춘 시각에 맞춘다 */
function ClockFace({ lock, onSubmit, onClose }) {
  const [h, setH] = useState(12)
  const [mi, setMi] = useState(0)
  const [err, setErr] = useState(false)
  const m = CLOCK_MINUTES[mi]
  const hAng = ((h % 12) / 12) * 360 + (m / 60) * 30      // 시침은 분에 따라 조금씩 움직인다
  const mAng = (m / 60) * 360
  const setHour = (v) => { setH(((v - 1 + 12) % 12) + 1); setErr(false) }   // 1~12 순환
  const setMin = (v) => { setMi((v + CLOCK_MINUTES.length) % CLOCK_MINUTES.length); setErr(false) }
  return (
    <PuzzleShell title={`🕰 ${lock.label}`} onClose={onClose}>
      <div className={`mx-auto mb-4 flex h-44 w-44 items-center justify-center rounded-full border-4 border-amber-300/40 bg-slate-950 ${err ? '[animation:shake_.35s]' : ''}`}>
        <div className="relative h-full w-full">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/60"
              style={{ transform: `rotate(${i * 30}deg) translateY(-72px)` }} />
          ))}
          {/* 시침 */}
          <div className="absolute bottom-1/2 left-1/2 w-[5px] origin-bottom rounded-full bg-amber-200"
            style={{ height: 44, transform: `translateX(-50%) rotate(${hAng}deg)` }} />
          {/* 분침 */}
          <div className="absolute bottom-1/2 left-1/2 w-[3px] origin-bottom rounded-full bg-sky-300"
            style={{ height: 62, transform: `translateX(-50%) rotate(${mAng}deg)` }} />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      </div>
      <div className="mb-3 text-center font-mono text-2xl font-black text-amber-200">
        {h}시 {String(m).padStart(2, '0')}분
      </div>
      {err && <div className="mb-2 text-center text-xs font-bold text-rose-400">시각이 맞지 않습니다</div>}
      <div className="mx-auto grid w-64 grid-cols-2 gap-3">
        <div className="text-center">
          <div className="mb-1 text-[11px] font-bold text-amber-300">시침</div>
          <div className="flex gap-1.5">
            <button onClick={() => setHour(h - 1)}
              className="flex-1 rounded-lg border border-white/12 bg-white/5 py-2 font-black text-white transition hover:bg-white/15">−</button>
            <button onClick={() => setHour(h + 1)}
              className="flex-1 rounded-lg border border-white/12 bg-white/5 py-2 font-black text-white transition hover:bg-white/15">+</button>
          </div>
        </div>
        <div className="text-center">
          <div className="mb-1 text-[11px] font-bold text-sky-300">분침</div>
          <div className="flex gap-1.5">
            <button onClick={() => setMin(mi - 1)}
              className="flex-1 rounded-lg border border-white/12 bg-white/5 py-2 font-black text-white transition hover:bg-white/15">−</button>
            <button onClick={() => setMin(mi + 1)}
              className="flex-1 rounded-lg border border-white/12 bg-white/5 py-2 font-black text-white transition hover:bg-white/15">+</button>
          </div>
        </div>
      </div>
      <button onClick={() => { if (!onSubmit(`${h}:${m}`)) setErr(true) }}
        className="mx-auto mt-4 block w-40 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 font-black text-white transition hover:brightness-110">
        맞추기
      </button>
    </PuzzleShell>
  )
}

function PuzzleShell({ title, children, onClose }) {
  return (
    <div data-ui className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/12 bg-slate-900/97 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-black text-white">{title}</div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ==================================================================
   방 선택 — 난이도 5단계 × 방 3개
   ================================================================== */
const LOCK_KIND_NAME = {
  keypad: '키패드', colorpad: '색 버튼', switchboard: '스위치', dial: '다이얼', clockface: '시계',
}
/* ['keypad','keypad','dial'] → '키패드 ×2 · 다이얼' */
function lockSummary(locks) {
  const n = {}
  locks.forEach((k) => { n[k] = (n[k] || 0) + 1 })
  return Object.entries(n).map(([k, c]) => LOCK_KIND_NAME[k] + (c > 1 ? ` ×${c}` : '')).join(' · ')
}

function DiffSelect({ records, onPick, onExit }) {
  const cleared = ESC_STAGES.filter((s) => records[s.id] != null).length
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0a0910]">
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,.18), transparent 55%)' }} />
      <div className="relative mx-auto min-h-screen max-w-4xl px-5 py-12">
        <div className="text-center">
          <div className="text-[11px] tracking-[0.5em] text-fuchsia-300/70">ESCAPE THE ROOM</div>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">🔓 방탈출</h1>
          <p className="mt-3 text-sm text-slate-400">
            방을 뒤져 단서를 모으고, 잠금장치를 전부 풀면 문이 열립니다
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12px] font-bold text-slate-300">
            탈출한 방 <b className="text-amber-300">{cleared}</b> / {ESC_STAGES.length}
          </div>
        </div>

        <div className="mt-9 space-y-7">
          {ESC_DIFFS.map((d) => (
            <div key={d.id}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="text-xl">{d.icon}</span>
                <span className="text-base font-black" style={{ color: d.color }}>{d.name}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: d.color + '1f', color: d.color }}>잠금 {d.lockCount}개</span>
                <span className="text-[11px] text-slate-500">
                  힌트 {d.hints} · 가짜 단서 {d.decoys}
                  {d.timeLimit > 0 && ` · ⏱ ${fmtTime(d.timeLimit)}`}
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {stagesOfDiff(d.id).map((st) => {
                  const rec = records[st.id]
                  return (
                    <button key={st.id} onClick={() => onPick(st.id)}
                      className="group flex flex-col rounded-2xl border border-white/10 p-4 text-left transition hover:-translate-y-0.5"
                      style={{ background: `linear-gradient(150deg, ${st.theme.accent}1c, rgba(255,255,255,.03))` }}>
                      <div className="flex items-start justify-between">
                        <span className="text-3xl">{st.icon}</span>
                        {rec != null && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">탈출</span>
                        )}
                      </div>
                      <div className="mt-2 text-[15px] font-black text-white">{st.name}</div>
                      <div className="mt-1 min-h-[2.4rem] text-[11px] leading-relaxed text-slate-400">{st.desc}</div>
                      <div className="mt-2 border-t border-white/8 pt-2 text-[10px]" style={{ color: st.theme.accent }}>
                        {lockSummary(st.locks)}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {rec != null ? <>🏆 최고 <b className="text-amber-300">{fmtTime(rec)}</b></> : '미클리어'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={onExit}
          className="mx-auto mt-8 rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5">
          ← 로비
        </button>
      </div>
    </div>
  )
}

/* ==================================================================
   메인
   ================================================================== */
export default function EscapeGame() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [records, setRecords] = useState(() => loadJSON(LS_ESCAPE, {}))
  const [stageId, setStageId] = useState(null)

  const [room, setRoom] = useState(null)
  const roomRef = useRef(null)
  const live = useRef({ x: 0, z: 0, yaw: 0, pitch: 0 })

  const [aim, setAim] = useState(null)
  const aimRef = useRef(null)
  const [modal, setModal] = useState(null)          // {kind:'lock'|'prop', id}
  const [note, setNote] = useState(null)            // 조사 결과 팝업
  const [bag, setBag] = useState([])                // 가진 열쇠
  const [clues, setClues] = useState([])            // 수첩
  const [bookOpen, setBookOpen] = useState(false)
  const [hintsLeft, setHintsLeft] = useState(0)
  const [toast, setToast] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)        // {win, time, isBest}
  const [runOn, setRunOn] = useState(false)         // 모바일 달리기 토글 표시용
  const toastT = useRef(null)

  const flash = useCallback((m) => {
    setToast(m)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(null), 2000)
  }, [])
  useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current) }, [])

  const paused = !!modal || !!result || bookOpen || !!note

  /* ---- 시작 ---- */
  const start = useCallback((id) => {
    const r = buildRoom(id, Date.now() >>> 0)
    roomRef.current = r
    setRoom(r)
    setStageId(id)
    /* 방 남쪽에서 시작해 안쪽(문이 있는 북쪽)을 바라본다 — yaw 0 = -Z.
       소품은 벽에서 1.2m 안쪽에 서므로, 시작하자마자 밀려나지 않도록 넉넉히 띄운다. */
    live.current = { x: 0, z: r.half * 0.55, yaw: 0, pitch: 0 }
    setAim(null); setModal(null); setNote(null); setBookOpen(false)
    setBag([]); setClues([]); setResult(null)
    setHintsLeft(r.hints)
    setElapsed(0)
    TOUCH.clear()
    setRunOn(false)          // TOUCH.clear()가 run도 끄므로 표시도 맞춘다
  }, [])

  /* ---- 타이머 ----
     setState 갱신 함수 안에서 다른 setState를 부르면 안 된다 (순수해야 하고,
     StrictMode는 갱신 함수를 두 번 호출해 검사한다). 시간 초과 판정은 따로 뺀다. */
  useEffect(() => {
    if (!room || result) return
    const iv = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => clearInterval(iv)
  }, [room, result])

  useEffect(() => {
    if (!room || result) return
    if (room.timeLimit > 0 && elapsed >= room.timeLimit) setResult({ win: false, time: elapsed })
  }, [room, result, elapsed])

  /* ---- 조준 대상 (프레임마다 들어오므로 바뀔 때만 리렌더) ---- */
  const onAim = useCallback((a) => {
    const prev = aimRef.current
    const same = (!a && !prev) || (a && prev && a.type === prev.type && a.id === prev.id)
    if (same) return
    aimRef.current = a
    setAim(a)
  }, [])

  /* ---- 조사 / 상호작용 ---- */
  const interact = useCallback(() => {
    const a = aimRef.current
    const r = roomRef.current
    if (!a || !r || paused) return

    if (a.type === 'lock') {
      const lk = r.locks.find((l) => l.id === a.id)
      if (!lk) return
      if (lk.solved) { flash('✅ 이미 해제된 장치입니다'); return }
      setModal({ kind: 'lock', id: lk.id })
      return
    }

    if (a.type === 'door') {
      if (allSolved(r)) {
        /* 신기록 여부는 여기서 확정해 결과에 담는다.
           나중에 records와 비교하면 "같은 기록"일 때도 신기록으로 보인다. */
        const best = loadJSON(LS_ESCAPE, {})
        const isBest = best[r.stageId] == null || elapsed < best[r.stageId]
        if (isBest) {
          best[r.stageId] = elapsed
          saveJSON(LS_ESCAPE, best)
          setRecords({ ...best })
        }
        setResult({ win: true, time: elapsed, isBest })
      } else {
        const { solved, total } = roomProgress(r)
        flash(`🔒 잠겨 있습니다 — 잠금장치 ${solved}/${total} 해제됨`)
      }
      return
    }

    /* 소품 조사 */
    const p = r.props.find((x) => x.id === a.id)
    if (!p) return
    if (p.locked && !bag.some((k) => k.id === p.needKey)) {
      flash(`🔒 ${p.name}이(가) 잠겨 있습니다 — 열쇠가 필요합니다`)
      return
    }
    const lines = []
    if (p.locked) {
      p.locked = false
      lines.push(`🔑 열쇠로 ${p.name}을(를) 열었다.`)
    }
    if (p.item) {
      const it = p.item
      p.item = null
      setBag((b) => (b.some((k) => k.id === it.id) ? b : [...b, it]))
      lines.push(`🔑 ${it.name}을(를) 손에 넣었다!`)
    }
    if (p.clue) {
      lines.push(`📝 ${p.clue}`)
      setClues((cs) => (cs.some((c) => c.propId === p.id)
        ? cs
        : [...cs, { propId: p.id, text: p.clue, lockId: p.lockId, from: p.name }]))
    }
    if (!lines.length) lines.push('아무것도 없다.')
    p.searched = true
    setNote({ title: p.name, lines })
  }, [paused, bag, elapsed, flash])

  /* ---- 잠금 해제 시도 ---- */
  const submitLock = useCallback((lockId, input) => {
    const r = roomRef.current
    const lk = r.locks.find((l) => l.id === lockId)
    if (!lk) return false
    if (!checkLock(lk, input)) return false
    lk.solved = true
    setModal(null)
    setRoom({ ...r })
    const { solved, total } = roomProgress(r)
    flash(solved >= total ? '🎉 모든 잠금 해제! 문으로 가세요' : `✅ 해제! (${solved}/${total})`)
    return true
  }, [flash])

  /* ---- 힌트 ---- */
  const giveHint = useCallback(() => {
    const r = roomRef.current
    if (!r || hintsLeft <= 0) return
    /* 아직 안 읽은 "진짜" 단서가 있는 소품을 하나 알려준다 */
    const unread = r.props.filter((p) => p.clue && p.lockId != null && !clues.some((c) => c.propId === p.id))
    if (!unread.length) {
      const unsolved = r.locks.find((l) => !l.solved)
      flash(unsolved ? `💡 단서는 다 모았습니다 — ${unsolved.label}를 다시 보세요` : '💡 문으로 가세요!')
      return
    }
    /* 가장 가까운 것부터 알려준다 (헤매게 만들면 힌트가 아니다) */
    const L = live.current
    const t = unread.reduce((a, b) =>
      (dist2(L.x, L.z, b.x, b.z) < dist2(L.x, L.z, a.x, a.z) ? b : a))
    /* 방향은 "지금 보고 있는 쪽" 기준으로 말해야 한다.
       예전에는 -Z를 본다고 가정해 엉뚱한 방향을 알려줬다. */
    const rel = Math.atan2(t.x - L.x, t.z - L.z) - (L.yaw + Math.PI)
    const a = Math.atan2(Math.sin(rel), Math.cos(rel))       // -π..π 로 정규화
    const dir = Math.abs(a) < Math.PI / 4 ? '앞쪽'
      : Math.abs(a) > (Math.PI * 3) / 4 ? '뒤쪽'
        : a > 0 ? '왼쪽' : '오른쪽'      /* atan2(x,z)는 +X쪽이 음수가 된다 */
    setHintsLeft((h) => h - 1)
    flash(`💡 ${dir}의 [${t.name}]을(를) 조사해 보세요`)
  }, [hintsLeft, clues, flash])

  /* ---- 키보드 ---- */
  useEffect(() => {
    if (!room) return
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); if (note) setNote(null); else interact() }
      else if (e.code === 'Tab' && !e.repeat) { e.preventDefault(); setBookOpen((v) => !v) }
      else if (e.code === 'KeyH' && !e.repeat) giveHint()
      else if (e.code === 'Escape') { setModal(null); setNote(null); setBookOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, interact, giveHint, note])

  /* ---- 시점 드래그 ---- */
  useEffect(() => {
    if (!room) return
    const drag = { id: null, x: 0, y: 0 }
    const down = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return
      drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY
    }
    const move = (e) => {
      if (drag.id !== e.pointerId) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.x = e.clientX; drag.y = e.clientY
      live.current.yaw -= dx * LOOK_SENS
      live.current.pitch = clamp(live.current.pitch - dy * LOOK_SENS, -1.2, 1.2)
    }
    const up = (e) => { if (drag.id === e.pointerId) drag.id = null }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [room])

  const escSetVec = useCallback((x, y) => { TOUCH.mx = x; TOUCH.my = y }, [])
  /* TOUCH.run은 ref라 바꿔도 다시 그려지지 않는다 — 버튼 색을 위해 state로 따라간다 */
  const toggleRun = useCallback(() => {
    TOUCH.run = !TOUCH.run
    setRunOn(TOUCH.run)
    flash(TOUCH.run ? '🏃 달리기 ON' : '🚶 달리기 OFF')
  }, [flash])


  /* ---------------- 화면 ---------------- */
  if (!room || stageId == null) {
    return <DiffSelect records={records} onPick={start} onExit={() => navigate('/')} />
  }

  const diff = ESC_DIFF_BY_ID[room.diffId]
  const stage = ESC_STAGE_BY_ID[room.stageId]
  const prog = roomProgress(room)
  const opened = allSolved(room)
  const remain = room.timeLimit > 0 ? Math.max(0, room.timeLimit - elapsed) : null
  const activeLock = modal && modal.kind === 'lock' ? room.locks.find((l) => l.id === modal.id) : null

  return (
    <div className="fixed inset-0 select-none bg-black">
      <Canvas shadows camera={{ fov: 72, near: 0.05, far: 120 }}>
        <RoomShell half={room.half} open={opened} theme={room.theme} />
        {room.props.map((p) => (
          <PropObj key={p.id} prop={p} aimed={!!aim && aim.type === 'prop' && aim.id === p.id} />
        ))}
        {room.locks.map((lk) => (
          <LockPanel key={lk.id} lock={lk} aimed={!!aim && aim.type === 'lock' && aim.id === lk.id} />
        ))}
        <FpsController live={live} roomRef={roomRef} onAim={onAim} paused={paused} />
      </Canvas>

      {/* ── 상단 HUD ── */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-2xl border border-white/12 bg-black/60 px-5 py-2 text-center backdrop-blur-sm">
        <div className="text-[13px] font-black text-white">{stage.icon} {stage.name}</div>
        <div className="text-[10px] tracking-[0.25em]" style={{ color: diff.color }}>
          {diff.icon} {diff.name}
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-3">
          <span className={`font-mono text-xl font-black ${remain != null && remain < 60 ? 'text-rose-400' : 'text-white'}`}>
            {remain != null ? fmtTime(remain) : fmtTime(elapsed)}
          </span>
          <span className="text-sm font-black text-emerald-300">🔓 {prog.solved}/{prog.total}</span>
        </div>
        <div className="mt-1 flex justify-center gap-1">
          {room.locks.map((l) => (
            <span key={l.id} className={`h-1.5 w-6 rounded-full ${l.solved ? 'bg-emerald-400' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>

      {/* ── 조준점 + 대상 이름 ── */}
      {!paused && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className={`mx-auto h-1.5 w-1.5 rounded-full ${aim ? 'bg-amber-300' : 'bg-white/45'}`} />
          {aim && (
            <div className="mt-3 whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[12px] font-bold text-white">
              {aim.label}
              <span className="ml-1.5 text-[10px] text-amber-300">{isMobile ? '조사 버튼' : 'E'}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 좌하단: 소지품 ── */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-30 max-w-[46vw]">
        {bag.length > 0 && (
          <div className="rounded-xl border border-amber-400/25 bg-black/55 px-3 py-2 backdrop-blur-sm">
            <div className="text-[10px] font-bold text-amber-300/80">소지품</div>
            <div className="mt-0.5 text-[12px] font-bold text-white">
              {bag.map((k) => `🔑 ${k.name}`).join(' · ')}
            </div>
          </div>
        )}
        {!isMobile && (
          <div className="mt-2 rounded-xl bg-black/45 px-3 py-2 text-[10px] leading-relaxed text-white/70">
            <b>WASD</b> 이동 · <b>Shift</b> 달리기 · <b>드래그</b> 시점<br />
            <b>E</b> 조사 · <b>Tab</b> 수첩 · <b>H</b> 힌트
          </div>
        )}
      </div>

      {/* ── 우상단 버튼 ── */}
      <div data-ui className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
        <button onClick={() => setBookOpen(true)}
          className="rounded-full border border-white/15 bg-slate-900/85 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-slate-800">
          📓 수첩 <span className="rounded-full bg-white/10 px-1.5 text-[10px]">{clues.length}</span>
        </button>
        <button onClick={giveHint} disabled={hintsLeft <= 0}
          className="rounded-full border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-200 backdrop-blur-sm transition hover:bg-amber-500/25 disabled:opacity-35">
          💡 힌트 {hintsLeft}
        </button>
        <button onClick={() => { setStageId(null); setRoom(null); roomRef.current = null }}
          className="rounded-full border border-white/15 bg-slate-900/85 px-4 py-2 text-xs font-bold text-slate-300 backdrop-blur-sm transition hover:bg-slate-800">
          ← 난이도 선택
        </button>
      </div>

      {/* ── 모바일 조작 ── */}
      {isMobile && !paused && (
        <>
          <div className="absolute bottom-6 left-5 z-40">
            <VirtualJoystick size={120} onVec={escSetVec} />
          </div>
          <div className="absolute bottom-7 right-5 z-40 flex flex-col items-center gap-3">
            <TouchBtn label="🏃" sub="달리기" size={52} textSize="text-base"
              bg={runOn ? 'rgba(52,211,153,.4)' : undefined}
              border={runOn ? 'rgba(52,211,153,.85)' : undefined}
              onPress={toggleRun} />
            <TouchBtn label="🔍" sub="조사" size={86} textSize="text-2xl"
              bg="rgba(251,191,36,.3)" border="rgba(251,191,36,.75)"
              disabled={!aim}
              onPress={interact} />
          </div>
        </>
      )}

      {/* ── 조사 결과 ── */}
      {note && (
        <div data-ui className="absolute inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setNote(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-white/12 bg-slate-900/97 p-6 shadow-2xl [animation:pop_.2s_ease-out]">
            <div className="text-sm font-black text-amber-300">🔍 {note.title}</div>
            <div className="mt-3 space-y-2">
              {note.lines.map((l, i) => (
                <div key={i} className="rounded-xl bg-white/5 px-3 py-2.5 text-[13px] leading-relaxed text-slate-200">{l}</div>
              ))}
            </div>
            <button onClick={() => setNote(null)}
              className="mt-5 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 수첩 ── */}
      {bookOpen && (
        <div data-ui className="absolute inset-0 z-[68] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setBookOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-white/12 bg-slate-900/97 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-white">📓 수첩</div>
              <button onClick={() => setBookOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
            </div>
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
              {clues.length === 0 && (
                <div className="rounded-xl bg-white/5 px-4 py-6 text-center text-[13px] text-slate-500">
                  아직 찾은 단서가 없습니다.<br />방 안의 물건을 조사해 보세요.
                </div>
              )}
              {room.locks.map((lk) => {
                const mine = clues.filter((c) => c.lockId === lk.id)
                if (!mine.length) return null
                return (
                  <div key={lk.id}>
                    <div className="mb-1.5 flex items-center gap-2 text-[12px] font-black"
                      style={{ color: LOCK_TINT[lk.kind] }}>
                      {lk.label}
                      {lk.solved && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">해제됨</span>}
                    </div>
                    <div className="space-y-1">
                      {mine.map((c) => (
                        <div key={c.propId} className="rounded-lg bg-white/5 px-3 py-2 text-[12px] text-slate-200">
                          {c.text}
                          <span className="ml-2 text-[10px] text-slate-500">({c.from})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {clues.some((c) => c.lockId == null) && (
                <div>
                  <div className="mb-1.5 text-[12px] font-black text-slate-500">분류 불가</div>
                  <div className="space-y-1">
                    {clues.filter((c) => c.lockId == null).map((c) => (
                      <div key={c.propId} className="rounded-lg bg-white/[.03] px-3 py-2 text-[12px] text-slate-400">
                        {c.text}
                        <span className="ml-2 text-[10px] text-slate-600">({c.from})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 잠금장치 ── */}
      {activeLock && activeLock.kind === 'keypad' && (
        <Keypad lock={activeLock} onClose={() => setModal(null)}
          onSubmit={(v) => submitLock(activeLock.id, v)} />
      )}
      {activeLock && activeLock.kind === 'colorpad' && (
        <ColorPad lock={activeLock} onClose={() => setModal(null)}
          onSubmit={(v) => submitLock(activeLock.id, v)} />
      )}
      {activeLock && activeLock.kind === 'switchboard' && (
        <SwitchBoard lock={activeLock} onClose={() => setModal(null)}
          onSubmit={(v) => submitLock(activeLock.id, v)} />
      )}
      {activeLock && activeLock.kind === 'dial' && (
        <Dial lock={activeLock} onClose={() => setModal(null)}
          onSubmit={(v) => submitLock(activeLock.id, v)} />
      )}
      {activeLock && activeLock.kind === 'clockface' && (
        <ClockFace lock={activeLock} onClose={() => setModal(null)}
          onSubmit={(v) => submitLock(activeLock.id, v)} />
      )}

      {/* ── 토스트 ── */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-[60] -translate-x-1/2 rounded-full border border-white/20 bg-black/80 px-5 py-2.5 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* ── 결과 ── */}
      {result && (
        <div data-ui className="absolute inset-0 z-[75] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-[22rem] rounded-3xl border p-7 text-center shadow-2xl [animation:pop_.4s_cubic-bezier(.2,1.6,.4,1)]"
            style={{ borderColor: result.win ? 'rgba(74,222,128,.5)' : 'rgba(244,63,94,.5)', background: '#0f172a' }}>
            <div className="text-6xl">{result.win ? '🎉' : '⏰'}</div>
            <div className={`mt-3 text-2xl font-black ${result.win ? 'text-emerald-300' : 'text-rose-300'}`}>
              {result.win ? '탈출 성공!' : '시간 초과'}
            </div>
            <div className="mt-1 text-sm font-bold text-white">{stage.icon} {stage.name}</div>
            <div className="text-xs text-slate-400">{diff.icon} {diff.name}</div>
            {result.win && (
              <>
                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="text-[10px] text-slate-400">걸린 시간</div>
                  <div className="font-mono text-3xl font-black text-amber-300">{fmtTime(result.time)}</div>
                </div>
                {result.isBest && (
                  <div className="mt-2 text-xs font-bold text-emerald-300">✨ 신기록!</div>
                )}
              </>
            )}
            <button onClick={() => start(room.stageId)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 font-black text-white transition hover:brightness-110">
              🔄 다시 도전 (새 방)
            </button>
            <button onClick={() => { setStageId(null); setRoom(null); roomRef.current = null }}
              className="mt-2 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">
              난이도 선택
            </button>
            <button onClick={() => navigate('/')}
              className="mt-2 w-full rounded-xl py-2 text-xs font-bold text-slate-400 transition hover:text-white">
              ← 로비로
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pop { from { transform: scale(.88); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-7px)} 75%{transform:translateX(7px)} }
      `}</style>
    </div>
  )
}
