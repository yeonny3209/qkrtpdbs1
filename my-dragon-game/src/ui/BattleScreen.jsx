/* ==================================================================
   전투 화면 — 3D 드래곤 + 턴제 조작

   기획서 10.2: 좌측 내 드래곤 / 우측 상대 / 하단 스킬 버튼
   좁은 화면(모바일)에서는 위아래로 접힌다.
   ================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import DragonModel from '../three/DragonModel.jsx'
import { ELEMENT_BY_ID } from '../game/elements.js'
import { RARITY_BY_ID } from '../game/dragons.js'
import { skillsOf, MP_MAX, STATUS } from '../game/skills.js'
import {
  createBattle, castSkill, enemyAction, currentUnit,
  canUse, needsPick, targetsFor, flee,
} from '../game/battle.js'

/* 유닛 하나를 3D로 세운다 */
function BattleDragon({ unit, flip, aimed }) {
  const g = useRef()
  const t0 = useRef(Math.random() * 10)
  useFrame((state) => {
    if (!g.current) return
    const t = state.clock.elapsedTime + t0.current
    g.current.position.y = Math.sin(t * 1.4) * 0.05
    /* 쓰러지면 옆으로 눕는다 */
    g.current.rotation.z = unit.alive ? 0 : (flip ? -1.2 : 1.2)
    g.current.rotation.y = (flip ? Math.PI : 0) + (aimed ? Math.sin(t * 6) * 0.05 : 0)
  })
  return (
    <group ref={g} position={[0, -1.35, 0]} scale={0.92}>
      <DragonModel elementId={unit.dragon.element} rarity={unit.dragon.rarity} animate={unit.alive} />
    </group>
  )
}

