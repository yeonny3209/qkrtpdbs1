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
import { skillsOf, STATUS, isUlt, passiveDesc } from '../game/skills.js'
import {
  createBattle, castSkill, enemyAction, currentUnit,
  canUse, lockReason, needsPick, targetsFor, flee,
} from '../game/battle.js'
import { readAction, roleOf, shakeStrength, popsFor } from '../game/fx.js'
import {
  attackPose, hurtPose, dodgePose, progress, attackElapsed, trailPoses, chargeGlow,
  ATTACK_MS, ATTACK_TOTAL_MS, HURT_MS, IMPACT_AT, HITSTOP_MS, shakeAmount,
} from '../three/attackPose.js'

/* 유닛 하나를 3D로 세운다.
   role 은 이번 행동에서 이 유닛이 맡은 역할 — 공격/피격/회피.
   startedAt 은 그 행동이 시작된 시각이라, 프레임마다 진행도를 다시 센다. */
function BattleDragon({ unit, flip, aimed, role, startedAt, ult }) {
  const g = useRef()
  const trail = useRef([])          // 잔상 세 겹
  const glow = useRef()             // 힘을 모을 때 부푸는 구
  const t0 = useRef(Math.random() * 10)
  /* 오른쪽(아군)은 왼쪽으로, 왼쪽(적)은 오른쪽으로 달려든다 */
  const dir = flip ? 1 : -1
  const el = ELEMENT_BY_ID[unit.dragon.element] || ELEMENT_BY_ID.fire

  useFrame((state) => {
    if (!g.current) return
    const t = state.clock.elapsedTime + t0.current
    const idleY = Math.sin(t * 1.4) * 0.05

    let pose = null
    let p = 0
    if (role && startedAt) {
      const raw = performance.now() - startedAt
      if (role === 'attack') {
        /* 히트스톱 — 꽂히는 순간 잠깐 멈춘다 */
        p = progress(attackElapsed(raw), ATTACK_MS)
        if (p < 1) pose = attackPose(p)
      } else {
        p = progress(raw, HURT_MS)
        if (p < 1) pose = role === 'hurt' ? hurtPose(p) : role === 'dodge' ? dodgePose(p) : null
      }
    }

    const rest = unit.alive ? 0 : (flip ? -1.2 : 1.2)
    if (pose) {
      g.current.position.x = dir * pose.push + (pose.shake || 0)
      g.current.position.y = idleY + pose.lift
      g.current.rotation.z = rest + dir * pose.tilt
      const s = 0.92 * (pose.scale ?? 1)
      g.current.scale.set(s, s, s)
    } else {
      g.current.position.x = 0
      g.current.position.y = idleY
      g.current.rotation.z = rest
      g.current.scale.set(0.92, 0.92, 0.92)
    }
    g.current.rotation.y = (flip ? Math.PI : 0) + (aimed ? Math.sin(t * 6) * 0.05 : 0)

    /* 잔상 — 찌르는 구간에서만 뒤따라 붙는다 */
    const ghosts = role === 'attack' && pose ? trailPoses(p) : []
    trail.current.forEach((m, i) => {
      if (!m) return
      const gh = ghosts[i]
      m.visible = !!gh
      if (!gh) return
      m.position.set(dir * gh.push, idleY + gh.lift, 0)
      m.rotation.z = rest + dir * gh.tilt
      const s = 0.92 * (gh.scale ?? 1)
      m.scale.set(s, s, s)
      if (m.material) m.material.opacity = gh.opacity
    })

    /* 힘을 모으는 빛 — 궁극기에서만 크게 부푼다 */
    if (glow.current) {
      const c = role === 'attack' ? chargeGlow(p) : 0
      const k = c * (ult ? 1 : 0.45)
      glow.current.visible = k > 0.01
      glow.current.scale.setScalar(0.4 + k * 2.4)
      if (glow.current.material) glow.current.material.opacity = 0.55 * k
    }
  })

  return (
    <group position={[0, -1.35, 0]}>
      {/* 잔상 — 본체보다 먼저 그려 뒤에 깔리게 한다 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { trail.current[i] = m }} visible={false}>
          <sphereGeometry args={[0.62, 12, 10]} />
          <meshBasicMaterial color={el.glow} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {/* 힘을 모으는 구 */}
      <mesh ref={glow} position={[0, 1.15, 0]} visible={false}>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshBasicMaterial color={el.glow} transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={g} scale={0.92}>
        <DragonModel
          elementId={unit.dragon.element} rarity={unit.dragon.rarity} dragonId={unit.dragon.id}
          animate={unit.alive}
          /* 공격 중엔 날개를 펼치고 고개를 든다 — 기존 포효 자세를 재사용한다 */
          roar={role === 'attack'} />
      </group>
    </group>
  )
}

