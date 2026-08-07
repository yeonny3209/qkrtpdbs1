/* ==================================================================
   보유 드래곤 — 편성(최대 3) · 진화
   ================================================================== */
import { useState } from 'react'
import DragonPreview from './DragonPreview.jsx'
import GearPanel from './GearPanel.jsx'
import { ELEMENT_BY_ID } from '../game/elements.js'
import {
  DRAGON_BY_ID, RARITY_BY_ID, expToNext, MAX_LEVEL, expToMax,
  STAT_KEYS, STAT_LABEL, MAX_EVOLUTION, EVOLUTIONS, evoCost, evoGoldCost, evolutionPassives,
} from '../game/dragons.js'
import { EXP_ORBS, planFeed } from '../game/orbs.js'
import { skillsetOf, passiveDesc } from '../game/skills.js'
import { SLOT_IDS, finalStats, gearedPower } from '../game/equipment.js'
import { runeStatMul } from '../game/runes.js'
import {
  levelCap, evoLevelCap, isWalled, canBreak, drinkCost, breakGoldCost,
  skillPowerMul, LEVELS_PER_BREAK,
} from '../game/breakthrough.js'

export const TEAM_SIZE = 3

/* 부족한 분신 1마리를 진화석 몇 개로 대신할 수 있는가.
   결정 동굴을 돌면 중복이 안 떠도 진화를 이어갈 수 있게 하는 장치다. */
export const STONES_PER_COPY = 40

/* ==================================================================
   경험 구슬 먹이기 — 개수를 정해 한 번에 쓴다

   한 개씩만 누르게 하면 만렙까지 수백 번을 눌러야 한다.
   구슬마다 수량 조절을 두고, "만렙까지 알아서"도 따로 뺐다.
   ================================================================== */