function UnitStage({ unit, flip, aimed }) {
  const el = ELEMENT_BY_ID[unit.dragon.element]
  return (
    <Canvas camera={{ fov: 42, position: [0, 0.3, 7.2] }} gl={{ alpha: true }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <pointLight position={[0, 2, 4]} intensity={7} distance={14} color={el.glow} />
      <BattleDragon unit={unit} flip={flip} aimed={aimed} />
    </Canvas>
  )
}

/* HP/MP 바 + 상태이상 */
function UnitBar({ unit, compact, onClick, selectable, isTurn }) {
  const el = ELEMENT_BY_ID[unit.dragon.element]
  const rar = RARITY_BY_ID[unit.dragon.rarity]
  const hpPct = Math.max(0, (unit.hp / unit.maxHp) * 100)
  return (
    <button
      onClick={onClick}
      disabled={!selectable}
      className={`w-full rounded-xl border px-2.5 py-1.5 text-left transition ${
        isTurn ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-black/40'
      } ${selectable ? 'cursor-pointer hover:bg-white/10' : ''} ${unit.alive ? '' : 'opacity-35 grayscale'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{el.icon}</span>
        <span className="truncate text-[11px] font-black text-white">{unit.dragon.name}</span>
        <span className="ml-auto shrink-0 text-[9px]" style={{ color: rar.color }}>Lv.{unit.level}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${hpPct}%`, background: hpPct > 50 ? '#4ade80' : hpPct > 22 ? '#facc15' : '#f87171' }} />
      </div>
      {!compact && (
        <>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${(unit.mp / MP_MAX) * 100}%` }} />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-400">
            <span>{unit.hp} / {unit.maxHp}</span>
            <span className="flex gap-0.5">
              {unit.statuses.map((s, i) => (
                <span key={i} title={STATUS[s.key]?.name}>{STATUS[s.key]?.icon}</span>
              ))}
            </span>
          </div>
        </>
      )}
    </button>
  )
}

export default function BattleScreen({ stage, allies, enemies, difficulty, maxRounds, onFinish, onQuit }) {
  const [st, setSt] = useState(() => createBattle({ allies, enemies, seed: Date.now() >>> 0, maxRounds }))
  const [pending, setPending] = useState(null)     // 대상 지정을 기다리는 스킬
  const [flash, setFlash] = useState(null)
  const bump = useCallback(() => setSt((s) => ({ ...s })), [])

  const actor = currentUnit(st)
  const myTurn = !!actor && actor.side === 'ally' && !st.done
  const allyUnits = st.units.filter((u) => u.side === 'ally')
  const foeUnits = st.units.filter((u) => u.side === 'enemy')
  const skills = useMemo(() => (actor ? skillsOf(actor.dragon) : []), [actor])

  /* 적 차례는 자동으로 진행 */
  useEffect(() => {
    if (st.done) return
    const cur = currentUnit(st)
    if (!cur || cur.side !== 'enemy') return
    const id = setTimeout(() => { enemyAction(st); bump() }, 620)
    return () => clearTimeout(id)
  }, [st, bump])

  /* 최근 로그 한 줄을 화면에 띄운다 */
  useEffect(() => {
    const last = st.log[st.log.length - 1]
    if (!last || !last.text) return
    setFlash(last.text)
    const id = setTimeout(() => setFlash(null), 1100)
    return () => clearTimeout(id)
  }, [st.log.length, st.log])

  const act = (skill, targetUid) => {
    if (!myTurn || !canUse(actor, skill)) return
    castSkill(st, skill.id, targetUid)
    setPending(null)
    bump()
  }

  const onSkill = (skill) => {
    if (!needsPick(skill)) { act(skill, null); return }
    const opts = targetsFor(st, actor, skill)
    if (opts.length <= 1) { act(skill, opts[0]?.uid); return }
    setPending(skill)     // 대상을 고르게 한다
  }

  const focusEl = ELEMENT_BY_ID[(actor || allyUnits[0]).dragon.element]

  return (
    <div className="fixed inset-0 flex flex-col bg-[#07070e]">
      <div className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 10%, ${focusEl.deep}, transparent 65%)` }} />

      {/* 상단 — 스테이지 정보 */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2">
        <div>
          <div className="text-[10px] tracking-widest text-slate-400">{difficulty.name} · {st.round}라운드</div>
          <div className="text-sm font-black text-white">{stage.name}</div>
        </div>
        <button onClick={onQuit} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10">
          나가기
        </button>
      </div>

      {/* 적 진영 */}
      <div className="relative z-10 flex gap-2 px-3">
        {foeUnits.map((u) => (
          <div key={u.uid} className="flex-1">
            <UnitBar unit={u} compact
              isTurn={actor && actor.uid === u.uid}
              selectable={!!pending && u.alive && targetsFor(st, actor, pending).some((t) => t.uid === u.uid)}
              onClick={() => act(pending, u.uid)} />
          </div>
        ))}
      </div>

      {/* 3D 무대 */}
      <div className="relative z-0 flex flex-1 items-center">
        <div className="h-full flex-1">
          {foeUnits.filter((u) => u.alive).slice(0, 1).map((u) => (
            <UnitStage key={u.uid} unit={u} flip aimed={!!pending} />
          ))}
        </div>
        <div className="h-full flex-1">
          {allyUnits.filter((u) => u.alive).slice(0, 1).map((u) => (
            <UnitStage key={u.uid} unit={u} />
          ))}
        </div>
      </div>

      {/* 로그 */}
      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-black/80 px-5 py-2 text-sm font-bold text-white">
          {flash}
        </div>
      )}

      {/* 아군 진영 */}
      <div className="relative z-10 flex gap-2 px-3">
        {allyUnits.map((u) => (
          <div key={u.uid} className="flex-1">
            <UnitBar unit={u}
              isTurn={actor && actor.uid === u.uid}
              selectable={!!pending && u.alive && targetsFor(st, actor, pending).some((t) => t.uid === u.uid)}
              onClick={() => act(pending, u.uid)} />
          </div>
        ))}
      </div>

      {/* 스킬 */}
      <div className="relative z-10 px-3 pb-3 pt-2">
        {pending && (
          <div className="mb-2 rounded-xl bg-amber-400/15 px-3 py-1.5 text-center text-[12px] font-bold text-amber-200">
            [{pending.name}] 대상을 고르세요
            <button onClick={() => setPending(null)} className="ml-2 text-slate-300 underline">취소</button>
          </div>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {skills.map((sk) => {
            const usable = myTurn && canUse(actor, sk)
            const cd = actor ? (actor.cds[sk.id] || 0) : 0
            const isUlt = sk.mp >= MP_MAX
            return (
              <button key={sk.id} onClick={() => onSkill(sk)} disabled={!usable}
                title={sk.desc}
                className={`relative overflow-hidden rounded-xl border py-2 text-center transition ${
                  usable
                    ? isUlt
                      ? 'border-amber-300/70 bg-gradient-to-b from-amber-500/30 to-orange-500/20 hover:brightness-125'
                      : 'border-white/15 bg-white/[.07] hover:bg-white/[.14]'
                    : 'cursor-not-allowed border-white/5 bg-white/[.02] opacity-45'
                }`}>
                <div className="text-base leading-none">{sk.icon}</div>
                <div className="mt-0.5 truncate px-1 text-[10px] font-bold text-white">{sk.name}</div>
                <div className="text-[9px] text-sky-300">{sk.mp > 0 ? `MP ${sk.mp}` : '기본'}</div>
                {cd > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/65 text-lg font-black text-white">{cd}</div>
                )}
              </button>
            )
          })}
        </div>
        <button onClick={() => { flee(st); bump() }} disabled={!myTurn}
          className="mt-1.5 w-full rounded-xl border border-white/10 py-1.5 text-[11px] font-bold text-slate-400 transition hover:bg-white/5 disabled:opacity-40">
          도주
        </button>
      </div>

      {/* 결과 */}
      {st.done && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-6">
          <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-slate-900 p-6 text-center">
            <div className="text-5xl">{st.done === 'win' ? '🏆' : st.done === 'lose' ? '💀' : '🏳️'}</div>
            <div className={`mt-2 text-2xl font-black ${st.done === 'win' ? 'text-amber-300' : 'text-slate-300'}`}>
              {st.done === 'win' ? '승리!' : st.done === 'lose' ? '패배…' : st.done === 'flee' ? '도주했다' : '무승부'}
            </div>
            <div className="mt-1 text-[12px] text-slate-500">{st.round}라운드 만에 결판</div>
            <button onClick={() => onFinish(st.done)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 font-black text-white transition hover:brightness-110">
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