function UnitStage({ unit, flip, aimed, role, startedAt, ult }) {
  const el = ELEMENT_BY_ID[unit.dragon.element]
  return (
    <Canvas camera={{ fov: 42, position: [0, 0.3, 7.2] }} gl={{ alpha: true }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <pointLight position={[0, 2, 4]} intensity={7} distance={14} color={el.glow} />
      <BattleDragon unit={unit} flip={flip} aimed={aimed} role={role} startedAt={startedAt} ult={ult} />
    </Canvas>
  )
}

/* 타격 순간의 이펙트 — 3D 두 무대가 서로 다른 캔버스라
   그 사이를 가로지르는 연출은 DOM 으로 얹는다. */
function ImpactBurst({ color, ult, crit }) {
  const big = ult || crit
  /* 사방으로 튀는 불티 — 각도만 정해두고 CSS 변수로 넘긴다 */
  const sparks = ult ? 14 : 9
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {/* 중심 폭발 */}
      <div className="dm-burst rounded-full"
        style={{
          width: ult ? 300 : big ? 200 : 150, height: ult ? 300 : big ? 200 : 150,
          background: `radial-gradient(circle, #fff 0%, ${color}dd 26%, ${color}44 52%, transparent 74%)`,
        }} />
      {/* 퍼져나가는 충격파 고리 — 두 겹이 시차를 두고 나간다 */}
      {[0, 1].map((i) => (
        <div key={i} className="dm-ring absolute rounded-full"
          style={{
            width: ult ? 150 : 100, height: ult ? 150 : 100,
            border: `${ult ? 4 : 3}px solid ${color}`,
            animationDelay: `${i * 110}ms`,
            boxShadow: `0 0 22px ${color}`,
          }} />
      ))}
      {/* 베인 자국 — 엇갈리게 두 줄 */}
      <div className="dm-slash absolute" style={{ background: color, boxShadow: `0 0 18px ${color}` }} />
      {big && (
        <div className="dm-slash dm-slash-b absolute"
          style={{ background: '#fff', boxShadow: `0 0 22px ${color}` }} />
      )}
      {/* 불티 */}
      {Array.from({ length: sparks }, (_, i) => {
        const ang = (360 / sparks) * i + (i % 2 ? 12 : 0)
        return (
          <span key={i} className="dm-spark absolute"
            style={{
              '--ang': `${ang}deg`,
              '--dist': `${(ult ? 150 : 100) + (i % 3) * 22}px`,
              background: color,
              animationDelay: `${(i % 4) * 35}ms`,
              boxShadow: `0 0 10px ${color}`,
            }} />
        )
      })}
    </div>
  )
}

/* 궁극기 컷인 — 스킬 이름이 화면을 가로지른다 */
function UltCutIn({ name, icon, color }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      <div className="dm-cutin-bar absolute h-24 w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${color}55 20%, ${color}88 50%, ${color}55 80%, transparent)` }} />
      <div className="dm-cutin-text flex items-center gap-3">
        <span className="text-4xl">{icon}</span>
        <span className="text-3xl font-black tracking-tight text-white"
          style={{ textShadow: `0 0 18px ${color}, 0 3px 10px rgba(0,0,0,.9)` }}>
          {name}
        </span>
      </div>
    </div>
  )
}

/* 피해·회복 숫자 */
function Pops({ pops }) {
  if (!pops.length) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[28%] z-20 flex flex-col items-center gap-1">
      {pops.map((p, i) => (
        <span key={i}
          className={`dm-pop font-black tabular-nums ${
            p.miss ? 'text-slate-300 text-xl'
              : p.heal ? 'text-emerald-300 text-2xl'
                : p.dot ? 'text-orange-300 text-lg'
                  : p.reflect ? 'text-rose-300 text-xl'
                    : p.crit ? 'dm-pop-crit text-amber-300 text-5xl' : 'text-white text-3xl'
          }`}
          style={{ animationDelay: `${i * 90}ms`, textShadow: '0 2px 10px rgba(0,0,0,.95)' }}>
          {p.crit && !p.miss ? '치명! ' : ''}{p.dot ? '🔥' : ''}{p.reflect ? '↩' : ''}{p.text}
        </span>
      ))}
    </div>
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
        <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-400">
          <span>{unit.hp} / {unit.maxHp}</span>
          <span className="flex gap-0.5">
            {unit.passive && <span title={`${unit.passive.name} — ${passiveDesc(unit.passive)}`}>{unit.passive.icon}</span>}
            {unit.statuses.map((s, i) => (
              <span key={i} title={STATUS[s.key]?.name}>{STATUS[s.key]?.icon}</span>
            ))}
          </span>
        </div>
      )}
    </button>
  )
}