function OrbFeeder({ orbs, level, exp, onFeed, onAuto }) {
  /* 구슬마다 지금 고른 개수 */
  const [qty, setQty] = useState({})
  const need = expToMax(level, exp)
  const auto = planFeed(orbs, need)

  const pick = (id) => Math.max(1, Math.min(qty[id] ?? 1, orbs[id] || 0))
  const bump = (id, d) => setQty((q) => {
    const have = orbs[id] || 0
    return { ...q, [id]: Math.max(1, Math.min((q[id] ?? 1) + d, have)) }
  })

  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">경험 구슬을 먹여 레벨을 올립니다</span>
        <span className="text-[10px] tabular-nums text-slate-500">만렙까지 {need.toLocaleString()} EXP</span>
      </div>

      {/* 만렙까지 한 번에 */}
      <button onClick={onAuto} disabled={auto.count <= 0}
        className={`mt-1.5 w-full rounded-xl py-2 text-[12px] font-black transition ${
          auto.count > 0
            ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:brightness-110'
            : 'cursor-not-allowed bg-slate-800 text-slate-600'
        }`}>
        {auto.count > 0
          ? `만렙까지 알아서 먹이기 (구슬 ${auto.count}개 · ${auto.total.toLocaleString()} EXP)`
          : '먹일 구슬이 없습니다'}
      </button>

      {/* 종류별로 개수를 정해서 */}
      <div className="mt-2 space-y-1">
        {EXP_ORBS.map((orb) => {
          const have = orbs[orb.id] || 0
          const n = pick(orb.id)
          return (
            <div key={orb.id}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                have > 0 ? 'border-white/12 bg-black/30' : 'border-white/5 bg-black/20 opacity-45'
              }`}>
              <span className="text-sm">{orb.icon}</span>
              <span className="w-9 shrink-0 text-[10px] tabular-nums text-slate-400">{have}개</span>
              {/* 수량 조절 */}
              <button onClick={() => bump(orb.id, -1)} disabled={have <= 0}
                className="h-6 w-6 shrink-0 rounded bg-white/10 text-[13px] font-black text-white hover:bg-white/20 disabled:opacity-30">−</button>
              <span className="w-7 shrink-0 text-center text-[12px] font-black tabular-nums text-white">
                {have > 0 ? n : 0}
              </span>
              <button onClick={() => bump(orb.id, +1)} disabled={have <= 0 || n >= have}
                className="h-6 w-6 shrink-0 rounded bg-white/10 text-[13px] font-black text-white hover:bg-white/20 disabled:opacity-30">+</button>
              <button onClick={() => setQty((q) => ({ ...q, [orb.id]: have }))} disabled={have <= 0}
                className="shrink-0 rounded bg-white/10 px-1.5 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/20 disabled:opacity-30">
                전부
              </button>
              <button onClick={() => { onFeed(orb.id, n); setQty((q) => ({ ...q, [orb.id]: 1 })) }}
                disabled={have <= 0}
                title={`${orb.name} ${n}개 — ${(orb.exp * n).toLocaleString()} EXP`}
                className={`ml-auto shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                  have > 0 ? 'bg-sky-500/80 text-white hover:bg-sky-400' : 'cursor-not-allowed bg-slate-800 text-slate-600'
                }`}>
                +{(orb.exp * (have > 0 ? n : 0)).toLocaleString()}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function RosterScreen({
  dragons, team, gold, gems = 0, stones = 0, orbs = {}, drinks = 0,
  inventory = [], runeBag = [], gear = {},
  onToggleTeam, onEvolve, onFeed, onAutoFeed, onBreak, onBack, gearActions = {},
}) {
  const [detail, setDetail] = useState(null)
  /* 드래곤별 장착 정보 — gear[id] = { loadout: {slot:uid}, rune: uid } */
  const wornOf = (id) => {
    const g = gear[id]?.loadout || {}
    return Object.fromEntries(SLOT_IDS.map((s) => [s, inventory.find((i) => i.uid === g[s]) || null]))
  }
  const runeMulOf = (id) => runeStatMul(runeBag.find((r) => r.uid === gear[id]?.rune) || null)

  const owned = Object.entries(dragons)
    .map(([id, s]) => ({ id, ...s, dragon: DRAGON_BY_ID[id] }))
    .filter((o) => o.dragon)
    .sort((a, b) =>
      gearedPower(b.dragon, b.level, b.evo, wornOf(b.id), runeMulOf(b.id))
      - gearedPower(a.dragon, a.level, a.evo, wornOf(a.id), runeMulOf(a.id)))

  const d = detail ? owned.find((o) => o.id === detail) : null

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <button onClick={onBack} className="text-[12px] font-bold text-slate-400 hover:text-white">← 홈</button>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">🐲 보유 드래곤</h2>
            <p className="text-[12px] text-slate-500">
              편성 {team.length}/{TEAM_SIZE} · 총 {owned.length}종 보유
            </p>
          </div>
          <div className="flex gap-2 text-[12px] font-black">
            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-amber-200">
              🪙 {gold.toLocaleString()}
            </div>
            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-violet-200">
              💠 {stones.toLocaleString()}
            </div>
          </div>
        </div>

        {owned.length === 0 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center text-[13px] text-slate-500">
            아직 드래곤이 없습니다. 소환에서 드래곤을 얻어보세요.
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {owned.map((o) => {
            const el = ELEMENT_BY_ID[o.dragon.element]
            const rar = RARITY_BY_ID[o.dragon.rarity]
            const inTeam = team.includes(o.id)
            return (
              <div key={o.id}
                className="overflow-hidden rounded-2xl border p-3"
                style={{
                  borderColor: inTeam ? '#c084fc99' : rar.color + '44',
                  background: `linear-gradient(155deg, ${el.deep}bb, #0b0b14 72%)`,
                }}>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-black" style={{ color: rar.color }}>{'★'.repeat(rar.star)}</span>
                  <span className="text-lg">{el.icon}</span>
                </div>
                <div className="mt-1 truncate text-[12px] font-black text-white">{o.dragon.name}</div>
                <div className="text-[10px] text-slate-400">
                  Lv.{o.level} · {o.evo > 0 ? `${o.evo}진화` : '0진화'} · 보유 {o.count}
                </div>
                <div className="mt-1.5 flex gap-1">
                  <button onClick={() => onToggleTeam(o.id)}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-black transition ${
                      inTeam ? 'bg-fuchsia-500/80 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}>
                    {inTeam ? '편성됨' : '편성'}
                  </button>
                  <button onClick={() => setDetail(o.id)}
                    className="rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/20">
                    정보
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 상세 · 진화 */}
      {d && (
        <DetailPanel o={d} gold={gold} gems={gems} stones={stones} orbs={orbs} drinks={drinks}
          onFeed={onFeed} onAutoFeed={onAutoFeed} onBreak={onBreak}
          worn={wornOf(d.id)} runeMul={runeMulOf(d.id)}
          loadout={gear[d.id]?.loadout || {}} runeId={gear[d.id]?.rune || null}
          inventory={inventory} runeBag={runeBag} gearActions={gearActions}
          onEvolve={onEvolve} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function DetailPanel({
  o, gold, gems, stones, orbs, drinks = 0, worn, runeMul, loadout, runeId,
  inventory, runeBag, gearActions,
  onEvolve, onFeed, onAutoFeed, onBreak, onClose,
}) {
  const skillset = skillsetOf(o.dragon)
  /* 돌파 상태 — 지금 상한, 벽에 막혔는지, 돌파할 수 있는지 */
  const breaks = o.breaks ?? 0
  const cap = levelCap(o.evo, breaks)
  const atCap = o.level >= cap
  const walled = isWalled(o.level, o.evo, breaks)
  const chk = canBreak(o.level, o.evo, breaks, drinks, gold)
  const breakOk = chk.ok
  const breakWhy = chk.why
  const el = ELEMENT_BY_ID[o.dragon.element]
  const rar = RARITY_BY_ID[o.dragon.rarity]
  /* 장비·룬까지 반영한 실제 값 — 전투에 들어가는 수치와 같다 */
  const cur = finalStats(o.dragon, o.level, o.evo, worn, runeMul)
  const next = o.evo < MAX_EVOLUTION ? finalStats(o.dragon, o.level, o.evo + 1, worn, runeMul) : null
  const step = o.evo + 1
  const needCopies = evoCost(step)
  const needGold = evoGoldCost(step)
  /* 진화에 쓸 수 있는 여분 = 보유 수 - 본체 1 */
  const spare = o.count - 1
  /* 모자라는 만큼은 진화석으로 메운다 */
  const missing = Math.max(0, needCopies - spare)
  const needStones = missing * STONES_PER_COPY
  const canEvo = next && gold >= needGold && stones >= needStones

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border shadow-2xl"
        style={{ borderColor: rar.color + '55', background: `linear-gradient(170deg, ${el.deep}, #0a0a12 65%)` }}>
        <DragonPreview elementId={o.dragon.element} rarity={o.dragon.rarity} dragonId={o.dragon.id} className="h-48 w-full" />
        <div className="p-5 pt-0">
          <div className="text-[10px] font-black tracking-[0.3em]" style={{ color: rar.color }}>
            {'★'.repeat(rar.star)} {rar.name}
          </div>
          <h3 className="mt-1 text-xl font-black text-white">{o.dragon.name}</h3>
          <div className="text-[12px] font-bold" style={{ color: el.glow }}>
            {el.icon} {el.name} · {el.role}
          </div>

          {/* 레벨 · 경험 구슬 · 돌파 */}
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <div className="flex justify-between text-[12px]">
              <span className="font-black text-white">
                Lv.{o.level}
                <span className="ml-1 text-slate-500">/ {cap}</span>
                {o.level >= MAX_LEVEL && <span className="ml-1 text-amber-300">MAX</span>}
              </span>
              <span className="tabular-nums text-slate-400">
                {atCap ? (walled ? '돌파 필요' : '상한') : `${o.exp} / ${expToNext(o.level)} EXP`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${atCap ? 100 : Math.min(100, (o.exp / expToNext(o.level)) * 100)}%`,
                  background: walled ? '#fbbf24' : '#38bdf8',
                }} />
            </div>

            {/* 구슬을 먹여 레벨을 올린다 — 한 번에 여러 개 쓸 수 있다 */}
            {!atCap && (
              <OrbFeeder orbs={orbs} level={o.level} exp={o.exp}
                onFeed={(orbId, n) => onFeed(o.id, orbId, n)}
                onAuto={() => onAutoFeed(o.id)} />
            )}

            {/* 돌파 — 상한에 닿았을 때만 뜬다 */}
            {atCap && (
              <div className="mt-2.5 rounded-lg border p-2.5"
                style={{
                  borderColor: breakOk ? 'rgba(251,191,36,.45)' : 'rgba(255,255,255,.10)',
                  background: breakOk ? 'rgba(251,191,36,.08)' : 'rgba(255,255,255,.03)',
                }}>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-black text-amber-200">
                    ⚡ 돌파 {breaks}회
                    <span className="ml-1.5 font-bold text-slate-400">
                      스킬 위력 ×{skillPowerMul(breaks).toFixed(2)}
                    </span>
                  </div>
                  {walled && (
                    <div className="text-[10px] text-slate-400">
                      🧪 {drinkCost(breaks)} · 🪙 {breakGoldCost(breaks).toLocaleString()}
                    </div>
                  )}
                </div>

                {walled ? (
                  <>
                    <div className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      상한이 Lv.{cap + LEVELS_PER_BREAK} 로 열리고,
                      스킬 위력이 ×{skillPowerMul(breaks + 1).toFixed(2)} 가 됩니다.
                    </div>
                    <button disabled={!breakOk} onClick={() => onBreak?.(o.id)}
                      className="mt-2 w-full rounded-lg py-2 text-[12px] font-black transition disabled:cursor-not-allowed"
                      style={breakOk
                        ? { background: '#fbbf24', color: '#0f172a' }
                        : { background: 'rgba(255,255,255,.08)', color: '#64748b' }}>
                      {breakOk ? '돌파하기' : breakWhy}
                    </button>
                  </>
                ) : (
                  <div className="mt-1 text-[10px] text-slate-400">
                    {o.evo >= MAX_EVOLUTION
                      ? '더 올릴 수 있는 상한이 없습니다.'
                      : `진화하면 상한이 Lv.${evoLevelCap(o.evo + 1)} 로 늘어납니다.`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 스킬셋 */}
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <div className="text-[11px] font-black text-white">스킬셋</div>
            <div className="mt-1.5 space-y-1">
              {[[skillset.s1, '1스킬 · 홀수 턴', '#38bdf8'],
                [skillset.s2, '2스킬 · 짝수 턴', '#e879f9'],
                [skillset.ult, '궁극기 · 5턴 쿨', '#fbbf24']].map(([sk, label, c]) => (
                <div key={sk.id} className="flex items-center gap-1.5 text-[11px]">
                  <span>{sk.icon}</span>
                  <span className="truncate font-bold text-white">{sk.name}</span>
                  <span className="ml-auto shrink-0 text-[9px]" style={{ color: c }}>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span>{skillset.passive.icon}</span>
                <span className="truncate font-bold text-emerald-300">{skillset.passive.name}</span>
                <span className="ml-auto shrink-0 text-[9px] text-emerald-400">패시브</span>
              </div>
              <div className="text-[10px] leading-relaxed text-slate-500">{passiveDesc(skillset.passive)}</div>
            </div>
          </div>

          {/* 능력치 */}
          <div className="mt-3 space-y-1">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2 text-[12px]">
                <span className="w-9 text-slate-400">{STAT_LABEL[k]}</span>
                <span className="ml-auto font-mono font-bold text-white">{cur[k]}</span>
                {next && <span className="w-16 text-right font-mono text-emerald-400">+{next[k] - cur[k]}</span>}
              </div>
            ))}
          </div>

          {/* 진화 */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black text-white">진화 {o.evo} / {MAX_EVOLUTION}</span>
              <span className="text-[10px] text-slate-400">패시브 {evolutionPassives(o.evo)}개</span>
            </div>
            {next ? (
              <>
                <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  {EVOLUTIONS[o.evo].note}
                </div>
                <div className="mt-2 flex justify-between text-[11px]">
                  <span className={spare >= needCopies ? 'text-emerald-400' : 'text-slate-400'}>
                    같은 드래곤 {Math.min(spare, needCopies)} / {needCopies}
                  </span>
                  <span className={gold >= needGold ? 'text-emerald-400' : 'text-rose-400'}>
                    🪙 {needGold.toLocaleString()}
                  </span>
                </div>
                {missing > 0 && (
                  <div className={`mt-1 text-[11px] ${stones >= needStones ? 'text-violet-300' : 'text-rose-400'}`}>
                    부족한 {missing}마리를 진화석으로 대체 · 💠 {needStones} (보유 {stones})
                  </div>
                )}
                <button onClick={() => { onEvolve(o.id); onClose() }} disabled={!canEvo}
                  className={`mt-2 w-full rounded-xl py-2.5 text-[13px] font-black transition ${
                    canEvo ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110'
                      : 'cursor-not-allowed bg-slate-800 text-slate-600'}`}>
                  {step}진화 하기
                </button>
              </>
            ) : (
              <div className="mt-2 text-center text-[12px] font-bold text-amber-300">최종 진화 완료</div>
            )}
          </div>

          {/* 장비 · 룬 */}
          <div data-tut="gear">
          <GearPanel
            dragonId={o.id} loadout={loadout} runeId={runeId}
            inventory={inventory} runeBag={runeBag} gold={gold} gems={gems}
            {...gearActions} />
          </div>

          <button onClick={onClose} className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/20">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