export default function BattleScreen({ stage, allies, enemies, difficulty, maxRounds, onFinish }) {
  const [st, setSt] = useState(() => createBattle({ allies, enemies, seed: Date.now() >>> 0, maxRounds }))
  const [pending, setPending] = useState(null)     // 대상 지정을 기다리는 스킬
  const [flash, setFlash] = useState(null)
  const [fx, setFx] = useState(null)               // { action, at } — 지금 재생 중인 연출
  const [impact, setImpact] = useState(false)      // 타격이 꽂힌 순간인가
  const bump = useCallback(() => setSt((s) => ({ ...s })), [])

  /* 한 번의 행동을 실행하고, 로그 차이를 읽어 연출을 건다.
     엔진은 즉시 계산하고 로그만 남기므로, 화면은 그 로그로 모션을 만든다. */
  const runAction = useCallback((fn) => {
    const from = st.log.length
    fn()
    const action = readAction(st.log, from)
    if (action) setFx({ action, at: performance.now() })
    bump()
  }, [st, bump])

  /* 연출 수명 관리 — 타격 시점에 숫자·이펙트를 띄우고, 끝나면 지운다 */
  useEffect(() => {
    if (!fx) return
    setImpact(false)
    const hitAt = setTimeout(() => setImpact(true), ATTACK_MS * IMPACT_AT)
    const off = setTimeout(() => setImpact(false), ATTACK_MS * IMPACT_AT + HITSTOP_MS + 560)
    const done = setTimeout(() => setFx(null), ATTACK_TOTAL_MS + 140)
    return () => { clearTimeout(hitAt); clearTimeout(off); clearTimeout(done) }
  }, [fx])

  /* 궁극기·치명타에서만 화면을 흔든다 */
  const [shake, setShake] = useState(0)
  useEffect(() => {
    const strength = shakeStrength(fx?.action)
    if (!fx || !strength) { setShake(0); return }
    let raf = 0
    const tick = () => {
      const p = progress(performance.now() - fx.at - ATTACK_MS * IMPACT_AT - HITSTOP_MS, 460)
      setShake(shakeAmount(p, strength))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    /* 반드시 0으로 되돌린다. 탭을 벗어나면 requestAnimationFrame 이 멈추는데,
       그 사이 연출이 끝나 이 효과가 정리되면 흔들린 값이 그대로 남아
       화면이 영영 비뚤어진 채로 있게 된다. */
    return () => { cancelAnimationFrame(raf); setShake(0) }
  }, [fx])

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
    /* 연출이 끝난 뒤에 다음 행동으로 넘어간다 */
    const id = setTimeout(() => runAction(() => enemyAction(st)), ATTACK_TOTAL_MS + 180)
    return () => clearTimeout(id)
  }, [st, runAction])

  /* 최근 로그 한 줄을 화면에 띄운다 */
  useEffect(() => {
    const last = st.log[st.log.length - 1]
    if (!last || !last.text) return
    setFlash(last.text)
    const id = setTimeout(() => setFlash(null), 1100)
    return () => clearTimeout(id)
  }, [st.log.length, st.log])

  const act = (skill, targetUid) => {
    if (!myTurn || !canUse(actor, skill, st.round)) return
    /* 연출이 재생 중이면 새 입력을 막는다 — 안 그러면 모션이 겹쳐 끊긴다 */
    if (fx) return
    runAction(() => castSkill(st, skill.id, targetUid))
    setPending(null)
  }

  const onSkill = (skill) => {
    if (!needsPick(skill)) { act(skill, null); return }
    const opts = targetsFor(st, actor, skill)
    if (opts.length <= 1) { act(skill, opts[0]?.uid); return }
    setPending(skill)     // 대상을 고르게 한다
  }

  const focusEl = ELEMENT_BY_ID[(actor || allyUnits[0]).dragon.element]
  /* 연출용 — 지금 쓰인 스킬과 색 */
  const burstEl = ELEMENT_BY_ID[fx?.action?.element || focusEl.id] || focusEl
  const ultInfo = useMemo(() => {
    if (fx?.action?.kind !== 'ult' || !fx.action.actor) return null
    const u = st.units.find((x) => x.uid === fx.action.actor)
    return u ? skillsOf(u.dragon).find((s) => s.id === fx.action.skill) : null
  }, [fx, st.units])

  return (
    <div className="fixed inset-0 flex flex-col bg-[#07070e]"
      style={{ transform: shake ? `translate(${shake}px, ${shake * 0.5}px)` : undefined }}>
      <div className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 10%, ${focusEl.deep}, transparent 65%)` }} />

      {/* 상단 — 스테이지 정보 */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2">
        <div>
          <div className="text-[10px] tracking-widest text-slate-400">
            {difficulty?.name} · <span className={st.round % 2 === 1 ? 'text-sky-300' : 'text-fuchsia-300'}>
              {st.round}라운드 ({st.round % 2 === 1 ? '홀수' : '짝수'})
            </span>
          </div>
          <div className="text-sm font-black text-white">{stage.name}</div>
        </div>
        {/* 나가기 자리에 도주를 둔다 — 전투 중에 화면을 뜨는 유일한 방법이므로
            같은 위치에 있어야 손이 헷갈리지 않는다 */}
        <button onClick={() => { flee(st); bump() }} disabled={!myTurn}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-40">
          도주
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
        {[{ side: 'enemy', list: foeUnits, flip: true }, { side: 'ally', list: allyUnits, flip: false }].map((lane) => {
          /* 그 편에서 지금 연출의 주인공을 고른다.
             살아있는 첫 마리만 3D로 세우므로, 역할도 그 마리 기준으로 본다.
             단 맞은 유닛이 따로 있으면 그쪽을 비춰야 타격이 보인다. */
          const alive = lane.list.filter((u) => u.alive)
          const acting = fx?.action
            ? lane.list.find((u) => roleOf(fx.action, u.uid)) : null
          const shown = (acting && acting.alive ? acting : alive[0]) || lane.list[0]
          if (!shown) return <div key={lane.side} className="h-full flex-1" />
          const role = fx?.action ? roleOf(fx.action, shown.uid) : null
          const pops = impact && fx?.action ? popsFor(fx.action, shown.uid) : []
          const burstColor = ELEMENT_BY_ID[fx?.action?.element || shown.dragon.element]?.glow || '#fff'
          return (
            <div key={lane.side} className="relative h-full flex-1">
              <UnitStage unit={shown} flip={lane.flip} aimed={!!pending}
                role={role} startedAt={fx?.at} ult={fx?.action?.kind === 'ult'} />
              {impact && (role === 'hurt') && (
                <ImpactBurst color={burstColor}
                  ult={fx?.action?.kind === 'ult'} crit={fx?.action?.crit} />
              )}
              <Pops pops={pops} />
            </div>
          )
        })}
        {/* 궁극기 컷인 — 화면 전체를 가로지른다 */}
        {fx?.action?.kind === 'ult' && ultInfo && (
          <UltCutIn name={ultInfo.name} icon={ultInfo.icon} color={burstEl.glow} />
        )}
      </div>

      {/* 궁극기 순간 화면 전체가 속성 색으로 번쩍인다 */}
      {impact && fx?.action?.kind === 'ult' && (
        <div className="dm-flash pointer-events-none absolute inset-0 z-30"
          style={{ background: burstEl.glow }} />
      )}

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
            const usable = myTurn && canUse(actor, sk, st.round)
            const lock = actor ? lockReason(actor, sk, st.round) : null
            const ult = isUlt(sk)
            /* 홀/짝 스킬은 "언제 열리는지"를 항상 보여준다 */
            const slot = sk.kind === 's1' ? '홀수 턴' : sk.kind === 's2' ? '짝수 턴' : ult ? '궁극기' : '기본'
            return (
              <button key={sk.id} onClick={() => onSkill(sk)} disabled={!usable}
                title={`${sk.name} — ${sk.desc}`}
                className={`relative overflow-hidden rounded-xl border py-2 text-center transition ${
                  usable
                    ? ult
                      ? 'border-amber-300/70 bg-gradient-to-b from-amber-500/30 to-orange-500/20 hover:brightness-125'
                      : 'border-white/15 bg-white/[.07] hover:bg-white/[.14]'
                    : 'cursor-not-allowed border-white/5 bg-white/[.02] opacity-45'
                }`}>
                <div className="text-base leading-none">{sk.icon}</div>
                <div className="mt-0.5 truncate px-1 text-[10px] font-bold text-white">{sk.name}</div>
                <div className={`text-[9px] ${ult ? 'text-amber-300' : 'text-sky-300'}`}>{slot}</div>
                {lock && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-1 text-[10px] font-black leading-tight text-slate-300">
                    {lock}
                  </div>
                )}
              </button>
            )
          })}
        </div>
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
